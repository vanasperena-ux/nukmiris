"use strict";

const { randomUUID } = require("node:crypto");
const HOUR = 3600000;
const GRACE_MS = 15 * 60000;
const DEFAULT_INTERVALS = Object.freeze({ seven_day: 168, confirmation: 24, followup: 22, final: 2 });

function reminderTimes(start, created, intervals = DEFAULT_INTERVALS) {
  const jobs = [];
  for (const [kind, hours] of Object.entries(intervals)) {
    if (!Number.isFinite(hours) || hours <= 0) throw new Error("Invalid reminder interval");
    const due = start - hours * HOUR;
    if (due <= created || (kind === "followup" && !jobs.some(job => job.kind === "confirmation"))) continue;
    jobs.push({ kind, due, expires: Math.min(due + GRACE_MS, start - 1) });
  }
  return jobs;
}

function prepareReminderSchema(db) {
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS reminder_business_settings (
        business_id TEXT PRIMARY KEY REFERENCES businesses(business_id),
        activated_at INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
        waba_id TEXT,
        language TEXT NOT NULL DEFAULT 'es_MX',
        templates_json TEXT NOT NULL,
        intervals_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS appointment_attendance (
        booking_request_id TEXT PRIMARY KEY REFERENCES booking_requests(request_id),
        business_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        calendar_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        phone_number_id TEXT NOT NULL,
        time_zone TEXT NOT NULL,
        start_iso TEXT NOT NULL,
        end_iso TEXT NOT NULL,
        start_ms INTEGER NOT NULL,
        end_ms INTEGER NOT NULL,
        lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','CANCELLED','REVIEW')),
        attendance TEXT NOT NULL CHECK(attendance IN ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED','CANCELLED')),
        confirmed_at INTEGER,
        responded_at INTEGER,
        reschedule_until INTEGER,
        schedule_version INTEGER NOT NULL,
        action_token TEXT NOT NULL UNIQUE,
        next_check_at INTEGER NOT NULL,
        last_error TEXT,
        FOREIGN KEY(business_id,customer_id) REFERENCES business_customers(business_id,customer_id)
      );
      CREATE INDEX IF NOT EXISTS idx_attendance_check ON appointment_attendance(lifecycle,next_check_at);
      CREATE INDEX IF NOT EXISTS idx_attendance_customer ON appointment_attendance(business_id,sender,start_ms);
      CREATE TABLE IF NOT EXISTS reminder_jobs (
        job_id TEXT PRIMARY KEY,
        booking_request_id TEXT NOT NULL REFERENCES appointment_attendance(booking_request_id),
        schedule_version INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('seven_day','confirmation','followup','final')),
        due_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('pending','sending','accepted','uncertain','failed','skipped','dry_run')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL DEFAULT 0,
        accepted_at INTEGER,
        meta_message_id TEXT,
        meta_status TEXT,
        last_error TEXT,
        UNIQUE(booking_request_id,schedule_version,kind)
      );
      CREATE INDEX IF NOT EXISTS idx_reminder_due ON reminder_jobs(state,next_attempt_at,due_at);
      CREATE TABLE IF NOT EXISTS reminder_attempts (
        job_id TEXT NOT NULL REFERENCES reminder_jobs(job_id),
        attempt INTEGER NOT NULL,
        attempted_at INTEGER NOT NULL,
        outcome TEXT NOT NULL,
        error TEXT,
        meta_message_id TEXT,
        PRIMARY KEY(job_id,attempt)
      );
      CREATE TABLE IF NOT EXISTS attendance_operations (
        operation_id TEXT PRIMARY KEY,
        booking_request_id TEXT NOT NULL REFERENCES appointment_attendance(booking_request_id),
        schedule_version INTEGER NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('pending','uncertain','confirmed','rejected')),
        desired_title TEXT NOT NULL,
        managed_suffix INTEGER NOT NULL CHECK(managed_suffix IN (0,1)),
        created_at INTEGER NOT NULL,
        last_error TEXT,
        UNIQUE(booking_request_id,schedule_version)
      );
    `);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function insertSchedule(db, row, created, intervals) {
  for (const job of reminderTimes(row.start_ms, created, intervals)) {
    db.prepare(`INSERT OR IGNORE INTO reminder_jobs
      (job_id,booking_request_id,schedule_version,kind,due_at,expires_at,state)
      VALUES (?,?,?,?,?,?,'pending')`).run(randomUUID(), row.booking_request_id, row.schedule_version,
        job.kind, job.due, job.expires);
  }
}

module.exports = { HOUR, GRACE_MS, DEFAULT_INTERVALS, reminderTimes, prepareReminderSchema, insertSchedule };
