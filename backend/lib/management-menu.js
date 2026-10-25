"use strict";

const { randomUUID } = require("node:crypto");
const { DateTime } = require("luxon");
const { createAvailabilityMenu } = require("./availability-menu");
const { appointmentSuccess } = require("./appointment-messages");

function createManagementMenu({ management, availability, sessions, businessFor, sendMessage,
  sendReplyButtons, sendAppointmentList, lookaheadDays = 14, lifetime = 15 * 60 * 1000,
  saveReceipt = (from, receipt) => sessions.set(from, receipt), beforeDecision = () => {} }) {
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
    const body = session.kind === "cancel"
      ? 'Selecciona la cita que deseas cancelar. Se cancelará al seleccionarla.\n\nEscribe "menu" para volver.'
      : 'Selecciona la cita que deseas reagendar.\n\nEscribe "menu" para volver.';
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
    if (kind === "reschedule" && appointments.length === 1) await beginReschedule(from, appointments[0]);
    else await choices(from, { mode: "management_select", kind, appointments, expiresAt: Date.now() + lifetime });
  }
  async function beginReschedule(from, appointment) {
    const scope = { ...context(from), bookingRequestId: appointment.bookingRequestId, expectedEtag: appointment.etag };
    await management.readAppointment(scope);
    sessions.set(from, { mode: "reschedule_browse", bookingRequestId: appointment.bookingRequestId,
      expectedEtag: appointment.etag, expiresAt: Date.now() + lifetime });
    await rescheduleFlow(from).offer(from);
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
      onSelect: (to, slot, session, command) => applySelection(to, { ...sourceContext(to), kind: "reschedule", slot }, command),
    });
  }
  async function applySelection(from, details, selectionCommand) {
    let intent;
    try { intent = await management.createIntent(details); }
    catch (error) {
      if (details.kind === "cancel" && ([404, 410].includes(Number(error.response?.status || error.code)) || error.code === "APPOINTMENT_GONE")) {
        sessions.delete(from);
        await sendMessage(from, 'Esa cita ya no aparece en el calendario. Escribe "menu" para revisar tus citas.');
        return;
      }
      throw error;
    }
    saveReceipt(from, { mode: "management_result", requestId: intent.requestId, selectionCommand, expiresAt: Date.now() + lifetime });
    await decide(from, intent.requestId, "retry");
  }
  async function decide(from, requestId, decision) {
    beforeDecision(from, requestId, decision);
    const scope = { ...context(from), requestId };
    const outcome = decision === "status" ? await management.reconcile(scope)
      : decision === "no" ? management.decline(scope) : await management.confirm(scope);
    if (outcome.status === "busy") {
      await sendReplyButtons(from, "Estamos comprobando otra solicitud. Intenta de nuevo en unos momentos.",
        [{ id: `change:${requestId}:retry`, title: "Reintentar" }]);
      return;
    }
    if (["pending", "uncertain"].includes(outcome.status)) {
      console.error("Appointment change needs verification. Request ID:", requestId);
      await sendReplyButtons(from, "Tu cambio sigue en verificación. Consulta su estado antes de solicitar otro cambio o reserva.",
        [{ id: `change:${requestId}:status`, title: "Consultar estado" }]);
      return;
    }
    const current = sessions.get(from);
    if (current?.requestId === requestId && current.mode !== "management_result") sessions.delete(from);
    if (outcome.status === "applied") {
      await sendMessage(from, outcome.kind === "cancel"
        ? `Tu cita del ${range(from, outcome.originalStart, outcome.originalEnd)} en ${businessFor(from).business_name} está cancelada.`
        : appointmentSuccess({ kind: "reschedule", start: outcome.start, end: outcome.end,
          zone: availability.configuration(context(from).businessId).settings.timeZone, businessName: businessFor(from).business_name }));
    } else if (outcome.status === "declined") {
      await sendMessage(from, "No realizamos cambios en tu cita. Escribe Menu para volver.");
    } else await sendMessage(from, "No pudimos realizar este cambio. Escribe Reagendar o Cancelar para consultar de nuevo tu cita, o Menu para recibir ayuda.");
  }
  async function handleInteractive(from, command) {
    const current = sessions.get(from);
    if (current?.mode === "management_result" && current.selectionCommand === command) {
      await decide(from, current.requestId, "retry"); return true;
    }
    // Previously sent v0.3.0 confirmation buttons remain bound to their journal
    // request; new flows publish only selections and recovery/status actions.
    const change = /^change:([0-9a-f-]{36}):(yes|no|retry|status)$/.exec(command);
    if (change) { await decide(from, change[1], change[2]); return true; }
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
        if (session.kind === "cancel") await applySelection(from, { ...scope, kind: "cancel" }, command);
        else await beginReschedule(from, appointment);
      }
    } else await sendMessage(from, expired);
    return true;
  }
  async function handleText(from, text) {
    const command = text.toLowerCase();
    if (["reagendar", "cancelar"].includes(command)) { await start(from, command === "reagendar" ? "reschedule" : "cancel"); return true; }
    const session = sessions.get(from);
    if (session?.mode === "reschedule_browse") return rescheduleFlow(from).handleText(from, text);
    if (session?.mode === "management_result") {
      await sendMessage(from, 'Para organizar tu cita o cancelar, escribe "menu".');
      return true;
    }
    if (["management_menu", "management_select", "management_confirm"].includes(session?.mode)) {
      await sendMessage(from, Date.now() > session.expiresAt ? expired : "Usa los botones para elegir o confirmar. Escribe Menu para volver.");
      return true;
    }
    return false;
  }
  return { handleInteractive, handleText, resume: decide };
}

module.exports = { createManagementMenu };
