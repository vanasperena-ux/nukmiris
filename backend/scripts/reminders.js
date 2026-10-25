"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");
const { loadLocalEnv } = require("../lib/local-env");
const { prepareReminderSchema, DEFAULT_INTERVALS } = require("../lib/reminder-schedule");
const { DEFAULT_TEMPLATES, templateDefinitions, createTemplateVerifier } = require("../lib/reminder-templates");
const { createAppointmentReminders } = require("../lib/appointment-reminders");
const { recordReminderPermission, reminderPermission } = require("../lib/reminder-permissions");

async function main() {
  loadLocalEnv();
  const args = process.argv.slice(2), action = args[0];
  const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  if (!["--prepare", "--status", "--templates", "--permission"].includes(action)) throw new Error("Choose a reminder command");
  const businessId = option("--business-id") || process.env.NUKMIRIS_BUSINESS_ID;
  if (!businessId) throw new Error("Select --business-id explicitly or set NUKMIRIS_BUSINESS_ID");
  const filename = path.resolve(__dirname, "..", process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
  if (!fs.existsSync(filename)) throw new Error("Existing NukMiris database required");
  const db = new DatabaseSync(filename, { readOnly: !["--prepare", "--permission"].includes(action) });
  try {
    if (!db.prepare("SELECT 1 FROM businesses WHERE business_id=?").get(businessId)) throw new Error("Selected business does not exist");
    if (action === "--prepare") {
      for (const table of ["booking_requests", "appointment_changes", "message_inbox", "message_outbox", "delivery_worker", "business_whatsapp_connections"]) {
        if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) throw new Error("Prepare booking, management and reliability first");
      }
      const worker = db.prepare("SELECT * FROM delivery_worker WHERE singleton=1").get();
      if (worker) {
        let alive = true;
        try { process.kill(worker.pid, 0); } catch (error) { alive = error.code !== "ESRCH"; }
        if (worker.host !== os.hostname() || alive) throw new Error("Stop the existing backend before reminder preparation");
      }
      const waba = option("--waba-id"), language = option("--language") || "es_MX";
      if (waba && !/^\d+$/.test(waba)) throw new Error("WABA ID must contain digits only");
      if (!/^es(?:_[A-Z]{2})?$/.test(language)) throw new Error("Select a supported Spanish template language, for example es_MX");
      const destination = `${filename}.before-reminders-${Date.now()}-${randomUUID()}.bak`;
      await backup(db, destination);
      fs.chmodSync(destination, 0o600);
      console.log("Pre-upgrade backup created:", path.basename(destination));
      prepareReminderSchema(db);
      db.prepare(`INSERT INTO reminder_business_settings
        (business_id,activated_at,waba_id,language,templates_json,intervals_json) VALUES (?,?,?,?,?,?)
        ON CONFLICT(business_id) DO UPDATE SET waba_id=COALESCE(excluded.waba_id,reminder_business_settings.waba_id),
          language=COALESCE(?,reminder_business_settings.language)`).run(businessId, Date.now(), waba || null, language,
            JSON.stringify(DEFAULT_TEMPLATES), JSON.stringify(DEFAULT_INTERVALS), option("--language") || null);
      console.log("Reminder metadata prepared for the selected business. Existing appointments were not enrolled. No external calls or sends were made.");
      console.log("Sending remains off until NUKMIRIS_REMINDERS_MODE is explicitly changed. Start with dry-run; see REMINDERS.md.");
      return;
    }
    const config = db.prepare(`SELECT r.*,w.phone_number_id FROM reminder_business_settings r
      JOIN business_whatsapp_connections w USING(business_id) WHERE r.business_id=?`).get(businessId);
    if (!config) throw new Error("Prepare reminders for this business first");
    if (action === "--permission") {
      if (args.includes("--grant") === args.includes("--revoke")) throw new Error("Select exactly one of --grant or --revoke");
      db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE");
      try {
        recordReminderPermission(db, { businessId, sender: option("--whatsapp-id"), decision: args.includes("--grant") ? "granted" : "revoked",
          occurredAt: Date.parse(option("--occurred-at")), source: option("--source"), wording: option("--wording"),
          evidence: option("--evidence"), recordedBy: option("--recorded-by") });
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      console.log("Reminder permission evidence recorded for the selected business/customer. No messages or Calendar writes were made.");
      return;
    }
    if (action === "--templates") {
      const definitions = templateDefinitions(config.language, JSON.parse(config.templates_json));
      if (args.includes("--check")) {
        const verify = createTemplateVerifier({ token: process.env.WHATSAPP_TOKEN, apiVersion: process.env.WHATSAPP_API_VERSION || "v26.0" });
        for (const kind of Object.keys(DEFAULT_TEMPLATES)) {
          const result = await verify(config, kind);
          console.log(`Approved matching Utility template: ${kind}`, JSON.stringify(result));
        }
      } else console.log(JSON.stringify(definitions, null, 2));
      return;
    }
    const reminders = createAppointmentReminders({ db, availability: null });
    console.log(JSON.stringify({ businessId, enabled: !!config.enabled, activatedAt: new Date(config.activated_at).toISOString(),
      attendance: reminders.report(businessId).map(row => ({ ...row,
        reminderPermission: reminderPermission(db, businessId, row.sender).allowed ? "granted" : reminderPermission(db, businessId, row.sender).reason })),
      jobs: db.prepare(`SELECT j.state,COUNT(*) AS count FROM reminder_jobs j JOIN appointment_attendance a USING(booking_request_id)
        WHERE a.business_id=? GROUP BY j.state`).all(businessId),
      scheduled: db.prepare(`SELECT a.customer_name,j.job_id,j.kind,j.schedule_version,j.due_at,j.expires_at,j.state,j.meta_status
        FROM reminder_jobs j JOIN appointment_attendance a USING(booking_request_id)
        WHERE a.business_id=? AND j.state='pending' ORDER BY j.due_at LIMIT 1000`).all(businessId),
      needsReview: db.prepare(`SELECT j.job_id,j.kind,j.state,j.meta_status,j.last_error FROM reminder_jobs j
        JOIN appointment_attendance a USING(booking_request_id) WHERE a.business_id=? AND j.state IN ('failed','uncertain') LIMIT 1000`).all(businessId),
      confirmationOperations: db.prepare(`SELECT o.operation_id,o.state,o.last_error FROM attendance_operations o
        JOIN appointment_attendance a USING(booking_request_id) WHERE a.business_id=? AND o.state IN ('pending','uncertain','rejected') LIMIT 1000`).all(businessId),
    }, null, 2));
  } finally { db.close(); }
}
if (require.main === module) main().catch(error => {
  console.error("Reminder command stopped:", error.message);
  process.exitCode = 1;
});
module.exports = { main };
