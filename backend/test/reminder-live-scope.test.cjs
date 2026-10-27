"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { DateTime } = require("luxon");
const { reminderFixture } = require("./helpers/reminder-fixture.cjs");
const { createAppointmentReminders } = require("../lib/appointment-reminders");
const { createBookingService } = require("../lib/booking");

function selectedScope(source) {
  return { businessId: source.businessId, sender: source.sender, bookingRequestId: source.requestId };
}
function selectedRuntime(f, source, extra = {}) {
  return createAppointmentReminders({ ...f.options, testScope: selectedScope(source), ...extra });
}
function confirmationJob(f, source) {
  return f.jobs(source.requestId).findLast(job => job.kind === "confirmation");
}
function snapshot(f, source) {
  return {
    row: f.row(source.requestId), jobs: f.jobs(source.requestId),
    operations: f.db.prepare("SELECT * FROM attendance_operations WHERE booking_request_id=? ORDER BY operation_id").all(source.requestId),
  };
}

test("test scope requires an exact registered identity and tracked booking in a test business", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book();
  const valid = selectedScope(source);
  for (const testScope of [null, {}, [], { businessId: valid.businessId },
    { ...valid, sender: `+${valid.sender}` }, { ...valid, sender: "invalid" },
    { ...valid, sender: "3312345678" }, { ...valid, sender: f.other },
    { ...valid, businessId: "synthetic-b" }, { ...valid, bookingRequestId: "missing" },
    { ...valid, businessId: `${valid.businessId} ` }]) {
    assert.throws(() => createAppointmentReminders({ ...f.options, testScope }), /Reminder test scope/);
  }
  f.db.prepare("UPDATE businesses SET status='active' WHERE business_id=?").run(source.businessId);
  assert.throws(() => selectedRuntime(f, source), /test business/);
  f.db.prepare("UPDATE businesses SET status='test' WHERE business_id=?").run(source.businessId);
  f.db.prepare("UPDATE business_customers SET whatsapp_id='9999999999' WHERE business_id=? AND whatsapp_id=?").run(source.businessId, f.sender);
  assert.throws(() => selectedRuntime(f, source), /registered customer/);
  assert.equal(f.sent.length, 0);
});

test("scoped polling leaves other recipients, bookings, businesses and expired jobs unchanged", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const selected = await f.book({ start: "2026-11-04T10:00:00-06:00" });
  const others = [
    await f.book({ start: "2026-11-04T11:00:00-06:00" }),
    await f.book({ start: "2026-11-04T12:00:00-06:00", sender: f.other }),
    await f.book({ start: "2026-11-04T10:00:00-06:00", businessId: "synthetic-b" }),
  ];
  f.setNow(confirmationJob(f, selected).due_at);
  for (const source of others) {
    f.db.prepare("UPDATE reminder_jobs SET due_at=?,expires_at=? WHERE booking_request_id=?")
      .run(f.now() - 60000, f.now() - 1, source.requestId);
    f.db.prepare("UPDATE appointment_attendance SET attendance='RESCHEDULE_REQUESTED',reschedule_until=?,next_check_at=0 WHERE booking_request_id=?")
      .run(f.now() - 1, source.requestId);
  }
  const external = others[2], operationId = randomUUID();
  f.db.prepare("INSERT INTO attendance_operations VALUES (?,?,1,'uncertain','Synthetic — Confirmada',1,?,NULL)")
    .run(operationId, external.requestId, f.now());
  const event = f.events.get(`calendar-${external.businessId}:${external.eventId}`);
  Object.assign(event.extendedProperties.private, {
    nukmirisAttendanceStatus: "CONFIRMED", nukmirisAttendanceScheduleVersion: "1", nukmirisAttendanceOperationId: operationId,
  });
  f.db.prepare("INSERT INTO calendar_booking_locks VALUES (?,?,?)").run(`calendar-${external.businessId}`, external.requestId, new Date(f.now()).toISOString());
  const before = others.map(source => snapshot(f, source));
  const testScope = selectedScope(selected);
  const runtime = createAppointmentReminders({ ...f.options, testScope });
  testScope.sender = f.other; // The constructor retains its validated copy.
  f.reads.length = 0;
  await runtime.tick(); await runtime.tick();
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].booking_request_id, selected.requestId);
  assert.equal(confirmationJob(f, selected).attempts, 1);
  assert.deepEqual(others.map(source => snapshot(f, source)), before);
  assert(f.reads.every(read => read.eventId === selected.eventId && read.calendarId === `calendar-${selected.businessId}`));
  assert(f.db.prepare("SELECT 1 FROM calendar_booking_locks WHERE calendar_id=?").get(`calendar-${external.businessId}`));
  assert(runtime.hasFutureReminders(selected.requestId));
  for (const source of others) assert.equal(runtime.hasFutureReminders(source.requestId), false);
});

test("scoped readiness checks only the selected business without enabling other modes or permissions", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), checked = [];
  const verifyTemplate = async (settings, kind) => checked.push([settings.business_id, kind]);
  await selectedRuntime(f, source, { verifyTemplate }).verifyReady();
  assert.deepEqual(checked, ["seven_day", "confirmation", "followup", "final"].map(kind => [source.businessId, kind]));
  checked.length = 0;
  await selectedRuntime(f, source, { mode: "dry-run", verifyTemplate }).verifyReady();
  await selectedRuntime(f, source, { mode: "off", verifyTemplate }).verifyReady();
  assert.equal(checked.length, 0);
  f.db.prepare("DELETE FROM reminder_permission_events WHERE business_id=? AND whatsapp_id=?").run(source.businessId, source.sender);
  f.setNow(confirmationJob(f, source).due_at);
  await selectedRuntime(f, source).tick();
  assert.equal(f.sent.length, 0);
  assert.equal(confirmationJob(f, source).last_error, "customer_permission_missing");
});

test("off and dry-run retain their existing side-effect limits inside a test scope", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), other = await f.book({ start: "2026-11-05T18:00:00-06:00" });
  f.setNow(confirmationJob(f, source).due_at);
  const before = snapshot(f, other), selectedBefore = snapshot(f, source);
  await selectedRuntime(f, source, { mode: "off" }).tick();
  assert.deepEqual(snapshot(f, source), selectedBefore);
  assert.deepEqual(snapshot(f, other), before);
  const dry = selectedRuntime(f, source, { mode: "dry-run", verifyTemplate: async () => { throw new Error("No approval calls in dry-run"); } });
  await dry.tick(); await dry.tick();
  assert.equal(f.dryRuns.length, 1);
  assert.equal(confirmationJob(f, source).state, "dry_run");
  assert.equal(f.sent.length, 0); assert.equal(f.patches.length, 0);
  assert.deepEqual(snapshot(f, other), before);
  assert.equal(dry.hasFutureReminders(source.requestId), false);
});

test("test actions cannot confirm or open rescheduling for another booking, recipient or business", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const selected = await f.book({ start: "2026-11-04T10:00:00-06:00" });
  const others = [
    await f.book({ start: "2026-11-04T11:00:00-06:00" }),
    await f.book({ start: "2026-11-04T12:00:00-06:00", sender: f.other }),
    await f.book({ start: "2026-11-04T10:00:00-06:00", businessId: "synthetic-b" }),
  ];
  for (const source of [selected, ...others]) await f.at(source.requestId, "confirmation");
  const runtime = selectedRuntime(f, selected);
  for (const source of others) {
    const token = f.row(source.requestId).action_token;
    assert.equal((await runtime.confirm(source, token)).status, "stale");
    assert.equal((await runtime.requestReschedule(source, token)).status, "stale");
    assert.equal(runtime.textTarget(source, { replyToId: confirmationJob(f, source).meta_message_id }), null);
    assert.equal(f.row(source.requestId).attendance, "PENDING");
  }
  assert.equal(runtime.textTarget(selected), null, "another outstanding booking remains ambiguous despite the test selector");
  assert.equal(f.patches.length, 0);
  assert.equal((await runtime.confirm(selected, f.row(selected.requestId).action_token)).status, "confirmed");
  assert.equal(f.patches.length, 1);
});

test("selected cancellation can restart safely and never sends or accepts old confirmation actions", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), runtime = selectedRuntime(f, source), token = f.row(source.requestId).action_token;
  const appointment = await f.management.readAppointment(source);
  const change = await f.management.createIntent({ ...source, expectedEtag: appointment.etag, kind: "cancel" });
  await f.management.confirm({ ...source, requestId: change.requestId });
  const restarted = selectedRuntime(f, source);
  f.setNow(f.jobs(source.requestId).findLast(job => job.kind === "final").due_at);
  await restarted.tick(); await runtime.tick();
  assert.equal(f.sent.length, 0);
  assert.equal((await restarted.confirm(source, token)).status, "stale");
  assert.equal((await restarted.requestReschedule(source, token)).status, "stale");
  assert.equal(restarted.hasFutureReminders(source.requestId), false);
});

test("selected rescheduling keeps its booking scope, replaces the schedule and rejects old actions", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), runtime = selectedRuntime(f, source), oldToken = f.row(source.requestId).action_token;
  const appointment = await f.management.readAppointment(source);
  const change = await f.management.createIntent({ ...source, expectedEtag: appointment.etag, kind: "reschedule",
    slot: { start: "2026-11-06T17:00:00-06:00", end: "2026-11-06T18:00:00-06:00" } });
  await f.management.confirm({ ...source, requestId: change.requestId });
  assert.equal(f.row(source.requestId).schedule_version, 2);
  f.setNow(confirmationJob(f, source).due_at);
  await runtime.tick(); await runtime.tick();
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].schedule_version, 2);
  assert.equal((await runtime.confirm(source, oldToken)).status, "stale");
  assert.equal((await runtime.requestReschedule(source, f.row(source.requestId).action_token)).status, "reschedule");
});

test("ordinary booking hooks still enroll other bookings while a test scope suppresses their reminder promise", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), runtime = selectedRuntime(f, source);
  const booking = createBookingService({ db: f.db, availability: f.availability, enabled: true, getClient: () => f.api,
    now: () => DateTime.fromMillis(f.now()), verifyAuthorization: async () => {}, onCommitted: runtime.committed });
  const intent = booking.createIntent({ businessId: source.businessId, sender: f.other, calendarId: `calendar-${source.businessId}`,
    slot: { start: "2026-11-05T18:00:00-06:00", end: "2026-11-05T19:00:00-06:00" } });
  assert.equal((await booking.confirm({ businessId: source.businessId, sender: f.other, requestId: intent.requestId })).status, "confirmed");
  assert.equal(f.jobs(intent.requestId).length, 4);
  assert.equal(runtime.hasFutureReminders(intent.requestId), false);
});

test("promoting the selected business out of test status holds jobs and actions unchanged", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), runtime = selectedRuntime(f, source);
  f.setNow(confirmationJob(f, source).due_at);
  f.db.prepare("UPDATE businesses SET status='active' WHERE business_id=?").run(source.businessId);
  const before = snapshot(f, source);
  await runtime.tick();
  assert.deepEqual(snapshot(f, source), before);
  assert.equal(runtime.hasFutureReminders(source.requestId), false);
  assert.equal((await runtime.confirm(source, f.row(source.requestId).action_token)).status, "stale");
  assert.equal(f.sent.length, 0);
});

test("an adapter exception after possible acceptance remains uncertain and never retries", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); let calls = 0;
  const runtime = createAppointmentReminders({ ...f.options, send: async () => { calls++; throw new Error("Synthetic lost response after acceptance"); } });
  f.setNow(confirmationJob(f, source).due_at);
  await runtime.tick(); f.setNow(f.now() + 60000); await runtime.tick(); runtime.recover(); await runtime.tick();
  assert.equal(calls, 1);
  assert.equal(confirmationJob(f, source).state, "uncertain");
  assert.equal(confirmationJob(f, source).last_error, "reminder_send_unknown");
});

test("failure to persist an accepted result cannot turn it into a retryable reminder", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book();
  f.db.exec(`CREATE TRIGGER synthetic_fail_accepted BEFORE UPDATE ON reminder_jobs
    WHEN NEW.state='accepted' BEGIN SELECT RAISE(ABORT,'Synthetic accepted-result failure'); END;`);
  f.setNow(confirmationJob(f, source).due_at);
  await f.reminders.tick();
  assert.equal(confirmationJob(f, source).state, "uncertain");
  assert.equal(confirmationJob(f, source).last_error, "reminder_result_not_saved");
  assert.equal(confirmationJob(f, source).meta_message_id, "synthetic-reminder-1");
  assert.equal(f.db.prepare("SELECT meta_message_id FROM reminder_attempts WHERE job_id=?").get(confirmationJob(f, source).job_id).meta_message_id, "synthetic-reminder-1");
  f.db.exec("DROP TRIGGER synthetic_fail_accepted");
  f.setNow(f.now() + 60000); await f.reminders.tick(); f.reminders.recover(); await f.reminders.tick();
  assert.equal(f.sent.length, 1);
  assert.equal(confirmationJob(f, source).attempts, 1);
});

test("a database unable to persist any send result leaves sending for conservative restart recovery", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book();
  f.db.exec(`CREATE TRIGGER synthetic_fail_send_result BEFORE UPDATE ON reminder_jobs
    WHEN OLD.state='sending' BEGIN SELECT RAISE(ABORT,'Synthetic result storage failure'); END;`);
  f.setNow(confirmationJob(f, source).due_at);
  await assert.rejects(f.reminders.tick(), /retain this work for recovery/);
  assert.equal(confirmationJob(f, source).state, "sending");
  f.db.exec("DROP TRIGGER synthetic_fail_send_result");
  f.reminders.recover(); await f.reminders.tick();
  assert.equal(confirmationJob(f, source).state, "uncertain");
  assert.equal(f.sent.length, 1);
});

test("signed delivery proof wins over a subsequent send exception", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); let calls = 0, runtime;
  runtime = createAppointmentReminders({ ...f.options, send: async job => {
    calls++;
    runtime.receipt({ business_id: source.businessId, phone_number_id: "phone-synthetic-a" }, {
      biz_opaque_callback_data: `nukmiris-reminder:${job.job_id}`, id: "synthetic-proof-before-error", status: "delivered", recipient_id: "523312345678",
    });
    throw new Error("Synthetic HTTP failure after signed delivery");
  } });
  f.setNow(confirmationJob(f, source).due_at);
  await runtime.tick(); await runtime.tick();
  assert.equal(calls, 1);
  assert.equal(confirmationJob(f, source).state, "accepted");
  assert.equal(confirmationJob(f, source).meta_status, "delivered");
  assert.equal(confirmationJob(f, source).meta_message_id, "synthetic-proof-before-error");
});
