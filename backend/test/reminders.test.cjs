"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DateTime } = require("luxon");
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { reminderFixture } = require("./helpers/reminder-fixture.cjs");
const { reminderTimes, HOUR, GRACE_MS } = require("../lib/reminder-schedule");
const { createAppointmentReminders } = require("../lib/appointment-reminders");

for (const [hours, kinds] of [
  [169, ["seven_day", "confirmation", "followup", "final"]],
  [168, ["confirmation", "followup", "final"]], [72, ["confirmation", "followup", "final"]],
  [24, ["final"]], [12, ["final"]], [2, []], [1, []],
]) test(`booking ${hours} hours ahead schedules only applicable reminders`, () => {
  const result = reminderTimes(hours * HOUR, 0);
  assert.deepEqual(result.map(job => job.kind), kinds);
  assert(result.every(job => job.due > 0 && job.expires === job.due + GRACE_MS));
});

test("reminder intervals use exact timestamps across DST and business timezone differences", () => {
  for (const zone of ["America/New_York", "Europe/Amsterdam", "America/Mexico_City", "Asia/Tokyo"]) {
    const start = DateTime.fromISO("2026-11-04T10:00", { zone }).toMillis();
    const jobs = reminderTimes(start, start - 300 * HOUR);
    assert.deepEqual(jobs.map(job => (start - job.due) / HOUR), [168, 24, 22, 2]);
    assert.equal(DateTime.fromMillis(start).setZone(zone).hour, 10);
  }
});

test("booking and its durable schedule commit together; old appointments are excluded", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const old = await f.book();
  assert.equal(f.jobs(old.requestId).length, 4);
  assert.equal(f.row(old.requestId).attendance, "PENDING");
  assert.equal(f.sent.length, 0);
  f.db.prepare("UPDATE reminder_business_settings SET activated_at=?").run(f.now() + 1);
  const excluded = await f.book({ start: "2026-11-05T18:00:00-06:00" });
  assert.equal(f.row(excluded.requestId), undefined);
  assert.equal(f.jobs(excluded.requestId).length, 0);
});

test("off mode and unconfigured businesses do not create reminder work", async t => {
  const f = reminderFixture({ mode: "off" }); t.after(() => f.db.close());
  const source = await f.book();
  assert.equal(f.row(source.requestId), undefined);
  await f.reminders.tick();
  assert.equal(f.sent.length, 0);
  assert.equal((await f.reminders.confirm(source, "missing")).status, "disabled");
});

test("new metadata rolls back with a failed local booking transaction and is recovered once", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  f.db.exec(`CREATE TRIGGER synthetic_reminder_failure BEFORE INSERT ON reminder_jobs BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;`);
  const slot = { start: "2026-11-04T18:00:00-06:00", end: "2026-11-04T19:00:00-06:00" };
  const intent = f.booking.createIntent({ businessId: "synthetic-a", sender: f.sender, calendarId: "calendar-synthetic-a", slot });
  const context = { businessId: "synthetic-a", sender: f.sender, requestId: intent.requestId };
  assert.equal((await f.booking.confirm(context)).status, "uncertain");
  assert.equal(f.inserts.length, 1);
  assert.equal(f.row(intent.requestId), undefined);
  f.db.exec("DROP TRIGGER synthetic_reminder_failure");
  assert.equal((await f.booking.reconcile(context)).status, "confirmed");
  assert.equal(f.jobs(intent.requestId).length, 4);
  assert.equal(f.inserts.length, 1);
});

test("scheduled templates are accepted once; final reminder needs no attendance response", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book();
  for (const kind of ["seven_day", "confirmation", "followup", "final"]) {
    await f.at(source.requestId, kind);
    if (kind === "confirmation") {
      const job = f.jobs(source.requestId).find(j => j.kind === "confirmation");
      f.reminders.receipt({ business_id: source.businessId, phone_number_id: "phone-synthetic-a" }, {
        biz_opaque_callback_data: `nukmiris-reminder:${job.job_id}`, id: job.meta_message_id, status: "delivered", recipient_id: "523312345678",
      });
    }
    await f.reminders.tick();
  }
  assert.equal(f.sent.length, 4);
  assert.equal(f.sent[1].payload.template.components.filter(c => c.type === "button").length, 2);
  assert.equal(f.sent[3].payload.template.components.filter(c => c.type === "button").length, 0);
  assert(f.sent.every(message => message.payload.type === "template" && message.payload.to === "523312345678"));
  assert(f.jobs(source.requestId).every(job => job.state === "accepted"));
  assert.equal(f.row(source.requestId).attendance, "PENDING");
  assert.equal(f.deletes.length, 0);
});

test("attendance confirmation preserves event content, adds its suffix once, and keeps final reminder", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book();
  const key = `calendar-synthetic-a:${source.eventId}`, event = f.events.get(key);
  event.summary = "Cliente Sintético — Cita — Diseño especial";
  event.attendees = [{ email: "synthetic@example.invalid" }];
  event.extendedProperties.private.unrelated = "preserved";
  const original = structuredClone(event);
  await f.at(source.requestId, "confirmation");
  const token = f.row(source.requestId).action_token;
  assert.equal((await f.reminders.confirm(source, token)).status, "confirmed");
  assert.equal((await f.reminders.confirm(source, token)).status, "confirmed");
  const updated = f.events.get(key);
  assert.equal(updated.summary, original.summary + " — Confirmada");
  for (const field of ["description", "start", "end", "attendees", "id"]) assert.deepEqual(updated[field], original[field]);
  assert.equal(updated.extendedProperties.private.unrelated, "preserved");
  assert.equal(updated.extendedProperties.private.nukmirisCustomerId, f.sender);
  assert.equal(f.patches.length, 1);
  assert.equal(f.row(source.requestId).attendance, "CONFIRMED");
  await f.at(source.requestId, "followup");
  assert.equal(f.sent.length, 1);
  await f.at(source.requestId, "final");
  assert.equal(f.sent.length, 2);
});

test("an existing meaningful Confirmada suffix is not duplicated or later stripped", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book();
  const key = `calendar-synthetic-a:${source.eventId}`;
  f.events.get(key).summary = "Nombre — Cita - Confirmada";
  await f.at(source.requestId, "confirmation");
  await f.reminders.confirm(source, f.row(source.requestId).action_token);
  assert.equal(f.events.get(key).summary, "Nombre — Cita - Confirmada");
  assert.equal(f.events.get(key).extendedProperties.private.nukmirisAttendanceManagedSuffix, "false");
});

test("concurrent confirmation taps cannot perform two Calendar mutations", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  const results = await Promise.all([f.reminders.confirm(source, f.row(source.requestId).action_token),
    f.reminders.confirm(source, f.row(source.requestId).action_token)]);
  assert(results.some(result => result.status === "confirmed"));
  assert.equal(f.patches.length, 1);
});

test("failed confirmation never reports success and a definitive rejection can be retried", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  const token = f.row(source.requestId).action_token;
  f.controls.patchError = 403;
  assert.equal((await f.reminders.confirm(source, token)).status, "failed");
  assert.equal(f.row(source.requestId).attendance, "PENDING");
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 0);
  delete f.controls.patchError;
  assert.equal((await f.reminders.confirm(source, token)).status, "confirmed");
});

test("a lost Calendar update response is verified using the same persisted operation", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  f.controls.afterPatchError = 503;
  assert.equal((await f.reminders.confirm(source, f.row(source.requestId).action_token)).status, "confirmed");
  assert.equal(f.patches.length, 1);
});

test("an unknown Calendar write stays protected and is not blindly repeated", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  f.controls.patchError = 503;
  const token = f.row(source.requestId).action_token;
  assert.equal((await f.reminders.confirm(source, token)).status, "uncertain");
  delete f.controls.patchError;
  assert.equal((await f.reminders.confirm(source, token)).status, "uncertain");
  assert.equal(f.patches.length, 1);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 1);
});

test("follow-up requires a dispatched request and is suppressed after known delivery failure", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book();
  f.controls.templateError = true;
  await f.at(source.requestId, "confirmation");
  delete f.controls.templateError;
  await f.at(source.requestId, "followup");
  assert.equal(f.sent.length, 0);
  assert.match(f.jobs(source.requestId).find(j => j.kind === "followup").last_error, /not_dispatched/);
  const second = await f.book({ start: "2026-11-05T18:00:00-06:00" });
  await f.at(second.requestId, "confirmation");
  const job = f.jobs(second.requestId).find(j => j.kind === "confirmation");
  f.reminders.receipt({ business_id: "synthetic-a", phone_number_id: "phone-synthetic-a" }, {
    biz_opaque_callback_data: `nukmiris-reminder:${job.job_id}`, id: job.meta_message_id,
    recipient_id: "523312345678", status: "failed",
  });
  await f.at(second.requestId, "followup");
  assert.equal(f.sent.filter(s => s.booking_request_id === second.requestId).length, 1);
});

test("rescheduling targets the selected appointment, resets attendance, and invalidates old jobs/buttons", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), other = await f.book({ start: "2026-11-05T18:00:00-06:00" });
  await f.at(source.requestId, "confirmation");
  const token = f.row(source.requestId).action_token;
  await f.reminders.confirm(source, token);
  const original = structuredClone(f.events.get(`calendar-synthetic-a:${source.eventId}`));
  const requested = await f.reminders.requestReschedule(source, token);
  assert.equal(requested.appointment.bookingRequestId, source.requestId);
  assert.equal(f.row(source.requestId).attendance, "RESCHEDULE_REQUESTED");
  assert.equal(f.deletes.length, 0);
  const intent = await f.management.createIntent({ ...source, expectedEtag: requested.appointment.etag, kind: "reschedule",
    slot: { start: "2026-11-06T17:00:00-06:00", end: "2026-11-06T18:00:00-06:00" } });
  assert.equal((await f.management.confirm({ requestId: intent.requestId, businessId: source.businessId, sender: source.sender })).status, "applied");
  const moved = f.events.get(`calendar-synthetic-a:${source.eventId}`);
  assert.equal(moved.summary, "Cliente Sintético — Cita");
  assert.equal(moved.description, original.description);
  assert.equal(moved.id, original.id);
  assert.equal(moved.extendedProperties.private.nukmirisAttendanceStatus, "PENDING");
  assert.equal(f.row(source.requestId).attendance, "PENDING");
  assert.equal(f.row(source.requestId).schedule_version, 2);
  assert(f.jobs(source.requestId).filter(j => j.schedule_version === 1).every(j => j.state !== "pending"));
  assert.equal((await f.reminders.confirm(source, token)).status, "stale");
  assert.equal(f.row(other.requestId).schedule_version, 1);
});

test("abandoned rescheduling preserves the original appointment and final reminder", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  await f.reminders.requestReschedule(source, f.row(source.requestId).action_token);
  await f.at(source.requestId, "followup");
  assert.equal(f.row(source.requestId).attendance, "PENDING");
  assert.equal(f.sent.length, 1);
  await f.at(source.requestId, "final");
  assert.equal(f.sent.length, 2);
  assert.equal(f.patches.length, 0); assert.equal(f.deletes.length, 0);
});

test("cancellation prevents reminders and invalidates confirmation actions", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  const token = f.row(source.requestId).action_token;
  const original = await f.management.readAppointment(source);
  const intent = await f.management.createIntent({ ...source, expectedEtag: original.etag, kind: "cancel" });
  await f.management.confirm({ businessId: source.businessId, sender: source.sender, requestId: intent.requestId });
  assert.equal(f.row(source.requestId).attendance, "CANCELLED");
  assert.equal((await f.reminders.confirm(source, token)).status, "stale");
  await f.at(source.requestId, "final");
  assert.equal(f.sent.length, 1);
});

test("business/customer isolation and multiple appointment ambiguity prevent wrong confirmations", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const a = await f.book({ start: "2026-11-04T10:00:00-06:00" }),
    b = await f.book({ businessId: "synthetic-b", start: "2026-11-04T10:00:00-06:00" });
  await f.at(a.requestId, "confirmation");
  assert.equal((await f.reminders.confirm({ ...a, businessId: b.businessId }, f.row(a.requestId).action_token)).status, "stale");
  assert.equal((await f.reminders.confirm({ ...a, sender: f.other }, f.row(a.requestId).action_token)).status, "stale");
  assert.equal(f.patches.length, 0);
  assert.equal(f.reminders.report("synthetic-a").length, 1);
  assert.equal(f.reminders.report("synthetic-b")[0].customer_name, "Otra Empresa");
  const other = await f.book({ start: "2026-11-04T11:00:00-06:00" });
  await f.at(other.requestId, "confirmation");
  assert.equal(f.reminders.textTarget(a), null);
  assert.equal((await f.reminders.confirm(a, f.row(a.requestId).action_token)).status, "confirmed");
  assert.equal(f.row(other.requestId).attendance, "PENDING");
  assert.equal(f.row(b.requestId).attendance, "PENDING");
});

test("manual Calendar time changes regenerate unconfirmed schedules and reject old actions", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  const token = f.row(source.requestId).action_token;
  const event = f.events.get(`calendar-synthetic-a:${source.eventId}`);
  event.start.dateTime = "2026-11-03T17:00:00-06:00"; event.end.dateTime = "2026-11-03T18:00:00-06:00";
  f.setNow(f.now() + 300001); await f.reminders.tick();
  assert.equal(f.row(source.requestId).schedule_version, 2);
  assert.equal(f.row(source.requestId).start_iso, event.start.dateTime);
  assert.equal((await f.reminders.confirm(source, token)).status, "stale");
  assert(f.jobs(source.requestId).filter(j => j.schedule_version === 2).every(j => j.due_at > f.now()));
});

test("manual edits to confirmed times fail closed for review rather than retain stale confirmation", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  await f.reminders.confirm(source, f.row(source.requestId).action_token);
  f.events.get(`calendar-synthetic-a:${source.eventId}`).start.dateTime = "2026-11-05T17:00:00-06:00";
  f.events.get(`calendar-synthetic-a:${source.eventId}`).end.dateTime = "2026-11-05T18:00:00-06:00";
  f.setNow(f.now() + 300001); await f.reminders.tick();
  assert.equal(f.row(source.requestId).lifecycle, "REVIEW");
  assert.match(f.row(source.requestId).last_error, /manually_moved/);
});

test("manual deletion, lost ownership and failed Calendar checks never produce misleading reminders", async t => {
  for (const scenario of ["deleted", "foreign", "read_failure"]) {
    const f = reminderFixture(); t.after(() => f.db.close());
    const source = await f.book();
    if (scenario === "deleted") f.events.delete(`calendar-synthetic-a:${source.eventId}`);
    if (scenario === "foreign") f.events.get(`calendar-synthetic-a:${source.eventId}`).extendedProperties.private.nukmirisBusinessId = "foreign";
    if (scenario === "read_failure") f.controls.afterGet = () => { throw f.error(503); };
    await f.at(source.requestId, "confirmation");
    assert.equal(f.sent.length, 0, scenario);
  }
});

test("late reminders have a 15-minute limit and are never replayed after expiry", async t => {
  for (const [delay, expected] of [[5000, 1], [GRACE_MS, 1], [GRACE_MS + 1, 0]]) {
    const f = reminderFixture(); t.after(() => f.db.close());
    const source = await f.book();
    f.setNow(f.jobs(source.requestId).find(j => j.kind === "confirmation").due_at + delay);
    await f.reminders.tick(); await f.reminders.tick();
    assert.equal(f.sent.length, expected, String(delay));
  }
});

test("known transient rejections use bounded backoff; uncertain sends are not blindly retried", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); f.controls.sendResult = { state: "pending", error: "meta_http_503" };
  await f.at(source.requestId, "confirmation");
  for (const minutes of [1, 2, 4]) { f.setNow(f.now() + minutes * 60000); await f.reminders.tick(); }
  const job = f.jobs(source.requestId).find(j => j.kind === "confirmation");
  assert.equal(job.attempts, 4); assert.equal(job.state, "failed");
  await f.reminders.tick(); assert.equal(f.sent.length, 4);
  const other = await f.book({ start: "2026-11-05T18:00:00-06:00" });
  f.controls.sendResult = { state: "uncertain", error: "meta_transport_unknown" };
  await f.at(other.requestId, "confirmation");
  f.reminders.recover(); await f.reminders.tick();
  assert.equal(f.jobs(other.requestId).find(j => j.kind === "confirmation").attempts, 1);
});

test("missing templates block sending without a free-form fallback", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); f.controls.templateError = true;
  await f.at(source.requestId, "confirmation");
  assert.equal(f.sent.length, 0);
  assert.match(f.jobs(source.requestId).find(j => j.kind === "confirmation").last_error, /template_unapproved/);
});

test("dry-run records a preview without WhatsApp sends, template reads, or Calendar mutations", async t => {
  const f = reminderFixture({ mode: "dry-run" }); t.after(() => f.db.close());
  const source = await f.book(); f.controls.templateError = true;
  await f.at(source.requestId, "confirmation"); await f.at(source.requestId, "followup");
  assert.equal(f.dryRuns.length, 2); assert.equal(f.sent.length, 0); assert.equal(f.patches.length, 0);
  assert.equal(f.reminders.hasFutureReminders(source.requestId), false);
  assert.equal((await f.reminders.confirm(source, f.row(source.requestId).action_token)).status, "disabled");
});

test("persistent jobs survive reopening and concurrent workers claim a job only once", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-reminder-jobs-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "synthetic.sqlite"), f = reminderFixture({ filename });
  const source = await f.book();
  f.setNow(f.jobs(source.requestId).find(j => j.kind === "confirmation").due_at);
  const second = new DatabaseSync(filename); t.after(() => { if (second.isOpen) second.close(); f.db.close(); });
  const worker2 = createAppointmentReminders({ ...f.options, db: second });
  await Promise.all([f.reminders.tick(), worker2.tick()]);
  assert.equal(f.sent.length, 1);
  const job = f.jobs(source.requestId).find(j => j.kind === "confirmation");
  assert.equal(job.attempts, 1);
  second.close();
  const reopened = new DatabaseSync(filename);
  assert.equal(reopened.prepare("SELECT state FROM reminder_jobs WHERE job_id=?").get(job.job_id).state, "accepted");
  reopened.close();
});

test("signed-status receipt correlation isolates businesses and cannot downgrade delivered/read", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  const job = f.jobs(source.requestId).find(j => j.kind === "confirmation");
  const status = { biz_opaque_callback_data: `nukmiris-reminder:${job.job_id}`, id: job.meta_message_id, recipient_id: "523312345678", status: "read" };
  f.reminders.receipt({ business_id: "synthetic-b", phone_number_id: "phone-synthetic-b" }, status);
  assert.equal(f.jobs(source.requestId).find(j => j.kind === "confirmation").meta_status, null);
  const business = { business_id: "synthetic-a", phone_number_id: "phone-synthetic-a" };
  f.reminders.receipt(business, status);
  f.reminders.receipt(business, { ...status, status: "failed" });
  assert.equal(f.jobs(source.requestId).find(j => j.kind === "confirmation").meta_status, "read");
});
