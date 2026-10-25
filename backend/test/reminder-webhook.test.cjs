"use strict";
const { describe, test, before, beforeEach, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const { createHmac, randomUUID } = require("node:crypto");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { once } = require("node:events");
const { reminderFixture } = require("./helpers/reminder-fixture.cjs");
const { prepareReliabilitySchema } = require("../lib/reliable-delivery");
const { templateDefinitions } = require("../lib/reminder-templates");
const { BOOKING_SCOPES } = require("../lib/google-calendar");
const nativeFetch = globalThis.fetch;

describe("signed reminder webhook and existing appointment workflows", { concurrency: false }, () => {
  const outgoing = [], originals = new Map(), secret = "synthetic-reminder-secret";
  let directory, f, runtime, server, origin;
  async function waitFor(predicate) {
    const deadline = performance.now() + 8000;
    while (!predicate()) {
      if (performance.now() > deadline) throw new Error("Synthetic reminder HTTP timeout");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  async function submit(body) {
    const raw = JSON.stringify(body), signature = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    return nativeFetch(origin + "/webhook", { method: "POST", body: raw,
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature } });
  }
  async function post(content, { type = "text", business = "synthetic-a", id = randomUUID(), sender } = {}) {
    const raw = { id, from: sender || f.sender, timestamp: String(Math.floor(f.now() / 1000)), type };
    if (type === "text") raw.text = { body: content };
    else if (type === "button") raw.button = { payload: content, text: "Ignored visible title" };
    else raw.interactive = { type: "button_reply", button_reply: { id: content } };
    assert.equal((await submit({ entry: [{ changes: [{ value: { metadata: { phone_number_id: `phone-${business}` }, messages: [raw] } }] }] })).status, 200);
    await waitFor(() => f.db.prepare("SELECT state FROM message_inbox WHERE message_id=?").get(id)?.state === "completed");
    await waitFor(() => f.db.prepare("SELECT COUNT(*) AS n FROM message_outbox WHERE state IN ('pending','sending')").get().n === 0);
    return id;
  }
  async function sendRequest(source) {
    f.setNow(f.jobs(source.requestId).find(job => job.kind === "confirmation").due_at);
    await waitFor(() => f.jobs(source.requestId).find(job => job.kind === "confirmation").state === "accepted");
    return `reminder:${f.row(source.requestId).action_token}:confirm`;
  }
  before(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-reminder-http-"));
    f = reminderFixture({ filename: path.join(directory, "synthetic.sqlite") });
    prepareReliabilitySchema(f.db);
    const token = path.join(directory, "synthetic-booking-token.json");
    fs.writeFileSync(token, JSON.stringify({ type: "authorized_user", client_id: "synthetic", client_secret: "synthetic", refresh_token: "synthetic" }));
    for (const [key, value] of Object.entries({ NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", NUKMIRIS_MODE: "booking",
      NUKMIRIS_ROUTING_MODE: "receiving_number", NUKMIRIS_ENABLE_MANAGEMENT: "true", NUKMIRIS_ENABLE_RELIABILITY: "true",
      NUKMIRIS_REMINDERS_MODE: "live", NUKMIRIS_REMINDER_POLL_MS: "1000", NUKMIRIS_DB_PATH: path.join(directory, "synthetic.sqlite"),
      NUKMIRIS_BACKUP_DIR: path.join(directory, "backups"), GOOGLE_BOOKING_TOKEN_PATH: token,
      GOOGLE_OAUTH_TOKEN_PATH: path.join(directory, "unused-read-token.json"),
      WHATSAPP_TOKEN: "synthetic", WHATSAPP_PHONE_NUMBER_ID: "unused-synthetic", WHATSAPP_VERIFY_TOKEN: "synthetic-verify",
      META_APP_SECRET: secret, WHATSAPP_API_VERSION: "v26.0",
    })) { originals.set(key, process.env[key]); process.env[key] = value; }
    mock.method(Date, "now", () => f.now());
    const google = require("googleapis").google;
    mock.method(google.auth, "fromJSON", () => ({ getAccessToken: async () => ({ token: "synthetic" }), getTokenInfo: async () => ({ scopes: BOOKING_SCOPES }) }));
    mock.method(google, "calendar", () => ({ ...f.api,
      calendarList: { get: async ({ calendarId }) => ({ data: { id: calendarId, accessRole: "writer" } }) },
    }));
    mock.method(require("node:https"), "request", () => { throw new Error("Live external requests forbidden"); });
    mock.method(require("@google-cloud/local-auth"), "authenticate", () => { throw new Error("Live OAuth forbidden"); });
    mock.method(globalThis, "fetch", async (url, options) => {
      if (String(url).includes("/message_templates?")) {
        assert.match(String(url), /^https:\/\/graph\.facebook\.com\/v26\.0\/(123456|654321)\/message_templates\?/);
        return new Response(JSON.stringify({ data: templateDefinitions().map(item => ({ ...item, status: "APPROVED" })) }));
      }
      assert.match(String(url), /^https:\/\/graph\.facebook\.com\/v26\.0\/phone-synthetic-[ab]\/messages$/);
      const item = { payload: JSON.parse(options.body), metaId: `synthetic-http-${outgoing.length}`, url: String(url) };
      outgoing.push(item);
      return new Response(JSON.stringify({ messages: [{ id: item.metaId }] }));
    });
    mock.method(console, "log", () => {}); mock.method(console, "error", () => {});
    runtime = require("../whatsapp-webhook.js"); server = await runtime.start();
    if (!server.listening) await once(server, "listening");
    origin = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(() => {
    f.setNow("2026-10-26T09:00:00-06:00");
    f.db.exec(`DELETE FROM reminder_attempts; DELETE FROM reminder_jobs; DELETE FROM attendance_operations;
      DELETE FROM appointment_attendance; DELETE FROM calendar_booking_locks; DELETE FROM appointment_changes;
      DELETE FROM booking_requests; DELETE FROM message_outbox; DELETE FROM message_inbox;
      DELETE FROM business_support_messages; DELETE FROM business_support_conversations; DELETE FROM business_customer_sessions;`);
    f.events.clear(); f.patches.length = 0; f.inserts.length = 0; outgoing.length = 0;
  });
  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (runtime) await runtime.close();
    f?.db.close(); mock.restoreAll();
    for (const [key, value] of originals) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test("new WhatsApp booking still commits immediately and includes only the applicable reminder sentence", async () => {
    await post("cita");
    const first = outgoing.at(-1).payload.interactive.action.buttons;
    await post(first.find(button => button.reply.title === "Más opciones").reply.id, { type: "interactive" });
    const later = outgoing.at(-1).payload.interactive.action.buttons;
    await post(later[0].reply.id, { type: "interactive" });
    assert.equal(f.inserts.length, 1);
    assert.match(outgoing.at(-1).payload.text.body, /¡Tu cita está agendada!/);
    assert.match(outgoing.at(-1).payload.text.body, /Te enviaremos recordatorios antes de tu cita\./);
    assert(!outgoing.at(-1).payload.text.body.includes("menu"));
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM appointment_attendance").get().n, 1);
  });

  test("real template-button webhook replies are persisted, scoped and idempotent", async () => {
    const source = await f.book(), command = await sendRequest(source);
    const id = await post(command, { type: "button" });
    assert.match(outgoing.at(-1).payload.text.body, /está confirmada/);
    const count = outgoing.length;
    await post(command, { type: "button", id });
    assert.equal(outgoing.length, count);
    await post(command, { type: "button" });
    assert.equal(f.patches.length, 1);
    assert.equal(f.row(source.requestId).attendance, "CONFIRMED");
  });

  test("signed Meta delivery statuses update the matching reminder without crossing businesses", async () => {
    const source = await f.book(); await sendRequest(source);
    const job = f.jobs(source.requestId).find(job => job.kind === "confirmation");
    const status = { id: job.meta_message_id, status: "delivered", recipient_id: "523312345678", biz_opaque_callback_data: `nukmiris-reminder:${job.job_id}` };
    const body = business => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: `phone-${business}` }, statuses: [status] } }] }] });
    await submit(body("synthetic-b"));
    assert.equal(f.jobs(source.requestId).find(job => job.kind === "confirmation").meta_status, null);
    await submit(body("synthetic-a"));
    assert.equal(f.jobs(source.requestId).find(job => job.kind === "confirmation").meta_status, "delivered");
    const denied = await nativeFetch(origin + "/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body("synthetic-a")) });
    assert.equal(denied.status, 403);
  });

  test("a reminder from another business cannot be confirmed on this receiving number", async () => {
    const source = await f.book(), command = await sendRequest(source);
    await post(command, { type: "button", business: "synthetic-b" });
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
    assert.equal(f.patches.length, 0);
    assert.equal(f.row(source.requestId).attendance, "PENDING");
  });

  test("reminder rescheduling reuses the exact appointment's availability flow even with multiple bookings", async () => {
    const source = await f.book(); await f.book({ start: "2026-11-05T18:00:00-06:00" });
    const command = (await sendRequest(source)).replace(/:confirm$/, ":reschedule");
    await post(command, { type: "button" });
    const session = JSON.parse(f.db.prepare("SELECT session_json FROM business_customer_sessions WHERE business_id=? AND whatsapp_id=?")
      .get("synthetic-a", f.sender).session_json);
    assert.equal(session.mode, "reschedule_browse"); assert.equal(session.bookingRequestId, source.requestId);
    assert.match(outgoing.at(-1).payload.interactive.body.text, /Vamos a buscar otro horario/);
    assert.equal(f.patches.length, 0);
    const choices = outgoing.at(-1).payload.interactive.action.buttons;
    await post(choices[0].reply.id, { type: "interactive" });
    assert.match(outgoing.at(-1).payload.text.body, /¡Tu cita está reagendada!/);
    assert.equal(f.row(source.requestId).schedule_version, 2);
    await post(command.replace(/:reschedule$/, ":confirm"), { type: "button" });
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
  });

  test("human chat keeps priority and global menu still enables later use of the reminder button", async () => {
    const source = await f.book(), command = await sendRequest(source);
    f.db.prepare(`INSERT INTO business_support_conversations
      (business_id,whatsapp_id,customer_id,status,created_at,updated_at) VALUES (?, ?, ?, 'waiting','fixture','fixture')`)
      .run("synthetic-a", f.sender, f.row(source.requestId).customer_id);
    await post("Sí");
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM business_support_messages").get().n, 1);
    assert.equal(f.patches.length, 0);
    await post(command, { type: "button" });
    assert.match(outgoing.at(-1).payload.text.body, /atención personal/);
    await post("MENU");
    assert.equal(f.db.prepare("SELECT status FROM business_support_conversations").get().status, "closed");
    await post(command, { type: "button" });
    assert.equal(f.row(source.requestId).attendance, "CONFIRMED");
  });
});
