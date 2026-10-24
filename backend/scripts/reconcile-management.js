"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { loadLocalEnv } = require("../lib/local-env");
const { loadCalendarClient, createCalendarAvailability } = require("../lib/google-calendar");
const { createAppointmentManagement } = require("../lib/appointment-management");

async function main() {
  loadLocalEnv();
  const requestId = process.argv[2];
  if (!requestId || !/^[0-9a-f-]{36}$/.test(requestId)) throw new Error("Supply an appointment change request ID");
  const filename = path.resolve(__dirname, "..", process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
  if (!fs.existsSync(filename)) throw new Error("Existing database required");
  const db = new DatabaseSync(filename);
  try {
    const businessId = process.env.NUKMIRIS_BUSINESS_ID || "juanita-nails";
    const row = db.prepare("SELECT sender_whatsapp_id FROM appointment_changes WHERE request_id=? AND business_id=?").get(requestId, businessId);
    if (!row) throw new Error("Change does not belong to the selected business");
    const availability = createCalendarAvailability({ db, getClient: () => loadCalendarClient({ booking: true }) });
    const service = createAppointmentManagement({ db, availability, enabled: true });
    const result = await service.reconcile({ requestId, businessId, sender: row.sender_whatsapp_id });
    console.log(`Appointment change status: ${result.status}. This command only reads Google and updates local status.`);
    if (result.status === "uncertain") console.log("The calendar remains protected. Do not clear the journal or release locks manually; inspect the recorded event locally.");
  } finally { db.close(); }
}
if (require.main === module) main().catch(() => {
  console.error("Change reconciliation failed. Check the request ID, selected business, and authorization. No Google events changed.");
  process.exitCode = 1;
});
