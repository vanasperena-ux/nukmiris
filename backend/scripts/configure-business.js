"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");
const { loadLocalEnv } = require("../lib/local-env");
const { saveBusinessConfiguration } = require("../lib/business-config");
const { validateSettings } = require("../lib/availability");

async function main() {
  loadLocalEnv();
  const filename = path.resolve(__dirname, "..", process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
  if (!fs.existsSync(filename)) throw new Error("Existing Phase 6A.3 database is missing; no database was created");
  const configFile = path.resolve(__dirname, "..", process.env.NUKMIRIS_SETTINGS_PATH || "config/juanita.example.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  validateSettings(config.settings);
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!calendarId || calendarId === "primary" || !phoneNumberId) throw new Error("Set the exact GOOGLE_CALENDAR_ID and WHATSAPP_PHONE_NUMBER_ID locally first");
  const db = new DatabaseSync(filename);
  try {
    if (!db.prepare("SELECT 1 FROM businesses WHERE business_id=?").get(config.businessId)) throw new Error("Existing test business is missing; no business was invented");
    console.log(`Configuring ${config.businessId}: ${config.settings.openingTime}–${config.settings.closingTime}, ${config.settings.durationMinutes}-minute appointments, ${config.settings.bufferMinutes}-minute gap, ${config.settings.startIntervalMinutes}-minute start interval.`);
    const backupPath = `${filename}.before-calendar-lookup-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.bak`;
    await backup(db, backupPath);
    console.log(`Local database backup created: ${path.basename(backupPath)}`);
    saveBusinessConfiguration(db, { businessId: config.businessId, calendarId, phoneNumberId, settings: config.settings });
    console.log("Business hours and explicit calendar/WhatsApp mappings saved. Other businesses were not reconfigured. No calendar events changed.");
  } finally { db.close(); }
}

if (require.main === module) main().catch(error => {
  console.error(error.message.startsWith("Set ") || error.message.startsWith("Existing ") ? error.message
    : "Business configuration stopped. Check settings, existing mappings, and any backup reported above. No Google Calendar events were changed.");
  process.exitCode = 1;
});
