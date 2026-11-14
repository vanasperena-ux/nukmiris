import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  operationalPlan,
  assertPermissionCoverage,
} from "../b1a2/ops/plan.mjs";
import { syntheticInputs } from "../b1a2/runtime/inputs.mjs";
test("D-3 every concrete command maps to its independent principal and scoped IAM permissions", () => {
  const p = operationalPlan(syntheticInputs()),
    all = [...p.commands, ...p.emergency, ...p.teardown, ...p.access];
  assert.equal(assertPermissionCoverage(all, p.inputs), true);
  const traffic = p.permissionMatrix.find((c) => c.id === "traffic");
  assert.equal(traffic.principalRole, "kill");
  assert.ok(
    traffic.requirements.some((r) =>
      r.permissions.includes("iam.serviceAccounts.actAs"),
    ),
  );
  const emergency = p.permissionMatrix.find(
    (c) => c.id === "emergency-service-delete",
  );
  assert.equal(emergency.principalRole, "kill");
  assert.ok(
    !emergency.requirements.some((r) =>
      r.permissions.includes("iam.serviceAccounts.actAs"),
    ),
  );
  assert.ok(
    p.permissionMatrix
      .find((c) => c.id === "worker-delete")
      .requirements.some((r) =>
        r.permissions.includes("run.workerpools.delete"),
      ),
  );
  assert.ok(
    !p.permissionMatrix
      .find((c) => c.id === "fake-tunnel")
      .requirements.some((r) =>
        r.permissions.includes("iam.serviceAccounts.actAs"),
      ),
  );
});
test("D-3 missing traffic/delete/firewall/actAs rights block instead of borrowing deployer", () => {
  const p = operationalPlan(syntheticInputs()),
    all = [...p.commands, ...p.emergency, ...p.teardown];
  for (const missing of [
    "run.services.update",
    "run.services.delete",
    "run.workerpools.delete",
    "compute.firewalls.update",
    "iam.serviceAccounts.actAs",
  ]) {
    const grants = p.grants.map((g) => ({
      ...g,
      permissions:
        g.role === "kill"
          ? g.permissions.filter((v) => v !== missing)
          : g.permissions,
    }));
    assert.throws(
      () => assertPermissionCoverage(all, p.inputs, grants),
      /blocking_permission_missing/,
    );
  }
});
test("P-3 seven steps remain ordered; CLI/CI execution flags cannot invoke any cloud command", () => {
  const p = operationalPlan(syntheticInputs());
  assert.deepEqual(
    [...new Set(p.commands.filter((c) => c.phase > 0).map((c) => c.phase))],
    [1, 2, 3, 4, 5, 6, 7],
  );
  for (const args of [
    ["fixture-plan", "--execute"],
    ["apply"],
    ["fixture-plan", "--live"],
  ])
    assert.throws(() =>
      execFileSync(process.execPath, ["b1a2/ops/cli.mjs", ...args], {
        cwd: new URL("../", import.meta.url),
        stdio: "pipe",
        env: { ...process.env, B1A2_EXECUTE: "true" },
      }),
    );
  assert.equal(p.liveExecutionEnabled, false);
});
