import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { CustodyJournal, providerJournal } from "../b1a2/runtime/journal.mjs";
import { protocolFixture } from "./b1a2-protocol-fixture.mjs";
import { syntheticInputs, validateInputs } from "../b1a2/runtime/inputs.mjs";
test("P-1/P-2 ambiguous custody PUT resolves only original immutable slot; concurrent writers cannot fork", async (t) => {
  const c = validateInputs(syntheticInputs(), {
      now: Date.parse("2026-11-14T12:00Z"),
    }),
    f = await protocolFixture(c);
  t.after(() => f.close());
  const a = new CustodyJournal({
    api: f.api,
    sessionId: c.session.id,
    allowNewSession: true,
  });
  f.interruptNextWrite();
  await assert.rejects(a.append({ event: "first" }), /uncertain/);
  await assert.rejects(a.append({ event: "replacement" }), /uncertain/);
  assert.equal((await a.resolve()).state, "RESOLVED_ORIGINAL_RECORD");
  assert.equal((await a.snapshot()).records[0].event, "first");
  const b = new CustodyJournal({ api: f.api, sessionId: c.session.id }),
    d = new CustodyJournal({ api: f.api, sessionId: c.session.id });
  await b.load();
  await d.load();
  const results = await Promise.allSettled([
    b.append({ event: "race-b" }),
    d.append({ event: "race-d" }),
  ]);
  assert.equal(results.filter((v) => v.status === "fulfilled").length, 1);
  assert.equal(f.objects.size, 2);
  const fresh = new CustodyJournal({ api: f.api, sessionId: c.session.id });
  await fresh.load();
  assert.equal((await fresh.snapshot()).records.length, 2);
  f.objects.delete([...f.objects.keys()][0]);
  await assert.rejects(
    new CustodyJournal({ api: f.api, sessionId: c.session.id }).load(),
    /gap/,
  );
});
test("P-4 provider crash restart requires independently retained head; corrupt, missing and partial writes hold", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "b1a2-journal-"));
  t.after(() => rm(dir, { force: true, recursive: true }));
  const file = join(dir, "ledger.jsonl");
  let j = await providerJournal(file);
  await Promise.all(
    Array.from({ length: 30 }, (_, i) => j.append({ event: "SYNTHETIC", i })),
  );
  const snap = await j.snapshot();
  await j.close();
  await assert.rejects(providerJournal(file), /checkpoint/);
  j = await providerJournal(file, { checkpoint: snap.checkpoint });
  assert.equal((await j.snapshot()).records.length, 30);
  await j.close();
  await writeFile(file, (await readFile(file, "utf8")).slice(0, -1));
  await assert.rejects(providerJournal(file, { checkpoint: snap.checkpoint }));
  await rm(file);
  await assert.rejects(
    providerJournal(file, { checkpoint: snap.checkpoint }),
    /missing/,
  );
});
