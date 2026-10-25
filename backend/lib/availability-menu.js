"use strict";

const { randomUUID } = require("node:crypto");
const { DateTime } = require("luxon");
const { readSearchPolicy } = require("./availability-search");
const { parseAppointmentDate, dateErrorMessage, DATE_PROMPT } = require("./appointment-date");

// Presentation only: the existing availability engine and booking service
// remain responsible for schedule checks, busy periods, and event creation.
function createAvailabilityMenu({ availability, sessions, businessFor, sendMessage,
  sendReplyButtons, sendAppointmentList, onSelect, bookingEnabled = false,
  lookaheadDays, lifetime = 15 * 60 * 1000, now = () => DateTime.now() }) {
  const expired = "Esta opción ya no está vigente. Escribe Cita para consultar nuevos horarios.";
  const guidance = bookingEnabled
    ? "Selecciona el horario que prefieres."
    : "Esta consulta no reserva una cita.";

  function context(from) {
    const business = businessFor(from);
    const { calendarId, settings, searchPolicy = readSearchPolicy() } = availability.configuration(business.business_id);
    return { business, calendarId, zone: settings.timeZone, policy: searchPolicy,
      horizonDays: lookaheadDays ?? searchPolicy.maxBookingHorizonDays };
  }
  function valid(from, session) {
    return session?.mode === "availability" && session.flowVersion === 2 &&
      now().toMillis() <= session.expiresAt && session.calendarId === context(from).calendarId;
  }
  function local(value, zone) { return DateTime.fromISO(value, { zone }).setZone(zone).setLocale("es"); }
  function action(session, kind, value = 0) { return `availability:${session.offerId}:${kind}:${value}`; }
  function beginView(session, view) {
    session.view = view;
    session.offerId = randomUUID();
  }
  function save(from, session, choices) {
    // Accept only actions actually shown in the current view. Old messages and
    // guessed indexes cannot select hidden slots or overwrite a newer choice.
    session.actions = choices.map(choice => choice.id);
    sessions.set(from, session);
  }
  function datePrompt() { return DATE_PROMPT; }

  async function suggestions(from, session, stage, notice) {
    beginView(session, "suggestions");
    const { zone } = context(from);
    const offset = stage * 2;
    const choices = session.slots.slice(offset, offset + 2).map((slot, index) => ({
      id: action(session, "slot", offset + index),
      title: local(slot.start, zone).toFormat("ccc dd/LL HH:mm"),
    }));
    choices.push(stage === 0 && session.slots.length > 2
      ? { id: action(session, "more"), title: "Más opciones" }
      : { id: action(session, "dates"), title: "Elegir fecha" });
    save(from, session, choices);
    await sendReplyButtons(from,
      (notice ? notice + "\n\n" : "") + (stage === 0 ? "Elige un horario que te funciona mejor:"
        : "Te muestro mas opciones. Elige un horario que te funciona mejor:"), choices);
  }

  async function dates(from, session, page = 0) {
    beginView(session, "dates");
    const { zone, policy, horizonDays } = context(from);
    session.datePages ||= [session.slots];
    if (!session.datePages[page]) {
      const previous = session.datePages[page - 1];
      if (!previous?.length) throw new Error("Invalid date page");
      const afterDate = local(previous.at(-1).start, zone).toISODate();
      session.datePages[page] = await availability.listSlots(businessFor(from).business_id, { afterDate });
    }
    session.slots = session.datePages[page];
    const days = [...new Set(session.slots.map(slot => local(slot.start, zone).toISODate()))].slice(0, policy.targetDates);
    const rows = days.map(day => ({
      id: action(session, "date", day),
      title: local(day, zone).toFormat("ccc d 'de' LLLL"),
      description: "Ver horarios de este día",
    }));
    if (page > 0) rows.push({ id: action(session, "days", page - 1), title: "Fechas anteriores" });
    const lastDay = days.at(-1);
    if (lastDay && days.length >= policy.targetDates && local(lastDay, zone).plus({ days: 1 }) < now().setZone(zone).plus({ days: horizonDays })) {
      rows.push({ id: action(session, "days", page + 1), title: "Más fechas" });
    }
    save(from, session, rows);
    if (!rows.length) {
      await sendMessage(from, "No encontré horarios disponibles en los próximos días.\n\n" + datePrompt(from));
      return;
    }
    await sendAppointmentList(from, (days.length ? "" : "No encontré más fechas disponibles.\n\n") + datePrompt(from), rows, "Elegir fecha", "Fechas disponibles");
  }

  async function openDates(from, session) {
    // The current offer already contains these first dates. Reuse that existing
    // session snapshot; the chosen day and final slot are checked afresh later.
    if (session.view !== "suggestions") session.slots = await availability.listSlots(businessFor(from).business_id);
    session.datePages = [session.slots];
    await dates(from, session);
  }

  async function times(from, session, page = 0) {
    beginView(session, "times");
    const { zone } = context(from);
    const offset = page * 2;
    const choices = session.slots.slice(offset, offset + 2).map((slot, index) => ({
      id: action(session, "slot", offset + index),
      title: local(slot.start, zone).toFormat("HH:mm"),
    }));
    choices.push(offset + 2 < session.slots.length
      ? { id: action(session, "times", page + 1), title: "Más horarios" }
      : { id: action(session, "dates"), title: "Elegir otra fecha" });
    save(from, session, choices);
    const day = local(session.selectedDate, zone).toFormat("cccc d 'de' LLLL yyyy");
    await sendReplyButtons(from, session.slots.length
      ? (page > 0 ? "Te muestro mas opciones. Elige un horario que te funciona mejor:"
        : `¿Qué hora prefieres para el ${day}?\n\n${guidance} Para cambiar de día, escribe otra fecha. Escribe Menu para volver.`)
      : `No hay horarios disponibles para el ${day}. Elige otra fecha o escríbela. Escribe Menu para volver.`, choices);
  }

  async function chooseDate(from, session, day, fallback) {
    const { zone, horizonDays } = context(from);
    const current = now().setZone(zone);
    const today = current.startOf("day");
    const selected = DateTime.fromISO(day, { zone });
    if (!selected.isValid || selected.toISODate() !== day || selected < today || selected >= current.plus({ days: horizonDays })) {
      const error = !selected.isValid || selected.toISODate() !== day ? "INVALID" : selected < today ? "PAST" : "OUT_OF_HORIZON";
      await sendMessage(from, dateErrorMessage({ error }, horizonDays));
      return;
    }
    // Recheck Google after the customer picks a day; never reuse cached times
    // to claim a newly busy appointment is still available.
    let fresh = await availability.listSlots(businessFor(from).business_id, { date: day });
    if (!fresh.length && fallback) {
      if (!fallback.success) {
        await sendMessage(from, dateErrorMessage(fallback, horizonDays));
        return;
      }
      day = fallback.date;
      fresh = await availability.listSlots(businessFor(from).business_id, { date: day });
    }
    session.slots = fresh.filter(slot => local(slot.start, zone).toISODate() === day);
    session.selectedDate = day;
    await times(from, session);
  }

  async function offer(from, { notice } = {}) {
    const { business, calendarId } = context(from);
    const slots = await availability.listSlots(business.business_id);
    if (!slots.length) {
      sessions.delete(from);
      await sendMessage(from, (notice ? notice + "\n\n" : "") + "No encontré horarios disponibles por ahora. Puedes llamar al negocio para consultar más opciones.");
      return;
    }
    await suggestions(from, { mode: "availability", flowVersion: 2, slots, calendarId,
      expiresAt: now().toMillis() + lifetime }, 0, notice);
  }

  async function handleSelection(from, command) {
    const session = sessions.get(from);
    if (!valid(from, session) || !session.actions?.includes(command)) {
      await sendMessage(from, expired);
      return;
    }
    const [, , kind, value] = command.split(":");
    if (kind === "more") return suggestions(from, session, 1);
    if (kind === "dates") return openDates(from, session);
    if (kind === "days") return dates(from, session, Number(value));
    if (kind === "date") return chooseDate(from, session, value);
    if (kind === "times") return times(from, session, Number(value));
    if (kind === "slot") return onSelect(from, session.slots[Number(value)], session, command);
  }

  async function handleText(from, text) {
    const session = sessions.get(from);
    if (session?.mode !== "availability") return false;
    if (!valid(from, session)) {
      await sendMessage(from, expired);
      return true;
    }
    if (["otra fecha", "elegir fecha"].includes(text.toLowerCase())) {
      await openDates(from, session);
      return true;
    }
    const { zone, horizonDays } = context(from);
    const parsed = parseAppointmentDate(text, { now: now(), timeZone: zone, maxBookingHorizonDays: horizonDays });
    if (!parsed.success) {
      await sendMessage(from, dateErrorMessage(parsed, horizonDays));
      return true;
    }
    await chooseDate(from, session, parsed.date, parsed.fallback);
    return true;
  }
  return { offer, handleSelection, handleText };
}

module.exports = { createAvailabilityMenu };
