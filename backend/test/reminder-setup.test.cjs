"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { fixture } = require("./helpers/management-fixture.cjs");
const { reminderFixture } = require("./helpers/reminder-fixture.cjs");
const { prepareReliabilitySchema } = require("../lib/reliable-delivery");
const { createDatabaseBackup, restoreDatabaseCopy } = require("../lib/database-backups");
const { createAppointmentReminders } = require("../lib/appointment-reminders");
const cwd = path.resolve(__dirname, "..");

function command(filename, args) {
  return spawnSync(process.execPath, ["scripts/reminders.js", ...args], { cwd, encoding: "utf8", timeout: 10000,
    env: { ...process.env, NODE_ENV: "test", NUKMIRIS_DB_PATH: filename, NUKMIRIS_BUSINESS_ID: "synthetic-a" } });
}

test("backed-up reminder preparation is additive, repeatable, scoped, and performs no external calls", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-reminder-setup-"));
  const databases = [];
  t.after(() => {
    for (const db of databases) if (db.isOpen) db.close();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const filename = path.join(directory, "synthetic.sqlite"), f = fixture(filename);
  databases.push(f.db);
  prepareReliabilitySchema(f.db);
  const count = f.db.prepare("SELECT COUNT(*) AS n FROM business_customers").get().n;
  f.db.close();
  for (let i = 0; i < 2; i++) {
    const result = command(filename, ["--prepare", "--business-id", "synthetic-a"]);
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Pre-upgrade backup created/);
  }
  const db = new DatabaseSync(filename); databases.push(db);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM business_customers").get().n, count);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM appointment_attendance").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reminder_business_settings").get().n, 1);
  assert.equal(fs.readdirSync(directory).filter(name => name.includes("before-reminders")).length, 2);
  const status = command(filename, ["--status"]); assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).businessId, "synthetic-a");
  const templates = command(filename, ["--templates"]); assert.equal(templates.status, 0, templates.stderr);
  assert.equal(JSON.parse(templates.stdout).length, 4);
});

test("preparation refuses a running backend instead of changing its database", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-reminder-owner-"));
  let db;
  t.after(() => {
    if (db?.isOpen) db.close();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const filename = path.join(directory, "synthetic.sqlite"), f = fixture(filename);
  db = f.db;
  prepareReliabilitySchema(f.db);
  f.db.prepare("INSERT INTO delivery_worker VALUES (1,?,?,?)").run(os.hostname(), process.pid, "synthetic-owner");
  const result = command(filename, ["--prepare"]);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Stop the existing backend/);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='appointment_attendance'").get().n, 0);
  f.db.close();
});

test("permission CLI records attributable evidence without enabling sending or changing appointments", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-permission-cli-"));
  let db;
  t.after(() => {
    if (db?.isOpen) db.close();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const filename = path.join(directory, "synthetic.sqlite"), f = reminderFixture({ filename });
  db = f.db;
  f.db.exec("DELETE FROM reminder_permission_events");
  const args = ["--permission", "--business-id", "synthetic-a", "--whatsapp-id", f.sender, "--grant",
    "--occurred-at", "2026-10-24T10:00:00-06:00", "--source", "synthetic-form", "--wording", "Recibiré actualizaciones de mis citas de Business synthetic-a.",
    "--evidence", "synthetic-form-reference", "--recorded-by", "synthetic-owner"];
  const result = command(filename, args);
  assert.equal(result.status, 0, result.stderr);
  const evidence = f.db.prepare("SELECT * FROM reminder_permission_events").get();
  assert.equal(evidence.decision, "granted"); assert.equal(evidence.recorded_by, "synthetic-owner");
  assert.equal(evidence.business_id, "synthetic-a"); assert.equal(evidence.evidence_reference, "synthetic-form-reference");
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM booking_requests").get().n, 0);
  assert.equal(command(filename, args).status, 0);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM reminder_permission_events").get().n, 1);
});

test("automatic backup and isolated restore include all reminder and attendance tables", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-reminder-backup-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  await f.reminders.confirm(source, f.row(source.requestId).action_token);
  const copy = await createDatabaseBackup({ db: f.db, directory: path.join(directory, "backups") });
  assert.equal(copy.counts.appointment_attendance, 1); assert.equal(copy.counts.reminder_jobs, 4);
  assert.equal(copy.counts.reminder_attempts, 1); assert.equal(copy.counts.attendance_operations, 1);
  const restored = await restoreDatabaseCopy({ source: copy.filename, destination: path.join(directory, "isolated.sqlite") });
  assert.deepEqual(restored.counts, copy.counts);
});

for (const [mode, runtime, management, reliability] of [
  ["invalid", "booking", "true", "true"], ["dry-run", "booking", "true", "false"],
  ["live", "support", "true", "true"], ["dry-run", "booking", "false", "true"],
]) test(`reminders ${mode}/${runtime}/${management}/${reliability} cannot bypass existing runtime flags`, () => {
  const result = spawnSync(process.execPath, ["-e", "require('./whatsapp-webhook')"], { cwd, encoding: "utf8", timeout: 10000,
    env: { ...process.env, NODE_ENV: "test", NUKMIRIS_MODE: runtime, NUKMIRIS_ENABLE_MANAGEMENT: management,
      NUKMIRIS_ENABLE_RELIABILITY: reliability, NUKMIRIS_REMINDERS_MODE: mode, NUKMIRIS_ROUTING_MODE: "receiving_number",
      WHATSAPP_TOKEN: "synthetic-token", WHATSAPP_PHONE_NUMBER_ID: "synthetic", WHATSAPP_VERIFY_TOKEN: "synthetic", META_APP_SECRET: "synthetic" } });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Reminders require|REMINDERS_MODE must/);
});

test("live readiness verifies all four templates; dry-run performs no approval queries", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const calls = [];
  const live = createAppointmentReminders({ ...f.options, verifyTemplate: async (config, kind) => calls.push([config.business_id, kind]) });
  await live.verifyReady(); assert.equal(calls.length, 8);
  await createAppointmentReminders({ ...f.options, mode: "dry-run", verifyTemplate: () => { throw new Error("Forbidden in dry-run"); } }).verifyReady();
  f.controls.templateError = true; await assert.rejects(f.reminders.verifyReady(), /template_unapproved/);
});

test("disabling one business's reminders does not prevent ordinary rescheduling", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book();
  f.db.prepare("UPDATE reminder_business_settings SET enabled=0 WHERE business_id=?").run(source.businessId);
  const appointment = await f.management.readAppointment(source);
  const intent = await f.management.createIntent({ ...source, expectedEtag: appointment.etag, kind: "reschedule",
    slot: { start: "2026-11-05T17:00:00-06:00", end: "2026-11-05T18:00:00-06:00" } });
  assert.equal((await f.management.confirm({ ...source, requestId: intent.requestId })).status, "applied");
  assert(f.jobs(source.requestId).every(job => job.state !== "pending"));
});

test("a cancellation during the template check prevents the already claimed reminder from sending", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book();
  const reminders = createAppointmentReminders({ ...f.options, verifyTemplate: async () => {
    const appointment = await f.management.readAppointment(source);
    const intent = await f.management.createIntent({ ...source, expectedEtag: appointment.etag, kind: "cancel" });
    await f.management.confirm({ ...source, requestId: intent.requestId });
  } });
  f.setNow(f.jobs(source.requestId).find(job => job.kind === "confirmation").due_at);
  await reminders.tick();
  assert.equal(f.sent.length, 0); assert.equal(f.row(source.requestId).lifecycle, "CANCELLED");
});

test("a signed acceptance arriving before an uncertain HTTP result takes precedence", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); let reminders;
  reminders = createAppointmentReminders({ ...f.options, send: async job => {
    reminders.receipt({ business_id: source.businessId, phone_number_id: "phone-synthetic-a" }, {
      biz_opaque_callback_data: `nukmiris-reminder:${job.job_id}`, id: "synthetic-proof", recipient_id: "523312345678", status: "delivered",
    });
    return { state: "uncertain", error: "synthetic_lost_response" };
  } });
  f.setNow(f.jobs(source.requestId).find(job => job.kind === "confirmation").due_at); await reminders.tick();
  const job = f.jobs(source.requestId).find(job => job.kind === "confirmation");
  assert.equal(job.state, "accepted"); assert.equal(job.meta_status, "delivered");
});

test("malformed Calendar end times are held for review without messages or background crashes", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book();
  f.events.get(`calendar-synthetic-a:${source.eventId}`).end.dateTime = "not-a-timestamp";
  await f.at(source.requestId, "confirmation");
  assert.equal(f.sent.length, 0); assert.equal(f.row(source.requestId).lifecycle, "REVIEW");
});
