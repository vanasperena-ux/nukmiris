"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");
const { loadLocalEnv } = require("../lib/local-env");
const { prepareReminderSchema, DEFAULT_INTERVALS } = require("../lib/reminder-schedule");
const { DEFAULT_TEMPLATES, templateDefinitions, templateMetadata, createTemplateVerifier } = require("../lib/reminder-templates");
const { createAppointmentReminders } = require("../lib/appointment-reminders");
const { recordReminderPermission, reminderPermission } = require("../lib/reminder-permissions");

function diagnosticError(error) {
  // Network/JSON errors can contain response fragments. Never print those or
  // arbitrary provider objects as a template-readiness diagnostic.
  return /^(reminder_[a-z_]+(?:\d{3})?)(?=[:\s]|$)/.exec(error?.message || "")?.[1] || "reminder_template_check_unavailable";
}
async function checkTemplates(config, verify) {
  const templates = [];
  for (const [index, kind] of Object.keys(DEFAULT_TEMPLATES).entries()) {
    let expected = null;
    try {
      const definition = templateDefinitions(config.language, JSON.parse(config.templates_json))[index];
      expected = templateMetadata({ ...definition, status: "APPROVED" }, definition);
    } catch { /* The verifier supplies the safe configuration failure below. */ }
    try {
      const result = await verify(config, kind);
      templates.push({ kind, ok: true, ...result, expected: result.expected || expected });
    } catch (error) {
      templates.push({ kind, ok: false, error: diagnosticError(error), expected,
        observed: error.templateCheck?.observed || null, mismatches: error.templateCheck?.mismatches || [] });
    }
  }
  return { businessId: config.business_id, ready: templates.every(item => item.ok), templates };
}
function safeStoredError(value) {
  if (value === null || value === undefined) return null;
  return /^[a-z][a-z0-9_]{0,95}$/.test(value) ? value :
    /^(reminder_[a-z_]+(?:\d{3})?)(?=[:\s]|$)/.exec(value)?.[1] || "unclassified_error";
}
function reminderStatus(db, businessId, config) {
  const reminders = createAppointmentReminders({ db, availability: null });
  const recentJobs = db.prepare(`SELECT j.booking_request_id,j.job_id,j.kind,j.schedule_version,j.due_at,j.expires_at,
    j.state,j.attempts,j.accepted_at,j.meta_message_id,j.meta_status,j.last_error
    FROM reminder_jobs j JOIN appointment_attendance a USING(booking_request_id)
    LEFT JOIN (SELECT job_id,MAX(attempted_at) AS latest FROM reminder_attempts GROUP BY job_id) t USING(job_id)
    WHERE a.business_id=? ORDER BY COALESCE(t.latest,j.accepted_at,0) DESC,j.due_at DESC,j.job_id LIMIT 200`)
    .all(businessId).map(row => ({ ...row, last_error: safeStoredError(row.last_error) }));
  const attempts = recentJobs.length ? db.prepare(`SELECT t.job_id,j.booking_request_id,j.kind,j.schedule_version,
    t.attempt,t.attempted_at,t.outcome,t.error,t.meta_message_id
    FROM reminder_attempts t JOIN reminder_jobs j USING(job_id) JOIN appointment_attendance a USING(booking_request_id)
    WHERE a.business_id=? AND t.job_id IN (${recentJobs.map(() => "?").join(",")})
    ORDER BY t.attempted_at DESC,t.job_id,t.attempt DESC LIMIT 200`)
    .all(businessId, ...recentJobs.map(row => row.job_id)).map(row => ({ ...row, error: safeStoredError(row.error) })) : [];
  return { businessId, businessStatus: db.prepare("SELECT status FROM businesses WHERE business_id=?").get(businessId)?.status,
    enabled: !!config.enabled, activatedAt: new Date(config.activated_at).toISOString(),
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
    recentJobs, attempts };
}

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
      if (args.includes("--check")) {
        const apiVersion = process.env.WHATSAPP_API_VERSION || "v26.0";
        const verify = createTemplateVerifier({ token: process.env.WHATSAPP_TOKEN, apiVersion });
        const report = { ...await checkTemplates(config, verify), apiVersion };
        if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
        else {
          for (const result of report.templates) console.log(result.ok
            ? `Approved matching Utility template: ${result.kind}` : `Template check blocked: ${result.kind}`, JSON.stringify(result));
          console.log(`Template checks: ${report.templates.filter(item => item.ok).length}/4 verified. No messages or template updates were sent.`);
        }
        if (!report.ready) process.exitCode = 1;
      } else console.log(JSON.stringify(templateDefinitions(config.language, JSON.parse(config.templates_json)), null, 2));
      return;
    }
    console.log(JSON.stringify(reminderStatus(db, businessId, config), null, 2));
  } finally { db.close(); }
}
if (require.main === module) main().catch(error => {
  console.error("Reminder command stopped:", error.message);
  process.exitCode = 1;
});
module.exports = { main, checkTemplates, reminderStatus };
