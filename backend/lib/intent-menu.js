"use strict";
const { randomUUID } = require("node:crypto");
const { MENU_INSTRUCTION } = require("./menu-messages");
const labels = { BOOK: "Agendar una cita", RESCHEDULE: "Reagendar mi cita", CANCEL: "Cancelar mi cita" };

function createIntentMenu({ sessions, sendReplyButtons, sendMessage, lifetime = 15 * 60 * 1000 }) {
  async function offer(from, recognition = {}) {
    const options = Object.keys(labels).filter(intent => !recognition.options || recognition.options.includes(intent));
    const menuId = randomUUID();
    const buttons = options.map(intent => ({ id: `intent:${menuId}:${intent.toLowerCase()}`, title: labels[intent] }));
    sessions.set(from, { mode: "intent_clarification", menuId, actions: buttons.map(button => button.id), expiresAt: Date.now() + lifetime });
    const body = recognition.attendance ? "¿Quieres reagendar o cancelar tu cita?"
      : recognition.intent === "AMBIGUOUS" ? "¿Qué quieres hacer primero?"
      : "No entendí qué necesitas. ¿En qué puedo ayudarte?";
    await sendReplyButtons(from, body, buttons);
  }
  async function select(from, command) {
    const session = sessions.get(from);
    if (session?.mode !== "intent_clarification" || Date.now() > session.expiresAt || !session.actions?.includes(command)) {
      await sendMessage(from, "Esta opción ya no está vigente. " + MENU_INSTRUCTION);
      return null;
    }
    return command.split(":").at(-1).toUpperCase();
  }
  return { offer, select };
}
module.exports = { createIntentMenu };
