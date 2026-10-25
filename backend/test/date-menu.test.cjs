"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DateTime } = require("luxon");
const { createDatabase } = require("./helpers/database.cjs");
const { createCalendarAvailability } = require("../lib/google-calendar");
const { createAvailabilityMenu } = require("../lib/availability-menu");
const { readSearchPolicy } = require("../lib/availability-search");

async function fixture({ current = "2026-10-26T19:30:00-06:00", horizon = 365 } = {}) {
  const db = createDatabase(), now = DateTime.fromISO(current, { setZone: true });
  const calls = [], outgoing = [], records = new Map(), controls = {};
  const availability = createCalendarAvailability({ db, now: () => now,
    policy: { ...readSearchPolicy({}), maxBookingHorizonDays: horizon }, getClient: () => ({
      freebusy: { query: async ({ requestBody }) => {
        calls.push(requestBody);
        if (controls.fail) throw new Error("Synthetic calendar failure");
        return { data: { calendars: { "calendar-synthetic-a": { busy: [] } } } };
      } },
    }) });
  const sessions = { get: key => records.has(key) ? structuredClone(records.get(key)) : undefined,
    set: (key, value) => records.set(key, structuredClone(value)), delete: key => records.delete(key) };
  const menu = createAvailabilityMenu({ availability, sessions, now: () => now,
    businessFor: () => ({ business_id: "synthetic-a" }), onSelect: () => { throw new Error("No mutation in date tests"); },
    sendMessage: async (from, body) => outgoing.push({ body }),
    sendReplyButtons: async (from, body, buttons) => outgoing.push({ body, buttons }),
    sendAppointmentList: async (from, body, rows) => outgoing.push({ body, rows }),
  });
  await menu.offer("synthetic-customer"); calls.length = 0; outgoing.length = 0;
  return { db, calls, outgoing, sessions, controls, menu, session: () => sessions.get("synthetic-customer") };
}
test("today's bare weekday after closing uses the same real availability rules and then next week", async () => {
  const f = await fixture();
  try {
    await f.menu.handleText("synthetic-customer", "lunes");
    assert.deepEqual(f.calls.map(call => DateTime.fromISO(call.timeMin).setZone("America/Mexico_City").toISODate()), ["2026-10-26", "2026-11-02"]);
    assert.equal(f.session().selectedDate, "2026-11-02");
    assert.equal(f.outgoing.length, 1); assert.equal(f.outgoing[0].buttons[0].title, "10:00");
  } finally { f.db.close(); }
});
test("weekday fallback never queries outside a smaller configured horizon and keeps the current session", async () => {
  const f = await fixture({ horizon: 3 });
  try {
    const original = f.session();
    await f.menu.handleText("synthetic-customer", "lunes");
    assert.equal(f.calls.length, 1); assert.deepEqual(f.session(), original);
    assert.equal(f.outgoing[0].body, "Por ahora solo podemos agendar citas dentro de los próximos 3 días. ¿Qué otra fecha te gustaría?");
  } finally { f.db.close(); }
});
test("a smaller business horizon rejects a parsed future date before making a calendar call", async () => {
  const f = await fixture({ horizon: 30 });
  try {
    const original = f.session();
    await f.menu.handleText("synthetic-customer", "en 31 días");
    assert.equal(f.calls.length, 0); assert.deepEqual(f.session(), original);
    assert.match(f.outgoing[0].body, /próximos 30 días/);
  } finally { f.db.close(); }
});
test("a calendar failure does not trigger weekday fallback or overwrite the selected-date state", async () => {
  const f = await fixture();
  try {
    const original = f.session(); f.controls.fail = true;
    await assert.rejects(f.menu.handleText("synthetic-customer", "lunes"), /Synthetic calendar failure/);
    assert.equal(f.calls.length, 1); assert.deepEqual(f.session(), original); assert.equal(f.outgoing.length, 0);
    f.controls.fail = false;
    await f.menu.handleText("synthetic-customer", "en 3 días");
    assert.equal(f.session().selectedDate, "2026-10-29");
  } finally { f.db.close(); }
});
