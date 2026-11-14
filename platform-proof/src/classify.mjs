import { classifyBounded, CLOCK_MODEL } from "../b1a2/runtime/time-model.mjs";
import { authenticatedObservation, measuredClock } from "./evidence-source.mjs";
const no = (reason) => ({ verdict: "NOT_PROVEN", reason });
const violation = () => ({
  verdict: "VIOLATION",
  reason: "post_fence_initiation",
});
const pre = () => ({
  verdict: "PRE_FENCE",
  reason: "pre_fence_bytes_may_arrive_later",
});
function intervals(activity) {
  return ["connect", "write"]
    .filter((k) => activity[k] !== undefined)
    .map((k) => ({ kind: k, value: activity[k] }));
}
const valid = (i) =>
  Array.isArray(i) &&
  i.length === 2 &&
  i.every(Number.isFinite) &&
  i[1] >= i[0];
export function classify({
  fence,
  activity,
  clock,
  clocks = [],
  now,
  uncertaintyMs,
}) {
  if (
    fence?.kind === "CLOUD" &&
    (authenticatedObservation(clock, "CLOCK")?.payload.model === CLOCK_MODEL ||
      clocks.length)
  )
    return classifyBounded({
      fence,
      activity,
      clock,
      clocks,
      now,
      uncertaintyMs,
    });
  if (fence?.kind === "CLOUD")
    return classifyCloud({ fence, activity, clock, now, uncertaintyMs });
  // Local-only observation path: never promoted to Cloud Run termination proof.
  const u = uncertaintyMs ?? 2;
  if (
    !fence ||
    !Number.isFinite(fence.at) ||
    !activity ||
    !Number.isFinite(now) ||
    fence.at > now ||
    !Number.isFinite(u) ||
    u < 0 ||
    typeof activity.scope !== "string" ||
    !activity.scope
  )
    return no("missing_evidence");
  if (fence.kind !== "LOCAL_PROCESS_EXIT")
    return no("authority_or_heartbeat_is_not_termination");
  if (!fence.exitObserved || !fence.pidStart || fence.scope !== activity.scope)
    return no("local_exit_not_observed");
  const events = intervals(activity);
  if (!events.length) return no("missing_client_initiation");
  if (events.some((e) => valid(e.value) && e.value[0] - u > fence.at))
    return violation();
  if (events.some((e) => !valid(e.value))) return no("invalid_interval");
  if (
    activity.connect &&
    activity.write &&
    activity.write[0] < activity.connect[0]
  )
    return no("contradictory_event_order");
  if (events.some((e) => e.value[1] + u >= fence.at))
    return no("interval_straddles_fence");
  return pre();
}
function classifyCloud({ fence, activity, clock, now, uncertaintyMs }) {
  const f = authenticatedObservation(fence, "FENCE"),
    a = authenticatedObservation(activity, "ACTIVITY"),
    c = authenticatedObservation(clock, "CLOCK");
  if (!f || !a || !c) return no("authenticated_independent_evidence_required");
  if (f.sessionId !== a.sessionId || a.sessionId !== c.sessionId)
    return no("evidence_session_mismatch");
  if (!Number.isFinite(now) || [f, a, c].some((v) => now < v.issuedAt))
    return no("evidence_envelope_stale");
  let measurement;
  try {
    measurement = measuredClock(c.payload);
  } catch {
    return no("measured_clock_required");
  }
  if (
    !Number.isFinite(uncertaintyMs) ||
    uncertaintyMs !== measurement.uncertaintyMs
  )
    return no("explicit_measured_uncertainty_required");
  const fp = f.payload,
    ap = a.payload;
  if (
    typeof fp.scope !== "string" ||
    !fp.scope ||
    fp.scope !== ap.scope ||
    !Number.isInteger(fp.retiredEpoch) ||
    fp.retiredEpoch < 1 ||
    !Number.isInteger(ap.epoch) ||
    ap.epoch < 1 ||
    ap.epoch > fp.retiredEpoch ||
    typeof fp.retiredRevision !== "string" ||
    typeof ap.revision !== "string" ||
    !ap.revision
  )
    return no("deployment_scope_mismatch");
  const convert = (value, source) =>
    !Number.isFinite(value)
      ? NaN
      : source === measurement.referenceClockSource
        ? value
        : source === measurement.remoteClockSource
          ? value - measurement.remoteMinusReferenceMs
          : NaN;
  const fenceAt = convert(fp.at, fp.clockSource),
    events = intervals(ap).map((e) => ({
      ...e,
      value: valid(e.value)
        ? e.value.map((v) => convert(v, ap.clockSource))
        : e.value,
    }));
  if (
    !Number.isFinite(fenceAt) ||
    fenceAt > now ||
    fenceAt < measurement.measuredAt ||
    fenceAt > measurement.validUntil ||
    !events.length
  )
    return no("clock_source_or_initiation_missing");
  const validEvents = events.filter((e) => valid(e.value));
  const reliableEvents = validEvents.filter(
    (e) =>
      e.value[0] >= measurement.measuredAt &&
      e.value[1] <= measurement.validUntil &&
      e.value[1] <= now + uncertaintyMs,
  );
  // Conclusive old-epoch initiation is a failure before metrics-completeness tests.
  if (reliableEvents.some((e) => e.value[0] - uncertaintyMs > fenceAt))
    return violation();
  if (reliableEvents.length !== validEvents.length)
    return no("event_outside_clock_measurement");
  if (
    [f, a, c].some((v) => !v.fresh || now >= v.expiresAt) ||
    now > measurement.validUntil
  )
    return no("evidence_envelope_stale");
  if (ap.epoch !== fp.retiredEpoch || ap.revision !== fp.retiredRevision)
    return no("deployment_scope_mismatch");
  if (events.some((e) => !valid(e.value))) return no("invalid_interval");
  if (ap.connect && ap.write && ap.write[0] < ap.connect[0])
    return no("contradictory_event_order");
  if (
    !fp.revisionDeleted ||
    !Array.isArray(fp.samples) ||
    !fp.samples.length ||
    ![fp.reportingDelayMs, fp.maxAgeMs, fp.coverUntil].every(Number.isFinite) ||
    fp.reportingDelayMs < 0 ||
    fp.maxAgeMs <= 0
  )
    return no("incomplete_platform_scope");
  const until = convert(fp.coverUntil, fp.clockSource),
    samples = fp.samples.map(
      (s) => s && { ...s, at: convert(s.at, fp.clockSource) },
    );
  if (
    !Number.isFinite(until) ||
    until < fenceAt ||
    samples.some(
      (s, i) =>
        !s ||
        !Number.isFinite(s.at) ||
        s.instances !== 0 ||
        s.at < fenceAt + fp.reportingDelayMs ||
        s.at > now ||
        now - s.at > fp.maxAgeMs ||
        (i && s.at <= samples[i - 1].at),
    ) ||
    samples.at(-1).at < until
  )
    return no("stale_or_ambiguous_platform_metrics");
  if (validEvents.some((e) => e.value[1] + uncertaintyMs >= fenceAt))
    return no("interval_straddles_fence");
  return pre();
}
