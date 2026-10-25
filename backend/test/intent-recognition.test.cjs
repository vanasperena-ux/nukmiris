"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeMessage, recognizeIntent } = require("../lib/intent-recognition");

const positive = {
  BOOK: ["cita", "agendar", "agendar cita", "agendar una cita", "quiero cita", "quiero una cita", "hacer cita", "hacer una cita",
    "sacar cita", "sacar una cita", "reservar", "reservar cita", "reservar una cita", "nueva cita", "programar cita", "apartar cita",
    "necesito una cita", "quiero agendar", "quiero reservar", "disponibilidad", "sacar turno", "pedir turno", "reservar turno", "sacar hora", "pedir hora",
    "Hola, quiero una cita", "Me puedes agendar?", "Buenas tardes, quisiera reservar una cita", "Tienen espacio mañana?",
    "Quiero sacar turno", "Necesito cita para el viernes", "Puedo apartar una cita?", "Hay disponibilidad esta semana?",
    "Quiero otra cita", "Quiero una cita nueva", "Necesito una nueva cita", "¡AGENDAR!", "*Quiero* _una CITA_!!!", "  quiero   una\n cita  ", "Horarios"],
  RESCHEDULE: ["reagendar", "reagendar cita", "reagendar mi cita", "reprogramar", "reprogramar cita", "cambiar cita", "cambiar mi cita",
    "mover cita", "mover mi cita", "cambiar horario", "cambiar hora", "cambiar fecha", "cambiar día", "posponer cita", "adelantar cita", "modificar cita", "cambiar turno",
    "Quiero reagendar", "Necesito cambiar mi cita", "Me puedes mover la cita?", "Quiero cambiar la hora", "Puedo pasar mi cita al jueves?",
    "Necesito reprogramar mi cita", "Quiero modificar el horario", "Reprogramar hora", "REAGENDAR MI CITA", "¿Cambiar mi DÍA?", "Cambiar mi nueva cita"],
  CANCEL: ["cancelar", "cancelar cita", "cancelar mi cita", "anular cita", "eliminar cita", "quitar cita", "dar de baja mi cita",
    "quiero cancelar", "cancelar reserva", "Quiero cancelar", "Cancélame la cita por favor", "Necesito anular mi cita",
    "Quiero cancelar mi reservación", "Anular turno", "¡¡CANCÉLAME la cita, por favor!!", "Cancelar otra cita", "Cancelar mi nueva cita", "Anular mi nueva cita"],
};
for (const [intent, messages] of Object.entries(positive)) for (const message of messages) {
  test(`${intent}: ${JSON.stringify(message)}`, () => {
    const result = recognizeIntent(message);
    assert.equal(result.intent, intent); assert.equal(typeof result.matchedPhrase, "string");
  });
}
for (const message of ["Necesito información sobre cancelaciones", "No quiero cancelar mi cita", "No quiero agendar una cita",
  "Necesita información", "solicita ayuda", "mi cita está confirmada", "No voy a cancelar mi cita", "No hay disponibilidad",
  "Nunca quiero cancelar", "No puedo agendar una cita", "Cancelarina García", "reagendarcito", "cancelaciones", "Mi cita", "", null]) {
  test(`UNKNOWN without accidental action: ${JSON.stringify(message)}`, () => {
    assert.equal(recognizeIntent(message).intent, "UNKNOWN");
  });
}
for (const message of ["Quiero cancelar mi cita y hacer otra", "Quiero reagendar y cancelar", "Quiero reservar y cancelar mi cita",
  "Necesito cambiar mi cita y agendar otra"]) {
  test(`conflicting actions need clarification: ${message}`, () => {
    const result = recognizeIntent(message);
    assert.equal(result.intent, "AMBIGUOUS"); assert(result.options.length >= 2);
  });
}
for (const message of ["ya no puedo ir", "no podré asistir", "no voy a poder ir", "no asistiré", "Ya no podré asistir", "No voy a poder ir a mi cita", "No puedo mañana"]) {
  test(`attendance depends on owned upcoming appointments: ${message}`, () => {
    assert.equal(recognizeIntent(message).needsAppointmentContext, true);
    assert.equal(recognizeIntent(message, { hasUpcomingAppointment: false }).intent, "UNKNOWN");
    const result = recognizeIntent(message, { hasUpcomingAppointment: true });
    assert.equal(result.intent, "AMBIGUOUS"); assert.equal(result.attendance, true);
    assert.deepEqual(result.options, ["RESCHEDULE", "CANCEL"]);
  });
}
test("context can recognize a change of day without extracting or selecting that day", () => {
  const message = "No puedo mañana, mejor el jueves";
  assert.equal(recognizeIntent(message, { hasUpcomingAppointment: true }).intent, "RESCHEDULE");
  assert.equal(recognizeIntent(message, { hasUpcomingAppointment: false }).intent, "UNKNOWN");
  assert.equal(recognizeIntent("No puedo ir, quiero cancelar mi cita", { hasUpcomingAppointment: true }).intent, "CANCEL");
});
test("explicit contrast separates a denied action from the requested action", () => {
  assert.equal(recognizeIntent("No quiero cancelar, sino reagendar mi cita").intent, "RESCHEDULE");
});
test("normalization preserves boundaries and never edits the original value", () => {
  const original = "  ¿*QUIERO* una CÍTA? 💅\n";
  assert.equal(normalizeMessage(original), "quiero una cita");
  assert.equal(original, "  ¿*QUIERO* una CÍTA? 💅\n");
  assert.equal(normalizeMessage("cita-cancelar"), "cita cancelar");
  assert.deepEqual(recognizeIntent("consulta"), { intent: "UNKNOWN", matchedPhrase: null });
});
