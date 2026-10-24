"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DateTime } = require("luxon");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const { createDatabase } = require("./helpers/database.cjs");
const { createCalendarAvailability, verifyBookingAuthorization, READ_SCOPES, BOOKING_SCOPES, tokenPath } = require("../lib/google-calendar");
const { persistAuthorization } = require("../scripts/google-connect");
const { prepareBookingSchema, createBookingService } = require("../lib/booking");

function fixture(filename = ":memory:") {
  const db = createDatabase(filename);
  prepareBookingSchema(db);
  prepareBookingSchema(db);
  for (const business of ["synthetic-a", "synthetic-b"]) {
    for (const sender of ["synthetic-one", "synthetic-two"]) {
      db.prepare("INSERT INTO business_customers VALUES (?,?,?,?,?,?)")
        .run(`${business}-${sender}`, business, sender, "Cliente Sintético", "fixture", "fixture");
    }
  }
  let current = DateTime.fromISO("2026-10-26T09:00:00-06:00");
  const events = new Map(), inserts = [], reads = [], busy = [], controls = {};
  const api = {
    freebusy: { query: async args => {
      if (controls.beforeBusy) await controls.beforeBusy(args.requestBody.items[0].id);
      return { data: { calendars: { [args.requestBody.items[0].id]: { busy } } } };
    } },
    events: {
      insert: async (args, options) => {
        inserts.push({ args, options });
        if (controls.beforeInsert) await controls.beforeInsert(args);
        if (controls.reject) throw Object.assign(new Error("Synthetic insert error"), { code: controls.reject });
        const value = { ...args.requestBody, status: "confirmed" };
        if (controls.foreign) value.extendedProperties = { private: { nukmirisBusinessId: "synthetic-other" } };
        events.set(`${args.calendarId}:${value.id}`, value);
        if (controls.afterStoreError) throw Object.assign(new Error("Synthetic ambiguous response"), { code: controls.afterStoreError });
        return { data: value };
      },
      get: async args => {
        reads.push(args);
        const event = events.get(`${args.calendarId}:${args.eventId}`);
        if (!event) throw Object.assign(new Error("Synthetic missing event"), { code: 404 });
        return { data: event };
      },
    },
  };
  const availability = createCalendarAvailability({ db, getClient: () => api, now: () => current, lookaheadDays: 1 });
  const service = () => createBookingService({ db, availability, enabled: true, getClient: () => api,
    verifyAuthorization: async () => {}, now: () => current });
  const booking = service();
  const context = (requestId, businessId = "synthetic-a", sender = "synthetic-one") => ({ requestId, businessId, sender });
  const intent = ({ businessId = "synthetic-a", sender = "synthetic-one", hour = 10 } = {}) => booking.createIntent({
    businessId, sender, calendarId: `calendar-${businessId}`,
    slot: { start: `2026-10-26T${hour}:00:00.000-06:00`, end: `2026-10-26T${hour + 1}:00:00.000-06:00` },
  });
  return { db, events, inserts, reads, busy, controls, booking, service, context, intent, availability, api,
    setNow: value => { current = DateTime.fromISO(value); } };
}

test("a selection does not write; confirmation creates one owned event on the exact calendar", async () => {
  const f = fixture();
  try {
    const request = f.intent();
    assert.equal(f.inserts.length, 0);
    const result = await f.booking.confirm(f.context(request.requestId));
    assert.equal(result.status, "confirmed");
    assert.equal(f.inserts.length, 1);
    const { args, options } = f.inserts[0];
    assert.equal(args.calendarId, "calendar-synthetic-a");
    assert.equal(args.sendUpdates, "none");
    assert.equal(options.retry, false);
    assert.match(args.requestBody.id, /^[0-9a-f]{64}$/);
    assert.equal(args.requestBody.start.timeZone, "America/Mexico_City");
    assert.equal(args.requestBody.start.dateTime, "2026-10-26T10:00:00.000-06:00");
    assert.equal(args.requestBody.extendedProperties.private.nukmirisBusinessId, "synthetic-a");
    assert.equal(args.requestBody.extendedProperties.private.nukmirisCustomerId, "synthetic-one");
    assert.equal(args.requestBody.extendedProperties.private.nukmirisInternalCustomerId, "synthetic-a-synthetic-one");
    assert.equal(args.requestBody.extendedProperties.private.nukmirisBookingRequestId, request.requestId);
    assert.equal(args.requestBody.attendees, undefined);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 0);
  } finally { f.db.close(); }
});

test("duplicate confirmations and a new service instance reuse the saved outcome", async () => {
  const f = fixture();
  try {
    const request = f.intent(), context = f.context(request.requestId);
    const first = await f.booking.confirm(context);
    assert.equal((await f.booking.confirm(context)).eventId, first.eventId);
    assert.equal((await f.service().confirm(context)).eventId, first.eventId);
    assert.equal(f.inserts.length, 1);
  } finally { f.db.close(); }
});

test("foreign customer/business confirmation IDs cannot read or create an event", async () => {
  const f = fixture();
  try {
    const request = f.intent();
    assert.equal((await f.booking.confirm(f.context(request.requestId, "synthetic-b"))).status, "invalid");
    assert.equal((await f.booking.confirm(f.context(request.requestId, "synthetic-a", "synthetic-two"))).status, "invalid");
    assert.equal(f.inserts.length, 0);
    assert.equal(f.reads.length, 0);
    assert.equal(f.db.prepare("PRAGMA foreign_key_check").all().length, 0);
    assert.throws(() => f.db.prepare("UPDATE booking_requests SET customer_id=? WHERE request_id=?")
      .run("synthetic-b-synthetic-one", request.requestId), /FOREIGN KEY/);
  } finally { f.db.close(); }
});

test("expired confirmations and changed calendar mappings cannot write", async () => {
  const f = fixture();
  try {
    const expired = f.intent();
    f.setNow("2026-10-26T09:16:00-06:00");
    assert.equal((await f.booking.confirm(f.context(expired.requestId))).status, "expired");
    const changed = f.intent();
    f.db.prepare("UPDATE business_calendar_connections SET google_calendar_id=? WHERE business_id=?").run("synthetic-replacement", "synthetic-a");
    assert.equal((await f.booking.confirm(f.context(changed.requestId))).status, "changed");
    assert.equal(f.inserts.length, 0);
  } finally { f.db.close(); }
});

test("a newly busy event, changed duration, or a now-past slot fails the final check", async () => {
  for (const situation of ["busy", "duration", "past"]) {
    const f = fixture();
    try {
      const request = f.intent();
      if (situation === "busy") f.busy.push({ start: request.start, end: request.end });
      if (situation === "duration") f.db.exec("UPDATE business_settings SET appointment_duration_minutes=45 WHERE business_id='synthetic-a'");
      if (situation === "past") f.setNow("2026-10-26T10:01:00-06:00");
      assert(["rejected", "expired"].includes((await f.booking.confirm(f.context(request.requestId))).status));
      assert.equal(f.inserts.length, 0);
      assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 0);
    } finally { f.db.close(); }
  }
});

test("two independent services serialize one calendar and reject an overlap even if FreeBusy lags", async () => {
  const f = fixture();
  let release;
  try {
    const first = f.intent(), second = f.intent({ sender: "synthetic-two" });
    let started;
    const waiting = new Promise(resolve => { started = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    f.controls.beforeBusy = async () => { started(); await gate; };
    const booking = f.booking.confirm(f.context(first.requestId));
    await waiting;
    assert.equal((await f.service().confirm(f.context(second.requestId, "synthetic-a", "synthetic-two"))).status, "busy");
    release(); f.controls.beforeBusy = undefined;
    assert.equal((await booking).status, "confirmed");
    assert.equal((await f.service().confirm(f.context(second.requestId, "synthetic-a", "synthetic-two"))).status, "rejected");
    assert.equal(f.inserts.length, 1);
  } finally { if (release) release(); f.db.close(); }
});

test("back-to-back 10–11 and 11–12 bookings are allowed with zero buffer", async () => {
  const f = fixture();
  try {
    const first = f.intent();
    assert.equal((await f.booking.confirm(f.context(first.requestId))).status, "confirmed");
    const next = f.intent({ sender: "synthetic-two", hour: 11 });
    assert.equal((await f.booking.confirm(f.context(next.requestId, "synthetic-a", "synthetic-two"))).status, "confirmed");
    assert.equal(f.inserts.length, 2);
  } finally { f.db.close(); }
});

test("different business calendars can book concurrently without sharing locks or identities", async () => {
  const f = fixture();
  try {
    const a = f.intent(), b = f.intent({ businessId: "synthetic-b" });
    const results = await Promise.all([f.booking.confirm(f.context(a.requestId)), f.service().confirm(f.context(b.requestId, "synthetic-b"))]);
    assert(results.every(value => value.status === "confirmed"));
    assert.deepEqual(new Set(f.inserts.map(call => call.args.calendarId)), new Set(["calendar-synthetic-a", "calendar-synthetic-b"]));
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 0);
  } finally { f.db.close(); }
});

test("No, a superseding offer, and Menu invalidation never create an event", async () => {
  const f = fixture();
  try {
    const declined = f.intent();
    assert.equal(f.booking.decline(f.context(declined.requestId)).status, "declined");
    assert.equal((await f.booking.confirm(f.context(declined.requestId))).status, "declined");
    const old = f.intent();
    const replacement = f.intent({ hour: 11 });
    assert.equal((await f.booking.confirm(f.context(old.requestId))).status, "declined");
    f.booking.invalidateOffers({ businessId: "synthetic-a", sender: "synthetic-one" });
    assert.equal((await f.booking.confirm(f.context(replacement.requestId))).status, "declined");
    assert.equal(f.inserts.length, 0);
  } finally { f.db.close(); }
});

test("a lost insert response is recovered by owned event ID rather than inserting again", async () => {
  const f = fixture();
  try {
    const request = f.intent();
    f.controls.afterStoreError = 503;
    assert.equal((await f.booking.confirm(f.context(request.requestId))).status, "confirmed");
    assert.equal((await f.service().confirm(f.context(request.requestId))).status, "confirmed");
    assert.equal(f.inserts.length, 1);
    assert.equal(f.reads.length, 1);
  } finally { f.db.close(); }
});

test("an unresolved insert keeps its durable lock across service restarts and cannot be blindly repeated", async () => {
  const f = fixture();
  try {
    const request = f.intent();
    f.controls.reject = "ETIMEDOUT";
    assert.equal((await f.booking.confirm(f.context(request.requestId))).status, "uncertain");
    assert.equal((await f.service().confirm(f.context(request.requestId))).status, "uncertain");
    const other = f.intent({ sender: "synthetic-two", hour: 11 });
    assert.equal((await f.service().confirm(f.context(other.requestId, "synthetic-a", "synthetic-two"))).status, "busy");
    assert.equal(f.inserts.length, 1);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 1);
    const sent = f.inserts[0].args;
    f.events.set(`${sent.calendarId}:${sent.requestBody.id}`, { ...sent.requestBody, status: "confirmed" });
    assert.equal((await f.service().reconcile(f.context(request.requestId))).status, "confirmed");
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 0);
    assert.equal(f.inserts.length, 1);
  } finally { f.db.close(); }
});

test("a mismatched event returned by Google is never accepted or overwritten", async () => {
  const f = fixture();
  try {
    const request = f.intent();
    f.controls.foreign = true;
    assert.equal((await f.booking.confirm(f.context(request.requestId))).status, "uncertain");
    assert.equal((await f.booking.reconcile(f.context(request.requestId))).status, "uncertain");
    assert.equal(f.inserts.length, 1);
  } finally { f.db.close(); }
});

test("definite permission rejection releases the calendar without claiming confirmation", async () => {
  const f = fixture();
  try {
    const request = f.intent();
    f.controls.reject = 403;
    assert.equal((await f.booking.confirm(f.context(request.requestId))).status, "rejected");
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 0);
    assert.equal(f.events.size, 0);
  } finally { f.db.close(); }
});

test("a disabled service cannot create an intent or write even with an injected client", async () => {
  const f = fixture();
  try {
    const disabled = createBookingService({ db: f.db, availability: f.availability, getClient: () => { throw new Error("must not load"); } });
    assert.throws(() => disabled.createIntent({}), /disabled/);
    assert.equal((await disabled.confirm(f.context("synthetic-request"))).status, "disabled");
    assert.equal(f.inserts.length, 0);
  } finally { f.db.close(); }
});

test("booking authorization is checked against actual Google token scopes", async () => {
  let checks = 0;
  const auth = scopes => ({ getAccessToken: async () => ({ token: "synthetic-access" }), getTokenInfo: async token => {
    checks++; assert.equal(token, "synthetic-access"); return { scopes };
  } });
  await assert.rejects(verifyBookingAuthorization(() => auth(READ_SCOPES)), /permission is missing/);
  await verifyBookingAuthorization(() => auth(["https://www.googleapis.com/auth/calendar.events"]));
  await verifyBookingAuthorization(() => auth(["https://www.googleapis.com/auth/calendar"]));
  assert.equal(checks, 3);
});

test("separate SQLite connections share the booking lock and the result survives closing and reopening the database", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-booking-disk-"));
  const filename = path.join(directory, "synthetic.sqlite");
  const f = fixture(filename);
  let second = new DatabaseSync(filename), reopened;
  let release, closed = false;
  try {
    const build = db => createBookingService({ db, enabled: true, getClient: () => f.api, verifyAuthorization: async () => {},
      now: () => DateTime.fromISO("2026-10-26T09:00:00-06:00"),
      availability: createCalendarAvailability({ db, getClient: () => f.api, now: () => DateTime.fromISO("2026-10-26T09:00:00-06:00"), lookaheadDays: 1 }) });
    const first = f.intent(), other = f.intent({ sender: "synthetic-two" });
    let signal;
    const started = new Promise(resolve => { signal = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    f.controls.beforeBusy = async () => { signal(); await held; };
    const pending = f.booking.confirm(f.context(first.requestId));
    await started;
    assert.equal((await build(second).confirm(f.context(other.requestId, "synthetic-a", "synthetic-two"))).status, "busy");
    release(); f.controls.beforeBusy = undefined;
    assert.equal((await pending).status, "confirmed");
    second.close(); second = undefined; f.db.close(); closed = true;
    reopened = new DatabaseSync(filename);
    assert.equal((await build(reopened).confirm(f.context(first.requestId))).status, "confirmed");
    assert.equal(f.inserts.length, 1);
  } finally {
    if (release) release(); if (second) second.close(); if (reopened) reopened.close(); if (!closed) f.db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("booking schema preparation creates a recoverable backup and preserves the verified availability data", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-booking-prepare-"));
  try {
    const filename = path.join(directory, "synthetic.sqlite");
    const source = createDatabase(filename);
    const settingsBefore = JSON.stringify(source.prepare("SELECT * FROM business_settings ORDER BY business_id").all());
    const mapsBefore = JSON.stringify(source.prepare("SELECT * FROM business_calendar_connections ORDER BY business_id").all());
    source.close();
    for (let run = 0; run < 2; run++) {
      const result = spawnSync(process.execPath, [path.resolve(__dirname, "../scripts/prepare-booking.js")], {
        env: { NODE_ENV: "test", NUKMIRIS_DB_PATH: filename }, encoding: "utf8", timeout: 10000,
      });
      assert.equal(result.status, 0, result.stderr);
    }
    const backups = fs.readdirSync(directory).filter(name => name.endsWith(".bak"));
    assert.equal(backups.length, 2);
    const current = new DatabaseSync(filename, { readOnly: true });
    try {
      assert.equal(JSON.stringify(current.prepare("SELECT * FROM business_settings ORDER BY business_id").all()), settingsBefore);
      assert.equal(JSON.stringify(current.prepare("SELECT * FROM business_calendar_connections ORDER BY business_id").all()), mapsBefore);
      assert.equal(current.prepare("SELECT COUNT(*) AS n FROM booking_requests").get().n, 0);
    } finally { current.close(); }
    for (const file of backups) {
      const backup = new DatabaseSync(path.join(directory, file), { readOnly: true });
      try { assert.equal(JSON.stringify(backup.prepare("SELECT * FROM business_settings ORDER BY business_id").all()), settingsBefore); }
      finally { backup.close(); }
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("booking permission cannot overwrite a cache when Google grants only read access", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-booking-auth-"));
  try {
    const credentials = path.join(directory, "synthetic-credentials.json");
    const destination = path.join(directory, "synthetic-booking-token.json");
    fs.writeFileSync(credentials, JSON.stringify({ installed: { client_id: "synthetic", client_secret: "synthetic" } }));
    fs.writeFileSync(destination, "preserve-existing-authorization");
    assert.throws(() => persistAuthorization({ credentials: { scope: READ_SCOPES.join(" "), refresh_token: "synthetic" } },
      credentials, destination, BOOKING_SCOPES), /did not grant/);
    assert.equal(fs.readFileSync(destination, "utf8"), "preserve-existing-authorization");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("the optional booking authorization cannot use the verified read-only token path", () => {
  const beforeRead = process.env.GOOGLE_OAUTH_TOKEN_PATH, beforeBooking = process.env.GOOGLE_BOOKING_TOKEN_PATH;
  try {
    process.env.GOOGLE_OAUTH_TOKEN_PATH = "synthetic/same-token.json";
    process.env.GOOGLE_BOOKING_TOKEN_PATH = "synthetic/same-token.json";
    assert.throws(() => tokenPath({ booking: true }), /separate file/);
  } finally {
    if (beforeRead === undefined) delete process.env.GOOGLE_OAUTH_TOKEN_PATH; else process.env.GOOGLE_OAUTH_TOKEN_PATH = beforeRead;
    if (beforeBooking === undefined) delete process.env.GOOGLE_BOOKING_TOKEN_PATH; else process.env.GOOGLE_BOOKING_TOKEN_PATH = beforeBooking;
  }
});
