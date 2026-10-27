"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const { reminderFixture } = require("./helpers/reminder-fixture.cjs");
const { prepareReliabilitySchema } = require("../lib/reliable-delivery");
const { createAppointmentReminders } = require("../lib/appointment-reminders");
const { createDatabaseBackup } = require("../lib/database-backups");
const { TEST_ENV, TEST_MINUTES, readReminderTestScope, planReminderLiveTest, applyReminderLiveTest } = require("../lib/reminder-live-test");
const { DEFAULT_INTERVALS, GRACE_MS } = require("../lib/reminder-schedule");

function fixture(t, options) {
  const f = reminderFixture(options);
  prepareReliabilitySchema(f.db);
  t.after(() => { if (f.db.isOpen) f.db.close(); });
  return f;
}
function scope(f, source) { return { businessId: source.businessId, sender: f.sender, bookingRequestId: source.requestId }; }
function rows(db, table) { return db.prepare(`SELECT * FROM ${table}`).all(); }

test("test scope has no implicit recipient and rejects every partial environment", () => {
  assert.equal(readReminderTestScope({}), null);
  for (const key of Object.values(TEST_ENV)) assert.throws(() => readReminderTestScope({ [key]: "synthetic" }), /all three/);
  const env = { NUKMIRIS_REMINDER_TEST_BUSINESS_ID: "synthetic-a", NUKMIRIS_REMINDER_TEST_RECIPIENT: "5213312345678",
    NUKMIRIS_REMINDER_TEST_BOOKING_ID: "synthetic-booking" };
  assert.deepEqual(readReminderTestScope(env), { businessId: "synthetic-a", sender: "5213312345678", bookingRequestId: "synthetic-booking" });
  assert.throws(() => readReminderTestScope({ ...env, NUKMIRIS_REMINDER_TEST_RECIPIENT: "+5213312345678" }), /digits/);
});

test("read-only plan and scoped apply preserve normal timing, event data, IDs and other customers' work", async t => {
  const f = fixture(t), source = await f.book();
  await f.book({ start: "2026-11-05T17:00:00-06:00" });
  await f.book({ start: "2026-11-05T18:00:00-06:00", sender: f.other });
  await f.book({ businessId: "synthetic-b" });
  const selected = scope(f, source), before = rows(f.db, "reminder_jobs"), settings = rows(f.db, "reminder_business_settings");
  const bookings = rows(f.db, "booking_requests"), attendance = rows(f.db, "appointment_attendance"), events = structuredClone(f.events);
  const plan = planReminderLiveTest(f.db, selected, f.now());
  assert.deepEqual(rows(f.db, "reminder_jobs"), before);
  assert.deepEqual(plan.normalIntervals, DEFAULT_INTERVALS);
  assert.equal(plan.sendsPerformed, 0); assert.equal(plan.calendarWritesPerformed, 0);
  assert.throws(() => applyReminderLiveTest(f.db, selected, f.other, f.now()), /explicitly match/);
  const applied = applyReminderLiveTest(f.db, selected, f.sender, f.now());
  assert.deepEqual(applied, plan);
  const after = rows(f.db, "reminder_jobs");
  for (const old of before) {
    const current = after.find(job => job.job_id === old.job_id);
    if (old.booking_request_id !== source.requestId) assert.deepEqual(current, old);
    else {
      assert.equal(current.due_at, f.now() + TEST_MINUTES[current.kind] * 60000);
      assert.equal(current.expires_at, current.due_at + GRACE_MS);
      assert.deepEqual({ ...current, due_at: old.due_at, expires_at: old.expires_at }, { ...old });
    }
  }
  assert.deepEqual(rows(f.db, "reminder_business_settings"), settings);
  assert.deepEqual(rows(f.db, "booking_requests"), bookings);
  assert.deepEqual(rows(f.db, "appointment_attendance"), attendance);
  assert.deepEqual(f.events, events);
  assert.equal(f.sent.length, 0);
});

test("controlled occurrences use the actual engine, all four templates and delivered-only follow-up", async t => {
  const f = fixture(t), source = await f.book(), selected = scope(f, source);
  const plan = applyReminderLiveTest(f.db, selected, f.sender, f.now());
  const engine = createAppointmentReminders({ ...f.options, testScope: selected });
  for (const job of plan.jobs) {
    f.setNow(job.dueAt);
    await engine.tick(); await engine.tick();
    if (job.kind === "confirmation") {
      const sent = f.jobs(source.requestId).find(item => item.kind === "confirmation");
      assert.equal(sent.state, "accepted"); assert.equal(sent.meta_status, null);
      engine.receipt({ business_id: source.businessId, phone_number_id: "phone-synthetic-a" }, {
        biz_opaque_callback_data: `nukmiris-reminder:${sent.job_id}`, recipient_id: "523312345678",
        id: sent.meta_message_id, status: "delivered",
      });
    }
  }
  assert.deepEqual(f.sent.map(job => job.payload.template.name), ["nukmiris_seven_day_v1", "nukmiris_confirmation_v1", "nukmiris_followup_v1", "nukmiris_final_v1"]);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM reminder_attempts").get().n, 4);
  assert.equal(f.patches.length, 0); assert.equal(f.row(source.requestId).attendance, "PENDING");
  assert.throws(() => applyReminderLiveTest(f.db, selected, f.sender, f.now()), /never attempted/);
});

for (const consumed of ["dry_run", "accepted", "uncertain", "failed", "sending", "skipped"]) {
  test(`live-test planning never rearms a ${consumed} occurrence`, async t => {
    const f = fixture(t), source = await f.book();
    f.db.prepare("UPDATE reminder_jobs SET state=? WHERE booking_request_id=? AND kind='seven_day'").run(consumed, source.requestId);
    const before = rows(f.db, "reminder_jobs");
    assert.throws(() => applyReminderLiveTest(f.db, scope(f, source), f.sender, f.now()), /never attempted/);
    assert.deepEqual(rows(f.db, "reminder_jobs"), before);
  });
}

for (const failure of ["active-business", "foreign-recipient", "foreign-business", "missing-permission", "changed-calendar", "cancelled", "protected-calendar", "running-backend", "short-notice"]) {
  test(`controlled planning fails closed for ${failure}`, async t => {
    const f = fixture(t), source = await f.book(), selected = scope(f, source);
    if (failure === "active-business") f.db.prepare("UPDATE businesses SET status='active' WHERE business_id=?").run(source.businessId);
    if (failure === "foreign-recipient") selected.sender = f.other;
    if (failure === "foreign-business") selected.businessId = "synthetic-b";
    if (failure === "missing-permission") f.db.exec("DELETE FROM reminder_permission_events");
    if (failure === "changed-calendar") f.db.prepare("UPDATE business_calendar_connections SET google_calendar_id='synthetic-changed' WHERE business_id=?").run(source.businessId);
    if (failure === "cancelled") f.db.prepare("UPDATE appointment_attendance SET lifecycle='CANCELLED' WHERE booking_request_id=?").run(source.requestId);
    if (failure === "protected-calendar") f.db.prepare("INSERT INTO calendar_booking_locks VALUES (?,?,?)").run("calendar-synthetic-a", source.requestId, "synthetic");
    if (failure === "running-backend") f.db.prepare("INSERT INTO delivery_worker VALUES (1,?,?,?)").run(os.hostname(), process.pid, "synthetic-owner");
    if (failure === "short-notice") f.setNow(f.row(source.requestId).start_ms - 24 * 3600000);
    const before = rows(f.db, "reminder_jobs");
    assert.throws(() => applyReminderLiveTest(f.db, selected, selected.sender, f.now()));
    assert.deepEqual(rows(f.db, "reminder_jobs"), before);
    assert.equal(f.sent.length, 0);
  });
}

test("live-test CLI defaults to plan and requires matching runtime restriction, explicit authorization and a verified backup", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-live-test-cli-"));
  let f;
  t.after(() => {
    if (f?.db.isOpen) f.db.close();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const filename = path.join(directory, "synthetic.sqlite");
  f = fixture(t, { filename });
  const source = await f.book(), now = f.now(), selected = scope(f, source);
  const env = { ...process.env, NODE_ENV: "test", NUKMIRIS_DB_PATH: filename, NUKMIRIS_BACKUP_DIR: path.join(directory, "backups"), NUKMIRIS_BACKUP_KEEP: "9",
    NUKMIRIS_REMINDER_TEST_BUSINESS_ID: "", NUKMIRIS_REMINDER_TEST_RECIPIENT: "", NUKMIRIS_REMINDER_TEST_BOOKING_ID: "" };
  const args = ["--business-id", source.businessId, "--whatsapp-id", f.sender, "--booking-request-id", source.requestId];
  function command(extra = [], extraEnv = {}) {
    const code = `Date.now=()=>${now}; global.fetch=()=>{throw new Error('Forbidden network')}; process.argv=['node','script',...${JSON.stringify([...args, ...extra])}]; require('./scripts/reminder-live-test');`;
    return spawnSync(process.execPath, ["-e", code], { cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 15000, env: { ...env, ...extraEnv } });
  }
  const before = rows(f.db, "reminder_jobs");
  const preview = command(); assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).action, "read-only-plan");
  assert.deepEqual(rows(f.db, "reminder_jobs"), before);
  assert.notEqual(command(["--apply", "--authorize-recipient", f.sender]).status, 0);
  const guard = Object.fromEntries(Object.entries(TEST_ENV).map(([key, name]) => [name, selected[key]]));
  assert.notEqual(command(["--apply", "--authorize-recipient", f.other], guard).status, 0);
  for (let index = 0; index < 9; index++) await createDatabaseBackup({ db: f.db,
    directory: path.join(directory, "backups"), keep: 9, now: () => now - 10000 + index });
  const result = command(["--apply", "--authorize-recipient", f.sender], guard);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.action, "applied"); assert.equal(report.sendsPerformed, 0);
  assert.equal(fs.readdirSync(path.join(directory, "backups")).filter(name => name.endsWith(".sqlite.bak")).length, 9,
    "test preparation respects the owner's configured backup retention instead of pruning to seven");
  assert.equal(rows(f.db, "reminder_attempts").length, 0);
  assert.deepEqual(rows(f.db, "reminder_business_settings").map(row => JSON.parse(row.intervals_json)), [DEFAULT_INTERVALS, DEFAULT_INTERVALS]);
});
