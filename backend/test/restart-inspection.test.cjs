"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { spawnSync } = require("node:child_process");
const { createDatabase } = require("./helpers/database.cjs");
const { prepareBookingSchema } = require("../lib/booking");
const { prepareReliabilitySchema } = require("../lib/reliable-delivery");
const { inspectRestart } = require("../scripts/inspect-restart.cjs");

test("restart inspection links success and stale replies to separate inputs without exposing private data or writing", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-inspect-"));
  const filename = path.join(directory, "synthetic.sqlite"), db = createDatabase(filename);
  const sender = "5215512345678", secretName = "Synthetic Private Name", requestId = "synthetic-booking-private";
  const time = Date.parse("2026-10-26T15:00:00Z");
  try {
    prepareBookingSchema(db); prepareReliabilitySchema(db);
    db.prepare("INSERT INTO business_customers VALUES (?,?,?,?,?,?)").run("private-customer", "synthetic-a", sender, secretName, "fixture", "fixture");
    db.prepare(`INSERT INTO booking_requests VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(requestId, "synthetic-a", sender,
      "private-customer", secretName, "private-calendar-id", "2026-10-27T10:00:00-06:00", "2026-10-27T11:00:00-06:00",
      time, time + 3600000, "private-event-id", "confirmed", time + 900000, new Date(time).toISOString(), new Date(time).toISOString());
    const button = "availability:private-offer:slot:0";
    const snapshot = JSON.stringify({ session: { session_json: JSON.stringify({ mode: "booking_result", selectionCommand: button, expiresAt: time + 900000 }) } });
    function input(business, id, command, response, continuation = null) {
      db.prepare(`INSERT INTO message_inbox (business_id,message_id,sender,phone_number_id,message_json,content_hash,capabilities,state,
        received_at,customer_time,attempts,snapshot_json,continuation_json) VALUES (?,?,?,?,?,?,?,'completed',?,?,1,?,?)`)
        .run(business, `private-message-${id}`, sender, "private-phone-id", JSON.stringify({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: command } } }),
          "private-hash", "private-settings", time + id * 1000, time, snapshot, continuation);
      const inbox = db.prepare("SELECT last_insert_rowid() AS id").get().id;
      db.prepare(`INSERT INTO message_outbox (outbox_id,inbox_id,ordinal,payload_json,state,expires_at,meta_message_id,meta_status)
        VALUES (?,?,0,?,'accepted',?,?,'delivered')`).run(`private-outbox-${id}`, inbox,
          JSON.stringify({ to: sender, text: { body: response } }), time + 3600000, "private-meta-id");
    }
    input("synthetic-a", 1, button, `${secretName}, tu cita está agendada.`, JSON.stringify({ kind: "booking", requestId }));
    input("synthetic-a", 2, "menu:private-menu:book", "Esta opción ya no está vigente. Escribe Cita para consultar horarios.");
    input("synthetic-b", 3, "menu:other-business:book", "Other business private reply");
    db.close();
    const before = fs.readFileSync(filename), reader = new DatabaseSync(filename, { readOnly: true });
    let report;
    try { report = inspectRestart({ db: reader, businessId: "synthetic-a" }); } finally { reader.close(); }
    assert.equal(report.messages.length, 2);
    assert.equal(report.messages[0].replies[0].kind, "booking_success");
    assert.equal(report.messages[1].replies[0].kind, "expired_main_menu");
    assert.equal(report.messages[0].operation.booking, report.bookings[0].booking);
    assert.equal(report.messages[0].customer, report.messages[1].customer);
    assert.equal(report.messages[0].priorSelectionMatches, true);
    assert.equal(report.messages[1].priorSelectionMatches, false);
    assert.equal(report.messages[1].priorOfferExpiredAtReceipt, false);
    assert.equal(report.bookings[0].state, "confirmed");
    const json = JSON.stringify(report);
    for (const value of [sender, secretName, requestId, "private-", "synthetic-b", "Other business private reply"]) assert(!json.includes(value), value);
    assert.deepEqual(fs.readFileSync(filename), before);
  } finally { if (db.isOpen) db.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
test("restart inspection reports missing reliability history without preparing tables", () => {
  const db = createDatabase();
  try {
    const before = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master").get().n;
    const report = inspectRestart({ db, businessId: "synthetic-a" });
    assert.equal(report.messageHistoryAvailable, false); assert.deepEqual(report.messages, []);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master").get().n, before);
  } finally { db.close(); }
});
test("standalone restart inspection loads only local backend settings and refuses a missing database", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-inspect-cli-"));
  try {
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ version: "0.4.0" }));
    fs.writeFileSync(path.join(directory, ".env"), "NUKMIRIS_DB_PATH=synthetic.sqlite\nNUKMIRIS_BUSINESS_ID=synthetic-a\nNUKMIRIS_ENABLE_RELIABILITY=true\nWHATSAPP_TOKEN=private-token-never-print\n");
    const database = createDatabase(path.join(directory, "synthetic.sqlite")); database.close();
    const env = { ...process.env, NODE_ENV: "test" };
    for (const key of ["NUKMIRIS_DB_PATH", "NUKMIRIS_BUSINESS_ID", "NUKMIRIS_ENABLE_RELIABILITY"]) delete env[key];
    const script = path.resolve(__dirname, "../scripts/inspect-restart.cjs");
    const run = spawnSync(process.execPath, [script], { cwd: directory, env, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(run.stdout);
    assert.equal(report.appVersion, "0.4.0"); assert.equal(report.reliabilityEnabledNow, true);
    assert(!run.stdout.includes("private-token"));
    const missing = spawnSync(process.execPath, [script], { cwd: directory,
      env: { ...env, NUKMIRIS_DB_PATH: "absent.sqlite" }, encoding: "utf8" });
    assert.equal(missing.status, 1); assert(!fs.existsSync(path.join(directory, "absent.sqlite")));
    assert(!missing.stderr.includes("private-token"));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
