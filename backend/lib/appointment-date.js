"use strict";
const { DateTime } = require("luxon");
const { readSearchPolicy, MAX_BOOKING_HORIZON_DAYS } = require("./availability-search");

const months = Object.freeze({ enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
  mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9, sept: 9, set: 9, octubre: 10, oct: 10, noviembre: 11, nov: 11, diciembre: 12, dic: 12 });
const weekdays = Object.freeze({ lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 7 });
const numbers = Object.freeze({ un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20 });
const DATE_PROMPT = "¿Para qué día te gustaría tu cita? Puedes escribir, por ejemplo: 13 oct, 13/10 o próximo lunes.";
const INVALID_DATE = "No pude identificar bien la fecha. ¿Qué día te gustaría? Puedes escribir, por ejemplo: 13 oct, 13/10 o próximo lunes.";
function normalizeDateText(value) {
  // Keep numeric separators and signs: "en -3 días" must not become future +3.
  return String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[¿?¡!*_~`,;()[\]{}]|\p{Extended_Pictographic}|\uFE0F/gu, " ")
    .replace(/\.(?=\s|$)/g, " ").trim().replace(/\s+/g, " ");
}
function dateError(reason, details = {}) { return { success: false, date: null, error: reason, ...details }; }
function parseAppointmentDate(value, { now = DateTime.now(), timeZone,
  maxBookingHorizonDays = readSearchPolicy().maxBookingHorizonDays } = {}) {
  const current = (typeof now === "string" ? DateTime.fromISO(now, { setZone: true }) : now).setZone(timeZone);
  if (!timeZone || !current.isValid || !Number.isInteger(maxBookingHorizonDays) || maxBookingHorizonDays < 1 || maxBookingHorizonDays > MAX_BOOKING_HORIZON_DAYS) {
    throw new Error("A valid business timezone, current time and booking horizon are required");
  }
  const today = current.startOf("day"), horizon = current.plus({ days: maxBookingHorizonDays });
  function checked(date) {
    if (!date?.isValid) return dateError("INVALID");
    if (date < today) return dateError("PAST");
    if (date >= horizon) return dateError("OUT_OF_HORIZON");
    return { success: true, date: date.toISODate(), error: null };
  }
  function calendarDate(day, month, year) {
    if (!Number.isInteger(day) || !Number.isInteger(month) || day < 1 || month < 1 || month > 12 ||
        !DateTime.fromObject({ year: 2000, month, day }, { zone: timeZone }).isValid) return dateError("INVALID");
    if (year !== undefined) return year < 1 ? dateError("INVALID") : checked(DateTime.fromObject({ year, month, day }, { zone: timeZone }));
    // Leap-day input finds its next real occurrence rather than overflowing.
    for (let candidateYear = today.year; candidateYear <= today.year + 8; candidateYear++) {
      const date = DateTime.fromObject({ year: candidateYear, month, day }, { zone: timeZone });
      if (date.isValid && date >= today) return checked(date);
    }
    return dateError("INVALID");
  }
  let text = normalizeDateText(value).replace(/^(?:por favor )/, "")
    .replace(/ (?:por favor|gracias)$/, "")
    .replace(/^(?:quiero|quisiera|necesito|me gustaria|puede ser|podria ser|para)(?: para)? /, "")
    .replace(/^para /, "").replace(/^el /, "").replace(/^dia /, "");
  if (!text) return dateError("INVALID");
  if (/\b(?:o|u|y)\b/.test(text) || /^(?:algun dia|la otra semana|la semana que viene)$/.test(text)) return dateError("AMBIGUOUS");
  if (text === "hoy") return checked(today);
  if (text === "manana") return checked(today.plus({ days: 1 }));
  if (text === "pasado manana") return checked(today.plus({ days: 2 }));
  if (["ayer", "anteayer"].includes(text)) return dateError("PAST");
  let match = /^(?:en|dentro de) (\d+|[a-z]+) (dias?|semanas?)$/.exec(text);
  if (match) {
    const amount = /^\d+$/.test(match[1]) ? Number(match[1]) : numbers[match[1]];
    if (!Number.isSafeInteger(amount) || amount < 0) return dateError("INVALID");
    const days = amount * (match[2].startsWith("semana") ? 7 : 1);
    if (days > maxBookingHorizonDays) return dateError("OUT_OF_HORIZON");
    return checked(today.plus({ days }));
  }
  match = /^(?:(proximo|este) )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)( que viene| pasado)?$/.exec(text);
  if (match) {
    if (match[3] === " pasado") return dateError("PAST");
    const weekday = weekdays[match[2]], future = match[1] === "proximo" || match[3] === " que viene";
    let offset = (weekday - today.weekday + 7) % 7;
    if (future && offset === 0) offset = 7;
    const result = checked(today.plus({ days: offset }));
    // The caller checks real availability. Only a weekday meaning "today"
    // can move to next week if today's remaining slots are all unavailable.
    if (result.success && offset === 0) result.fallback = checked(today.plus({ days: 7 }));
    return result;
  }
  match = /^(\d{1,2})([\/.-])(\d{1,2})(?:\2(\d{4}))?$/.exec(text) || /^(\d{1,2})( )(\d{1,2})(?: (\d{4}))?$/.exec(text);
  if (match) return calendarDate(Number(match[1]), Number(match[3]), match[4] === undefined ? undefined : Number(match[4]));
  match = /^(\d{1,2}) (?:de )?([a-z]+)(?: (?:de )?(\d{4}))?$/.exec(text);
  if (match && months[match[2]]) return calendarDate(Number(match[1]), months[match[2]], match[3] === undefined ? undefined : Number(match[3]));
  if (/^\d{1,2}$/.test(text) && Number(text) >= 1 && Number(text) <= 31) {
    const day = Number(text);
    for (let offset = 0; offset <= 12; offset++) {
      const month = today.startOf("month").plus({ months: offset });
      const candidate = DateTime.fromObject({ year: month.year, month: month.month, day }, { zone: timeZone });
      if (candidate.isValid && candidate >= today) return checked(candidate);
    }
  }
  return dateError("INVALID");
}
function dateErrorMessage(result, horizonDays) {
  if (result.error === "PAST") return "Esa fecha ya pasó. ¿Qué otro día te gustaría?";
  if (result.error === "OUT_OF_HORIZON") return `Por ahora solo podemos agendar citas dentro de los próximos ${horizonDays} días. ¿Qué otra fecha te gustaría?`;
  return INVALID_DATE;
}
module.exports = { parseAppointmentDate, dateErrorMessage, DATE_PROMPT, INVALID_DATE };
