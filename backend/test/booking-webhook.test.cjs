"use strict";
const { describe, test, before, beforeEach, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { createHmac, randomUUID } = require("node:crypto");
const { createDatabase } = require("./helpers/database.cjs");
const { prepareBookingSchema } = require("../lib/booking");
const { BOOKING_SCOPES } = require("../lib/google-calendar");
const { DateTime } = require("luxon");
const nativeFetch = globalThis.fetch;
const secret = "synthetic-booking-signature";

describe("slot-selected WhatsApp bookings", { concurrency: false }, () => {
  let directory, db, runtime, server, origin;
  const outgoing = [], inserts = [], events = new Map(), originals = new Map();
  let failNextText = false, insertError = 0, beforeInsert;
  before(async () => {
    const checkpoint = DateTime.fromISO("2026-10-26T09:00:00-06:00").toMillis();
    mock.method(Date, "now", () => checkpoint);
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-booking-http-"));
    const filename = path.join(directory, "synthetic.sqlite");
    db = createDatabase(filename);
    prepareBookingSchema(db);
    const readFile = path.join(directory, "synthetic-read-token.json"), bookingFile = path.join(directory, "synthetic-booking-token.json");
    for (const [file, id] of [[readFile, "read-client"], [bookingFile, "booking-client"]]) {
      fs.writeFileSync(file, JSON.stringify({ type: "authorized_user", client_id: id, client_secret: "synthetic", refresh_token: "synthetic" }));
    }
    for (const [key, value] of Object.entries({
      NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", NUKMIRIS_MODE: "booking", NUKMIRIS_ROUTING_MODE: "receiving_number",
      NUKMIRIS_ENABLE_MANAGEMENT: "false",
      NUKMIRIS_DB_PATH: filename, NUKMIRIS_LOOKAHEAD_DAYS: "14", GOOGLE_OAUTH_TOKEN_PATH: readFile, GOOGLE_BOOKING_TOKEN_PATH: bookingFile,
      WHATSAPP_TOKEN: "synthetic-unused", WHATSAPP_PHONE_NUMBER_ID: "synthetic-unused", WHATSAPP_VERIFY_TOKEN: "synthetic-verify",
      META_APP_SECRET: secret, WHATSAPP_API_VERSION: "v26.0",
    })) { originals.set(key, process.env[key]); process.env[key] = value; }
    const google = require("googleapis").google;
    mock.method(google.auth, "fromJSON", saved => {
      assert.equal(saved.client_id, "booking-client");
      return { getAccessToken: async () => ({ token: "synthetic-access" }), getTokenInfo: async () => ({ scopes: BOOKING_SCOPES }) };
    });
    mock.method(google, "calendar", () => ({
      calendarList: { get: async ({ calendarId }) => ({ data: { id: calendarId, summary: "Synthetic calendar", accessRole: "writer" } }) },
      freebusy: { query: async ({ requestBody }) => {
        const id = requestBody.items[0].id;
        const busy = Array.from(events.values()).filter(event => event.calendarId === id).map(event => ({ start: event.start.dateTime, end: event.end.dateTime }));
        return { data: { calendars: { [id]: { busy } } } };
      } },
      events: {
        insert: async (args, options) => {
          assert.equal(options.retry, false);
          inserts.push(args);
          if (beforeInsert) await beforeInsert(args);
          if (insertError) throw Object.assign(new Error("Synthetic insert failure"), { code: insertError });
          const event = { ...args.requestBody, calendarId: args.calendarId, status: "confirmed", etag: '"synthetic-version"' };
          events.set(`${args.calendarId}:${event.id}`, event);
          return { data: event };
        },
        get: async ({ calendarId, eventId }) => {
          const value = events.get(`${calendarId}:${eventId}`);
          if (!value) throw Object.assign(new Error("Synthetic missing event"), { code: 404 });
          return { data: value };
        },
        patch: () => { throw new Error("Rescheduling is forbidden"); },
        delete: () => { throw new Error("Cancellation is forbidden"); },
      },
    }));
    mock.method(require("@google-cloud/local-auth"), "authenticate", () => { throw new Error("Live OAuth forbidden"); });
    mock.method(require("node:https"), "request", () => { throw new Error("External HTTPS forbidden"); });
    mock.method(globalThis, "fetch", async (url, options) => {
      assert.match(String(url), /^https:\/\/graph\.facebook\.com\/v26\.0\/phone-synthetic-[ab]\/messages$/);
      const payload = JSON.parse(options.body);
      if (payload.interactive) assert(payload.interactive.body.text.length <= 1024);
      outgoing.push({ payload, url: String(url) });
      if (failNextText && payload.type === "text") { failNextText = false; return new Response(JSON.stringify({ error: "synthetic-delivery-failure" }), { status: 500 }); }
      return new Response(JSON.stringify({ messages: [{ id: "synthetic-outgoing" }] }), { status: 200 });
    });
    mock.method(console, "log", () => {}); mock.method(console, "error", () => {});
    runtime = require("../whatsapp-webhook.js");
    server = await runtime.start();
    if (!server.listening) await once(server, "listening");
    origin = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(() => {
    outgoing.length = 0; inserts.length = 0; events.clear(); failNextText = false; insertError = 0; beforeInsert = undefined;
    db.exec("DELETE FROM calendar_booking_locks; DELETE FROM booking_requests; DELETE FROM business_support_messages; DELETE FROM business_support_conversations; DELETE FROM business_customer_sessions; DELETE FROM business_customers;");
  });
  after(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (runtime) runtime.close(); if (db) db.close(); mock.restoreAll();
    for (const [key, value] of originals) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });
  async function post(body, { business = "a", sender = "synthetic-customer", kind = "text", signed = true, expectReply = true } = {}) {
    const message = kind === "text" ? { type: "text", text: { body } }
      : { type: "interactive", interactive: { type: kind, [kind]: { id: body } } };
    Object.assign(message, { id: randomUUID(), from: sender });
    const payload = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: `phone-synthetic-${business}` }, messages: [message] } }] }] });
    const count = outgoing.length;
    const response = await nativeFetch(`${origin}/webhook`, { method: "POST", body: payload, headers: {
      "Content-Type": "application/json", ...(signed ? { "X-Hub-Signature-256": "sha256=" + createHmac("sha256", secret).update(payload).digest("hex") } : {}),
    } });
    await response.arrayBuffer();
    if (response.status === 200 && expectReply) {
      const deadline = performance.now() + 2000;
      while (outgoing.length === count) {
        if (performance.now() > deadline) throw new Error("Expected booking response was not sent");
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    await new Promise(resolve => setImmediate(resolve));
    return response.status;
  }
  const rows = () => outgoing.at(-1).payload.interactive.action.sections[0].rows;
  const buttons = () => outgoing.at(-1).payload.interactive.action.buttons.map(button => button.reply);
  function registered(business = "a", sender = "synthetic-customer") {
    db.prepare("INSERT INTO business_customers VALUES (?,?,?,?,?,?)")
      .run(`customer-${business}-${sender}`, `synthetic-${business}`, sender, "Cliente Probado", "fixture", "fixture");
  }
  async function select(options = {}) {
    await post("Cita", options);
    const choice = buttons().find(row => row.id.includes(":slot:"));
    await post(choice.id, { ...options, kind: "button_reply" });
    return choice.id;
  }
  const menuBody = () => outgoing.at(-1).payload.interactive.body.text;

  test("a new customer supplies a name once and the selected slot is booked without confirmation", async () => {
    await post("Cita");
    const selected = buttons()[0].id;
    await post(selected, { kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /nombre completo/);
    assert.equal(inserts.length, 0);
    await post("12345");
    assert.equal(inserts.length, 0);
    await post("Cliente Sintético");
    assert.match(outgoing.at(-1).payload.text.body, /cita está agendada/);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].calendarId, "calendar-synthetic-a");
    assert(inserts[0].requestBody.summary.includes("Cliente Sintético"));
    await post(selected, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
  });
  test("a recognized customer's selection immediately books once and uses the exact success format", async () => {
    registered();
    const selected = await select();
    assert.equal(outgoing.at(-1).payload.text.body,
      "¡Tu cita está agendada!\n\nLunes 26 de octubre de 2026\n10:00–11:00\n\n¡Te esperamos en Business synthetic-a!");
    assert.equal(inserts.length, 1);
    assert(!outgoing.some(item => item.payload.interactive?.action.buttons?.some(button => button.reply.title === "Confirmar cita")));
    assert(!outgoing.some(item => item.payload.text?.body.includes("nombre completo")));
    await post(selected, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
  });
  test("Menu invalidates old slot selections rather than booking from a stale message", async () => {
    registered();
    await post("Cita");
    const old = buttons()[0].id;
    await post("Menu");
    assert.equal(buttons()[0].title, "Agendar una cita");
    await post(old, { kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
    assert.equal(inserts.length, 0);
  });
  test("unsigned, foreign-business, and foreign-customer slot selections cannot book", async () => {
    registered();
    await post("Cita");
    const choice = buttons()[0].id;
    assert.equal(await post(choice, { kind: "button_reply", signed: false }), 403);
    await post(choice, { kind: "button_reply", business: "b" });
    await post(choice, { kind: "button_reply", sender: "synthetic-other-customer" });
    assert.equal(inserts.length, 0);
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
  });
  test("a busy event added after the offer prevents immediate booking", async () => {
    registered(); await post("Cita");
    const choice = buttons()[0].id;
    const session = JSON.parse(db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json);
    events.set("synthetic-external", { calendarId: "calendar-synthetic-a", start: { dateTime: session.slots[0].start }, end: { dateTime: session.slots[0].end } });
    await post(choice, { kind: "button_reply" });
    assert.equal(inserts.length, 0);
    assert.match(outgoing.at(-1).payload.text.body, /ya no está disponible/);
  });
  test("date-first selection books the chosen day directly without a confirmation screen", async () => {
    registered(); await post("Cita");
    await post(buttons()[2].id, { kind: "button_reply" });
    await post(buttons()[2].id, { kind: "button_reply" });
    const day = rows().filter(row => row.id.includes(":date:")).at(-1);
    await post(day.id, { kind: "list_reply" });
    const selected = buttons()[0].id;
    await post(selected, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
    assert.equal(DateTime.fromISO(inserts[0].requestBody.start.dateTime).setZone("America/Mexico_City").toISODate(), day.id.split(":").at(-1));
    await post(selected, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
  });
  test("a typed date leads a new customer directly from registration to booking", async () => {
    await post("Cita"); await post("27/10/2026");
    await post(buttons()[0].id, { kind: "button_reply" });
    assert.equal(inserts.length, 0);
    await post("Cliente Nuevo");
    assert.equal(inserts.length, 1);
    assert.equal(DateTime.fromISO(inserts[0].requestBody.start.dateTime).setZone("America/Mexico_City").toISODate(), "2026-10-27");
  });
  test("failed success-message delivery can be retried with the original selection without another event", async () => {
    registered(); await post("Cita");
    const selected = buttons()[0].id;
    failNextText = true;
    await post(selected, { kind: "button_reply" });
    assert.equal(db.prepare("SELECT state FROM booking_requests").get().state, "confirmed");
    await post(selected, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
    assert.match(outgoing.at(-1).payload.text.body, /cita está agendada/);
  });
  test("success appears only after Google accepts the event, and rejected inserts never claim success", async () => {
    registered(); await post("Cita");
    let release, entered;
    const waiting = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    beforeInsert = async () => { entered(); await gate; };
    const request = post(buttons()[0].id, { kind: "button_reply" });
    await waiting;
    assert(!outgoing.some(item => item.payload.text?.body.includes("cita está agendada")));
    release(); await request;
    assert.match(outgoing.at(-1).payload.text.body, /cita está agendada/);
    beforeInsert = undefined; insertError = 403;
    await post("Cita"); await post(buttons()[0].id, { kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /No pudimos confirmar/);
    assert.equal(events.size, 1);
  });
  test("an unresolved insert keeps its request and recovery reads never repeat the write", async () => {
    registered(); insertError = 503;
    const selected = await select();
    assert.match(menuBody(), /sigue en verificación/);
    assert.equal(buttons()[0].title, "Consultar estado");
    const status = buttons()[0].id;
    await post(selected, { kind: "button_reply" });
    await post(status, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
    assert.equal(db.prepare("SELECT state FROM booking_requests").get().state, "uncertain");
  });
  test("recognized customers without appointments and new customers receive the normal menu", async () => {
    registered(); await post("mEnU");
    assert.match(menuBody(), /Hola Cliente Probado, bienvenido a Business synthetic-a/);
    assert(!menuBody().includes("Tu cita actual"));
    assert(!menuBody().includes("Tus próximas citas"));
    await post("menu", { sender: "synthetic-new" });
    assert.match(menuBody(), /Hola, bienvenido/);
    assert(!menuBody().includes("nombre completo"));
  });
  test("Menu reuses the live appointment lookup even with management disabled", async () => {
    registered(); await select();
    const event = [...events.values()][0];
    event.start.dateTime = "2026-11-04T18:00:00-06:00";
    event.end.dateTime = "2026-11-04T19:00:00-06:00";
    await post("menu");
    assert.match(menuBody(), /Tu cita actual es para el miércoles 4 de noviembre de 2026, de 18:00 a 19:00\./);
    assert.match(menuBody(), /Hola Cliente Probado/);
    assert.equal(buttons()[0].title, "Agendar una cita");
    assert.equal(inserts.length, 1);
  });
  test("the menu excludes past and cancelled appointments", async () => {
    registered(); await select();
    const past = [...events.values()][0];
    past.start.dateTime = "2026-10-25T10:00:00-06:00"; past.end.dateTime = "2026-10-25T11:00:00-06:00";
    await select();
    [...events.values()][1].status = "cancelled";
    await post("menu");
    assert(!menuBody().includes("Tu cita actual"));
    assert(!menuBody().includes("Tus próximas citas"));
  });
  test("the menu does not expose another business or customer's appointments", async () => {
    registered("b"); await select({ business: "b" });
    registered("a", "synthetic-other"); await select({ sender: "synthetic-other" });
    registered(); await post("menu");
    assert(!menuBody().includes("Tu cita actual"));
    assert(!menuBody().includes("Tus próximas citas"));
    assert.match(menuBody(), /Business synthetic-a/);
  });
  test("manual chat wording and case-insensitive menu return remain functional", async () => {
    registered(); await select(); await post("menu");
    await post(buttons().find(button => button.id.endsWith(":human")).id, { kind: "button_reply" });
    assert.equal(outgoing.at(-1).payload.text.body, 'Escribe tu mensaje.\n\nPara organizar tu cita o cancelar, escribe "menu".');
    await post("Mensaje de prueba", { expectReply: false }); await post("MeNu");
    assert.equal(db.prepare("SELECT status FROM business_support_conversations").get().status, "closed");
    assert.match(menuBody(), /Tu cita actual/);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM business_support_messages").get().n, 1);
  });
  test("rescheduling and cancellation remain disabled without management opt-in", async () => {
    for (const command of ["Reagendar", "Cancelar"]) {
      await post(command);
      assert.match(outgoing.at(-1).payload.text.body, /opción aún no está disponible/);
    }
    assert.equal(inserts.length, 0);
  });
  test("repeating a selected slot after a webhook restart reuses its saved request", async () => {
    registered();
    const selected = await select();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    runtime.close();
    delete require.cache[require.resolve("../whatsapp-webhook.js")];
    runtime = require("../whatsapp-webhook.js");
    server = await runtime.start();
    if (!server.listening) await once(server, "listening");
    origin = `http://127.0.0.1:${server.address().port}`;
    await post(selected, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
    assert.match(outgoing.at(-1).payload.text.body, /cita está agendada/);
  });
});
