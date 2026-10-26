"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { fork } = require("node:child_process");
const { randomUUID, createHmac } = require("node:crypto");
const { fixture: managementFixture } = require("./management-fixture.cjs");
const { prepareReliabilitySchema } = require("../../lib/reliable-delivery");
const { prepareReminderSchema } = require("../../lib/reminder-schedule");
const clock = Date.parse("2026-10-26T09:00:00-06:00"), secret = "synthetic-compatibility-signature";
async function waitFor(condition, label) {
  const deadline = performance.now() + 15000;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
async function compatibilityFixture(config) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-compatibility-"));
  const filename = path.join(directory, "synthetic.sqlite"), f = managementFixture(filename), db = f.db;
  prepareReliabilitySchema(db); prepareReminderSchema(db);
  for (const sender of ["synthetic-one", "synthetic-two", "synthetic-new"]) {
    db.prepare("INSERT INTO dev_test_business_routes VALUES (?, 'synthetic-a', 'synthetic only')").run(sender);
  }
  const file = name => path.join(directory, name);
  const lines = name => fs.readFileSync(file(name), "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  for (const name of ["calendar.json", "controls.json"]) fs.writeFileSync(file(name), "{}");
  for (const name of ["calls.jsonl", "sent.jsonl"]) fs.writeFileSync(file(name), "");
  const token = file("synthetic-token.json");
  fs.writeFileSync(token, JSON.stringify({ type: "authorized_user", client_id: "synthetic-compatibility", client_secret: "synthetic", refresh_token: "synthetic" }));
  const readToken = file("synthetic-read-token.json"); fs.copyFileSync(token, readToken);
  let child, origin, stderr = "", callOffset = 0;
  async function start() {
    stderr = "";
    child = fork(path.join(__dirname, "compatibility-runtime.cjs"), [], { silent: true, env: {
      ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", NUKMIRIS_DB_PATH: filename,
      NUKMIRIS_MODE: config.mode, NUKMIRIS_ROUTING_MODE: config.routing || "receiving_number",
      NUKMIRIS_ENABLE_RELIABILITY: String(config.reliable), NUKMIRIS_ENABLE_MANAGEMENT: String(config.management),
      NUKMIRIS_REMINDERS_MODE: config.reminders || "off", NUKMIRIS_REMINDER_POLL_MS: "30000",
      NUKMIRIS_BACKUP_DIR: file("backups"), NUKMIRIS_BACKUP_INTERVAL_HOURS: "24", NUKMIRIS_BACKUP_KEEP: "2",
      GOOGLE_BOOKING_TOKEN_PATH: token, GOOGLE_OAUTH_TOKEN_PATH: readToken,
      WHATSAPP_TOKEN: "synthetic", WHATSAPP_PHONE_NUMBER_ID: "synthetic-development-channel", WHATSAPP_VERIFY_TOKEN: "synthetic",
      META_APP_SECRET: secret, WHATSAPP_API_VERSION: "v26.0", SYNTHETIC_COMPATIBILITY_DIRECTORY: directory,
    } });
    child.stdout.resume(); child.stderr.on("data", value => { stderr += value; });
    child.completion = new Promise(resolve => child.once("close", resolve));
    let ready, spawnError;
    child.on("error", error => { spawnError = error; });
    child.on("message", message => { if (message.ready) ready = message; });
    await waitFor(() => ready || spawnError || child.exitCode !== null, "compatibility startup");
    assert(ready, `Fixture failed to start: ${spawnError || stderr}`);
    origin = `http://127.0.0.1:${ready.port}`;
  }
  async function stop() {
    if (!child) return;
    if (child.exitCode === null && child.signalCode === null && child.connected) child.send({ stop: true });
    const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }, 5000);
    try { await child.completion; } finally { clearTimeout(timer); }
  }
  async function barrier() {
    const id = randomUUID(); let done = false;
    const listener = message => { if (message.barrier === id) done = true; };
    child.on("message", listener); child.send({ barrier: id });
    try { await waitFor(() => done || child.exitCode !== null, "webhook completion"); assert(done, stderr); }
    finally { child.off("message", listener); }
    if (config.reliable) await waitFor(() => db.prepare(`SELECT
      (SELECT COUNT(*) FROM message_inbox WHERE state <> 'completed') +
      (SELECT COUNT(*) FROM message_outbox WHERE state IN ('pending','sending')) AS n`).get().n === 0, `durable completion: ${stderr}`);
  }
  function incoming(body, { sender = "synthetic-one", business = "a", kind = "text", id = randomUUID(), channel } = {}) {
    const message = { id, from: sender, type: kind === "text" ? "text" : "interactive",
      ...(kind === "text" ? { text: { body } } : { interactive: { type: kind, [kind]: { id: body } } }) };
    return { entry: [{ changes: [{ value: { metadata: { phone_number_id: channel || `phone-synthetic-${business}` }, messages: [message] } }] }] };
  }
  async function deliver(payload, { signed = true } = {}) {
    const body = JSON.stringify(payload), before = lines("sent.jsonl").length;
    const response = await fetch(`${origin}/webhook`, { method: "POST", body, headers: {
      "Content-Type": "application/json", ...(signed ? { "X-Hub-Signature-256": "sha256=" + createHmac("sha256", secret).update(body).digest("hex") } : {}),
    }, signal: AbortSignal.timeout(15000) });
    await response.arrayBuffer(); await barrier();
    return { status: response.status, replies: lines("sent.jsonl").slice(before).map(item => item.payload) };
  }
  async function post(body, options) {
    const result = await deliver(incoming(body, options)); assert.equal(result.status, 200);
    assert.equal(result.replies.length, 1, `Expected one reply to ${body}: ${stderr}`);
    return result.replies[0];
  }
  function saveSession(session, { business = "a", sender = "synthetic-one", expired = false } = {}) {
    const value = { expiresAt: clock + (expired ? -1 : 60000), ...session };
    db.prepare(`INSERT INTO business_customer_sessions VALUES (?,?,?,?) ON CONFLICT(business_id,whatsapp_id)
      DO UPDATE SET session_json=excluded.session_json,expires_at=excluded.expires_at`)
      .run(`synthetic-${business}`, sender, JSON.stringify(value), value.expiresAt);
  }
  async function seed(options) {
    f.events.clear(); for (const [key, value] of Object.entries(JSON.parse(fs.readFileSync(file("calendar.json"), "utf8")))) f.events.set(key, value);
    const result = await f.seed(options);
    fs.writeFileSync(file("calendar.json"), JSON.stringify(Object.fromEntries(f.events)));
    return result;
  }
  try { await start(); } catch (error) { await stop(); db.close(); fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); throw error; }
  return { ...f, config, clock, start, stop, seed, incoming, deliver, post, saveSession,
    async restart() { await stop(); await start(); },
    calls: () => lines("calls.jsonl").slice(callOffset), messages: () => lines("sent.jsonl"),
    events: () => JSON.parse(fs.readFileSync(file("calendar.json"), "utf8")),
    controls: value => fs.writeFileSync(file("controls.json"), JSON.stringify(value)),
    resetSessions() { db.exec("DELETE FROM business_support_messages; DELETE FROM business_support_conversations; DELETE FROM business_customer_sessions;"); },
    reset() {
      callOffset = lines("calls.jsonl").length;
      db.exec("DELETE FROM business_support_messages; DELETE FROM business_support_conversations; DELETE FROM business_customer_sessions; DELETE FROM calendar_booking_locks; DELETE FROM appointment_changes; DELETE FROM booking_requests; DELETE FROM business_customers WHERE whatsapp_id='synthetic-new';");
      fs.writeFileSync(file("calendar.json"), "{}"); fs.writeFileSync(file("controls.json"), "{}");
    },
    session(business = "a", sender = "synthetic-one") { const row = db.prepare("SELECT session_json FROM business_customer_sessions WHERE business_id=? AND whatsapp_id=?").get(`synthetic-${business}`, sender); return row && JSON.parse(row.session_json); },
    async cleanup() {
      await stop(); db.close();
      try { assert(!lines("calls.jsonl").some(call => call.method === "FORBIDDEN"), "No legacy OAuth, primary Calendar or real outbound integration may be invoked"); }
      finally { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
    },
  };
}
const buttons = payload => payload.interactive.action.buttons.map(button => button.reply);
const body = payload => payload.text?.body || payload.interactive?.body.text;
const writes = f => f.calls().filter(call => ["insert", "patch", "delete"].includes(call.method));
module.exports = { compatibilityFixture, buttons, body, writes };
