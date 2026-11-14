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
import { cloudFixture } from "./evidence-fixture.mjs";
import { retirementDecision as historicalDecision } from "../b1a/runtime/session-policy.mjs";
import { retirementV2 } from "../b1a2/runtime/retirement.mjs";
import { SessionController } from "../b1a2/runtime/session-policy.mjs";
import { hash } from "../src/protocol.mjs";
import { ZERO } from "../src/ledger.mjs";
import { randomUUID } from "node:crypto";
import { authenticatedObservation } from "../src/evidence-source.mjs";
import { fixture } from "./helpers.mjs";

function legacyBundle() {
  const v = cloudFixture({
    now: 2000,
    fence: {
      at: 1000,
      coverUntil: 1300,
      maxAgeMs: 1000,
      reportingDelayMs: 100,
      samples: [
        { at: 1200, instances: 0 },
        { at: 1300, instances: 0 },
      ],
    },
    activity: { connect: [100, 110] },
    clock: { model: "FOUR_TIMESTAMP_V1", measuredAt: 5, validUntil: 3000 },
  });
  return {
    ...v,
    activities: [v.activity],
    ledgerRecords: [],
    canary: v.verifier.verify(
      v.raw("CANARY", {
        scope: "old",
        epoch: 1,
        revision: "old-r1",
        clockSource: "fixture-observer-clock",
        measuredWakeTailMs: 50,
        trials: Array.from({ length: 20 }, () => ({
          attemptId: randomUUID(),
          scheduledWakeAt: 1400,
          independentWakeAttempted: true,
          parkedBeforeConnect: true,
        })),
      }),
    ),
    ledger: v.verifier.verify(
      v.raw("LEDGER", {
        scope: "old",
        epoch: 1,
        revision: "old-r1",
        clockSource: "fixture-observer-clock",
        observedUntil: 1500,
        checkpoint: { sequence: 0, hash: ZERO },
        recordsDigest: hash([]),
      }),
    ),
  };
}

test("C-2/P6b: historical V1 remains verifiable but every B1a-2 operational, recovery and promotion gate refuses it", async () => {
  const bundle = legacyBundle(),
    plan = operationalPlan(syntheticInputs());
  assert.equal(historicalDecision(bundle).state, "EVIDENCE_READY");
  assert.deepEqual(retirementV2(bundle), {
    state: "HOLD",
    reason: "b1a2_requires_v2_retirement",
  });
  let effects = 0;
  const forbidden = async () => {
    effects++;
    throw Error("must_not_execute");
  };
  const controller = new SessionController({
    db: { query: forbidden },
    sessionId: bundle.sessionId,
  });
  for (const result of [
    await controller.reconcile(bundle, []),
    await controller.promote(bundle),
  ]) {
    assert.equal(result.state, "HOLD");
    assert.equal(result.reason, "b1a2_requires_v2_retirement");
    assert.equal(result.dispatchEnabled, false);
  }
  for (const id of ["observe", "recover", "promote"]) {
    const op = plan.commands.find((v) => v.id === id);
    const adapter = new PreparedOperationalAdapter({
      plan,
      executor: { mode: "LOCAL_SIMULATION", execute: forbidden },
      controller: { reconcile: forbidden, promote: forbidden },
      heartbeat: {
        start: () => {
          effects++;
        },
      },
    });
    await assert.rejects(
      adapter.apply(op, { bundle }),
      /b1a2_requires_v2_retirement/,
    );
    const model = new LocalCloudModel({ plan });
    await assert.rejects(
      model.apply(op, { bundle }),
      /b1a2_requires_v2_retirement/,
    );
    const local = new LocalOperationController({
      plan,
      journal: { append: forbidden },
      adapter: { mode: "LOCAL_SIMULATION", apply: forbidden },
      records: plan.commands.slice(0, plan.commands.indexOf(op)).map((v) => ({
        event: "OP_RESULT",
        id: v.id,
        inputDigest: plan.inputDigest,
      })),
    });
    const result = await local.execute(id, { bundle });
    assert.equal(result.state, "HOLD");
    assert.equal(result.reason, "b1a2_requires_v2_retirement");
  }
  assert.equal(
    effects,
    0,
    "no SQL, journal intent, executor, promotion or heartbeat side effect",
  );
});
test("C-2: V2 fence with a legacy primary or additional clock also fails closed", () => {
  const b = retirementFixture(),
    legacyClock = b.verifier.verify(
      b.raw("CLOCK", {
        ...authenticatedObservation(b.clock, "CLOCK").payload,
        model: "FOUR_TIMESTAMP_V1",
        measuredAt: 1000,
        validUntil: 61000,
      }),
    );
  for (const bundle of [
    { ...b, clock: legacyClock },
    { ...b, clocks: [legacyClock] },
  ])
    assert.equal(retirementV2(bundle).reason, "b1a2_requires_v2_retirement");
});
test("C-2: corrected V2 evidence still reconciles original work and explicitly promotes through restricted PostgreSQL", async (t) => {
  const f = await fixture(t, { control: true }),
    binding = await f.plan({ revision: "old-r1" });
  await f.admin.query(
    await readFile(new URL("../b1a2/schema.sql", import.meta.url), "utf8"),
  );
  const bundle = retirementFixture({
    fence: { scope: binding.scopeId },
    canary: { scope: binding.scopeId },
    ledger: { scope: binding.scopeId },
  });
  const db = {
    async query(sql, args) {
      const c = await f.admin.connect();
      try {
        await c.query("BEGIN");
        await c.query("SET LOCAL ROLE inc1_controller");
        const r = await c.query(sql, args);
        await c.query("COMMIT");
        return r;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    },
  };
  const controller = new SessionController({ db, sessionId: bundle.sessionId });
  await db.query("SELECT proof.control_create($1,$2,1,$3,$4)", [
    bundle.sessionId,
    binding.scopeId,
    binding.revision,
    new Date(Date.now() + 60000),
  ]);
  await controller.advance(1, 2, "next-r2");
  const outcome = await controller.reconcile(bundle, [binding.attemptId]);
  assert.equal(outcome.state, "RECONCILED_OR_HELD");
  assert.deepEqual(outcome.outcomes, [
    { attemptId: binding.attemptId, state: "ARMED" },
  ]);
  assert.equal((await controller.read()).dispatchEnabled, false);
  assert.equal((await controller.promote(bundle)).dispatchEnabled, true);
  assert.equal(
    (await controller.promote(bundle)).reason,
    "protected_hold_requires_new_epoch",
  );
  await f.evidence("b1a2-v2-retirement-gates", {
    retirement: retirementV2(bundle),
    outcome,
    dispatchOnlyAfterExplicitPromotion: true,
    cloudExecution: false,
  });
});
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
