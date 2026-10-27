"use strict";

const { DateTime } = require("luxon");
const { createHash } = require("node:crypto");
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
function templateMismatches(actual, expected) {
  if (!actual || typeof actual !== "object") return ["template_missing"];
  const reasons = [];
  for (const [field, value] of Object.entries({ status: "APPROVED", category: "UTILITY", language: expected.language, name: expected.name })) {
    if (actual[field] !== value) reasons.push(`${field}_mismatch`);
  }
  const ttl = actual.message_send_ttl_seconds;
  if (ttl === null || ttl === undefined) reasons.push("ttl_missing");
  else if (!Number.isInteger(ttl)) reasons.push("ttl_invalid");
  else if (ttl < 30 || ttl > expected.message_send_ttl_seconds) reasons.push("ttl_out_of_range");
  if (actual.parameter_format && actual.parameter_format !== "POSITIONAL") reasons.push("parameter_format_mismatch");
  if (!Array.isArray(actual.components)) return [...reasons, "components_invalid"];
  if (actual.components.length !== expected.components.length) reasons.push("component_count_mismatch");
  if (actual.components.some(item => !item || !["BODY", "BUTTONS"].includes(item.type))) reasons.push("component_type_mismatch");
  const bodies = actual.components.filter(item => item?.type === "BODY");
  if (bodies.length !== 1) reasons.push("body_component_count_mismatch");
  // Exact copy/positions prevent a reused name from sending unrelated content.
  if (bodies[0]?.text !== expected.components[0].text) reasons.push("body_text_mismatch");
  const buttonComponents = actual.components.filter(item => item?.type === "BUTTONS");
  const expectedButtons = expected.components.find(item => item.type === "BUTTONS")?.buttons || [];
  if (buttonComponents.length !== Number(expectedButtons.length > 0)) reasons.push("button_component_count_mismatch");
  const buttons = buttonComponents[0]?.buttons || [];
  if (!Array.isArray(buttons)) return [...reasons, "buttons_invalid"];
  if (buttons.length !== expectedButtons.length) reasons.push("button_count_mismatch");
  if (buttons.length === expectedButtons.length && buttons.some((button, index) => button?.text !== expectedButtons[index].text) &&
      buttons.every(button => expectedButtons.some(expectedButton => button?.text === expectedButton.text))) reasons.push("button_order_mismatch");
  for (const [index, button] of buttons.entries()) {
    if (button?.type !== "QUICK_REPLY") reasons.push(`button_${index}_type_mismatch`);
    if (button?.text !== expectedButtons[index]?.text) reasons.push(`button_${index}_text_mismatch`);
  }
  return reasons;
}
function validTemplate(actual, expected) { return templateMismatches(actual, expected).length === 0; }
function safeMetadataText(value, limit = 100) {
  return typeof value === "string" && value.length <= limit && /^[\p{L}\p{N} _.,¿?¡!\-]+$/u.test(value) ? value : null;
}
function templateMetadata(actual, expected) {
  if (!actual || typeof actual !== "object") return null;
  const components = Array.isArray(actual.components) ? actual.components : [];
  const body = components.find(item => item?.type === "BODY");
  const buttons = components.find(item => item?.type === "BUTTONS")?.buttons;
  return {
    templateId: safeMetadataText(actual.id), name: safeMetadataText(actual.name, 512), language: safeMetadataText(actual.language),
    status: safeMetadataText(actual.status), category: safeMetadataText(actual.category),
    parameterFormat: safeMetadataText(actual.parameter_format),
    ttlSeconds: Number.isInteger(actual.message_send_ttl_seconds) ? actual.message_send_ttl_seconds : null,
    quality: { score: safeMetadataText(actual.quality_score?.score) },
    componentTypes: components.slice(0, 10).map(item => safeMetadataText(item?.type)),
    bodyMatches: body?.text === expected.components[0].text,
    bodyLength: typeof body?.text === "string" ? body.text.length : null,
    bodyFingerprint: typeof body?.text === "string" ? createHash("sha256").update(body.text).digest("hex").slice(0, 16) : null,
    buttons: Array.isArray(buttons) ? buttons.slice(0, 10).map(button => ({ type: safeMetadataText(button?.type), text: safeMetadataText(button?.text, 25) })) : [],
  };
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
    let expected;
    try {
      const index = Object.keys(DEFAULT_TEMPLATES).indexOf(kind);
      expected = templateDefinitions(settings.language, JSON.parse(settings.templates_json))[index];
      if (!expected || !/^[a-z0-9_]{1,512}$/.test(expected.name || "") || !/^[a-z]{2,3}(?:_[A-Za-z0-9]{2,8})?$/.test(expected.language || "")) throw new Error();
    } catch { throw new Error("reminder_template_configuration_invalid: verify the configured template kind, name and language"); }
    const url = new URL(`https://graph.facebook.com/${apiVersion}/${settings.waba_id}/message_templates`);
    url.search = new URLSearchParams({ name: expected.name,
      fields: "id,name,language,status,category,components,parameter_format,message_send_ttl_seconds,quality_score", limit: "100" }).toString();
    const response = await request(url.toString(), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`reminder_template_check_http_${response.status}: check template-management permissions and WABA mapping`);
    const data = await response.json();
    const candidates = Array.isArray(data.data) ? data.data : [];
    const actual = candidates.find(item => validTemplate(item, expected));
    if (!actual) {
      const observed = candidates.find(item => item?.name === expected.name && item.language === expected.language) ||
        candidates.find(item => item?.name === expected.name) || candidates[0];
      const mismatches = templateMismatches(observed, expected);
      const error = new Error(`reminder_template_unapproved_or_mismatched: ${expected.name}/${settings.language}; ${mismatches.join(", ")}`);
      error.templateCheck = { expected: templateMetadata({ ...expected, status: "APPROVED" }, expected), observed: templateMetadata(observed, expected), mismatches };
      throw error;
    }
    const observed = templateMetadata(actual, expected);
    return { templateId: observed.templateId, ttlSeconds: actual.message_send_ttl_seconds, quality: actual.quality_score ? observed.quality : null,
      expected: templateMetadata({ ...expected, status: "APPROVED" }, expected), observed };
  };
}
module.exports = { BUTTONS, BODIES, DEFAULT_TEMPLATES, templateDefinitions, templatePayload,
  appointmentDate, appointmentTime, actionPayload, validTemplate, templateMismatches, templateMetadata, createTemplateVerifier, TEMPLATE_TTL_SECONDS };
