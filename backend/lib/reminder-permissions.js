"use strict";

// Permission is separate from booking and attendance. No inbound booking,
// generic "sí", outbound notice, template approval or admin activation grants it.
function prepareReminderPermissionSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS reminder_permission_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL REFERENCES businesses(business_id),
    whatsapp_id TEXT NOT NULL,
    customer_id TEXT,
    decision TEXT NOT NULL CHECK(decision IN ('granted','revoked')),
    occurred_at INTEGER NOT NULL,
    recorded_at INTEGER NOT NULL,
    source TEXT NOT NULL,
    wording TEXT NOT NULL,
    evidence_reference TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    FOREIGN KEY(business_id,customer_id) REFERENCES business_customers(business_id,customer_id),
    UNIQUE(business_id,whatsapp_id,source,evidence_reference)
  );
  CREATE INDEX IF NOT EXISTS idx_reminder_permission_identity
    ON reminder_permission_events(business_id,whatsapp_id,occurred_at DESC,event_id DESC);`);
}
function reminderPermission(db, businessId, sender, now = Date.now()) {
  const event = db.prepare(`SELECT * FROM reminder_permission_events WHERE business_id=? AND whatsapp_id=? AND occurred_at<=?
    ORDER BY occurred_at DESC,CASE decision WHEN 'revoked' THEN 1 ELSE 0 END DESC,event_id DESC LIMIT 1`).get(businessId, sender, now);
  if (!event) return { allowed: false, reason: "customer_permission_missing" };
  const customer = db.prepare("SELECT customer_id FROM business_customers WHERE business_id=? AND whatsapp_id=?").get(businessId, sender);
  return { allowed: event.decision === "granted" && !!customer && customer.customer_id === event.customer_id,
    reason: event.decision === "revoked" ? "customer_permission_revoked" : "customer_permission_missing", event };
}
function recordReminderPermission(db, { businessId, sender, decision, occurredAt, source, wording, evidence, recordedBy }, now = Date.now()) {
  if (!businessId || !sender || !["granted", "revoked"].includes(decision) || !Number.isSafeInteger(occurredAt) || occurredAt > now || occurredAt < 0) {
    throw new Error("Select the business, customer, permission decision and a valid past/current evidence time");
  }
  for (const value of [source, wording, evidence, recordedBy]) {
    if (typeof value !== "string" || !value.trim() || value.length > 2000) throw new Error("Permission source, wording, evidence reference and recorded-by identity are required (maximum 2000 characters each)");
  }
  if (!db.prepare("SELECT 1 FROM businesses WHERE business_id=?").get(businessId)) throw new Error("Unknown permission business");
  const customer = db.prepare("SELECT customer_id FROM business_customers WHERE business_id=? AND whatsapp_id=?").get(businessId, sender);
  if (decision === "granted" && !customer) throw new Error("A grant requires an existing customer identity in the selected business");
  const existing = db.prepare(`SELECT * FROM reminder_permission_events
    WHERE business_id=? AND whatsapp_id=? AND source=? AND evidence_reference=?`).get(businessId, sender, source, evidence);
  if (existing) {
    if (existing.decision !== decision || existing.wording !== wording || existing.occurred_at !== occurredAt ||
        (decision === "granted" && existing.customer_id !== (customer?.customer_id || null))) throw new Error("Conflicting permission evidence; use the actual distinct evidence reference");
    return existing;
  }
  db.prepare(`INSERT INTO reminder_permission_events
    (business_id,whatsapp_id,customer_id,decision,occurred_at,recorded_at,source,wording,evidence_reference,recorded_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(businessId, sender, customer?.customer_id || null, decision, occurredAt, now, source, wording, evidence, recordedBy);
  return db.prepare("SELECT * FROM reminder_permission_events WHERE event_id=last_insert_rowid()").get();
}
function isReminderOptOut(text) {
  return /^(?:stop|baja recordatorios|no quiero recordatorios|no me envies recordatorios|dejar de recibir recordatorios)$/.test(
    String(text).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " "));
}
module.exports = { prepareReminderPermissionSchema, reminderPermission, recordReminderPermission, isReminderOptOut };
