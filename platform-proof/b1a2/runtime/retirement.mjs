import { authenticatedObservation } from "../../src/evidence-source.mjs";
import { hash } from "../../src/protocol.mjs";
import { verifyRecords } from "../../src/ledger.mjs";
import {
  clockContext,
  correlate,
  clockFresh,
  platformCoverage,
} from "./time-model.mjs";

const finite = Number.isFinite;
export const DERIVATION_PROTOCOL = "AUTHENTICATED_LEDGER_ACTIVITY_V1";

/** Called only after authenticating the complete ledger and its signed digest.
 * Caller ACTIVITY arrays are not an authority. EFFECT is application time: its
 * initiation comes from the original REQUEST, never from EFFECT.at minus RTT.
 * TLS without a REQUEST is still activity. Unknown attribution cannot certify
 * containment; observer TLS (both authenticated fields null) is not a sender.
 */
function deriveActivities(p, l, records, trials, ctx, now) {
  const old = (r) =>
    r?.authenticatedEpoch === p.retiredEpoch &&
    r.authenticatedRevision === p.retiredRevision;
  const partial = (r) =>
    !!r &&
    !old(r) &&
    (r.authenticatedEpoch === p.retiredEpoch ||
      r.authenticatedRevision === p.retiredRevision);
  const canaries = new Set(trials.map((t) => t?.attemptId).filter(Boolean));
  const connections = new Map(),
    requests = new Map();
  for (const r of records) {
    const map =
      r.event === "TLS_READY"
        ? connections
        : r.event === "REQUEST"
          ? requests
          : null;
    const key = r.event === "TLS_READY" ? r.connectionId : r.attemptId;
    if (map && key) map.set(key, [...(map.get(key) ?? []), r]);
  }
  const unique = (map, key) =>
    map.get(key)?.length === 1 ? map.get(key)[0] : null;
  const attributed = (r) =>
    old(r) ||
    (r.event !== "TLS_READY" && canaries.has(r.attemptId)) ||
    old(unique(connections, r.connectionId));
  const output = [];
  let error;
  const policy = l.transitPolicy;
  function interval(at) {
    if (
      !policy ||
      !finite(policy.upperMs) ||
      policy.upperMs <= 0 ||
      policy.upperMs > 60000 ||
      !finite(policy.validUntil) ||
      policy.scope !== "LOCAL_MEASURED_EXPERIMENT_ONLY" ||
      !Array.isArray(policy.measurementRefs) ||
      !policy.measurementRefs.length ||
      !policy.measurementRefs.every((r) => /^[a-f0-9]{64}$/.test(r))
    )
      throw Error("signed_bounded_transit_policy_required");
    if (!finite(at)) throw Error("provider_activity_timestamp_invalid");
    const expiry = correlate(ctx, policy.validUntil, policy.clockSource);
    if (correlate(ctx, at, l.clockSource).upper > expiry.lower)
      throw Error("activity_outside_signed_transit_policy");
    // Expiry now cannot erase a violation conclusively observed while the
    // signed bound applied. It still prevents a readiness verdict.
    if (expiry.lower < now) error ??= "signed_transit_policy_expired";
    return [at - policy.upperMs, at];
  }
  for (const r of records) {
    if (!["TLS_READY", "REQUEST", "EFFECT"].includes(r.event)) continue;
    const request = r.event === "EFFECT" ? unique(requests, r.attemptId) : r;
    const tls = unique(connections, request?.connectionId ?? r.connectionId);
    const ambiguous = partial(r) || partial(request) || partial(tls);
    const relevant =
      ambiguous || attributed(r) || (request && attributed(request));
    const unknown =
      !relevant &&
      r.event !== "TLS_READY" &&
      !Number.isInteger(r.authenticatedEpoch) &&
      !request?.authenticatedEpoch &&
      !tls?.authenticatedEpoch;
    if (!relevant && !unknown) continue;
    const a = {
      sequence: r.sequence,
      recordHash: r.hash,
      event: r.event,
      clockSource: l.clockSource,
      connect: null,
      write: null,
      unresolved: null,
    };
    try {
      if (ambiguous) throw Error("provider_retired_identity_ambiguous");
      if (unknown) throw Error("provider_activity_identity_missing");
      if (!finite(r.at)) throw Error("provider_activity_timestamp_invalid");
      if (r.event === "TLS_READY") {
        if (connections.get(r.connectionId)?.length !== 1)
          throw Error("provider_connection_binding_ambiguous");
        a.connect = interval(r.at);
      } else {
        if (!request || request.event !== "REQUEST")
          throw Error("provider_effect_initiation_missing");
        if (
          r.event === "EFFECT" &&
          (request.sequence >= r.sequence ||
            request.at > r.at ||
            (r.connectionId && r.connectionId !== request.connectionId))
        )
          throw Error("provider_effect_request_binding_invalid");
        a.write = interval(request.at);
        if (tls) {
          if (
            !old(tls) ||
            tls.sequence >= request.sequence ||
            tls.at > request.at
          )
            throw Error("provider_connection_binding_invalid");
          a.connect = interval(tls.at);
        } else if (
          request.connectionId &&
          connections.has(request.connectionId)
        ) {
          throw Error("provider_connection_binding_ambiguous");
        }
      }
    } catch (e) {
      a.unresolved = e.message;
      error ??= e.message;
    }
    output.push(a);
  }
  return { activities: output, error };
}

/** B1a-2 entry point. No legacy clock/retirement fallback is allowed. */
export function retirementV2({
  fence,
  clock,
  clocks = [],
  canary,
  ledger,
  ledgerRecords = [],
  now,
  uncertaintyMs,
} = {}) {
  const hold = (reason, extra = {}) => ({ state: "HOLD", reason, ...extra });
  if (!Array.isArray(clocks) || !Array.isArray(ledgerRecords))
    return hold("authenticated_retirement_bundle_required");
  const f = authenticatedObservation(fence, "FENCE"),
    ca = authenticatedObservation(canary, "CANARY"),
    le = authenticatedObservation(ledger, "LEDGER"),
    clockTokens = [clock, ...clocks];
  if (
    !f ||
    !ca ||
    !le ||
    !finite(now) ||
    clockTokens.some((c) => !authenticatedObservation(c, "CLOCK"))
  )
    return hold("authenticated_retirement_bundle_required");
  if (
    f.payload.retirementModel !== "METRIC_LATENCY_V2" ||
    clockTokens.some(
      (c) =>
        authenticatedObservation(c, "CLOCK").payload.model !==
        "BOUNDED_DRIFT_V2",
    )
  )
    return hold("b1a2_requires_v2_retirement");
  if (
    ![
      f,
      ca,
      le,
      ...clockTokens.map((c) => authenticatedObservation(c, "CLOCK")),
    ].every((v) => v.sessionId === f.sessionId && v.issuedAt <= now)
  )
    return hold("stale_or_mixed_retirement_bundle");
  const p = f.payload,
    c = ca.payload,
    l = le.payload;
  if (
    c.scope !== p.scope ||
    c.epoch !== p.retiredEpoch ||
    c.revision !== p.retiredRevision ||
    l.scope !== p.scope ||
    l.epoch !== p.retiredEpoch ||
    l.revision !== p.retiredRevision ||
    !p.scope ||
    !Number.isInteger(p.retiredEpoch) ||
    p.retiredEpoch < 1 ||
    !p.retiredRevision
  )
    return hold("retirement_identity_mismatch");
  // Authentication, chain and exact export binding precede every verdict.
  try {
    verifyRecords(ledgerRecords, l.checkpoint);
  } catch {
    return hold("provider_ledger_chain_or_head_invalid");
  }
  if (hash(ledgerRecords) !== l.recordsDigest)
    return hold("provider_export_not_verified");
  let ctx, boundary;
  try {
    ctx = clockContext({
      clock,
      clocks,
      sessionId: f.sessionId,
      now,
      uncertaintyMs,
    });
    boundary = correlate(ctx, p.at, p.clockSource);
  } catch (e) {
    return hold(e.message);
  }
  const trials = Array.isArray(c.trials) ? c.trials : [];
  const derived = deriveActivities(p, l, ledgerRecords, trials, ctx, now);
  const metadata = {
    derivationProtocol: DERIVATION_PROTOCOL,
    derivedActivityCount: derived.activities.length,
    derivedActivitiesDigest: hash(derived.activities),
  };
  const violation = (reason) => ({ state: "VIOLATION", reason, ...metadata });
  let declared,
    declarationError,
    unresolved = derived.error;
  try {
    declared = correlate(
      ctx,
      p.declaredAt,
      p.visibilityClockSource ?? ctx.referenceClockSource,
    );
  } catch (e) {
    declarationError = e.message;
  }
  // Inspect every authenticated canary REQUEST before checking completeness of
  // any trial, count, metrics or tail. A different incomplete trial cannot hide it.
  for (const t of trials) {
    if (
      !t?.parkedBeforeConnect ||
      !t.independentWakeAttempted ||
      !declared ||
      !finite(t.scheduledWakeAt) ||
      t.scheduledWakeAt <= declared.upper
    )
      continue;
    for (const r of ledgerRecords) {
      if (r.event !== "REQUEST" || r.attemptId !== t.attemptId) continue;
      try {
        const at = correlate(ctx, r.at, l.clockSource);
        if (at.lower > declared.upper && at.lower <= now)
          return violation("old_canary_invocation_after_declared_retirement");
      } catch (e) {
        unresolved ??= e.message;
      }
    }
  }
  for (const a of derived.activities) {
    const intervals = [];
    let invalid = a.unresolved;
    for (const x of [a.connect, a.write]) {
      if (!x) continue;
      try {
        intervals.push({
          lower: correlate(ctx, x[0], a.clockSource).lower,
          upper: correlate(ctx, x[1], a.clockSource).upper,
        });
      } catch (e) {
        invalid = e.message;
      }
    }
    if (
      invalid !== "conflicting_authenticated_clock_measurements" &&
      intervals.some((x) => x.lower > boundary.upper && x.lower <= now)
    )
      return violation("post_fence_initiation");
    if (
      invalid ||
      !intervals.length ||
      intervals.some((x) => x.upper >= boundary.lower)
    )
      unresolved ??= invalid ?? "unresolved_activity_interval";
  }
  // Only now can non-fatal evidence gaps produce HOLD. None can mask a proven
  // violation in another record/trial. Freshness is still required for readiness.
  if (unresolved) return hold(unresolved, metadata);
  if (![f, ca, le].every((v) => v.fresh && now < v.expiresAt))
    return hold("stale_or_mixed_retirement_bundle", metadata);
  if (!clockFresh(ctx, now)) return hold("clock_measurement_expired", metadata);
  if (declarationError) return hold(declarationError, metadata);
  let request, deleted, receipt;
  try {
    request = correlate(
      ctx,
      p.retirementRequestedAt,
      p.requestClockSource ?? p.clockSource,
    );
    deleted = correlate(
      ctx,
      p.deletion?.completedAt,
      p.deletion?.clockSource ?? p.clockSource,
    );
    receipt = correlate(
      ctx,
      p.deletion?.receiptObservedAt,
      p.visibilityClockSource ?? ctx.referenceClockSource,
    );
  } catch (e) {
    return hold(e.message, metadata);
  }
  if (
    ![p.terminationTargetMs, p.declaredAt, p.deletion?.receiptObservedAt].every(
      finite,
    ) ||
    p.terminationTargetMs <= 0 ||
    p.terminationTargetMs > 21600000 ||
    !p.deletion?.operationDone ||
    !p.deletion.revisionNotFound ||
    p.deletion.revision !== p.retiredRevision ||
    !/^[a-f0-9]{64}$/.test(p.deletion.rawDigest ?? "") ||
    deleted.lower > receipt.upper ||
    receipt.lower > declared.upper ||
    declared.lower > now
  )
    return hold("platform_deletion_receipt_missing_or_contradictory", metadata);
  if (
    deleted.lower < request.lower ||
    deleted.upper > boundary.lower ||
    boundary.upper - request.lower > p.terminationTargetMs
  )
    return hold("physical_termination_deadline_exceeded", metadata);
  const coverage = platformCoverage(p, now, ctx);
  if (coverage) return hold(coverage, metadata);
  if (
    !Array.isArray(c.trials) ||
    trials.length < 20 ||
    new Set(trials.map((t) => t?.attemptId)).size !== trials.length ||
    ![c.measuredWakeTailMs, c.networkTransitBoundMs, l.observedUntil].every(
      finite,
    ) ||
    c.measuredWakeTailMs < 0 ||
    c.networkTransitBoundMs < 0 ||
    l.observedUntil > now
  )
    return hold("canary_or_ledger_contract_incomplete", metadata);
  for (const t of trials) {
    if (
      !t?.independentWakeAttempted ||
      !t.parkedBeforeConnect ||
      !finite(t.scheduledWakeAt) ||
      !finite(t.wakeObservedAt) ||
      t.wakeObservedAt < t.scheduledWakeAt ||
      !t.independentWakeSource ||
      t.scheduledWakeAt <= declared.upper
    )
      return hold("canary_window_incomplete", metadata);
    let ledgerTime, wakeTime;
    try {
      ledgerTime = correlate(ctx, l.observedUntil, l.clockSource);
      wakeTime = correlate(ctx, t.wakeObservedAt, c.clockSource);
    } catch (e) {
      return hold(e.message, metadata);
    }
    if (
      ledgerTime.lower <
      wakeTime.upper + c.measuredWakeTailMs + c.networkTransitBoundMs
    )
      return hold("canary_or_network_tail_not_observed", metadata);
  }
  return {
    state: "EVIDENCE_READY",
    timeModel: "BOUNDED_DRIFT_V2",
    physicalBoundary: p.at,
    declaredAt: p.declaredAt,
    evidenceCompletedAt: now,
    thresholdBasis: p.thresholdOwnerApproved
      ? "OWNER_POLICY"
      : "PROVISIONAL_SYNTHETIC_TARGET",
    ...metadata,
    evidenceDigest: hash({
      protocol: DERIVATION_PROTOCOL,
      observations: [
        fence.envelopeDigest,
        clock.envelopeDigest,
        ...clocks.map((c) => c.envelopeDigest),
        canary.envelopeDigest,
        ledger.envelopeDigest,
      ],
      recordsDigest: l.recordsDigest,
      activities: derived.activities,
    }),
  };
}
