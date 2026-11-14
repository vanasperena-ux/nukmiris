import { assertTeardownAuthority } from "../b1a2/ops/teardown-permissions.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { syntheticInputs } from "../b1a2/runtime/inputs.mjs";
import { operationalPlan } from "../b1a2/ops/plan.mjs";
import {
  LocalOperationController,
  LocalCloudModel,
  executeLive,
} from "../b1a2/ops/controller.mjs";
import { teardownInventory, simulateTeardown } from "../b1a2/ops/teardown.mjs";
import { retirementFixture } from "./b1a2-fixture.mjs";
test("P-3 durable seven-step local simulation, crash after CAS, readback without replay and independent emergency", async () => {
  const plan = operationalPlan(syntheticInputs()),
    records = [],
    journal = {
      async append(v) {
        records.push(v);
        return v;
      },
    },
    adapter = new LocalCloudModel({ plan }),
    c = new LocalOperationController({ plan, journal, adapter });
  assert.equal((await c.execute("traffic")).state, "HOLD");
  for (const id of [
    "preflight",
    "initialize",
    "prepare-gateway",
    "prepare-ingress",
    "prepare-sealer",
    "prepare-worker",
    "retire-inert-bootstrap",
    "bootstrap",
    "stage",
  ])
    assert.equal((await c.execute(id)).state, "CONFIRMED");
  assert.equal(
    (await c.execute("advance", { interruptAfterEffect: true })).state,
    "HOLD",
  );
  assert.equal(adapter.state.epoch, 2);
  const restarted = new LocalOperationController({
    plan,
    journal,
    adapter,
    records,
  });
  assert.equal((await restarted.resume()).state, "RESUMED_WITHOUT_REPLAY");
  assert.equal(
    (await restarted.execute("advance")).state,
    "ALREADY_CONFIRMED_NO_REEXECUTION",
  );
  const bundle = retirementFixture();
  for (const op of plan.commands.filter((v) => v.phase >= 3))
    assert.equal(
      (await restarted.execute(op.id, { bundle })).state,
      "CONFIRMED",
      op.id,
    );
  assert.equal(adapter.state.dispatch, true);
  assert.equal(
    (await restarted.execute("emergency-service-delete")).state,
    "CONFIRMED",
  );
  assert.equal(adapter.state.dispatch, false);
  assert.throws(executeLive, /activation/);
});
test("P-3 unknown outcome or missing permission holds; cannot replay, promote, or impersonate deployer", async () => {
  const plan = operationalPlan(syntheticInputs()),
    journal = { async append() {} },
    model = new LocalCloudModel({ plan }),
    c = new LocalOperationController({
      plan,
      journal,
      adapter: {
        mode: "LOCAL_SIMULATION",
        async apply() {
          throw Error("denied");
        },
        async readBack() {
          return { state: "UNKNOWN" };
        },
      },
    });
  assert.equal((await c.execute("preflight")).state, "HOLD");
  assert.equal((await c.resume()).state, "HOLD");
  assert.equal((await c.execute("initialize")).state, "HOLD");
  assert.throws(
    () =>
      new LocalOperationController({
        plan,
        journal,
        adapter: model,
        grants: plan.grants.filter((g) => g.role !== "kill"),
      }),
    /missing/,
  );
});
test("P-6 every generated resource has dependency-ordered teardown and residual policy", async () => {
  const manifest = JSON.parse(
      await readFile(
        new URL("../b1a2/inventory.json", import.meta.url),
        "utf8",
      ),
    ),
    plan = teardownInventory(manifest);
  assert.equal(plan.length, manifest.candidateResourceCount);
  const positions = new Map(plan.map((v, i) => [v.address, i]));
  for (const v of plan)
    for (const d of v.dependencies)
      if (positions.has(d))
        assert.ok(positions.get(v.address) < positions.get(d));
  const result = await simulateTeardown({
    manifest,
    journal: { async append() {} },
    adapter: {
      mode: "LOCAL_SIMULATION",
      async retireKeyVersions() {
        return { state: "VERSIONS_RETIRED" };
      },
      async removeExact(v) {
        return { identity: v.address, state: "ABSENT" };
      },
    },
  });
  assert.match(result.state, /RESIDUALS/);
  assert.equal(result.residuals.length, 4);
  const c = operationalPlan(syntheticInputs()).inputs;
  assert.equal(
    assertTeardownAuthority(
      manifest,
      c,
      operationalPlan(syntheticInputs()).grants,
    ),
    true,
  );
});
import { PreparedOperationalAdapter } from "../b1a2/ops/prepared-adapter.mjs";
test("D-3 emergency remains executable with an unresolved operation and unavailable SQL hold", async () => {
  const plan = operationalPlan(syntheticInputs()),
    journal = { async append() {} },
    model = new LocalCloudModel({ plan });
  let fail = true;
  const adapter = {
      mode: "LOCAL_SIMULATION",
      async apply(op, opts) {
        if (fail && op.id === "preflight") throw Error("lost ack");
        return model.apply(op, opts);
      },
      readBack: (intent) => model.readBack(intent),
    },
    controller = new LocalOperationController({ plan, journal, adapter });
  assert.equal((await controller.execute("preflight")).state, "HOLD");
  assert.equal(
    (await controller.execute("emergency-service-delete")).state,
    "CONFIRMED",
  );
  assert.equal((await controller.execute("initialize")).state, "HOLD");
  let deleted = false;
  const wired = new PreparedOperationalAdapter({
    plan,
    controller: {
      async hold() {
        throw Error("SQL unavailable");
      },
    },
    executor: {
      mode: "LOCAL_SIMULATION",
      async execute() {
        deleted = true;
        return { deleteRequested: true };
      },
    },
  });
  await wired.apply(plan.emergency[0]);
  assert.equal(deleted, true);
});
