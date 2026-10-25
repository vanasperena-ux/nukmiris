"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DateTime } = require("luxon");
const { createDatabase, settings: defaultSettings } = require("./helpers/database.cjs");
const { saveBusinessConfiguration } = require("../lib/business-config");
const { createCalendarAvailability } = require("../lib/google-calendar");
const { readSearchPolicy, selectedDate, dayOf } = require("../lib/availability-search");
const { fixture: managementFixture } = require("./helpers/management-fixture.cjs");
const { createBookingService } = require("../lib/booking");
const { createAppointmentManagement } = require("../lib/appointment-management");

function fixture({ current = "2026-10-26T09:00:00-06:00", settings = defaultSettings, getSearchPolicy } = {}) {
  const db = createDatabase(), now = DateTime.fromISO(current, { setZone: true }).setZone(settings.timeZone);
  saveBusinessConfiguration(db, { businessId: "synthetic-a", calendarId: "calendar-synthetic-a", phoneNumberId: "phone-synthetic-a", settings });
  const periods = [], calls = [], controls = {};
  const api = {
    calendarList: { get: async ({ calendarId }) => ({ data: { id: calendarId, accessRole: "writer" } }) },
    freebusy: { query: async (args, options) => {
      const request = args.requestBody; calls.push({ ...request, options });
      assert.equal(options.timeout, 15000); assert.equal(options.retry, false);
      if (controls.failure && (!controls.failAtCall || calls.length === controls.failAtCall)) throw controls.failure;
      const first = DateTime.fromISO(request.timeMin), last = DateTime.fromISO(request.timeMax);
      const busy = periods.map(period => ({
        start: DateTime.max(first, DateTime.fromISO(period.start)), end: DateTime.min(last, DateTime.fromISO(period.end)),
      })).filter(period => period.start < period.end).map(period => ({ start: period.start.toISO(), end: period.end.toISO() }));
      return { data: { calendars: { [request.items[0].id]: { busy } } } };
    } },
  };
  const availability = createCalendarAvailability({ db, getClient: () => api, now: () => now, policy: readSearchPolicy({}), getSearchPolicy });
  const addBusy = (start, end) => periods.push({ start: start.toISO(), end: end.toISO() });
  const dates = slots => [...new Set(slots.map(slot => dayOf(slot.start, settings.timeZone)))];
  function nonoverlapping() {
    for (let index = 1; index < calls.length; index++) assert.equal(DateTime.fromISO(calls[index].timeMin).toMillis(), DateTime.fromISO(calls[index - 1].timeMax).toMillis());
    assert(calls.every(call => DateTime.fromISO(call.timeMax) <= now.plus({ days: 365 })));
  }
  return { db, now, settings, periods, calls, controls, availability, addBusy, dates, nonoverlapping };
}
test("three available dates in the first 30 calendar days use a single batch and keep every time on those dates", async () => {
  const f = fixture();
  try {
    const slots = await f.availability.listSlots("synthetic-a");
    assert.deepEqual(f.dates(slots), ["2026-10-26", "2026-10-27", "2026-10-28"]);
    assert.equal(slots.length, 24); assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].timeMax, f.now.startOf("day").plus({ days: 30 }).toISO());
    assert.deepEqual(f.calls[0].items, [{ id: "calendar-synthetic-a" }]);
  } finally { f.db.close(); }
});
for (const days of [30, 45, 60, 180]) test(`a business fully booked for ${days} days extends only into new 15-day batches`, async () => {
  const f = fixture();
  try {
    const closedUntil = f.now.startOf("day").plus({ days }); f.addBusy(f.now.startOf("day"), closedUntil);
    const slots = await f.availability.listSlots("synthetic-a");
    let earliest = closedUntil; while (earliest.weekday > 5) earliest = earliest.plus({ days: 1 });
    assert.equal(f.dates(slots)[0], earliest.toISODate()); assert.equal(f.dates(slots).length, 3);
    assert.equal(f.calls.length, days === 30 ? 2 : days === 45 ? 3 : days === 60 ? 4 : 12);
    f.nonoverlapping();
  } finally { f.db.close(); }
});
test("only two available dates in a year are returned after checking the capped horizon", async () => {
  const f = fixture();
  try {
    let one = f.now.startOf("day").plus({ days: 200 }), two = f.now.startOf("day").plus({ days: 300 });
    while (one.weekday > 5) one = one.plus({ days: 1 }); while (two.weekday > 5) two = two.plus({ days: 1 });
    f.addBusy(f.now.startOf("day"), one); f.addBusy(one.plus({ days: 1 }), two); f.addBusy(two.plus({ days: 1 }), f.now.plus({ days: 366 }));
    const slots = await f.availability.listSlots("synthetic-a");
    assert.deepEqual(f.dates(slots), [one.toISODate(), two.toISODate()]);
    assert.equal(f.calls.length, 24); f.nonoverlapping();
    assert.equal(f.calls.at(-1).timeMax, f.now.plus({ days: 365 }).toISO());
  } finally { f.db.close(); }
});
test("no availability inside 365 days returns empty without querying a later date", async () => {
  const f = fixture();
  try {
    f.addBusy(f.now.startOf("day"), f.now.plus({ days: 400 }));
    assert.deepEqual(await f.availability.listSlots("synthetic-a"), []);
    assert.equal(f.calls.length, 24); f.nonoverlapping();
  } finally { f.db.close(); }
});
test("a specific far-future date is queried directly even when earlier dates are available", async () => {
  const f = fixture();
  try {
    let date = f.now.startOf("day").plus({ days: 180 }); while (date.weekday > 5) date = date.plus({ days: 1 });
    const slots = await f.availability.listSlots("synthetic-a", { date: date.toISODate() });
    assert.deepEqual(f.dates(slots), [date.toISODate()]); assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].timeMin, date.toISO()); assert.equal(f.calls[0].timeMax, date.plus({ days: 1 }).toISO());
    await assert.rejects(f.availability.listSlots("synthetic-a", { date: f.now.plus({ days: 366 }).toISODate() }), { code: "DATE_OUT_OF_RANGE" });
    assert.equal(f.calls.length, 1);
  } finally { f.db.close(); }
});
test("the booking-horizon cutoff also clamps a directly requested final partial day", async () => {
  const settings = { ...defaultSettings, workingDays: [1, 2, 3, 4, 5, 6, 7], openingTime: "06:00", closingTime: "12:00", breaks: [] };
  const f = fixture({ settings });
  try {
    const date = f.now.plus({ days: 365 });
    const slots = await f.availability.listSlots("synthetic-a", { date: date.toISODate() });
    assert(slots.length > 0); assert(slots.every(slot => DateTime.fromISO(slot.end) <= date));
    assert.equal(f.calls[0].timeMax, date.toISO());
  } finally { f.db.close(); }
});
test("buffers carry across a batch boundary without an overlapping API range", async () => {
  const settings = { ...defaultSettings, workingDays: [1, 2, 3, 4, 5, 6, 7], openingTime: "00:00", closingTime: "23:00",
    durationMinutes: 30, startIntervalMinutes: 15, bufferMinutes: 15, breaks: [] };
  const f = fixture({ settings });
  try {
    const boundary = f.now.startOf("day").plus({ days: 30 });
    f.addBusy(f.now.startOf("day"), boundary.minus({ minutes: 5 }));
    const slots = await f.availability.listSlots("synthetic-a");
    assert.equal(DateTime.fromISO(slots[0].start).setZone(settings.timeZone).toFormat("HH:mm"), "00:15");
    assert.equal(f.dates(slots)[0], boundary.toISODate()); f.nonoverlapping();
  } finally { f.db.close(); }
});
test("month/year boundaries keep chronological dates and configured hours", async () => {
  const f = fixture({ current: "2026-12-20T09:00:00-06:00" });
  try {
    f.addBusy(f.now.startOf("day"), DateTime.fromISO("2027-01-02T00:00:00-06:00", { setZone: true }));
    assert.deepEqual(f.dates(await f.availability.listSlots("synthetic-a")), ["2027-01-04", "2027-01-05", "2027-01-06"]);
    assert.equal(f.calls.length, 1);
  } finally { f.db.close(); }
});
for (const [current, date, hours] of [["2027-03-01T09:00:00-05:00", "2027-03-14", 23], ["2026-10-26T09:00:00-04:00", "2026-11-01", 25]]) {
  test(`a ${hours}-hour daylight-saving day uses local date boundaries`, async () => {
    const settings = { ...defaultSettings, timeZone: "America/New_York", workingDays: [1, 2, 3, 4, 5, 6, 7], openingTime: "00:00", closingTime: "04:00",
      durationMinutes: 30, startIntervalMinutes: 30, bufferMinutes: 0, breaks: [] };
    const f = fixture({ current, settings });
    try {
      const slots = await f.availability.listSlots("synthetic-a", { date });
      assert.equal(DateTime.fromISO(f.calls[0].timeMax).diff(DateTime.fromISO(f.calls[0].timeMin), "hours").hours, hours);
      if (hours === 23) assert(!slots.some(slot => DateTime.fromISO(slot.start).setZone(settings.timeZone).hour === 2));
      assert.equal(new Set(slots.map(slot => DateTime.fromISO(slot.start).toMillis())).size, slots.length);
    } finally { f.db.close(); }
  });
}
test("Calendar failures/timeouts stop the search and never masquerade as no availability", async () => {
  for (const code of [503, "ETIMEDOUT"]) {
    const f = fixture();
    try {
      f.controls.failure = Object.assign(new Error("Synthetic Calendar failure"), { code });
      await assert.rejects(f.availability.listSlots("synthetic-a"), { code });
      assert.equal(f.calls.length, 1);
    } finally { f.db.close(); }
  }
});
test("an extension failure does not return a misleading partial set of available dates", async () => {
  const f = fixture();
  try {
    f.addBusy(f.now.startOf("day").plus({ days: 2 }), f.now.plus({ days: 400 }));
    f.controls.failure = Object.assign(new Error("Synthetic extension timeout"), { code: "ETIMEDOUT" });
    f.controls.failAtCall = 2;
    await assert.rejects(f.availability.listSlots("synthetic-a"), { code: "ETIMEDOUT" });
    assert.equal(f.calls.length, 2); f.nonoverlapping();
  } finally { f.db.close(); }
});
test("readiness checks one date and business policy overrides can narrow the horizon", async () => {
  const f = fixture({ getSearchPolicy: id => id === "synthetic-b" ? { maxBookingHorizonDays: 45 } : {} });
  try {
    f.addBusy(f.now.startOf("day"), f.now.plus({ days: 400 }));
    await f.availability.verify("synthetic-a"); assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].timeMax, f.now.startOf("day").plus({ days: 1 }).toISO());
    f.calls.length = 0;
    assert.deepEqual(await f.availability.listSlots("synthetic-b"), []);
    assert.equal(f.calls.at(-1).timeMax, f.now.plus({ days: 45 }).toISO());
    assert(f.calls.every(call => call.items[0].id === "calendar-synthetic-b"));
  } finally { f.db.close(); }
});
test("configuration has one set of POC defaults and rejects invalid limits", () => {
  assert.deepEqual(readSearchPolicy({}), { initialSearchDays: 30, extensionDays: 15, targetDates: 3, maxBookingHorizonDays: 365 });
  assert.deepEqual(readSearchPolicy({ NUKMIRIS_LOOKAHEAD_DAYS: "14" }), readSearchPolicy({}));
  assert.throws(() => readSearchPolicy({ NUKMIRIS_MAX_BOOKING_HORIZON_DAYS: "366" }));
  assert.throws(() => readSearchPolicy({ NUKMIRIS_SEARCH_EXTENSION_DAYS: "0" }));
});
test("booking and rescheduling a specific date beyond the first three suggestions still succeed once", async () => {
  const f = managementFixture();
  try {
    const now = DateTime.fromISO("2026-10-26T09:00:00-06:00", { setZone: true });
    const availability = createCalendarAvailability({ db: f.db, getClient: () => f.api, now: () => now });
    const booking = createBookingService({ db: f.db, availability, enabled: true, getClient: () => f.api, verifyAuthorization: async () => {}, now: () => now });
    const manager = createAppointmentManagement({ db: f.db, availability, enabled: true, getClient: () => f.api, verifyAuthorization: async () => {}, now: () => now });
    let far = now.startOf("day").plus({ days: 180 }); while (far.weekday > 5) far = far.plus({ days: 1 });
    const slot = { start: far.plus({ hours: 10 }).toISO(), end: far.plus({ hours: 11 }).toISO() };
    assert(!(await availability.listSlots("synthetic-a")).some(item => item.start === slot.start));
    const intent = booking.createIntent({ businessId: "synthetic-a", sender: "synthetic-one", calendarId: "calendar-synthetic-a", slot });
    assert.equal((await booking.confirm(f.changeScope(intent.requestId))).status, "confirmed");
    const source = f.scope(intent.requestId), appointment = await manager.readAppointment(source);
    const nextDay = far.plus({ days: 1 });
    const target = { start: nextDay.plus({ hours: 10 }).toISO(), end: nextDay.plus({ hours: 11 }).toISO() };
    const change = await manager.createIntent({ ...source, expectedEtag: appointment.etag, kind: "reschedule", slot: target });
    assert.equal((await manager.confirm(f.changeScope(change.requestId))).status, "applied");
    assert.equal(f.inserts.length, 1); assert.equal(f.patches.length, 1);
    assert.equal(f.patches[0].args.eventId, f.inserts[0].requestBody.id);
  } finally { f.db.close(); }
});
test("rescheduling also searches past a six-month all-day closure in non-overlapping batches", async () => {
  const f = managementFixture();
  try {
    const source = await f.seed();
    const now = DateTime.fromISO("2026-10-26T09:00:00-06:00", { setZone: true });
    const closedUntil = now.startOf("day").plus({ days: 180 });
    f.events.set("calendar-synthetic-a:closed", { id: "closed", status: "confirmed",
      start: { date: now.toISODate() }, end: { date: closedUntil.toISODate() } });
    const originalList = f.api.events.list;
    f.api.events.list = (args, options) => {
      assert.equal(options.timeout, 15000); assert.equal(options.retry, false);
      return originalList(args);
    };
    const availability = createCalendarAvailability({ db: f.db, getClient: () => f.api, now: () => now });
    const manager = createAppointmentManagement({ db: f.db, availability, enabled: true, getClient: () => f.api,
      verifyAuthorization: async () => {}, now: () => now });
    const slots = await manager.listSlots(source);
    let first = closedUntil; while (first.weekday > 5) first = first.plus({ days: 1 });
    assert.equal(dayOf(slots[0].start, "America/Mexico_City"), first.toISODate());
    assert.equal(new Set(slots.map(slot => dayOf(slot.start, "America/Mexico_City"))).size, 3);
    assert.equal(f.lists.length, 12);
    for (let index = 1; index < f.lists.length; index++) {
      assert.equal(f.lists[index].timeMin, f.lists[index - 1].timeMax);
    }
    assert.equal(f.patches.length, 0); assert.equal(f.deletes.length, 0);
  } finally { f.db.close(); }
});
