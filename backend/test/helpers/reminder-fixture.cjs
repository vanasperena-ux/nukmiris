"use strict";

const { DateTime } = require("luxon");
const { fixture } = require("./management-fixture.cjs");
const { prepareReminderSchema, DEFAULT_INTERVALS } = require("../../lib/reminder-schedule");
const { DEFAULT_TEMPLATES } = require("../../lib/reminder-templates");
const { createCalendarAvailability } = require("../../lib/google-calendar");
const { createBookingService } = require("../../lib/booking");
const { createAppointmentManagement } = require("../../lib/appointment-management");
const { createAppointmentReminders } = require("../../lib/appointment-reminders");
const { recordReminderPermission } = require("../../lib/reminder-permissions");
const SENDER = "5213312345678", OTHER = "5213398765432";

function reminderFixture({ filename = ":memory:", mode = "live" } = {}) {
  const f = fixture(filename), sent = [], dryRuns = [];
  let clock = DateTime.fromISO("2026-10-26T09:00:00-06:00").toMillis();
  f.db.prepare("UPDATE business_customers SET whatsapp_id=? WHERE whatsapp_id='synthetic-one'").run(SENDER);
  f.db.prepare("UPDATE business_customers SET whatsapp_id=? WHERE whatsapp_id='synthetic-two'").run(OTHER);
  f.db.prepare("UPDATE business_customers SET full_name='Otra Empresa' WHERE business_id='synthetic-b'").run();
  prepareReminderSchema(f.db);
  for (const business of ["synthetic-a", "synthetic-b"]) {
    f.db.prepare(`INSERT INTO reminder_business_settings
      (business_id,activated_at,waba_id,language,templates_json,intervals_json) VALUES (?,?,?,'es_MX',?,?)`)
      .run(business, clock - 1, business === "synthetic-a" ? "123456" : "654321", JSON.stringify(DEFAULT_TEMPLATES), JSON.stringify(DEFAULT_INTERVALS));
  }
  function grant(businessId = "synthetic-a", sender = SENDER, occurredAt = clock - 1, evidence = `synthetic-opt-in-${businessId}-${sender}-${occurredAt}`) {
    return recordReminderPermission(f.db, { businessId, sender, decision: "granted", occurredAt,
      source: "synthetic_external_opt_in", wording: `Quiero recibir recordatorios de mis citas de Business ${businessId} por WhatsApp.`,
      evidence, recordedBy: "synthetic-business-owner" }, clock);
  }
  for (const business of ["synthetic-a", "synthetic-b"]) for (const sender of [SENDER, OTHER]) grant(business, sender);
  const availability = createCalendarAvailability({ db: f.db, getClient: () => f.api, now: () => DateTime.fromMillis(clock) });
  const options = { db: f.db, availability, mode, now: () => clock, getClient: () => f.api,
    verifyTemplate: async () => { if (f.controls.templateError) throw new Error("reminder_template_unapproved_or_mismatched: synthetic"); },
    send: async row => { sent.push(structuredClone(row)); return f.controls.sendResult || { state: "accepted", metaMessageId: `synthetic-reminder-${sent.length}` }; },
    onDryRun: info => dryRuns.push(info),
  };
  const reminders = createAppointmentReminders(options);
  const booking = createBookingService({ db: f.db, availability, enabled: true, getClient: () => f.api,
    now: () => DateTime.fromMillis(clock), verifyAuthorization: async () => {}, onCommitted: reminders.committed });
  const management = createAppointmentManagement({ db: f.db, availability, enabled: true, getClient: () => f.api,
    now: () => DateTime.fromMillis(clock), verifyAuthorization: async () => {},
    onCommitted: reminders.committed, rescheduleFields: reminders.rescheduleFields });
  const scope = (id, businessId = "synthetic-a", sender = SENDER) => ({ bookingRequestId: id, businessId, sender });
  const row = id => f.db.prepare("SELECT * FROM appointment_attendance WHERE booking_request_id=?").get(id);
  const jobs = id => f.db.prepare("SELECT * FROM reminder_jobs WHERE booking_request_id=? ORDER BY schedule_version,due_at").all(id);
  async function book({ start = "2026-11-04T18:00:00-06:00", businessId = "synthetic-a", sender = SENDER } = {}) {
    const slot = { start, end: DateTime.fromISO(start, { setZone: true }).plus({ hours: 1 }).toISO() };
    const intent = booking.createIntent({ businessId, sender, calendarId: `calendar-${businessId}`, slot });
    const result = await booking.confirm({ businessId, sender, requestId: intent.requestId });
    if (result.status !== "confirmed") throw new Error(`Fixture booking failed: ${result.status}`);
    return { ...scope(intent.requestId, businessId, sender), eventId: result.eventId, requestId: intent.requestId };
  }
  function setNow(value) { clock = typeof value === "number" ? value : DateTime.fromISO(value).toMillis(); }
  async function at(id, kind) {
    setNow(jobs(id).findLast(job => job.kind === kind).due_at);
    await reminders.tick();
  }
  return { ...f, reminders, options, availability, booking, management, book, scope, row, jobs, at, setNow,
    now: () => clock, sent, dryRuns, sender: SENDER, other: OTHER, grant };
}
module.exports = { reminderFixture, SENDER, OTHER };
