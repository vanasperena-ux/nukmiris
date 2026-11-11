import test from "node:test";
import assert from "node:assert/strict";
import { fixture, stop } from "./helpers.mjs";
import { readLedger } from "../src/ledger.mjs";
test("concurrency: one invocation for 32 same-attempt callers, replay and distinct operations", async (t) => {
  const f = await fixture(t),
    g = await f.gateway(),
    b = await f.plan({ deadlineMs: 8000 });
  const results = await Promise.all(
    Array.from({ length: 32 }, () => f.request(g, b)),
  );
  assert.ok(results.some((r) => r.state === "APPLIED"));
  assert.equal(await f.state(b), "APPLIED");
  for (let i = 0; i < 4; i++)
    assert.equal((await f.request(g, b)).state, "APPLIED");
  const others = await Promise.all(
    Array.from({ length: 8 }, () => f.plan({ deadlineMs: 8000 })),
  );
  assert.ok(
    (await Promise.all(others.map((v) => f.request(g, v)))).every(
      (r) => r.state === "APPLIED",
    ),
  );
  const head = await f.evidence("concurrency", {
    callers: 32,
    replays: 4,
    independent: 8,
    results,
  });
  await readLedger(f.dir + "/provider.jsonl", head);
  for (const v of [b, ...others]) {
    const events = f.records.filter((r) => r.attemptId === v.attemptId);
    assert.equal(events.filter((r) => r.event === "REQUEST").length, 1);
    assert.equal(events.filter((r) => r.event === "EFFECT").length, 1);
    assert.equal(new Set(events.map((r) => r.connectionId)).size, 1);
  }
  assert.equal(f.records.filter((r) => r.event === "TCP_ACCEPT").length, 9);
  await stop(g);
});
