"use strict";

const { DateTime } = require("luxon");

function minutes(value, label) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) throw new Error(`${label} must use HH:mm`);
  const [hour, minute] = value.split(":").map(Number);
  if (hour > 23 || minute > 59) throw new Error(`${label} is invalid`);
  return hour * 60 + minute;
}

function validateSettings(settings) {
  if (!settings || typeof settings.timeZone !== "string" || !settings.timeZone || !DateTime.now().setZone(settings.timeZone).isValid) throw new Error("A valid business time zone is required");
  if (!Array.isArray(settings.workingDays) || settings.workingDays.length === 0 ||
      settings.workingDays.some(day => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new Error("Working days must use ISO weekday numbers 1 through 7");
  }
  const opening = minutes(settings.openingTime, "Opening time");
  const closing = minutes(settings.closingTime, "Closing time");
  if (closing <= opening) throw new Error("Closing time must be after opening time; overnight hours are not supported");
  for (const [key, minimum] of [["durationMinutes", 1], ["bufferMinutes", 0], ["startIntervalMinutes", 1]]) {
    if (!Number.isInteger(settings[key]) || settings[key] < minimum || settings[key] > 1440) {
      throw new Error(`${key} must be an explicitly configured integer between ${minimum} and 1440`);
    }
  }
  if (!Array.isArray(settings.breaks)) throw new Error("Breaks must be explicitly configured; use [] for none");
  for (const pause of settings.breaks) {
    const start = minutes(pause.start, "Break start");
    const end = minutes(pause.end, "Break end");
    if (start < opening || end > closing || end <= start) throw new Error("Breaks must fit inside business hours");
  }
  return settings;
}

function atMinute(day, minute) {
  const hour = Math.floor(minute / 60);
  const value = day.set({ hour, minute: minute % 60, second: 0, millisecond: 0 });
  // Reject nonexistent wall-clock times instead of shifting a DST booking silently.
  return value.hour === hour && value.minute === minute % 60 ? value : null;
}

function overlaps(start, end, blockedStart, blockedEnd) {
  return start < blockedEnd && end > blockedStart;
}

function findAvailableSlots({ settings, busyPeriods, now = DateTime.now(), lookaheadDays = 14 }) {
  validateSettings(settings);
  if (!Number.isInteger(lookaheadDays) || lookaheadDays < 1 || lookaheadDays > 90) throw new Error("Lookahead must be between 1 and 90 days");
  if (!Array.isArray(busyPeriods)) throw new Error("Calendar busy periods are required");
  const current = (typeof now === "string" ? DateTime.fromISO(now) : now).setZone(settings.timeZone);
  if (!current.isValid) throw new Error("Current time is invalid");
  const until = current.plus({ days: lookaheadDays });
  const busy = busyPeriods.map(period => {
    const start = DateTime.fromISO(period.start, { setZone: true });
    const end = DateTime.fromISO(period.end, { setZone: true });
    if (!start.isValid || !end.isValid || end <= start) throw new Error("Calendar returned an invalid busy period");
    return { start: start.toMillis(), end: end.plus({ minutes: settings.bufferMinutes }).toMillis() };
  });
  const opening = minutes(settings.openingTime, "Opening time");
  const closing = minutes(settings.closingTime, "Closing time");
  const slots = [];
  for (let index = 0; index <= lookaheadDays; index++) {
    const day = current.startOf("day").plus({ days: index });
    if (!settings.workingDays.includes(day.weekday)) continue;
    const close = atMinute(day, closing);
    if (!close) continue;
    const breaks = settings.breaks.map(pause => ({
      start: atMinute(day, minutes(pause.start, "Break start")),
      end: atMinute(day, minutes(pause.end, "Break end")),
    }));
    if (breaks.some(pause => !pause.start || !pause.end)) continue;
    for (let minute = opening; minute < closing; minute += settings.startIntervalMinutes) {
      const start = atMinute(day, minute);
      if (!start || start <= current) continue;
      const end = start.plus({ minutes: settings.durationMinutes });
      const occupiedEnd = end.plus({ minutes: settings.bufferMinutes });
      if (occupiedEnd > close || occupiedEnd > until) continue;
      const first = start.toMillis();
      const last = occupiedEnd.toMillis();
      if (busy.some(period => overlaps(first, last, period.start, period.end))) continue;
      if (breaks.some(pause => overlaps(first, last, pause.start.toMillis(), pause.end.toMillis()))) continue;
      slots.push({ start: start.toISO(), end: end.toISO() });
    }
  }
  return slots;
}

module.exports = { findAvailableSlots, validateSettings };
