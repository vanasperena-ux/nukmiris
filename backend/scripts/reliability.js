"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");
const { loadLocalEnv } = require("../lib/local-env");
const { prepareReliabilitySchema, createReliableDelivery } = require("../lib/reliable-delivery");
const { listBackups } = require("../lib/database-backups");

async function main() {
  loadLocalEnv();
  const action = process.argv[2];
  if (!["--prepare", "--status", "--retry"].includes(action)) throw new Error("Choose a reliability command");
  const filename = path.resolve(__dirname, "..", process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
  if (!fs.existsSync(filename)) throw new Error("Existing database required");
  const db = new DatabaseSync(filename, { readOnly: action === "--status" });
  try {
    if (action === "--prepare") {
      for (const name of ["businesses", "business_customer_sessions", "business_support_conversations", "business_support_messages"]) {
        if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)) throw new Error("Verified application database required");
      }
      const destination = `${filename}.before-reliability-${Date.now()}-${randomUUID()}.bak`;
      await backup(db, destination);
      console.log(`Pre-upgrade backup created: ${path.basename(destination)}`);
      db.exec("PRAGMA foreign_keys=ON");
      prepareReliabilitySchema(db);
      console.log("Reliable inbox/outbox prepared. Existing appointments, profiles, settings, and Google events preserved.");
    } else {
      const businessId = process.env.NUKMIRIS_BUSINESS_ID || "juanita-nails";
      if (action === "--retry") {
        createReliableDelivery({ db,
          capabilities: JSON.stringify({ mode: process.env.NUKMIRIS_MODE || "support", management: process.env.NUKMIRIS_MODE === "booking" && process.env.NUKMIRIS_ENABLE_MANAGEMENT === "true" }),
          resolveBusiness: phone => db.prepare(`SELECT b.business_id,w.phone_number_id FROM businesses b JOIN business_whatsapp_connections w USING(business_id)
            WHERE w.phone_number_id=? AND b.status IN ('test','active')`).get(phone),
        }).retry({ businessId, uncertain: process.argv.includes("--include-uncertain") });
        console.log("Retryable messages for the selected business were queued. No Calendar calls were made.");
        if (process.argv.includes("--include-uncertain")) console.log("Uncertain replies were included explicitly; Meta may already have accepted them, so a WhatsApp reply can be duplicated.");
      }
      console.log("Incoming messages:", JSON.stringify(db.prepare("SELECT state,COUNT(*) AS count FROM message_inbox WHERE business_id=? GROUP BY state").all(businessId)));
      console.log("Outgoing replies:", JSON.stringify(db.prepare(`SELECT o.state,COUNT(*) AS count FROM message_outbox o JOIN message_inbox i USING(inbox_id)
        WHERE i.business_id=? GROUP BY o.state`).all(businessId)));
      const review = db.prepare(`SELECT o.outbox_id,o.state,o.last_error FROM message_outbox o JOIN message_inbox i USING(inbox_id)
        WHERE i.business_id=? AND o.state IN ('uncertain','failed')`).all(businessId);
      if (review.length) console.log("Reply IDs requiring review:", JSON.stringify(review));
      const blocked = db.prepare("SELECT inbox_id,last_error FROM message_inbox WHERE business_id=? AND state='blocked'").all(businessId);
      if (blocked.length) console.log("Input IDs requiring review:", JSON.stringify(blocked));
      const directory = path.resolve(__dirname, "..", process.env.NUKMIRIS_BACKUP_DIR || ".local/backups");
      const copies = listBackups(directory);
      console.log(`Automatic backups: ${copies.length}. Latest: ${copies[0] ? path.basename(copies[0].filename) : "none yet"}.`);
    }
  } finally { db.close(); }
}
if (require.main === module) main().catch(() => {
  console.error("Reliability command stopped. Check the database path, preparation, and selected business. No external services were contacted.");
  process.exitCode = 1;
});
