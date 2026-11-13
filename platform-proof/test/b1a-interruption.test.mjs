import test from "node:test";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { fixture, arm, suspend, wake, stop } from "./helpers.mjs";
import { classify } from "../src/classify.mjs";
import { readLedger } from "../src/ledger.mjs";

const cuts = [
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
const controls = ["RESUME", "REVOKE", "EXPIRE"],
  providers = ["OK", "DROP"];
function seeded(seed) {
  let x = seed;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
function shuffle(xs, next) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function traceActivity(trace, scope, incompleteUntil = Date.now()) {
  const begin = trace.find((v) => v.event === "CONNECT_BEGIN")?.at,
    connected = trace.find((v) => v.event === "CONNECTED")?.at,
    write = trace.find((v) => v.event === "WRITE_BEGIN")?.at,
    written = trace.find((v) => v.event === "WRITE_CALLBACK")?.at;
  return {
    scope,
    ...(begin !== undefined
      ? { connect: [begin, connected ?? incompleteUntil] }
      : {}),
    ...(write !== undefined
      ? { write: [write, written ?? incompleteUntil] }
      : {}),
  };
}

test("B-1/P2: complete 54-cell cross-product, 20 real instrumented suspensions per cell", async (t) => {
  const f = await fixture(t),
    g = await f.gateway(),
    seed = 0xb1a2026f,
    next = seeded(seed),
    schedules = [];
  for (const point of cuts)
    for (const controlMode of controls)
      for (const providerMode of providers)
        for (let repetition = 0; repetition < 20; repetition++)
          schedules.push({
            point,
            controlMode,
            providerMode,
            repetition,
            delayMs: 1 + Math.floor(next() * 8),
          });
  shuffle(schedules, next);
  const outcomes = [],
    coverage = {};
  for (let i = 0; i < schedules.length; i++) {
    const s = schedules[i],
      b = await f.plan({
        mode: s.providerMode,
        deadlineMs: s.controlMode === "EXPIRE" ? 200 : 3000,
      }),
      { hook } = await arm(g, b, s.point),
      pending = f.request(g, b);
    const boundary = await hook,
      identity = await suspend(g);
    const retirement = s.controlMode === "REVOKE" ? f.fence(b) : null;
    if (retirement && s.point !== "beforeCommit") await retirement;
    g.c.send({ type: "release", attemptId: b.attemptId });
    const resumed = await wake(
      g,
      identity,
      s.controlMode === "EXPIRE"
        ? Math.max(1, Date.parse(b.deadlineAt) - Date.now() + 10)
        : s.delayMs,
    );
    const authorityFenceAt = retirement ? await retirement : null,
      result = await pending,
      durableState = await f.state(b);
    await f.request(g, b);
    const checkpoint = await f.checkpoint(),
      events = f.records.filter((r) => r.attemptId === b.attemptId),
      requests = events.filter((r) => r.event === "REQUEST").length,
      effects = events.filter((r) => r.event === "EFFECT").length,
      trace = g.trace.filter((r) => r.attemptId === b.attemptId);
    assert.ok(requests <= 1 && effects <= 1, "duplicate at " + i);
    assert.ok(trace.filter((r) => r.event === "CONNECT_BEGIN").length <= 1);
    if (s.controlMode === "REVOKE" && s.point === "beforeAuthority") {
      assert.equal(result.state, "DENIED");
      assert.equal(requests, 0);
    }
    if (s.controlMode === "REVOKE" && s.point === "afterCommit") {
      assert.equal(effects, 1);
      assert.equal(
        result.state,
        s.providerMode === "OK" ? "APPLIED" : "UNKNOWN",
      );
    }
    if (s.controlMode === "EXPIRE" && s.point !== "afterWrite")
      assert.equal(requests, 0);
    const classification = classify({
      fence: authorityFenceAt
        ? { kind: "SQL_EPOCH", at: authorityFenceAt }
        : null,
      activity: traceActivity(trace, b.scopeId),
      now: Date.now(),
    });
    assert.equal(classification.verdict, "NOT_PROVEN");
    const cell = [s.point, s.controlMode, s.providerMode].join("|");
    coverage[cell] = (coverage[cell] || 0) + 1;
    const { mode: discardedProviderAlias, ...binding } = b;
    outcomes.push({
      i,
      ...binding,
      ...s,
      identity,
      boundary,
      resumed,
      result,
      durableState,
      requests,
      effects,
      authorityFenceAt,
      trace,
      classification,
      ledgerCheckpoint: checkpoint,
    });
    if ((i + 1) % 180 === 0)
      t.diagnostic("B1a cross-product completed " + (i + 1) + "/1080");
  }
  assert.equal(Object.keys(coverage).length, 54);
  assert.ok(Object.values(coverage).every((n) => n === 20));
  const head = await f.evidence("b1a-cross-product-v1", {
    runId: randomUUID(),
    seed,
    schedules: 1080,
    instrumented: true,
    arbitraryInstructionCoverage: false,
    actualSIGSTOP: 1080,
    actualSIGCONT: 1080,
    coverageCells: 54,
    repetitionsPerCell: 20,
    coverage,
    outcomes,
    cloudContainmentProven: false,
  });
  await readLedger(f.dir + "/provider.jsonl", head);
  await stop(g);
});

test("B-1/P3: 400 uninstrumented asynchronous suspensions, 130 direct kills and durable replay decisions", async (t) => {
  const f = await fixture(t),
    seed = 0xb1a3a51,
    next = seeded(seed),
    decisions = shuffle(
      Array.from({ length: 400 }, (_, i) => (i < 130 ? "KILL" : "CONTINUE")),
      next,
    ),
    outcomes = [];
  let g = await f.gateway();
  for (let i = 0; i < 400; i++) {
    const providerMode = next() < 0.25 ? "DROP" : "OK",
      controlMode =
        next() < 0.2 ? "EXPIRE" : next() < 0.4 ? "REVOKE" : "RESUME",
      decision = decisions[i],
      b = await f.plan({
        mode: providerMode,
        deadlineMs: controlMode === "EXPIRE" ? 180 : 2500,
      }),
      old = g,
      pending = f.request(old, b),
      delayMs = randomInt(0, 12);
    // No armHook, IPC parking or gateway phase synchronization in this test.
    await sleep(delayMs);
    const identity = await suspend(old),
      stateAtStop = await f.state(b),
      traceAtStop = old.trace.filter((r) => r.attemptId === b.attemptId),
      retirement = controlMode === "REVOKE" ? f.fence(b) : null;
    let exit = null,
      resumed = null,
      recoveryState = null,
      replay = null;
    if (decision === "KILL") {
      exit = await stop(old);
      await pending;
      if (retirement) await retirement;
      const durableAfterKill = await f.state(b);
      // Recovery can monotonically record uncertainty after observed process death;
      // it cannot turn ENTERED/UNKNOWN into ARMED or invent a provider outcome.
      await f.admin.query(
        "UPDATE proof.attempt SET state='UNKNOWN' WHERE id=$1 AND state='ENTERED'",
        [b.attemptId],
      );
      recoveryState = await f.state(b);
      g = await f.gateway();
      replay = await f.request(g, b);
      await f.request(g, b);
      if (["ENTERED", "UNKNOWN"].includes(durableAfterKill)) {
        assert.equal(recoveryState, "UNKNOWN");
        assert.equal(replay.state, "UNKNOWN");
      }
    } else {
      resumed = await wake(
        old,
        identity,
        controlMode === "EXPIRE"
          ? Math.max(1, Date.parse(b.deadlineAt) - Date.now() + 10)
          : randomInt(1, 10),
      );
      await pending;
      if (retirement) await retirement;
      await f.request(old, b);
    }
    const checkpoint = await f.checkpoint(),
      events = f.records.filter((r) => r.attemptId === b.attemptId),
      requests = events.filter((r) => r.event === "REQUEST").length,
      effects = events.filter((r) => r.event === "EFFECT").length,
      oldTrace = old.trace.filter((r) => r.attemptId === b.attemptId),
      newTrace =
        g === old ? [] : g.trace.filter((r) => r.attemptId === b.attemptId);
    assert.ok(requests <= 1 && effects <= 1);
    assert.ok(
      oldTrace.filter((r) => r.event === "CONNECT_BEGIN").length +
        newTrace.filter((r) => r.event === "CONNECT_BEGIN").length <=
        1,
    );
    if (exit)
      assert.ok(
        oldTrace.every((r) => r.at <= exit.at),
        "old process initiated after observed exit",
      );
    const processScope = "local:" + identity.pid + ":" + identity.startTime,
      activity = traceActivity(oldTrace, processScope, exit?.at ?? Date.now()),
      classification = classify({
        fence: exit
          ? { ...exit, kind: "LOCAL_PROCESS_EXIT", scope: processScope }
          : null,
        activity,
        now: Date.now(),
        uncertaintyMs: 2,
      });
    assert.notEqual(classification.verdict, "VIOLATION");
    const { mode: discardedProviderAlias, ...binding } = b;
    outcomes.push({
      i,
      ...binding,
      providerMode,
      controlMode,
      decision,
      delayMs,
      instrumented: false,
      identity,
      stateAtStop,
      traceAtStop,
      exit,
      resumed,
      recoveryState,
      replay,
      durableState: await f.state(b),
      requests,
      effects,
      oldTrace,
      newTrace,
      classification,
      ledgerCheckpoint: checkpoint,
    });
    if ((i + 1) % 100 === 0)
      t.diagnostic("B1a asynchronous completed " + (i + 1) + "/400");
  }
  assert.equal(outcomes.filter((r) => r.exit).length, 130);
  assert.equal(outcomes.filter((r) => r.resumed?.continued).length, 270);
  const head = await f.evidence("b1a-asynchronous-v1", {
    runId: randomUUID(),
    seed,
    schedules: 400,
    instrumented: false,
    suspensionDelaySource:
      "node:crypto.randomInt, delays recorded; no claim that every instruction was sampled",
    actualSIGSTOP: 400,
    actualSIGCONT: 270,
    directSIGKILL: 130,
    outcomes,
    cloudContainmentProven: false,
  });
  await readLedger(f.dir + "/provider.jsonl", head);
  await stop(g);
});
