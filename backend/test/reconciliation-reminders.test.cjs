"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const { DateTime } = require("luxon");
const { reminderFixture } = require("./helpers/reminder-fixture.cjs");
const { DEFAULT_INTERVALS } = require("../lib/reminder-schedule");
const backend = path.resolve(__dirname, "..");

function setup(t, { mode = "live" } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-reconciliation-reminders-"));
  let db;
  t.after(() => {
    if (db?.isOpen) db.close();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const filename = path.join(directory, "synthetic.sqlite"), f = reminderFixture({ filename, mode });
  db = f.db;
  const token = path.join(directory, "synthetic-booking-token.json");
  fs.writeFileSync(token, JSON.stringify({ type: "authorized_user", client_id: "synthetic", client_secret: "synthetic", refresh_token: "synthetic" }));
  function command(kind, requestId, { reminderMode = mode, businessId = "synthetic-a", error, clock = f.now() } = {}) {
    fs.writeFileSync(path.join(directory, "calendar.json"), JSON.stringify({ events: Object.fromEntries(f.events), error }));
    const result = spawnSync(process.execPath, ["--require", path.join(__dirname, "helpers/reconciliation-runtime.cjs"),
      `scripts/reconcile-${kind}.js`, requestId], {
      cwd: backend, encoding: "utf8", timeout: 15000,
      env: { ...process.env, NODE_ENV: "test", NUKMIRIS_DB_PATH: filename, NUKMIRIS_BUSINESS_ID: businessId,
        NUKMIRIS_REMINDERS_MODE: reminderMode, GOOGLE_BOOKING_TOKEN_PATH: token,
        GOOGLE_OAUTH_TOKEN_PATH: path.join(directory, "unused-read-token.json"),
        SYNTHETIC_RECONCILIATION_DIRECTORY: directory, SYNTHETIC_RECONCILIATION_NOW: String(clock) },
    });
    assert.ifError(result.error);
    assert(calls().every(call => call.kind === "calendar_get"), "Reconciliation must only read the synthetic Calendar");
    return result;
  }
  const calls = () => fs.existsSync(path.join(directory, "calls.jsonl"))
    ? fs.readFileSync(path.join(directory, "calls.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
  const context = source => ({ businessId: source.businessId, sender: source.sender, requestId: source.requestId });
  async function uncertainBooking({ start = "2026-11-04T18:00:00-06:00", businessId = "synthetic-a" } = {}) {
    const slot = { start, end: DateTime.fromISO(start, { setZone: true }).plus({ hours: 1 }).toISO() };
    const intent = f.booking.createIntent({ businessId, sender: f.sender, calendarId: `calendar-${businessId}`, slot });
    f.controls.afterInsert = async () => { throw f.error(503); };
    f.controls.afterGet = async () => { throw f.error(503); };
    const source = { ...f.scope(intent.requestId, businessId), requestId: intent.requestId, eventId: intent.eventId };
    assert.equal((await f.booking.confirm(context(source))).status, "uncertain");
    delete f.controls.afterInsert; delete f.controls.afterGet;
    assert.equal(f.row(intent.requestId), undefined);
    return source;
  }
  async function uncertainChange(source, kind = "reschedule") {
    const appointment = await f.management.readAppointment(source);
    const intent = await f.management.createIntent({ ...source, expectedEtag: appointment.etag, kind,
      ...(kind === "reschedule" ? { slot: { start: "2026-11-06T18:00:00-06:00", end: "2026-11-06T19:00:00-06:00" } } : {}) });
    const failReads = async () => { f.controls.afterGet = async () => { throw f.error(503); }; };
    if (kind === "reschedule") { f.controls.afterPatch = failReads; f.controls.afterPatchError = f.error(503); }
    else { f.controls.beforeDelete = failReads; f.controls.afterDeleteError = f.error(503); }
    assert.equal((await f.management.confirm({ ...source, requestId: intent.requestId })).status, "uncertain");
    for (const key of ["afterGet", "afterPatch", "afterPatchError", "beforeDelete", "afterDeleteError"]) delete f.controls[key];
    return intent;
  }
  const state = id => f.db.prepare("SELECT state FROM booking_requests WHERE request_id=?").get(id).state;
  const lockCount = () => f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n;
  return { ...f, command, calls, uncertainBooking, uncertainChange, state, lockCount };
}

for (const mode of ["dry-run", "live"]) test(`booking CLI reconciliation atomically enrolls eligible reminders in ${mode} without sending`, async t => {
  const f = setup(t, { mode }), source = await f.uncertainBooking();
  const calendar = JSON.stringify([...f.events]);
  const result = f.command("booking", source.requestId);
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Booking status: confirmed/);
  assert.equal(f.state(source.requestId), "confirmed"); assert.equal(f.lockCount(), 0);
  assert.equal(f.row(source.requestId).attendance, "PENDING");
  assert.deepEqual(f.jobs(source.requestId).map(job => job.kind), ["seven_day", "confirmation", "followup", "final"]);
  assert(f.jobs(source.requestId).every(job => job.state === "pending" && job.due_at > f.now()));
  assert.equal(f.sent.length, 0); assert.equal(f.dryRuns.length, 0);
  assert.equal(JSON.stringify([...f.events]), calendar); assert.equal(f.calls().length, 1);
});

test("repeated booking CLI processes preserve one schedule, tokens and confirmed state after restart", async t => {
  const f = setup(t), source = await f.uncertainBooking();
  assert.equal(f.command("booking", source.requestId).status, 0);
  assert.equal(f.jobs(source.requestId).length, 4);
  const original = JSON.stringify([f.row(source.requestId), f.jobs(source.requestId)]);
  for (const minutes of [1, 2]) {
    const result = f.command("booking", source.requestId, { clock: f.now() + minutes * 60000 });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /status: confirmed/);
    assert.equal(JSON.stringify([f.row(source.requestId), f.jobs(source.requestId)]), original);
  }
  assert.equal(f.calls().length, 1); assert.equal(f.inserts.length, 1);
});

for (const error of [404, 503]) test(`booking CLI reconciliation remains uncertain after Calendar read ${error}, without premature reminders`, async t => {
  const f = setup(t), source = await f.uncertainBooking();
  const result = f.command("booking", source.requestId, { error });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /status: uncertain/);
  assert.equal(f.state(source.requestId), "uncertain"); assert.equal(f.row(source.requestId), undefined);
  assert.equal(f.lockCount(), 1); assert.equal(f.jobs(source.requestId).length, 0);
});

test("booking CLI rejects another business's request before reading Calendar or enrolling reminders", async t => {
  const f = setup(t), source = await f.uncertainBooking();
  const result = f.command("booking", source.requestId, { businessId: "synthetic-b" });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Reconciliation failed/);
  assert.equal(f.state(source.requestId), "uncertain"); assert.equal(f.row(source.requestId), undefined);
  assert.equal(f.calls().length, 0); assert.equal(f.lockCount(), 1);
});

for (const scenario of ["event_owner", "customer_identity", "calendar_mapping"]) test(`booking CLI recovery preserves isolation after ${scenario} changes`, async t => {
  const f = setup(t), source = await f.uncertainBooking();
  if (scenario === "event_owner") f.events.get(`calendar-synthetic-a:${source.eventId}`).extendedProperties.private.nukmirisBusinessId = "synthetic-b";
  if (scenario === "customer_identity") f.db.prepare("UPDATE business_customers SET whatsapp_id='synthetic-reassigned' WHERE business_id='synthetic-a' AND whatsapp_id=?").run(f.sender);
  if (scenario === "calendar_mapping") f.db.prepare("UPDATE business_calendar_connections SET google_calendar_id='synthetic-changed' WHERE business_id='synthetic-a'").run();
  const result = f.command("booking", source.requestId);
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /status: uncertain/);
  assert.equal(f.state(source.requestId), "uncertain"); assert.equal(f.row(source.requestId), undefined);
  assert.equal(f.lockCount(), 1);
});

for (const scenario of ["before_activation", "business_disabled", "business_not_prepared"]) test(`booking CLI recovery does not enroll ${scenario} appointments`, async t => {
  const f = setup(t), source = await f.uncertainBooking();
  if (scenario === "before_activation") f.db.prepare("UPDATE reminder_business_settings SET activated_at=? WHERE business_id='synthetic-a'").run(f.now() + 1);
  if (scenario === "business_disabled") f.db.prepare("UPDATE reminder_business_settings SET enabled=0 WHERE business_id='synthetic-a'").run();
  if (scenario === "business_not_prepared") f.db.prepare("DELETE FROM reminder_business_settings WHERE business_id='synthetic-a'").run();
  const result = f.command("booking", source.requestId);
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /status: confirmed/);
  assert.equal(f.row(source.requestId), undefined); assert.equal(f.jobs(source.requestId).length, 0);
});

test("booking CLI recovery inside the final two-hour window creates no obsolete reminder jobs", async t => {
  const f = setup(t), source = await f.uncertainBooking({ start: "2026-10-26T10:00:00-06:00" });
  const result = f.command("booking", source.requestId);
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /status: confirmed/);
  assert.equal(f.jobs(source.requestId).length, 0); assert.equal(f.row(source.requestId).attendance, "PENDING");
});

test("off-mode booking CLI recovery still works without reminder tables", async t => {
  const f = setup(t, { mode: "off" }), source = await f.uncertainBooking();
  f.db.exec("DROP TABLE reminder_permission_events; DROP TABLE reminder_attempts; DROP TABLE reminder_jobs; DROP TABLE attendance_operations; DROP TABLE appointment_attendance; DROP TABLE reminder_business_settings;");
  const result = f.command("booking", source.requestId);
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /status: confirmed/);
  assert.equal(f.state(source.requestId), "confirmed"); assert.equal(f.lockCount(), 0);
});

test("a failed reminder enrollment rolls back booking reconciliation and succeeds once after repair/restart", async t => {
  const f = setup(t), source = await f.uncertainBooking();
  f.db.prepare("UPDATE reminder_business_settings SET intervals_json='synthetic-invalid-json' WHERE business_id='synthetic-a'").run();
  const failed = f.command("booking", source.requestId);
  assert.equal(failed.status, 0, failed.stderr); assert.match(failed.stdout, /status: uncertain/);
  assert.equal(f.state(source.requestId), "uncertain"); assert.equal(f.row(source.requestId), undefined); assert.equal(f.lockCount(), 1);
  f.db.prepare("UPDATE reminder_business_settings SET intervals_json=? WHERE business_id='synthetic-a'").run(JSON.stringify(DEFAULT_INTERVALS));
  const retried = f.command("booking", source.requestId);
  assert.equal(retried.status, 0, retried.stderr); assert.match(retried.stdout, /status: confirmed/);
  assert.equal(f.jobs(source.requestId).length, 4); assert.equal(f.lockCount(), 0);
});

test("already confirmed untracked bookings are not backfilled when CLI reminders are later enabled", async t => {
  const f = setup(t, { mode: "off" }), source = await f.book();
  assert.equal(f.row(source.requestId), undefined);
  const result = f.command("booking", source.requestId, { reminderMode: "dry-run" });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /status: confirmed/);
  assert.equal(f.row(source.requestId), undefined); assert.equal(f.calls().length, 0);
});

test("cancellation reconciled by the management CLI invalidates reminders and never resurrects them on repeats", async t => {
  const f = setup(t), source = await f.book(), change = await f.uncertainChange(source, "cancel");
  assert(f.jobs(source.requestId).every(job => job.state === "pending"));
  const calendar = JSON.stringify([...f.events]);
  const result = f.command("management", change.requestId);
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /status: applied/);
  assert.equal(f.state(source.requestId), "removed"); assert.equal(f.row(source.requestId).attendance, "CANCELLED");
  assert(f.jobs(source.requestId).every(job => job.state === "skipped")); assert.equal(f.lockCount(), 0);
  const final = JSON.stringify([f.row(source.requestId), f.jobs(source.requestId)]);
  assert.match(f.command("management", change.requestId).stdout, /status: applied/);
  assert.match(f.command("booking", source.requestId).stdout, /status: removed/);
  assert.equal(JSON.stringify([f.row(source.requestId), f.jobs(source.requestId)]), final);
  assert.equal(JSON.stringify([...f.events]), calendar); assert.equal(f.calls().length, 1);
});

for (const confirmed of [false, true]) test(`management CLI reschedule recovery resets ${confirmed ? "confirmed" : "pending"} attendance and creates one future schedule`, async t => {
  const f = setup(t), source = await f.book();
  if (confirmed) {
    await f.at(source.requestId, "confirmation");
    assert.equal((await f.reminders.confirm(source, f.row(source.requestId).action_token)).status, "confirmed");
  }
  const before = f.row(source.requestId), change = await f.uncertainChange(source);
  const calendar = JSON.stringify([...f.events]);
  const result = f.command("management", change.requestId);
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /status: applied/);
  const after = f.row(source.requestId), jobs = f.jobs(source.requestId);
  assert.equal(after.attendance, "PENDING"); assert.equal(after.confirmed_at, null);
  assert.equal(after.schedule_version, before.schedule_version + 1); assert.notEqual(after.action_token, before.action_token);
  assert.equal(after.start_iso, "2026-11-06T18:00:00-06:00");
  assert(jobs.filter(job => job.schedule_version === before.schedule_version).every(job => job.state !== "pending"));
  assert.equal(jobs.filter(job => job.schedule_version === after.schedule_version && job.state === "pending").length, confirmed ? 3 : 4);
  assert.equal(f.lockCount(), 0); assert.equal(JSON.stringify([...f.events]), calendar);
  const saved = JSON.stringify([after, jobs]);
  assert.match(f.command("management", change.requestId).stdout, /status: applied/);
  assert.equal(JSON.stringify([f.row(source.requestId), f.jobs(source.requestId)]), saved); assert.equal(f.calls().length, 1);
});

test("management CLI uncertainty and foreign-business rejection preserve the source reminder schedule and lock", async t => {
  const f = setup(t), source = await f.book(), change = await f.uncertainChange(source);
  const before = JSON.stringify([f.row(source.requestId), f.jobs(source.requestId)]);
  const foreign = f.command("management", change.requestId, { businessId: "synthetic-b" });
  assert.notEqual(foreign.status, 0); assert.equal(f.calls().length, 0);
  const uncertain = f.command("management", change.requestId, { error: 503 });
  assert.equal(uncertain.status, 0, uncertain.stderr); assert.match(uncertain.stdout, /status: uncertain/);
  assert.equal(JSON.stringify([f.row(source.requestId), f.jobs(source.requestId)]), before); assert.equal(f.lockCount(), 1);
});

test("a manually moved confirmed appointment stays held for review after booking CLI reconciliation", async t => {
  const f = setup(t), source = await f.book();
  await f.at(source.requestId, "confirmation");
  assert.equal((await f.reminders.confirm(source, f.row(source.requestId).action_token)).status, "confirmed");
  const event = f.events.get(`calendar-synthetic-a:${source.eventId}`);
  event.start.dateTime = "2026-11-06T18:00:00-06:00"; event.end.dateTime = "2026-11-06T19:00:00-06:00";
  f.setNow(f.now() + 300001);
  await f.reminders.tick();
  assert.equal(f.row(source.requestId).lifecycle, "REVIEW");
  const before = JSON.stringify([f.row(source.requestId), f.jobs(source.requestId)]);
  assert.match(f.command("booking", source.requestId).stdout, /status: confirmed/);
  assert.equal(JSON.stringify([f.row(source.requestId), f.jobs(source.requestId)]), before);
  assert.equal(f.row(source.requestId).last_error, "confirmed_appointment_manually_moved");
});

test("CLI-enrolled dry-run jobs preview once, remain persisted and never send or replay on reconciliation", async t => {
  const f = setup(t, { mode: "dry-run" }), source = await f.uncertainBooking();
  assert.equal(f.command("booking", source.requestId).status, 0);
  assert.equal(f.dryRuns.length, 0); f.controls.templateError = true;
  await f.at(source.requestId, "final");
  assert.equal(f.dryRuns.length, 1); assert.equal(f.sent.length, 0); assert.equal(f.patches.length, 0);
  assert.equal(f.jobs(source.requestId).find(job => job.kind === "final").state, "dry_run");
  const saved = JSON.stringify(f.jobs(source.requestId));
  assert.equal(f.command("booking", source.requestId).status, 0);
  await f.reminders.tick();
  assert.equal(JSON.stringify(f.jobs(source.requestId)), saved); assert.equal(f.dryRuns.length, 1);
});

for (const gate of ["permission", "template"]) test(`CLI recovery never bypasses the existing live ${gate} sending gate`, async t => {
  const f = setup(t), source = await f.uncertainBooking();
  if (gate === "permission") f.db.exec("DELETE FROM reminder_permission_events");
  else f.controls.templateError = true;
  assert.equal(f.command("booking", source.requestId).status, 0);
  assert(f.jobs(source.requestId).every(job => job.state === "pending"));
  await f.at(source.requestId, "confirmation");
  const request = f.jobs(source.requestId).find(job => job.kind === "confirmation");
  assert.equal(request.state, gate === "permission" ? "skipped" : "failed");
  assert.equal(f.sent.length, 0); assert.equal(f.calls().length, 1);
});
