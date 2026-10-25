"use strict";
// Real subprocess recovery fixture. All external services are local file mocks.
const fs = require("node:fs"), path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createCalendarAvailability } = require("../../lib/google-calendar");
const { createReliableDelivery } = require("../../lib/reliable-delivery");
const { createAppointmentReminders } = require("../../lib/appointment-reminders");
const directory = process.env.SYNTHETIC_REMINDER_DIRECTORY;
const clock = Number(process.env.SYNTHETIC_REMINDER_CLOCK);
const storeFile = path.join(directory, "events.json"), callsFile = path.join(directory, "calls.jsonl");
const db = new DatabaseSync(path.join(directory, "synthetic.sqlite"));
function pause(phase) {
  if (process.env.SYNTHETIC_REMINDER_CRASH !== phase) return;
  fs.writeFileSync(path.join(directory, "paused"), phase);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}
function read() { return JSON.parse(fs.readFileSync(storeFile, "utf8")); }
function record(kind) { fs.appendFileSync(callsFile, JSON.stringify({ kind }) + "\n"); }
const api = { events: {
  get: async ({ calendarId, eventId }) => {
    const event = read()[`${calendarId}:${eventId}`];
    if (!event) throw Object.assign(new Error("Synthetic missing event"), { code: 404 });
    return { data: event };
  },
  patch: async (args, options) => {
    const store = read(), key = `${args.calendarId}:${args.eventId}`, event = store[key];
    if (event.etag !== options.headers["If-Match"]) throw Object.assign(new Error("Synthetic changed event"), { code: 412 });
    record("patch");
    store[key] = { ...event, ...args.requestBody, etag: '"synthetic-confirmed"' };
    fs.writeFileSync(storeFile, JSON.stringify(store));
    pause("calendar");
    return { data: store[key] };
  },
} };
const availability = createCalendarAvailability({ db, getClient: () => api });
const reminders = createAppointmentReminders({ db, availability, mode: "live", now: () => clock, getClient: () => api,
  verifyTemplate: async () => {}, send: async () => { record("send"); pause("meta"); return { state: "accepted", metaMessageId: "synthetic-child-message" }; },
});
const delivery = createReliableDelivery({ db, capabilities: "synthetic", resolveBusiness: () => null });
delivery.acquire(); reminders.recover();
process.on("message", async message => {
  try {
    if (message.action === "stop") { delivery.release(); db.close(); process.exit(0); }
    const result = message.action === "tick" ? await reminders.tick()
      : await reminders.confirm(message.context, message.token);
    process.send({ done: message.id, result });
  } catch (error) { process.send({ done: message.id, error: error.message }); }
});
process.send({ ready: true });
