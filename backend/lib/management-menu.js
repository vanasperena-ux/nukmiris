"use strict";

const { randomUUID } = require("node:crypto");
const { DateTime } = require("luxon");
const { createAvailabilityMenu } = require("./availability-menu");

function createManagementMenu({ management, availability, sessions, businessFor, sendMessage,
  sendReplyButtons, sendAppointmentList, lookaheadDays = 14, lifetime = 15 * 60 * 1000 }) {
  const expired = "Esta opción ya no está vigente. Escribe Reagendar o Cancelar para consultar tus citas.";
  function context(from) { return { businessId: businessFor(from).business_id, sender: from }; }
  function format(from, iso, compact = false) {
    const zone = availability.configuration(context(from).businessId).settings.timeZone;
    return DateTime.fromISO(iso).setZone(zone).setLocale("es")
      .toFormat(compact ? "ccc dd/LL HH:mm" : "cccc d 'de' LLLL yyyy, HH:mm");
  }
  function active(session, mode) { return session?.mode === mode && Date.now() <= session.expiresAt; }
  function range(from, start, end) {
    const zone = availability.configuration(context(from).businessId).settings.timeZone;
    return format(from, start) + "–" + DateTime.fromISO(end).setZone(zone).toFormat("HH:mm");
  }
  async function showMenu(from) {
    const menuId = randomUUID();
    sessions.set(from, { mode: "management_menu", menuId, expiresAt: Date.now() + lifetime });
    await sendReplyButtons(from, "¿Qué deseas hacer con tu cita?", [
      { id: `manage:${menuId}:reschedule`, title: "Reagendar tu cita" },
      { id: `manage:${menuId}:cancel`, title: "Cancelar una cita" },
    ]);
  }
  async function choices(from, session, page = 0) {
    session.selectionId = randomUUID();
    const visible = session.appointments.slice(page * 8, (page + 1) * 8);
    const rows = visible.map((item, index) => ({
      id: `owned:${session.selectionId}:pick:${page * 8 + index}`,
      title: format(from, item.start, true), description: `Termina: ${format(from, item.end, true)}`,
    }));
    if (page > 0) rows.push({ id: `owned:${session.selectionId}:page:${page - 1}`, title: "Citas anteriores" });
    if ((page + 1) * 8 < session.appointments.length) rows.push({ id: `owned:${session.selectionId}:page:${page + 1}`, title: "Más citas" });
    session.actions = rows.map(row => row.id);
    sessions.set(from, session);
    const body = `¿Qué cita deseas ${session.kind === "cancel" ? "cancelar" : "reagendar"}?\n\nEscribe Menu para volver. No se hará ningún cambio sin tu confirmación.`;
    if (rows.length <= 3) await sendReplyButtons(from, body, rows);
    else await sendAppointmentList(from, body, rows);
  }
  async function start(from, kind) {
    management.invalidateOffers(context(from));
    sessions.delete(from);
    const appointments = await management.listAppointments(context(from));
    if (!appointments.length) {
      await sendMessage(from, "No encontré próximas citas de NukMiris para tu número en este negocio. Escribe Cita para hacer una reserva nueva o Menu para recibir ayuda.");
      return;
    }
    await choices(from, { mode: "management_select", kind, appointments, expiresAt: Date.now() + lifetime });
  }
  function sourceContext(from) {
    const session = sessions.get(from);
    if (!active(session, "reschedule_browse")) throw new Error("Expired rescheduling session");
    return { ...context(from), bookingRequestId: session.bookingRequestId, expectedEtag: session.expectedEtag };
  }
  function rescheduleFlow(from) {
    return createAvailabilityMenu({
      availability: { configuration: businessId => availability.configuration(businessId),
        listSlots: () => management.listSlots(sourceContext(from)) },
      sessions: {
        get: () => sessions.get(from)?.mode === "reschedule_browse" ? sessions.get(from).browse : undefined,
        set: (to, browse) => sessions.set(from, { ...sessions.get(from), browse }),
        delete: () => sessions.delete(from),
      },
      businessFor, sendMessage, sendReplyButtons, sendAppointmentList, bookingEnabled: true, lookaheadDays, lifetime,
      onSelect: (to, slot) => confirmation(to, { ...sourceContext(to), kind: "reschedule", slot }),
    });
  }
  async function confirmation(from, details) {
    const intent = await management.createIntent(details);
    sessions.set(from, { mode: "management_confirm", requestId: intent.requestId, expiresAt: Date.now() + lifetime });
    const body = intent.kind === "cancel"
      ? `¿Confirmas que deseas cancelar esta cita en ${businessFor(from).business_name}?\n\n${range(from, intent.originalStart, intent.originalEnd)}`
      : `Confirma el cambio en ${businessFor(from).business_name}:\n\nCita actual: ${range(from, intent.originalStart, intent.originalEnd)}\nNueva cita: ${range(from, intent.start, intent.end)}`;
    await sendReplyButtons(from, body + "\n\nTu cita se conserva hasta que confirmes.", [
      { id: `change:${intent.requestId}:yes`, title: intent.kind === "cancel" ? "Sí, cancelar" : "Confirmar cambio" },
      { id: `change:${intent.requestId}:no`, title: "Conservar mi cita" },
    ]);
  }
  async function decide(from, requestId, yes) {
    const scope = { ...context(from), requestId };
    const outcome = yes ? await management.confirm(scope) : management.decline(scope);
    if (outcome.status === "busy") {
      await sendReplyButtons(from, "Estamos comprobando otra solicitud. Confirma de nuevo en unos momentos.", [
        { id: `change:${requestId}:yes`, title: outcome.kind === "cancel" ? "Sí, cancelar" : "Confirmar cambio" },
        { id: `change:${requestId}:no`, title: "Conservar mi cita" },
      ]);
      return;
    }
    if (["pending", "uncertain"].includes(outcome.status)) {
      console.error("Appointment change needs verification. Request ID:", requestId);
      await sendMessage(from, "Tu cambio sigue en verificación. Pulsa el mismo botón de confirmación para consultar su estado; no solicites otro cambio o reserva por ahora.");
      return;
    }
    if (sessions.get(from)?.requestId === requestId) sessions.delete(from);
    if (outcome.status === "applied") {
      await sendMessage(from, outcome.kind === "cancel"
        ? `Tu cita del ${range(from, outcome.originalStart, outcome.originalEnd)} en ${businessFor(from).business_name} está cancelada.`
        : `¡Tu cita está reagendada!\n\n${range(from, outcome.start, outcome.end)}\n${businessFor(from).business_name}`);
    } else if (outcome.status === "declined") {
      await sendMessage(from, "No realizamos cambios en tu cita. Escribe Menu para volver.");
    } else await sendMessage(from, "No pudimos realizar este cambio. Escribe Reagendar o Cancelar para consultar de nuevo tu cita, o Menu para recibir ayuda.");
  }
  async function handleInteractive(from, command) {
    const change = /^change:([0-9a-f-]{36}):(yes|no)$/.exec(command);
    if (change) { await decide(from, change[1], change[2] === "yes"); return true; }
    if (command.startsWith("availability:") && sessions.get(from)?.mode === "reschedule_browse") {
      await rescheduleFlow(from).handleSelection(from, command); return true;
    }
    const main = /^menu:([0-9a-f-]{36}):manage$/.exec(command);
    const manage = /^manage:([0-9a-f-]{36}):(reschedule|cancel)$/.exec(command);
    const owned = /^owned:([0-9a-f-]{36}):(pick|page):(\d+)$/.exec(command);
    if (!main && !manage && !owned && !/^(change|owned|manage):/.test(command)) return false;
    const session = sessions.get(from);
    if (main && active(session, "main_menu") && session.menuId === main[1]) await showMenu(from);
    else if (manage && active(session, "management_menu") && session.menuId === manage[1]) await start(from, manage[2]);
    else if (owned && active(session, "management_select") && session.actions.includes(command)) {
      if (owned[2] === "page") await choices(from, session, Number(owned[3]));
      else {
        const appointment = session.appointments[Number(owned[3])];
        const scope = { ...context(from), bookingRequestId: appointment.bookingRequestId, expectedEtag: appointment.etag };
        if (session.kind === "cancel") await confirmation(from, { ...scope, kind: "cancel" });
        else {
          await management.readAppointment(scope);
          sessions.set(from, { mode: "reschedule_browse", bookingRequestId: appointment.bookingRequestId,
            expectedEtag: appointment.etag, expiresAt: Date.now() + lifetime });
          await rescheduleFlow(from).offer(from);
        }
      }
    } else await sendMessage(from, expired);
    return true;
  }
  async function handleText(from, text) {
    const command = text.toLowerCase();
    if (["reagendar", "cancelar"].includes(command)) { await start(from, command === "reagendar" ? "reschedule" : "cancel"); return true; }
    const session = sessions.get(from);
    if (session?.mode === "reschedule_browse") return rescheduleFlow(from).handleText(from, text);
    if (["management_menu", "management_select", "management_confirm"].includes(session?.mode)) {
      await sendMessage(from, Date.now() > session.expiresAt ? expired : "Usa los botones para elegir o confirmar. Escribe Menu para volver.");
      return true;
    }
    return false;
  }
  return { handleInteractive, handleText };
}

module.exports = { createManagementMenu };
