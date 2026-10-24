"use strict";

const { validateSettings } = require("./availability");

function readBusinessSettings(db, businessId) {
  const row = db.prepare(`SELECT s.*, b.time_zone FROM business_settings s
    JOIN businesses b ON b.business_id=s.business_id WHERE s.business_id=?`).get(businessId);
  if (!row) throw new Error("Business scheduling settings are missing");
  return validateSettings({
    timeZone: row.time_zone, workingDays: JSON.parse(row.working_days_json),
    openingTime: row.opening_time, closingTime: row.closing_time,
    durationMinutes: row.appointment_duration_minutes, bufferMinutes: row.buffer_minutes,
    startIntervalMinutes: row.start_interval_minutes, breaks: JSON.parse(row.breaks_json),
  });
}

function saveBusinessConfiguration(db, { businessId, calendarId, phoneNumberId, settings }) {
  validateSettings(settings);
  if (!businessId || typeof calendarId !== "string" || !calendarId.trim() || calendarId === "primary" ||
      typeof phoneNumberId !== "string" || !phoneNumberId.trim()) throw new Error("An explicit business, calendar ID, and receiving phone ID are required");
  if (!db.prepare("SELECT 1 FROM businesses WHERE business_id=?").get(businessId)) throw new Error("Existing Phase 6A business required");
  if (!db.prepare("SELECT 1 FROM business_settings WHERE business_id=?").get(businessId)) throw new Error("Existing business settings required");
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS business_calendar_connections (
      business_id TEXT PRIMARY KEY REFERENCES businesses(business_id),
      google_calendar_id TEXT NOT NULL UNIQUE, google_calendar_name TEXT NOT NULL,
      connection_mode TEXT NOT NULL DEFAULT 'shared_test_oauth', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_whatsapp_connections (
      business_id TEXT PRIMARY KEY REFERENCES businesses(business_id),
      phone_number_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );`);
    const existingCalendar = db.prepare("SELECT google_calendar_id FROM business_calendar_connections WHERE business_id=?").get(businessId);
    const existingPhone = db.prepare("SELECT phone_number_id FROM business_whatsapp_connections WHERE business_id=?").get(businessId);
    if (existingCalendar && existingCalendar.google_calendar_id !== calendarId) throw new Error("Existing calendar mapping differs; review it separately before replacing it");
    if (existingPhone && existingPhone.phone_number_id !== phoneNumberId) throw new Error("Existing WhatsApp mapping differs; review it separately before replacing it");
    const now = new Date().toISOString();
    db.prepare("INSERT OR IGNORE INTO business_calendar_connections VALUES (?,?,?,'shared_test_oauth',?,?)")
      .run(businessId, calendarId, "Explicitly selected calendar", now, now);
    db.prepare("INSERT OR IGNORE INTO business_whatsapp_connections VALUES (?,?,?,?)")
      .run(businessId, phoneNumberId, now, now);
    const calendar = db.prepare("SELECT google_calendar_id FROM business_calendar_connections WHERE business_id=?").get(businessId);
    const phone = db.prepare("SELECT phone_number_id FROM business_whatsapp_connections WHERE business_id=?").get(businessId);
    if (calendar?.google_calendar_id !== calendarId || phone?.phone_number_id !== phoneNumberId) throw new Error("A calendar or receiving number is already assigned to another business");
    db.prepare(`UPDATE business_settings SET working_days_json=?, opening_time=?, closing_time=?,
      appointment_duration_minutes=?, buffer_minutes=?, start_interval_minutes=?, breaks_json=?, updated_at=? WHERE business_id=?`)
      .run(JSON.stringify(settings.workingDays), settings.openingTime, settings.closingTime,
        settings.durationMinutes, settings.bufferMinutes, settings.startIntervalMinutes, JSON.stringify(settings.breaks), now, businessId);
    db.prepare("UPDATE businesses SET time_zone=?, updated_at=? WHERE business_id=?").run(settings.timeZone, now, businessId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

module.exports = { readBusinessSettings, saveBusinessConfiguration };
