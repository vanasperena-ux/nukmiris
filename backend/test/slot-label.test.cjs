"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DateTime } = require("luxon");
const { slotLabel } = require("../lib/slot-label");
const { createAvailabilityMenu } = require("../lib/availability-menu");
const { createManagementMenu } = require("../lib/management-menu");
const { readSearchPolicy } = require("../lib/availability-search");
const { DATE_PROMPT } = require("../lib/appointment-date");

const zone = "America/Mexico_City";
const months = [
  ["ene", "sáb"], ["feb", "mar"], ["mar", "mar"], ["abr", "vie"],
  ["may", "dom"], ["jun", "mié"], ["jul", "vie"], ["ago", "lun"],
  ["sept", "jue"], ["oct", "sáb"], ["nov", "mar"], ["dic", "jue"],
];
for (const [index, [month, weekday]] of months.entries()) {
  for (const [day, time] of [[2, "10:00"], [23, "23:05"]]) {
    test(`${month}: lowercase Spanish names, day ${day} without padding, 24-hour ${time}`, () => {
      const iso = `2027-${String(index + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${time}:00-06:00`;
      assert.equal(slotLabel(iso, zone), `${weekday} ${day} ${month} ${time}`);
    });
  }
}
for (const [index, weekday] of ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].entries()) {
  test(`Spanish weekday ${weekday}`, () => {
    const day = index + 5;
    assert.equal(slotLabel(`2027-04-${String(day).padStart(2, "0")}T09:07:00-06:00`, zone), `${weekday} ${day} abr 09:07`);
  });
}
for (const [iso, timeZone, expected] of [
  ["2027-04-02T02:00:00Z", zone, "jue 1 abr 20:00"],
  ["2027-04-02T02:00:00Z", "Asia/Tokyo", "vie 2 abr 11:00"],
  ["2027-01-01T02:00:00Z", zone, "jue 31 dic 20:00"],
  ["2026-12-31T20:00:00Z", "Asia/Tokyo", "vie 1 ene 05:00"],
]) test(`${iso} uses business timezone ${timeZone}, including year boundaries`, () => {
  assert.equal(slotLabel(iso, timeZone), expected);
});
for (const time of ["00:04", "12:00"]) test(`keeps HH:mm at ${time}`, () => {
  assert.equal(slotLabel(`2027-04-02T${time}:00-06:00`, zone), `vie 2 abr ${time}`);
});
test("every date in a leap year fits the 20-character button limit without truncation", () => {
  const first = DateTime.fromISO("2028-01-01T23:59:00", { zone });
  let longest = 0;
  for (let index = 0; index < 366; index++) {
    const label = slotLabel(first.plus({ days: index }).toISO(), zone);
    assert.match(label, /^(lun|mar|mié|jue|vie|sáb|dom) [1-9]\d? (ene|feb|mar|abr|may|jun|jul|ago|sept|oct|nov|dic) 23:59$/);
    assert(label.length <= 20);
    longest = Math.max(longest, label.length);
  }
  assert.equal(longest, 17);
});
test("invalid timestamps or business timezones cannot become customer labels", () => {
  assert.throws(() => slotLabel("invalid", zone), /valid slot timestamp/);
  assert.throws(() => slotLabel("2027-04-02T10:00:00Z", "invalid-zone"), /business timezone/);
});
for (const [timeZone, date, dayLabel] of [
  [zone, "31/12/2026", "jue 31 dic"], ["Asia/Tokyo", "1 ene 2027", "vie 1 ene"],
]) test(`all slot views use ${timeZone} while preserving timestamps, IDs, messages and selection`, async () => {
  const slots = [0, 1, 2, 3].map(index => ({
    start: `2026-12-31T${16 + index}:00:00Z`, end: `2026-12-31T${17 + index}:00:00Z`,
  }));
  const original = structuredClone(slots), outgoing = [], selected = [];
  let saved;
  const sessions = { get: () => structuredClone(saved), set: (from, value) => { saved = structuredClone(value); }, delete: () => { saved = undefined; } };
  const menu = createAvailabilityMenu({ sessions, businessFor: () => ({ business_id: "synthetic" }),
    availability: { configuration: () => ({ calendarId: "synthetic-calendar", settings: { timeZone }, searchPolicy: readSearchPolicy({}) }),
      listSlots: async () => structuredClone(slots) },
    now: () => DateTime.fromISO("2026-12-30T12:00:00Z"), bookingEnabled: true,
    sendReplyButtons: async (from, body, buttons) => outgoing.push({ body, buttons }),
    sendAppointmentList: async (from, body, rows) => outgoing.push({ body, rows }),
    sendMessage: async (from, body) => outgoing.push({ body }),
    onSelect: async (from, slot, session, command) => selected.push({ slot, command }),
  });
  const view = () => outgoing.at(-1);
  const expected = timeZone === zone ? ["10:00", "11:00", "12:00", "13:00"] : ["01:00", "02:00", "03:00", "04:00"];
  function assertSlots(offset) {
    assert.deepEqual(view().buttons.slice(0, 2).map(button => button.title), expected.slice(offset, offset + 2).map(time => `${dayLabel} ${time}`));
    assert.deepEqual(view().buttons.slice(0, 2).map(button => button.id), [offset, offset + 1].map(index => `availability:${saved.offerId}:slot:${index}`));
    assert.deepEqual(saved.slots, original);
  }
  await menu.offer("synthetic-customer"); assertSlots(0);
  assert.equal(view().body, "Elige un horario que te funciona mejor:");
  assert.equal(view().buttons[2].title, "Más opciones");
  await menu.handleSelection("synthetic-customer", view().buttons[2].id); assertSlots(2);
  assert.equal(view().body, "Te muestro mas opciones. Elige un horario que te funciona mejor:");
  assert.equal(view().buttons[2].title, "Elegir fecha");
  await menu.handleSelection("synthetic-customer", view().buttons[2].id);
  assert.equal(view().body, DATE_PROMPT);
  assert.equal(view().rows[0].title, timeZone === zone ? "jue 31 de diciembre" : "vie 1 de enero");
  await menu.handleText("synthetic-customer", date); assertSlots(0);
  assert.equal(view().body, timeZone === zone
    ? "¿Qué hora prefieres para el jueves 31 de diciembre 2026?\n\nSelecciona el horario que prefieres. Para cambiar de día, escribe otra fecha."
    : "¿Qué hora prefieres para el viernes 1 de enero 2027?\n\nSelecciona el horario que prefieres. Para cambiar de día, escribe otra fecha.");
  await menu.handleSelection("synthetic-customer", view().buttons[2].id); assertSlots(2);
  assert.equal(view().buttons[2].title, "Elegir otra fecha");
  const command = view().buttons[0].id;
  await menu.handleSelection("synthetic-customer", command);
  assert.deepEqual(selected, [{ slot: original[2], command }]);
  assert.deepEqual(slots, original);
});
for (const [timeZone, dayLabel, firstHour] of [
  [zone, "jue 31 dic", 10], ["Asia/Tokyo", "vie 1 ene", 1],
]) {
  for (const command of ["Cancelar", "Reagendar"]) test(`${command} appointment lists and later pages use ${timeZone} at the year boundary`, async () => {
    const first = DateTime.fromISO("2026-12-31T16:00:00Z", { setZone: true });
    const appointments = Array.from({ length: 9 }, (_, index) => ({
      bookingRequestId: `synthetic-request-${index}`, etag: `synthetic-etag-${index}`,
      start: first.plus({ hours: index }).toISO(), end: first.plus({ hours: index + 1 }).toISO(),
    }));
    const original = structuredClone(appointments), outgoing = [];
    let saved;
    const sessions = { get: () => structuredClone(saved), set: (from, value) => { saved = structuredClone(value); }, delete: () => { saved = undefined; } };
    const menu = createManagementMenu({ sessions, businessFor: () => ({ business_id: "synthetic" }),
      availability: { configuration: () => ({ settings: { timeZone } }) },
      management: { invalidateOffers() {}, listAppointments: async scope => {
        assert.deepEqual(scope, { businessId: "synthetic", sender: "synthetic-customer" });
        return structuredClone(appointments);
      } },
      sendReplyButtons: async (from, body, buttons) => outgoing.push({ body, choices: buttons }),
      sendAppointmentList: async (from, body, rows) => outgoing.push({ body, choices: rows }),
    });
    const view = () => outgoing.at(-1);
    const label = hour => `${dayLabel} ${String(hour).padStart(2, "0")}:00`;
    await menu.handleText("synthetic-customer", command);
    assert.equal(view().body, command === "Cancelar"
      ? "Selecciona la cita que deseas cancelar. Se cancelará al seleccionarla."
      : "Selecciona la cita que deseas reagendar.");
    const body = view().body;
    assert.deepEqual(view().choices.slice(0, 8).map(row => row.title), Array.from({ length: 8 }, (_, index) => label(firstHour + index)));
    assert.deepEqual(view().choices.slice(0, 8).map(row => row.id), Array.from({ length: 8 }, (_, index) => `owned:${saved.selectionId}:pick:${index}`));
    assert.equal(view().choices[0].description, `Termina: ${label(firstHour + 1)}`);
    assert(view().choices.slice(0, 8).every(row => row.title.length <= 20));
    assert.deepEqual(saved.appointments, original);
    await menu.handleInteractive("synthetic-customer", view().choices[8].id);
    assert.equal(view().body, body);
    assert.equal(view().choices[0].title, label(firstHour + 8));
    assert.equal(view().choices[0].description, `Termina: ${label(firstHour + 9)}`);
    assert.equal(view().choices[0].id, `owned:${saved.selectionId}:pick:8`);
    assert.deepEqual(saved.appointments, original);
    assert.deepEqual(appointments, original);
  });
}
