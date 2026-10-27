"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHmac, randomUUID } = require("node:crypto");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { once } = require("node:events");
const { reminderFixture } = require("./helpers/reminder-fixture.cjs");
const { prepareReliabilitySchema } = require("../lib/reliable-delivery");
const { applyReminderLiveTest } = require("../lib/reminder-live-test");
const { templateDefinitions } = require("../lib/reminder-templates");
const { BOOKING_SCOPES } = require("../lib/google-calendar");
const nativeFetch = globalThis.fetch;

test("controlled runtime sends four approved templates only for its selected booking and handles signed receipts/buttons", { timeout: 20000 }, async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-live-http-"));
  const f = reminderFixture({ filename: path.join(directory, "synthetic.sqlite") });
  const originals = new Map(), outgoing = [], templateChecks = [], secret = "synthetic-live-test-secret";
  let runtime, server, origin;
  t.after(async () => {
    try {
      if (runtime) await runtime.close();
      if (server) await new Promise(resolve => server.close(resolve));
    } finally {
      if (f.db.isOpen) f.db.close();
      t.mock.restoreAll();
      for (const [key, value] of originals) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
  prepareReliabilitySchema(f.db);
  const source = await f.book();
  const others = [
    await f.book({ start: "2026-11-05T17:00:00-06:00" }),
    await f.book({ start: "2026-11-05T18:00:00-06:00", sender: f.other }),
    await f.book({ businessId: "synthetic-b" }),
  ];
  const plan = applyReminderLiveTest(f.db, { businessId: source.businessId, sender: source.sender, bookingRequestId: source.requestId }, f.sender, f.now());
  for (const other of others) f.db.prepare("UPDATE reminder_jobs SET due_at=?,expires_at=? WHERE booking_request_id=?")
    .run(f.now() - 60000, f.now() - 1, other.requestId);
  const beforeOthers = others.map(other => ({ row: f.row(other.requestId), jobs: f.jobs(other.requestId) }));
  const settings = f.db.prepare("SELECT * FROM reminder_business_settings ORDER BY business_id").all();
  const key = `calendar-${source.businessId}:${source.eventId}`, eventBefore = structuredClone(f.events.get(key));
  const token = path.join(directory, "synthetic-booking-token.json");
  fs.writeFileSync(token, JSON.stringify({ type: "authorized_user", client_id: "synthetic", client_secret: "synthetic", refresh_token: "synthetic" }));
  for (const [name, value] of Object.entries({ NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", NUKMIRIS_MODE: "booking",
    NUKMIRIS_ROUTING_MODE: "receiving_number", NUKMIRIS_ENABLE_MANAGEMENT: "true", NUKMIRIS_ENABLE_RELIABILITY: "true",
    NUKMIRIS_REMINDERS_MODE: "live", NUKMIRIS_REMINDER_POLL_MS: "1000", NUKMIRIS_DB_PATH: path.join(directory, "synthetic.sqlite"),
    NUKMIRIS_REMINDER_TEST_BUSINESS_ID: source.businessId, NUKMIRIS_REMINDER_TEST_RECIPIENT: source.sender,
    NUKMIRIS_REMINDER_TEST_BOOKING_ID: source.requestId, NUKMIRIS_BACKUP_DIR: path.join(directory, "backups"),
    GOOGLE_BOOKING_TOKEN_PATH: token, GOOGLE_OAUTH_TOKEN_PATH: path.join(directory, "unused.json"),
    WHATSAPP_TOKEN: "synthetic", WHATSAPP_PHONE_NUMBER_ID: "unused", WHATSAPP_VERIFY_TOKEN: "synthetic-verify",
    META_APP_SECRET: secret, WHATSAPP_API_VERSION: "v26.0",
  })) { originals.set(name, process.env[name]); process.env[name] = value; }

  t.mock.method(Date, "now", () => f.now());
  const google = require("googleapis").google;
  t.mock.method(google.auth, "fromJSON", () => ({ getAccessToken: async () => ({ token: "synthetic" }), getTokenInfo: async () => ({ scopes: BOOKING_SCOPES }) }));
  t.mock.method(google, "calendar", () => ({ ...f.api,
    calendarList: { get: async ({ calendarId }) => ({ data: { id: calendarId, accessRole: "writer" } }) },
  }));
  t.mock.method(require("node:https"), "request", () => { throw new Error("External network forbidden"); });
  t.mock.method(require("@google-cloud/local-auth"), "authenticate", () => { throw new Error("Live OAuth forbidden"); });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.match(String(url), /^https:\/\/graph\.facebook\.com\/v26\.0\//);
    if (String(url).includes("/phone_numbers?")) {
      assert.match(String(url), /\/123456\/phone_numbers\?/);
      return new Response(JSON.stringify({ data: [{ id: "phone-synthetic-a" }] }));
    }
    if (String(url).includes("/message_templates?")) {
      assert.match(String(url), /\/123456\/message_templates\?/);
      templateChecks.push(String(url));
      return new Response(JSON.stringify({ data: templateDefinitions().map(item => ({ ...item, status: "APPROVED", quality_score: { score: "UNKNOWN" } })) }));
    }
    assert.match(String(url), /\/phone-synthetic-a\/messages$/);
    const payload = JSON.parse(options.body);
    assert.equal(payload.to, "523312345678");
    const item = { payload, metaId: `synthetic-live-http-${outgoing.length}` };
    outgoing.push(item);
    return new Response(JSON.stringify({ messages: [{ id: item.metaId }] }));
  });
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});

  async function waitFor(predicate) {
    const deadline = performance.now() + 6000;
    while (!predicate()) {
      if (performance.now() > deadline) throw new Error("Synthetic scoped runtime timeout");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  async function submit(value) {
    const raw = JSON.stringify({ entry: [{ changes: [{ value }] }] });
    const signature = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    const response = await nativeFetch(origin + "/webhook", { method: "POST", body: raw,
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature } });
    assert.equal(response.status, 200);
  }
  async function receipt(job, status, { business = source.businessId, recipient = "523312345678" } = {}) {
    await submit({ metadata: { phone_number_id: `phone-${business}` }, statuses: [{ id: job.meta_message_id, status,
      recipient_id: recipient, biz_opaque_callback_data: `nukmiris-reminder:${job.job_id}` }] });
  }
  async function button(command, id = randomUUID()) {
    await submit({ metadata: { phone_number_id: "phone-synthetic-a" }, messages: [{ id, from: source.sender,
      timestamp: String(Math.floor(f.now() / 1000)), type: "button", button: { payload: command, text: "Ignored display label" } }] });
    await waitFor(() => f.db.prepare("SELECT state FROM message_inbox WHERE message_id=?").get(id)?.state === "completed");
    await waitFor(() => f.db.prepare("SELECT COUNT(*) AS n FROM message_outbox WHERE state IN ('pending','sending')").get().n === 0);
    return id;
  }

  runtime = require("../whatsapp-webhook"); server = await runtime.start();
  if (!server.listening) await once(server, "listening");
  origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal(templateChecks.length, 4, "readiness checks only the selected business's four approved assets");
  for (const [index, planned] of plan.jobs.entries()) {
    f.setNow(planned.dueAt);
    await waitFor(() => f.jobs(source.requestId).find(job => job.job_id === planned.jobId).state === "accepted");
    const job = f.jobs(source.requestId).find(item => item.job_id === planned.jobId);
    assert.equal(job.meta_status, null, "API acceptance alone is not device delivery");
    assert.equal(job.attempts, 1);
    assert.equal(outgoing.filter(item => item.payload.type === "template").length, index + 1);
    if (planned.kind === "confirmation") {
      await receipt(job, "delivered", { business: "synthetic-b" });
      await receipt(job, "delivered", { recipient: "523399999999" });
      assert.equal(f.jobs(source.requestId).find(item => item.job_id === job.job_id).meta_status, null);
    }
    await receipt(job, "delivered");
    await receipt(job, "read");
    await receipt(job, "sent");
    assert.equal(f.jobs(source.requestId).find(item => item.job_id === job.job_id).meta_status, "read");
  }
  assert.deepEqual(outgoing.filter(item => item.payload.type === "template").map(item => item.payload.template.name),
    ["nukmiris_seven_day_v1", "nukmiris_confirmation_v1", "nukmiris_followup_v1", "nukmiris_final_v1"]);
  assert.equal(templateChecks.length, 8, "startup and every actual template send recheck approved assets");
  const confirmation = outgoing.find(item => item.payload.template?.name === "nukmiris_confirmation_v1");
  assert.equal(confirmation.payload.template.language.code, "es_MX");
  assert.deepEqual(confirmation.payload.template.components.filter(component => component.type === "button").map(component => component.index), ["0", "1"]);

  await button(`reminder:${f.row(others[0].requestId).action_token}:confirm`);
  assert.equal(f.patches.length, 0, "another booking cannot be confirmed through the restricted runtime");
  const command = confirmation.payload.template.components.find(component => component.type === "button" && component.index === "0").parameters[0].payload;
  const id = await button(command);
  assert.equal(f.patches.length, 1);
  const count = outgoing.length;
  await button(command, id);
  assert.equal(outgoing.length, count, "duplicate provider input creates no duplicate acknowledgment");
  await button(command);
  assert.equal(f.patches.length, 1, "repeating a real template button never repeats the Calendar patch");
  assert.equal(f.row(source.requestId).attendance, "CONFIRMED");
  const updated = f.events.get(key);
  assert.equal(updated.summary, eventBefore.summary + " — Confirmada");
  for (const field of ["id", "description", "start", "end"]) assert.deepEqual(updated[field], eventBefore[field]);
  assert.deepEqual(others.map(other => ({ row: f.row(other.requestId), jobs: f.jobs(other.requestId) })), beforeOthers);
  assert.deepEqual(f.db.prepare("SELECT * FROM reminder_business_settings ORDER BY business_id").all(), settings);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM reminder_attempts").get().n, 4);
});
