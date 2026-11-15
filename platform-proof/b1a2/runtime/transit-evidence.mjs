import { authenticatedObservation } from "../../src/evidence-source.mjs";
import { hash } from "../../src/protocol.mjs";
import { verifyRecords } from "../../src/ledger.mjs";
import { clockContext, correlate, clockFresh } from "./time-model.mjs";

export const TRANSIT_PROTOCOL = "INDEPENDENT_TRANSIT_MEASUREMENT_V1";
export const TRANSIT_PHASES = [
  "CONNECT_BEGIN",
  "TCP_CONNECTED",
  "TLS_ESTABLISHED",
  "WRITE_BEGIN",
  "WRITE_END",
];

/** A measurement is evidence about one controlled probe, never a universal
 * delivery bound for paused gateways/TCP buffers. No cloud policy capability is
 * minted here. Independent source/key pins are supplied outside each bundle.
 */
export function assessTransitEvidence({
  probe,
  ledger,
  ledgerRecords,
  clock,
  clocks = [],
  expected,
  fenceAt,
  now,
  uncertaintyMs,
  candidateUpperMs,
  canary,
} = {}) {
  const held = (reason, more = {}) => ({
    state: "HOLD",
    reason,
    dispatchEnabled: false,
    promotionAuthorized: false,
    containmentProven: false,
    ...more,
  });
  const p = authenticatedObservation(probe, "ACTIVITY"),
    l = authenticatedObservation(ledger, "LEDGER");
  if (
    !p ||
    !l ||
    !expected ||
    !Array.isArray(clocks) ||
    ![expected.providerFingerprint, expected.probeFingerprint].every(
      (v) =>
        typeof v === "string" && /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(v),
    ) ||
    !Number.isFinite(now) ||
    ![p, l].every(
      (v) =>
        v.sessionId === expected.sessionId &&
        v.issuedAt <= now &&
        v.fresh &&
        now < v.expiresAt,
    ) ||
    p.keyId !== expected.probeKeyId ||
    l.keyId !== expected.providerObserverKeyId ||
    p.keyId === l.keyId
  )
    return held("independent_transit_authentication_required");
  const v = p.payload,
    q = l.payload;
  if (
    v.protocol !== TRANSIT_PROTOCOL ||
    v.scopeId !== expected.scopeId ||
    q.scope !== expected.scopeId ||
    v.epoch !== expected.epoch ||
    v.revision !== expected.revision ||
    q.epoch !== expected.epoch ||
    q.revision !== expected.revision ||
    v.providerFingerprint !== expected.providerFingerprint ||
    q.providerFingerprint !== expected.providerFingerprint ||
    v.probeFingerprint !== expected.probeFingerprint ||
    !v.attemptId ||
    !v.operationId ||
    !v.payloadDigest
  )
    return held("transit_session_or_provider_identity_mismatch");
  try {
    verifyRecords(ledgerRecords, q.checkpoint);
  } catch {
    return held("transit_ledger_chain_invalid");
  }
  if (hash(ledgerRecords) !== q.recordsDigest)
    return held("transit_export_digest_mismatch");
  if (
    !Array.isArray(v.phases) ||
    v.phases.length !== TRANSIT_PHASES.length ||
    !v.phases.every(
      (x, i) =>
        x.phase === TRANSIT_PHASES[i] &&
        Number.isFinite(x.at) &&
        /^\d+$/.test(x.monotonicNs ?? "") &&
        (!i || BigInt(x.monotonicNs) >= BigInt(v.phases[i - 1].monotonicNs)),
    )
  )
    return held("complete_monotonic_transit_phases_required");
  const requests = ledgerRecords.filter(
      (r) => r.event === "REQUEST" && r.attemptId === v.attemptId,
    ),
    request = requests[0],
    tls = ledgerRecords.filter(
      (r) =>
        r.event === "TLS_READY" && r.connectionId === request?.connectionId,
    );
  if (
    requests.length !== 1 ||
    tls.length !== 1 ||
    ![request, tls[0]].every(
      (r) =>
        r.authenticatedEpoch === expected.epoch &&
        r.authenticatedRevision === expected.revision &&
        r.authenticatedFingerprint === expected.probeFingerprint,
    ) ||
    request.operationId !== v.operationId ||
    request.scopeId !== expected.scopeId ||
    request.payloadDigest !== v.payloadDigest ||
    request.actualDigest !== v.payloadDigest ||
    tls[0].remotePort !== v.localPort ||
    tls[0].sequence >= request.sequence
  )
    return held("independent_probe_provider_flow_binding_missing");
  let ctx, phase, arrival, boundary, observedUntil;
  if (
    ![clock, ...clocks].every(
      (c) =>
        authenticatedObservation(c, "CLOCK")?.keyId ===
        expected.providerObserverKeyId,
    )
  )
    return held("independent_transit_clock_pin_required");
  try {
    ctx = clockContext({
      clock,
      clocks,
      sessionId: expected.sessionId,
      now,
      uncertaintyMs,
    });
    if (!clockFresh(ctx, now)) return held("transit_clock_stale");
    phase = v.phases.map((x) => correlate(ctx, x.at, v.clockSource));
    arrival = correlate(ctx, request.at, q.clockSource);
    observedUntil = correlate(ctx, q.observedUntil, q.clockSource);
    boundary = correlate(ctx, fenceAt, ctx.referenceClockSource);
  } catch (e) {
    return held(e.message);
  }
  const begin = phase[3],
    end = phase[4],
    connect = phase[0];
  if (
    arrival.upper < begin.lower ||
    phase.some(
      (x, i) => x.lower > now || (i && phase[i - 1].lower > x.upper),
    ) ||
    !Number.isFinite(q.observedUntil) ||
    observedUntil.upper < arrival.lower
  )
    return held("transit_clock_order_inconsistent");
  const observedDelayMs = {
    lower: Math.max(0, arrival.lower - end.upper),
    upper: Math.max(0, arrival.upper - begin.lower),
  };
  const sample = {
    observedDelayMs,
    phaseIntervals: Object.fromEntries(
      TRANSIT_PHASES.map((k, i) => [k, phase[i]]),
    ),
    providerArrival: arrival,
    connectionId: request.connectionId,
    evidenceDigest: hash([
      probe.envelopeDigest,
      ledger.envelopeDigest,
      clock.envelopeDigest,
      ...clocks.map((c) => c.envelopeDigest),
    ]),
    sampleCount: 1,
  };
  // A signed independent WRITE after the fence is conclusive even on a socket
  // established before it. Samples concern this probe, not unobserved traffic.
  if (begin.lower > boundary.upper || connect.lower > boundary.upper)
    return {
      ...held("independently_observed_post_fence_initiation", sample),
      state: "VIOLATION",
      initiationClass: "POST_FENCE",
    };
  if (end.upper >= boundary.lower || connect.upper >= boundary.lower)
    return held("transit_fence_order_uncertain", {
      ...sample,
      initiationClass: "UNCERTAIN",
    });
  const pre = { ...sample, initiationClass: "PRE_FENCE" };
  if (canary !== undefined) {
    const w = authenticatedObservation(canary, "CANARY");
    if (
      !w ||
      w.keyId !== expected.providerObserverKeyId ||
      w.sessionId !== expected.sessionId ||
      !w.fresh ||
      now >= w.expiresAt ||
      w.payload.scope !== expected.scopeId ||
      w.payload.epoch !== expected.epoch ||
      w.payload.revision !== expected.revision ||
      !Array.isArray(w.payload.trials) ||
      !w.payload.trials.length
    )
      return held("authenticated_transit_canary_required", pre);
    for (const t of w.payload.trials) {
      try {
        if (
          !t.independentWakeAttempted ||
          t.wakeObservedAt < t.scheduledWakeAt ||
          correlate(ctx, t.wakeObservedAt, w.payload.clockSource).upper > now
        )
          return held("late_canary_wake_not_observed", pre);
      } catch {
        return held("late_canary_wake_not_observed", pre);
      }
    }
  }
  if (!Number.isFinite(candidateUpperMs) || candidateUpperMs <= 0)
    return held("no_finite_cloud_transit_basis", pre);
  if (candidateUpperMs > 60000)
    return held("candidate_bound_outside_experiment_envelope", pre);
  if (observedDelayMs.upper > candidateUpperMs)
    return held("observed_delay_exceeds_candidate_bound", pre);
  return {
    state: "COLLECTED",
    reason: "finite_samples_do_not_prove_cloud_bound",
    ...pre,
    dispatchEnabled: false,
    promotionAuthorized: false,
    containmentProven: false,
    proposedUpperMs: candidateUpperMs,
    usableAsRetirementPolicy: false,
  };
}

/** Explicit fail-closed experiment protocol. Collect and preserve evidence,
 * kill/teardown on expiry or failure, never promote based on a measured maximum.
 * This decision allocates no operation/attempt identity and has no I/O. */
export function transitCollectionGate(assessment) {
  return {
    state: "HOLD",
    reason:
      assessment?.state === "VIOLATION"
        ? "transit_violation_abort_and_independent_kill_required"
        : "cloud_finite_bound_not_established",
    collectionState: assessment?.state ?? "MISSING",
    dispatchEnabled: false,
    promotionAuthorized: false,
    automaticResend: false,
    newIdentityAllocated: false,
  };
}
