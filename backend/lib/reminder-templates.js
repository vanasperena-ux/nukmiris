"use strict";

const { DateTime } = require("luxon");
const { normalizedRecipient } = require("./reliable-delivery");
const BUTTONS = ["Sí, confirmo", "Necesito reagendar"];
// Meta's template-creation property; this is NOT a send-message parameter.
// Require the configured account's approved template to have this TTL or less.
const TEMPLATE_TTL_SECONDS = Object.freeze({ seven_day: 900, confirmation: 900, followup: 900, final: 300 });
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
    message_send_ttl_seconds: TEMPLATE_TTL_SECONDS[kind],
    components: [{ type: "BODY", text,
      example: { body_text: [["Ana", "Salón de ejemplo", "miércoles 4 de noviembre de 2026", "18:00"]] } },
    ...(hasButtons(kind) ? [{ type: "BUTTONS", buttons: BUTTONS.map(text => ({ type: "QUICK_REPLY", text })) }] : [])],
  }));
}
function appointmentDate(row) {
  return DateTime.fromISO(row.start_iso).setZone(row.time_zone).setLocale("es").toFormat("cccc d 'de' LLLL 'de' yyyy");
}
function appointmentTime(row) { return DateTime.fromISO(row.start_iso).setZone(row.time_zone).toFormat("HH:mm"); }
function actionPayload(token, action) {
  if (!/^[0-9a-f-]{36}$/.test(token || "") || !["confirm", "reschedule"].includes(action)) throw new Error("reminder_template_action_invalid");
  return `reminder:${token}:${action}`;
}
function templatePayload(row, job, settings, businessName) {
  const names = JSON.parse(settings.templates_json);
  if (!/^[a-z0-9_]{1,512}$/.test(names[job.kind] || "")) throw new Error("reminder_template_name_invalid");
  const values = [row.customer_name, businessName, appointmentDate(row), appointmentTime(row)];
  const rendered = BODIES[job.kind]?.replace(/\{\{([1-4])\}\}/g, (match, position) => values[Number(position) - 1]);
  if (!values.every(value => typeof value === "string" && value.trim()) || !rendered || rendered.length > 1024 ||
      !/^\d{2}:\d{2}$/.test(values[3])) throw new Error("reminder_template_parameters_invalid: verify customer/business names and appointment date/time");
  return { messaging_product: "whatsapp", to: normalizedRecipient(row.sender), type: "template",
    biz_opaque_callback_data: `nukmiris-reminder:${job.job_id}`,
    template: { name: names[job.kind], language: { code: settings.language }, components: [
      { type: "body", parameters: values.map(text => ({ type: "text", text })) },
      ...(hasButtons(job.kind) ? ["confirm", "reschedule"].map((action, index) => ({
        type: "button", sub_type: "quick_reply", index: String(index),
        parameters: [{ type: "payload", payload: actionPayload(row.action_token, action) }],
      })) : []),
    ] } };
}
function validTemplate(actual, expected) {
  if (!actual || actual.status !== "APPROVED" || actual.category !== "UTILITY" || actual.language !== expected.language ||
      actual.name !== expected.name) return false;
  if (!Number.isInteger(actual.message_send_ttl_seconds) || actual.message_send_ttl_seconds < 30 ||
      actual.message_send_ttl_seconds > expected.message_send_ttl_seconds ||
      (actual.parameter_format && actual.parameter_format !== "POSITIONAL")) return false;
  const body = actual.components?.find(item => item.type === "BODY");
  const buttons = actual.components?.find(item => item.type === "BUTTONS")?.buttons || [];
  const expectedButtons = expected.components.find(item => item.type === "BUTTONS")?.buttons || [];
  // Exact copy/positions prevent a reused name from sending unrelated content.
  return body?.text === expected.components[0].text && buttons.length === expectedButtons.length &&
    buttons.every((button, index) => button.type === "QUICK_REPLY" && button.text === expectedButtons[index].text) &&
    actual.components.length === expected.components.length &&
    actual.components.every(item => ["BODY", "BUTTONS"].includes(item.type));
}
function createTemplateVerifier({ token, apiVersion = "v26.0", request = fetch }) {
  // Neither tenant ownership nor positive approval is cached: a moved number or
  // paused template must fail its very next verification.
  return async (settings, kind) => {
    if (!/^\d+$/.test(settings.waba_id || "")) throw new Error("reminder_waba_id_missing: configure this business's WhatsApp Business Account ID");
    if (!settings.phone_number_id) throw new Error("reminder_sender_mapping_missing: configure the business's sending number");
    {
      let after, found = false;
      for (let page = 0; page < 10; page++) {
        const phones = new URL(`https://graph.facebook.com/${apiVersion}/${settings.waba_id}/phone_numbers`);
        phones.search = new URLSearchParams({ fields: "id", limit: "100", ...(after ? { after } : {}) }).toString();
        const response = await request(phones.toString(), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`reminder_waba_check_http_${response.status}: verify WABA permissions and sending-number ownership`);
        const data = await response.json();
        if (Array.isArray(data.data) && data.data.some(phone => phone.id === settings.phone_number_id)) { found = true; break; }
        if (!data.paging?.next || typeof data.paging.cursors?.after !== "string" || data.paging.cursors.after === after) break;
        after = data.paging.cursors.after;
      }
      if (!found) throw new Error("reminder_sender_waba_mismatch: the configured sending number was not found in this WABA");
    }
    const expected = templateDefinitions(settings.language, JSON.parse(settings.templates_json)).find(item => item.name === JSON.parse(settings.templates_json)[kind]);
    const url = new URL(`https://graph.facebook.com/${apiVersion}/${settings.waba_id}/message_templates`);
    url.search = new URLSearchParams({ name: expected.name,
      fields: "id,name,language,status,category,components,parameter_format,message_send_ttl_seconds,quality_score", limit: "100" }).toString();
    const response = await request(url.toString(), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`reminder_template_check_http_${response.status}: check template-management permissions and WABA mapping`);
    const data = await response.json();
    if (!Array.isArray(data.data) || !data.data.some(item => validTemplate(item, expected))) {
      throw new Error(`reminder_template_unapproved_or_mismatched: ${expected.name}/${settings.language}; verify APPROVED Utility status, exact content and safe TTL`);
    }
    const actual = data.data.find(item => validTemplate(item, expected));
    return { templateId: actual.id || null, ttlSeconds: actual.message_send_ttl_seconds, quality: actual.quality_score || null };
  };
}
module.exports = { BUTTONS, BODIES, DEFAULT_TEMPLATES, templateDefinitions, templatePayload,
  appointmentDate, appointmentTime, actionPayload, validTemplate, createTemplateVerifier, TEMPLATE_TTL_SECONDS };
