"use strict";

// Preload for real CLI subprocess tests. Every Calendar response is synthetic;
// any unexpected network request, Calendar write or WhatsApp send fails.
const fs = require("node:fs");
const path = require("node:path");
const { mock } = require("node:test");
const { google } = require("googleapis");
const directory = process.env.SYNTHETIC_RECONCILIATION_DIRECTORY;
if (!directory) throw new Error("Synthetic reconciliation directory required");
const clock = Number(process.env.SYNTHETIC_RECONCILIATION_NOW);
if (!Number.isSafeInteger(clock)) throw new Error("Synthetic reconciliation clock required");
mock.method(Date, "now", () => clock);
const record = kind => fs.appendFileSync(path.join(directory, "calls.jsonl"), JSON.stringify({ kind }) + "\n");
const forbidden = kind => () => { record(kind); throw new Error(`Forbidden synthetic operation: ${kind}`); };
mock.method(globalThis, "fetch", forbidden("network_fetch"));
mock.method(require("node:http"), "request", forbidden("network_http"));
mock.method(require("node:https"), "request", forbidden("network_https"));
mock.method(google.auth, "fromJSON", () => ({}));
mock.method(google, "calendar", () => ({
  events: {
    get: async ({ calendarId, eventId }) => {
      record("calendar_get");
      const store = JSON.parse(fs.readFileSync(path.join(directory, "calendar.json"), "utf8"));
      if (store.error) throw Object.assign(new Error("Synthetic read failure"), { code: store.error });
      const event = store.events[`${calendarId}:${eventId}`];
      if (!event) throw Object.assign(new Error("Synthetic missing event"), { code: 404 });
      return { data: event };
    },
    insert: forbidden("calendar_insert"), patch: forbidden("calendar_patch"), delete: forbidden("calendar_delete"),
    list: forbidden("calendar_list"),
  },
  freebusy: { query: forbidden("calendar_freebusy") },
  calendarList: { get: forbidden("calendar_list_get"), list: forbidden("calendar_list_all") },
}));
