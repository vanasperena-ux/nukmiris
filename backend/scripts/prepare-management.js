"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");
const { loadLocalEnv } = require("../lib/local-env");
const { prepareManagementSchema } = require("../lib/appointment-management");

async function main() {
  loadLocalEnv();
  const filename = path.resolve(__dirname, "..", process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
  if (!fs.existsSync(filename)) throw new Error("Existing booking database required");
  const db = new DatabaseSync(filename);
  try {
    for (const name of ["booking_requests", "calendar_booking_locks", "business_customers"]) {
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)) throw new Error("Prepare booking first");
    }
    const destination = `${filename}.before-management-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.bak`;
    await backup(db, destination);
    console.log(`Database backup created: ${path.basename(destination)}`);
    prepareManagementSchema(db);
    console.log("Appointment change journal prepared. Existing bookings, schedules, mappings, and customers preserved. No Google events changed.");
  } finally { db.close(); }
}
if (require.main === module) main().catch(() => {
  console.error("Management preparation stopped. Check the database path/schema and any backup reported above; no Google calls were made.");
  process.exitCode = 1;
});
