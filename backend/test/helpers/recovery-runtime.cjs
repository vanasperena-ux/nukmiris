"use strict";
// Disposable subprocess fixture: no real credentials, calendars, or messages.
const fs = require("node:fs");
const { mock } = require("node:test");
const { DateTime } = require("luxon");
const directory = process.env.SYNTHETIC_RECOVERY_DIRECTORY;
const path = require("node:path");
const storeFile = path.join(directory, "synthetic-calendar.json");
const sentFile = path.join(directory, "synthetic-meta.jsonl");
const callsFile = path.join(directory, "synthetic-calendar-calls.jsonl");
const pauseFile = path.join(directory, "synthetic-paused.json");
let phase = "";
const clock = DateTime.fromISO("2026-10-26T09:00:00-06:00").toMillis();
mock.method(Date, "now", () => clock);
process.on("message", value => { if (value?.phase) { phase = value.phase; process.send({ configured: phase }); } });
function pause(at) {
  if (phase !== at) return;
  fs.writeFileSync(pauseFile, JSON.stringify({ phase: at }));
  // Parent forcibly terminates this real process. This is test-only code and
  // also works on Windows without relying on Unix-only process suspension.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}
function readStore() { return JSON.parse(fs.readFileSync(storeFile, "utf8")); }
function saveStore(value) { fs.writeFileSync(storeFile, JSON.stringify(value)); }
function apiError(code) { return Object.assign(new Error("Synthetic Calendar error"), { code }); }
function record(method, args) { fs.appendFileSync(callsFile, JSON.stringify({ method, calendarId: args.calendarId, eventId: args.eventId || args.requestBody?.id }) + "\n"); }
const google = require("googleapis").google;
const { BOOKING_SCOPES } = require("../../lib/google-calendar");
mock.method(google.auth, "fromJSON", () => ({ getAccessToken: async () => ({ token: "synthetic" }), getTokenInfo: async () => ({ scopes: BOOKING_SCOPES }) }));
mock.method(google, "calendar", () => ({
  calendarList: { get: async ({ calendarId }) => ({ data: { id: calendarId, summary: "Synthetic calendar", accessRole: "writer" } }) },
  freebusy: { query: async ({ requestBody }) => {
    const id = requestBody.items[0].id;
    const busy = Object.values(readStore()).filter(event => event.calendarId === id && event.status !== "cancelled")
      .map(event => ({ start: event.start.dateTime, end: event.end.dateTime }));
    return { data: { calendars: { [id]: { busy } } } };
  } },
  events: {
    get: async args => { record("get", args); const event = readStore()[`${args.calendarId}:${args.eventId}`]; if (!event) throw apiError(404); return { data: event }; },
    list: async args => ({ data: { items: Object.values(readStore()).filter(event => event.calendarId === args.calendarId) } }),
    insert: async (args, options) => {
      if (options.retry !== false) throw new Error("SDK retries must be disabled");
      record("insert", args);
      const store = readStore(), key = `${args.calendarId}:${args.requestBody.id}`;
      if (store[key]) throw apiError(409);
      const event = { ...args.requestBody, calendarId: args.calendarId, etag: '"synthetic-insert"', status: "confirmed" };
      store[key] = event; saveStore(store); pause("after_calendar_insert"); return { data: event };
    },
    patch: async (args, options) => {
      record("patch", args); const store = readStore(), key = `${args.calendarId}:${args.eventId}`, original = store[key];
      if (!original) throw apiError(404);
      if (options.headers["If-Match"] !== original.etag) throw apiError(412);
      const event = { ...original, ...args.requestBody, etag: '"synthetic-move"' };
      store[key] = event; saveStore(store); pause("after_calendar_patch"); return { data: event };
    },
    delete: async (args, options) => {
      record("delete", args); const store = readStore(), key = `${args.calendarId}:${args.eventId}`, original = store[key];
      if (!original) throw apiError(404);
      if (options.headers["If-Match"] !== original.etag) throw apiError(412);
      store[key] = { id: original.id, calendarId: args.calendarId, status: "cancelled" };
      saveStore(store); pause("after_calendar_delete"); return { data: "" };
    },
  },
}));
mock.method(require("node:https"), "request", () => { throw new Error("External HTTPS forbidden in recovery fixture"); });
mock.method(require("@google-cloud/local-auth"), "authenticate", () => { throw new Error("Live OAuth forbidden"); });
mock.method(globalThis, "fetch", async (url, options) => {
  if (!/^https:\/\/graph\.facebook\.com\/v26\.0\/phone-synthetic-[ab]\/messages$/.test(String(url))) throw new Error("Unexpected external request");
  const payload = JSON.parse(options.body);
  fs.appendFileSync(sentFile, JSON.stringify({ payload }) + "\n");
  pause("after_meta_accept");
  const count = fs.readFileSync(sentFile, "utf8").trim().split("\n").length;
  return new Response(JSON.stringify({ messages: [{ id: `synthetic-meta-${count}` }] }), { status: 200 });
});
const reliable = require("../../lib/reliable-delivery");
const originalFactory = reliable.createReliableDelivery;
mock.method(reliable, "createReliableDelivery", options => {
  const delivery = originalFactory(options);
  return { ...delivery, outputs(...args) { pause("after_local_state"); const result = delivery.outputs(...args); pause("after_outbox_commit"); return result; } };
});
const originalWorker = reliable.createDeliveryWorker;
mock.method(reliable, "createDeliveryWorker", options => originalWorker({ ...options, handle: async input => {
  if (phase === "before_handle") {
    fs.writeFileSync(pauseFile, JSON.stringify({ phase }));
    await new Promise(() => {});
  }
  return options.handle(input);
} }));
const runtime = require("../../whatsapp-webhook.js");
runtime.start().then(server => {
  const ready = () => process.send({ ready: true, port: server.address().port });
  if (server.listening) ready(); else server.once("listening", ready);
});
