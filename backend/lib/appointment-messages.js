"use strict";
const { DateTime } = require("luxon");

function date(iso, zone) {
  return DateTime.fromISO(iso).setZone(zone).setLocale("es").toFormat("cccc d 'de' LLLL 'de' yyyy");
}
function time(iso, zone) { return DateTime.fromISO(iso).setZone(zone).toFormat("HH:mm"); }
function appointmentSuccess({ kind = "booking", start, end, zone, businessName }) {
  const day = date(start, zone);
  return (kind === "reschedule" ? "¡Tu cita está reagendada!" : "¡Tu cita está agendada!") +
    `\n\n${day[0].toLocaleUpperCase("es")}${day.slice(1)}\n${time(start, zone)}–${time(end, zone)}` +
    `\n\n¡Te esperamos en ${businessName}!`;
}
function appointmentOverview(appointments, zone) {
  if (!appointments.length) return "";
  if (appointments.length === 1) {
    const item = appointments[0];
    return `Tu cita actual es para el ${date(item.start, zone)}, de ${time(item.start, zone)} a ${time(item.end, zone)}.`;
  }
  return "Tus próximas citas:\n" + appointments.map((item, index) =>
    `${index + 1}. ${date(item.start, zone)}, ${time(item.start, zone)}–${time(item.end, zone)}`).join("\n");
}
// Long appointment overviews are sent as text before the menu buttons, so all
// upcoming appointments fit without exceeding WhatsApp's interactive body limit.
function textChunks(body, limit = 3500) {
  const chunks = [];
  while (body.length > limit) {
    const lastLine = body.lastIndexOf("\n", limit);
    const cut = lastLine > 0 ? lastLine : limit;
    chunks.push(body.slice(0, cut));
    body = body.slice(cut).replace(/^\n/, "");
  }
  if (body) chunks.push(body);
  return chunks;
}
module.exports = { appointmentSuccess, appointmentOverview, textChunks };
