"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { loadLocalEnv } = require("../lib/local-env");
const { createDatabaseBackup, listBackups, restoreDatabaseCopy } = require("../lib/database-backups");

async function main() {
  loadLocalEnv();
  const directory = path.resolve(__dirname, "..", process.env.NUKMIRIS_BACKUP_DIR || ".local/backups");
  const action = process.argv[2];
  if (action === "--create") {
    const filename = path.resolve(__dirname, "..", process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
    if (!fs.existsSync(filename)) throw new Error("Existing database required");
    const db = new DatabaseSync(filename, { readOnly: true });
    try {
      const result = await createDatabaseBackup({ db, directory, keep: Number(process.env.NUKMIRIS_BACKUP_KEEP || 7) });
      console.log(`Verified database backup created: ${path.basename(result.filename)}`);
    } finally { db.close(); }
    return;
  }
  if (!["--restore-test", "--restore"].includes(action)) throw new Error("Choose a database backup command");
  const source = process.argv[3] && process.argv[3] !== "--to" ? path.resolve(process.argv[3]) : listBackups(directory)[0]?.filename;
  if (!source) throw new Error("Create a backup first");
  const position = process.argv.indexOf("--to");
  const destination = action === "--restore-test" ? path.join(directory, "restore-checks", `${randomUUID()}.sqlite`)
    : position >= 0 && process.argv[position + 1] ? path.resolve(process.argv[position + 1]) : null;
  if (!destination) throw new Error("Restore requires --to and a new unused destination filename");
  const live = path.resolve(__dirname, "..", process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");
  if (path.resolve(destination) === live) throw new Error("The configured live database is never a restore destination");
  const result = await restoreDatabaseCopy({ source, destination });
  console.log(`Isolated restore verified: ${path.basename(result.filename)}. Integrity, foreign keys, and row counts match.`);
  console.log("The live database was not replaced. No app worker, Google calls, or WhatsApp sends were started.");
}
if (require.main === module) main().catch(() => {
  console.error("Backup/restore stopped. Check source/destination paths and database integrity. Existing databases were not replaced.");
  process.exitCode = 1;
});
