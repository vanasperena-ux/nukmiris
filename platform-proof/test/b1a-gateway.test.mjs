import test from "node:test";
import assert from "node:assert/strict";
import { fixture, stop, arm, suspend, wake } from "./helpers.mjs";
import { commitProxy } from "./commit-proxy.mjs";
import {
  prepareCloudSqlConfig,
  verifiedPostgresTls,
} from "../src/database-transport.mjs";

for (const mode of ["BEFORE_SERVER", "ACK_LOST", "ROLLBACK_TAG"])
  test(
    "B-4: " + mode + " cannot mint a continuation without a confirmed COMMIT",
    async (t) => {
      const f = await fixture(t),
        proxy = await commitProxy({ host: f.db.host, port: f.db.port }, mode);
      t.after(() => proxy.close());
      const g = await f.gateway({
          database: { ...f.db, port: proxy.port, user: "inc1_gateway" },
        }),
        b = await f.plan({ deadlineMs: 8000 });
      const first = await f.request(g, b);
      assert.equal(first.state, "UNKNOWN");
      assert.equal(proxy.intercepted, 1);
      const durable = await f.state(b);
      assert.equal(durable, mode === "ACK_LOST" ? "UNKNOWN" : "ARMED");
      assert.equal(f.records.filter((r) => r.event === "REQUEST").length, 0);
      await stop(g);
      const replayGateway = await f.gateway(),
        replay = await f.request(replayGateway, b);
      assert.equal(replay.state, mode === "ACK_LOST" ? "UNKNOWN" : "APPLIED");
      await f.request(replayGateway, b);
      await f.checkpoint();
      assert.equal(
        f.records.filter((r) => r.event === "REQUEST").length,
        mode === "ACK_LOST" ? 0 : 1,
      );
      assert.equal(
        f.records.filter((r) => r.event === "EFFECT").length,
        mode === "ACK_LOST" ? 0 : 1,
      );
      await f.evidence("b1a-commit-" + mode.toLowerCase(), {
        mode,
        firstCaller: first.state,
        durableAfterLoss: durable,
        replayCaller: replay.state,
        intercepted: proxy.intercepted,
      });
      await stop(replayGateway);
    },
  );

for (const mode of ["BAD_EPOCH", "BAD_REVISION"])
  test(
    "B-5: positive proof " + mode + " remains UNKNOWN and is never resent",
    async (t) => {
      const f = await fixture(t),
        g = await f.gateway(),
        b = await f.plan({ mode });
      assert.equal((await f.request(g, b)).state, "UNKNOWN");
      assert.equal(await f.state(b), "UNKNOWN");
      await f.request(g, b);
      await f.checkpoint();
      assert.equal(f.records.filter((r) => r.event === "REQUEST").length, 1);
      assert.equal(f.records.filter((r) => r.event === "EFFECT").length, 1);
      await f.evidence("b1a-proof-" + mode.toLowerCase(), {
        state: await f.state(b),
        mode,
      });
      await stop(g);
    },
  );

test("B-3: stop sends only direct SIGKILL to an observed stopped process", async (t) => {
  const f = await fixture(t),
    g = await f.gateway(),
    b = await f.plan(),
    { hook } = await arm(g, b, "afterCommit"),
    pending = f.request(g, b);
  await hook;
  g.identity = await suspend(g);
  const signals = [],
    realKill = g.c.kill.bind(g.c);
  g.c.kill = (signal) => {
    signals.push(signal);
    return realKill(signal);
  };
  const decisionAt = Date.now(),
    exit = await stop(g);
  await pending;
  assert.equal(await stop(g), exit);
  assert.deepEqual(signals, ["SIGKILL"]);
  assert.ok(exit.at >= decisionAt);
  assert.equal(exit.exitObserved, true);
  assert.equal(await f.state(b), "ENTERED");
  assert.equal(
    (await wake(g, g.identity, 1, { allowAbsent: true })).continued,
    false,
  );
  assert.equal(f.records.filter((r) => r.event === "REQUEST").length, 0);
  await f.evidence("b1a-direct-kill", {
    signals,
    decisionAt,
    exit,
    state: await f.state(b),
    cloudTerminationProven: false,
  });
});

test("B-5: prepared Cloud SQL config requires a CA and DNS verification; no network or ADC", async (t) => {
  const f = await fixture(t),
    input = {
      host: "10.81.2.10",
      port: 5432,
      database: f.db.database,
      user: "inc1_gateway",
      password: "synthetic-only",
      ca: f.cert,
      servername: "db.test.sql.goog",
    };
  const config = prepareCloudSqlConfig(input);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.servername, input.servername);
  assert.equal(config.ssl.ca, f.cert);
  assert.equal(config.max, 2);
  for (const override of [
    { ca: "" },
    { ca: "not a certificate" },
    { servername: "10.81.2.10" },
    { host: "www.googleapis.com" },
    { host: "8.8.8.8" },
    { user: "postgres" },
    { port: 5433 },
    { database: "nukmiris" },
    { rejectUnauthorized: false },
    { sslmode: "prefer" },
  ])
    assert.throws(() => prepareCloudSqlConfig({ ...input, ...override }));
  assert.throws(() =>
    verifiedPostgresTls({
      ca: f.cert + "\n" + ["-----BEGIN", "PRIVATE KEY-----"].join(" "),
      servername: "localhost",
    }),
  );
});
