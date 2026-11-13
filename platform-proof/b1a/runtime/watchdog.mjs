/** Offline decision engine for the independent future session supervisor.
 * It never executes commands. SQL deadlines bound entry even if it is absent;
 * ONLY the separately authorized independent kill/cleanup operator can stop
 * infrastructure billing. Neither budget alerts nor this pure function is a cap.
 */
export function sessionAction({
  startedAt,
  expiresAt,
  lastObservedAt,
  now,
  billingState,
}) {
  const max = 6 * 3600000,
    hard = Date.parse("2026-12-17T23:59:59Z");
  if (
    ![startedAt, expiresAt, lastObservedAt, now].every(Number.isFinite) ||
    expiresAt <= startedAt ||
    expiresAt - startedAt > max ||
    expiresAt > hard ||
    now < lastObservedAt
  )
    return {
      dispatchEnabled: false,
      action: "HOLD_AND_INDEPENDENT_KILL",
      reason: "invalid_or_regressed_session_clock",
    };
  if (now >= expiresAt)
    return {
      dispatchEnabled: false,
      action: "FENCE_EXPORT_TEARDOWN",
      reason: "six_hour_or_earlier_deadline",
      automaticRecreation: false,
    };
  return {
    dispatchEnabled: false,
    action:
      billingState === "ENFORCED"
        ? "HOLD_AND_INDEPENDENT_KILL"
        : "REQUIRE_EXPLICIT_AUTHENTICATED_PROMOTION",
    reason:
      billingState === "CONFIGURED" || billingState === "AWAITING_NEXT_PERIOD"
        ? "billing_state_is_not_promotion"
        : "hold_by_default",
    automaticRecreation: false,
  };
}
