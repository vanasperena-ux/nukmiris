"use strict";
const { DateTime } = require("luxon");
const { findAvailableSlots } = require("./availability");

const INITIAL_SEARCH_DAYS = 30;
const SEARCH_EXTENSION_DAYS = 15;
const TARGET_AVAILABLE_DATES = 3;
const MAX_BOOKING_HORIZON_DAYS = 365;
const defaults = Object.freeze({ initialSearchDays: INITIAL_SEARCH_DAYS, extensionDays: SEARCH_EXTENSION_DAYS,
  targetDates: TARGET_AVAILABLE_DATES, maxBookingHorizonDays: MAX_BOOKING_HORIZON_DAYS });
function validateSearchPolicy(overrides = {}) {
  const policy = { ...defaults, ...overrides };
  for (const key of Object.keys(defaults)) {
    if (!Number.isInteger(policy[key]) || policy[key] < 1 || policy[key] > MAX_BOOKING_HORIZON_DAYS) throw new Error(`Invalid availability search policy: ${key}`);
  }
  return policy;
}
function readSearchPolicy(env = process.env) {
  return validateSearchPolicy({
    initialSearchDays: Number(env.NUKMIRIS_INITIAL_SEARCH_DAYS || INITIAL_SEARCH_DAYS),
    extensionDays: Number(env.NUKMIRIS_SEARCH_EXTENSION_DAYS || SEARCH_EXTENSION_DAYS),
    targetDates: Number(env.NUKMIRIS_TARGET_AVAILABLE_DATES || TARGET_AVAILABLE_DATES),
    maxBookingHorizonDays: Number(env.NUKMIRIS_MAX_BOOKING_HORIZON_DAYS || MAX_BOOKING_HORIZON_DAYS),
  });
}
function dayOf(iso, zone) { return DateTime.fromISO(iso).setZone(zone).toISODate(); }
function selectedDate(slot, zone) { return { date: dayOf(slot.start, zone) }; }
function rangeError() { return Object.assign(new Error("The requested date is outside the booking horizon"), { code: "DATE_OUT_OF_RANGE" }); }
function bounds({ settings, now, policy, query = {} }) {
  const current = (typeof now === "string" ? DateTime.fromISO(now) : now).setZone(settings.timeZone);
  if (!current.isValid) throw new Error("Current time is invalid");
  const end = current.plus({ days: policy.maxBookingHorizonDays });
  function parse(value) {
    const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? DateTime.fromISO(value, { zone: settings.timeZone }) : null;
    if (!date?.isValid || date.toISODate() !== value) throw rangeError();
    return date;
  }
  if (query.date) {
    const date = parse(query.date);
    if (date < current.startOf("day") || date >= end) throw rangeError();
    return { current, start: DateTime.max(date, current), end: DateTime.min(date.plus({ days: 1 }), end), specific: true };
  }
  const start = query.afterDate ? DateTime.max(parse(query.afterDate).plus({ days: 1 }), current) : current;
  return { current, start, end, specific: false };
}
// Orchestrates ranges only; the existing engine still decides every bookable
// slot. Busy periods are carried within this request so buffers at a batch
// boundary do not require rereading a previously checked calendar interval.
async function searchAvailableSlots({ settings, now = DateTime.now(), policy = defaults, query = {}, readBusy, excludeSlot }) {
  policy = validateSearchPolicy(policy);
  const range = bounds({ settings, now, policy, query });
  if (range.start >= range.end) return [];
  let start = range.start;
  let end = range.specific ? range.end : DateTime.min(start.startOf("day").plus({ days: policy.initialSearchDays }), range.end);
  const periods = [], slots = [];
  let first = true;
  while (start < range.end) {
    const result = await readBusy({ start: first ? start.minus({ minutes: settings.bufferMinutes }) : start, end });
    if (!Array.isArray(result)) throw new Error("Calendar busy periods are required");
    periods.push(...result);
    const batch = findAvailableSlots({ settings, busyPeriods: periods, now: range.current,
      lookaheadDays: policy.maxBookingHorizonDays, rangeStart: start, rangeEnd: end });
    slots.push(...batch.filter(slot => !excludeSlot ||
      DateTime.fromISO(slot.start).toMillis() !== DateTime.fromISO(excludeSlot.start).toMillis() ||
      DateTime.fromISO(slot.end).toMillis() !== DateTime.fromISO(excludeSlot.end).toMillis()));
    const days = [...new Set(slots.map(slot => dayOf(slot.start, settings.timeZone)))];
    if (range.specific || days.length >= policy.targetDates) {
      const selected = new Set(days.slice(0, policy.targetDates));
      return slots.filter(slot => selected.has(dayOf(slot.start, settings.timeZone)));
    }
    start = end;
    end = DateTime.min(end.plus({ days: policy.extensionDays }), range.end);
    first = false;
  }
  return slots;
}
module.exports = { INITIAL_SEARCH_DAYS, SEARCH_EXTENSION_DAYS, TARGET_AVAILABLE_DATES, MAX_BOOKING_HORIZON_DAYS,
  readSearchPolicy, validateSearchPolicy, searchAvailableSlots, selectedDate, dayOf };
