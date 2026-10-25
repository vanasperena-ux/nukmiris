"use strict";
// Standalone, read-only diagnostic. Compatible with the published v0.4.0 DB.
// Run from backend/. No webhook, Calendar client, or delivery worker is loaded.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

function parsed(value) { try { return JSON.parse(value); } catch { return null; } }
function utc(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString() : null; }
function reference(value) { return value ? createHash("sha256").update(value).digest("hex").slice(0, 12) : undefined; }
function action(message) {
  if (message?.type === "text") {
    const command = String(message.text?.body || "").trim().toLowerCase();
    return { kind: ["menu", "hola", "cita", "horarios", "reagendar", "cancelar"].includes(command) ? command : "private_text" };
  }
  const id = message?.interactive?.[message.interactive.type]?.id || "";
  const kind = /^menu:[^:]+:book$/.test(id) ? "main_menu_book"
    : /^menu:[^:]+:manage$/.test(id) ? "main_menu_manage"
    : /^availability:[^:]+:slot:/.test(id) ? "appointment_slot"
    : id.startsWith("availability:") ? "availability_navigation"
    : id.startsWith("booking:") ? "booking_status_or_decision"
    : id.startsWith("change:") ? "change_status_or_decision"
    : /^(manage|owned):/.test(id) ? "appointment_management" : "other_interactive";
  return { kind, buttonReference: reference(id) };
}
function replyKind(payload) {
  const text = payload?.text?.body || payload?.interactive?.body?.text || "";
  if (text === "Esta opción ya no está vigente. Escribe Cita para consultar horarios.") return "expired_main_menu";
  if (/ya no está vigente/.test(text)) return "expired_option";
  if (/está agendada/.test(text)) return "booking_success";
  if (/está reagendada/.test(text)) return "reschedule_success";
  if (/está cancelada/.test(text)) return "cancellation_success";
  if (/nombre completo/.test(text)) return "name_requested";
  if (/verificación/.test(text)) return "verification_pending";
  if (/No pude|No pudimos/.test(text)) return "request_error";
  if (payload?.interactive) return "interactive_choices";
  return "other_reply";
}
function safeError(value) {
  return /^(handler_failed|configuration_changed|reply_expired|restart_during_send|meta_delivery_failed|unreadable_meta_response|unverified_meta_response|meta_transport_unknown|meta_http_\d{3})$/.test(value || "") ? value : value ? "other_error" : null;
}
function inspectRestart({ db, businessId, limit = 50 }) {
  if (!businessId || !Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Select a business and a limit from 1 to 200");
  const exists = name => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const result = { readOnly: true, messageTimes: "UTC receipt times; output records do not contain send timestamps",
    messageHistoryAvailable: exists("message_inbox") && exists("message_outbox"), messages: [], bookings: [] };
  const customers = new Map(), bookings = new Map();
  function alias(map, value, label) { if (!value) return null; if (!map.has(value)) map.set(value, `${label} ${map.size + 1}`); return map.get(value); }
  const customer = value => alias(customers, value, "Customer");
  const booking = value => alias(bookings, value, "Booking");
  db.exec("BEGIN");
  try {
    if (result.messageHistoryAvailable) {
      const records = db.prepare("SELECT * FROM message_inbox WHERE business_id=? ORDER BY inbox_id DESC LIMIT ?").all(businessId, limit).reverse();
      for (const row of records) {
        const snapshot = parsed(row.snapshot_json), session = parsed(snapshot?.session?.session_json);
        const continuation = parsed(row.continuation_json), incoming = action(parsed(row.message_json));
        const modes = ["main_menu", "availability", "booking_name", "booking_result", "booking_confirm", "management_menu", "management_select", "management_result", "reschedule_browse"];
        const replies = db.prepare("SELECT * FROM message_outbox WHERE inbox_id=? ORDER BY ordinal").all(row.inbox_id).map(reply => ({
          kind: replyKind(parsed(reply.payload_json)), state: reply.state, attempts: reply.attempts,
          metaStatus: ["sent", "delivered", "read", "failed"].includes(reply.meta_status) ? reply.meta_status : null,
          error: safeError(reply.last_error),
        }));
        result.messages.push({ inbox: row.inbox_id, customer: customer(row.sender), receivedAtUtc: utc(row.received_at),
          ...incoming, state: row.state, attempts: row.attempts, error: safeError(row.last_error),
          priorSession: modes.includes(session?.mode) ? session.mode : session ? "other_session" : null,
          priorOfferExpiredAtReceipt: Number.isFinite(session?.expiresAt) ? row.received_at > session.expiresAt : null,
          priorSelectionMatches: !!(session?.selectionCommand && reference(session.selectionCommand) === incoming.buttonReference),
          operation: continuation ? { kind: ["booking", "management"].includes(continuation.kind) ? continuation.kind : "other",
            booking: continuation.kind === "booking" ? booking(continuation.requestId) : null } : null, replies });
      }
    }
    if (exists("booking_requests")) {
      for (const row of db.prepare(`SELECT request_id,sender_whatsapp_id,state,created_at,updated_at FROM booking_requests
        WHERE business_id=? ORDER BY created_at DESC LIMIT ?`).all(businessId, limit)) {
        result.bookings.push({ booking: booking(row.request_id), customer: customer(row.sender_whatsapp_id),
          state: row.state, createdAtUtc: utc(row.created_at), updatedAtUtc: utc(row.updated_at) });
      }
    }
    return result;
  } finally { db.exec("ROLLBACK"); }
}
function main() {
  const backend = process.cwd();
  require("dotenv").config({ path: path.join(backend, ".env"), quiet: true });
  const filename = path.resolve(backend, process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
  if (!fs.existsSync(filename)) throw new Error("Existing database required");
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const report = inspectRestart({ db, businessId: process.env.NUKMIRIS_BUSINESS_ID || "juanita-nails" });
    const pkg = parsed(fs.readFileSync(path.join(backend, "package.json"), "utf8"));
    console.log(JSON.stringify({ tool: "NukMiris restart inspection", appVersion: /^\d+\.\d+\.\d+$/.test(pkg?.version) ? pkg.version : "unknown",
      reliabilityEnabledNow: process.env.NUKMIRIS_ENABLE_RELIABILITY === "true", ...report }, null, 2));
  } finally { db.close(); }
}
if (require.main === module) {
  try { main(); } catch {
    console.error("Inspection stopped. Run from backend/ with Node 24 and the existing database/settings. No external services were contacted.");
    process.exitCode = 1;
  }
}
module.exports = { inspectRestart };
