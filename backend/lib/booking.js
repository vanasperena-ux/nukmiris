"use strict";

const { createHash, randomUUID } = require("node:crypto");
const { DateTime } = require("luxon");
const { loadCalendarClient, verifyBookingAuthorization } = require("./google-calendar");

function prepareBookingSchema(db) {
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_business_customer_identity
      ON business_customers(business_id,customer_id);
    CREATE TABLE IF NOT EXISTS booking_requests (
      request_id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      sender_whatsapp_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      calendar_id TEXT NOT NULL,
      slot_start TEXT NOT NULL,
      slot_end TEXT NOT NULL,
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('offered','pending','confirmed','rejected','uncertain','declined','removed')),
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(calendar_id,event_id),
      FOREIGN KEY(business_id,customer_id) REFERENCES business_customers(business_id,customer_id)
    );
    CREATE INDEX IF NOT EXISTS idx_booking_calendar_time ON booking_requests(calendar_id,start_ms,end_ms,state);
    CREATE TABLE IF NOT EXISTS calendar_booking_locks (
      calendar_id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES booking_requests(request_id),
      created_at TEXT NOT NULL
    );`);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function createBookingService({ db, availability, enabled = false,
  getClient = () => loadCalendarClient({ booking: true }),
  verifyAuthorization = verifyBookingAuthorization, now = () => DateTime.now(), lifetimeMs = 15 * 60 * 1000 }) {
  let client;
  let authorization;
  async function calendar() { return client || (client = await getClient()); }
  function authorize() {
    if (!authorization) authorization = Promise.resolve().then(verifyAuthorization).catch(error => { authorization = undefined; throw error; });
    return authorization;
  }
  const scoped = db.prepare("SELECT * FROM booking_requests WHERE request_id=? AND business_id=? AND sender_whatsapp_id=?");
  function lookup({ requestId, businessId, sender }) { return scoped.get(requestId, businessId, sender); }
  function result(row, status = row.state) {
    return { status, requestId: row.request_id, eventId: row.event_id, start: row.slot_start, end: row.slot_end, name: row.customer_name };
  }
  function update(row, state) {
    db.prepare("UPDATE booking_requests SET state=?,updated_at=? WHERE request_id=?").run(state, now().toISO(), row.request_id);
    row.state = state;
  }
  function release(row) {
    db.prepare("DELETE FROM calendar_booking_locks WHERE calendar_id=? AND request_id=?").run(row.calendar_id, row.request_id);
  }
  function terminal(row, state) {
    db.exec("BEGIN IMMEDIATE");
    try { update(row, state); release(row); db.exec("COMMIT"); }
    catch (error) { db.exec("ROLLBACK"); throw error; }
    return result(row);
  }
  function mappingMatches(row) {
    return availability.configuration(row.business_id).calendarId === row.calendar_id;
  }
  function owns(event, row) {
    const fields = event.extendedProperties?.private;
    return event.id === row.event_id && fields?.nukmirisBusinessId === row.business_id &&
      fields?.nukmirisBookingRequestId === row.request_id && fields?.nukmirisCustomerId === row.sender_whatsapp_id &&
      fields?.nukmirisInternalCustomerId === row.customer_id;
  }
  function matches(event, row) {
    return owns(event, row) && event.status !== "cancelled" &&
      DateTime.fromISO(event.start?.dateTime || "").toMillis() === row.start_ms &&
      DateTime.fromISO(event.end?.dateTime || "").toMillis() === row.end_ms;
  }
  async function reconcile(context) {
    const row = lookup(context);
    if (!row) return { status: "invalid" };
    if (!enabled) return { status: "disabled" };
    if (row.state === "confirmed") return result(row);
    if (!["pending", "uncertain"].includes(row.state)) return result(row);
    if (!mappingMatches(row)) return result(row, "uncertain");
    try {
      const response = await (await calendar()).events.get({ calendarId: row.calendar_id, eventId: row.event_id });
      if (matches(response.data, row)) return terminal(row, "confirmed");
    } catch { /* Missing/failed reads do not prove that an ambiguous insert never happened. */ }
    return result(row, "uncertain");
  }
  function invalidateOffers({ businessId, sender }) {
    db.prepare("UPDATE booking_requests SET state='declined',updated_at=? WHERE business_id=? AND sender_whatsapp_id=? AND state='offered'")
      .run(now().toISO(), businessId, sender);
  }
  function createIntent({ businessId, sender, slot, calendarId }) {
    if (!enabled) throw new Error("Automatic booking is disabled");
    const current = availability.configuration(businessId);
    if (current.calendarId !== calendarId) throw new Error("The selected calendar changed");
    const customer = db.prepare("SELECT customer_id,full_name FROM business_customers WHERE business_id=? AND whatsapp_id=?").get(businessId, sender);
    if (!customer) throw new Error("A business-scoped customer registration is required");
    const start = DateTime.fromISO(slot.start), end = DateTime.fromISO(slot.end);
    if (!start.isValid || !end.isValid || start <= now() || end <= start) throw new Error("The selected appointment time is invalid");
    const requestId = randomUUID();
    const eventId = createHash("sha256").update(JSON.stringify([businessId, calendarId, requestId])).digest("hex");
    db.exec("BEGIN IMMEDIATE");
    try {
      invalidateOffers({ businessId, sender });
      db.prepare(`INSERT INTO booking_requests VALUES (?,?,?,?,?,?,?,?,?,?,?,'offered',?,?,?)`)
        .run(requestId, businessId, sender, customer.customer_id, customer.full_name, calendarId,
          slot.start, slot.end, start.toMillis(), end.toMillis(), eventId,
          now().toMillis() + lifetimeMs, now().toISO(), now().toISO());
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return result(lookup({ requestId, businessId, sender }));
  }
  function claim(context) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = lookup(context);
      if (!row) { db.exec("COMMIT"); return { status: "invalid" }; }
      if (row.state !== "offered") { db.exec("COMMIT"); return result(row); }
      if (row.expires_at < now().toMillis()) { update(row, "rejected"); db.exec("COMMIT"); return result(row, "expired"); }
      if (!mappingMatches(row)) { update(row, "rejected"); db.exec("COMMIT"); return result(row, "changed" ); }
      const lock = db.prepare("SELECT request_id FROM calendar_booking_locks WHERE calendar_id=?").get(row.calendar_id);
      if (lock) { db.exec("COMMIT"); return result(row, "busy"); }
      db.prepare("INSERT INTO calendar_booking_locks VALUES (?,?,?)").run(row.calendar_id, row.request_id, now().toISO());
      update(row, "pending");
      db.exec("COMMIT");
      return { ...result(row), claimed: true };
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  async function confirmedConflict(row, api, bufferMinutes) {
    const others = db.prepare(`SELECT * FROM booking_requests WHERE calendar_id=? AND request_id<>? AND state='confirmed'
      AND start_ms<? AND end_ms>?`).all(row.calendar_id, row.request_id,
      row.end_ms + bufferMinutes * 60000, row.start_ms - bufferMinutes * 60000);
    for (const other of others) {
      let event;
      try { event = (await api.events.get({ calendarId: other.calendar_id, eventId: other.event_id })).data; }
      catch (error) {
        if (Number(error.response?.status || error.code) !== 404) throw error;
        update(other, "removed");
        continue;
      }
      if (event.status === "cancelled") { update(other, "removed"); continue; }
      if (!owns(event, other)) throw new Error("Stored appointment ownership could not be verified");
      const start = DateTime.fromISO(event.start?.dateTime || "").toMillis();
      const end = DateTime.fromISO(event.end?.dateTime || "").toMillis();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Stored appointment time could not be verified");
      db.prepare("UPDATE booking_requests SET slot_start=?,slot_end=?,start_ms=?,end_ms=?,updated_at=? WHERE request_id=?")
        .run(event.start.dateTime, event.end.dateTime, start, end, now().toISO(), other.request_id);
      if (row.start_ms < end + bufferMinutes * 60000 && row.end_ms + bufferMinutes * 60000 > start) return true;
    }
    return false;
  }
  async function confirm(context) {
    if (!enabled) return { status: "disabled" };
    let row = lookup(context);
    if (!row) return { status: "invalid" };
    if (row.state === "confirmed") return result(row);
    if (["pending", "uncertain"].includes(row.state)) return reconcile(context);
    await authorize();
    const decision = claim(context);
    if (!decision.claimed) return decision;
    row = lookup(context);
    let attempted = false;
    try {
      const customer = db.prepare("SELECT customer_id FROM business_customers WHERE business_id=? AND whatsapp_id=?").get(row.business_id, row.sender_whatsapp_id);
      if (customer?.customer_id !== row.customer_id) return terminal(row, "rejected");
      const available = await availability.listSlots(row.business_id);
      const valid = available.some(slot => DateTime.fromISO(slot.start).toMillis() === row.start_ms && DateTime.fromISO(slot.end).toMillis() === row.end_ms);
      if (!valid || !mappingMatches(row)) return terminal(row, "rejected");
      const { settings } = availability.configuration(row.business_id);
      const api = await calendar();
      if (await confirmedConflict(row, api, settings.bufferMinutes)) return terminal(row, "rejected");
      if (!mappingMatches(row)) return terminal(row, "rejected");
      const business = db.prepare("SELECT business_name FROM businesses WHERE business_id=?").get(row.business_id);
      const requestBody = {
        id: row.event_id, summary: `${business.business_name} — ${row.customer_name}`,
        description: "Appointment confirmed through NukMiris WhatsApp.",
        start: { dateTime: row.slot_start, timeZone: settings.timeZone },
        end: { dateTime: row.slot_end, timeZone: settings.timeZone },
        transparency: "opaque",
        extendedProperties: { private: {
          nukmirisBusinessId: row.business_id, nukmirisCustomerId: row.sender_whatsapp_id,
          nukmirisInternalCustomerId: row.customer_id, nukmirisBookingRequestId: row.request_id, nukmirisPOC: "true",
        } },
      };
      attempted = true;
      const response = await api.events.insert({ calendarId: row.calendar_id, requestBody, sendUpdates: "none" }, { retry: false });
      if (!matches(response.data, row)) throw new Error("Calendar response did not verify the requested appointment");
      return terminal(row, "confirmed");
    } catch (error) {
      const code = Number(error.response?.status || error.code);
      if (!attempted || [400, 401, 403, 404, 410, 422].includes(code)) return terminal(row, "rejected");
      update(row, "uncertain");
      return reconcile(context);
    }
  }
  function decline(context) {
    if (!enabled) return { status: "disabled" };
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = lookup(context);
      if (!row) { db.exec("COMMIT"); return { status: "invalid" }; }
      if (row.state === "offered") update(row, "declined");
      db.exec("COMMIT");
      return result(row, ["pending", "uncertain"].includes(row.state) ? "uncertain" : row.state);
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  async function verify() {
    if (!enabled) throw new Error("Automatic booking is disabled");
    await authorize();
  }
  return { createIntent, confirm, decline, reconcile, invalidateOffers, verify };
}

module.exports = { prepareBookingSchema, createBookingService };
