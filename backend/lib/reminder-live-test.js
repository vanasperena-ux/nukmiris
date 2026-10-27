"use strict";

const os = require("node:os");
const { GRACE_MS, HOUR } = require("./reminder-schedule");
const { reminderPermission } = require("./reminder-permissions");

const TEST_ENV = Object.freeze({ businessId: "NUKMIRIS_REMINDER_TEST_BUSINESS_ID",
  sender: "NUKMIRIS_REMINDER_TEST_RECIPIENT", bookingRequestId: "NUKMIRIS_REMINDER_TEST_BOOKING_ID" });
const TEST_MINUTES = Object.freeze({ seven_day: 2, confirmation: 4, followup: 8, final: 12 });

function readReminderTestScope(env = process.env) {
  const scope = Object.fromEntries(Object.entries(TEST_ENV).map(([key, name]) => [key, env[name] || ""]));
  if (Object.values(scope).every(value => !value)) return null;
  if (!scope.businessId.trim() || !scope.bookingRequestId.trim() || !/^[1-9]\d{7,14}$/.test(scope.sender) ||
      scope.businessId !== scope.businessId.trim() || scope.bookingRequestId !== scope.bookingRequestId.trim()) {
    throw new Error("Set all three NUKMIRIS_REMINDER_TEST_* values: business ID, exact WhatsApp sender ID (digits, no +), and booking request ID");
  }
  return scope;
}

function assertBackendStopped(db) {
  const worker = db.prepare("SELECT * FROM delivery_worker WHERE singleton=1").get();
  if (!worker) return;
  let alive = true;
  try { process.kill(worker.pid, 0); } catch (error) { alive = error.code !== "ESRCH"; }
  if (worker.host !== os.hostname() || alive) throw new Error("Stop the existing backend before applying a reminder live-test schedule");
}

function planReminderLiveTest(db, scope, now = Date.now()) {
  if (!scope || !scope.businessId || !scope.bookingRequestId || !/^[1-9]\d{7,14}$/.test(scope.sender || "") || !Number.isSafeInteger(now)) {
    throw new Error("Select the exact test business, WhatsApp sender ID and booking request ID");
  }
  const row = db.prepare(`SELECT a.*,b.status AS business_status,r.enabled,r.intervals_json,r.language,r.templates_json,
    w.phone_number_id AS current_phone,c.google_calendar_id AS current_calendar,q.state AS booking_state,
    q.business_id AS booking_business,q.customer_id AS booking_customer,q.sender_whatsapp_id AS booking_sender,q.calendar_id AS booking_calendar,
    q.event_id AS booking_event,u.customer_id AS current_customer
    FROM appointment_attendance a JOIN businesses b USING(business_id)
    JOIN reminder_business_settings r USING(business_id)
    JOIN business_whatsapp_connections w USING(business_id)
    JOIN business_calendar_connections c USING(business_id)
    JOIN booking_requests q ON q.request_id=a.booking_request_id
    JOIN business_customers u ON u.business_id=a.business_id AND u.whatsapp_id=a.sender
    WHERE a.business_id=? AND a.sender=? AND a.booking_request_id=?`)
    .get(scope.businessId, scope.sender, scope.bookingRequestId);
  if (!row || row.business_status !== "test") throw new Error("A matching appointment in an existing business with status=test is required; no business status was changed");
  if (row.lifecycle !== "ACTIVE" || row.attendance !== "PENDING" || row.booking_state !== "confirmed" || !row.enabled ||
      row.business_id !== row.booking_business || row.customer_id !== row.current_customer || row.customer_id !== row.booking_customer || row.sender !== row.booking_sender ||
      row.calendar_id !== row.current_calendar || row.calendar_id !== row.booking_calendar || row.event_id !== row.booking_event ||
      row.phone_number_id !== row.current_phone) throw new Error("The selected appointment/customer/calendar/channel is no longer eligible for a live test");
  if (!reminderPermission(db, scope.businessId, scope.sender, now).allowed) {
    throw new Error("Record genuine reminder permission for this scoped test recipient before planning live sends");
  }
  if (row.start_ms <= now + 168 * HOUR) throw new Error("Use a fresh test appointment more than seven days ahead so all four normal occurrences exist");
  if (db.prepare("SELECT 1 FROM calendar_booking_locks WHERE calendar_id=?").get(row.calendar_id)) {
    throw new Error("The Calendar has unresolved protected work; reconcile it before planning a test");
  }
  const jobs = db.prepare("SELECT * FROM reminder_jobs WHERE booking_request_id=? AND schedule_version=?")
    .all(row.booking_request_id, row.schedule_version);
  if (jobs.length !== 4 || Object.keys(TEST_MINUTES).some(kind => !jobs.some(job => job.kind === kind)) ||
      jobs.some(job => job.state !== "pending" || job.attempts !== 0 || job.accepted_at !== null || job.meta_message_id !== null ||
        job.meta_status !== null || db.prepare("SELECT 1 FROM reminder_attempts WHERE job_id=?").get(job.job_id))) {
    throw new Error("All four current occurrences must be pending and never attempted; consumed, dry-run, failed or uncertain jobs are never rearmed");
  }
  return { businessId: scope.businessId, recipient: scope.sender, bookingRequestId: scope.bookingRequestId,
    scheduleVersion: row.schedule_version, appointmentStart: row.start_iso, calendarId: row.calendar_id,
    language: row.language, templates: JSON.parse(row.templates_json), normalIntervals: JSON.parse(row.intervals_json),
    sendsPerformed: 0, calendarWritesPerformed: 0,
    requiredEnvironment: Object.fromEntries(Object.entries(TEST_ENV).map(([key, name]) => [name, scope[key]])),
    jobs: Object.entries(TEST_MINUTES).map(([kind, minutes]) => {
      const job = jobs.find(item => item.kind === kind), dueAt = now + minutes * 60000;
      return { jobId: job.job_id, kind, previousDueAt: job.due_at, dueAt, expiresAt: Math.min(dueAt + GRACE_MS, row.start_ms - 1),
        dueUtc: new Date(dueAt).toISOString() };
    }) };
}

function applyReminderLiveTest(db, scope, authorizedRecipient, now = Date.now()) {
  if (authorizedRecipient !== scope?.sender) throw new Error("--authorize-recipient must explicitly match the exact WhatsApp sender ID for this test");
  db.exec("BEGIN IMMEDIATE");
  try {
    assertBackendStopped(db);
    const plan = planReminderLiveTest(db, scope, now);
    for (const job of plan.jobs) {
      const result = db.prepare(`UPDATE reminder_jobs SET due_at=?,expires_at=?,next_attempt_at=0
        WHERE job_id=? AND state='pending' AND attempts=0 AND schedule_version=?`)
        .run(job.dueAt, job.expiresAt, job.jobId, plan.scheduleVersion);
      if (result.changes !== 1) throw new Error("The test occurrence changed; no live-test schedule was applied");
    }
    db.exec("COMMIT");
    return plan;
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

module.exports = { TEST_ENV, TEST_MINUTES, readReminderTestScope, assertBackendStopped,
  planReminderLiveTest, applyReminderLiveTest };
