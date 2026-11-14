import { hash } from "../../src/protocol.mjs";
const SCALE = 1000000n;
function decimal(v, scale = 6) {
  if (typeof v !== "string" || !/^\d+(?:\.\d{1,6})?$/.test(v))
    throw Error("decimal_string_required");
  const [a, b = ""] = v.split(".");
  return BigInt(a) * 10n ** BigInt(scale) + BigInt(b.padEnd(scale, "0"));
}
const ceil = (n, d) => (n + d - 1n) / d;
/** Currency is owner-supplied data, never a live billing lookup. All amounts are
 * integer minor units; round alerts upward and keep USD planning separate. */
export function budgetPlan(v, now) {
  if (
    !v ||
    !["USD", "MXN"].includes(v.accountCurrency) ||
    !Number.isFinite(now) ||
    !Number.isFinite(v.fxAsOf) ||
    !Number.isFinite(v.fxValidUntil) ||
    v.fxAsOf > now ||
    v.fxValidUntil <= now ||
    v.fxValidUntil - v.fxAsOf > 7 * 86400000 ||
    typeof v.fxApprovalRef !== "string" ||
    !v.fxApprovalRef
  )
    throw Error("explicit_current_owner_fx_and_currency_required");
  const usd = decimal(v.allocationUsd),
    rate = decimal(v.localPerUsd);
  if (
    usd <= 0n ||
    usd > 20n * SCALE ||
    rate <= 0n ||
    rate > 1000n * SCALE ||
    (v.accountCurrency === "USD" && rate !== SCALE)
  )
    throw Error("unsupported_allocation_or_fx_units");
  const cents = ceil(usd * rate * 100n, SCALE * SCALE),
    amount = {
      currencyCode: v.accountCurrency,
      units: String(cents / 100n),
      nanos: Number(cents % 100n) * 10000000,
    };
  if (v.amountMinorUnits !== undefined && BigInt(v.amountMinorUnits) !== cents)
    throw Error("local_currency_amount_mismatch");
  return {
    planningUsd: v.allocationUsd,
    accountCurrency: v.accountCurrency,
    localPerUsd: v.localPerUsd,
    fxAsOf: v.fxAsOf,
    fxValidUntil: v.fxValidUntil,
    fxApprovalRef: v.fxApprovalRef,
    amount,
    amountMinorUnits: String(cents),
    alertThresholds: [50, 75, 90, 100].map((percent) => ({
      percent,
      minorUnits: String(ceil(cents * BigInt(percent), 100n)),
    })),
    hardProjectCap: false,
    cloudRunCapEligibility: "UNVERIFIED_NO_API_ACCESS",
    approvalDigest: hash(v),
  };
}
export function costSensitivity({
  usdSubtotal,
  fx,
  taxPercent,
  fxUncertaintyPercent,
  billingLagUsd,
  retainedUsd,
}) {
  const price = decimal(usdSubtotal),
    tax = decimal(taxPercent),
    risk = decimal(fxUncertaintyPercent),
    lag = decimal(billingLagUsd),
    retained = decimal(retainedUsd),
    rate = decimal(fx);
  if ([tax, risk].some((v) => v > 100n * SCALE) || rate <= 0n)
    throw Error("cost_assumptions_invalid");
  const gross =
      ceil(price * (100n * SCALE + tax), 100n * SCALE) + lag + retained,
    upper = ceil(gross * (100n * SCALE + risk) * rate, 100n * SCALE * SCALE);
  return {
    grossUsdMicros: String(gross),
    upperLocalMinorUnits: String(ceil(upper * 100n, SCALE)),
    taxIncluded: true,
    delayedBillingAndRetentionIncluded: true,
    notAQuote: true,
  };
}
export class BillingSupervisor {
  constructor({
    controller,
    journal,
    heartbeat,
    emergency = async () => ({ state: "KILL_REQUIRED_NOT_EXECUTED" }),
  }) {
    this.controller = controller;
    this.journal = journal;
    this.heartbeat = heartbeat;
    this.emergency = emergency;
  }
  async event(event) {
    const allowed = [
      "THRESHOLD",
      "BUDGET_ENFORCED",
      "BUDGET_RESET",
      "BILLING_DELAY",
      "CAPACITY_PAUSE",
      "ACCOUNT_SUSPENDED",
      "RESOURCE_SUSPENDED",
      "WORKER_RESTART",
      "SUSPENSION_RECOVERED",
      "SESSION_EXPIRED",
    ];
    if (!allowed.includes(event.type)) throw Error("unknown_billing_event");
    const alertOnly =
      event.type === "THRESHOLD" && [50, 75].includes(event.percent);
    if (alertOnly) {
      try {
        await this.journal.append({
          event: "BILLING_CONTROL",
          type: event.type,
          at: event.at,
          threshold: event.percent,
        });
        return { state: "ALERT_ONLY", automaticPromotion: false };
      } catch {
        await this.heartbeat?.stop();
        try {
          return {
            ...(await this.controller.hold("CONTROL_UNAVAILABLE")),
            journalFailed: true,
            automaticPromotion: false,
          };
        } catch {
          return {
            state: "HOLD_UNCOMMITTED",
            independentKill: await this.emergency(),
            automaticPromotion: false,
          };
        }
      }
    }
    await this.heartbeat?.stop();
    const reason =
      event.type === "BUDGET_RESET" ||
      event.type === "SUSPENSION_RECOVERED" ||
      event.type === "WORKER_RESTART"
        ? "BUDGET_RESET"
        : event.type === "SESSION_EXPIRED"
          ? "SESSION_EXPIRED"
          : event.type === "THRESHOLD" || event.type === "BUDGET_ENFORCED"
            ? "BUDGET_PAUSED"
            : "CONTROL_UNAVAILABLE";
    let held;
    try {
      held = await this.controller.hold(reason);
    } catch {
      return {
        state: "HOLD_UNCOMMITTED",
        independentKill: await this.emergency(),
        automaticPromotion: false,
        recreationAuthorized: false,
      };
    }
    let journalFailed = false;
    try {
      await this.journal.append({
        event: "BILLING_CONTROL",
        type: event.type,
        at: event.at,
        threshold: event.percent ?? null,
      });
    } catch {
      journalFailed = true;
    }
    return {
      ...held,
      journalFailed,
      automaticPromotion: false,
      recreationAuthorized: false,
    };
  }
}
