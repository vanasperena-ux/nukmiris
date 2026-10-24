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

describe("signed customer-confirmed appointment management", { concurrency: false }, () => {
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
      NUKMIRIS_ENABLE_MANAGEMENT: "true", NUKMIRIS_DB_PATH: filename, NUKMIRIS_LOOKAHEAD_DAYS: "14", GOOGLE_BOOKING_TOKEN_PATH: token,
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
  async function choose(kind = "Cancelar") {
    await post(kind);
    const choice = buttons().find(button => button.id.includes(":pick:"));
    await click(choice.id);
    return buttons();
  }

  test("menu cancellation requires confirmation, allows keeping the appointment, and deletes exactly once", async () => {
    const source = await f.seed();
    await post("Menu");
    await click(buttons().find(button => button.id.endsWith(":manage")).id);
    await click(buttons().find(button => button.id.endsWith(":cancel")).id);
    await click(buttons()[0].id);
    const no = buttons().find(button => button.id.endsWith(":no"));
    assert.equal(f.deletes.length, 0);
    await click(no.id);
    assert.match(outgoing.at(-1).payload.text.body, /No realizamos cambios/);
    const yes = (await choose()).find(button => button.id.endsWith(":yes"));
    assert.equal(f.deletes.length, 0);
    await click(yes.id); await click(yes.id);
    assert.match(outgoing.at(-1).payload.text.body, /está cancelada/);
    assert.equal(f.deletes.length, 1);
    assert.equal(f.deletes[0].args.eventId, source.eventId);
    assert.equal(f.inserts.length, 1);
    await post("Cancelar");
    assert.match(outgoing.at(-1).payload.text.body, /No encontré próximas citas/);
  });
  test("rescheduling reuses the accepted date-first menu and moves the same event after confirmation", async () => {
    const source = await f.seed();
    await choose("Reagendar");
    assert.equal(buttons()[2].title, "Más opciones");
    await click(buttons()[2].id);
    assert.equal(buttons()[2].title, "Elegir fecha");
    await click(buttons()[2].id);
    const date = rows().filter(row => row.id.includes(":date:")).at(-1);
    const selectedDate = date.id.split(":").at(-1);
    await post(date.id, { kind: "list_reply" });
    await click(buttons()[0].id);
    assert.match(outgoing.at(-1).payload.interactive.body.text, /Cita actual:.*\nNueva cita:/);
    assert.equal(f.patches.length, 0);
    const yes = buttons().find(button => button.id.endsWith(":yes"));
    await click(yes.id); await click(yes.id);
    assert.match(outgoing.at(-1).payload.text.body, /cita está reagendada/);
    assert.equal(f.patches.length, 1);
    assert.equal(f.patches[0].args.eventId, source.eventId);
    assert.equal(f.inserts.length, 1);
    assert.equal(DateTime.fromISO(f.patches[0].args.requestBody.start.dateTime).setZone("America/Mexico_City").toISODate(), selectedDate);
  });
  test("a typed reschedule date keeps the existing appointment until confirmation", async () => {
    const source = await f.seed();
    await choose("Reagendar");
    await post("27/10/2026");
    await click(buttons()[0].id);
    assert.equal(f.patches.length, 0);
    await post("sí");
    assert.match(outgoing.at(-1).payload.text.body, /Usa los botones/);
    assert.equal(f.patches.length, 0);
    const row = f.db.prepare("SELECT request_id FROM appointment_changes").get();
    await click(`change:${row.request_id}:yes`);
    assert.equal(f.patches.length, 1);
    assert.equal(f.patches[0].args.eventId, source.eventId);
  });
  test("foreign business/customer actions and unsigned confirmations cannot change appointments", async () => {
    await f.seed();
    await post("Cancelar");
    const owned = buttons()[0].id;
    await post(owned, { kind: "button_reply", business: "b" });
    await post(owned, { kind: "button_reply", sender: "synthetic-two" });
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM appointment_changes").get().n, 0);
    const yes = (await choose()).find(button => button.id.endsWith(":yes")).id;
    assert.equal(await post(yes, { kind: "button_reply", signed: false }), 403);
    await post(yes, { kind: "button_reply", business: "b" });
    await post(yes, { kind: "button_reply", sender: "synthetic-two" });
    assert.equal(f.deletes.length, 0);
  });
  test("Menu and a new booking flow invalidate unconfirmed changes and old appointment choices", async () => {
    await f.seed();
    const yes = (await choose()).find(button => button.id.endsWith(":yes")).id;
    await post("Menu"); await click(yes);
    assert.equal(f.deletes.length, 0);
    await post("Cancelar");
    const old = buttons()[0].id;
    await post("Cita"); await click(old);
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
    assert.equal(f.deletes.length + f.patches.length, 0);
  });
  test("a busy target discovered at confirmation leaves the original appointment unchanged", async () => {
    const source = await f.seed();
    await choose("Reagendar"); await click(buttons()[0].id);
    const yes = buttons().find(button => button.id.endsWith(":yes"));
    const row = f.db.prepare("SELECT * FROM appointment_changes").get();
    f.events.set("calendar-synthetic-a:external", { id: "external", start: { dateTime: row.target_start }, end: { dateTime: row.target_end } });
    await click(yes.id);
    assert.match(outgoing.at(-1).payload.text.body, /No pudimos realizar este cambio/);
    assert.equal(f.patches.length, 0);
    assert.equal(f.events.get(`calendar-synthetic-a:${source.eventId}`).start.dateTime, f.slot(10).start);
  });
  test("failed WhatsApp delivery after a change can be retried without a second calendar mutation", async () => {
    await f.seed();
    const yes = (await choose()).find(button => button.id.endsWith(":yes"));
    failNextText = true;
    await click(yes.id); await click(yes.id);
    assert.equal(f.deletes.length, 1);
    assert.match(outgoing.at(-1).payload.text.body, /está cancelada/);
  });
  test("an ambiguous change asks for verification and repeating confirmation never repeats the write", async () => {
    await f.seed();
    const yes = (await choose()).find(button => button.id.endsWith(":yes"));
    f.controls.deleteError = 503;
    await click(yes.id); await click(yes.id);
    assert.match(outgoing.at(-1).payload.text.body, /sigue en verificación/);
    assert.equal(f.deletes.length, 1);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 1);
  });
  test("customers without owned upcoming bookings cannot select unrelated events", async () => {
    await f.seed({ businessId: "synthetic-b" });
    await f.seed({ sender: "synthetic-two" });
    await post("Reagendar");
    assert.match(outgoing.at(-1).payload.text.body, /No encontré próximas citas/);
    await post("Cancelar");
    assert.match(outgoing.at(-1).payload.text.body, /No encontré próximas citas/);
    assert.equal(f.patches.length + f.deletes.length, 0);
  });
  test("expired selection and confirmation buttons leave the calendar unchanged", async () => {
    await f.seed();
    await post("Cancelar");
    const selection = buttons()[0].id;
    const session = JSON.parse(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json);
    session.expiresAt = Date.now() - 1;
    f.db.prepare("UPDATE business_customer_sessions SET session_json=?").run(JSON.stringify(session));
    await click(selection);
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
    const yes = (await choose()).find(button => button.id.endsWith(":yes"));
    f.db.prepare("UPDATE appointment_changes SET expires_at=?").run(Date.now() - 1);
    await click(yes.id);
    assert.equal(f.patches.length + f.deletes.length, 0);
  });
  test("more than eight owned appointments stay reachable within WhatsApp list/button limits", async () => {
    for (const hour of [10, 11, 12, 14, 15, 16, 17, 18]) await f.seed({ hour });
    const last = await f.seed({ dayOffset: 1 });
    await post("Cancelar");
    const more = rows().find(row => row.title === "Más citas");
    assert(more); assert.equal(rows().length, 9);
    await post(more.id, { kind: "list_reply" });
    assert(buttons().some(button => button.title === "Citas anteriores"));
    await click(buttons().find(button => button.id.includes(":pick:")).id);
    await click(buttons().find(button => button.id.endsWith(":yes")).id);
    assert.equal(f.deletes.length, 1);
    assert.equal(f.deletes[0].args.eventId, last.eventId);
  });
});
