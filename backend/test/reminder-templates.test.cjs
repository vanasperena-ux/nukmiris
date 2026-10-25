"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { templateDefinitions, templatePayload, validTemplate, createTemplateVerifier, BUTTONS } = require("../lib/reminder-templates");
const { reminderFixture } = require("./helpers/reminder-fixture.cjs");
const { appointmentSuccess } = require("../lib/appointment-messages");
const { createReminderMenu } = require("../lib/reminder-menu");

test("four Spanish Utility templates define four positional variables and the two required quick replies", () => {
  const definitions = templateDefinitions();
  assert.equal(definitions.length, 4);
  for (const definition of definitions) {
    assert.equal(definition.language, "es_MX"); assert.equal(definition.category, "UTILITY");
    assert.deepEqual(definition.components[0].text.match(/\{\{\d\}\}/g), ["{{1}}", "{{2}}", "{{3}}", "{{4}}"]);
    assert(!definition.components[0].text.includes("mañana"));
    assert(!definition.components[0].text.includes("hoy"));
    assert.equal(validTemplate({ ...definition, status: "APPROVED" }, definition), true);
  }
  assert(BUTTONS.every(title => title.length <= 20));
});

for (const invalid of ["missing", "rejected", "marketing", "language", "body", "buttons", "header"]) {
  test(`template validation rejects ${invalid} instead of sending unrelated content`, () => {
    const expected = templateDefinitions()[1], actual = { ...structuredClone(expected), status: "APPROVED" };
    if (invalid === "rejected") actual.status = "REJECTED";
    if (invalid === "marketing") actual.category = "MARKETING";
    if (invalid === "language") actual.language = "en_US";
    if (invalid === "body") actual.components[0].text += " Promotion";
    if (invalid === "buttons") actual.components[1].buttons[0].text = "Otro botón";
    if (invalid === "header") actual.components.push({ type: "HEADER", format: "IMAGE" });
    assert.equal(validTemplate(invalid === "missing" ? undefined : actual, expected), false);
  });
}

test("live approval checks verify sender WABA membership and never cache template approval", async () => {
  const expected = templateDefinitions()[1], calls = [];
  let clock = 0;
  const verify = createTemplateVerifier({ token: "synthetic", now: () => clock, request: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ data: String(url).includes("/phone_numbers?")
      ? [{ id: "synthetic-phone" }] : [{ ...expected, status: "APPROVED" }] }));
  } });
  const settings = { business_id: "synthetic-a", waba_id: "123456", phone_number_id: "synthetic-phone", language: "es_MX",
    templates_json: JSON.stringify({ confirmation: expected.name }) };
  await verify(settings, "confirmation"); await verify(settings, "confirmation");
  assert.equal(calls.length, 4);
  assert.equal(new URL(calls[0].url).pathname, "/v26.0/123456/phone_numbers");
  assert.equal(new URL(calls[1].url).searchParams.get("name"), expected.name);
  await verify({ ...settings, business_id: "synthetic-b", waba_id: "654321" }, "confirmation");
  assert.equal(calls.length, 6);
  clock += 60001; await verify(settings, "confirmation"); assert.equal(calls.length, 8);
});

test("missing WABA, approval and management permissions fail explicitly", async () => {
  for (const code of [200, 403]) {
    const verify = createTemplateVerifier({ token: "synthetic", request: async url => new Response(JSON.stringify({ data: String(url).includes("/phone_numbers?") ? [{ id: "synthetic-phone" }] : [] }), { status: code }) });
    const settings = { business_id: "synthetic-a", waba_id: "123456", phone_number_id: "synthetic-phone", language: "es_MX",
      templates_json: JSON.stringify({ confirmation: "nukmiris_confirmation_v1" }) };
    await assert.rejects(verify(settings, "confirmation"), /reminder_(template|waba)_/);
    await assert.rejects(verify({ ...settings, waba_id: null }, "confirmation"), /waba_id_missing/);
  }
});

test("template payloads keep exact appointment identity in opaque payloads and use the business-local date", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), row = f.row(source.requestId), job = f.jobs(source.requestId).find(j => j.kind === "confirmation");
  const config = f.db.prepare("SELECT * FROM reminder_business_settings WHERE business_id=?").get(source.businessId);
  const payload = templatePayload({ ...row, start_iso: "2027-01-01T00:30:00+09:00", time_zone: "America/Mexico_City" }, job, config, "Negocio sintético");
  assert.deepEqual(payload.template.components[0].parameters.map(p => p.text), ["Cliente Sintético", "Negocio sintético", "jueves 31 de diciembre de 2026", "09:30"]);
  assert.equal(payload.template.components[1].parameters[0].payload, `reminder:${row.action_token}:confirm`);
  assert.equal(payload.template.components[2].parameters[0].payload, `reminder:${row.action_token}:reschedule`);
  assert.equal(payload.biz_opaque_callback_data, `nukmiris-reminder:${job.job_id}`);
});

test("booking success adds only the applicable reminder sentence and retains the existing concise message", () => {
  const details = { start: "2026-11-04T18:00:00-06:00", end: "2026-11-04T19:00:00-06:00", zone: "America/Mexico_City", businessName: "Ejemplo" };
  const original = appointmentSuccess(details), enabled = appointmentSuccess({ ...details, reminders: true });
  assert.equal(enabled, original + "\n\nTe enviaremos recordatorios antes de tu cita.");
  assert(!enabled.includes("menu"));
});

function menuFixture(f) {
  const messages = [], buttons = [], started = [], continuations = [], memory = new Map();
  const menu = createReminderMenu({ reminders: f.reminders,
    managementMenu: { beginReschedule: async (...args) => started.push(args) },
    businessFor: () => ({ business_id: "synthetic-a" }), sessions: memory,
    sendMessage: async (to, body) => messages.push(body), sendReplyButtons: async (to, body, choices) => buttons.push({ body, choices }),
    beforeConfirm: (from, token) => continuations.push(token),
  });
  return { menu, messages, buttons, started, continuations, memory };
}

for (const phrase of ["Sí", "Confirmo", "Confirmada", "Confirmado", "Sí, confirmo"]) {
  test(`contextual Spanish reply “${phrase}” confirms only a dispatched, unambiguous request`, async t => {
    const f = reminderFixture(); t.after(() => f.db.close());
    const source = await f.book(); await f.at(source.requestId, "confirmation");
    const m = menuFixture(f);
    assert.equal(await m.menu.handle(f.sender, { command: phrase, isText: true, allowText: true }), true);
    assert.match(m.messages[0], /está confirmada/); assert.equal(f.patches.length, 1);
  });
}

for (const phrase of ["Reagendar", "Cambiar cita", "Necesito cambiar", "Otra fecha"]) {
  test(`contextual Spanish reply “${phrase}” enters the existing flow for the reminder's appointment`, async t => {
    const f = reminderFixture(); t.after(() => f.db.close());
    const source = await f.book(); await f.at(source.requestId, "confirmation");
    const m = menuFixture(f);
    await m.menu.handle(f.sender, { command: phrase, isText: true, allowText: true });
    assert.equal(m.started[0][1].bookingRequestId, source.requestId);
    assert.equal(f.deletes.length, 0); assert.equal(f.patches.length, 0);
  });
}

test("name/date input protection, absent request context and ambiguous text never confirm an unrelated appointment", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), m = menuFixture(f);
  await m.menu.handle(f.sender, { command: "sí", isText: true, allowText: true });
  assert.match(m.messages[0], /botón del recordatorio/);
  await f.at(source.requestId, "confirmation");
  assert.equal(await m.menu.handle(f.sender, { command: "sí", isText: true, allowText: false }), false);
  assert.equal(f.patches.length, 0);
});

test("Calendar failures produce recovery/error messages and never a false acknowledgment", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  f.controls.patchError = 503;
  const m = menuFixture(f), token = f.row(source.requestId).action_token;
  await m.menu.handle(f.sender, { command: `reminder:${token}:confirm`, isText: false });
  assert.equal(m.messages.length, 0); assert.match(m.buttons[0].body, /verificación/);
  assert.equal(m.continuations[0], token);
});
