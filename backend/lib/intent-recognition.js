"use strict";

function normalizeMessage(text) {
  return String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

const appointment = "(?:cita|turno|hora|horario|reserva|reservacion)";
const determiner = "(?:(?:una|un|la|el|mi|mis|su|tu) )?(?:(?:nueva|nuevo|otra|otro) )?";
// Small independent phrase rules; generic nouns never override explicit verbs.
const phrases = {
  BOOK: [
    "(?:agendar|agendame|reservar|reservame)",
    `(?:hacer|sacar|pedir|programar|programame|apartar|apartame) ${determiner}${appointment}`,
    `(?:quiero|quisiera|necesito|deseo|busco) ${determiner}${appointment}`,
    { phrase: `(?:nueva|otra|nuevo|otro) ${appointment}`, generic: true },
    { phrase: `${appointment} (?:nueva|nuevo)`, generic: true },
    { phrase: "disponibilidad", generic: true },
    `(?:hay|tienen|tienes) (?:(?:un|algun|alguna) )?(?:espacio|lugar|disponibilidad|horarios?)`,
  ],
  RESCHEDULE: [
    "(?:reagendar|reagendame|reprogramar|reprogramame)",
    `(?:cambiar|cambiame|mover|mueveme|posponer|adelantar|modificar|pasar) ${determiner}(?:${appointment}|fecha|dia)`,
  ],
  CANCEL: [
    "(?:cancelar|cancelame|cancela)",
    `(?:anular|anulame|eliminar|eliminame|quitar|quitame) ${determiner}${appointment}`,
    `dar de baja ${determiner}${appointment}`,
  ],
};
const rules = Object.entries(phrases).flatMap(([intent, list]) => list.map(rule => ({ intent,
  generic: rule.generic || false, pattern: new RegExp(`(?:^| )(${rule.phrase || rule})(?= |$)`, "g") })));
const unavailable = [
  /\b(?:ya )?no (?:puedo|podre|voy a poder|voy a) (?:ir|asistir|venir)\b/,
  /\bno (?:asistire|ire)\b/,
  /\bno puedo (?:manana|hoy|el (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo))\b/,
];
const alternative = /\b(?:mejor|prefiero|preferiria) (?:el )?(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo|manana|otro dia|otra fecha|otro horario)\b/;
function negated(text, index) {
  // Explicit contrast starts a new clause: "no cancelar, sino reagendar".
  let prefix = text.slice(0, index).split(/\b(?:pero|sino|aunque)\b/).at(-1).trim();
  const desire = [...prefix.matchAll(/\b(?:quiero|quisiera|necesito|deseo|busco)\b/g)].at(-1);
  if (desire && !/\b(?:no|nunca|jamas)(?: me)?$/.test(prefix.slice(0, desire.index).trim())) prefix = prefix.slice(desire.index);
  return /\b(?:no|nunca|jamas|sin)(?: [\p{L}\p{N}]+){0,6}$/u.test(prefix);
}
function recognizeIntent(message, { hasUpcomingAppointment } = {}) {
  const text = normalizeMessage(message), matches = [];
  const result = (intent, matchedPhrase = null, extra = {}) => ({ intent, matchedPhrase, ...extra });
  if (!text || /\b(?:informacion|informarme|informar|politica|politicas|explicame|explicar|significa|precio|costo)\b/.test(text)) return result("UNKNOWN");
  for (const { intent, pattern, generic } of rules) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index + (match[0].startsWith(" ") ? 1 : 0);
      if (!negated(text, index)) matches.push({ intent, phrase: match[1], index, generic });
    }
  }
  // "hacer otra" is reliable only alongside an explicit appointment action.
  const another = /\b(?:hacer|sacar|pedir) (?:otra|una nueva)\b/.exec(text);
  if (another && matches.some(match => match.intent !== "BOOK") && !negated(text, another.index)) {
    matches.push({ intent: "BOOK", phrase: another[0], index: another.index });
  }
  if (/^(?:cita|horarios)$/.test(text)) matches.push({ intent: "BOOK", phrase: text, index: 0 });
  const explicitChange = matches.some(match => match.intent !== "BOOK");
  const selected = matches.filter(match => !explicitChange || !match.generic);
  const intents = [...new Set(selected.map(match => match.intent))];
  if (intents.length > 1) return result("AMBIGUOUS", null, { options: intents });
  if (intents.length === 1) {
    const first = selected.sort((a, b) => a.index - b.index)[0];
    return result(first.intent, first.phrase);
  }
  const attendance = unavailable.map(pattern => text.match(pattern)).find(Boolean);
  if (attendance) {
    if (hasUpcomingAppointment === undefined) return result("UNKNOWN", attendance[0], { needsAppointmentContext: true });
    if (hasUpcomingAppointment) return alternative.test(text)
      ? result("RESCHEDULE", attendance[0])
      : result("AMBIGUOUS", attendance[0], { options: ["RESCHEDULE", "CANCEL"], attendance: true });
  }
  return result("UNKNOWN");
}
module.exports = { normalizeMessage, recognizeIntent };
