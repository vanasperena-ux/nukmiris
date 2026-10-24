"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DateTime } = require("luxon");
const { findAvailableSlots, validateSettings } = require("../lib/availability");

// Synthetic hours, not the owner's unconfirmed business settings.
const settings = {
  timeZone: "America/Mexico_City", workingDays: [1, 2, 3, 4, 5],
  openingTime: "09:00", closingTime: "18:00", durationMinutes: 60,
  bufferMinutes: 15, startIntervalMinutes: 15, breaks: [{ start: "13:00", end: "14:00" }],
};
const now = "2026-10-26T08:00:00-06:00";
const run = overrides => findAvailableSlots({ settings, busyPeriods: [], now, lookaheadDays: 1, ...overrides });
const times = slots => slots.map(slot => DateTime.fromISO(slot.start).setZone(settings.timeZone).toFormat("HH:mm"));

test("generates every configured start time rather than three hardcoded hours", () => {
  const available = times(run());
  assert(available.includes("09:15"));
  assert(available.includes("11:30"));
  assert(available.includes("16:45"));
  assert(available.length > 10);
  assert(!available.includes("17:00"), "service plus buffer must finish before closing");
});

test("removes slots overlapping busy events and their cleanup buffer", () => {
  const available = times(run({ busyPeriods: [{ start: "2026-10-26T10:00:00-06:00", end: "2026-10-26T11:00:00-06:00" }] }));
  for (const blocked of ["09:00", "09:15", "10:00", "10:45", "11:00"]) assert(!available.includes(blocked));
  assert(available.includes("11:15"), "exact end of buffer is available");
});

test("allows touching boundaries but keeps appointments and cleanup outside lunch", () => {
  const available = times(run());
  assert(available.includes("11:45"));
  assert(!available.includes("12:00"));
  assert(!available.includes("13:00"));
  assert(available.includes("14:00"));
});

test("does not offer past slots, closed weekdays, or times beyond the lookahead", () => {
  const slots = run({ now: "2026-10-30T16:30:00-06:00", lookaheadDays: 3 });
  assert(slots.length > 0);
  for (const slot of slots) {
    const start = DateTime.fromISO(slot.start).setZone(settings.timeZone);
    assert(start > DateTime.fromISO("2026-10-30T16:30:00-06:00"));
    assert(start.weekday <= 5);
    assert(DateTime.fromISO(slot.end).plus({ minutes: 15 }) <= DateTime.fromISO("2026-11-02T16:30:00-06:00"));
  }
});

test("supports different service lengths, opening hours, days, and start intervals", () => {
  const custom = { ...settings, workingDays: [7], openingTime: "11:10", closingTime: "15:00", durationMinutes: 45, bufferMinutes: 0, startIntervalMinutes: 30, breaks: [] };
  const slots = run({ settings: custom, now: "2026-11-01T10:00:00-06:00" });
  assert.deepEqual(times(slots), ["11:10", "11:40", "12:10", "12:40", "13:10", "13:40", "14:10"]);
  assert.equal(DateTime.fromISO(slots[0].end).diff(DateTime.fromISO(slots[0].start), "minutes").minutes, 45);
});

test("does not invent missing closing times, buffer, intervals, or breaks", () => {
  for (const field of ["closingTime", "bufferMinutes", "startIntervalMinutes", "breaks"]) {
    assert.throws(() => validateSettings({ ...settings, [field]: undefined }));
  }
});

test("rejects invalid dates, hours, durations, busy periods, and time zones", () => {
  for (const changed of [{ openingTime: "25:00" }, { closingTime: "08:00" }, { durationMinutes: 0 }, { startIntervalMinutes: 0 }, { timeZone: "Unknown/Timezone" }]) {
    assert.throws(() => run({ settings: { ...settings, ...changed } }));
  }
  assert.throws(() => run({ busyPeriods: [{ start: "invalid", end: "invalid" }] }));
  assert.throws(() => run({ lookaheadDays: 0 }));
});

test("an all-day busy event blocks the business day", () => {
  assert.equal(run({ busyPeriods: [{ start: "2026-10-26T00:00:00-06:00", end: "2026-10-27T00:00:00-06:00" }] }).length, 0);
});

test("Juanita's confirmed schedule offers consecutive hours, skips lunch, and finishes at 19:00", () => {
  const confirmed = require("../config/juanita.example.json").settings;
  const slots = run({ settings: confirmed });
  assert.deepEqual(times(slots), ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"]);
  assert.equal(DateTime.fromISO(slots.at(-1).end).setZone(confirmed.timeZone).toFormat("HH:mm"), "19:00");
  const occupied = run({ settings: confirmed, busyPeriods: [{ start: "2026-10-26T10:00:00-06:00", end: "2026-10-26T11:00:00-06:00" }] });
  assert(!times(occupied).includes("10:00"));
  assert(times(occupied).includes("11:00"));
});
