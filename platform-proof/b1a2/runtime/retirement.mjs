import { authenticatedObservation } from "../../src/evidence-source.mjs";
import { hash } from "../../src/protocol.mjs";
import { verifyRecords } from "../../src/ledger.mjs";
import {
  clockContext,
  correlate,
  clockFresh,
  platformCoverage,
  classifyBounded,
} from "./time-model.mjs";
const finite = Number.isFinite;
export function retirementV2({
  fence,
  clock,
  clocks = [],
  activities = [],
  canary,
  ledger,
  ledgerRecords = [],
  now,
  uncertaintyMs,
}) {
  const hold = (reason) => ({ state: "HOLD", reason });
  for (const activity of activities) {
    const v = classifyBounded({
      fence,
      clock,
      clocks,
      activity,
      now,
      uncertaintyMs,
    });
    if (v.verdict === "VIOLATION")
      return { state: "VIOLATION", reason: v.reason };
  }
  const f = authenticatedObservation(fence, "FENCE"),
    ca = authenticatedObservation(canary, "CANARY"),
    le = authenticatedObservation(ledger, "LEDGER");
  if (!f || !ca || !le || !finite(now))
    return hold("authenticated_retirement_bundle_required");
  if (
    ![f, ca, le].every(
      (v) =>
        v.sessionId === f.sessionId &&
        v.fresh &&
        v.issuedAt <= now &&
        now < v.expiresAt,
    )
  )
    return hold("stale_or_mixed_retirement_bundle");
  const p = f.payload,
    c = ca.payload,
    l = le.payload;
  let ctx, boundary, request, deleted, receipt, declared;
  try {
    ctx = clockContext({
      clock,
      clocks,
      sessionId: f.sessionId,
      now,
      uncertaintyMs,
    });
    if (!clockFresh(ctx, now)) return hold("clock_measurement_expired");
    boundary = correlate(ctx, p.at, p.clockSource);
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
    declared = correlate(
      ctx,
      p.declaredAt,
      p.visibilityClockSource ?? ctx.referenceClockSource,
    );
  } catch (e) {
    return hold(e.message);
  }
  if (
    p.retirementModel !== "METRIC_LATENCY_V2" ||
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
    return hold("platform_deletion_receipt_missing_or_contradictory");
  if (
    deleted.lower < request.lower ||
    deleted.upper > boundary.lower ||
    boundary.upper - request.lower > p.terminationTargetMs
  )
    return hold("physical_termination_deadline_exceeded");
  const coverage = platformCoverage(p, now, ctx);
  if (coverage) return hold(coverage);
  if (
    c.scope !== p.scope ||
    c.epoch !== p.retiredEpoch ||
    c.revision !== p.retiredRevision ||
    l.scope !== p.scope ||
    l.epoch !== p.retiredEpoch ||
    l.revision !== p.retiredRevision
  )
    return hold("retirement_identity_mismatch");
  if (
    !Array.isArray(c.trials) ||
    c.trials.length < 20 ||
    new Set(c.trials.map((t) => t.attemptId)).size !== c.trials.length ||
    ![c.measuredWakeTailMs, c.networkTransitBoundMs, l.observedUntil].every(
      finite,
    ) ||
    c.measuredWakeTailMs < 0 ||
    c.networkTransitBoundMs < 0
  )
    return hold("canary_or_ledger_contract_incomplete");
  try {
    verifyRecords(ledgerRecords, l.checkpoint);
  } catch {
    return hold("provider_ledger_chain_or_head_invalid");
  }
  if (hash(ledgerRecords) !== l.recordsDigest)
    return hold("provider_export_not_verified");
  for (const t of c.trials) {
    if (
      !t.independentWakeAttempted ||
      !t.parkedBeforeConnect ||
      !finite(t.scheduledWakeAt) ||
      !finite(t.wakeObservedAt) ||
      t.wakeObservedAt < t.scheduledWakeAt ||
      !t.independentWakeSource ||
      t.scheduledWakeAt <= declared.upper
    )
      return hold("canary_window_incomplete");
    if (
      ledgerRecords.some(
        (r) => r.event === "REQUEST" && r.attemptId === t.attemptId,
      )
    )
      return {
        state: "VIOLATION",
        reason: "old_canary_invocation_after_declared_retirement",
      };
    let ledgerTime, wakeTime;
    try {
      ledgerTime = correlate(ctx, l.observedUntil, l.clockSource);
      wakeTime = correlate(ctx, t.wakeObservedAt, c.clockSource);
    } catch (e) {
      return hold(e.message);
    }
    if (
      ledgerTime.lower <
      wakeTime.upper + c.measuredWakeTailMs + c.networkTransitBoundMs
    )
      return hold("canary_or_network_tail_not_observed");
  }
  for (const activity of activities)
    if (
      classifyBounded({ fence, clock, clocks, activity, now, uncertaintyMs })
        .verdict !== "PRE_FENCE"
    )
      return hold("unresolved_activity_interval");
  return {
    state: "EVIDENCE_READY",
    timeModel: "BOUNDED_DRIFT_V2",
    physicalBoundary: p.at,
    declaredAt: p.declaredAt,
    evidenceCompletedAt: now,
    thresholdBasis: p.thresholdOwnerApproved
      ? "OWNER_POLICY"
      : "PROVISIONAL_SYNTHETIC_TARGET",
    evidenceDigest: hash([
      fence.envelopeDigest,
      clock.envelopeDigest,
      ...clocks.map((c) => c.envelopeDigest),
      canary.envelopeDigest,
      ledger.envelopeDigest,
      ...activities.map((a) => a.envelopeDigest),
    ]),
  };
}
