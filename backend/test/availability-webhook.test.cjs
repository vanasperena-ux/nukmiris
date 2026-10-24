"use strict";
const { describe, test, before, beforeEach, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { createHmac, randomUUID } = require("node:crypto");
const { createDatabase } = require("./helpers/database.cjs");
const nativeFetch = globalThis.fetch;
const secret = "synthetic-signing-secret";
const sender = "same-synthetic-customer";

describe("signed WhatsApp calendar availability", { concurrency: false }, () => {
  let directory, db, runtime, server, origin;
  const outgoing = [];
  const calendarCalls = [];
  const changes = [];
  const busy = {};
  const originals = new Map();
  let gate;
  before(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-availability-test-"));
    const dbPath = path.join(directory, "synthetic.sqlite");
    db = createDatabase(dbPath);
    const token = path.join(directory, "synthetic-token.json");
    fs.writeFileSync(token, JSON.stringify({ type: "authorized_user", client_id: "synthetic", client_secret: "synthetic", refresh_token: "synthetic" }));
    for (const [name, value] of Object.entries({
      NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", NUKMIRIS_DB_PATH: dbPath,
      NUKMIRIS_MODE: "availability", NUKMIRIS_ROUTING_MODE: "receiving_number",
      NUKMIRIS_LOOKAHEAD_DAYS: "14", GOOGLE_OAUTH_TOKEN_PATH: token,
      WHATSAPP_TOKEN: "synthetic-unused", WHATSAPP_PHONE_NUMBER_ID: "synthetic-default-not-used",
      WHATSAPP_VERIFY_TOKEN: "synthetic-verify", META_APP_SECRET: secret, WHATSAPP_API_VERSION: "v26.0",
    })) { originals.set(name, process.env[name]); process.env[name] = value; }
    const google = require("googleapis").google;
    mock.method(google.auth, "fromJSON", () => ({ synthetic: true }));
    mock.method(google, "calendar", () => ({
      calendarList: { get: async ({ calendarId }) => ({ data: { id: calendarId, summary: "Synthetic business calendar", accessRole: "writer" } }) },
      freebusy: { query: async args => {
        calendarCalls.push(args.requestBody);
        const id = args.requestBody.items[0].id;
        return { data: { calendars: { [id]: { busy: busy[id] || [] } } } };
      } },
      events: Object.fromEntries(["insert", "patch", "update", "delete"].map(method => [method, () => { changes.push(method); throw new Error("Calendar changes forbidden"); }])),
    }));
    mock.method(require("@google-cloud/local-auth"), "authenticate", () => { throw new Error("OAuth forbidden in tests"); });
    mock.method(require("node:https"), "request", () => { throw new Error("External HTTPS forbidden in tests"); });
    mock.method(globalThis, "fetch", async (url, options) => {
      assert.match(String(url), /^https:\/\/graph\.facebook\.com\/v26\.0\/phone-synthetic-[ab]\/messages$/);
      const item = { url: String(url), payload: JSON.parse(options.body) };
      outgoing.push(item);
      if (gate) await gate;
      return new Response(JSON.stringify({ messages: [{ id: "synthetic-outgoing" }] }), { status: 200 });
    });
    mock.method(console, "log", () => {});
    mock.method(console, "error", () => {});
    runtime = require("../whatsapp-webhook.js");
    server = await runtime.start();
    if (!server.listening) await once(server, "listening");
    origin = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(() => {
    outgoing.length = 0; calendarCalls.length = 0; changes.length = 0; gate = undefined;
    for (const key of Object.keys(busy)) delete busy[key];
    db.exec("DELETE FROM business_support_messages; DELETE FROM business_support_conversations; DELETE FROM business_customer_sessions;");
  });
  after(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (runtime) runtime.close();
    if (db) db.close();
    mock.restoreAll();
    for (const [key, value] of originals) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });
  async function settle(condition) {
    const deadline = Date.now() + 1500;
    while (!condition()) {
      if (Date.now() >= deadline) throw new Error("Expected asynchronous message result was not produced");
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    await new Promise(resolve => setImmediate(resolve));
  }
  async function post(body, { business = "a", kind = "text", id = randomUUID(), signature = true, expectReply = true } = {}) {
    const msg = kind === "text" ? { id, from: sender, type: "text", text: { body } }
      : { id, from: sender, type: "interactive", interactive: { type: kind, [kind]: { id: body } } };
    const payload = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: `phone-synthetic-${business}` }, messages: [msg] } }] }] });
    const count = outgoing.length;
    const response = await nativeFetch(`${origin}/webhook`, { method: "POST", body: payload,
      headers: { "Content-Type": "application/json", ...(signature ? { "X-Hub-Signature-256": "sha256=" + createHmac("sha256", secret).update(payload).digest("hex") } : {}) } });
    await response.arrayBuffer();
    if (expectReply && response.status === 200) await settle(() => outgoing.length > count);
    return response.status;
  }
  const rows = () => outgoing.at(-1).payload.interactive.action.sections[0].rows;

  test("unsigned requests are rejected before any reply or stored session", async () => {
    assert.equal(await post("Hola", { signature: false, expectReply: false }), 403);
    assert.equal(outgoing.length, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM business_customer_sessions").get().n, 0);
  });
  test("Cita lists hourly choices from the receiving business's exact calendar", async () => {
    assert.equal(await post("Cita", { business: "b" }), 200);
    assert.deepEqual(calendarCalls.at(-1).items, [{ id: "calendar-synthetic-b" }]);
    assert(outgoing.at(-1).url.endsWith("/phone-synthetic-b/messages"));
    const choices = rows().filter(row => row.id.includes(":slot:"));
    assert(choices.length > 3);
    assert(choices.every(row => /\d{2}:00$/.test(row.title)));
    assert(choices.some(row => row.title.endsWith("18:00")));
    assert(!choices.some(row => row.title.endsWith("13:00")));
    assert.deepEqual(changes, []);
  });
  test("the main-menu appointment button opens calendar lookup without enabling booking", async () => {
    await post("Hola");
    const book = outgoing.at(-1).payload.interactive.action.buttons.find(button => button.reply.id.endsWith(":book"));
    await post(book.reply.id, { kind: "button_reply" });
    assert(outgoing.at(-1).payload.interactive.body.text.includes("Esta consulta no reserva"));
    assert.deepEqual(changes, []);
  });
  test("pagination exposes later available hours rather than stopping after three slots", async () => {
    await post("Cita");
    const firstPage = rows();
    const next = firstPage.find(row => row.id.includes(":page:"));
    assert(next);
    await post(next.id, { kind: "list_reply" });
    const nextPage = rows();
    assert(nextPage.some(row => row.title === "Horarios anteriores"));
    assert(nextPage.filter(row => row.id.includes(":slot:")).every(row => !firstPage.some(before => before.id === row.id)));
    assert(nextPage.length <= 10);
  });
  test("the same customer and message ID stay separate across receiving business numbers", async () => {
    const id = randomUUID();
    await post("Cita", { business: "a", id });
    const buttonFromA = rows()[0].id;
    await post("Cita", { business: "b", id });
    assert.equal(outgoing.length, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM business_customer_sessions WHERE whatsapp_id=?").get(sender).n, 2);
    await post(buttonFromA, { business: "b", kind: "list_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
    assert.deepEqual(changes, []);
  });
  test("a selected time is checked again and never creates a calendar event", async () => {
    await post("Cita");
    const choice = rows()[0];
    await post(choice.id, { kind: "list_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /sigue disponible/);
    assert.match(outgoing.at(-1).payload.text.body, /reserva automática todavía no está activada/);
    assert.equal(calendarCalls.length, 2);
    assert.deepEqual(changes, []);
  });
  test("an appointment added to Google after the offer makes the selected slot unavailable", async () => {
    await post("Cita");
    const choice = rows()[0].id;
    const stored = JSON.parse(db.prepare("SELECT session_json FROM business_customer_sessions WHERE business_id=?").get("synthetic-a").session_json);
    busy["calendar-synthetic-a"] = [stored.slots[0]];
    await post(choice, { kind: "list_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /ya no está disponible/);
    assert.deepEqual(changes, []);
  });
  test("queued concurrent messages are both processed instead of dropping the second", async () => {
    let release;
    gate = new Promise(resolve => { release = resolve; });
    try {
      await post("Hola");
      await post("Synthetic support request", { expectReply: false });
      release(); gate = undefined;
      await settle(() => db.prepare("SELECT COUNT(*) AS n FROM business_support_messages").get().n === 1);
      assert.equal(db.prepare("SELECT message_text FROM business_support_messages").get().message_text, "Synthetic support request");
    } finally { release(); gate = undefined; }
  });
  test("unknown receiving phone IDs are ignored without fallback to a customer's development route", async () => {
    assert.equal(await post("Cita", { business: "unknown", expectReply: false }), 200);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(outgoing.length, 0);
    assert.equal(calendarCalls.length, 0);
  });
});
