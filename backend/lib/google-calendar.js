"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { google } = require("googleapis");
const { DateTime } = require("luxon");
const { readBusinessSettings } = require("./business-config");
const { findAvailableSlots } = require("./availability");

const READ_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

function tokenPath() {
  return path.resolve(__dirname, "..", process.env.GOOGLE_OAUTH_TOKEN_PATH || ".local/google-token.json");
}

function loadCalendarClient() {
  const filename = tokenPath();
  if (!fs.existsSync(filename)) throw new Error("Google authorization is missing. Run npm run google:connect on your PC");
  const saved = JSON.parse(fs.readFileSync(filename, "utf8"));
  if (saved.type !== "authorized_user" || !saved.client_id || !saved.client_secret || !saved.refresh_token) {
    throw new Error("Google token file is incomplete. Reauthorize locally with npm run google:connect -- --reauthorize");
  }
  return google.calendar({ version: "v3", auth: google.auth.fromJSON(saved) });
}

function createCalendarAvailability({ db, getClient = loadCalendarClient, now = () => DateTime.now(), lookaheadDays = 14 }) {
  if (!Number.isInteger(lookaheadDays) || lookaheadDays < 1 || lookaheadDays > 90) throw new Error("Lookahead must be between 1 and 90 days");
  let client;
  async function calendar() { return client || (client = await getClient()); }
  function configuration(businessId) {
    const mapping = db.prepare("SELECT google_calendar_id FROM business_calendar_connections WHERE business_id=?").get(businessId);
    if (!mapping?.google_calendar_id || mapping.google_calendar_id === "primary") throw new Error("An explicit business calendar mapping is required");
    return { calendarId: mapping.google_calendar_id, settings: readBusinessSettings(db, businessId) };
  }
  async function listSlots(businessId) {
    const { calendarId, settings } = configuration(businessId);
    const current = now().setZone(settings.timeZone);
    const api = await calendar();
    const result = await api.freebusy.query({ requestBody: {
      timeMin: current.minus({ minutes: settings.bufferMinutes }).toISO(),
      timeMax: current.plus({ days: lookaheadDays }).toISO(),
      timeZone: settings.timeZone, items: [{ id: calendarId }],
    } });
    const selected = result.data.calendars?.[calendarId];
    if (!selected || selected.errors?.length || !Array.isArray(selected.busy)) throw new Error("The selected Google Calendar could not be checked");
    return findAvailableSlots({ settings, busyPeriods: selected.busy, now: current, lookaheadDays });
  }
  async function verify(businessId) {
    const { calendarId } = configuration(businessId);
    const api = await calendar();
    const result = await api.calendarList.get({ calendarId });
    if (!result.data?.id || result.data.id !== calendarId || !["owner", "writer"].includes(result.data.accessRole)) {
      throw new Error("The selected business calendar requires owner or writer access");
    }
    await listSlots(businessId);
    return { businessId, calendarName: result.data.summary || "Selected calendar" };
  }
  return { listSlots, verify, configuration };
}

module.exports = { READ_SCOPES, tokenPath, loadCalendarClient, createCalendarAvailability };
