import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash, endpoint, database } from "../src/protocol.mjs";
import { openLedger, readLedger, verifyRecords } from "../src/ledger.mjs";
import { classify } from "../src/classify.mjs";
import { cloudFixture } from "./evidence-fixture.mjs";
test("isolation: literal loopback, isolated database names and roles only", () => {
  for (const host of [
    "localhost",
    "169.254.169.254",
    "metadata.google.internal",
    "www.googleapis.com",
    "graph.facebook.com",
    "::1",
  ])
    assert.throws(() => endpoint({ host, port: 4444 }));
  assert.throws(() =>
    endpoint({ host: "127.0.0.1", port: 4444, url: "https://elsewhere" }),
  );
  assert.throws(() =>
    database({
      host: "127.0.0.1",
      port: 5432,
      database: "nukmiris",
      user: "postgres",
      password: "synthetic",
    }),
  );
});
test("ledger: modify, reorder, truncate, rehash and partial-record tampering fail against independent checkpoint", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "inc1-ledger-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "ledger.jsonl"),
    l = await openLedger(path, async () => {});
  await Promise.all(
    Array.from({ length: 50 }, (_, i) => l.append({ event: "SYNTHETIC", i })),
  );
  const checkpoint = await l.checkpoint();
  await l.close();
  await readLedger(path, checkpoint);
  const records = (await readFile(path, "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse),
    copy = () => structuredClone(records);
  let x = copy();
  x[4].i = 999;
  assert.throws(() => verifyRecords(x, checkpoint));
  x = copy();
  [x[2], x[3]] = [x[3], x[2]];
  assert.throws(() => verifyRecords(x, checkpoint));
  assert.throws(() => verifyRecords(records.slice(0, -1), checkpoint));
  x = copy();
  x[0].i = 999;
  for (let i = 0; i < x.length; i++) {
    x[i].previous = i ? x[i - 1].hash : "0".repeat(64);
    const { hash: _, ...body } = x[i];
    x[i].hash = hash(body);
  }
  assert.throws(() => verifyRecords(x, checkpoint));
  assert.throws(() => verifyRecords(records, null));
  await writeFile(path, JSON.stringify(records[0]));
  await assert.rejects(readLedger(path, checkpoint), /partial_record/);
  await assert.rejects(readLedger(path + ".missing", checkpoint), /ENOENT/);
});
const local = {
  kind: "LOCAL_PROCESS_EXIT",
  at: 100,
  scope: "old",
  exitObserved: true,
  pidStart: "123",
};
test("classifier: pre-fence late arrival differs from post-fence initiation", () => {
  assert.equal(
    classify({
      fence: local,
      activity: {
        scope: "old",
        connect: [20, 30],
        write: [40, 60],
        providerArrival: 150,
      },
      now: 200,
    }).verdict,
    "PRE_FENCE",
  );
  assert.equal(
    classify({
      fence: local,
      activity: { scope: "old", connect: [110, 120] },
      now: 200,
    }).verdict,
    "VIOLATION",
  );
  assert.equal(
    classify({
      fence: local,
      activity: { scope: "old", write: [99, 101] },
      now: 200,
    }).verdict,
    "NOT_PROVEN",
  );
});
test("classifier: absent, stale, wrong-scope, missing deletion and heartbeat-only evidence fail closed", () => {
  const activity = { scope: "old", connect: [20, 30] },
    cloud = {
      kind: "CLOUD",
      scope: "old",
      sourceVerified: true,
      at: 100,
      revisionDeleted: true,
      reportingDelayMs: 20,
      maxAgeMs: 30,
      coverUntil: 150,
      samples: [
        { at: 125, instances: 0 },
        { at: 150, instances: 0 },
      ],
    };
  assert.equal(
    classify(cloudFixture({ fence: cloud, activity, now: 155 })).verdict,
    "PRE_FENCE",
  );
  for (const fence of [
    null,
    { ...local, kind: "HEARTBEAT" },
    { ...local, exitObserved: false },
    { ...cloud, samples: [] },
    { ...cloud, samples: [{ at: 110, instances: 0 }] },
    { ...cloud, revisionDeleted: false },
    { ...cloud, scope: "other" },
    {
      ...cloud,
      samples: [
        { at: 125, instances: 1 },
        { at: 150, instances: 0 },
      ],
    },
  ])
    assert.equal(classify({ fence, activity, now: 200 }).verdict, "NOT_PROVEN");
});
