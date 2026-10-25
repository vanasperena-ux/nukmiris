"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseAppointmentDate, dateErrorMessage, DATE_PROMPT } = require("../lib/appointment-date");
const reference = "2026-10-24T12:00:00-06:00";
const parse = (text, options = {}) => parseAppointmentDate(text, {
  now: reference, timeZone: "America/Mexico_City", maxBookingHorizonDays: 365, ...options,
});
function expectDate(text, expected, options) {
  const result = parse(text, options);
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.date, expected); assert.equal(result.error, null);
  return result;
}
for (const text of ["13/10", "13/10/2026", "13-10", "13-10-2026", "13.10", "13.10.2026", "13 10", "13 10 2026"]) {
  test(`LATAM numeric date: ${text}`, () => expectDate(text, "2026-10-13", { now: "2026-10-01T09:00:00-06:00" }));
}
test("numeric dates are always day/month, with omitted-year rollover", () => {
  expectDate("04/11", "2026-11-04"); expectDate("13/10", "2027-10-13");
  expectDate("13/10/2027", "2027-10-13");
  assert.equal(parse("11/13").error, "INVALID");
});
const monthCases = [
  ["enero", "ene", "2026-01-13"], ["febrero", "feb", "2026-02-13"], ["marzo", "mar", "2026-03-13"],
  ["abril", "abr", "2026-04-13"], ["mayo", "may", "2026-05-13"], ["junio", "jun", "2026-06-13"],
  ["julio", "jul", "2026-07-13"], ["agosto", "ago", "2026-08-13"], ["septiembre", "sep", "2026-09-13"],
  ["octubre", "oct", "2026-10-13"], ["noviembre", "nov", "2026-11-13"], ["diciembre", "dic", "2026-12-13"],
];
for (const [full, short, expected] of monthCases) for (const month of [full, short]) {
  test(`Spanish month: ${month}`, () => expectDate(`13 ${month}`, expected, { now: "2026-01-01T09:00:00-06:00" }));
}
for (const text of ["13 octubre", "13 oct", "13 de octubre", "13 de oct", "13 octubre 2027", "13 de octubre de 2027",
  "13 OCT", "13 Octubre", "13 oct.", "quiero el 13 de octubre", "para el 13 oct", "¿*13 OCT*?", " 13   de OCTUBRE "]) {
  test(`month wording and polite prefix: ${text}`, () => expectDate(text, "2027-10-13"));
}
test("September variants and December/year boundary are real calendar dates", () => {
  for (const text of ["13 sept", "13 setiembre", "13 set"]) expectDate(text, "2027-09-13");
  expectDate("1 ene", "2027-01-01", { now: "2026-12-31T23:59:00-06:00" });
});
const relativeCases = [
  ["hoy", "2026-10-24"], ["mañana", "2026-10-25"], ["pasado mañana", "2026-10-26"],
  ["puede ser mañana", "2026-10-25"], ["para pasado mañana", "2026-10-26"], ["¡MAÑANA!", "2026-10-25"],
  ["en 3 días", "2026-10-27"], ["dentro de una semana", "2026-10-31"], ["en dos semanas", "2026-11-07"],
  ["dentro de 2 semanas", "2026-11-07"], ["mañana, por favor", "2026-10-25"], ["en cero dias", null],
];
for (const [text, expected] of relativeCases) test(`relative date: ${text}`, () => {
  if (expected) expectDate(text, expected); else assert.equal(parse(text).error, "INVALID");
});
for (const [text, expected] of [["lunes", "2026-10-26"], ["el lunes", "2026-10-26"], ["próximo lunes", "2026-10-26"],
  ["el próximo lunes", "2026-10-26"], ["este viernes", "2026-10-30"], ["el viernes que viene", "2026-10-30"],
  ["me gustaría el viernes", "2026-10-30"], ["MIÉRCOLES", "2026-10-28"]]) {
  test(`weekday expression: ${text}`, () => expectDate(text, expected));
}
test("today's weekday is conditional on real availability; próximo/que viene are strictly future", () => {
  const options = { now: "2026-10-26T09:00:00-06:00" };
  const result = expectDate("lunes", "2026-10-26", options);
  assert.deepEqual(result.fallback, { success: true, date: "2026-11-02", error: null });
  assert.equal(expectDate("próximo lunes", "2026-11-02", options).fallback, undefined);
  expectDate("el lunes que viene", "2026-11-02", options);
  assert.equal(parse("lunes", { ...options, maxBookingHorizonDays: 3 }).fallback.error, "OUT_OF_HORIZON");
});
test("leap years validate without overflowing February or ignoring explicit years", () => {
  expectDate("29 feb 2028", "2028-02-29", { now: "2027-03-01T12:00:00-06:00" });
  expectDate("29 feb", "2028-02-29", { now: "2027-03-01T12:00:00-06:00" });
  assert.equal(parse("29 feb 2027").error, "INVALID");
  assert.equal(parse("29 feb").error, "OUT_OF_HORIZON", "next actual leap day is beyond the horizon");
  assert.equal(parse("31 febrero").error, "INVALID");
});
for (const text of ["31 febrero", "32 octubre", "13/15", "30 feb 2028", "13/10/26", "2026-10-13", "13/10-2027",
  "+52 55 1234 5678", "mi teléfono es 5512345678", "60 minutos", "servicio de 13 minutos", "13:10", "$13.10", "en -3 días", "-13/10", ""]) {
  test(`unrelated number or invalid date: ${text}`, () => {
    const result = parse(text); assert.equal(result.success, false); assert.equal(result.error, "INVALID"); assert.equal(result.date, null);
  });
}
for (const text of ["ayer", "anteayer", "13/10/2026", "13 de octubre de 2025", "lunes pasado"]) {
  test(`explicit past is respected: ${text}`, () => assert.equal(parse(text).error, "PAST"));
}
for (const text of ["algún día", "la otra semana", "lunes o martes", "13 oct o 14 oct", "hoy y mañana"]) {
  test(`genuine ambiguity: ${text}`, () => assert.equal(parse(text).error, "AMBIGUOUS"));
}
test("day-only input uses the next actual occurrence, as confirmed by the owner", () => {
  expectDate("el día 13", "2026-11-13");
  expectDate("13", "2026-11-13");
  expectDate("el día 31", "2026-10-31");
  expectDate("el día 31", "2026-03-31", { now: "2026-02-20T12:00:00-06:00" });
  expectDate("el día 13", "2026-10-13", { now: "2026-10-13T09:00:00-06:00" });
  expectDate("el día 1", "2027-01-01", { now: "2026-12-31T12:00:00-06:00" });
  assert.equal(parse("el día 13", { maxBookingHorizonDays: 10 }).error, "OUT_OF_HORIZON");
  assert.equal(parse("noviembre").error, "INVALID", "a month alone does not identify a day");
});
test("the configured horizon, including the final partial business-local date, is preserved", () => {
  expectDate("en 365 días", "2027-10-24");
  assert.equal(parse("en 366 días").error, "OUT_OF_HORIZON");
  assert.equal(parse("25/10/2027").error, "OUT_OF_HORIZON");
  expectDate("en 30 días", "2026-11-23", { maxBookingHorizonDays: 30 });
  assert.equal(parse("en 31 días", { maxBookingHorizonDays: 30 }).error, "OUT_OF_HORIZON");
});
test("near midnight each business uses its own timezone rather than the server date", () => {
  const now = "2026-10-25T02:30:00Z";
  expectDate("hoy", "2026-10-24", { now, timeZone: "America/Mexico_City" });
  expectDate("mañana", "2026-10-25", { now, timeZone: "America/Mexico_City" });
  expectDate("hoy", "2026-10-25", { now, timeZone: "Asia/Tokyo" });
  expectDate("mañana", "2026-10-26", { now, timeZone: "Asia/Tokyo" });
});
test("relative days and weeks follow civil dates through DST", () => {
  expectDate("en 2 días", "2027-03-15", { now: "2027-03-13T23:30:00-05:00", timeZone: "America/New_York" });
  expectDate("dentro de una semana", "2026-11-07", { now: "2026-10-31T23:30:00-04:00", timeZone: "America/New_York" });
});
test("messages are friendly, use the configured horizon, and do not require a format", () => {
  assert.equal(DATE_PROMPT, "¿Para qué día te gustaría tu cita? Puedes escribir, por ejemplo: 13 oct, 13/10 o próximo lunes.");
  assert.equal(dateErrorMessage({ error: "PAST" }, 30), "Esa fecha ya pasó. ¿Qué otro día te gustaría?");
  assert.match(dateErrorMessage({ error: "OUT_OF_HORIZON" }, 30), /próximos 30 días/);
  assert.throws(() => parse("mañana", { timeZone: "Invalid/Zone" }), /timezone/);
});
