"use strict";
const assert = require("node:assert/strict");
const { DateTime } = require("luxon");
const { createDatabase } = require("./database.cjs");
const { prepareBookingSchema, createBookingService } = require("../../lib/booking");
const { prepareManagementSchema, createAppointmentManagement } = require("../../lib/appointment-management");
const { createCalendarAvailability } = require("../../lib/google-calendar");

function fixture(filename = ":memory:") {
  const db = createDatabase(filename);
  prepareBookingSchema(db);
  prepareManagementSchema(db);
  for (const business of ["synthetic-a", "synthetic-b"]) {
    for (const sender of ["synthetic-one", "synthetic-two"]) {
      db.prepare("INSERT INTO business_customers VALUES (?,?,?,?,?,?)")
        .run(`${business}-${sender}`, business, sender, "Cliente Sintético", "fixture", "fixture");
    }
  }
  let current = DateTime.fromISO("2026-10-26T09:00:00-06:00", { setZone: true }), version = 0;
  const events = new Map(), inserts = [], patches = [], deletes = [], reads = [], lists = [], controls = {};
  const copy = value => structuredClone(value);
  function error(code) { return Object.assign(new Error("Synthetic Calendar failure"), { code }); }
  function all(calendarId) { return [...events.entries()].filter(([key]) => key.startsWith(`${calendarId}:`)).map(([, event]) => copy(event)); }
  function get(args) {
    const event = events.get(`${args.calendarId}:${args.eventId}`);
    if (!event) throw error(404);
    return event;
  }
  const api = {
    freebusy: { query: async ({ requestBody }) => {
      const id = requestBody.items[0].id;
      const busy = all(id).filter(event => event.status !== "cancelled" && event.transparency !== "transparent")
        .map(event => ({ start: event.start.dateTime || DateTime.fromISO(event.start.date, { zone: "America/Mexico_City" }).toISO(),
          end: event.end.dateTime || DateTime.fromISO(event.end.date, { zone: "America/Mexico_City" }).toISO() }));
      return { data: { calendars: { [id]: { busy } } } };
    } },
    events: {
      insert: async (args, options) => {
        assert.equal(options.retry, false);
        inserts.push(copy(args));
        const event = { ...copy(args.requestBody), status: "confirmed", etag: `"version-${++version}"` };
        events.set(`${args.calendarId}:${event.id}`, event);
        if (controls.afterInsert) await controls.afterInsert(args, event);
        return { data: copy(event) };
      },
      get: async args => {
        reads.push(copy(args));
        const event = copy(get(args));
        if (controls.afterGet) await controls.afterGet(args, event);
        return { data: event };
      },
      list: async args => {
        lists.push(copy(args));
        if (controls.failList) throw error(503);
        if (controls.listPages) return { data: copy(controls.listPages[args.pageToken || "first"]) };
        return { data: { items: all(args.calendarId).filter(event => !controls.omitIds?.has(event.id)) } };
      },
      patch: async (args, options) => {
        patches.push({ args: copy(args), options: copy(options) });
        assert.equal(options.retry, false);
        if (controls.beforePatch) await controls.beforePatch(args);
        if (controls.patchError) throw error(controls.patchError);
        const event = get(args);
        if (options.headers["If-Match"] !== event.etag) throw error(412);
        const updated = { ...event, ...copy(args.requestBody), etag: `"version-${++version}"` };
        events.set(`${args.calendarId}:${args.eventId}`, updated);
        if (controls.afterPatch) await controls.afterPatch(args, updated);
        if (controls.afterPatchError) throw error(controls.afterPatchError);
        return { data: copy(updated) };
      },
      delete: async (args, options) => {
        deletes.push({ args: copy(args), options: copy(options) });
        assert.equal(options.retry, false);
        if (controls.beforeDelete) await controls.beforeDelete(args);
        if (controls.deleteError) throw error(controls.deleteError);
        const event = get(args);
        if (options.headers["If-Match"] !== event.etag) throw error(412);
        events.set(`${args.calendarId}:${args.eventId}`, { id: args.eventId, status: "cancelled", etag: `"version-${++version}"` });
        if (controls.afterDeleteError) throw error(controls.afterDeleteError);
        return { data: "" };
      },
    },
  };
  const availability = createCalendarAvailability({ db, getClient: () => api, now: () => current, lookaheadDays: 7 });
  const bookingService = (connection = db) => createBookingService({ db: connection, availability, enabled: true,
    getClient: () => api, verifyAuthorization: async () => {}, now: () => current });
  const managementService = (connection = db) => createAppointmentManagement({ db: connection, availability, enabled: true,
    getClient: () => api, verifyAuthorization: async () => {}, now: () => current, lookaheadDays: 7 });
  const booking = bookingService(), management = managementService();
  const scope = (bookingRequestId, businessId = "synthetic-a", sender = "synthetic-one") => ({ bookingRequestId, businessId, sender });
  const changeScope = (requestId, businessId = "synthetic-a", sender = "synthetic-one") => ({ requestId, businessId, sender });
  const slot = (hour, duration = 60) => {
    const start = current.startOf("day").plus({ hours: hour });
    return { start: start.toISO(), end: start.plus({ minutes: duration }).toISO() };
  };
  async function seed({ businessId = "synthetic-a", sender = "synthetic-one", hour = 10, duration = 60, dayOffset = 0 } = {}) {
    const initial = slot(hour, duration);
    const target = { start: DateTime.fromISO(initial.start, { setZone: true }).plus({ days: dayOffset }).toISO(),
      end: DateTime.fromISO(initial.end, { setZone: true }).plus({ days: dayOffset }).toISO() };
    const intent = booking.createIntent({ businessId, sender, calendarId: `calendar-${businessId}`, slot: target });
    const result = await booking.confirm({ requestId: intent.requestId, businessId, sender });
    assert.equal(result.status, "confirmed");
    return { ...scope(intent.requestId, businessId, sender), eventId: result.eventId };
  }
  async function intent(source, kind = "reschedule", hour = 11, duration = 60) {
    const appointment = await management.readAppointment(source);
    return management.createIntent({ ...source, expectedEtag: appointment.etag, kind, slot: slot(hour, duration) });
  }
  return { db, api, events, inserts, patches, deletes, reads, lists, controls, availability,
    booking, management, bookingService, managementService, scope, changeScope, slot, seed, intent, error,
    setNow: value => { current = DateTime.fromISO(value, { setZone: true }); } };
}
module.exports = { fixture };
