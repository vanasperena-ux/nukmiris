import { hash, id } from "../../src/protocol.mjs";
import {
  authenticatedObservation,
  measuredClock,
} from "../../src/evidence-source.mjs";
import { classify } from "../../src/classify.mjs";
import { verifyRecords } from "../../src/ledger.mjs";

/** Authenticated receipt contract only. Local fixture receipts do not establish
 * actual Cloud Run deletion, reporting delay, identity or clock behavior.
 */
export function retirementDecision({
  fence,
  clock,
  activities = [],
  canary,
  ledger,
  ledgerRecords = [],
  now,
  uncertaintyMs,
}) {
  const hold = (reason) => ({ state: "HOLD", reason });
  for (const activity of activities) {
    const result = classify({ fence, clock, activity, now, uncertaintyMs });
    if (result.verdict === "VIOLATION")
      return { state: "VIOLATION", reason: result.reason };
  }
  const f = authenticatedObservation(fence, "FENCE"),
    c = authenticatedObservation(clock, "CLOCK"),
    ca = authenticatedObservation(canary, "CANARY"),
    le = authenticatedObservation(ledger, "LEDGER");
  if (!f || !c || !ca || !le)
    return hold("authenticated_retirement_bundle_required");
  if (
    ![f, c, ca, le].every(
      (v) =>
        v.sessionId === f.sessionId &&
        v.fresh &&
        v.issuedAt <= now &&
        now < v.expiresAt,
    )
  )
    return hold("stale_or_mixed_retirement_bundle");
  let m;
  try {
    m = measuredClock(c.payload);
  } catch {
    return hold("measured_clock_required");
  }
  if (
    !Number.isFinite(now) ||
    now > m.validUntil ||
    uncertaintyMs !== m.uncertaintyMs ||
    f.payload.clockSource !== m.referenceClockSource ||
    ca.payload.clockSource !== m.referenceClockSource ||
    le.payload.clockSource !== m.referenceClockSource
  )
    return hold("explicit_reference_clock_required");
  const p = f.payload,
    probes = ca.payload.trials,
    records = le.payload;
  if (
    !p.revisionDeleted ||
    !Array.isArray(p.samples) ||
    !p.samples.length ||
    ![p.at, p.coverUntil, p.reportingDelayMs, p.maxAgeMs].every(
      Number.isFinite,
    ) ||
    p.reportingDelayMs < 0 ||
    p.maxAgeMs <= 0 ||
    p.at < m.measuredAt ||
    p.coverUntil < p.at ||
    p.samples.some(
      (s, i) =>
        !s ||
        !Number.isFinite(s.at) ||
        s.instances !== 0 ||
        s.at < p.at + p.reportingDelayMs ||
        s.at > now ||
        now - s.at > p.maxAgeMs ||
        (i && s.at <= p.samples[i - 1].at),
    ) ||
    p.samples.at(-1).at < p.coverUntil
  )
    return hold("platform_termination_incomplete");
  if (
    !Array.isArray(probes) ||
    probes.length < 20 ||
    new Set(probes.map((v) => v.attemptId)).size !== probes.length ||
    !Number.isFinite(ca.payload.measuredWakeTailMs) ||
    ca.payload.measuredWakeTailMs < 0
  )
    return hold("independent_delayed_wake_contract_required");
  if (
    ca.payload.scope !== p.scope ||
    ca.payload.epoch !== p.retiredEpoch ||
    ca.payload.revision !== p.retiredRevision ||
    records.scope !== p.scope ||
    records.epoch !== p.retiredEpoch ||
    records.revision !== p.retiredRevision
  )
    return hold("retirement_identity_mismatch");
  try {
    verifyRecords(ledgerRecords, records.checkpoint);
  } catch {
    return hold("provider_ledger_chain_or_head_invalid");
  }
  if (
    hash(ledgerRecords) !== records.recordsDigest ||
    !Number.isFinite(records.observedUntil) ||
    records.observedUntil > now
  )
    return hold("provider_export_not_verified");
  for (const probe of probes) {
    if (
      !probe.independentWakeAttempted ||
      !probe.parkedBeforeConnect ||
      !Number.isFinite(probe.scheduledWakeAt) ||
      probe.scheduledWakeAt <= p.coverUntil + uncertaintyMs ||
      records.observedUntil <
        probe.scheduledWakeAt + ca.payload.measuredWakeTailMs
    )
      return hold("canary_window_incomplete");
    if (
      ledgerRecords.some(
        (r) => r.event === "REQUEST" && r.attemptId === probe.attemptId,
      )
    )
      return {
        state: "VIOLATION",
        reason: "old_canary_invocation_after_declared_retirement",
      };
  }
  for (const activity of activities)
    if (
      classify({ fence, clock, activity, now, uncertaintyMs }).verdict !==
      "PRE_FENCE"
    )
      return hold("unresolved_activity_interval");
  return {
    state: "EVIDENCE_READY",
    evidenceDigest: hash([
      fence.envelopeDigest,
      clock.envelopeDigest,
      canary.envelopeDigest,
      ledger.envelopeDigest,
      ...activities.map((a) => a.envelopeDigest),
    ]),
  };
}

/** Controller DB identity is separate from ingress/worker/gateway. Default
 * decisions never enable dispatch. A monthly cap reset is another durable hold.
 */
export class SessionController {
  constructor({ db, sessionId }) {
    id(sessionId);
    this.db = db;
    this.sessionId = sessionId;
  }
  async read() {
    return (
      await this.db.query("SELECT proof.control_read($1) value", [
        this.sessionId,
      ])
    ).rows[0].value;
  }
  async hold(reason) {
    await this.db.query("SELECT proof.control_hold($1,$2)", [
      this.sessionId,
      reason,
    ]);
    return this.read();
  }
  async billing(state) {
    return this.hold(
      state === "ENFORCED"
        ? "BUDGET_PAUSED"
        : state === "CONFIGURED" || state === "AWAITING_NEXT_PERIOD"
          ? "BUDGET_RESET"
          : "CONTROL_UNAVAILABLE",
    );
  }
  async elapsed(now) {
    const state = await this.read();
    if (!state || !Number.isFinite(now) || now >= Date.parse(state.expiresAt))
      return this.hold("SESSION_EXPIRED");
    return { ...state, automaticPromotion: false };
  }
  async advance(oldEpoch, newEpoch, newRevision) {
    await this.db.query("SELECT proof.control_advance($1,$2,$3,$4)", [
      this.sessionId,
      oldEpoch,
      newEpoch,
      newRevision,
    ]);
    return this.read();
  }
  async reconcile(bundle, attemptIds) {
    const proof = retirementDecision(bundle);
    if (proof.state !== "EVIDENCE_READY")
      return { ...proof, dispatchEnabled: false };
    if (!Array.isArray(attemptIds) || attemptIds.length > 100)
      throw Error("bounded_original_attempt_ids_required");
    attemptIds.forEach(id);
    const state = await this.read(),
      f = authenticatedObservation(bundle.fence, "FENCE");
    if (
      !state ||
      state.holdReason !== "FENCE_INCOMPLETE" ||
      f.sessionId !== this.sessionId ||
      f.payload.scope !== state.scopeId ||
      f.payload.retiredEpoch !== state.retiredEpoch ||
      f.payload.retiredRevision !== state.retiredRevision
    )
      return {
        state: "HOLD",
        reason: "retirement_session_or_predecessor_mismatch",
        dispatchEnabled: false,
      };
    const outcomes = [];
    for (const attemptId of attemptIds)
      outcomes.push({
        attemptId,
        state: (
          await this.db.query("SELECT proof.recover_retired($1,$2,$3) state", [
            this.sessionId,
            attemptId,
            proof.evidenceDigest,
          ])
        ).rows[0].state,
      });
    return {
      state: "RECONCILED_OR_HELD",
      outcomes,
      dispatchEnabled: false,
      evidenceDigest: proof.evidenceDigest,
    };
  }
  async promote(bundle) {
    const proof = retirementDecision(bundle);
    if (proof.state !== "EVIDENCE_READY")
      return { ...proof, dispatchEnabled: false };
    const state = await this.read();
    if (!state)
      return {
        state: "HOLD",
        reason: "session_missing",
        dispatchEnabled: false,
      };
    if (state.holdReason !== "FENCE_INCOMPLETE")
      return {
        state: "HOLD",
        reason: "protected_hold_requires_new_epoch",
        dispatchEnabled: false,
      };
    const f = authenticatedObservation(bundle.fence, "FENCE");
    if (
      f.sessionId !== this.sessionId ||
      f.payload.scope !== state.scopeId ||
      f.payload.retiredEpoch !== state.retiredEpoch ||
      f.payload.retiredRevision !== state.retiredRevision
    )
      return {
        state: "HOLD",
        reason: "retirement_session_or_predecessor_mismatch",
        dispatchEnabled: false,
      };
    await this.db.query("SELECT proof.control_promote($1,$2,$3,$4)", [
      this.sessionId,
      state.epoch,
      state.generation,
      proof.evidenceDigest,
    ]);
    return this.read();
  }
}
