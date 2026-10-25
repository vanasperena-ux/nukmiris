"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const { fixture } = require("./helpers/management-fixture.cjs");
const { prepareReliabilitySchema, createReliableDelivery } = require("../lib/reliable-delivery");
const { createDatabaseBackup, restoreDatabaseCopy, inspectDatabase, listBackups, createBackupSchedule } = require("../lib/database-backups");
function setup() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-backups-"));
  const filename = path.join(directory, "synthetic.sqlite"), f = fixture(filename);
  prepareReliabilitySchema(f.db);
  return { ...f, directory, filename, copies: path.join(directory, "copies"), cleanup() { f.db.close(); fs.rmSync(directory, { recursive: true, force: true }); } };
}
test("consistent backups restore into an isolated copy with journals and foreign keys intact", async () => {
  const f = setup();
  try {
    const source = await f.seed(); await f.intent(source, "cancel");
    const queue = createReliableDelivery({ db: f.db, capabilities: "synthetic", resolveBusiness: () => ({ business_id: "synthetic-a", phone_number_id: "phone-synthetic-a" }) });
    queue.acquire();
    queue.accept({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "phone-synthetic-a" }, messages: [
      { id: "synthetic-backup-input", from: "synthetic-one", type: "text", text: { body: "Menu" } },
    ] } }] }] });
    const input = queue.claimInput();
    queue.checkpoint(input.inbox_id, { kind: "booking", requestId: source.bookingRequestId, decision: "yes" });
    queue.outputs(input.inbox_id, [{ to: "synthetic-one", type: "text", text: { body: "Saved reply" } }]);
    queue.release();
    const before = inspectDatabase(f.filename), copy = await createDatabaseBackup({ db: f.db, directory: f.copies });
    const destination = path.join(f.directory, "restored.sqlite");
    assert.deepEqual((await restoreDatabaseCopy({ source: copy.filename, destination })).counts, before);
    const restored = new DatabaseSync(destination, { readOnly: true });
    try {
      assert.equal(restored.prepare("SELECT state FROM message_outbox").get().state, "pending");
      assert.equal(JSON.parse(restored.prepare("SELECT continuation_json FROM message_inbox").get().continuation_json).requestId, source.bookingRequestId);
    } finally { restored.close(); }
    assert.deepEqual(inspectDatabase(f.filename), before);
    assert.equal(f.patches.length + f.deletes.length, 0);
    await assert.rejects(restoreDatabaseCopy({ source: copy.filename, destination: f.filename }), /unused destination/);
    assert.deepEqual(inspectDatabase(f.filename), before);
  } finally { f.cleanup(); }
});
test("retention removes only older tool-created backups after a verified new copy", async () => {
  const f = setup();
  try {
    fs.mkdirSync(f.copies); const unrelated = path.join(f.copies, "owner-manual.bak"); fs.writeFileSync(unrelated, "preserve");
    for (const clock of [1000, 2000, 3000]) await createDatabaseBackup({ db: f.db, directory: f.copies, keep: 2, now: () => clock });
    assert.deepEqual(listBackups(f.copies).map(item => item.createdAt), [3000, 2000]);
    assert.equal(fs.readFileSync(unrelated, "utf8"), "preserve");
    await assert.rejects(createDatabaseBackup({ db: f.db, directory: f.copies, keep: 1 }));
    assert.equal(listBackups(f.copies).length, 2);
  } finally { f.cleanup(); }
});
test("automatic scheduling creates an initial backup, waits for its interval, and replaces corruption safely", async () => {
  const f = setup(); let clock = 1000000;
  try {
    const schedule = createBackupSchedule({ db: f.db, directory: f.copies, intervalHours: 1, now: () => clock });
    await schedule.ensure(); await schedule.ensure(); assert.equal(listBackups(f.copies).length, 1);
    clock += 3600001; await schedule.ensure(); assert.equal(listBackups(f.copies).length, 2);
    fs.writeFileSync(listBackups(f.copies)[0].filename, "corrupt copy"); clock++;
    await schedule.ensure(); inspectDatabase(listBackups(f.copies)[0].filename);
    assert.equal(schedule.status().lastError, false);
    await schedule.stop();
  } finally { f.cleanup(); }
});
test("corrupt backups are rejected without creating or replacing a destination", async () => {
  const f = setup();
  try {
    const broken = path.join(f.directory, "broken.bak"), destination = path.join(f.directory, "unused.sqlite");
    fs.writeFileSync(broken, "not a database");
    await assert.rejects(restoreDatabaseCopy({ source: broken, destination }));
    assert(!fs.existsSync(destination));
  } finally { f.cleanup(); }
});
test("PC preparation backs up before adding the schema and the isolated restore CLI contacts no services", async () => {
  const f = setup();
  try {
    f.db.exec("DROP TABLE message_outbox; DROP TABLE message_inbox; DROP TABLE delivery_worker");
    const env = { ...process.env, NODE_ENV: "test", NUKMIRIS_DB_PATH: f.filename, NUKMIRIS_BACKUP_DIR: f.copies };
    const run = (script, ...args) => spawnSync(process.execPath, [path.resolve(__dirname, "../scripts", script), ...args], { env, encoding: "utf8" });
    const prepare = run("reliability.js", "--prepare"); assert.equal(prepare.status, 0, prepare.stderr);
    const oldName = fs.readdirSync(f.directory).find(name => name.includes(".before-reliability-")); assert(oldName);
    assert.equal(inspectDatabase(path.join(f.directory, oldName)).message_inbox, undefined);
    assert.equal(inspectDatabase(f.filename).message_inbox, 0);
    const created = run("database-backup.js", "--create"); assert.equal(created.status, 0, created.stderr);
    const restored = run("database-backup.js", "--restore-test"); assert.equal(restored.status, 0, restored.stderr);
    assert.match(restored.stdout, /Integrity, foreign keys, and row counts match/);
    assert.equal(inspectDatabase(f.filename).message_inbox, 0);
  } finally { f.cleanup(); }
});
test("compatibility mode cannot bypass unresolved durable messages", () => {
  const f = setup();
  try {
    const queue = createReliableDelivery({ db: f.db, capabilities: "synthetic", resolveBusiness: () => ({ business_id: "synthetic-a", phone_number_id: "phone-synthetic-a" }) });
    queue.acquire();
    queue.accept({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "phone-synthetic-a" }, messages: [
      { id: "synthetic-pending", from: "synthetic-one", type: "text", text: { body: "Menu" } },
    ] } }] }] });
    queue.release();
    const result = spawnSync(process.execPath, [path.resolve(__dirname, "../whatsapp-webhook.js")], { encoding: "utf8", env: {
      ...process.env, NODE_ENV: "test", NUKMIRIS_DB_PATH: f.filename, NUKMIRIS_MODE: "support", NUKMIRIS_ROUTING_MODE: "receiving_number",
      NUKMIRIS_ENABLE_RELIABILITY: "false", WHATSAPP_TOKEN: "synthetic", WHATSAPP_PHONE_NUMBER_ID: "synthetic",
      WHATSAPP_VERIFY_TOKEN: "synthetic", META_APP_SECRET: "synthetic",
    } });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /compatibility mode cannot bypass/);
    assert.equal(f.db.prepare("SELECT state FROM message_inbox").get().state, "queued");
  } finally { f.cleanup(); }
});
