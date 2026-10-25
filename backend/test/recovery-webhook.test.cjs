"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { fork } = require("node:child_process");
const { createHmac, randomUUID } = require("node:crypto");
const { createDatabase } = require("./helpers/database.cjs");
const { prepareBookingSchema } = require("../lib/booking");
const { prepareManagementSchema } = require("../lib/appointment-management");
const { prepareReliabilitySchema } = require("../lib/reliable-delivery");
const secret = "synthetic-recovery-signature";
async function waitFor(condition, label = "recovery condition") {
  const deadline = performance.now() + 15000;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, 15));
  }
}
async function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-process-recovery-"));
  const filename = path.join(directory, "synthetic.sqlite"), db = createDatabase(filename);
  prepareBookingSchema(db); prepareManagementSchema(db); prepareReliabilitySchema(db);
  for (const business of ["synthetic-a", "synthetic-b"]) db.prepare("INSERT INTO business_customers VALUES (?,?,?,?,?,?)")
    .run(`customer-${business}`, business, "synthetic-customer", "Cliente Sintético", "fixture", "fixture");
  const calendar = path.join(directory, "synthetic-calendar.json"), sent = path.join(directory, "synthetic-meta.jsonl"), calls = path.join(directory, "synthetic-calendar-calls.jsonl"), paused = path.join(directory, "synthetic-paused.json");
  fs.writeFileSync(calendar, "{}"); fs.writeFileSync(sent, ""); fs.writeFileSync(calls, "");
  const token = path.join(directory, "synthetic-booking-token.json");
  fs.writeFileSync(token, JSON.stringify({ type: "authorized_user", client_id: "synthetic", client_secret: "synthetic", refresh_token: "synthetic" }));
  let child, origin, stderr = "";
  const readLines = file => fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  async function start() {
    if (fs.existsSync(paused)) fs.unlinkSync(paused);
    stderr = "";
    child = fork(path.resolve(__dirname, "helpers/recovery-runtime.cjs"), [], { silent: true, env: {
      ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", NUKMIRIS_DB_PATH: filename,
      NUKMIRIS_MODE: "booking", NUKMIRIS_ROUTING_MODE: "receiving_number", NUKMIRIS_ENABLE_MANAGEMENT: "true",
      NUKMIRIS_ENABLE_RELIABILITY: "true", NUKMIRIS_BACKUP_DIR: path.join(directory, "backups"), NUKMIRIS_BACKUP_INTERVAL_HOURS: "24", NUKMIRIS_BACKUP_KEEP: "7",
      GOOGLE_BOOKING_TOKEN_PATH: token, GOOGLE_OAUTH_TOKEN_PATH: path.join(directory, "unused-token.json"),
      WHATSAPP_TOKEN: "synthetic", WHATSAPP_PHONE_NUMBER_ID: "synthetic-unused", WHATSAPP_VERIFY_TOKEN: "synthetic",
      META_APP_SECRET: secret, WHATSAPP_API_VERSION: "v26.0", SYNTHETIC_RECOVERY_DIRECTORY: directory,
    } });
    child.stdout.on("data", () => {}); child.stderr.on("data", value => { stderr += value; });
    let ready;
    child.on("message", message => { if (message.ready) ready = message; });
    await waitFor(() => ready || child.exitCode !== null, "fixture startup");
    assert(ready, stderr); origin = `http://127.0.0.1:${ready.port}`;
  }
  async function kill() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise(resolve => child.once("exit", resolve)); child.kill("SIGKILL"); await exited;
  }
  async function phase(value) {
    let acknowledged = false;
    const listener = message => { if (message.configured === value) acknowledged = true; };
    child.on("message", listener); child.send({ phase: value });
    await waitFor(() => acknowledged, "fixture phase"); child.off("message", listener);
  }
  function incoming(body, { id = randomUUID(), sender = "synthetic-customer", kind = "text", business = "a" } = {}) {
    const message = { id, from: sender, type: kind === "text" ? "text" : "interactive",
      ...(kind === "text" ? { text: { body } } : { interactive: { type: kind, [kind]: { id: body } } }) };
    return { entry: [{ changes: [{ value: { metadata: { phone_number_id: `phone-synthetic-${business}` }, messages: [message] } }] }] };
  }
  async function postPayload(body, signed = true) {
    const payload = JSON.stringify(body);
    const response = await fetch(`${origin}/webhook`, { method: "POST", body: payload, headers: { "Content-Type": "application/json",
      ...(signed ? { "X-Hub-Signature-256": "sha256=" + createHmac("sha256", secret).update(payload).digest("hex") } : {}) } });
    await response.arrayBuffer(); return response.status;
  }
  async function post(body, options = {}) {
    const count = readLines(sent).length;
    assert.equal(await postPayload(incoming(body, options)), 200);
    await waitFor(() => readLines(sent).length > count, `reply (${stderr})`);
    await waitFor(() => db.prepare("SELECT COUNT(*) AS n FROM message_outbox WHERE state IN ('pending','sending')").get().n === 0, "reply completion");
    return readLines(sent).at(-1).payload;
  }
  const buttons = payload => payload.interactive.action.buttons.map(item => item.reply);
  async function book() {
    const offered = await post("Cita");
    return post(buttons(offered)[0].id, { kind: "button_reply" });
  }
  await start();
  return { db, directory, filename, incoming, postPayload, post, phase, start, kill, book, buttons,
    messages: () => readLines(sent), calls: () => readLines(calls), events: () => JSON.parse(fs.readFileSync(calendar, "utf8")),
    paused: () => fs.existsSync(paused), async cleanup() { await kill(); db.close(); fs.rmSync(directory, { recursive: true, force: true }); } };
}
test("real process recovery: an acknowledged request survives a crash before handling and is deduplicated", async () => {
  const f = await fixture();
  try {
    await f.phase("before_handle"); const body = f.incoming("Menu");
    assert.equal(await f.postPayload(body), 200); await waitFor(f.paused);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM message_inbox").get().n, 1);
    await f.kill(); await f.start();
    await waitFor(() => f.messages().length === 1);
    assert.equal(await f.postPayload(body), 200);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM message_inbox").get().n, 1);
    assert.equal(f.messages().length, 1);
  } finally { await f.cleanup(); }
});
test("real process recovery restores a partially advanced browsing session before replay", async () => {
  const f = await fixture();
  try {
    const first = await f.post("Cita"), more = f.buttons(first)[2].id;
    await f.phase("after_local_state");
    const request = f.postPayload(f.incoming(more, { kind: "button_reply" })).catch(() => {});
    await waitFor(f.paused); await f.kill(); await request; await f.start();
    await waitFor(() => f.messages().length === 2);
    assert.equal(f.buttons(f.messages().at(-1).payload)[2].title, "Elegir fecha");
    assert.equal(f.messages().at(-1).payload.interactive.body.text, "Te muestro mas opciones. Elige un horario que te funciona mejor:");
  } finally { await f.cleanup(); }
});
test("natural date retry and slot selection survive restart without adding a confirmation or a second event", async () => {
  const f = await fixture();
  try {
    await f.post("Cita");
    const original = f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json;
    const invalid = await f.post("31 febrero");
    assert.match(invalid.text.body, /No pude identificar bien la fecha/);
    assert.equal(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json, original);
    await f.kill(); await f.start();
    const times = await f.post("puede ser mañana");
    assert.match(times.interactive.body.text, /martes 27 de octubre 2026/);
    assert.equal(f.calls().filter(call => call.method === "insert").length, 0);
    const selected = f.buttons(times)[0].id;
    await f.kill(); await f.start();
    const result = await f.post(selected, { kind: "button_reply" });
    assert.match(result.text.body, /está agendada/);
    assert.equal(f.calls().filter(call => call.method === "insert").length, 1);
  } finally { await f.cleanup(); }
});
test("natural intent clarification survives restart and choosing BOOK only opens the existing workflow", async () => {
  const f = await fixture();
  try {
    const offer = await f.post("Necesito información");
    assert.equal(offer.interactive.body.text, "No entendí qué necesitas. ¿En qué puedo ayudarte?");
    const book = f.buttons(offer).find(button => button.title === "Agendar una cita");
    await f.kill(); await f.start();
    const slots = await f.post(book.id, { kind: "button_reply" });
    assert.equal(slots.interactive.body.text, "Elige un horario que te funciona mejor:");
    assert.equal(f.calls().filter(call => call.method === "insert").length, 0);
    const result = await f.post(f.buttons(slots)[0].id, { kind: "button_reply" });
    assert.match(result.text.body, /está agendada/);
    assert.equal(f.calls().filter(call => call.method === "insert").length, 1);
  } finally { await f.cleanup(); }
});
test("contextual reschedule clarification survives restart and incoming Spanish text is preserved", async () => {
  const f = await fixture();
  try {
    await f.book();
    const offer = await f.post("¡Ya no podré asistir!");
    assert.equal(offer.interactive.body.text, "¿Quieres reagendar o cancelar tu cita?");
    const reschedule = f.buttons(offer)[0].id;
    const saved = f.db.prepare("SELECT message_json FROM message_inbox ORDER BY inbox_id DESC LIMIT 1").get();
    assert.equal(JSON.parse(saved.message_json).text.body, "¡Ya no podré asistir!");
    await f.kill(); await f.start();
    const slots = await f.post(reschedule, { kind: "button_reply" });
    assert.equal(slots.interactive.body.text, "Elige un horario que te funciona mejor:");
    assert.equal(f.calls().filter(call => call.method === "patch").length, 0);
    const result = await f.post(f.buttons(slots)[0].id, { kind: "button_reply" });
    assert.match(result.text.body, /está reagendada/);
    assert.equal(f.calls().filter(call => call.method === "insert").length, 1);
    assert.equal(f.calls().filter(call => call.method === "patch").length, 1);
  } finally { await f.cleanup(); }
});
test("Menu booking choices survive a restart before selection and send only the successful result", async () => {
  const f = await fixture();
  try {
    const menu = await f.post("Menu");
    const book = f.buttons(menu).find(button => button.id.endsWith(":book"));
    const offer = await f.post(book.id, { kind: "button_reply" });
    const body = f.incoming(f.buttons(offer)[0].id, { kind: "button_reply" });
    await f.kill(); await f.start();
    assert.equal(await f.postPayload(body), 200);
    await waitFor(() => f.messages().length === 3);
    await waitFor(() => f.db.prepare("SELECT COUNT(*) AS n FROM message_outbox WHERE state IN ('pending','sending')").get().n === 0);
    assert.match(f.messages().at(-1).payload.text.body, /está agendada/);
    assert.equal(f.db.prepare("SELECT state FROM booking_requests").get().state, "confirmed");
    assert.equal(f.calls().filter(call => call.method === "insert").length, 1);
    // Meta redelivery retains the same incoming ID; it must not generate a
    // stale-option reply after the successful result, even across restarts.
    await f.kill(); await f.start();
    assert.equal(await f.postPayload(body), 200);
    await new Promise(resolve => setTimeout(resolve, 1100));
    assert.equal(f.messages().length, 3);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM message_inbox").get().n, 3);
    assert.equal(f.calls().filter(call => call.method === "insert").length, 1);
  } finally { await f.cleanup(); }
});
test("a later stale main-menu action is recorded separately from the successful booking", async () => {
  const f = await fixture();
  try {
    const book = f.buttons(await f.post("Menu")).find(button => button.id.endsWith(":book"));
    const offer = await f.post(book.id, { kind: "button_reply" });
    await f.kill(); await f.start();
    assert.match((await f.post(f.buttons(offer)[0].id, { kind: "button_reply" })).text.body, /está agendada/);
    const expired = await f.post(book.id, { kind: "button_reply" });
    assert.equal(expired.text.body, "Esta opción ya no está vigente. Escribe Cita para consultar horarios.");
    assert.equal(f.calls().filter(call => call.method === "insert").length, 1);
    const records = f.db.prepare(`SELECT i.inbox_id,i.message_json,o.payload_json FROM message_inbox i
      JOIN message_outbox o USING(inbox_id) ORDER BY i.inbox_id`).all();
    assert.equal(records.length, 4);
    assert.match(JSON.parse(records[2].message_json).interactive.button_reply.id, /^availability:/);
    assert.match(JSON.parse(records[3].message_json).interactive.button_reply.id, /^menu:/);
    assert.notEqual(records[2].inbox_id, records[3].inbox_id);
  } finally { await f.cleanup(); }
});
for (const operation of ["insert", "patch", "delete"]) test(`real process recovery after Calendar ${operation} does not repeat its mutation`, async () => {
  const f = await fixture();
  try {
    let selected;
    if (operation === "insert") selected = f.buttons(await f.post("Cita"))[0].id;
    else { await f.book(); selected = f.buttons(await f.post(operation === "patch" ? "Reagendar" : "Cancelar"))[0].id; }
    const before = f.messages().length;
    await f.phase(`after_calendar_${operation}`);
    const body = f.incoming(selected, { kind: "button_reply" });
    const request = f.postPayload(body).catch(() => {});
    await waitFor(f.paused); await f.kill(); await request; await f.start();
    await waitFor(() => f.messages().length > before);
    const success = f.messages().at(-1).payload.text.body;
    assert.match(success, operation === "insert" ? /está agendada/ : operation === "patch" ? /está reagendada/ : /está cancelada/);
    assert.equal(f.calls().filter(call => call.method === operation).length, 1);
    assert.equal(await f.postPayload(body), 200);
    assert.equal(f.calls().filter(call => call.method === operation).length, 1);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 0);
  } finally { await f.cleanup(); }
});
test("real process recovery links a new customer's name message to its booking request", async () => {
  const f = await fixture();
  try {
    const sender = "synthetic-new", offer = await f.post("Cita", { sender });
    assert.match((await f.post(f.buttons(offer)[0].id, { sender, kind: "button_reply" })).text.body, /nombre completo/);
    await f.phase("after_calendar_insert"); const count = f.messages().length;
    const request = f.postPayload(f.incoming("Cliente Nuevo", { sender })).catch(() => {});
    await waitFor(f.paused); await f.kill(); await request; await f.start();
    await waitFor(() => f.messages().length > count);
    assert.match(f.messages().at(-1).payload.text.body, /está agendada/);
    assert.equal(f.calls().filter(call => call.method === "insert").length, 1);
  } finally { await f.cleanup(); }
});
test("real process recovery delivers a stored reply without rerunning the Calendar operation", async () => {
  const f = await fixture();
  try {
    const selected = f.buttons(await f.post("Cita"))[0].id, count = f.messages().length;
    await f.phase("after_outbox_commit");
    const request = f.postPayload(f.incoming(selected, { kind: "button_reply" })).catch(() => {});
    await waitFor(f.paused); await f.kill(); await request;
    assert.equal(f.db.prepare("SELECT state FROM booking_requests").get().state, "confirmed");
    await f.start(); await waitFor(() => f.messages().length > count);
    assert.match(f.messages().at(-1).payload.text.body, /está agendada/);
    assert.equal(f.calls().filter(call => call.method === "insert").length, 1);
  } finally { await f.cleanup(); }
});
test("Meta status after a lost send response resolves uncertainty without sending a duplicate reply", async () => {
  const f = await fixture();
  try {
    await f.phase("after_meta_accept");
    const request = f.postPayload(f.incoming("Menu")).catch(() => {});
    await waitFor(f.paused); await f.kill(); await request; await f.start();
    assert.equal(f.messages().length, 1);
    assert.equal(f.db.prepare("SELECT state FROM message_outbox").get().state, "uncertain");
    const payload = f.messages()[0].payload;
    const status = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "phone-synthetic-a" }, statuses: [{
      id: "synthetic-meta-1", status: "delivered", recipient_id: "synthetic-customer", biz_opaque_callback_data: payload.biz_opaque_callback_data,
    }] } }] }] };
    assert.equal(await f.postPayload(status, false), 403);
    assert.equal(f.db.prepare("SELECT state FROM message_outbox").get().state, "uncertain");
    assert.equal(await f.postPayload(status), 200);
    assert.equal(f.db.prepare("SELECT state FROM message_outbox").get().state, "accepted");
    assert.equal(f.messages().length, 1);
  } finally { await f.cleanup(); }
});
test("unsigned ingress is rejected and database failures receive 503 so Meta can retry", async () => {
  const f = await fixture();
  try {
    const body = f.incoming("Menu"); assert.equal(await f.postPayload(body, false), 403);
    f.db.exec("CREATE TRIGGER synthetic_disk_failure BEFORE INSERT ON message_inbox BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END");
    assert.equal(await f.postPayload(body), 503);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM message_inbox").get().n, 0);
    f.db.exec("DROP TRIGGER synthetic_disk_failure");
    assert.equal(await f.postPayload(body), 200); await waitFor(() => f.messages().length === 1);
  } finally { await f.cleanup(); }
});
