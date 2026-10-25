"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");

const backupName = /^nukmiris-(\d+)-[0-9a-f-]{36}\.sqlite\.bak$/;
const countedTables = ["businesses", "business_customers", "business_customer_sessions", "business_support_conversations",
  "business_support_messages", "booking_requests", "appointment_changes", "calendar_booking_locks", "message_inbox", "message_outbox",
  "reminder_business_settings", "appointment_attendance", "reminder_jobs", "reminder_attempts", "attendance_operations", "reminder_permission_events"];
function inspectDatabase(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const integrity = db.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== "ok" || db.prepare("PRAGMA foreign_key_check").all().length) {
      throw new Error("Database integrity verification failed");
    }
    const counts = {};
    for (const name of countedTables) {
      if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)) counts[name] = db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n;
    }
    if (!counts.businesses) throw new Error("A NukMiris business database is required");
    return counts;
  } finally { db.close(); }
}
function listBackups(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(name => backupName.test(name)).map(name => ({
    filename: path.join(directory, name), createdAt: Number(backupName.exec(name)[1]),
  })).sort((a, b) => b.createdAt - a.createdAt || a.filename.localeCompare(b.filename));
}
async function createDatabaseBackup({ db, directory, keep = 7, now = Date.now }) {
  if (!Number.isInteger(keep) || keep < 2 || keep > 90) throw new Error("Keep between 2 and 90 verified backups");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, `nukmiris-${now()}-${randomUUID()}.sqlite.bak`), temporary = `${filename}.partial`;
  try {
    await backup(db, temporary);
    fs.chmodSync(temporary, 0o600);
    const counts = inspectDatabase(temporary);
    fs.renameSync(temporary, filename);
    // Prune only this tool's backup names, and only after a verified replacement.
    for (const old of listBackups(directory).slice(keep)) fs.unlinkSync(old.filename);
    return { filename, counts };
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
async function restoreDatabaseCopy({ source, destination }) {
  if (path.resolve(source) === path.resolve(destination) || fs.existsSync(destination)) throw new Error("Restore requires a new, unused destination; existing databases are never replaced");
  const expected = inspectDatabase(source);
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = `${destination}.${randomUUID()}.partial`;
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(db, temporary);
    const counts = inspectDatabase(temporary);
    if (JSON.stringify(counts) !== JSON.stringify(expected)) throw new Error("Restored row counts do not match the backup");
    fs.copyFileSync(temporary, destination, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(destination, 0o600);
    inspectDatabase(destination);
    return { filename: destination, counts };
  } finally { db.close(); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function createBackupSchedule({ db, directory, intervalHours = 24, keep = 7, now = Date.now, onError = () => {} }) {
  if (!Number.isFinite(intervalHours) || intervalHours < 1 || intervalHours > 168) throw new Error("Backup interval must be 1 to 168 hours");
  if (!Number.isInteger(keep) || keep < 2 || keep > 90) throw new Error("Keep between 2 and 90 verified backups");
  let active, timer, stopped = true, lastError = false;
  async function ensure() {
    if (active) return active;
    active = (async () => {
      const last = listBackups(directory)[0];
      let verified = false;
      if (last) { try { inspectDatabase(last.filename); verified = true; } catch { /* Replace a corrupt backup without removing older copies first. */ } }
      if (!verified || now() - last.createdAt >= intervalHours * 3600000) await createDatabaseBackup({ db, directory, keep, now });
      lastError = false;
    })().catch(error => { lastError = true; throw error; }).finally(() => { active = undefined; });
    return active;
  }
  function start() {
    stopped = false;
    timer = setInterval(() => { if (!stopped) void ensure().catch(onError); }, 60000);
    timer.unref();
  }
  async function stop() { stopped = true; clearInterval(timer); await active?.catch(() => {}); }
  return { ensure, start, stop, status: () => ({ lastError, latest: listBackups(directory)[0]?.createdAt || null }) };
}
module.exports = { inspectDatabase, listBackups, createDatabaseBackup, restoreDatabaseCopy, createBackupSchedule };
