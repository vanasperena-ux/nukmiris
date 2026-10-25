"use strict";

const { normalizeMessage } = require("./intent-recognition");
const { MENU_INSTRUCTION } = require("./menu-messages");
const { appointmentDate, appointmentTime, actionPayload } = require("./reminder-templates");
const CONFIRM = new Set(["si", "confirmo", "confirmada", "confirmado", "si confirmo"]);
const RESCHEDULE = new Set(["reagendar", "cambiar cita", "necesito cambiar", "otra fecha", "necesito reagendar"]);

function createReminderMenu({ reminders, managementMenu, businessFor, sessions, sendMessage, sendReplyButtons,
  beforeConfirm = () => {} }) {
  const scope = from => ({ businessId: businessFor(from).business_id, sender: from });
  const expired = "Esta confirmación ya no está vigente. " + MENU_INSTRUCTION;
  async function execute(from, token, action) {
    if (action === "confirm") beforeConfirm(from, token);
    const result = action === "confirm" ? await reminders.confirm(scope(from), token)
      : await reminders.requestReschedule(scope(from), token);
    if (result.status === "confirmed") {
      const session = sessions.get(from);
      if (session?.mode === "reschedule_browse" && session.bookingRequestId === result.row.booking_request_id) {
        sessions.set(from, { ...session, expectedEtag: result.etag });
      }
      await sendMessage(from, `¡Gracias, ${result.row.customer_name}! Tu cita del ${appointmentDate(result.row)} a las ${appointmentTime(result.row)} está confirmada. ¡Te esperamos!`);
    } else if (result.status === "reschedule") {
      await managementMenu.beginReschedule(from, result.appointment,
        `Claro, ${result.row.customer_name}. Vamos a buscar otro horario para tu cita.`);
    } else if (["busy", "uncertain"].includes(result.status)) {
      await sendReplyButtons(from, "Tu confirmación sigue en verificación. Consulta su estado antes de intentar otro cambio.",
        [{ id: actionPayload(token, "confirm"), title: "Consultar estado" }]);
    } else if (result.status === "failed") {
      await sendMessage(from, "No pude guardar tu confirmación. Tu cita sigue reservada; puedes volver a usar el mismo botón para intentarlo.");
    } else await sendMessage(from, expired);
  }
  async function handle(from, { command, isText, allowText, replyToId, sentAt }) {
    const match = /^reminder:([0-9a-f-]{36}):(confirm|reschedule)$/.exec(command);
    if (!isText && match) { await execute(from, match[1], match[2]); return true; }
    if (!isText && command.startsWith("reminder:")) {
      await sendMessage(from, expired); return true;
    }
    const normalized = normalizeMessage(command);
    if (!isText || !allowText || (!CONFIRM.has(normalized) && !RESCHEDULE.has(normalized))) return false;
    const target = reminders.textTarget(scope(from), { replyToId, sentAt });
    if (!target) {
      if (CONFIRM.has(normalized) || replyToId) {
        await sendMessage(from, "Para confirmar una cita, usa el botón del recordatorio correspondiente."); return true;
      }
      return false;
    }
    await execute(from, target.action_token, CONFIRM.has(normalized) ? "confirm" : "reschedule");
    return true;
  }
  return { handle, resume: (from, token) => execute(from, token, "confirm") };
}
module.exports = { createReminderMenu };
