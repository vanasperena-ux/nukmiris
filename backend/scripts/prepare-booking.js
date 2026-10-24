"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");
const { loadLocalEnv } = require("../lib/local-env");
const { prepareBookingSchema } = require("../lib/booking");

async function main() {
  loadLocalEnv();
  const filename = path.resolve(__dirname, "..", process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
  if (!fs.existsSync(filename)) throw new Error("Existing business database required; nothing was created");
  const db = new DatabaseSync(filename);
  try {
    for (const table of ["businesses", "business_customers", "business_calendar_connections", "business_whatsapp_connections"]) {
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) throw new Error("Verified availability database required");
    }
    const destination = `${filename}.before-booking-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.bak`;
    await backup(db, destination);
    console.log(`Database backup created: ${path.basename(destination)}`);
    prepareBookingSchema(db);
    console.log("Booking journal prepared. Existing schedules, calendar mappings, and customers were preserved. No Calendar events changed.");
  } finally { db.close(); }
}
if (require.main === module) main().catch(() => {
  console.error("Booking preparation stopped. Check the database path/schema and any backup reported above; no Google calls were made.");
  process.exitCode = 1;
});
