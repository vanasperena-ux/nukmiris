"use strict";

const { DateTime } = require("luxon");
const { normalizedRecipient } = require("./reliable-delivery");
const BUTTONS = ["Sí, confirmo", "Necesito reagendar"];
const BODIES = Object.freeze({
  seven_day: "Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. ¡Te esperamos!",
  confirmation: "Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. ¿Nos confirmas tu asistencia?",
  followup: "Hola {{1}}, todavía no recibimos tu confirmación para la cita en {{2}} el {{3}} a las {{4}}. ¿Nos confirmas si podrás asistir?",
  final: "Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. ¡Te esperamos!",
});
const DEFAULT_TEMPLATES = Object.freeze(Object.fromEntries(Object.keys(BODIES).map(kind => [kind, `nukmiris_${kind}_v1`])));
function hasButtons(kind) { return ["confirmation", "followup"].includes(kind); }
function templateDefinitions(language = "es_MX", names = DEFAULT_TEMPLATES) {
  return Object.entries(BODIES).map(([kind, text]) => ({
    name: names[kind], language, category: "UTILITY", parameter_format: "POSITIONAL",
    components: [{ type: "BODY", text,
      example: { body_text: [["Ana", "Salón de ejemplo", "miércoles 4 de noviembre de 2026", "18:00"]] } },
    ...(hasButtons(kind) ? [{ type: "BUTTONS", buttons: BUTTONS.map(text => ({ type: "QUICK_REPLY", text })) }] : [])],
  }));
}
function appointmentDate(row) {
  return DateTime.fromISO(row.start_iso).setZone(row.time_zone).setLocale("es").toFormat("cccc d 'de' LLLL 'de' yyyy");
}
function appointmentTime(row) { return DateTime.fromISO(row.start_iso).setZone(row.time_zone).toFormat("HH:mm"); }
function actionPayload(token, action) { return `reminder:${token}:${action}`; }
function templatePayload(row, job, settings, businessName) {
  const names = JSON.parse(settings.templates_json);
  if (!/^[a-z0-9_]{1,512}$/.test(names[job.kind] || "")) throw new Error("reminder_template_name_invalid");
  return { messaging_product: "whatsapp", to: normalizedRecipient(row.sender), type: "template",
    biz_opaque_callback_data: `nukmiris-reminder:${job.job_id}`,
    template: { name: names[job.kind], language: { code: settings.language }, components: [
      { type: "body", parameters: [row.customer_name, businessName, appointmentDate(row), appointmentTime(row)]
        .map(text => ({ type: "text", text })) },
      ...(hasButtons(job.kind) ? ["confirm", "reschedule"].map((action, index) => ({
        type: "button", sub_type: "quick_reply", index: String(index),
        parameters: [{ type: "payload", payload: actionPayload(row.action_token, action) }],
      })) : []),
    ] } };
}
function validTemplate(actual, expected) {
  if (!actual || actual.status !== "APPROVED" || actual.category !== "UTILITY" || actual.language !== expected.language ||
      actual.name !== expected.name) return false;
  const body = actual.components?.find(item => item.type === "BODY");
  const buttons = actual.components?.find(item => item.type === "BUTTONS")?.buttons || [];
  const expectedButtons = expected.components.find(item => item.type === "BUTTONS")?.buttons || [];
  // Exact copy/positions prevent a reused name from sending unrelated content.
  return body?.text === expected.components[0].text && buttons.length === expectedButtons.length &&
    buttons.every((button, index) => button.type === "QUICK_REPLY" && button.text === expectedButtons[index].text) &&
    actual.components.every(item => ["BODY", "BUTTONS"].includes(item.type));
}
function createTemplateVerifier({ token, apiVersion = "v26.0", request = fetch, now = Date.now }) {
  const cache = new Map();
  return async (settings, kind) => {
    if (!/^\d+$/.test(settings.waba_id || "")) throw new Error("reminder_waba_id_missing: configure this business's WhatsApp Business Account ID");
    const expected = templateDefinitions(settings.language, JSON.parse(settings.templates_json)).find(item => item.name === JSON.parse(settings.templates_json)[kind]);
    const key = JSON.stringify([settings.business_id, settings.waba_id, expected]);
    if (cache.get(key) > now()) return;
    const url = new URL(`https://graph.facebook.com/${apiVersion}/${settings.waba_id}/message_templates`);
    url.search = new URLSearchParams({ name: expected.name, fields: "name,language,status,category,components", limit: "100" }).toString();
    const response = await request(url.toString(), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`reminder_template_check_http_${response.status}: check template-management permissions and WABA mapping`);
    const data = await response.json();
    if (!Array.isArray(data.data) || !data.data.some(item => validTemplate(item, expected))) {
      throw new Error(`reminder_template_unapproved_or_mismatched: ${expected.name}/${settings.language}`);
    }
    cache.set(key, now() + 60000);
  };
}
module.exports = { BUTTONS, BODIES, DEFAULT_TEMPLATES, templateDefinitions, templatePayload,
  appointmentDate, appointmentTime, actionPayload, validTemplate, createTemplateVerifier };
