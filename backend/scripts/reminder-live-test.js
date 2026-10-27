"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { loadLocalEnv } = require("../lib/local-env");
const { createDatabaseBackup } = require("../lib/database-backups");
const { readReminderTestScope, assertBackendStopped, planReminderLiveTest, applyReminderLiveTest } = require("../lib/reminder-live-test");

async function main() {
  loadLocalEnv();
  const args = process.argv.slice(2);
  const allowed = new Set(["--business-id", "--whatsapp-id", "--booking-request-id", "--authorize-recipient", "--apply"]);
  const values = {};
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (!allowed.has(name) || Object.hasOwn(values, name)) throw new Error("Use --business-id, --whatsapp-id, --booking-request-id and optionally --apply --authorize-recipient");
    if (name === "--apply") values[name] = true;
    else {
      if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`A value is required for ${name}`);
      values[name] = args[++index];
    }
  }
  const scope = { businessId: values["--business-id"], sender: values["--whatsapp-id"], bookingRequestId: values["--booking-request-id"] };
  if (!scope.businessId || !scope.sender || !scope.bookingRequestId) throw new Error("Explicit --business-id, --whatsapp-id and --booking-request-id are required; no default recipient is used");
  const apply = values["--apply"] === true;
  if (!apply && values["--authorize-recipient"]) throw new Error("--authorize-recipient is used only with --apply; omit both for a read-only plan");
  if (apply) {
    const configured = readReminderTestScope();
    if (!configured || Object.keys(scope).some(key => configured[key] !== scope[key])) {
      throw new Error("Set all three NUKMIRIS_REMINDER_TEST_* values to this exact business/recipient/booking before applying; the runtime restriction is required");
    }
    if (values["--authorize-recipient"] !== scope.sender) throw new Error("--authorize-recipient must explicitly match the exact test WhatsApp sender ID");
  }
  const filename = path.resolve(__dirname, "..", process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
  if (!fs.existsSync(filename)) throw new Error("Existing prepared NukMiris database required; no database was created");
  const db = new DatabaseSync(filename, { readOnly: !apply });
  try {
    if (apply) {
      db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
      assertBackendStopped(db);
    }
    const now = Date.now();
    const preview = planReminderLiveTest(db, scope, now);
    let backup;
    if (apply) backup = await createDatabaseBackup({ db,
      directory: path.resolve(__dirname, "..", process.env.NUKMIRIS_BACKUP_DIR || ".local/backups"),
      keep: Number(process.env.NUKMIRIS_BACKUP_KEEP || 7) });
    const plan = apply ? applyReminderLiveTest(db, scope, values["--authorize-recipient"], Date.now()) : preview;
    console.log(JSON.stringify({ action: apply ? "applied" : "read-only-plan", ...plan,
      backup: backup ? path.basename(backup.filename) : null,
      notice: "No messages sent or Calendar events changed. Only this booking's four pending due times change on apply; normal business intervals remain unchanged. Keep the runtime test restriction enabled." }, null, 2));
  } finally { db.close(); }
}

main().catch(error => { console.error("Reminder live-test preparation failed:", error.message); process.exitCode = 1; });
