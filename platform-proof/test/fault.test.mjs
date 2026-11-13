import test from "node:test";
import assert from "node:assert/strict";
import https from "node:https";
import { randomUUID } from "node:crypto";
import {
  fixture,
  arm,
  suspend,
  wake,
  stop,
  processIdentity,
  lostCommitProxy,
  message,
} from "./helpers.mjs";
import { canonical } from "../src/protocol.mjs";
test("faults: lost COMMIT acknowledgement cannot recreate a permit", async (t) => {
  const f = await fixture(t),
    proxy = await lostCommitProxy({ host: f.db.host, port: f.db.port });
  t.after(() => proxy.close());
  const g = await f.gateway({
      database: { ...f.db, port: proxy.port, user: "inc1_gateway" },
    }),
    b = await f.plan();
  const result = await f.request(g, b);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(result.state, "UNKNOWN");
  assert.equal(proxy.dropped, 1);
  assert.equal(
    await f.state(b),
    "UNKNOWN",
    JSON.stringify({ result, failure: g.c.failure }),
  );
  assert.equal((await f.request(g, b)).state, "UNKNOWN");
  assert.equal(f.records.filter((r) => r.event === "REQUEST").length, 0);
  await f.evidence("lost-commit", {
    dropped: proxy.dropped,
    state: await f.state(b),
  });
  await stop(g);
});
test("faults: provider response loss, rejection, TLS stall and deadline stay held without resend", async (t) => {
  const f = await fixture(t),
    g = await f.gateway();
  for (const mode of ["DROP", "REJECT", "STALL", "BAD_PROOF"]) {
    const b = await f.plan({ mode, deadlineMs: 250 });
    assert.equal((await f.request(g, b)).state, "UNKNOWN");
    assert.equal(await f.state(b), "UNKNOWN");
    await f.request(g, b);
    assert.equal(
      f.records.filter(
        (r) => r.event === "REQUEST" && r.attemptId === b.attemptId,
      ).length,
      1,
    );
    assert.equal(
      f.records.filter(
        (r) => r.event === "EFFECT" && r.attemptId === b.attemptId,
      ).length,
      ["DROP", "BAD_PROOF"].includes(mode) ? 1 : 0,
    );
  }
  const stalled = await f.gateway({
      target: { host: "127.0.0.1", port: f.provider.stallPort },
    }),
    b = await f.plan({ deadlineMs: 250 });
  assert.equal((await f.request(stalled, b)).state, "UNKNOWN");
  await f.request(stalled, b);
  assert.equal(
    f.records.filter((r) => r.event === "TLS_STALL_TCP_ACCEPT").length,
    1,
  );
  const expired = await f.plan({ deadlineMs: -10, inboundMs: 1500 });
  assert.equal((await f.request(g, expired)).state, "EXPIRED");
  const wrongTrust = await f.gateway({ ca: "" }),
    bad = await f.plan();
  assert.equal((await f.request(wrongTrust, bad)).state, "UNKNOWN");
  assert.equal(
    f.records.filter(
      (r) => r.event === "REQUEST" && r.attemptId === bad.attemptId,
    ).length,
    0,
  );
  await f.evidence("transport-faults");
  await stop(stalled);
  await stop(wrongTrust);
  await stop(g);
});
test("faults: crash after COMMIT, restart and replay keep ENTERED/UNKNOWN non-resumable", async (t) => {
  const f = await fixture(t);
  let g = await f.gateway();
  const b = await f.plan({ deadlineMs: 4000 }),
    { hook } = await arm(g, b, "afterCommit");
  const request = f.request(g, b);
  await hook;
  await suspend(g);
  await stop(g);
  await request;
  assert.equal(await f.state(b), "ENTERED");
  // Recovery only records uncertainty; it cannot rearm or send.
  await f.admin.query(
    "UPDATE proof.attempt SET state='UNKNOWN' WHERE id=$1 AND state='ENTERED'",
    [b.attemptId],
  );
  g = await f.gateway();
  assert.equal((await f.request(g, b)).state, "UNKNOWN");
  assert.equal(f.records.filter((r) => r.event === "REQUEST").length, 0);
  await f.evidence("crash-restart");
  await stop(g);
});
test("faults: pre-exit accepted request can apply after completed local termination", async (t) => {
  const f = await fixture(t),
    g = await f.gateway(),
    b = await f.plan({ mode: "DELAY" }),
    paused = message(
      f.provider.c,
      (m) => m.type === "providerPaused" && m.attemptId === b.attemptId,
    );
  const pending = f.request(g, b);
  await paused;
  g.identity = await processIdentity(g.c.pid);
  const exit = await stop(g);
  await pending;
  f.provider.c.send({ type: "release", attemptId: b.attemptId });
  await new Promise((r) => setTimeout(r, 30));
  await f.checkpoint();
  const request = f.records.find(
      (r) => r.event === "REQUEST" && r.attemptId === b.attemptId,
    ),
    effect = f.records.find(
      (r) => r.event === "EFFECT" && r.attemptId === b.attemptId,
    );
  assert.ok(request.at <= exit.at);
  assert.ok(effect.at >= exit.at);
  assert.equal(await f.state(b), "ENTERED");
  await f.evidence("late-pre-fence-effect", {
    exit,
    requestAt: request.at,
    effectAt: effect.at,
    state: "ENTERED_REQUIRES_UNKNOWN_RECOVERY",
    conclusion: "Local termination cannot undo a pre-fence accepted request",
  });
});
test("faults: scope binding, immutable operation and role separation", async (t) => {
  const f = await fixture(t),
    g = await f.gateway(),
    b = await f.plan();
  assert.equal(
    (await f.request(g, { ...b, scopeId: randomUUID() })).state,
    "DENIED",
  );
  await assert.rejects(
    f.worker.query("SELECT proof.enter($1,$2,$3,1,$4)", [
      b.scopeId,
      b.attemptId,
      randomUUID(),
      b.revision,
    ]),
    /permission denied/,
  );
  await assert.rejects(
    f.worker.query("UPDATE proof.attempt SET state='ARMED'"),
    /permission denied/,
  );
  await assert.rejects(
    f.plan({ operationId: b.operationId }),
    /unique constraint/,
  );
  await assert.rejects(
    f.admin.query("UPDATE proof.attempt SET operation_id=$1 WHERE id=$2", [
      randomUUID(),
      b.attemptId,
    ]),
    /immutable/,
  );
  assert.equal((await f.request(g, b)).state, "APPLIED");
  await f.evidence("identity-roles");
  await stop(g);
});
test("counterexample: unsafe keep-alive sends again on an old connection; corrected gateway never does", async (t) => {
  const f = await fixture(t),
    agent = new https.Agent({ keepAlive: true, maxSockets: 1, ca: f.cert });
  t.after(() => agent.destroy());
  async function unsafe(b) {
    return new Promise((resolve, reject) => {
      const body = canonical(b.payload),
        req = https.request(
          {
            host: "127.0.0.1",
            servername: "localhost",
            port: f.provider.port,
            path: "/effect",
            method: "POST",
            agent,
            headers: {
              "Content-Length": Buffer.byteLength(body),
              "X-Inc1-Scope": b.scopeId,
              "X-Inc1-Attempt": b.attemptId,
              "X-Inc1-Operation": b.operationId,
              "X-Inc1-Epoch": b.epoch,
              "X-Inc1-Revision": b.revision,
              "X-Inc1-Digest": b.payloadDigest,
            },
          },
          (res) => {
            res.resume();
            res.on("end", resolve);
          },
        );
      req.on("error", reject);
      req.end(body);
    });
  }
  const a = await f.plan({ mode: "KEEP_ALIVE" }),
    b = await f.plan({ mode: "KEEP_ALIVE" });
  await unsafe(a);
  const logicalFence = Date.now();
  await f.fence(b);
  await unsafe(b);
  const bad = f.records.filter((r) => r.event === "REQUEST");
  assert.equal(bad.length, 2);
  assert.equal(bad[0].connectionId, bad[1].connectionId);
  assert.ok(bad[1].at >= logicalFence);
  const g = await f.gateway(),
    good = await Promise.all([f.plan(), f.plan()]);
  for (const v of good) assert.equal((await f.request(g, v)).state, "APPLIED");
  const conns = f.records
    .filter(
      (r) =>
        r.event === "REQUEST" && good.some((v) => v.attemptId === r.attemptId),
    )
    .map((r) => r.connectionId);
  assert.equal(new Set(conns).size, 2);
  assert.ok(!conns.includes(bad[0].connectionId));
  await f.evidence("keep-alive-counterexample", {
    logicalFence,
    unsafeRequests: 2,
    unsafeConnections: 1,
    correctedRequests: 2,
    correctedConnections: 2,
  });
  await stop(g);
});
test("dead-man: 20 independently awakened stopped processes; silence is not death", async (t) => {
  const f = await fixture(t);
  const trials = [];
  for (let i = 0; i < 20; i++) {
    const g = await f.gateway(),
      b = await f.plan({ deadlineMs: 3500 }),
      { hook } = await arm(g, b, "afterCommit");
    const result = f.request(g, b);
    await hook;
    const identity = await suspend(g);
    assert.equal(identity.state, "T");
    const silentAt = Date.now();
    g.c.send({ type: "release", attemptId: b.attemptId });
    const wakeResult = await wake(g, identity, 10 + (i % 5));
    assert.equal(wakeResult.continued, true);
    assert.equal((await result).state, "APPLIED");
    assert.ok(
      f.records.some(
        (r) =>
          r.event === "EFFECT" &&
          r.attemptId === b.attemptId &&
          r.at >= silentAt,
      ),
    );
    const old = await processIdentity(g.c.pid);
    g.identity = old;
    await stop(g);
    const killed = await f.gateway(),
      held = await f.plan(),
      { hook: killHook } = await arm(killed, held, "afterCommit"),
      pending = f.request(killed, held);
    await killHook;
    killed.identity = await suspend(killed);
    const delayedWake = wake(killed, killed.identity, 30, {
      allowAbsent: true,
    });
    const exit = await stop(killed);
    const wakeAfterExit = await delayedWake;
    await pending;
    assert.equal(wakeAfterExit.continued, false);
    assert.equal(
      f.records.filter(
        (r) => r.event === "REQUEST" && r.attemptId === held.attemptId,
      ).length,
      0,
    );
    trials.push({
      i,
      identity,
      wakeResult,
      exit,
      wakeAfterExit,
      requestAfterSilence: true,
      postExitInvocations: 0,
    });
  }
  // A completed local exit, unlike silence, prevents a delayed wake/send.
  const g = await f.gateway(),
    b = await f.plan(),
    { hook } = await arm(g, b, "afterCommit");
  const result = f.request(g, b);
  await hook;
  g.identity = await suspend(g);
  const exit = await stop(g);
  await result;
  assert.equal(
    f.records.filter(
      (r) => r.event === "REQUEST" && r.attemptId === b.attemptId,
    ).length,
    0,
  );
  await f.evidence("dead-man", {
    trials,
    completedLocalExit: exit,
    cloudTerminationProven: false,
  });
});
