import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { fixture, stop, arm, suspend, wake } from "./helpers.mjs";
import { GatewayStore } from "../src/store.mjs";
import { database } from "../src/protocol.mjs";
test("permission: consume once in gateway continuation; durable row/replay is never a ticket", async (t) => {
  const f = await fixture(t),
    b = await f.plan(),
    store = new GatewayStore({ ...f.db, user: "inc1_gateway" });
  t.after(() => store.close());
  const p = await store.enter(
    b.scopeId,
    b.attemptId,
    1,
    b.revision,
    async () => {},
  );
  assert.equal(typeof p.consume, "function");
  assert.equal(p.consume().operationId, b.operationId);
  assert.throws(() => p.consume(), /one_use/);
  assert.equal(
    (await store.enter(b.scopeId, b.attemptId, 1, b.revision, async () => {}))
      .state,
    "ENTERED",
  );
  await store.unknown(b.attemptId, p.ownerId);
  assert.equal(await f.state(b), "UNKNOWN");
});
test("permission: gateway cannot plan/rearm; invalid binding fails UNKNOWN with no network", async (t) => {
  const f = await fixture(t),
    g = await f.gateway(),
    b = await f.plan(),
    pool = new pg.Pool(database({ ...f.db, user: "inc1_gateway" }));
  t.after(() => pool.end());
  await assert.rejects(
    pool.query("SELECT proof.plan($1,$2,$3,1,$4,$5,$6,$7,$8)", [
      b.scopeId,
      b.attemptId,
      b.operationId,
      b.revision,
      b.payloadDigest,
      b.payload,
      b.deadlineAt,
      b.inboundTimeoutAt,
    ]),
    /permission denied/,
  );
  await assert.rejects(
    pool.query("UPDATE proof.attempt SET state='ARMED'"),
    /permission denied/,
  );
  // A deliberately mismatched worker plan must fail before any socket opens.
  const bad = await f.plan({ payload: { value: "original" } });
  const input = {
    ...bad,
    attemptId: randomUUID(),
    operationId: randomUUID(),
    payloadDigest: "0".repeat(64),
  };
  await f.worker.query("SELECT proof.plan($1,$2,$3,1,$4,$5,$6,$7,$8)", [
    input.scopeId,
    input.attemptId,
    input.operationId,
    input.revision,
    input.payloadDigest,
    input.payload,
    input.deadlineAt,
    input.inboundTimeoutAt,
  ]);
  assert.equal((await f.request(g, input)).state, "UNKNOWN");
  assert.equal(await f.state(input), "UNKNOWN");
  assert.equal(f.records.filter((r) => r.event === "REQUEST").length, 0);
  await assert.rejects(
    f.worker.query("SELECT proof.plan($1,$2,$3,1,$4,$5,$6,$7,$8)", [
      b.scopeId,
      randomUUID(),
      randomUUID(),
      b.revision,
      b.payloadDigest,
      b.payload,
      b.inboundTimeoutAt,
      b.deadlineAt,
    ]),
    /plan_denied/,
  );
  await stop(g);
});
test("permission: both authority/COMMIT race orders serialize; retirement is not physical fencing", async (t) => {
  const f = await fixture(t),
    g = await f.gateway();
  const before = await f.plan(),
    h = await arm(g, before, "beforeAuthority"),
    a = f.request(g, before);
  await h.hook;
  const p = await suspend(g);
  await f.fence(before);
  g.c.send({ type: "release", attemptId: before.attemptId });
  await wake(g, p, 2);
  assert.equal((await a).state, "DENIED");
  const after = await f.plan(),
    j = await arm(g, after, "beforeCommit"),
    b = f.request(g, after);
  await j.hook;
  const q = await suspend(g);
  const retirement = f.fence(after);
  g.c.send({ type: "release", attemptId: after.attemptId });
  await wake(g, q, 2);
  await retirement;
  assert.equal((await b).state, "APPLIED");
  assert.equal(
    f.records.filter(
      (r) => r.event === "REQUEST" && r.attemptId === after.attemptId,
    ).length,
    1,
  );
  await f.evidence("authority-races", {
    before: "DENIED",
    after: "APPLIED_PRE_RETIREMENT_PERMISSION",
    cloudFence: false,
  });
  await stop(g);
});
