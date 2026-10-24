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

describe("customer-confirmed WhatsApp bookings", { concurrency: false }, () => {
  let directory, db, runtime, server, origin;
  const outgoing = [], inserts = [], events = new Map(), originals = new Map();
  let failNextText = false;
  before(async () => {
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
          const event = { ...args.requestBody, calendarId: args.calendarId, status: "confirmed" };
          inserts.push(args);
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
    outgoing.length = 0; inserts.length = 0; events.clear(); failNextText = false;
    db.exec("DELETE FROM calendar_booking_locks; DELETE FROM booking_requests; DELETE FROM business_support_messages; DELETE FROM business_support_conversations; DELETE FROM business_customer_sessions; DELETE FROM business_customers;");
  });
  after(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (runtime) runtime.close(); if (db) db.close(); mock.restoreAll();
    for (const [key, value] of originals) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });
  async function post(body, { business = "a", sender = "synthetic-customer", kind = "text", signed = true } = {}) {
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
      const deadline = Date.now() + 2000;
      while (outgoing.length === count) {
        if (Date.now() > deadline) throw new Error("Expected booking response was not sent");
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
  async function confirmation(options = {}) {
    await post("Cita", options);
    const choice = buttons().find(row => row.id.includes(":slot:"));
    await post(choice.id, { ...options, kind: "button_reply" });
    return buttons();
  }

  test("a new customer supplies a name and confirms before any event is created", async () => {
    await post("Cita");
    const selected = buttons()[0].id;
    await post(selected, { kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /nombre completo/);
    assert.equal(inserts.length, 0);
    await post("12345");
    assert.match(outgoing.at(-1).payload.text.body, /nombre completo/);
    await post("Cliente Sintético");
    const confirm = buttons().find(button => button.id.endsWith(":yes"));
    assert(confirm); assert.equal(inserts.length, 0);
    await post(confirm.id, { kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /cita está confirmada/);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].calendarId, "calendar-synthetic-a");
    assert.equal(inserts[0].requestBody.extendedProperties.private.nukmirisBusinessId, "synthetic-a");
    assert(inserts[0].requestBody.summary.includes("Cliente Sintético"));
  });
  test("a known customer can confirm twice without duplicate events", async () => {
    registered();
    const confirm = (await confirmation()).find(button => button.id.endsWith(":yes"));
    await post(confirm.id, { kind: "button_reply" });
    await post(confirm.id, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
    assert.match(outgoing.at(-1).payload.text.body, /cita está confirmada/);
  });
  test("choosing another time and using Menu invalidate unconfirmed requests", async () => {
    registered();
    let choices = await confirmation();
    const oldYes = choices.find(button => button.id.endsWith(":yes")).id;
    await post(choices.find(button => button.id.endsWith(":no")).id, { kind: "button_reply" });
    assert(buttons().some(button => button.id.includes(":slot:")));
    await post(oldYes, { kind: "button_reply" });
    assert.equal(inserts.length, 0);
    choices = await confirmation();
    await post("Menu");
    await post(choices.find(button => button.id.endsWith(":yes")).id, { kind: "button_reply" });
    assert.equal(inserts.length, 0);
    assert.match(outgoing.at(-1).payload.text.body, /No pudimos confirmar/);
  });
  test("unsigned, foreign-business, and foreign-customer confirmations cannot create events", async () => {
    registered();
    const confirm = (await confirmation()).find(button => button.id.endsWith(":yes")).id;
    assert.equal(await post(confirm, { kind: "button_reply", signed: false }), 403);
    await post(confirm, { kind: "button_reply", business: "b" });
    await post(confirm, { kind: "button_reply", sender: "synthetic-other-customer" });
    assert.equal(inserts.length, 0);
    assert.match(outgoing.at(-1).payload.text.body, /No pudimos confirmar/);
  });
  test("a busy event added after selection prevents creation at confirmation", async () => {
    registered();
    const confirm = (await confirmation()).find(button => button.id.endsWith(":yes")).id;
    const row = db.prepare("SELECT * FROM booking_requests").get();
    events.set("synthetic-external", { id: "synthetic-external", calendarId: row.calendar_id, start: { dateTime: row.slot_start }, end: { dateTime: row.slot_end } });
    await post(confirm, { kind: "button_reply" });
    assert.equal(inserts.length, 0);
    assert.match(outgoing.at(-1).payload.text.body, /No pudimos confirmar/);
  });
  test("date-first browsing creates exactly one selected-day appointment only after confirmation", async () => {
    registered();
    await post("Cita");
    assert.equal(buttons().length, 3);
    await post(buttons()[2].id, { kind: "button_reply" });
    assert.equal(buttons()[2].title, "Elegir fecha");
    await post(buttons()[2].id, { kind: "button_reply" });
    const day = rows().filter(row => row.id.includes(":date:")).at(-1);
    const selectedDate = day.id.split(":").at(-1);
    await post(day.id, { kind: "list_reply" });
    const slot = buttons()[0];
    assert.match(slot.title, /^\d{2}:00$/);
    assert.equal(inserts.length, 0);
    await post(slot.id, { kind: "button_reply" });
    const yes = buttons().find(button => button.id.endsWith(":yes"));
    assert(yes);
    assert.equal(inserts.length, 0);
    await post(yes.id, { kind: "button_reply" });
    await post(yes.id, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].calendarId, "calendar-synthetic-a");
    assert.equal(DateTime.fromISO(inserts[0].requestBody.start.dateTime).setZone("America/Mexico_City").toISODate(), selectedDate);
  });
  test("a typed date can lead a new customer through registration and confirmed booking", async () => {
    await post("Cita");
    const session = JSON.parse(db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json);
    const day = DateTime.fromISO(session.slots.at(-1).start).setZone("America/Mexico_City");
    await post(day.toFormat("dd/LL/yyyy"));
    assert.equal(inserts.length, 0);
    await post(buttons()[0].id, { kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /nombre completo/);
    await post("Cliente Nuevo");
    assert.equal(inserts.length, 0);
    await post(buttons().find(button => button.id.endsWith(":yes")).id, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
    assert.equal(DateTime.fromISO(inserts[0].requestBody.start.dateTime).setZone("America/Mexico_City").toISODate(), day.toISODate());
  });
  test("a failed WhatsApp confirmation does not turn a retry into a second booking", async () => {
    registered();
    const confirm = (await confirmation()).find(button => button.id.endsWith(":yes")).id;
    failNextText = true;
    await post(confirm, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
    assert.equal(db.prepare("SELECT state FROM booking_requests").get().state, "confirmed");
    await post(confirm, { kind: "button_reply" });
    assert.equal(inserts.length, 1);
    assert.match(outgoing.at(-1).payload.text.body, /cita está confirmada/);
  });
  test("rescheduling and cancellation remain disabled in booking mode", async () => {
    for (const command of ["Reagendar", "Cancelar"]) {
      await post(command);
      assert.match(outgoing.at(-1).payload.text.body, /opción aún no está disponible/);
    }
    assert.equal(inserts.length, 0);
  });
});
