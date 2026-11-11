/** Evidence classifier; SQL epoch changes and heartbeat silence are NOT fences. */
export function classify({ fence, activity, now, uncertaintyMs = 2 }) {
  const no = (reason) => ({ verdict: "NOT_PROVEN", reason });
  if (
    !fence ||
    !Number.isFinite(fence.at) ||
    !activity ||
    !Number.isFinite(now) ||
    fence.at > now ||
    !Number.isFinite(uncertaintyMs) ||
    uncertaintyMs < 0 ||
    typeof activity.scope !== "string" ||
    !activity.scope
  )
    return no("missing_evidence");
  if (fence.kind === "CLOUD") {
    if (
      !fence.sourceVerified ||
      !fence.revisionDeleted ||
      fence.scope !== activity.scope ||
      !Array.isArray(fence.samples) ||
      !fence.samples.length ||
      ![fence.reportingDelayMs, fence.maxAgeMs, fence.coverUntil, now].every(
        Number.isFinite,
      ) ||
      fence.reportingDelayMs < 0 ||
      fence.maxAgeMs <= 0 ||
      fence.coverUntil < fence.at
    )
      return no("incomplete_platform_scope");
    if (
      fence.samples.some(
        (s, i) =>
          !s ||
          !Number.isFinite(s.at) ||
          s.instances !== 0 ||
          s.at < fence.at + fence.reportingDelayMs ||
          s.at > now ||
          now - s.at > fence.maxAgeMs ||
          (i && s.at <= fence.samples[i - 1].at),
      ) ||
      fence.samples.at(-1).at < fence.coverUntil
    )
      return no("stale_or_ambiguous_platform_metrics");
  } else if (fence.kind === "LOCAL_PROCESS_EXIT") {
    if (
      !fence.exitObserved ||
      !fence.pidStart ||
      fence.scope !== activity.scope
    )
      return no("local_exit_not_observed");
  } else return no("authority_or_heartbeat_is_not_termination");
  const intervals = [activity.connect, activity.write].filter(Boolean);
  if (!intervals.length) return no("missing_client_initiation");
  if (
    intervals.some(
      (i) => !Number.isFinite(i[0]) || !Number.isFinite(i[1]) || i[1] < i[0],
    )
  )
    return no("invalid_interval");
  if (intervals.some((i) => i[0] - uncertaintyMs > fence.at))
    return { verdict: "VIOLATION", reason: "post_fence_initiation" };
  if (intervals.some((i) => i[1] + uncertaintyMs >= fence.at))
    return no("interval_straddles_fence");
  return { verdict: "PRE_FENCE", reason: "pre_fence_bytes_may_arrive_later" };
}
