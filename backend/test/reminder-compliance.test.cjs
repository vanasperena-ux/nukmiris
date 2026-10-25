"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { reminderFixture } = require("./helpers/reminder-fixture.cjs");
const { createAppointmentReminders } = require("../lib/appointment-reminders");
const { templateDefinitions, templatePayload, validTemplate, createTemplateVerifier, TEMPLATE_TTL_SECONDS } = require("../lib/reminder-templates");
const { reminderPermission, recordReminderPermission, isReminderOptOut } = require("../lib/reminder-permissions");
const { createReliableDelivery, prepareReliabilitySchema } = require("../lib/reliable-delivery");
const { createHash } = require("node:crypto");

test("TTL is configured at template creation, with five minutes for the final reminder and fifteen for others", () => {
  assert.deepEqual(templateDefinitions().map(t => t.message_send_ttl_seconds), [900, 900, 900, 300]);
  assert.equal(TEMPLATE_TTL_SECONDS.final, 300);
  for (const definition of templateDefinitions()) assert.equal(validTemplate({ ...definition, status: "APPROVED" }, definition), true);
});

for (const ttl of [undefined, -1, 0, 29, 300.5, "300", 301, 2592000]) {
  test(`final template TTL ${String(ttl)} cannot pass approval validation`, () => {
    const expected = templateDefinitions()[3];
    assert.equal(validTemplate({ ...expected, status: "APPROVED", message_send_ttl_seconds: ttl }, expected), false);
  });
}

test("a shorter explicit template TTL is safe; names, text, variables and buttons retain the accepted baseline", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const expected = templateDefinitions()[1];
  assert.equal(validTemplate({ ...expected, status: "APPROVED", message_send_ttl_seconds: 300 }, expected), true);
  assert.equal(validTemplate({ ...expected, status: "APPROVED", message_send_ttl_seconds: 30 }, expected), true);
  assert.deepEqual(expected.components[1].buttons.map(b => b.text), ["Sí, confirmo", "Necesito reagendar"]);
  const source = await f.book(), row = f.row(source.requestId), job = f.jobs(source.requestId).find(j => j.kind === "confirmation");
  const config = f.db.prepare("SELECT * FROM reminder_business_settings WHERE business_id=?").get(source.businessId);
  const payload = templatePayload(row, job, config, "Business synthetic-a");
  assert.equal(payload.template.name, "nukmiris_confirmation_v1");
  assert.equal(payload.template.components[0].parameters.length, 4);
  assert(!Object.hasOwn(payload, "ttl")); assert(!Object.hasOwn(payload.template, "message_send_ttl_seconds"));
  assert(payload.template.components.filter(c => c.type === "button").every(c => c.parameters[0].payload.length < 64));
});

test("a sending number from another WABA cannot use that WABA's approval", async () => {
  const calls = [];
  const verify = createTemplateVerifier({ token: "synthetic", request: async url => {
    calls.push(String(url)); return new Response(JSON.stringify({ data: [{ id: "different-business-phone" }] }));
  } });
  await assert.rejects(verify({ business_id: "synthetic-a", waba_id: "123456", phone_number_id: "correct-phone",
    language: "es_MX", templates_json: JSON.stringify({ final: "nukmiris_final_v1" }) }, "final"), /sender_waba_mismatch/);
  assert(calls.every(url => url.includes("/phone_numbers?")));
});

test("accepted button labels fit WhatsApp's 25-character limit and malformed or oversized parameters are blocked", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), row = f.row(source.requestId), job = f.jobs(source.requestId).find(j => j.kind === "confirmation");
  const config = f.db.prepare("SELECT * FROM reminder_business_settings WHERE business_id=?").get(source.businessId);
  const buttons = templateDefinitions()[1].components[1].buttons;
  assert.equal(buttons.length, 2); assert(buttons.length <= 10); assert.deepEqual(buttons.map(b => b.text.length), [12, 18]);
  assert(buttons.every(button => button.text.length <= 25));
  assert.throws(() => templatePayload(row, job, config, "X".repeat(1100)), /parameters_invalid/);
  assert.throws(() => templatePayload({ ...row, action_token: "not-a-valid-appointment-token" }, job, config, "Business"), /action_invalid/);
  assert.throws(() => templatePayload({ ...row, start_iso: "bad-date" }, job, config, "Business"), /parameters_invalid/);
});

test("automatic category changes and a cleared custom TTL block sending until the approved Utility contract is restored", () => {
  const expected = templateDefinitions()[1];
  for (const changed of [{ category: "MARKETING", message_send_ttl_seconds: null }, { message_send_ttl_seconds: null }, { parameter_format: "NAMED" }]) {
    assert.equal(validTemplate({ ...expected, status: "APPROVED", ...changed }, expected), false);
  }
});

test("sender membership pagination keeps authorization on Graph rather than following an arbitrary next URL", async () => {
  const calls = [], expected = templateDefinitions()[3];
  const verify = createTemplateVerifier({ token: "synthetic", request: async url => {
    calls.push(String(url));
    if (String(url).includes("/message_templates?")) return new Response(JSON.stringify({ data: [{ ...expected, status: "APPROVED" }] }));
    return new Response(JSON.stringify(new URL(url).searchParams.has("after") ? { data: [{ id: "correct-phone" }] }
      : { data: [], paging: { next: "https://untrusted.invalid/do-not-follow", cursors: { after: "synthetic-cursor" } } }));
  } });
  await verify({ business_id: "synthetic-a", waba_id: "123456", phone_number_id: "correct-phone", language: "es_MX",
    templates_json: JSON.stringify({ final: expected.name }) }, "final");
  assert.equal(calls.length, 3); assert(calls.every(url => new URL(url).hostname === "graph.facebook.com"));
});

test("a number moved out of its WABA immediately loses eligibility without a membership cache", async () => {
  let belongs = true;
  const expected = templateDefinitions()[3], config = { business_id: "synthetic-a", waba_id: "123456", phone_number_id: "phone",
    language: "es_MX", templates_json: JSON.stringify({ final: expected.name }) };
  const verify = createTemplateVerifier({ token: "synthetic", request: async url => new Response(JSON.stringify({ data:
    String(url).includes("/phone_numbers?") ? (belongs ? [{ id: "phone" }] : []) : [{ ...expected, status: "APPROVED" }] })) });
  await verify(config, "final"); belongs = false;
  await assert.rejects(verify(config, "final"), /sender_waba_mismatch/);
});

test("pause, disable, rejection and unavailability are checked fresh even immediately after approval", async () => {
  const expected = templateDefinitions()[1], config = { business_id: "synthetic-a", waba_id: "123456", phone_number_id: "phone",
    language: "es_MX", templates_json: JSON.stringify({ confirmation: expected.name }) };
  let status = "APPROVED", reads = 0;
  const verify = createTemplateVerifier({ token: "synthetic", request: async url => {
    if (String(url).includes("/phone_numbers?")) return new Response(JSON.stringify({ data: [{ id: "phone" }] }));
    reads++;
    return new Response(JSON.stringify({ data: [{ ...expected, status, quality_score: { score: "RED" } }] }));
  } });
  assert.equal((await verify(config, "confirmation")).quality.score, "RED");
  // Meta's supplied fundamentals allow low-quality templates while APPROVED;
  // status, not an invented quality threshold, determines availability.
  for (status of ["PAUSED", "DISABLED", "REJECTED", "PENDING", "PENDING_DELETION", "DELETED"]) {
    await assert.rejects(verify(config, "confirmation"), /unapproved_or_mismatched/);
  }
  assert.equal(reads, 7);
});

test("booking alone does not grant permission, promise reminders or send proactive messages", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  f.db.exec("DELETE FROM reminder_permission_events");
  const source = await f.book();
  assert.equal(reminderPermission(f.db, source.businessId, f.sender, f.now()).allowed, false);
  assert.equal(f.reminders.hasFutureReminders(source.requestId), false);
  await f.at(source.requestId, "confirmation");
  assert.equal(f.sent.length, 0); assert.equal(f.row(source.requestId).attendance, "PENDING");
  assert.equal(f.jobs(source.requestId).find(j => j.kind === "confirmation").last_error, "customer_permission_missing");
});

test("permission evidence is scoped, persistent, idempotent, and never revived by importing an older grant", t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const revoke = { businessId: "synthetic-a", sender: f.sender, decision: "revoked", occurredAt: f.now(), source: "synthetic_external_request",
    wording: "No me envíes recordatorios", evidence: "synthetic-opt-out", recordedBy: "synthetic-owner" };
  const first = recordReminderPermission(f.db, revoke, f.now());
  assert.equal(recordReminderPermission(f.db, revoke, f.now()).event_id, first.event_id);
  assert.equal(reminderPermission(f.db, "synthetic-a", f.sender, f.now()).allowed, false);
  assert.equal(reminderPermission(f.db, "synthetic-b", f.sender, f.now()).allowed, true);
  f.grant("synthetic-a", f.sender, f.now() - 10, "synthetic-late-import-old-grant");
  assert.equal(reminderPermission(f.db, "synthetic-a", f.sender, f.now()).allowed, false);
  assert.throws(() => recordReminderPermission(f.db, { ...revoke, decision: "granted" }, f.now()), /Conflicting/);
});

test("permission grants require real evidence and a known scoped customer; revocation can precede registration", t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const input = { businessId: "synthetic-a", sender: "synthetic-unknown", decision: "granted", occurredAt: f.now(),
    source: "synthetic-form", wording: "Quiero recordatorios", evidence: "synthetic-form-entry", recordedBy: "synthetic-owner" };
  assert.throws(() => recordReminderPermission(f.db, input, f.now()), /existing customer identity/);
  recordReminderPermission(f.db, { ...input, decision: "revoked" }, f.now());
  assert.equal(reminderPermission(f.db, input.businessId, input.sender, f.now()).allowed, false);
  assert.throws(() => recordReminderPermission(f.db, { ...input, sender: f.sender, evidence: "" }, f.now()), /evidence reference/);
  assert.throws(() => recordReminderPermission(f.db, { ...input, sender: f.sender, occurredAt: f.now() + 1 }, f.now()), /valid past/);
});

test("a permission withdrawal during network checks prevents the already claimed reminder from sending", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book();
  const reminders = createAppointmentReminders({ ...f.options, verifyTemplate: async () => {
    recordReminderPermission(f.db, { businessId: source.businessId, sender: f.sender, decision: "revoked", occurredAt: f.now(),
      source: "synthetic-whatsapp", wording: "STOP", evidence: "synthetic-stop", recordedBy: "synthetic-customer" }, f.now());
  } });
  f.setNow(f.jobs(source.requestId).find(j => j.kind === "confirmation").due_at); await reminders.tick();
  assert.equal(f.sent.length, 0);
  assert.equal(f.jobs(source.requestId).find(j => j.kind === "confirmation").last_error, "customer_permission_revoked");
});

test("accepted without delivery proof cannot trigger the dependent follow-up", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation"); await f.at(source.requestId, "followup");
  assert.equal(f.sent.length, 1);
  assert.equal(f.jobs(source.requestId).find(j => j.kind === "followup").last_error, "original_request_not_delivered");
});

test("a delivered request allows one follow-up, without assuming API request ordering is delivery ordering", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  const job = f.jobs(source.requestId).find(j => j.kind === "confirmation");
  f.reminders.receipt({ business_id: source.businessId, phone_number_id: "phone-synthetic-a" }, {
    biz_opaque_callback_data: `nukmiris-reminder:${job.job_id}`, id: job.meta_message_id, recipient_id: "523312345678", status: "delivered",
  });
  await f.at(source.requestId, "followup"); await f.reminders.tick(); assert.equal(f.sent.length, 2);
});

test("obsolete quoted requests and unquoted replies cannot confirm a replacement schedule", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(); await f.at(source.requestId, "confirmation");
  const old = f.jobs(source.requestId).find(j => j.kind === "confirmation"), oldToken = f.row(source.requestId).action_token;
  const appointment = await f.management.readAppointment(source);
  const change = await f.management.createIntent({ ...source, expectedEtag: appointment.etag, kind: "reschedule",
    slot: { start: "2026-11-06T18:00:00-06:00", end: "2026-11-06T19:00:00-06:00" } });
  await f.management.confirm({ ...source, requestId: change.requestId });
  await f.at(source.requestId, "confirmation");
  const latest = f.jobs(source.requestId).findLast(j => j.kind === "confirmation");
  assert.equal(f.reminders.textTarget(source, { replyToId: old.meta_message_id }), null);
  assert.equal(f.reminders.textTarget(source), null);
  assert.equal(f.reminders.textTarget(source, { replyToId: latest.meta_message_id }).schedule_version, 2);
  assert.equal((await f.reminders.confirm(source, oldToken)).status, "stale");
  assert.equal(f.row(source.requestId).attendance, "PENDING");
});

test("quote context selects the exact one of two current appointments and never crosses businesses", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const first = await f.book({ start: "2026-11-04T10:00:00-06:00" }), second = await f.book({ start: "2026-11-04T11:00:00-06:00" });
  await f.at(first.requestId, "confirmation"); await f.at(second.requestId, "confirmation");
  const quoted = f.jobs(first.requestId).find(j => j.kind === "confirmation").meta_message_id;
  assert.equal(f.reminders.textTarget(first), null);
  assert.equal(f.reminders.textTarget(first, { replyToId: quoted }).booking_request_id, first.requestId);
  assert.equal(f.reminders.textTarget({ ...first, businessId: "synthetic-b" }, { replyToId: quoted }), null);
});

test("a queued generic response older than the current request cannot become a confirmation", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), oldTime = f.now(); await f.at(source.requestId, "confirmation");
  assert.equal(f.reminders.textTarget(source, { sentAt: oldTime }), null);
  assert.equal(f.reminders.textTarget(source, { sentAt: f.now() }).booking_request_id, source.requestId);
});

test("delivery TTL plus transport budget must fit before the appointment, even under future interval overrides", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), start = f.row(source.requestId).start_ms;
  f.setNow(start - 300000);
  f.db.prepare("UPDATE reminder_jobs SET due_at=?,expires_at=? WHERE booking_request_id=? AND kind='final'").run(f.now(), start - 1, source.requestId);
  await f.reminders.tick();
  assert.equal(f.sent.length, 0); assert.equal(f.jobs(source.requestId).find(j => j.kind === "final").last_error, "template_ttl_would_outlive_appointment");
});

test("reminder-specific opt-out recognition never treats appointment cancellation or a generic yes as permission", () => {
  for (const phrase of ["STOP", "stop!", "No me envíes recordatorios", "no  quiero recordatorios"]) assert.equal(isReminderOptOut(phrase), true);
  for (const phrase of ["cancelar", "cancelar cita", "sí", "confirmo", "Cita"]) assert.equal(isReminderOptOut(phrase), false);
});

test("durable inbox preserves quote/timestamp metadata and rejects changed newly recorded context", t => {
  const f = reminderFixture(); prepareReliabilitySchema(f.db);
  const delivery = createReliableDelivery({ db: f.db, capabilities: "synthetic",
    resolveBusiness: () => ({ business_id: "synthetic-a", phone_number_id: "phone-synthetic-a" }), now: f.now });
  delivery.acquire(); t.after(() => { delivery.release(); f.db.close(); });
  const message = { id: "synthetic-reply", from: f.sender, type: "text", timestamp: String(f.now() / 1000),
    context: { id: "synthetic-quoted-message" }, text: { body: "Sí" } };
  const body = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "phone-synthetic-a" }, messages: [message] } }] }] };
  assert.equal(delivery.accept(body), 1);
  const stored = JSON.parse(f.db.prepare("SELECT message_json FROM message_inbox").get().message_json);
  assert.equal(stored.context.id, message.context.id); assert.equal(stored.timestamp, message.timestamp);
  assert.equal(delivery.accept(body), 0);
  assert.throws(() => delivery.accept({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "phone-synthetic-a" },
    messages: [{ ...message, context: { id: "changed-target" } }] } }] }] }), /Conflicting message identity/);
});

test("pre-audit inbox hashes remain deduplicated after adding quote/timestamp preservation", t => {
  const f = reminderFixture(); prepareReliabilitySchema(f.db);
  const delivery = createReliableDelivery({ db: f.db, capabilities: "synthetic",
    resolveBusiness: () => ({ business_id: "synthetic-a", phone_number_id: "phone-synthetic-a" }), now: f.now });
  delivery.acquire(); t.after(() => { delivery.release(); f.db.close(); });
  const raw = { id: "synthetic-legacy", from: f.sender, type: "text", timestamp: String(f.now() / 1000), text: { body: "menu" } };
  const body = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "phone-synthetic-a" }, messages: [raw] } }] }] };
  delivery.accept(body);
  const oldJson = JSON.stringify({ id: raw.id, from: raw.from, type: raw.type, text: raw.text });
  f.db.prepare("UPDATE message_inbox SET message_json=?,content_hash=?").run(oldJson, createHash("sha256").update(oldJson).digest("hex"));
  assert.equal(delivery.accept(body), 0);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM message_inbox").get().n, 1);
});
