"use strict";

const { randomUUID } = require("node:crypto");
const { DateTime } = require("luxon");
const { loadCalendarClient } = require("./google-calendar");
const { insertSchedule } = require("./reminder-schedule");
const { templatePayload, TEMPLATE_TTL_SECONDS } = require("./reminder-templates");
const { normalizedRecipient } = require("./reliable-delivery");
const { reminderPermission } = require("./reminder-permissions");

const SUFFIX = " — Confirmada";
function transaction(db, action) {
  db.exec("BEGIN IMMEDIATE");
  try { const result = action(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
function milliseconds(iso) { return DateTime.fromISO(iso || "").toMillis(); }
function errorCode(error) { return Number(error.response?.status || error.code); }

function createAppointmentReminders({ db, availability, mode = "off", now = Date.now,
  getClient = () => loadCalendarClient({ booking: true }), verifyTemplate = async () => { throw new Error("reminder_template_verification_unavailable"); },
  send, onDryRun = info => console.log("Reminder dry-run:", JSON.stringify(info)), testScope }) {
  if (!["off", "dry-run", "live"].includes(mode)) throw new Error("Invalid reminder mode");
  let scope;
  if (testScope !== undefined) {
    if (!testScope || Array.isArray(testScope) || typeof testScope !== "object" ||
        ![testScope.businessId, testScope.sender, testScope.bookingRequestId].every(value => typeof value === "string" && value.trim() === value && value.length > 0) ||
        !/^[1-9]\d{7,14}$/.test(testScope.sender)) throw new Error("Reminder test scope requires an exact business, international WhatsApp identity and booking identity");
    scope = Object.freeze({ businessId: testScope.businessId, sender: testScope.sender, bookingRequestId: testScope.bookingRequestId });
    const selected = db.prepare(`SELECT 1 FROM appointment_attendance a
      JOIN businesses b ON b.business_id=a.business_id AND b.status='test'
      JOIN business_customers c ON c.business_id=a.business_id AND c.customer_id=a.customer_id AND c.whatsapp_id=a.sender
      JOIN booking_requests r ON r.request_id=a.booking_request_id AND r.business_id=a.business_id
        AND r.sender_whatsapp_id=a.sender AND r.customer_id=a.customer_id
      WHERE a.business_id=? AND a.sender=? AND a.booking_request_id=?`).get(scope.businessId, scope.sender, scope.bookingRequestId);
    if (!selected) throw new Error("Reminder test scope must match a registered customer and tracked booking in a test business");
  }
  const scopeValues = scope ? [scope.businessId, scope.sender, scope.bookingRequestId] : [];
  const scopeFilter = column => scope ? ` AND ${column} IN (SELECT a.booking_request_id FROM appointment_attendance a
    JOIN businesses b ON b.business_id=a.business_id AND b.status='test'
    WHERE a.business_id=? AND a.sender=? AND a.booking_request_id=?)` : "";
  function inScope(row) {
    return !scope || !!row && row.business_id === scope.businessId && row.sender === scope.sender &&
      row.booking_request_id === scope.bookingRequestId && !!db.prepare("SELECT 1 FROM businesses WHERE business_id=? AND status='test'").get(scope.businessId);
  }
  let client;
  const calendar = async () => client || (client = await getClient());
  const settings = businessId => db.prepare(`SELECT r.*,w.phone_number_id FROM reminder_business_settings r
    JOIN business_whatsapp_connections w USING(business_id) WHERE r.business_id=? AND r.enabled=1`).get(businessId);
  const tracked = id => db.prepare("SELECT * FROM appointment_attendance WHERE booking_request_id=?").get(id);
  const jobRow = id => db.prepare("SELECT * FROM reminder_jobs WHERE job_id=?").get(id);
  function validIdentity(row) {
    if (!inScope(row)) return null;
    const identity = db.prepare(`SELECT b.state,c.full_name,w.phone_number_id,bus.business_name,bus.time_zone
      FROM booking_requests b JOIN business_customers c ON c.business_id=b.business_id
        AND c.customer_id=b.customer_id AND c.whatsapp_id=b.sender_whatsapp_id
      JOIN business_whatsapp_connections w ON w.business_id=b.business_id
      JOIN businesses bus ON bus.business_id=b.business_id AND bus.status IN ('test','active')
      WHERE b.request_id=? AND b.business_id=? AND b.sender_whatsapp_id=? AND b.customer_id=?
        AND b.calendar_id=? AND b.event_id=?`).get(row.booking_request_id, row.business_id, row.sender,
        row.customer_id, row.calendar_id, row.event_id);
    if (!identity || identity.phone_number_id !== row.phone_number_id || !settings(row.business_id) ||
        availability.configuration(row.business_id).calendarId !== row.calendar_id) return null;
    return identity;
  }
  function owns(event, row) {
    const p = event?.extendedProperties?.private;
    return event?.id === row.event_id && p?.nukmirisBusinessId === row.business_id &&
      p?.nukmirisCustomerId === row.sender && p?.nukmirisInternalCustomerId === row.customer_id &&
      p?.nukmirisBookingRequestId === row.booking_request_id;
  }
  function sameSchedule(event, row) {
    return owns(event, row) && event.status !== "cancelled" && !event.recurrence && !event.recurringEventId &&
      milliseconds(event.start?.dateTime) === row.start_ms && milliseconds(event.end?.dateTime) === row.end_ms;
  }
  function invalidate(id, reason) {
    db.prepare("UPDATE reminder_jobs SET state='skipped',last_error=? WHERE booking_request_id=? AND state='pending'").run(reason, id);
  }
  function newSchedule(row, start, end, zone) {
    invalidate(row.booking_request_id, "schedule_changed");
    db.prepare(`UPDATE appointment_attendance SET start_iso=?,end_iso=?,start_ms=?,end_ms=?,time_zone=?,
      lifecycle='ACTIVE',attendance='PENDING',confirmed_at=NULL,responded_at=NULL,reschedule_until=NULL,
      schedule_version=schedule_version+1,action_token=?,next_check_at=?,last_error=NULL WHERE booking_request_id=?`)
      .run(start, end, milliseconds(start), milliseconds(end), zone, randomUUID(), now() + 300000, row.booking_request_id);
    const updated = tracked(row.booking_request_id);
    const config = settings(row.business_id);
    if (config) insertSchedule(db, updated, now(), JSON.parse(config.intervals_json));
    return updated;
  }
  // Called inside the existing booking/change journal transaction. A committed
  // booking and its reminder schedule cannot be separated by a process crash.
  function committed(booking, kind) {
    if (mode === "off") return;
    const existing = tracked(booking.request_id);
    if (kind === "cancel") {
      if (existing) {
        invalidate(booking.request_id, "appointment_cancelled");
        db.prepare(`UPDATE appointment_attendance SET lifecycle='CANCELLED',attendance='CANCELLED',
          action_token=?,schedule_version=schedule_version+1,last_error=NULL WHERE booking_request_id=?`)
          .run(randomUUID(), booking.request_id);
      }
      return;
    }
    if (existing) {
      if (kind === "reschedule") newSchedule(existing, booking.slot_start, booking.slot_end,
        availability.configuration(booking.business_id).settings.timeZone);
      return;
    }
    const config = settings(booking.business_id);
    if (kind !== "booking" || !config || !Number.isFinite(Date.parse(booking.created_at)) || Date.parse(booking.created_at) < config.activated_at) return;
    const identity = db.prepare(`SELECT c.customer_id,w.phone_number_id FROM business_customers c
      JOIN business_whatsapp_connections w ON w.business_id=c.business_id
      WHERE c.business_id=? AND c.whatsapp_id=? AND c.customer_id=?`)
      .get(booking.business_id, booking.sender_whatsapp_id, booking.customer_id);
    if (!identity) throw new Error("Reminder identity mapping could not be verified");
    db.prepare(`INSERT INTO appointment_attendance
      (booking_request_id,business_id,sender,customer_id,customer_name,calendar_id,event_id,phone_number_id,
        time_zone,start_iso,end_iso,start_ms,end_ms,lifecycle,attendance,schedule_version,action_token,next_check_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE','PENDING',1,?,?)`).run(booking.request_id, booking.business_id,
        booking.sender_whatsapp_id, booking.customer_id, booking.customer_name, booking.calendar_id, booking.event_id,
        identity.phone_number_id, availability.configuration(booking.business_id).settings.timeZone,
        booking.slot_start, booking.slot_end, booking.start_ms, booking.end_ms, randomUUID(), now() + 300000);
    insertSchedule(db, tracked(booking.request_id), now(), JSON.parse(config.intervals_json));
  }
  function rescheduleFields(event) {
    const p = event.extendedProperties?.private;
    const row = p && tracked(p.nukmirisBookingRequestId);
    if (mode === "off" || !row || !owns(event, row)) return {};
    const summary = p.nukmirisAttendanceManagedSuffix === "true" && event.summary?.endsWith(SUFFIX)
      ? { summary: event.summary.slice(0, -SUFFIX.length) } : {};
    return { ...summary, extendedProperties: { private: {
      nukmirisAttendanceStatus: "PENDING", nukmirisAttendanceScheduleVersion: String(row.schedule_version + 1),
      nukmirisAttendanceOperationId: null, nukmirisAttendanceConfirmedAt: null, nukmirisAttendanceManagedSuffix: null,
    } } };
  }
  function hasFutureReminders(id) {
    const row = mode === "live" && tracked(id);
    return !!row && inScope(row) && reminderPermission(db, row.business_id, row.sender, now()).allowed && !!db.prepare(`SELECT 1 FROM reminder_jobs WHERE booking_request_id=?
      AND state='pending' AND due_at>?`).get(id, now());
  }
  async function readEvent(row) {
    return (await (await calendar()).events.get({ calendarId: row.calendar_id, eventId: row.event_id },
      { timeout: 15000, retry: false })).data;
  }
  function cancelTracking(row, reason, review = false) {
    invalidate(row.booking_request_id, reason);
    db.prepare(`UPDATE appointment_attendance SET lifecycle=?,attendance=?,schedule_version=schedule_version+1,
      action_token=?,last_error=? WHERE booking_request_id=?`).run(review ? "REVIEW" : "CANCELLED",
        review ? "PENDING" : "CANCELLED", randomUUID(), reason, row.booking_request_id);
  }
  async function synchronize(row) {
    if (!row || !inScope(row) || row.lifecycle !== "ACTIVE") return null;
    if (db.prepare("SELECT 1 FROM calendar_booking_locks WHERE calendar_id=?").get(row.calendar_id)) {
      db.prepare("UPDATE appointment_attendance SET next_check_at=? WHERE booking_request_id=?").run(now() + 60000, row.booking_request_id);
      return null;
    }
    let identity;
    try { identity = validIdentity(row); } catch { identity = null; }
    if (!identity) { transaction(db, () => cancelTracking(row, "identity_or_business_mapping_changed", true)); return null; }
    let event;
    try { event = await readEvent(row); }
    catch (error) {
      if ([404, 410].includes(errorCode(error))) transaction(db, () => cancelTracking(row, "calendar_event_missing"));
      else db.prepare("UPDATE appointment_attendance SET last_error='calendar_read_failed',next_check_at=? WHERE booking_request_id=?")
        .run(now() + 60000, row.booking_request_id);
      return null;
    }
    // Recheck local version/lock after the network await.
    const current = tracked(row.booking_request_id);
    if (!current || !inScope(current) || current.schedule_version !== row.schedule_version || current.lifecycle !== "ACTIVE" ||
        db.prepare("SELECT 1 FROM calendar_booking_locks WHERE calendar_id=?").get(row.calendar_id)) return null;
    if (identity.state === "removed" || event?.status === "cancelled") {
      transaction(db, () => cancelTracking(current, "appointment_cancelled")); return null;
    }
    if (identity.state !== "confirmed" || !owns(event, current) || !event.etag || event.recurrence || event.recurringEventId ||
        !Number.isFinite(milliseconds(event.start?.dateTime)) || !Number.isFinite(milliseconds(event.end?.dateTime)) ||
        milliseconds(event.end?.dateTime) <= milliseconds(event.start?.dateTime)) {
      transaction(db, () => cancelTracking(current, "calendar_ownership_or_shape_changed", true)); return null;
    }
    if (!sameSchedule(event, current) || identity.time_zone !== current.time_zone) {
      return transaction(db, () => {
        // A manual move of an attendance-confirmed event needs owner review:
        // do not silently retain or rewrite the old confirmation in Calendar.
        if (current.attendance === "CONFIRMED" || event.extendedProperties.private.nukmirisAttendanceStatus === "CONFIRMED") {
          cancelTracking(current, "confirmed_appointment_manually_moved", true); return null;
        }
        db.prepare("UPDATE booking_requests SET slot_start=?,slot_end=?,start_ms=?,end_ms=?,updated_at=? WHERE request_id=?")
          .run(event.start.dateTime, event.end.dateTime, milliseconds(event.start.dateTime), milliseconds(event.end.dateTime),
            new Date(now()).toISOString(), current.booking_request_id);
        newSchedule(current, event.start.dateTime, event.end.dateTime, identity.time_zone);
        return null; // Never send a job from the previous schedule.
      });
    }
    db.prepare("UPDATE appointment_attendance SET next_check_at=?,last_error=NULL WHERE booking_request_id=?")
      .run(now() + 300000, current.booking_request_id);
    return { row: current, event, identity };
  }
  function recover() {
    // Invoked only after the existing singleton delivery-worker lock is held.
    db.prepare("UPDATE reminder_jobs SET state='uncertain',last_error='restart_during_send' WHERE state='sending'").run();
    db.prepare("UPDATE reminder_attempts SET outcome='uncertain',error='restart_during_send' WHERE outcome='attempted'").run();
  }
  function claimJob() {
    return transaction(db, () => {
      db.prepare(`UPDATE reminder_jobs SET state='skipped',last_error='reminder_expired' WHERE state='pending' AND expires_at<?${scopeFilter("booking_request_id")}`)
        .run(now(), ...scopeValues);
      const job = db.prepare(`SELECT * FROM reminder_jobs WHERE state='pending' AND due_at<=? AND next_attempt_at<=?
        ${scopeFilter("booking_request_id")} ORDER BY due_at,job_id LIMIT 1`).get(now(), now(), ...scopeValues);
      if (!job) return null;
      db.prepare("UPDATE reminder_jobs SET state='sending',attempts=attempts+1 WHERE job_id=? AND state='pending'").run(job.job_id);
      job.attempts++;
      db.prepare("INSERT INTO reminder_attempts VALUES (?,?,?,'attempted',NULL,NULL)").run(job.job_id, job.attempts, now());
      return job;
    });
  }
  function finish(job, result) {
    transaction(db, () => {
      const retry = result.state === "pending";
      const state = retry && job.attempts >= 4 ? "failed" : result.state;
      const error = retry && job.attempts >= 4 ? "retry_limit_reached" : result.error || null;
      db.prepare(`UPDATE reminder_jobs SET state=?,next_attempt_at=?,accepted_at=CASE WHEN ?='accepted' THEN ? ELSE accepted_at END,
        meta_message_id=COALESCE(?,meta_message_id),last_error=? WHERE job_id=? AND state='sending'`)
        .run(state, now() + 60000 * 2 ** Math.min(job.attempts - 1, 3), state, now(), result.metaMessageId || null, error, job.job_id);
      const actual = jobRow(job.job_id);
      db.prepare("UPDATE reminder_attempts SET outcome=?,error=?,meta_message_id=? WHERE job_id=? AND attempt=?")
        .run(actual.state, actual.last_error, actual.meta_message_id, job.job_id, job.attempts);
    });
  }
  function eligible(row, job) {
    if (!row || !inScope(row) || row.lifecycle !== "ACTIVE" || row.schedule_version !== job.schedule_version || row.start_ms <= now()) return "obsolete_schedule";
    if (now() > job.expires_at) return "reminder_expired";
    if (job.kind === "followup") {
      if (row.attendance !== "PENDING" || row.responded_at !== null) return "customer_already_responded";
      const original = db.prepare(`SELECT * FROM reminder_jobs WHERE booking_request_id=? AND schedule_version=? AND kind='confirmation'`)
        .get(row.booking_request_id, row.schedule_version);
      if (!original || !(original.state === "accepted" || (mode === "dry-run" && original.state === "dry_run")) || original.meta_status === "failed") return "original_request_not_dispatched";
      if (mode === "live" && !["delivered", "read"].includes(original.meta_status)) return "original_request_not_delivered";
    }
    return null;
  }
  async function dispatch(job) {
    let row = tracked(job.booking_request_id);
    const skip = eligible(row, job);
    if (skip) { finish(job, { state: "skipped", error: skip }); return; }
    const config = settings(row.business_id);
    if (!config) { finish(job, { state: "skipped", error: "business_reminders_disabled" }); return; }
    const permission = reminderPermission(db, row.business_id, row.sender, now());
    if (mode === "live" && !permission.allowed) { finish(job, { state: "skipped", error: permission.reason }); return; }
    let payload;
    try {
      if (mode === "live") await verifyTemplate(config, job.kind);
      const checked = await synchronize(row);
      if (!checked) {
        const obsolete = eligible(tracked(job.booking_request_id), job);
        finish(job, { state: obsolete ? "skipped" : "pending", error: obsolete || "calendar_verification_pending" }); return;
      }
      row = checked.row;
      const reason = eligible(row, job);
      if (reason) { finish(job, { state: "skipped", error: reason }); return; }
      const currentPermission = reminderPermission(db, row.business_id, row.sender, now());
      if (mode === "live" && !currentPermission.allowed) { finish(job, { state: "skipped", error: currentPermission.reason }); return; }
      // Include the shared transport timeout in the budget. A fixed template TTL
      // cannot be shortened per send; skip instead of posting a late reminder.
      if (mode === "live" && now() + TEMPLATE_TTL_SECONDS[job.kind] * 1000 + 15000 >= row.start_ms) {
        finish(job, { state: "skipped", error: "template_ttl_would_outlive_appointment" }); return;
      }
      payload = templatePayload(row, job, config, checked.identity.business_name);
      if (mode === "dry-run") {
        onDryRun({ businessId: row.business_id, customer: row.sender, name: row.customer_name,
          kind: job.kind, dueAt: new Date(job.due_at).toISOString(), appointmentStart: row.start_iso,
          template: payload.template.name, language: config.language,
          customerPermission: currentPermission.allowed ? "granted" : currentPermission.reason });
        finish(job, { state: "dry_run" });
        return;
      }
    } catch (error) {
      const templateError = /reminder_(?:template|waba|sender)/.test(error.message || "") &&
        !/reminder_(?:template|waba)_check_http_(?:429|5\d\d)/.test(error.message);
      finish(job, { state: templateError ? "failed" : "pending", error: templateError ? error.message : "reminder_check_failed" });
      return;
    }
    // From this point Meta may have accepted the message. Neither an adapter
    // exception nor failure to save its result permits another automatic send.
    let result;
    try { result = await send({ ...job, phone_number_id: row.phone_number_id, payload }); }
    catch { result = { state: "uncertain", error: "reminder_send_unknown" }; }
    try { finish(job, result); }
    catch {
      try { finish(job, { state: "uncertain", error: "reminder_result_not_saved", metaMessageId: result?.metaMessageId }); }
      catch { throw new Error("Reminder send result could not be saved; retain this work for recovery"); }
    }
  }
  function receipt(business, status) {
    const ref = status?.biz_opaque_callback_data;
    if (typeof ref !== "string" || !ref.startsWith("nukmiris-reminder:")) return;
    const job = jobRow(ref.slice("nukmiris-reminder:".length));
    const row = job && tracked(job.booking_request_id);
    if (!row || row.business_id !== business.business_id || row.phone_number_id !== business.phone_number_id ||
        normalizedRecipient(row.sender) !== normalizedRecipient(status.recipient_id || "") || typeof status.id !== "string" ||
        !["sending", "accepted", "uncertain", "failed"].includes(job.state) || (job.meta_message_id && job.meta_message_id !== status.id)) return;
    const rank = { sent: 1, failed: 2, delivered: 2, read: 3 };
    if (["sent", "delivered", "read"].includes(status.status) && (rank[job.meta_status] || 0) <= rank[status.status]) {
      db.prepare("UPDATE reminder_jobs SET state='accepted',accepted_at=COALESCE(accepted_at,?),meta_message_id=?,meta_status=?,last_error=NULL WHERE job_id=?")
        .run(now(), status.id, status.status, job.job_id);
    } else if (status.status === "failed" && !["delivered", "read"].includes(job.meta_status)) {
      // Known delivery failures are retained for review. Never resend an API-
      // accepted template automatically: delayed/out-of-order statuses exist.
      db.prepare("UPDATE reminder_jobs SET state='failed',meta_message_id=?,meta_status='failed',last_error='meta_delivery_failed' WHERE job_id=?")
        .run(status.id, job.job_id);
    }
    const latest = jobRow(job.job_id);
    db.prepare("UPDATE reminder_attempts SET outcome=?,error=?,meta_message_id=? WHERE job_id=? AND attempt=?")
      .run(latest.state, latest.last_error, latest.meta_message_id, job.job_id, job.attempts);
  }
  function actionRow({ businessId, sender }, token) {
    const row = db.prepare(`SELECT * FROM appointment_attendance WHERE action_token=? AND business_id=? AND sender=?
      AND lifecycle='ACTIVE' AND start_ms>?`).get(token, businessId, sender, now());
    return row && inScope(row) ? row : null;
  }
  function requestWasSent(row) {
    return !!db.prepare(`SELECT 1 FROM reminder_jobs WHERE booking_request_id=? AND schedule_version=?
      AND kind IN ('confirmation','followup') AND state='accepted' AND meta_status IS NOT 'failed'`)
      .get(row.booking_request_id, row.schedule_version);
  }
  function textTarget(context, { replyToId, sentAt } = {}) {
    if (replyToId) {
      const row = db.prepare(`SELECT a.* FROM appointment_attendance a JOIN reminder_jobs j USING(booking_request_id)
        WHERE a.business_id=? AND a.sender=? AND j.meta_message_id=? AND j.kind IN ('confirmation','followup')
          AND j.schedule_version=a.schedule_version AND a.lifecycle='ACTIVE' AND a.start_ms>?
          AND j.state='accepted' AND j.meta_status IS NOT 'failed'`).get(context.businessId, context.sender, replyToId, now());
      return row && inScope(row) ? row : null; // Never fall back from an obsolete/foreign quoted message.
    }
    // A reply must refer to one actually dispatched request. Two outstanding
    // appointments are deliberately ambiguous; never choose the latest one.
    const rows = db.prepare(`SELECT * FROM appointment_attendance WHERE business_id=? AND sender=?
      AND lifecycle='ACTIVE' AND start_ms>? AND attendance='PENDING'`).all(context.businessId, context.sender, now())
      .filter(requestWasSent);
    if (rows.length !== 1 || !inScope(rows[0])) return null;
    const row = rows[0];
    // Without a quote, an old accepted/uncertain request could have arrived
    // after a newer request. Do not equate "only one pending now" with intent.
    const obsolete = db.prepare(`SELECT 1 FROM reminder_jobs j JOIN appointment_attendance a USING(booking_request_id)
      WHERE a.business_id=? AND a.sender=? AND j.kind IN ('confirmation','followup')
        AND (j.accepted_at IS NOT NULL OR j.meta_message_id IS NOT NULL OR j.state='uncertain')
        AND (j.booking_request_id<>? OR j.schedule_version<>?) LIMIT 1`)
      .get(context.businessId, context.sender, row.booking_request_id, row.schedule_version);
    if (obsolete) return null;
    const first = db.prepare(`SELECT MIN(accepted_at) AS at FROM reminder_jobs WHERE booking_request_id=? AND schedule_version=?
      AND kind IN ('confirmation','followup') AND state='accepted'`).get(row.booking_request_id, row.schedule_version).at;
    if (Number.isFinite(sentAt) && first !== null && sentAt < first - 1000) return null;
    return row;
  }
  function confirmationMatches(event, row, operation) {
    const p = event?.extendedProperties?.private;
    return sameSchedule(event, row) && p.nukmirisAttendanceStatus === "CONFIRMED" &&
      p.nukmirisAttendanceOperationId === operation.operation_id &&
      p.nukmirisAttendanceScheduleVersion === String(row.schedule_version);
  }
  function finishConfirmation(row, operation, state) {
    return transaction(db, () => {
      const op = db.prepare("SELECT * FROM attendance_operations WHERE operation_id=?").get(operation.operation_id);
      if (!["pending", "uncertain"].includes(op.state)) return;
      db.prepare("UPDATE attendance_operations SET state=?,last_error=? WHERE operation_id=?")
        .run(state, state === "rejected" ? "calendar_update_rejected" : null, op.operation_id);
      if (state === "confirmed") {
        db.prepare(`UPDATE appointment_attendance SET attendance='CONFIRMED',confirmed_at=?,reschedule_until=NULL,last_error=NULL
          WHERE booking_request_id=? AND schedule_version=? AND lifecycle='ACTIVE'`).run(now(), row.booking_request_id, row.schedule_version);
        db.prepare("UPDATE reminder_jobs SET state='skipped',last_error='attendance_confirmed' WHERE booking_request_id=? AND kind='followup' AND state='pending'")
          .run(row.booking_request_id);
      }
      db.prepare("DELETE FROM calendar_booking_locks WHERE calendar_id=? AND request_id=?").run(row.calendar_id, row.booking_request_id);
    });
  }
  async function confirm(context, token) {
    if (mode !== "live") return { status: "disabled" };
    let row = actionRow(context, token);
    if (!row || !requestWasSent(row)) return { status: "stale" };
    const op = db.prepare("SELECT * FROM attendance_operations WHERE booking_request_id=? AND schedule_version=?")
      .get(row.booking_request_id, row.schedule_version);
    if (op && ["pending", "uncertain"].includes(op.state)) {
      try {
        const event = await readEvent(row);
        if (validIdentity(row) && confirmationMatches(event, row, op)) {
          finishConfirmation(row, op, "confirmed"); return { status: "confirmed", row: tracked(row.booking_request_id), etag: event.etag };
        }
      } catch { /* Unknown outcome retains its journal and shared calendar lock. */ }
      return { status: "uncertain" };
    }
    const checked = await synchronize(row);
    if (!checked) return { status: "stale" };
    row = checked.row;
    if (row.action_token !== token) return { status: "stale" };
    if (row.attendance === "CONFIRMED") return confirmationMatches(checked.event, row, op || {})
      ? { status: "confirmed", row, etag: checked.event.etag } : { status: "uncertain" };
    const title = checked.event.summary || `${row.customer_name} — Cita`;
    const alreadySuffixed = /(?:^|[\s—–-])Confirmada$/i.test(title);
    const operation = { operation_id: op?.operation_id || randomUUID(), desired_title: alreadySuffixed ? title : title + SUFFIX,
      managed_suffix: alreadySuffixed ? 0 : 1 };
    const claimed = transaction(db, () => {
      if (db.prepare("SELECT 1 FROM calendar_booking_locks WHERE calendar_id=?").get(row.calendar_id)) return false;
      const latest = actionRow(context, token);
      if (!latest || latest.schedule_version !== row.schedule_version || latest.attendance === "CONFIRMED") return false;
      db.prepare("INSERT INTO calendar_booking_locks VALUES (?,?,?)").run(row.calendar_id, row.booking_request_id, new Date(now()).toISOString());
      db.prepare(`INSERT INTO attendance_operations VALUES (?,?,?,'pending',?,?,?,NULL)
        ON CONFLICT(booking_request_id,schedule_version) DO UPDATE SET state='pending',desired_title=excluded.desired_title,
          managed_suffix=excluded.managed_suffix,last_error=NULL`).run(operation.operation_id, row.booking_request_id,
            row.schedule_version, operation.desired_title, operation.managed_suffix, now());
      db.prepare("UPDATE appointment_attendance SET responded_at=? WHERE booking_request_id=?").run(now(), row.booking_request_id);
      return true;
    });
    if (!claimed) return { status: "busy" };
    try {
      const response = await (await calendar()).events.patch({ calendarId: row.calendar_id, eventId: row.event_id, sendUpdates: "none",
        requestBody: { summary: operation.desired_title, extendedProperties: { private: {
          ...checked.event.extendedProperties.private, nukmirisAttendanceStatus: "CONFIRMED",
          nukmirisAttendanceScheduleVersion: String(row.schedule_version), nukmirisAttendanceOperationId: operation.operation_id,
          nukmirisAttendanceConfirmedAt: new Date(now()).toISOString(),
          nukmirisAttendanceManagedSuffix: String(!!operation.managed_suffix),
        } } } }, { retry: false, timeout: 15000, headers: { "If-Match": checked.event.etag } });
      if (!confirmationMatches(response.data, row, operation)) throw new Error("Unverified attendance update");
      finishConfirmation(row, operation, "confirmed");
      return { status: "confirmed", row: tracked(row.booking_request_id), etag: response.data.etag };
    } catch (error) {
      if ([400, 401, 403, 404, 410, 412, 422].includes(errorCode(error))) {
        finishConfirmation(row, operation, "rejected"); return { status: "failed" };
      }
      db.prepare("UPDATE attendance_operations SET state='uncertain',last_error='calendar_update_unknown' WHERE operation_id=?").run(operation.operation_id);
      try {
        const event = await readEvent(row);
        if (confirmationMatches(event, row, operation)) {
          finishConfirmation(row, operation, "confirmed"); return { status: "confirmed", row: tracked(row.booking_request_id), etag: event.etag };
        }
      } catch { /* An unknown write must not be blindly repeated. */ }
      return { status: "uncertain" };
    }
  }
  async function requestReschedule(context, token) {
    if (mode !== "live") return { status: "disabled" };
    const row = actionRow(context, token);
    if (!row || !requestWasSent(row)) return { status: "stale" };
    const checked = await synchronize(row);
    if (!checked || checked.row.action_token !== token) return { status: "stale" };
    db.prepare(`UPDATE appointment_attendance SET attendance='RESCHEDULE_REQUESTED',responded_at=?,reschedule_until=?
      WHERE booking_request_id=? AND schedule_version=?`).run(now(), now() + 15 * 60000, row.booking_request_id, row.schedule_version);
    db.prepare("UPDATE reminder_jobs SET state='skipped',last_error='reschedule_requested' WHERE booking_request_id=? AND kind='followup' AND state='pending'")
      .run(row.booking_request_id);
    return { status: "reschedule", appointment: { bookingRequestId: row.booking_request_id, etag: checked.event.etag }, row };
  }
  function restoreAbandoned() {
    // A customer who requested a change has responded: never send copy saying
    // they did not. Their original appointment and final reminder remain active.
    db.prepare(`UPDATE appointment_attendance SET attendance=CASE WHEN confirmed_at IS NULL THEN 'PENDING' ELSE 'CONFIRMED' END,
      reschedule_until=NULL WHERE attendance='RESCHEDULE_REQUESTED' AND reschedule_until<=?${scopeFilter("booking_request_id")}`).run(now(), ...scopeValues);
  }
  async function verifyReady() {
    if (mode !== "live") return;
    const businesses = scope ? [{ business_id: scope.businessId }] : db.prepare("SELECT business_id FROM reminder_business_settings WHERE enabled=1").all();
    for (const business of businesses) {
      const config = settings(business.business_id);
      if (!config) throw new Error("reminder_sender_mapping_missing");
      for (const kind of ["seven_day", "confirmation", "followup", "final"]) await verifyTemplate(config, kind);
    }
  }
  async function tick({ limit = 10 } = {}) {
    if (mode === "off") return;
    restoreAbandoned();
    // Reconciliation is read-only until Google proves the original operation.
    // It never repeats a possibly accepted Calendar patch.
    if (mode === "live") {
      const operations = db.prepare(`SELECT * FROM attendance_operations WHERE state IN ('pending','uncertain')${scopeFilter("booking_request_id")}
        ORDER BY created_at LIMIT ?`).all(...scopeValues, limit);
      for (const operation of operations) {
        const row = tracked(operation.booking_request_id);
        if (!row || row.schedule_version !== operation.schedule_version || !validIdentity(row)) continue;
        try {
          const event = await readEvent(row);
          if (confirmationMatches(event, row, operation)) finishConfirmation(row, operation, "confirmed");
        } catch { /* Keep the unresolved journal/lock for subsequent review. */ }
      }
    }
    const rows = db.prepare(`SELECT * FROM appointment_attendance WHERE lifecycle='ACTIVE' AND start_ms>?
      AND next_check_at<=?${scopeFilter("booking_request_id")} ORDER BY next_check_at LIMIT ?`).all(now(), now(), ...scopeValues, limit);
    for (const row of rows) await synchronize(row);
    for (let index = 0; index < limit; index++) {
      const job = claimJob();
      if (!job) break;
      await dispatch(job);
    }
  }
  function report(businessId) {
    return db.prepare(`SELECT booking_request_id,customer_name,sender,start_iso,end_iso,time_zone,lifecycle,attendance,
      confirmed_at,schedule_version,last_error FROM appointment_attendance WHERE business_id=? AND start_ms>?
      ${scopeFilter("booking_request_id")} ORDER BY start_ms LIMIT 1000`).all(businessId, now(), ...scopeValues);
  }
  return { committed, rescheduleFields, hasFutureReminders, recover, tick, receipt, confirm, requestReschedule, textTarget, report, verifyReady };
}

function createReminderWorker({ reminders, intervalMs = 30000, onError = () => {} }) {
  if (!Number.isInteger(intervalMs) || intervalMs < 1000 || intervalMs > 60000) throw new Error("Reminder poll interval must be 1–60 seconds");
  let stopped = true, timer, active;
  function run() {
    if (!active) active = reminders.tick().catch(onError).finally(() => { active = undefined; });
    return active;
  }
  function schedule() {
    if (stopped) return;
    timer = setTimeout(async () => { await run(); schedule(); }, intervalMs); timer.unref();
  }
  return { start() { stopped = false; void run().then(schedule); }, async stop() { stopped = true; clearTimeout(timer); await active; }, run };
}
module.exports = { createAppointmentReminders, createReminderWorker, SUFFIX };
