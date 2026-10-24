"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { loadLocalEnv } = require("../lib/local-env");
const { loadCalendarClient, createCalendarAvailability, verifyBookingAuthorization } = require("../lib/google-calendar");
const { checkMeta, listWritableCalendars } = require("../lib/connection-checks");

async function main() {
  loadLocalEnv();
  const management = process.argv.includes("--management");
  const booking = management || process.argv.includes("--booking");
  if (process.argv.includes("--list-calendars")) {
    const calendars = await listWritableCalendars(loadCalendarClient());
    if (!calendars.length) throw new Error("No writable calendars were found");
    calendars.forEach((calendar, index) => console.log(`${index + 1}. ${calendar.name}\n   Calendar ID: ${calendar.id}`));
    console.log("Set GOOGLE_CALENDAR_ID locally to the exact ID for Juanita's calendar, then run npm run business:configure.");
    return;
  }
  let failed = false;
  try {
    await checkMeta({ token: process.env.WHATSAPP_TOKEN, phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      apiVersion: process.env.WHATSAPP_API_VERSION || "v26.0" });
    console.log("Meta WhatsApp: OK (read-only sender access check; no message sent).");
  } catch (error) {
    failed = true;
    console.error("Meta WhatsApp: FAILED. Review the local token, phone-number ID, and API permissions.");
  }
  let db;
  try {
    const filename = path.resolve(__dirname, "..", process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
    if (!fs.existsSync(filename)) throw new Error("Existing business database is missing");
    db = new DatabaseSync(filename, { readOnly: true });
    const businessId = process.env.NUKMIRIS_BUSINESS_ID || "juanita-nails";
    if (booking) {
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name='booking_requests'").get()) throw new Error("Run booking:prepare first");
      await verifyBookingAuthorization();
    }
    if (management && !db.prepare("SELECT 1 FROM sqlite_master WHERE name='appointment_changes'").get()) throw new Error("Run management:prepare first");
    const result = await createCalendarAvailability({ db, getClient: () => loadCalendarClient({ booking }) }).verify(businessId);
    console.log(`Google Calendar: OK (${result.calendarName}; ${booking ? "new-booking permission verified" : "availability only"}, no events changed).`);
    if (management) console.log("Appointment management journal: OK. Booking event permission covers confirmed rescheduling/cancellation; no events changed.");
  } catch (error) {
    failed = true;
    console.error(booking ? "Google Calendar: FAILED. Review google:connect:booking, booking:prepare, and the selected business calendar."
      : "Google Calendar: FAILED. Review local authorization and the business/calendar settings; run business:configure if needed.");
  } finally { if (db) db.close(); }
  if (!process.env.META_APP_SECRET || !process.env.WHATSAPP_VERIFY_TOKEN) {
    failed = true;
    console.error("Webhook: local META_APP_SECRET and WHATSAPP_VERIFY_TOKEN are required.");
  }
  if (failed) process.exitCode = 1;
}

if (require.main === module) main().catch(() => {
  console.error("Connection check failed. Check local configuration; no credential values are shown.");
  process.exitCode = 1;
});
