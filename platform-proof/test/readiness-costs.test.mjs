import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { budgetPlan } from "../b1a2/runtime/billing.mjs";
import { syntheticInputs } from "../b1a2/runtime/inputs.mjs";
test("O-4/5/6/7 six-hour cost model reproducible, $2 restore removed, contingency/tax/FX/lag/retention separated; repeats consume allocation", async () => {
  const v = JSON.parse(
    execFileSync(
      "python3",
      [new URL("../readiness/calculate-costs.py", import.meta.url).pathname],
      { encoding: "utf8" },
    ),
  );
  assert.deepEqual(
    v,
    JSON.parse(
      await readFile(
        new URL("../readiness/cost-model.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const base = v.scenarios.sixHourBaseline;
  assert.equal(base.baseUsd, "11.84");
  assert.equal(base.withTaxUsd, "17.17");
  assert.equal(base.stressWithFxUsdEquivalent, "21.08");
  assert.equal(base.repeatWithinSame30Allocation, false);
  assert.equal(v.currencyVerification.actualLocalPerUsd, null);
  assert.equal(v.budgetAlertsAreHardCaps, false);
  for (const c of Object.values(v.scenarios))
    assert.ok(!Object.hasOwn(c.linesUsd, "temporary_restore_drill"));
});
test("O-5 supports $30 offline alert conversion only with explicit current FX; unchanged historical $20 remains valid; >30 rejects", () => {
  const now = Date.parse("2026-11-14T12:00Z"),
    v = syntheticInputs(now).budget;
  assert.equal(budgetPlan(v, now).amountMinorUnits, "41000");
  v.allocationUsd = "30.00";
  assert.equal(budgetPlan(v, now).amountMinorUnits, "61500");
  v.allocationUsd = "30.01";
  assert.throws(() => budgetPlan(v, now));
  v.allocationUsd = "30.00";
  delete v.fxApprovalRef;
  assert.throws(() => budgetPlan(v, now));
});
