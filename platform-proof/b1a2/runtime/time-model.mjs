import {
  authenticatedObservation,
  measuredClock,
} from "../../src/evidence-source.mjs";
const finite = Number.isFinite;
export const CLOCK_MODEL = "BOUNDED_DRIFT_V2";
export function clockContext({
  clock,
  clocks = [],
  sessionId,
  now,
  uncertaintyMs,
}) {
  const tokens = [...new Set([clock, ...clocks].filter(Boolean))],
    data = tokens.map((v) => authenticatedObservation(v, "CLOCK"));
  if (
    !tokens.length ||
    data.some((v) => !v || v.sessionId !== sessionId || v.issuedAt > now)
  )
    throw Error("authenticated_clock_series_required");
  const measured = data.map((v) => ({
    token: v,
    measurement: measuredClock(v.payload),
  }));
  if (measured.some((v) => v.measurement.model !== CLOCK_MODEL))
    throw Error("incompatible_clock_model");
  const first = measured[0].measurement;
  if (!finite(uncertaintyMs) || uncertaintyMs !== first.uncertaintyMs)
    throw Error("explicit_measured_uncertainty_required");
  if (
    measured.some(
      (v) => v.measurement.referenceClockSource !== first.referenceClockSource,
    )
  )
    throw Error("conflicting_clock_reference_frames");
  return { measured, referenceClockSource: first.referenceClockSource, now };
}
/** Solve the drift inequality in reference-clock units. Timestamp precision,
 * initial RTT uncertainty, declared resynchronization jumps and drift all widen
 * the interval. No unsigned caller tolerance narrows it. */
export function correlate(ctx, value, source) {
  if (!finite(value)) throw Error("invalid_timestamp");
  const candidates = [];
  for (const { measurement: m } of ctx.measured) {
    if (source !== m.referenceClockSource && source !== m.remoteClockSource)
      continue;
    const center =
        source === m.referenceClockSource
          ? value
          : value - m.remoteMinusReferenceMs,
      d = m.driftPpm / 1000000;
    const radius =
      (m.baseUncertaintyMs +
        m.resyncAllowanceMs +
        d * Math.abs(center - m.measuredAt)) /
      (1 - d);
    if (
      Math.abs(center - m.measuredAt) > m.maxExtrapolationMs ||
      center + radius > m.measuredAt + m.maxExtrapolationMs ||
      center - radius < m.measuredAt - m.maxExtrapolationMs
    )
      continue;
    candidates.push({
      lower: center - radius,
      upper: center + radius,
      uncertaintyMs: radius,
    });
  }
  if (!candidates.length)
    throw Error("clock_measurement_expired_or_source_missing");
  const lower = Math.max(...candidates.map((v) => v.lower)),
    upper = Math.min(...candidates.map((v) => v.upper));
  if (lower > upper)
    throw Error("conflicting_authenticated_clock_measurements");
  return { lower, upper, uncertaintyMs: (upper - lower) / 2 };
}
export function clockFresh(ctx, now) {
  return (
    ctx.measured.every((v) => v.token.fresh && now < v.token.expiresAt) &&
    ctx.measured.some(
      (v) =>
        Math.abs(now - v.measurement.measuredAt) <=
        v.measurement.maxExtrapolationMs,
    )
  );
}
export function platformCoverage(p, now, ctx) {
  if (p.retirementModel !== "METRIC_LATENCY_V2") {
    if (
      !p.revisionDeleted ||
      !Array.isArray(p.samples) ||
      !p.samples.length ||
      ![p.reportingDelayMs, p.maxAgeMs, p.coverUntil].every(finite) ||
      p.reportingDelayMs < 0 ||
      p.maxAgeMs <= 0 ||
      p.coverUntil < p.at ||
      p.samples.some(
        (s, i) =>
          !s ||
          !finite(s.at) ||
          s.instances !== 0 ||
          s.at < p.at + p.reportingDelayMs ||
          s.at > now ||
          now - s.at > p.maxAgeMs ||
          (i && s.at <= p.samples[i - 1].at),
      ) ||
      p.samples.at(-1).at < p.coverUntil
    )
      return "stale_or_ambiguous_platform_metrics";
    return null;
  }
  const {
    samplingIntervalMs,
    publicationLatencyMs,
    zeroObservationIntervalMs,
    metricFreshnessMs,
    samples,
    requiredStates,
  } = p;
  if (
    !p.revisionDeleted ||
    !Array.isArray(samples) ||
    !samples.length ||
    !Array.isArray(requiredStates) ||
    new Set(requiredStates).size !== requiredStates.length ||
    !requiredStates.includes("active") ||
    !requiredStates.includes("idle") ||
    ![
      samplingIntervalMs,
      publicationLatencyMs,
      zeroObservationIntervalMs,
      metricFreshnessMs,
      p.at,
      p.coverUntil,
      p.declaredAt,
    ].every(finite) ||
    samplingIntervalMs !== 60000 ||
    publicationLatencyMs < 120000 ||
    zeroObservationIntervalMs < samplingIntervalMs ||
    metricFreshnessMs <= 0 ||
    p.coverUntil - p.at < zeroObservationIntervalMs
  )
    return "incomplete_metric_coverage_contract";
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (
      !s ||
      !finite(s.sampleAt) ||
      !finite(s.visibleAt) ||
      (!ctx &&
        (s.visibleAt < s.sampleAt ||
          s.visibleAt > now ||
          now - s.visibleAt > metricFreshnessMs)) ||
      !s.states ||
      Object.keys(s.states).length !== requiredStates.length ||
      !requiredStates.every(
        (k) =>
          Object.hasOwn(s.states, k) &&
          finite(s.states[k]) &&
          Number.isInteger(s.states[k]) &&
          s.states[k] >= 0,
      )
    )
      return "missing_or_stale_instance_state_series";
    if (ctx) {
      let sample, visible;
      try {
        sample = correlate(ctx, s.sampleAt, p.clockSource);
        visible = correlate(
          ctx,
          s.visibleAt,
          p.visibilityClockSource ?? ctx.referenceClockSource,
        );
      } catch (e) {
        return e.message;
      }
      if (
        visible.upper < sample.lower ||
        visible.lower > now ||
        now - visible.lower > metricFreshnessMs
      )
        return "metric_visibility_clock_or_freshness";
    }
    if (Object.values(s.states).reduce((a, b) => a + b, 0) !== 0)
      return "nonzero_instance_state_observed";
    if (s.sampleAt !== p.at + i * samplingIntervalMs)
      return "missing_sampling_interval";
  }
  if (
    samples.at(-1).sampleAt !== p.coverUntil ||
    p.declaredAt < Math.max(...samples.map((s) => s.visibleAt))
  )
    return "publication_and_sample_time_contradiction";
  return null;
}
export function classifyBounded({
  fence,
  activity,
  clock,
  clocks = [],
  now,
  uncertaintyMs,
}) {
  const no = (reason) => ({ verdict: "NOT_PROVEN", reason }),
    f = authenticatedObservation(fence, "FENCE"),
    a = authenticatedObservation(activity, "ACTIVITY");
  if (!f || !a || !finite(now) || f.issuedAt > now || a.issuedAt > now)
    return no("authenticated_independent_evidence_required");
  if (f.sessionId !== a.sessionId) return no("evidence_session_mismatch");
  const p = f.payload,
    v = a.payload;
  if (
    !p.scope ||
    p.scope !== v.scope ||
    !Number.isInteger(p.retiredEpoch) ||
    p.retiredEpoch < 1 ||
    !Number.isInteger(v.epoch) ||
    v.epoch < 1 ||
    v.epoch > p.retiredEpoch ||
    !v.revision
  )
    return no("deployment_scope_mismatch");
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
    return no(e.message);
  }
  const observations = [];
  let invalid;
  for (const key of ["connect", "write"])
    if (v[key] !== undefined) {
      const x = v[key];
      if (
        !Array.isArray(x) ||
        x.length !== 2 ||
        !x.every(finite) ||
        x[1] < x[0]
      ) {
        invalid = "invalid_interval";
        continue;
      }
      try {
        const lo = correlate(ctx, x[0], v.clockSource),
          hi = correlate(ctx, x[1], v.clockSource);
        observations.push({ key, lower: lo.lower, upper: hi.upper });
      } catch (e) {
        invalid = e.message;
      }
    }
  // Related contradictory clock evidence invalidates a conclusion. Unrelated
  // monitoring incompleteness cannot mask a conclusive initiation violation.
  if (invalid === "conflicting_authenticated_clock_measurements")
    return no(invalid);
  if (observations.some((v) => v.lower > boundary.upper && v.lower <= now))
    return {
      verdict: "VIOLATION",
      reason: "post_fence_initiation",
      timeModel: CLOCK_MODEL,
    };
  if (invalid) return no(invalid);
  if (!observations.length) return no("missing_client_initiation");
  if (
    ![f, a].every((v) => v.fresh && now < v.expiresAt) ||
    !clockFresh(ctx, now)
  )
    return no("evidence_envelope_stale");
  if (v.epoch !== p.retiredEpoch || v.revision !== p.retiredRevision)
    return no("deployment_scope_mismatch");
  if (v.connect && v.write && v.write[0] < v.connect[0])
    return no("contradictory_event_order");
  const coverage = platformCoverage(p, now, ctx);
  if (coverage) return no(coverage);
  if (observations.some((v) => v.upper >= boundary.lower))
    return no("interval_straddles_fence");
  return {
    verdict: "PRE_FENCE",
    reason: "pre_fence_bytes_may_arrive_later",
    timeModel: CLOCK_MODEL,
  };
}
