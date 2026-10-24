"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DateTime } = require("luxon");
const { createHmac } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const { createDatabase, settings } = require("./helpers/database.cjs");
const { createCalendarAvailability } = require("../lib/google-calendar");
const { saveBusinessConfiguration, readBusinessSettings } = require("../lib/business-config");
const { validMetaSignature } = require("../lib/meta-signature");
const { checkMeta, listWritableCalendars } = require("../lib/connection-checks");
const { persistAuthorization } = require("../scripts/google-connect");

test("Meta signatures authenticate exact UTF-8 bytes and reject missing, invalid, and changed bodies", () => {
  const body = Buffer.from('{ "mensaje": "Mañana a las 11" }');
  const signature = "sha256=" + createHmac("sha256", "synthetic-secret").update(body).digest("hex");
  assert(validMetaSignature(body, signature, "synthetic-secret"));
  assert(!validMetaSignature(Buffer.from('{"mensaje":"Mañana a las 11"}'), signature, "synthetic-secret"));
  for (const candidate of [undefined, "", "sha256=oops", "sha256=" + "0".repeat(64)]) assert(!validMetaSignature(body, candidate, "synthetic-secret"));
  assert(!validMetaSignature(body, signature, "wrong-secret"));
});

test("calendar lookup queries only the mapped business calendar and uses confirmed hours", async () => {
  const db = createDatabase();
  try {
    const calls = [];
    const api = { freebusy: { query: async args => {
      calls.push(args.requestBody);
      const id = args.requestBody.items[0].id;
      return { data: { calendars: { [id]: { busy: [{ start: "2026-10-26T10:00:00-06:00", end: "2026-10-26T11:00:00-06:00" }] } } } };
    } } };
    const service = createCalendarAvailability({ db, getClient: () => api, now: () => DateTime.fromISO("2026-10-26T09:00:00-06:00"), lookaheadDays: 1 });
    const slots = await service.listSlots("synthetic-b");
    assert.deepEqual(calls[0].items, [{ id: "calendar-synthetic-b" }]);
    assert.equal(calls[0].timeZone, "America/Mexico_City");
    assert(slots.some(slot => slot.start.includes("T11:00:00")));
    assert(!slots.some(slot => slot.start.includes("T10:00:00")));
    assert(slots.length > 3);
  } finally { db.close(); }
});

test("failed or incomplete Google availability is an error, never an empty/free calendar", async () => {
  for (const selected of [undefined, { errors: [{ reason: "notFound" }] }, {}]) {
    const db = createDatabase();
    try {
      const service = createCalendarAvailability({ db, getClient: () => ({ freebusy: { query: async () => ({ data: { calendars: { "calendar-synthetic-a": selected } } }) } }) });
      await assert.rejects(service.listSlots("synthetic-a"), /could not be checked/);
    } finally { db.close(); }
  }
});

test("calendar readiness verifies the exact calendar and access role before use", async () => {
  const db = createDatabase();
  try {
    const client = { calendarList: { get: async ({ calendarId }) => ({ data: { id: calendarId, accessRole: "reader" } }) } };
    const service = createCalendarAvailability({ db, getClient: () => client });
    await assert.rejects(service.verify("synthetic-a"), /owner or writer/);
    db.prepare("DELETE FROM business_calendar_connections WHERE business_id=?").run("synthetic-a");
    await assert.rejects(service.listSlots("synthetic-a"), /explicit business calendar/);
  } finally { db.close(); }
});

test("business configuration keeps other businesses intact and refuses conflicting mappings", () => {
  const db = createDatabase();
  try {
    const before = readBusinessSettings(db, "synthetic-b");
    saveBusinessConfiguration(db, { businessId: "synthetic-a", calendarId: "calendar-synthetic-a", phoneNumberId: "phone-synthetic-a", settings: { ...settings, closingTime: "18:00" } });
    assert.equal(readBusinessSettings(db, "synthetic-a").closingTime, "18:00");
    assert.deepEqual(readBusinessSettings(db, "synthetic-b"), before);
    assert.throws(() => saveBusinessConfiguration(db, { businessId: "synthetic-a", calendarId: "calendar-synthetic-b", phoneNumberId: "phone-synthetic-a", settings }), /mapping differs/);
    assert.equal(readBusinessSettings(db, "synthetic-a").closingTime, "18:00");
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally { db.close(); }
});

test("Meta connectivity check uses the configured sender and authorization header without sending a message", async () => {
  let called;
  await checkMeta({ token: "synthetic-token", phoneNumberId: "synthetic-phone", request: async (url, options) => {
    called = { url, options }; return { ok: true, json: async () => ({ id: "synthetic-phone" }) };
  } });
  assert(called.url.endsWith("/synthetic-phone?fields=id"));
  assert.equal(called.options.method, undefined);
  assert.equal(called.options.headers.Authorization, "Bearer synthetic-token");
  await assert.rejects(checkMeta({ token: "synthetic-token", phoneNumberId: "synthetic-phone", request: async () => ({ ok: false, status: 401 }) }), /HTTP 401/);
});

test("calendar discovery follows pagination and excludes calendars without write access", async () => {
  const calls = [];
  const values = await listWritableCalendars({ calendarList: { list: async args => {
    calls.push(args);
    return args.pageToken ? { data: { items: [{ id: "synthetic-b", summary: "B", accessRole: "writer" }] } }
      : { data: { items: [{ id: "synthetic-a", summary: "A", accessRole: "owner" }, { id: "synthetic-readonly", accessRole: "reader" }], nextPageToken: "next" } };
  } } });
  assert.deepEqual(values.map(value => value.id), ["synthetic-a", "synthetic-b"]);
  assert.equal(calls[1].pageToken, "next");
});

test("OAuth authorization is stored only in the specified local file and keeps a reusable token", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-auth-fixture-"));
  try {
    const credentials = path.join(directory, "synthetic-credentials.json");
    const destination = path.join(directory, "local", "synthetic-token.json");
    fs.writeFileSync(credentials, JSON.stringify({ installed: { client_id: "synthetic-client", client_secret: "synthetic-secret" } }));
    persistAuthorization({ credentials: { refresh_token: "synthetic-refresh" } }, credentials, destination);
    const saved = JSON.parse(fs.readFileSync(destination));
    assert.equal(saved.type, "authorized_user");
    assert.equal(saved.refresh_token, "synthetic-refresh");
    persistAuthorization({ credentials: {} }, credentials, destination);
    assert.equal(JSON.parse(fs.readFileSync(destination)).refresh_token, "synthetic-refresh");
    if (process.platform !== "win32") assert.equal(fs.statSync(destination).mode & 0o077, 0);
    assert.equal(fs.readdirSync(path.dirname(destination)).length, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("the PC configuration command backs up the old settings before updating only the selected business", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-config-fixture-"));
  try {
    const filename = path.join(directory, "synthetic.sqlite");
    const db = createDatabase(filename);
    db.close();
    const config = path.join(directory, "synthetic-settings.json");
    fs.writeFileSync(config, JSON.stringify({ businessId: "synthetic-a", settings: { ...settings, closingTime: "18:00" } }));
    const result = spawnSync(process.execPath, [path.resolve(__dirname, "../scripts/configure-business.js")], {
      env: { NODE_ENV: "test", NUKMIRIS_DB_PATH: filename, NUKMIRIS_SETTINGS_PATH: config,
        GOOGLE_CALENDAR_ID: "calendar-synthetic-a", WHATSAPP_PHONE_NUMBER_ID: "phone-synthetic-a" },
      encoding: "utf8", timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    const backups = fs.readdirSync(directory).filter(name => name.endsWith(".bak"));
    assert.equal(backups.length, 1);
    const original = new DatabaseSync(path.join(directory, backups[0]), { readOnly: true });
    const updated = new DatabaseSync(filename, { readOnly: true });
    try {
      assert.equal(readBusinessSettings(original, "synthetic-a").closingTime, "19:00");
      assert.equal(readBusinessSettings(updated, "synthetic-a").closingTime, "18:00");
      assert.deepEqual(readBusinessSettings(updated, "synthetic-b"), readBusinessSettings(original, "synthetic-b"));
    } finally { original.close(); updated.close(); }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
