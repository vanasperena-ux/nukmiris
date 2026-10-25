"use strict";

const { randomUUID } = require("node:crypto");
const { DateTime } = require("luxon");
const { loadCalendarClient, verifyBookingAuthorization } = require("./google-calendar");
const { findAvailableSlots } = require("./availability");

function prepareManagementSchema(db) {
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS appointment_changes (
      request_id TEXT PRIMARY KEY,
      booking_request_id TEXT NOT NULL REFERENCES booking_requests(request_id),
      business_id TEXT NOT NULL,
      sender_whatsapp_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      calendar_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('reschedule','cancel')),
      original_start TEXT NOT NULL,
      original_end TEXT NOT NULL,
      original_etag TEXT NOT NULL,
      target_start TEXT,
      target_end TEXT,
      state TEXT NOT NULL CHECK(state IN ('offered','pending','uncertain','applied','rejected','declined')),
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(business_id,customer_id) REFERENCES business_customers(business_id,customer_id)
    );
    CREATE INDEX IF NOT EXISTS idx_appointment_changes_customer
      ON appointment_changes(business_id,sender_whatsapp_id,state);`);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function createAppointmentManagement({ db, availability, enabled = false, lookaheadDays = 14,
  getClient = () => loadCalendarClient({ booking: true }), verifyAuthorization = verifyBookingAuthorization,
  now = () => DateTime.now(), lifetimeMs = 15 * 60 * 1000 }) {
  let client, authorization;
  async function calendar() { return client || (client = await getClient()); }
  function authorize() {
    if (!authorization) authorization = Promise.resolve().then(verifyAuthorization).catch(error => { authorization = undefined; throw error; });
    return authorization;
  }
  function requireEnabled() { if (!enabled) throw new Error("Appointment management is disabled"); }
  function booking(context) {
    return db.prepare(`SELECT b.* FROM booking_requests b JOIN business_customers c
      ON c.business_id=b.business_id AND c.customer_id=b.customer_id AND c.whatsapp_id=b.sender_whatsapp_id
      WHERE b.request_id=? AND b.business_id=? AND b.sender_whatsapp_id=?`)
      .get(context.bookingRequestId, context.businessId, context.sender);
  }
  function lookup(context) {
    return db.prepare(`SELECT a.* FROM appointment_changes a JOIN booking_requests b
      ON b.request_id=a.booking_request_id AND b.business_id=a.business_id
      AND b.sender_whatsapp_id=a.sender_whatsapp_id AND b.customer_id=a.customer_id
      AND b.calendar_id=a.calendar_id AND b.event_id=a.event_id
      WHERE a.request_id=? AND a.business_id=? AND a.sender_whatsapp_id=?`)
      .get(context.requestId, context.businessId, context.sender);
  }
  function mappingMatches(row) { return availability.configuration(row.business_id).calendarId === row.calendar_id; }
  function owns(event, row) {
    const fields = event?.extendedProperties?.private;
    return event?.id === row.event_id && fields?.nukmirisBusinessId === row.business_id &&
      fields?.nukmirisCustomerId === row.sender_whatsapp_id && fields?.nukmirisInternalCustomerId === row.customer_id &&
      fields?.nukmirisBookingRequestId === (row.booking_request_id || row.request_id);
  }
  function sameTime(actual, expected) { return DateTime.fromISO(actual || "").toMillis() === DateTime.fromISO(expected || "").toMillis(); }
  function describe(row) {
    return { status: row.state, requestId: row.request_id, bookingRequestId: row.booking_request_id,
      kind: row.kind, originalStart: row.original_start, originalEnd: row.original_end,
      start: row.target_start, end: row.target_end, eventId: row.event_id };
  }
  function changeState(row, state) {
    db.prepare("UPDATE appointment_changes SET state=?,updated_at=? WHERE request_id=?").run(state, now().toISO(), row.request_id);
    row.state = state;
  }
  async function readAppointment(context) {
    requireEnabled();
    const row = booking(context);
    if (!row || row.state !== "confirmed" || !mappingMatches(row)) throw new Error("Appointment does not belong to this customer/calendar");
    const event = (await (await calendar()).events.get({ calendarId: row.calendar_id, eventId: row.event_id })).data;
    const start = DateTime.fromISO(event?.start?.dateTime || ""), end = DateTime.fromISO(event?.end?.dateTime || "");
    if (event?.status === "cancelled") throw Object.assign(new Error("Appointment changed or is no longer manageable"), { code: "APPOINTMENT_GONE" });
    if (!owns(event, row) || !event.etag || event.recurringEventId || event.recurrence ||
        !start.isValid || !end.isValid || start <= now() || end <= start ||
        (context.expectedEtag && event.etag !== context.expectedEtag)) throw new Error("Appointment changed or is no longer manageable");
    return { row, event, bookingRequestId: row.request_id, start: event.start.dateTime,
      end: event.end.dateTime, etag: event.etag, calendarId: row.calendar_id };
  }
  async function listAppointments({ businessId, sender }) {
    requireEnabled();
    const { calendarId } = availability.configuration(businessId);
    const rows = db.prepare(`SELECT request_id FROM booking_requests WHERE business_id=? AND sender_whatsapp_id=?
      AND calendar_id=? AND state='confirmed' ORDER BY start_ms`).all(businessId, sender, calendarId);
    const appointments = [];
    for (const row of rows) {
      // Invalid/missing ownership is omitted. Service/network failures must not
      // turn into a misleading empty appointment list.
      try { appointments.push(await readAppointment({ businessId, sender, bookingRequestId: row.request_id })); }
      catch (error) {
        const code = Number(error.response?.status || error.code);
        if (![404, 410].includes(code) && !/Appointment (does not belong|changed)/.test(error.message)) throw error;
      }
    }
    return appointments.sort((a, b) => DateTime.fromISO(a.start).toMillis() - DateTime.fromISO(b.start).toMillis())
      .map(({ row, event, ...item }) => item);
  }
  async function listSlots(context) {
    const source = await readAppointment(context);
    const { settings } = availability.configuration(context.businessId);
    const current = now().setZone(settings.timeZone);
    const api = await calendar(), periods = [], seen = new Set();
    let pageToken;
    do {
      const response = await api.events.list({ calendarId: source.calendarId, singleEvents: true, showDeleted: false,
        timeMin: current.minus({ minutes: settings.bufferMinutes }).toISO(),
        timeMax: current.plus({ days: lookaheadDays }).toISO(), timeZone: settings.timeZone,
        maxResults: 2500, ...(pageToken ? { pageToken } : {}) });
      const items = response.data.items || [];
      if (!Array.isArray(items)) throw new Error("Calendar events could not be checked");
      for (const event of items) {
        if (event.id === source.row.event_id || event.status === "cancelled" || event.transparency === "transparent") continue;
        const start = DateTime.fromISO(event.start?.dateTime || event.start?.date || "", { zone: settings.timeZone });
        const end = DateTime.fromISO(event.end?.dateTime || event.end?.date || "", { zone: settings.timeZone });
        if (!start.isValid || !end.isValid || end <= start) throw new Error("Calendar returned an invalid busy event");
        periods.push({ start: start.toISO(), end: end.toISO() });
      }
      pageToken = response.data.nextPageToken;
      if (pageToken && seen.has(pageToken)) throw new Error("Calendar returned repeated pagination");
      if (pageToken) seen.add(pageToken);
    } while (pageToken);
    return findAvailableSlots({ settings, busyPeriods: periods, now: current, lookaheadDays })
      .filter(slot => !sameTime(slot.start, source.start) || !sameTime(slot.end, source.end));
  }
  function invalidateOffers({ businessId, sender }) {
    db.prepare("UPDATE appointment_changes SET state='declined',updated_at=? WHERE business_id=? AND sender_whatsapp_id=? AND state='offered'")
      .run(now().toISO(), businessId, sender);
  }
  async function createIntent({ businessId, sender, bookingRequestId, expectedEtag, kind, slot }) {
    requireEnabled();
    if (!["reschedule", "cancel"].includes(kind)) throw new Error("Invalid appointment action");
    const context = { businessId, sender, bookingRequestId, expectedEtag };
    const source = await readAppointment(context);
    if (kind === "reschedule") {
      if (!slot || !(await listSlots(context)).some(item => sameTime(item.start, slot.start) && sameTime(item.end, slot.end))) {
        throw new Error("The selected new time is unavailable");
      }
    }
    const requestId = randomUUID();
    db.exec("BEGIN IMMEDIATE");
    try {
      invalidateOffers({ businessId, sender });
      db.prepare(`INSERT INTO appointment_changes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'offered',?,?,?)`)
        .run(requestId, bookingRequestId, businessId, sender, source.row.customer_id, source.calendarId,
          source.row.event_id, kind, source.start, source.end, source.etag,
          kind === "reschedule" ? slot.start : null, kind === "reschedule" ? slot.end : null,
          now().toMillis() + lifetimeMs, now().toISO(), now().toISO());
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return describe(lookup({ requestId, businessId, sender }));
  }
  function claim(context) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = lookup(context);
      if (!row) { db.exec("COMMIT"); return { status: "invalid" }; }
      if (row.state !== "offered") { db.exec("COMMIT"); return describe(row); }
      if (row.expires_at < now().toMillis() || !mappingMatches(row) ||
          booking({ ...context, bookingRequestId: row.booking_request_id })?.state !== "confirmed") {
        changeState(row, "rejected"); db.exec("COMMIT"); return describe(row);
      }
      if (db.prepare("SELECT 1 FROM calendar_booking_locks WHERE calendar_id=?").get(row.calendar_id)) {
        db.exec("COMMIT"); return { ...describe(row), status: "busy" };
      }
      // Share the existing calendar lock with new bookings. The parent booking
      // is its FK owner; the change journal identifies the operation itself.
      db.prepare("INSERT INTO calendar_booking_locks VALUES (?,?,?)").run(row.calendar_id, row.booking_request_id, now().toISO());
      changeState(row, "pending");
      db.exec("COMMIT"); return { ...describe(row), claimed: true };
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function terminal(context, state) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = lookup(context);
      // A late duplicate recovery cannot release a newer operation's lock.
      if (!row || !["pending", "uncertain"].includes(row.state)) {
        db.exec("COMMIT"); return row ? describe(row) : { status: "invalid" };
      }
      changeState(row, state);
      if (state === "applied") {
        if (row.kind === "cancel") db.prepare("UPDATE booking_requests SET state='removed',updated_at=? WHERE request_id=?").run(now().toISO(), row.booking_request_id);
        else db.prepare("UPDATE booking_requests SET slot_start=?,slot_end=?,start_ms=?,end_ms=?,updated_at=? WHERE request_id=?")
          .run(row.target_start, row.target_end, DateTime.fromISO(row.target_start).toMillis(), DateTime.fromISO(row.target_end).toMillis(), now().toISO(), row.booking_request_id);
      }
      db.prepare("DELETE FROM calendar_booking_locks WHERE calendar_id=? AND request_id=?").run(row.calendar_id, row.booking_request_id);
      db.exec("COMMIT"); return describe(row);
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function applied(event, row) {
    return owns(event, row) && event.status !== "cancelled" &&
      event.extendedProperties.private.nukmirisChangeRequestId === row.request_id &&
      sameTime(event.start?.dateTime, row.target_start) && sameTime(event.end?.dateTime, row.target_end);
  }
  async function reconcile(context) {
    if (!enabled) return { status: "disabled" };
    const row = lookup(context);
    if (!row) return { status: "invalid" };
    if (!["pending", "uncertain"].includes(row.state)) return describe(row);
    if (!mappingMatches(row)) return { ...describe(row), status: "uncertain" };
    try {
      const event = (await (await calendar()).events.get({ calendarId: row.calendar_id, eventId: row.event_id })).data;
      if (row.kind === "cancel" ? event.id === row.event_id && event.status === "cancelled" : applied(event, row)) return terminal(context, "applied");
    } catch (error) {
      if (row.kind === "cancel" && [404, 410].includes(Number(error.response?.status || error.code))) return terminal(context, "applied");
    }
    return { ...describe(row), status: "uncertain" };
  }
  async function journalConflict(row, api) {
    const { settings } = availability.configuration(row.business_id);
    const buffer = settings.bufferMinutes * 60000;
    const start = DateTime.fromISO(row.target_start).toMillis(), end = DateTime.fromISO(row.target_end).toMillis();
    const others = db.prepare(`SELECT * FROM booking_requests WHERE calendar_id=? AND request_id<>? AND state='confirmed'
      AND start_ms<? AND end_ms>?`).all(row.calendar_id, row.booking_request_id, end + buffer, start - buffer);
    for (const other of others) {
      let event;
      try { event = (await api.events.get({ calendarId: other.calendar_id, eventId: other.event_id })).data; }
      catch (error) { if ([404, 410].includes(Number(error.response?.status || error.code))) continue; throw error; }
      if (event.status === "cancelled") continue;
      if (!owns(event, other)) throw new Error("Other appointment ownership could not be verified");
      const first = DateTime.fromISO(event.start?.dateTime || "").toMillis(), last = DateTime.fromISO(event.end?.dateTime || "").toMillis();
      if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) throw new Error("Other appointment time is invalid");
      if (start < last + buffer && end + buffer > first) return true;
    }
    return false;
  }
  async function confirm(context) {
    if (!enabled) return { status: "disabled" };
    let row = lookup(context);
    if (!row) return { status: "invalid" };
    if (["pending", "uncertain"].includes(row.state)) return reconcile(context);
    if (row.state !== "offered") return describe(row);
    await authorize();
    const decision = claim(context);
    if (!decision.claimed) return decision;
    row = lookup(context);
    let attempted = false;
    try {
      const sourceContext = { businessId: row.business_id, sender: row.sender_whatsapp_id,
        bookingRequestId: row.booking_request_id, expectedEtag: row.original_etag };
      const source = await readAppointment(sourceContext);
      if (!sameTime(source.start, row.original_start) || !sameTime(source.end, row.original_end)) return terminal(context, "rejected");
      const api = await calendar();
      if (row.kind === "reschedule") {
        const slots = await listSlots(sourceContext);
        if (!slots.some(slot => sameTime(slot.start, row.target_start) && sameTime(slot.end, row.target_end)) ||
            await journalConflict(row, api)) return terminal(context, "rejected");
      }
      if (!mappingMatches(row)) return terminal(context, "rejected");
      const options = { retry: false, headers: { "If-Match": row.original_etag } };
      attempted = true;
      if (row.kind === "cancel") {
        await api.events.delete({ calendarId: row.calendar_id, eventId: row.event_id, sendUpdates: "none" }, options);
        return terminal(context, "applied");
      }
      const { settings } = availability.configuration(row.business_id);
      const response = await api.events.patch({ calendarId: row.calendar_id, eventId: row.event_id, sendUpdates: "none", requestBody: {
        start: { dateTime: row.target_start, timeZone: settings.timeZone },
        end: { dateTime: row.target_end, timeZone: settings.timeZone },
        extendedProperties: { private: { ...source.event.extendedProperties.private, nukmirisChangeRequestId: row.request_id } },
      } }, options);
      if (!applied(response.data, row)) throw new Error("Reschedule response could not be verified");
      return terminal(context, "applied");
    } catch (error) {
      if (!attempted || [400, 401, 403, 404, 410, 412, 422].includes(Number(error.response?.status || error.code))) return terminal(context, "rejected");
      db.prepare("UPDATE appointment_changes SET state='uncertain',updated_at=? WHERE request_id=? AND state IN ('pending','uncertain')")
        .run(now().toISO(), row.request_id);
      return reconcile(context);
    }
  }
  function decline(context) {
    if (!enabled) return { status: "disabled" };
    const row = lookup(context);
    if (!row) return { status: "invalid" };
    db.prepare("UPDATE appointment_changes SET state='declined',updated_at=? WHERE request_id=? AND state='offered'").run(now().toISO(), row.request_id);
    const current = lookup(context);
    return { ...describe(current), status: ["pending", "uncertain"].includes(current.state) ? "uncertain" : current.state };
  }
  async function verify() { requireEnabled(); await authorize(); }
  return { listAppointments, readAppointment, listSlots, createIntent, confirm, decline, reconcile, invalidateOffers, verify };
}

// Reuse the management lookup when only the menu needs appointment details.
// This adapter exposes no mutation methods and needs no change-journal table.
function createAppointmentLookup(options) {
  const { listAppointments } = createAppointmentManagement({ ...options, enabled: true });
  return { listAppointments };
}

module.exports = { prepareManagementSchema, createAppointmentManagement, createAppointmentLookup };
