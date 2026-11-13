import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, stop, arm } from "./helpers.mjs";
import {
  SessionController,
  retirementDecision,
} from "../b1a/runtime/session-policy.mjs";
import {
  SyntheticAdmission,
  SyntheticSealer,
} from "../b1a/runtime/admission.mjs";
import { openLedger, ZERO } from "../src/ledger.mjs";
import { hash } from "../src/protocol.mjs";
import { cloudFixture } from "./evidence-fixture.mjs";

function roleDb(f, role) {
  assert.ok(
    [
      "inc1_ingress",
      "inc1_sealer",
      "inc1_controller",
      "inc1_gateway",
      "inc1_worker",
    ].includes(role),
  );
  return {
    async query(sql, args) {
      const c = await f.admin.connect();
      try {
        await c.query("BEGIN");
        await c.query("SET LOCAL ROLE " + role);
        const result = await c.query(sql, args);
        await c.query("COMMIT");
        return result;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    },
  };
}
function bundle() {
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
      clock: { measuredAt: 5, validUntil: 3000 },
    }),
    trials = Array.from({ length: 20 }, () => ({
      attemptId: randomUUID(),
      scheduledWakeAt: 1400,
      independentWakeAttempted: true,
      parkedBeforeConnect: true,
    }));
  return {
    ...v,
    activities: [v.activity],
    canary: v.verifier.verify(
      v.raw("CANARY", {
        scope: "old",
        epoch: 1,
        revision: "old-r1",
        clockSource: "fixture-observer-clock",
        measuredWakeTailMs: 50,
        trials,
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
    ledgerRecords: [],
  };
}

test("retirement contract: complete authenticated modeled bundle required; absent data holds", () => {
  const data = bundle();
  assert.equal(retirementDecision(data).state, "EVIDENCE_READY");
  for (const missing of ["fence", "clock", "canary", "ledger"])
    assert.equal(
      retirementDecision({ ...data, [missing]: undefined }).state,
      "HOLD",
    );
  assert.equal(
    retirementDecision({ ...data, canary: { ...data.canary } }).state,
    "HOLD",
  );
  assert.equal(
    retirementDecision({ ...data, uncertaintyMs: undefined }).state,
    "HOLD",
  );
  assert.equal(
    retirementDecision({ ...data, ledgerRecords: [{ event: "invented" }] })
      .state,
    "HOLD",
  );
  const c = cloudFixture({
    now: 2000,
    fence: { at: 1000, samples: [] },
    activity: { connect: [1600, 1610] },
    clock: { validUntil: 3000 },
  });
  assert.equal(
    retirementDecision({ ...c, activities: [c.activity] }).state,
    "VIOLATION",
  );
});

test("session SQL: billing pause/reset and process restart leave dispatch durably inert", async (t) => {
  const f = await fixture(t, { control: true }),
    b = await f.plan({ deadlineMs: 8000 }),
    sessionId = randomUUID(),
    db = roleDb(f, "inc1_controller"),
    controller = new SessionController({ db, sessionId });
  await db.query("SELECT proof.control_create($1,$2,1,$3,$4)", [
    sessionId,
    b.scopeId,
    b.revision,
    new Date(Date.now() + 60000),
  ]);
  let g = await f.gateway({ controlSessionId: sessionId });
  assert.equal((await f.request(g, b)).state, "HELD");
  assert.equal((await controller.read()).dispatchEnabled, false);
  // Test operator explicitly simulates the separately approved initial promotion.
  const before = await controller.read();
  await db.query("SELECT proof.control_promote($1,1,$2,$3)", [
    sessionId,
    before.generation,
    "a".repeat(64),
  ]);
  assert.equal((await f.request(g, b)).state, "APPLIED");
  await controller.billing("ENFORCED");
  const next = await f.plan({ scopeId: b.scopeId, deadlineMs: 8000 });
  assert.equal((await f.request(g, next)).state, "HELD");
  await controller.billing("CONFIGURED");
  await stop(g);
  g = await f.gateway({ controlSessionId: sessionId });
  assert.equal((await f.request(g, next)).state, "HELD");
  assert.equal((await controller.read()).holdReason, "BUDGET_RESET");
  assert.equal((await controller.promote({})).dispatchEnabled, false);
  assert.equal((await f.request(g, next)).state, "HELD");
  await assert.rejects(
    roleDb(f, "inc1_gateway").query("SELECT proof.control_hold($1,$2)", [
      sessionId,
      "OPERATOR_HOLD",
    ]),
    /permission denied/,
  );
  await assert.rejects(
    roleDb(f, "inc1_gateway").query("SELECT proof.enter($1,$2,$3,1,$4)", [
      b.scopeId,
      next.attemptId,
      randomUUID(),
      b.revision,
    ]),
    /permission denied/,
  );
  const old = await controller.read();
  await controller.advance(1, 2, "inc1-r2");
  assert.equal((await controller.read()).dispatchEnabled, false);
  assert.equal((await f.request(g, next)).state, "HELD");
  await assert.rejects(
    db.query("SELECT proof.control_promote($1,1,$2,$3)", [
      sessionId,
      old.generation,
      "a".repeat(64),
    ]),
    /compare_and_swap/,
  );
  await f.evidence("b1a-session-budget-hold", {
    state: await controller.read(),
    monthlyResetAutomaticPromotion: false,
    cloudBudgetSystemTested: false,
  });
  await stop(g);
});

test("session SQL: immutable six-hour limit and expiry prevent new entry", async (t) => {
  const f = await fixture(t, { control: true }),
    b = await f.plan(),
    sessionId = randomUUID(),
    db = roleDb(f, "inc1_controller");
  await assert.rejects(
    db.query("SELECT proof.control_create($1,$2,1,$3,$4)", [
      sessionId,
      b.scopeId,
      b.revision,
      new Date(Date.now() + 7 * 3600000),
    ]),
    /invalid_synthetic_session/,
  );
  await db.query("SELECT proof.control_create($1,$2,1,$3,$4)", [
    sessionId,
    b.scopeId,
    b.revision,
    new Date(Date.now() + 100),
  ]);
  const controller = new SessionController({ db, sessionId }),
    state = await controller.read();
  await db.query("SELECT proof.control_promote($1,1,$2,$3)", [
    sessionId,
    state.generation,
    "b".repeat(64),
  ]);
  await new Promise((r) => setTimeout(r, 120));
  const g = await f.gateway({ controlSessionId: sessionId });
  assert.equal((await f.request(g, b)).state, "HELD");
  assert.equal(
    (await controller.elapsed(Date.now())).holdReason,
    "SESSION_EXPIRED",
  );
  assert.equal(f.records.filter((r) => r.event === "REQUEST").length, 0);
  await stop(g);
});

test("sealer: unavailable, cold, failed journal or dishonest response never causes a false ACK", async (t) => {
  const f = await fixture(t, { control: true }),
    b = await f.plan(),
    ingressDb = roleDb(f, "inc1_ingress"),
    sealerDb = roleDb(f, "inc1_sealer"),
    batchId = randomUUID(),
    payload = { synthetic: "B1a committed membership" },
    ledger = await openLedger(f.dir + "/sealer.jsonl", async () => {});
  t.after(() => ledger.close());
  const unavailable = new SyntheticAdmission({
    ingressDb,
    callSealer: async () => {
      throw Error("cold");
    },
  });
  assert.equal(
    (await unavailable.admit({ scopeId: b.scopeId, batchId, payload })).ack,
    false,
  );
  const dishonest = new SyntheticAdmission({
    ingressDb,
    callSealer: async () => ({ accepted: true }),
  });
  assert.equal(
    (await dishonest.admit({ scopeId: b.scopeId, batchId, payload })).ack,
    false,
  );
  const failed = new SyntheticSealer({
      sealerDb,
      ledger: {
        async append() {
          throw Error("custody unavailable");
        },
      },
    }),
    bad = new SyntheticAdmission({
      ingressDb,
      callSealer: (x) => failed.seal(x),
    });
  assert.equal(
    (await bad.admit({ scopeId: b.scopeId, batchId, payload })).ack,
    false,
  );
  const stalled = new SyntheticAdmission({
    ingressDb,
    timeoutMs: 10,
    callSealer: () => new Promise(() => {}),
  });
  assert.equal(
    (await stalled.admit({ scopeId: b.scopeId, batchId, payload })).status,
    503,
  );
  const sealer = new SyntheticSealer({ sealerDb, ledger }),
    ready = new SyntheticAdmission({
      ingressDb,
      callSealer: (x) => sealer.seal(x),
    });
  assert.equal(
    (await ready.admit({ scopeId: b.scopeId, batchId, payload })).ack,
    true,
  );
  assert.equal(
    (await ready.admit({ scopeId: b.scopeId, batchId, payload })).ack,
    true,
  );
  await assert.rejects(
    ingressDb.query("SELECT proof.admission_seal($1,$2,$3,$4)", [
      b.scopeId,
      batchId,
      hash(payload),
      "a".repeat(64),
    ]),
    /permission denied/,
  );
  await assert.rejects(
    ready.admit({ scopeId: b.scopeId, batchId, payload: { different: true } }),
    /immutable_synthetic_batch_conflict/,
  );
  await f.evidence("b1a-sealer-ack", {
    verifiedCommitBeforeAck: true,
    unavailableStatus: 503,
    journalUnavailableNoAck: true,
    cloudColdStartMeasured: false,
  });
});

test("retirement promotion rejects another session, scope or predecessor even when signed bundle is internally valid", async () => {
  const data = bundle(),
    state = {
      scopeId: "different-scope",
      holdReason: "FENCE_INCOMPLETE",
      epoch: 2,
      generation: 1,
      retiredEpoch: 1,
      retiredRevision: "old-r1",
    },
    db = {
      async query(sql) {
        assert.match(sql, /control_read/);
        return { rows: [{ value: state }] };
      },
    },
    controller = new SessionController({ db, sessionId: data.fence.sessionId });
  assert.equal(
    (await controller.promote(data)).reason,
    "retirement_session_or_predecessor_mismatch",
  );
  state.scopeId = "old";
  state.retiredRevision = "another-revision";
  assert.equal((await controller.promote(data)).state, "HOLD");
  state.retiredRevision = "old-r1";
  state.retiredEpoch = 0;
  assert.equal((await controller.promote(data)).state, "HOLD");
  const other = new SessionController({ db, sessionId: randomUUID() });
  assert.equal((await other.promote(data)).state, "HOLD");
});

test("B1a aggregate gateway SQL login cap bounds old/new overlap without privilege fallback", async (t) => {
  const f = await fixture(t, { control: true }),
    { default: pg } = await import("pg"),
    clients = [];
  try {
    for (let i = 0; i < 4; i++) {
      const c = new pg.Client({ ...f.db, user: "inc1_gateway", ssl: false });
      await c.connect();
      clients.push(c);
    }
    const fifth = new pg.Client({ ...f.db, user: "inc1_gateway", ssl: false });
    try {
      await assert.rejects(fifth.connect(), /too many connections for role/);
    } finally {
      await fifth.end();
    }
    assert.equal(
      (
        await clients[0].query(
          "SELECT current_user,rolsuper,rolbypassrls,rolconnlimit FROM pg_roles WHERE rolname=current_user",
        )
      ).rows[0].rolconnlimit,
      4,
    );
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
});

test("B1a controller recovery marks only retired ENTERED as UNKNOWN, preserving original bindings", async (t) => {
  const f = await fixture(t, { control: true }),
    b = await f.plan({ deadlineMs: 8000 }),
    sessionId = randomUUID(),
    db = roleDb(f, "inc1_controller"),
    controller = new SessionController({ db, sessionId });
  await db.query("SELECT proof.control_create($1,$2,1,$3,$4)", [
    sessionId,
    b.scopeId,
    b.revision,
    new Date(Date.now() + 60000),
  ]);
  const state = await controller.read();
  await db.query("SELECT proof.control_promote($1,1,$2,$3)", [
    sessionId,
    state.generation,
    "a".repeat(64),
  ]);
  const g = await f.gateway({ controlSessionId: sessionId }),
    { hook } = await arm(g, b, "afterCommit"),
    pending = f.request(g, b);
  await hook;
  await stop(g);
  await pending;
  assert.equal(await f.state(b), "ENTERED");
  const before = (
    await f.admin.query(
      "SELECT operation_id,payload_digest,owner_id FROM proof.attempt WHERE id=$1",
      [b.attemptId],
    )
  ).rows[0];
  await controller.advance(1, 2, "inc1-r2");
  // Disposable test operator simulates receipt validation. SQL trusts the narrow
  // controller identity; real API requires the signed retirement bundle first.
  assert.equal(
    (
      await db.query("SELECT proof.recover_retired($1,$2,$3) state", [
        sessionId,
        b.attemptId,
        "b".repeat(64),
      ])
    ).rows[0].state,
    "UNKNOWN",
  );
  assert.equal(
    (
      await db.query("SELECT proof.recover_retired($1,$2,$3) state", [
        sessionId,
        b.attemptId,
        "b".repeat(64),
      ])
    ).rows[0].state,
    "UNKNOWN",
  );
  assert.equal(await f.state(b), "UNKNOWN");
  assert.deepEqual(
    (
      await f.admin.query(
        "SELECT operation_id,payload_digest,owner_id FROM proof.attempt WHERE id=$1",
        [b.attemptId],
      )
    ).rows[0],
    before,
  );
  const other = await f.plan();
  assert.equal(
    (
      await db.query("SELECT proof.recover_retired($1,$2,$3) state", [
        sessionId,
        other.attemptId,
        "b".repeat(64),
      ])
    ).rows[0].state,
    "DENIED",
  );
  assert.equal(await f.state(other), "ARMED");
  await assert.rejects(
    roleDb(f, "inc1_worker").query("SELECT proof.recover_retired($1,$2,$3)", [
      sessionId,
      b.attemptId,
      "b".repeat(64),
    ]),
    /permission denied/,
  );
  assert.equal(
    (await controller.reconcile({}, [b.attemptId])).dispatchEnabled,
    false,
  );
  assert.equal(f.records.filter((r) => r.event === "REQUEST").length, 0);
  await f.evidence("b1a-retired-recovery", {
    neverRearmed: true,
    originalBindingsPreserved: true,
    crossScopeDenied: true,
    cloudRetirementTested: false,
  });
});
