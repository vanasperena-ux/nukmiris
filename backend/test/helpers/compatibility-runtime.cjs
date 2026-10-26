"use strict";
// Real webhook subprocess; every provider boundary below is synthetic.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { mock } = require("node:test");
const directory = process.env.SYNTHETIC_COMPATIBILITY_DIRECTORY;
const file = name => path.join(directory, name);
const read = name => JSON.parse(fs.readFileSync(file(name), "utf8"));
const append = (name, value) => fs.appendFileSync(file(name), JSON.stringify(value) + "\n");
const error = code => Object.assign(new Error("Synthetic provider failure"), { code });
mock.method(Date, "now", () => Date.parse("2026-10-26T09:00:00-06:00"));
function forbidden(boundary) {
  append("calls.jsonl", { method: "FORBIDDEN", boundary });
  throw new Error(`Forbidden integration: ${boundary}`);
}
function record(method, args) {
  const calendarId = args.calendarId || args.requestBody?.items?.[0]?.id;
  if (!["calendar-synthetic-a", "calendar-synthetic-b"].includes(calendarId)) return forbidden("unscoped or primary Calendar");
  append("calls.jsonl", { method, calendarId, eventId: args.eventId || args.requestBody?.id });
}
function get(args) {
  const code = read("controls.json").getError;
  if (code) throw error(code);
  const event = read("calendar.json")[`${args.calendarId}:${args.eventId}`];
  if (!event) throw error(404);
  return event;
}
const google = require("googleapis").google;
const { BOOKING_SCOPES } = require("../../lib/google-calendar");
mock.method(google.auth, "fromJSON", saved => {
  assert.equal(saved.client_id, "synthetic-compatibility");
  return { getAccessToken: async () => ({ token: "synthetic" }), getTokenInfo: async () => ({ scopes: BOOKING_SCOPES }) };
});
mock.method(google, "calendar", () => ({
  calendarList: { get: async args => {
    record("calendar_access", args);
    return { data: { id: args.calendarId, summary: "Synthetic calendar", accessRole: "writer" } };
  } },
  freebusy: { query: async args => {
    record("freebusy", args);
    const id = args.requestBody.items[0].id;
    const busy = Object.values(read("calendar.json")).filter(event => event.calendarId === id && event.status !== "cancelled")
      .map(event => ({ start: event.start.dateTime, end: event.end.dateTime }));
    return { data: { calendars: { [id]: { busy } } } };
  } },
  events: {
    get: async args => { record("get", args); return { data: get(args) }; },
    list: async args => {
      record("list", args);
      return { data: { items: Object.values(read("calendar.json")).filter(event => event.calendarId === args.calendarId) } };
    },
    insert: async (args, options) => {
      record("insert", args); assert.equal(options.retry, false);
      const store = read("calendar.json"), key = `${args.calendarId}:${args.requestBody.id}`;
      if (store[key]) throw error(409);
      const event = { ...args.requestBody, calendarId: args.calendarId, status: "confirmed", etag: '"synthetic-created"' };
      store[key] = event; fs.writeFileSync(file("calendar.json"), JSON.stringify(store));
      if (read("controls.json").afterInsertError) throw error(read("controls.json").afterInsertError);
      return { data: event };
    },
    patch: async (args, options) => {
      record("patch", args); assert.equal(options.retry, false);
      const original = get(args);
      assert.equal(options.headers["If-Match"], original.etag);
      const event = { ...original, ...args.requestBody, etag: '"synthetic-moved"' };
      const store = read("calendar.json"); store[`${args.calendarId}:${args.eventId}`] = event;
      fs.writeFileSync(file("calendar.json"), JSON.stringify(store));
      if (read("controls.json").afterPatchReadError) fs.writeFileSync(file("controls.json"), JSON.stringify({ getError: 503 }));
      if (read("controls.json").getError) throw error(503);
      if (read("controls.json").afterPatchError) throw error(read("controls.json").afterPatchError);
      return { data: event };
    },
    delete: async (args, options) => {
      record("delete", args); assert.equal(options.retry, false);
      assert.equal(options.headers["If-Match"], get(args).etag);
      const store = read("calendar.json");
      store[`${args.calendarId}:${args.eventId}`] = { id: args.eventId, calendarId: args.calendarId, status: "cancelled" };
      fs.writeFileSync(file("calendar.json"), JSON.stringify(store));
      return { data: "" };
    },
  },
}));
mock.method(require("@google-cloud/local-auth"), "authenticate", () => forbidden("legacy OAuth"));
for (const transport of [require("node:http"), require("node:https")]) {
  mock.method(transport, "request", () => forbidden("outbound HTTP(S)"));
  mock.method(transport, "get", () => forbidden("outbound HTTP(S) get"));
}
mock.method(globalThis, "fetch", async (url, options) => {
  if (!/^https:\/\/graph\.facebook\.com\/v26\.0\/(phone-synthetic-[ab]|synthetic-development-channel)\/messages$/.test(String(url))) return forbidden("unexpected fetch");
  assert.equal(options.method, "POST");
  const payload = JSON.parse(options.body);
  if (!["text", "interactive"].includes(payload.type)) return forbidden("proactive template send");
  append("sent.jsonl", { url: String(url), payload });
  const count = fs.readFileSync(file("sent.jsonl"), "utf8").trim().split("\n").length;
  return new Response(JSON.stringify({ messages: [{ id: `synthetic-meta-${count}` }] }), { status: 200 });
});
const runtime = require("../../whatsapp-webhook.js");
let server;
process.on("message", async message => {
  if (message.barrier) {
    // Mock calls resolve in microtasks; two event-loop turns also drain the
    // non-durable webhook's per-customer Promise chain before acknowledging.
    setImmediate(() => setImmediate(() => process.send({ barrier: message.barrier })));
  } else if (message.stop) {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await runtime.close();
    process.disconnect();
  }
});
runtime.start().then(value => {
  server = value;
  const ready = () => process.send({ ready: true, port: server.address().port });
  if (server.listening) ready(); else server.once("listening", ready);
}).catch(error => { console.error(error); process.exitCode = 1; process.disconnect(); });
