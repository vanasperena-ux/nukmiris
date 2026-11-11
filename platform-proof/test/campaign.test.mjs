import test from "node:test";
import assert from "node:assert/strict";
import { fixture, arm, suspend, wake, stop } from "./helpers.mjs";
import { classify } from "../src/classify.mjs";
import { readLedger } from "../src/ledger.mjs";
test("campaign: 1000 randomized real SIGSTOP/SIGCONT schedules, all classified", async (t) => {
  const f = await fixture(t),
    g = await f.gateway(),
    seed = 0x1ac12026,
    cuts = [
      "beforeAuthority",
      "beforeCommit",
      "afterCommit",
      "beforeConnect",
      "afterConnect",
      "afterTls",
      "beforeWrite",
      "midWrite",
      "afterWrite",
    ];
  let rng = seed;
  function next() {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  }
  const schedules = Array.from({ length: 1000 }, (_, i) => ({
    point: cuts[i % cuts.length],
    mode: i % 10 === 0 ? "EXPIRE" : i % 3 === 0 ? "REVOKE" : "RESUME",
    providerMode: i % 13 === 0 ? "DROP" : "OK",
    delay: 1 + Math.floor(next() * 8),
  }));
  for (let i = schedules.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [schedules[i], schedules[j]] = [schedules[j], schedules[i]];
  }
  const outcomes = [];
  for (let i = 0; i < schedules.length; i++) {
    const s = schedules[i],
      b = await f.plan({
        deadlineMs: s.mode === "EXPIRE" ? 300 : 2500,
        mode: s.providerMode,
      }),
      { hook } = await arm(g, b, s.point),
      pending = f.request(g, b);
    const boundary = await hook,
      identity = await suspend(g);
    let fencePromise;
    if (s.mode === "REVOKE") fencePromise = f.fence(b); // May serialize behind an open transaction.
    const delay =
      s.mode === "EXPIRE"
        ? Math.max(1, Date.parse(b.deadlineAt) - Date.now() + 10)
        : s.delay;
    g.c.send({ type: "release", attemptId: b.attemptId });
    const resumed = await wake(g, identity, delay);
    const authorityFenceAt = fencePromise ? await fencePromise : null;
    const result = await pending,
      state = await f.state(b);
    await f.request(g, b);
    const checkpoint = await f.checkpoint();
    const records = f.records.filter((r) => r.attemptId === b.attemptId),
      requests = records.filter((r) => r.event === "REQUEST"),
      effects = records.filter((r) => r.event === "EFFECT");
    assert.ok(requests.length <= 1, "duplicate request " + i);
    assert.ok(effects.length <= 1, "duplicate effect " + i);
    assert.ok(
      ["APPLIED", "UNKNOWN", "EXPIRED", "ARMED"].includes(state),
      state,
    );
    if (s.mode === "EXPIRE" && s.point !== "afterWrite")
      assert.equal(
        requests.length,
        0,
        "deadline continuation opened/wrote " + i,
      );
    const trace = g.trace.filter((v) => v.attemptId === b.attemptId);
    assert.ok(
      trace.filter((v) => v.event === "CONNECT_BEGIN").length <= 1,
      "replacement connection " + i,
    );
    const at = (e) => trace.find((v) => v.event === e)?.at;
    const connect = at("CONNECT_BEGIN")
      ? [at("CONNECT_BEGIN"), at("CONNECTED") ?? Date.now()]
      : undefined;
    const write = at("WRITE_BEGIN")
      ? [at("WRITE_BEGIN"), at("WRITE_CALLBACK") ?? Date.now()]
      : undefined;
    const classification = classify({
      fence: authorityFenceAt
        ? { kind: "SQL_EPOCH", at: authorityFenceAt }
        : null,
      activity: { scope: b.scopeId, connect, write },
      now: Date.now(),
    });
    assert.equal(classification.verdict, "NOT_PROVEN");
    outcomes.push({
      i,
      ...s,
      ...b,
      payload: undefined,
      identity,
      boundary,
      resumed,
      authorityFenceAt,
      result,
      state,
      requests: requests.length,
      effects: effects.length,
      classification,
      trace,
      ledgerCheckpoint: checkpoint,
    });
    if ((i + 1) % 100 === 0)
      t.diagnostic(
        "completed " + (i + 1) + " real suspended/resumed schedules",
      );
  }
  const head = await f.evidence("campaign", {
    seed,
    schedules: 1000,
    actualSigstop: 1000,
    actualSigcont: 1000,
    cloudFenceProven: false,
    outcomes,
  });
  await readLedger(f.dir + "/provider.jsonl", head);
  assert.equal(outcomes.length, 1000);
  assert.ok(outcomes.some((v) => v.state === "APPLIED"));
  assert.ok(outcomes.some((v) => v.state === "UNKNOWN"));
  assert.ok(outcomes.some((v) => v.state === "EXPIRED"));
  for (const r of f.records.filter((v) => v.event === "REQUEST"))
    assert.equal(
      f.records.filter(
        (v) => v.event === "REQUEST" && v.connectionId === r.connectionId,
      ).length,
      1,
    );
  await stop(g);
});
