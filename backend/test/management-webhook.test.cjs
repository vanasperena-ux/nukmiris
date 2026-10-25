"use strict";
const { describe, test, before, beforeEach, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { createHmac, randomUUID } = require("node:crypto");
const { DateTime } = require("luxon");
const { fixture } = require("./helpers/management-fixture.cjs");
const { BOOKING_SCOPES } = require("../lib/google-calendar");
const nativeFetch = globalThis.fetch, secret = "synthetic-management-signature";

describe("signed selection-based appointment management", { concurrency: false }, () => {
  let directory, f, runtime, server, origin, failNextText = false;
  const outgoing = [], originals = new Map();
  before(async () => {
    // Keep future-appointment and date-entry checks independent of the day CI runs.
    const checkpoint = DateTime.fromISO("2026-10-26T09:00:00-06:00").toMillis();
    mock.method(Date, "now", () => checkpoint);
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-management-http-"));
    const filename = path.join(directory, "synthetic.sqlite");
    f = fixture(filename);
    const token = path.join(directory, "synthetic-booking-token.json");
    fs.writeFileSync(token, JSON.stringify({ type: "authorized_user", client_id: "synthetic", client_secret: "synthetic", refresh_token: "synthetic" }));
    for (const [key, value] of Object.entries({
      NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", NUKMIRIS_MODE: "booking", NUKMIRIS_ROUTING_MODE: "receiving_number",
      NUKMIRIS_ENABLE_MANAGEMENT: "true", NUKMIRIS_ENABLE_RELIABILITY: "false", NUKMIRIS_DB_PATH: filename, NUKMIRIS_LOOKAHEAD_DAYS: "14", GOOGLE_BOOKING_TOKEN_PATH: token,
      GOOGLE_OAUTH_TOKEN_PATH: path.join(directory, "unused-read-token.json"),
      WHATSAPP_TOKEN: "synthetic", WHATSAPP_PHONE_NUMBER_ID: "synthetic-unused", WHATSAPP_VERIFY_TOKEN: "synthetic-verify",
      META_APP_SECRET: secret, WHATSAPP_API_VERSION: "v26.0",
    })) { originals.set(key, process.env[key]); process.env[key] = value; }
    const google = require("googleapis").google;
    mock.method(google.auth, "fromJSON", () => ({ getAccessToken: async () => ({ token: "synthetic" }), getTokenInfo: async () => ({ scopes: BOOKING_SCOPES }) }));
    mock.method(google, "calendar", () => ({ ...f.api,
      calendarList: { get: async ({ calendarId }) => ({ data: { id: calendarId, summary: "Synthetic business calendar", accessRole: "writer" } }) },
    }));
    mock.method(require("@google-cloud/local-auth"), "authenticate", () => { throw new Error("Live OAuth forbidden"); });
    mock.method(require("node:https"), "request", () => { throw new Error("External HTTPS forbidden"); });
    mock.method(globalThis, "fetch", async (url, options) => {
      assert.match(String(url), /^https:\/\/graph\.facebook\.com\/v26\.0\/phone-synthetic-[ab]\/messages$/);
      const payload = JSON.parse(options.body), interactive = payload.interactive;
      if (interactive?.type === "button") {
        assert(interactive.action.buttons.length >= 1 && interactive.action.buttons.length <= 3);
        assert(interactive.action.buttons.every(button => button.reply.title.length <= 20));
      }
      if (interactive?.type === "list") {
        const rows = interactive.action.sections[0].rows;
        assert(rows.length >= 1 && rows.length <= 10);
        assert(rows.every(row => row.title.length <= 24 && row.id.length <= 200));
      }
      if (interactive) assert(interactive.body.text.length <= 1024);
      if (payload.type === "text") assert(payload.text.body.length <= 4096);
      outgoing.push({ payload, url: String(url) });
      if (failNextText && payload.type === "text") { failNextText = false; return new Response(JSON.stringify({ error: "synthetic" }), { status: 500 }); }
      return new Response(JSON.stringify({ messages: [{ id: "synthetic-outgoing" }] }), { status: 200 });
    });
    mock.method(console, "log", () => {}); mock.method(console, "error", () => {});
    runtime = require("../whatsapp-webhook.js");
    server = await runtime.start();
    if (!server.listening) await once(server, "listening");
    origin = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(() => {
    outgoing.length = 0; failNextText = false;
    f.events.clear(); f.inserts.length = 0; f.patches.length = 0; f.deletes.length = 0; f.reads.length = 0; f.lists.length = 0;
    for (const key of Object.keys(f.controls)) delete f.controls[key];
    f.db.exec("DELETE FROM calendar_booking_locks; DELETE FROM appointment_changes; DELETE FROM booking_requests; DELETE FROM business_support_messages; DELETE FROM business_support_conversations; DELETE FROM business_customer_sessions;");
  });
  after(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (runtime) runtime.close(); if (f) f.db.close(); mock.restoreAll();
    for (const [key, value] of originals) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });
  async function post(body, { business = "a", sender = "synthetic-one", kind = "text", signed = true } = {}) {
    const message = kind === "text" ? { type: "text", text: { body } }
      : { type: "interactive", interactive: { type: kind, [kind]: { id: body } } };
    Object.assign(message, { id: randomUUID(), from: sender });
    const payload = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: `phone-synthetic-${business}` }, messages: [message] } }] }] });
    const count = outgoing.length;
    const response = await nativeFetch(`${origin}/webhook`, { method: "POST", body: payload, headers: {
      "Content-Type": "application/json", ...(signed ? { "X-Hub-Signature-256": "sha256=" + createHmac("sha256", secret).update(payload).digest("hex") } : {}),
    } });
    await response.arrayBuffer();
    if (response.status === 200) {
      const deadline = performance.now() + 2000;
      while (outgoing.length === count) {
        if (performance.now() > deadline) throw new Error("Expected management reply was not sent");
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    await new Promise(resolve => setImmediate(resolve));
    return response.status;
  }
  const buttons = () => outgoing.at(-1).payload.interactive.action.buttons.map(button => button.reply);
  const rows = () => outgoing.at(-1).payload.interactive.action.sections[0].rows;
  const click = id => post(id, { kind: "button_reply" });
  const body = () => outgoing.at(-1).payload.text?.body || outgoing.at(-1).payload.interactive?.body.text;
  const noConfirmations = () => assert(!outgoing.some(item => item.payload.interactive?.action.buttons?.some(button =>
    ["Confirmar cambio", "Conservar mi cita", "Sí, cancelar", "Confirmar cita"].includes(button.reply.title))));

  test("natural Spanish requests reuse booking and management without mutating on recognition", async () => {
    await f.seed();
    for (const phrase of ["Hola, quiero una cita", "Quiero otra cita", "¿Tienen espacio mañana?", "Quiero cambiar la hora", "Puedo pasar mi cita al jueves?", "Cancélame la cita por favor", "Anular turno"]) {
      await post("Menu"); await post(phrase);
      if (/canc|anular/i.test(phrase)) assert.match(body(), /Se cancelará al seleccionarla/);
      else assert.equal(body(), "Elige un horario que te funciona mejor:");
      assert.equal(f.inserts.length, 1); assert.equal(f.patches.length + f.deletes.length, 0);
      noConfirmations();
    }
  });
  test("conflicting requests clarify the first action and cancellation still needs its appointment selection", async () => {
    const source = await f.seed();
    await post("Quiero cancelar mi cita y hacer otra");
    assert.equal(body(), "¿Qué quieres hacer primero?");
    assert.deepEqual(buttons().map(button => button.title), ["Agendar una cita", "Cancelar mi cita"]);
    assert.equal(f.patches.length + f.deletes.length, 0);
    await click(buttons().find(button => button.title === "Cancelar mi cita").id);
    assert.match(body(), /Se cancelará al seleccionarla/);
    assert.equal(f.deletes.length, 0);
    await click(buttons()[0].id);
    assert.equal(f.deletes.length, 1); assert.equal(f.deletes[0].args.eventId, source.eventId);
  });
  test("inability to attend uses owned appointment context without guessing cancellation", async () => {
    await f.seed();
    await post("No puedo mañana");
    assert.equal(body(), "¿Quieres reagendar o cancelar tu cita?");
    assert.deepEqual(buttons().map(button => button.title), ["Reagendar mi cita", "Cancelar mi cita"]);
    assert.equal(f.patches.length + f.deletes.length, 0);
    await click(buttons()[0].id);
    assert.equal(body(), "Elige un horario que te funciona mejor:");
    await post("Menu"); await post("No puedo mañana, mejor el jueves");
    assert.equal(body(), "Elige un horario que te funciona mejor:");
    assert.equal(f.patches.length + f.deletes.length, 0);
    const session = JSON.parse(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json);
    assert.equal(session.mode, "reschedule_browse");
    assert.equal(session.browse.selectedDate, undefined, "no natural-language date is selected");
  });
  test("another customer's or another business's appointments cannot supply attendance context", async () => {
    await f.seed({ sender: "synthetic-two" }); await f.seed({ businessId: "synthetic-b" });
    await post("No puedo mañana");
    assert.equal(body(), "No entendí qué necesitas. ¿En qué puedo ayudarte?");
    assert.equal(buttons().length, 3);
    assert.equal(f.patches.length + f.deletes.length, 0);
  });
  test("negation and information requests do not start cancellation", async () => {
    await f.seed();
    for (const phrase of ["No quiero cancelar mi cita", "Necesito información sobre cancelaciones", "No quiero agendar una cita"]) {
      f.db.exec("DELETE FROM business_customer_sessions");
      await post(phrase);
      assert.equal(body(), "No entendí qué necesitas. ¿En qué puedo ayudarte?");
      assert.equal(f.patches.length + f.deletes.length, 0); assert.equal(f.inserts.length, 1);
    }
  });
  test("an appointment lookup failure during context recognition is an error, not an inferred action", async () => {
    await f.seed();
    f.controls.afterGet = async () => { throw f.error(503); };
    await post("No puedo mañana");
    assert.match(body(), /No pude consultar tus citas/);
    assert.equal(f.patches.length + f.deletes.length, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM business_customer_sessions").get().n, 0);
  });
  test("active date and appointment selections own free text until Menu or an exact legacy command", async () => {
    await f.seed(); await post("Reagendar");
    const before = f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json;
    await post("Quiero cancelar mi cita");
    assert.match(body(), /DD\/MM\/AAAA/);
    assert.equal(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json, before);
    await post("27/10/2026");
    assert.match(body(), /Qué hora prefieres/);
    await post("Cancelar");
    assert.match(body(), /Se cancelará al seleccionarla/);
    const selections = buttons().map(button => button.id);
    await post("Quiero una cita nueva");
    assert.match(body(), /Usa los botones/);
    const session = JSON.parse(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json);
    assert.deepEqual(session.actions, selections);
    assert.equal(f.patches.length + f.deletes.length, 0);
  });
  test("clarification selections reject guessed actions, other businesses, expiry and older menus", async () => {
    await f.seed(); await post("No puedo mañana");
    const action = buttons()[0].id;
    await click(action.replace(/:reschedule$/, ":book"));
    assert.match(body(), /ya no está vigente/);
    await post(action, { business: "b", kind: "button_reply" });
    assert.match(body(), /ya no está vigente/);
    await post(action, { sender: "synthetic-two", kind: "button_reply" });
    assert.match(body(), /ya no está vigente/);
    await post("Menu"); await click(action);
    assert.match(body(), /ya no está vigente/);
    await post("No puedo mañana");
    const expired = buttons()[0].id;
    const session = JSON.parse(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json);
    session.expiresAt = Date.now() - 1;
    f.db.prepare("UPDATE business_customer_sessions SET session_json=?").run(JSON.stringify(session));
    await click(expired); assert.match(body(), /ya no está vigente/);
    assert.equal(f.patches.length + f.deletes.length, 0);
  });

  test("menu cancellation keeps one appointment selection and cancels immediately only once", async () => {
    const source = await f.seed();
    await post("Menu");
    await click(buttons().find(button => button.id.endsWith(":manage")).id);
    await click(buttons().find(button => button.id.endsWith(":cancel")).id);
    assert.equal(f.deletes.length, 0);
    assert.match(body(), /Se cancelará al seleccionarla/);
    const selected = buttons()[0].id;
    await click(selected); await click(selected);
    assert.match(body(), /está cancelada/);
    assert.equal(f.deletes.length, 1);
    assert.equal(f.deletes[0].args.eventId, source.eventId);
    assert.equal(f.inserts.length, 1);
    noConfirmations();
    await post("Cancelar");
    assert.match(body(), /No encontré próximas citas/);
  });
  test("one appointment goes straight to reschedule availability and date-first selection moves it once", async () => {
    const source = await f.seed();
    await post("Reagendar");
    assert.equal(body(), "Elige un horario que te funciona mejor:");
    assert(buttons().every(button => !button.id.startsWith("owned:")));
    await click(buttons()[2].id);
    assert.equal(body(), "Te muestro mas opciones. Elige un horario que te funciona mejor:");
    await click(buttons()[2].id);
    const date = rows().filter(row => row.id.includes(":date:")).at(-1);
    const selectedDate = date.id.split(":").at(-1);
    await post(date.id, { kind: "list_reply" });
    assert.equal(f.patches.length, 0);
    const selected = buttons()[0].id;
    await click(selected); await click(selected);
    assert.match(body(), /cita está reagendada/);
    assert.match(body(), /\n\d{2}:\d{2}–\d{2}:\d{2}\n\n¡Te esperamos en Business synthetic-a!$/);
    assert.equal(f.patches.length, 1);
    assert.equal(f.patches[0].args.eventId, source.eventId);
    assert.equal(f.inserts.length, 1);
    assert.equal(DateTime.fromISO(f.patches[0].args.requestBody.start.dateTime).setZone("America/Mexico_City").toISODate(), selectedDate);
    noConfirmations();
  });
  test("multiple appointments require selecting the exact appointment before rescheduling", async () => {
    const first = await f.seed(), second = await f.seed({ hour: 12 });
    await post("Reagendar");
    assert(buttons().every(button => button.id.includes(":pick:")));
    await click(buttons()[1].id);
    assert.equal(f.patches.length, 0);
    await click(buttons()[0].id);
    assert.equal(f.patches.length, 1);
    assert.equal(f.patches[0].args.eventId, second.eventId);
    assert.equal(f.events.get(`calendar-synthetic-a:${first.eventId}`).start.dateTime, f.slot(10).start);
    noConfirmations();
  });
  test("a typed date preserves the original appointment until a new slot is selected", async () => {
    const source = await f.seed();
    await post("Reagendar"); await post("27/10/2026");
    assert.equal(f.patches.length, 0);
    assert.equal(f.events.get(`calendar-synthetic-a:${source.eventId}`).start.dateTime, f.slot(10).start);
    await click(buttons()[0].id);
    assert.equal(f.patches.length, 1);
    assert.equal(f.patches[0].args.eventId, source.eventId);
    assert.match(body(), /Martes 27 de octubre de 2026/);
  });
  test("foreign business/customer actions and unsigned selections cannot change appointments", async () => {
    await f.seed(); await post("Cancelar");
    const selected = buttons()[0].id;
    assert.equal(await post(selected, { kind: "button_reply", signed: false }), 403);
    await post(selected, { kind: "button_reply", business: "b" });
    await post(selected, { kind: "button_reply", sender: "synthetic-two" });
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM appointment_changes").get().n, 0);
    assert.equal(f.deletes.length, 0);
    await click(selected);
    const row = f.db.prepare("SELECT request_id FROM appointment_changes").get();
    await post(`change:${row.request_id}:status`, { kind: "button_reply", business: "b" });
    await post(`change:${row.request_id}:status`, { kind: "button_reply", sender: "synthetic-two" });
    assert.equal(f.deletes.length, 1);
  });
  test("Menu and a new booking flow invalidate old cancellation and reschedule selections", async () => {
    await f.seed(); await post("Cancelar");
    const cancellation = buttons()[0].id;
    await post("Menu"); await click(cancellation);
    assert.match(body(), /ya no está vigente/);
    await post("Reagendar");
    const reschedule = buttons()[0].id;
    await post("Cita"); await click(reschedule);
    assert.match(body(), /ya no está vigente/);
    assert.equal(f.deletes.length + f.patches.length, 0);
  });
  test("a busy target discovered after the offer leaves the original appointment unchanged", async () => {
    const source = await f.seed(); await post("Reagendar");
    const selected = buttons()[0].id;
    const session = JSON.parse(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json);
    const target = session.browse.slots[0];
    f.events.set("calendar-synthetic-a:external", { id: "external", start: { dateTime: target.start }, end: { dateTime: target.end } });
    await click(selected);
    assert.match(body(), /Ese horario ya no está disponible/);
    assert(buttons().some(button => button.id.includes(":slot:")));
    assert.equal(f.patches.length, 0);
    assert.equal(f.events.get(`calendar-synthetic-a:${source.eventId}`).start.dateTime, f.slot(10).start);
  });
  test("failed WhatsApp delivery after a cancellation retries the same selection without another delete", async () => {
    await f.seed(); await post("Cancelar");
    const selected = buttons()[0].id;
    failNextText = true;
    await click(selected); await click(selected);
    assert.equal(f.deletes.length, 1);
    assert.match(body(), /está cancelada/);
  });
  test("an ambiguous change exposes status checking and never repeats the selected write", async () => {
    await f.seed(); await post("Cancelar");
    const selected = buttons()[0].id;
    f.controls.deleteError = 503;
    await click(selected);
    assert.match(body(), /sigue en verificación/);
    assert.equal(buttons()[0].title, "Consultar estado");
    const status = buttons()[0].id;
    await click(selected); await click(status);
    assert.equal(f.deletes.length, 1);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 1);
    noConfirmations();
  });
  test("customers without owned upcoming bookings cannot select unrelated events", async () => {
    await f.seed({ businessId: "synthetic-b" }); await f.seed({ sender: "synthetic-two" });
    await post("Reagendar"); assert.match(body(), /No encontré próximas citas/);
    await post("Cancelar"); assert.match(body(), /No encontré próximas citas/);
    assert.equal(f.patches.length + f.deletes.length, 0);
  });
  test("expired cancellation and rescheduling selections leave the calendar unchanged", async () => {
    await f.seed(); await post("Cancelar");
    const selected = buttons()[0].id;
    let session = JSON.parse(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json);
    session.expiresAt = Date.now() - 1;
    f.db.prepare("UPDATE business_customer_sessions SET session_json=?").run(JSON.stringify(session));
    await click(selected); assert.match(body(), /ya no está vigente/);
    await post("Reagendar");
    const slot = buttons()[0].id;
    session = JSON.parse(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json);
    session.browse.expiresAt = Date.now() - 1;
    f.db.prepare("UPDATE business_customer_sessions SET session_json=?").run(JSON.stringify(session));
    await click(slot); assert.match(body(), /ya no está vigente/);
    assert.equal(f.patches.length + f.deletes.length, 0);
  });
  test("more than eight owned appointments stay reachable and selecting the last cancels only that event", async () => {
    for (const hour of [10, 11, 12, 14, 15, 16, 17, 18]) await f.seed({ hour });
    const last = await f.seed({ dayOffset: 1 });
    await post("Cancelar");
    const more = rows().find(row => row.title === "Más citas");
    assert(more); assert.equal(rows().length, 9);
    await post(more.id, { kind: "list_reply" });
    await click(buttons().find(button => button.id.includes(":pick:")).id);
    assert.equal(f.deletes.length, 1);
    assert.equal(f.deletes[0].args.eventId, last.eventId);
  });
  test("Menu displays every upcoming appointment in local chronological order even beyond the button-body limit", async () => {
    for (const dayOffset of [2, 0, 3, 1]) {
      for (const hour of [18, 17, 16, 15, 14, 12, 11, 10]) {
        if (f.inserts.length < 25) await f.seed({ hour, dayOffset });
      }
    }
    const count = outgoing.length;
    await post("Menu");
    const sent = outgoing.slice(count);
    assert(sent.some(item => item.payload.type === "text"));
    assert.equal(sent.at(-1).payload.interactive.type, "button");
    const all = sent.map(item => item.payload.text?.body || item.payload.interactive.body.text).join("\n");
    const expected = [...f.events.values()].map(event => DateTime.fromISO(event.start.dateTime).setZone("America/Mexico_City").setLocale("es"))
      .sort((a, b) => a.toMillis() - b.toMillis());
    let previous = -1;
    for (const start of expected) {
      const label = start.toFormat("cccc d 'de' LLLL 'de' yyyy, HH:mm");
      const index = all.indexOf(label);
      assert(index > previous, label); previous = index;
    }
    assert.match(all, /Tus próximas citas/);
    assert.equal(buttons()[0].title, "Agendar una cita");
    assert.equal(f.patches.length + f.deletes.length, 0);
  });
  test("Menu shows the changed appointment and removes it after cancellation", async () => {
    await f.seed(); await post("Reagendar"); await click(buttons()[0].id);
    await post("Menu");
    assert.match(body(), /de 11:00 a 12:00/);
    assert(!body().includes("de 10:00 a 11:00"));
    await post("Cancelar"); await click(buttons()[0].id); await post("Menu");
    assert(!body().includes("Tu cita actual"));
  });
  test("a Calendar lookup failure keeps the menu usable without claiming no appointments", async () => {
    await f.seed();
    f.controls.afterGet = async () => { throw f.error(503); };
    await post("Menu");
    assert.match(body(), /no pude consultar tus citas/);
    assert.equal(buttons()[0].title, "Agendar una cita");
    assert.equal(f.patches.length + f.deletes.length, 0);
  });
  test("a selected appointment already deleted or cancelled is handled without deleting another event", async () => {
    for (const cancelled of [false, true]) {
      const source = await f.seed(); await post("Cancelar");
      const selected = buttons()[0].id;
      if (cancelled) f.events.get(`calendar-synthetic-a:${source.eventId}`).status = "cancelled";
      else f.events.delete(`calendar-synthetic-a:${source.eventId}`);
      await click(selected);
      assert.match(body(), /ya no aparece en el calendario/);
    }
    assert.equal(f.deletes.length, 0);
  });
  test("definitive reschedule/cancel failures preserve the original and never send success", async () => {
    const source = await f.seed();
    f.controls.patchError = 403;
    await post("Reagendar"); await click(buttons()[0].id);
    assert.match(body(), /No pudimos cambiar tu cita/);
    assert.equal(f.events.get(`calendar-synthetic-a:${source.eventId}`).start.dateTime, f.slot(10).start);
    assert(!(await f.availability.listSlots("synthetic-a")).some(slot => slot.start === f.slot(10).start));
    f.controls.deleteError = 403;
    await post("Cancelar"); await click(buttons()[0].id);
    assert.match(body(), /No pudimos realizar este cambio/);
    assert.equal(f.events.get(`calendar-synthetic-a:${source.eventId}`).status, "confirmed");
  });
  test("cancellation success is delivered only after Google accepts the selected operation", async () => {
    await f.seed(); await post("Cancelar");
    const selected = buttons()[0].id;
    let entered, release;
    const waiting = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    f.controls.beforeDelete = async () => { entered(); await gate; };
    const count = outgoing.length;
    const pending = click(selected);
    await waiting;
    assert.equal(outgoing.length, count);
    release(); await pending;
    assert.match(body(), /está cancelada/);
  });
});
