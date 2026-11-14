import { fakeReceipt } from "./fake-client.mjs";
const policies = new WeakMap();
export const transitPolicy = (v) => policies.get(v);
/** A finite measured experiment policy is NOT a universal Internet transit
 * bound. Production/actual-cloud acceptance requires independent review of the
 * declared allowance and all missing/lost flow observations. */
export function measuredTransitPolicy({
  clockReceipts,
  allowanceMs,
  validUntil,
  now,
  mode,
}) {
  if (mode !== "LOCAL_SIMULATION")
    throw Error("cloud_transit_bound_requires_independent_acceptance");
  if (
    !Array.isArray(clockReceipts) ||
    clockReceipts.length < 3 ||
    !Number.isFinite(allowanceMs) ||
    allowanceMs <= 0 ||
    allowanceMs > 60000 ||
    !Number.isFinite(validUntil) ||
    validUntil <= now ||
    validUntil > now + 21600000
  )
    throw Error("bounded_transit_measurements_required");
  const rs = clockReceipts.map(fakeReceipt);
  if (
    rs.some(
      (r) =>
        !r ||
        r.value.clockSource !== "independent-fake-clock" ||
        r.value.nonce !== r.nonce ||
        r.observedAt < r.requestedAt,
    )
  )
    throw Error("authenticated_transit_samples_required");
  const maxRtt = Math.max(...rs.map((r) => r.observedAt - r.requestedAt));
  const value = Object.freeze({
    upperMs: maxRtt + allowanceMs,
    measuredMaxRttMs: maxRtt,
    measurementRefs: rs.map((r) => r.rawDigest),
    validUntil,
    scope: "LOCAL_MEASURED_EXPERIMENT_ONLY",
  });
  policies.set(value, value);
  return value;
}
