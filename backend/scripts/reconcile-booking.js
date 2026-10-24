"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { loadLocalEnv } = require("../lib/local-env");
const { loadCalendarClient, createCalendarAvailability } = require("../lib/google-calendar");
const { createBookingService } = require("../lib/booking");

async function main() {
  loadLocalEnv();
  const requestId = process.argv[2];
  if (!requestId || !/^[0-9a-f-]{36}$/.test(requestId)) throw new Error("Supply the booking request ID");
  const filename = path.resolve(__dirname, "..", process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
  if (!fs.existsSync(filename)) throw new Error("Existing database required");
  const db = new DatabaseSync(filename);
  try {
    const businessId = process.env.NUKMIRIS_BUSINESS_ID || "juanita-nails";
    const row = db.prepare("SELECT sender_whatsapp_id FROM booking_requests WHERE request_id=? AND business_id=?").get(requestId, businessId);
    if (!row) throw new Error("Request does not belong to the selected business");
    const availability = createCalendarAvailability({ db, getClient: () => loadCalendarClient({ booking: true }) });
    const service = createBookingService({ db, availability, enabled: true });
    const result = await service.reconcile({ requestId, businessId, sender: row.sender_whatsapp_id });
    console.log(`Booking status: ${result.status}. This command never creates, changes, or deletes Google events.`);
    if (result.status === "uncertain") console.log("The calendar remains protected. Do not issue a new booking for this request; inspect the recorded event ID locally.");
  } finally { db.close(); }
}
if (require.main === module) main().catch(() => {
  console.error("Reconciliation failed. Check the request ID, selected business, and local authorization. No Google events changed.");
  process.exitCode = 1;
});
