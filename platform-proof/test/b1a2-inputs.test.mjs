import test from "node:test";
import assert from "node:assert/strict";
import {
  validateInputs,
  syntheticInputs,
  ownerTemplate,
} from "../b1a2/runtime/inputs.mjs";
import { budgetPlan, costSensitivity } from "../b1a2/runtime/billing.mjs";
const now = Date.parse("2026-11-14T12:00:00Z");
test("P-7 exact synthetic fixture validates locally, never as an owner provisioning plan", () => {
  const input = syntheticInputs(now),
    v = validateInputs(input, { now });
  assert.equal(v.sourceMode, "LOCAL_SYNTHETIC_ONLY");
  assert.throws(
    () => validateInputs(input, { now, purpose: "PROVISIONING_PLAN" }),
    /owner/,
  );
  assert.throws(
    () =>
      validateInputs(ownerTemplate(), { now, purpose: "PROVISIONING_PLAN" }),
    /owner/,
  );
  assert.equal(Object.isFrozen(v.session), true);
});
test("P-7 missing or inconsistent account/session/operator/image inputs fail closed", () => {
  for (const patch of [
    { projects: {} },
    { organizationMode: "UNDECIDED" },
    { operators: {} },
    { region: "wrong" },
    { allowedApis: [] },
    { quotas: {} },
    { images: {} },
    {
      session: {
        ...syntheticInputs(now).session,
        expiresAt: new Date(now - 1).toISOString(),
      },
    },
    { epochs: { ...syntheticInputs(now).epochs, next: 1 } },
    { network: { gateway: "0.0.0.0/0" } },
  ])
    assert.throws(() =>
      validateInputs({ ...syntheticInputs(now), ...patch }, { now }),
    );
});
test("P-5 MXN amount derives from explicit USD/approved FX; stale,missing or inconsistent conversion rejects", () => {
  const b = syntheticInputs(now).budget,
    v = budgetPlan(b, now);
  assert.equal(v.amount.currencyCode, "MXN");
  assert.equal(v.amount.units, "410");
  assert.equal(v.amountMinorUnits, "41000");
  assert.equal(v.hardProjectCap, false);
  for (const patch of [
    { accountCurrency: null },
    { localPerUsd: null },
    { fxApprovalRef: null },
    { fxValidUntil: now - 1 },
    { accountCurrency: "USD" },
    { amountMinorUnits: "2000" },
  ])
    assert.throws(() => budgetPlan({ ...b, ...patch }, now));
  assert.equal(
    budgetPlan({ ...b, accountCurrency: "USD", localPerUsd: "1" }, now).amount
      .units,
    "20",
  );
});
test("P-5 tax,FX uncertainty,lag and retained costs are explicit sensitivities", () => {
  const v = costSensitivity({
    usdSubtotal: "14.01",
    fx: "20.50",
    taxPercent: "16",
    fxUncertaintyPercent: "10",
    billingLagUsd: "2",
    retainedUsd: "1",
  });
  assert.equal(v.taxIncluded, true);
  assert.ok(BigInt(v.upperLocalMinorUnits) > 40000n);
});
