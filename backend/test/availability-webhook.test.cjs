"use strict";
const { describe, test, before, beforeEach, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { createHmac, randomUUID } = require("node:crypto");
const { createDatabase } = require("./helpers/database.cjs");
const { DateTime } = require("luxon");
const nativeFetch = globalThis.fetch;
const secret = "synthetic-signing-secret";
const sender = "same-synthetic-customer";

describe("signed WhatsApp calendar availability", { concurrency: false }, () => {
  let directory, db, runtime, server, origin;
  const outgoing = [];
  const calendarCalls = [];
  const changes = [];
  const busy = {};
  const originals = new Map();
  let gate, failNextLookup = false, failAtLookup;
  before(async () => {
    const checkpoint = DateTime.fromISO("2026-10-26T09:00:00-06:00").toMillis();
    mock.method(Date, "now", () => checkpoint);
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-availability-test-"));
    const dbPath = path.join(directory, "synthetic.sqlite");
    db = createDatabase(dbPath);
    const token = path.join(directory, "synthetic-token.json");
    fs.writeFileSync(token, JSON.stringify({ type: "authorized_user", client_id: "synthetic", client_secret: "synthetic", refresh_token: "synthetic" }));
    for (const [name, value] of Object.entries({
      NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", NUKMIRIS_DB_PATH: dbPath,
      NUKMIRIS_MODE: "availability", NUKMIRIS_ROUTING_MODE: "receiving_number",
      NUKMIRIS_ENABLE_RELIABILITY: "false",
      NUKMIRIS_LOOKAHEAD_DAYS: "14", GOOGLE_OAUTH_TOKEN_PATH: token,
      WHATSAPP_TOKEN: "synthetic-unused", WHATSAPP_PHONE_NUMBER_ID: "synthetic-default-not-used",
      WHATSAPP_VERIFY_TOKEN: "synthetic-verify", META_APP_SECRET: secret, WHATSAPP_API_VERSION: "v26.0",
    })) { originals.set(name, process.env[name]); process.env[name] = value; }
    const google = require("googleapis").google;
    mock.method(google.auth, "fromJSON", () => ({ synthetic: true }));
    mock.method(google, "calendar", () => ({
      calendarList: { get: async ({ calendarId }) => ({ data: { id: calendarId, summary: "Synthetic business calendar", accessRole: "writer" } }) },
      freebusy: { query: async args => {
        calendarCalls.push(args.requestBody);
        if (failNextLookup || calendarCalls.length === failAtLookup) { failNextLookup = false; throw new Error("Synthetic Google failure"); }
        const id = args.requestBody.items[0].id;
        return { data: { calendars: { [id]: { busy: busy[id] || [] } } } };
      } },
      events: Object.fromEntries(["insert", "patch", "update", "delete"].map(method => [method, () => { changes.push(method); throw new Error("Calendar changes forbidden"); }])),
    }));
    mock.method(require("@google-cloud/local-auth"), "authenticate", () => { throw new Error("OAuth forbidden in tests"); });
    mock.method(require("node:https"), "request", () => { throw new Error("External HTTPS forbidden in tests"); });
    mock.method(globalThis, "fetch", async (url, options) => {
      assert.match(String(url), /^https:\/\/graph\.facebook\.com\/v26\.0\/phone-synthetic-[ab]\/messages$/);
      const item = { url: String(url), payload: JSON.parse(options.body) };
      if (item.payload.interactive?.type === "button") {
        const buttons = item.payload.interactive.action.buttons;
        assert(buttons.length >= 1 && buttons.length <= 3);
        assert(buttons.every(button => button.reply.title.length <= 20 && button.reply.id.length <= 256));
      }
      if (item.payload.interactive?.type === "list") {
        const rows = item.payload.interactive.action.sections[0].rows;
        assert(rows.length >= 1 && rows.length <= 10);
        assert(rows.every(row => row.title.length <= 24 && row.id.length <= 200));
      }
      if (item.payload.interactive) assert(item.payload.interactive.body.text.length <= 1024);
      outgoing.push(item);
      if (gate) await gate;
      return new Response(JSON.stringify({ messages: [{ id: "synthetic-outgoing" }] }), { status: 200 });
    });
    mock.method(console, "log", () => {});
    mock.method(console, "error", () => {});
    runtime = require("../whatsapp-webhook.js");
    server = await runtime.start();
    if (!server.listening) await once(server, "listening");
    origin = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(() => {
    outgoing.length = 0; calendarCalls.length = 0; changes.length = 0; gate = undefined; failNextLookup = false; failAtLookup = undefined;
    for (const key of Object.keys(busy)) delete busy[key];
    db.exec("DELETE FROM business_support_messages; DELETE FROM business_support_conversations; DELETE FROM business_customer_sessions;");
  });
  after(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (runtime) runtime.close();
    if (db) db.close();
    mock.restoreAll();
    for (const [key, value] of originals) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });
  async function settle(condition) {
    const deadline = performance.now() + 1500;
    while (!condition()) {
      if (performance.now() >= deadline) throw new Error("Expected asynchronous message result was not produced");
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    await new Promise(resolve => setImmediate(resolve));
  }
  async function post(body, { business = "a", kind = "text", id = randomUUID(), signature = true, expectReply = true } = {}) {
    const msg = kind === "text" ? { id, from: sender, type: "text", text: { body } }
      : { id, from: sender, type: "interactive", interactive: { type: kind, [kind]: { id: body } } };
    const payload = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: `phone-synthetic-${business}` }, messages: [msg] } }] }] });
    const count = outgoing.length;
    const response = await nativeFetch(`${origin}/webhook`, { method: "POST", body: payload,
      headers: { "Content-Type": "application/json", ...(signature ? { "X-Hub-Signature-256": "sha256=" + createHmac("sha256", secret).update(payload).digest("hex") } : {}) } });
    await response.arrayBuffer();
    if (expectReply && response.status === 200) await settle(() => outgoing.length > count);
    return response.status;
  }
  const rows = () => outgoing.at(-1).payload.interactive.action.sections[0].rows;
  const buttons = () => outgoing.at(-1).payload.interactive.action.buttons.map(button => button.reply);
  const stored = (business = "a") => JSON.parse(db.prepare("SELECT session_json FROM business_customer_sessions WHERE business_id=?").get(`synthetic-${business}`).session_json);
  const dayOf = slot => DateTime.fromISO(slot.start).setZone("America/Mexico_City").toISODate();
  const textDate = day => DateTime.fromISO(day).toFormat("dd/LL/yyyy");
  async function openDates() {
    await post("Cita");
    await post(buttons().at(-1).id, { kind: "button_reply" });
    await post(buttons().at(-1).id, { kind: "button_reply" });
    return rows();
  }

  test("unsigned requests are rejected before any reply or stored session", async () => {
    assert.equal(await post("Hola", { signature: false, expectReply: false }), 403);
    assert.equal(outgoing.length, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM business_customer_sessions").get().n, 0);
  });
  test("Cita immediately offers two hourly appointments and Más opciones from the exact business calendar", async () => {
    assert.equal(await post("Cita", { business: "b" }), 200);
    assert.deepEqual(calendarCalls.at(-1).items, [{ id: "calendar-synthetic-b" }]);
    assert(outgoing.at(-1).url.endsWith("/phone-synthetic-b/messages"));
    assert.equal(outgoing.at(-1).payload.interactive.type, "button");
    const choices = buttons().filter(row => row.id.includes(":slot:"));
    assert.equal(choices.length, 2);
    assert.deepEqual(choices.map(row => row.title), ["lun 26 oct 10:00", "lun 26 oct 11:00"]);
    assert(choices.every(row => /\d{2}:00$/.test(row.title)));
    assert(!choices.some(row => row.title.endsWith("13:00")));
    assert.equal(buttons()[2].title, "Más opciones");
    assert.equal(outgoing.at(-1).payload.interactive.body.text, "Elige un horario que te funciona mejor:");
    assert(!outgoing.at(-1).payload.interactive.body.text.includes("Página"));
    assert.deepEqual(changes, []);
  });
  test("the main-menu appointment button opens calendar lookup without enabling booking", async () => {
    await post("Hola");
    const book = outgoing.at(-1).payload.interactive.action.buttons.find(button => button.reply.id.endsWith(":book"));
    await post(book.reply.id, { kind: "button_reply" });
    assert.equal(outgoing.at(-1).payload.interactive.body.text, "Elige un horario que te funciona mejor:");
    assert.deepEqual(changes, []);
  });
  test("natural booking requests retain read-only availability and management remains paused", async () => {
    await post("¿Tienen espacio mañana?");
    assert.equal(outgoing.at(-1).payload.interactive.body.text, "Elige un horario que te funciona mejor:");
    await post(buttons()[0].id, { kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /reserva automática todavía no está activada/);
    await post("Menu"); await post("Quiero cambiar mi cita");
    assert.match(outgoing.at(-1).payload.text.body, /temporalmente deshabilitadas/);
    await post("Cancélame la cita por favor");
    assert.match(outgoing.at(-1).payload.text.body, /temporalmente deshabilitadas/);
    assert.deepEqual(changes, []);
  });
  test("two more appointments lead to date selection and every available time on that date", async () => {
    await post("Cita");
    const first = buttons().slice(0, 2).map(button => button.title);
    const all = stored().slots;
    await post(buttons()[2].id, { kind: "button_reply" });
    assert.equal(outgoing.at(-1).payload.interactive.body.text, "Te muestro mas opciones. Elige un horario que te funciona mejor:");
    assert.equal(buttons().length, 3);
    assert.deepEqual(buttons().slice(0, 2).map(button => button.title), ["lun 26 oct 12:00", "lun 26 oct 14:00"]);
    assert(buttons().slice(0, 2).every(button => !first.includes(button.title)));
    assert.equal(buttons()[2].title, "Elegir fecha");
    await post(buttons()[2].id, { kind: "button_reply" });
    assert.equal(outgoing.at(-1).payload.interactive.action.sections[0].title, "Fechas disponibles");
    assert.equal(calendarCalls.length, 1, "opening the date picker reuses the existing offer");
    assert.equal(outgoing.at(-1).payload.interactive.body.text,
      "¿Para qué día te gustaría tu cita? Puedes escribir, por ejemplo: 13 oct, 13/10 o próximo lunes.");
    const selectedDate = rows().find(row => row.id.includes(":date:"));
    const day = selectedDate.id.split(":").at(-1);
    const expected = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"].map(time => `lun 26 oct ${time}`);
    await post(selectedDate.id, { kind: "list_reply" });
    assert.deepEqual(stored().slots, all.filter(slot => dayOf(slot) === day));
    const displayed = [];
    while (true) {
      displayed.push(...buttons().filter(button => button.id.includes(":slot:")).map(button => button.title));
      const next = buttons().find(button => button.title === "Más horarios");
      if (!next) break;
      await post(next.id, { kind: "button_reply" });
    }
    assert.deepEqual(displayed, expected);
    assert.equal(buttons().at(-1).title, "Elegir otra fecha");
    assert(stored().slots.every(slot => dayOf(slot) === day));
    await post(buttons().at(-1).id, { kind: "button_reply" });
    assert(rows().some(row => row.id.includes(":date:")));
    assert.deepEqual(changes, []);
  });
  test("the same customer and message ID stay separate across receiving business numbers", async () => {
    const id = randomUUID();
    await post("Cita", { business: "a", id });
    const buttonFromA = buttons()[0].id;
    await post("Cita", { business: "b", id });
    assert.equal(outgoing.length, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM business_customer_sessions WHERE whatsapp_id=?").get(sender).n, 2);
    await post(buttonFromA, { business: "b", kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
    assert.deepEqual(changes, []);
  });
  test("a selected time is checked again and never creates a calendar event", async () => {
    await post("Cita");
    const choice = buttons()[0];
    await post(choice.id, { kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /sigue disponible/);
    assert.match(outgoing.at(-1).payload.text.body, /reserva automática todavía no está activada/);
    assert.equal(calendarCalls.length, 2);
    assert.deepEqual(changes, []);
  });
  test("an appointment added to Google after the offer makes the selected slot unavailable", async () => {
    await post("Cita");
    const choice = buttons()[0].id;
    busy["calendar-synthetic-a"] = [stored().slots[0]];
    await post(choice, { kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.interactive.body.text, /ya no está disponible/);
    assert(buttons().some(button => button.id.includes(":slot:")));
    assert.deepEqual(changes, []);
  });
  test("choosing a date queries Google again and removes newly busy times", async () => {
    const date = (await openDates()).find(row => row.id.includes(":date:"));
    const day = date.id.split(":").at(-1);
    const previous = stored().slots.filter(slot => dayOf(slot) === day);
    busy["calendar-synthetic-a"] = [previous[0]];
    const queries = calendarCalls.length;
    await post(date.id, { kind: "list_reply" });
    assert.equal(calendarCalls.length, queries + 1);
    assert.deepEqual(stored().slots, previous.slice(1));
    assert.deepEqual(changes, []);
  });
  test("a fully booked date offers another date and never substitutes a different day's times", async () => {
    const date = (await openDates()).find(row => row.id.includes(":date:"));
    const day = date.id.split(":").at(-1);
    busy["calendar-synthetic-a"] = stored().slots.filter(slot => dayOf(slot) === day);
    await post(date.id, { kind: "list_reply" });
    assert.match(outgoing.at(-1).payload.interactive.body.text, /No hay horarios disponibles/);
    assert.deepEqual(buttons().map(button => button.title), ["Elegir otra fecha"]);
    assert.deepEqual(stored().slots, []);
    assert.deepEqual(changes, []);
  });
  test("typed dates support direct selection and reject invalid, past, and out-of-window dates without Google calls", async () => {
    await openDates();
    const slots = stored().slots;
    const queries = calendarCalls.length;
    const today = DateTime.now().setZone("America/Mexico_City");
    for (const [invalid, expected] of [["31/02/2027", /No pude identificar bien la fecha/], ["algún día", /No pude identificar bien la fecha/],
      [today.minus({ days: 1 }).toFormat("dd/LL/yyyy"), /Esa fecha ya pasó/],
      [today.plus({ days: 400 }).toFormat("dd/LL/yyyy"), /próximos 365 días/]]) {
      await post(invalid);
      assert.match(outgoing.at(-1).payload.text.body, expected);
      assert.equal(calendarCalls.length, queries);
    }
    const day = dayOf(slots.at(-1));
    await post(textDate(day));
    assert.equal(calendarCalls.length, queries + 1);
    assert.equal(stored().selectedDate, day);
    assert.deepEqual(stored().slots, slots.filter(slot => dayOf(slot) === day));
    assert.deepEqual(changes, []);
  });
  test("a typed closed weekday is empty and the customer can immediately choose another date", async () => {
    await openDates();
    let closed = DateTime.now().setZone("America/Mexico_City").startOf("day");
    while (closed.weekday !== 7) closed = closed.plus({ days: 1 });
    await post(closed.toFormat("dd/LL/yyyy"));
    assert.match(outgoing.at(-1).payload.interactive.body.text, /No hay horarios disponibles/);
    assert.equal(stored().selectedDate, closed.toISODate());
    await post("otra fecha");
    assert(rows().some(row => row.id.includes(":date:")));
  });
  test("a typed date six months away checks that day directly and displays its times", async () => {
    await openDates();
    let date = DateTime.now().setZone("America/Mexico_City").startOf("day").plus({ days: 180 });
    while (date.weekday > 5) date = date.plus({ days: 1 });
    const count = calendarCalls.length;
    await post(date.toFormat("dd/LL/yyyy"));
    assert.equal(calendarCalls.length, count + 1);
    assert.equal(calendarCalls.at(-1).timeMin, date.toISO());
    assert.equal(calendarCalls.at(-1).timeMax, date.plus({ days: 1 }).toISO());
    assert.equal(stored().selectedDate, date.toISODate());
    assert(stored().slots.length > 0);
    assert(stored().slots.every(slot => dayOf(slot) === date.toISODate()));
    assert(buttons().some(button => button.title.endsWith(" 10:00")));
    assert.deepEqual(changes, []);
  });
  test("natural date formats use one direct-day query, keep the same offer flow, and never reserve in read-only mode", async () => {
    await openDates();
    for (const text of ["27/10", "27-10-2026", "27.10", "27 10", "27 octubre", "27 de oct", "quiero el 27 de octubre", "mañana"]) {
      const count = calendarCalls.length;
      await post(text);
      assert.equal(calendarCalls.length, count + 1);
      assert.equal(stored().selectedDate, "2026-10-27");
      assert.equal(calendarCalls.at(-1).timeMin, "2026-10-27T00:00:00.000-06:00");
      assert.equal(calendarCalls.at(-1).timeMax, "2026-10-28T00:00:00.000-06:00");
      assert.equal(buttons()[0].title, "mar 27 oct 10:00");
      assert.doesNotMatch(outgoing.at(-1).payload.interactive.body.text, /DD\/MM|Confirmas|menu/i);
      assert.deepEqual(changes, []);
    }
  });
  test("invalid, ambiguous, past, and distant dates keep the current dates and actions without querying Google", async () => {
    await openDates();
    const original = stored(), count = calendarCalls.length;
    for (const [text, expected] of [["31 febrero", /No pude identificar/], ["lunes o martes", /No pude identificar/],
      ["ayer", /Esa fecha ya pasó/], ["13 oct 2025", /Esa fecha ya pasó/], ["en 366 días", /próximos 365 días/],
      ["13:10", /No pude identificar/], ["mi teléfono es 5512345678", /No pude identificar/], ["60 minutos", /No pude identificar/]]) {
      await post(text);
      assert.match(outgoing.at(-1).payload.text.body, expected);
      assert.equal(calendarCalls.length, count);
      assert.deepEqual(stored(), original);
    }
    await post("27 oct");
    assert.equal(stored().selectedDate, "2026-10-27"); assert.equal(calendarCalls.length, count + 1);
  });
  test("day-only input goes directly to the next upcoming occurrence without another question", async () => {
    await openDates();
    const original = stored(), count = calendarCalls.length;
    await post("el día 13");
    assert.match(outgoing.at(-1).payload.interactive.body.text, /viernes 13 de noviembre 2026/);
    assert.equal(stored().selectedDate, "2026-11-13");
    assert.equal(stored().calendarId, original.calendarId);
    assert.equal(calendarCalls.length, count + 1);
  });
  test("a bare weekday uses today's remaining real slots or next week when today is fully busy", async () => {
    await post("Cita");
    let count = calendarCalls.length;
    await post("lunes");
    assert.equal(stored().selectedDate, "2026-10-26"); assert.equal(calendarCalls.length, count + 1);
    busy["calendar-synthetic-a"] = [{ start: "2026-10-26T00:00:00-06:00", end: "2026-10-27T00:00:00-06:00" }];
    count = calendarCalls.length;
    await post("lunes");
    assert.equal(stored().selectedDate, "2026-11-02"); assert.equal(calendarCalls.length, count + 2);
    assert.deepEqual(changes, []);
  });
  test("próximo weekday always means a future occurrence, without an availability confirmation question", async () => {
    await post("Cita");
    const count = calendarCalls.length;
    await post("el próximo lunes");
    assert.equal(stored().selectedDate, "2026-11-02"); assert.equal(calendarCalls.length, count + 1);
    assert.match(outgoing.at(-1).payload.interactive.body.text, /lunes 2 de noviembre 2026/);
  });
  test("the same sender's relative date uses each receiving business's timezone", async () => {
    db.prepare("UPDATE businesses SET time_zone='Asia/Tokyo' WHERE business_id='synthetic-b'").run();
    try {
      await post("Cita"); await post("mañana");
      assert.equal(stored().selectedDate, "2026-10-27");
      await post("Cita", { business: "b" }); await post("mañana", { business: "b" });
      assert.equal(stored("b").selectedDate, "2026-10-28");
      assert.equal(buttons()[0].title, "mié 28 oct 10:00");
      assert.deepEqual(calendarCalls.at(-1).items, [{ id: "calendar-synthetic-b" }]);
      assert.equal(calendarCalls.at(-1).timeZone, "Asia/Tokyo");
      assert.equal(stored().selectedDate, "2026-10-27"); assert.deepEqual(changes, []);
    } finally { db.prepare("UPDATE businesses SET time_zone='America/Mexico_City' WHERE business_id='synthetic-b'").run(); }
  });
  test("date lists allow later dates and return navigation within WhatsApp's row limit", async () => {
    const initial = await openDates();
    const forward = initial.find(row => row.title === "Más fechas");
    assert(forward);
    await post(forward.id, { kind: "list_reply" });
    assert(rows().length <= 10);
    assert(rows().some(row => row.title === "Fechas anteriores"));
    assert(rows().filter(row => row.id.includes(":date:")).every(row => !initial.some(before => before.title === row.title)));
    const backward = rows().find(row => row.title === "Fechas anteriores");
    await post(backward.id, { kind: "list_reply" });
    assert.deepEqual(rows().map(row => row.title), initial.map(row => row.title));
  });
  test("old views, guessed hidden indexes, expired dates, and changed calendar mappings fail closed", async () => {
    await post("Cita");
    const old = buttons()[0].id;
    await post(old.replace(/:slot:0$/, ":slot:50"), { kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
    await post("Cita");
    const first = buttons()[0].id;
    await post(buttons()[2].id, { kind: "button_reply" });
    await post(first, { kind: "button_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
    const date = (await openDates()).find(row => row.id.includes(":date:"));
    const session = stored();
    session.expiresAt = Date.now() - 1;
    db.prepare("UPDATE business_customer_sessions SET session_json=? WHERE business_id='synthetic-a'").run(JSON.stringify(session));
    await post(date.id, { kind: "list_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
    await post(textDate(dayOf(session.slots[0])));
    assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
    const next = (await openDates())[0];
    db.prepare("UPDATE business_calendar_connections SET google_calendar_id='synthetic-changed' WHERE business_id='synthetic-a'").run();
    try {
      await post(next.id, { kind: "list_reply" });
      assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
    } finally {
      db.prepare("UPDATE business_calendar_connections SET google_calendar_id='calendar-synthetic-a' WHERE business_id='synthetic-a'").run();
    }
    assert.deepEqual(changes, []);
  });
  test("the entire search window being busy produces no appointment choices", async () => {
    busy["calendar-synthetic-a"] = [{ start: DateTime.now().minus({ days: 1 }).toISO(), end: DateTime.now().plus({ days: 400 }).toISO() }];
    await post("Cita");
    assert.match(outgoing.at(-1).payload.text.body, /No encontré horarios disponibles/);
    assert.match(outgoing.at(-1).payload.text.body, /llamar al negocio/);
    assert.equal(calendarCalls.length, 24);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM business_customer_sessions").get().n, 0);
    assert.deepEqual(changes, []);
  });
  test("only one or two remaining appointments skip the empty More options step", async () => {
    await post("Cita");
    const all = stored().slots;
    for (const remaining of [2, 1]) {
      busy["calendar-synthetic-a"] = [...all.slice(0, -remaining), { start: all.at(-1).end, end: DateTime.now().plus({ days: 400 }).toISO() }];
      await post("Cita");
      assert.equal(buttons().filter(button => button.id.includes(":slot:")).length, remaining);
      assert.equal(buttons().at(-1).title, "Elegir fecha");
      assert(!buttons().some(button => button.title === "Más opciones"));
    }
    assert.deepEqual(changes, []);
  });
  test("a failed date lookup keeps the selection retryable and never invents available times", async () => {
    const date = (await openDates()).find(row => row.id.includes(":date:"));
    failNextLookup = true;
    await post(date.id, { kind: "list_reply" });
    assert.match(outgoing.at(-1).payload.text.body, /No pude completar la solicitud/);
    assert.equal(stored().view, "dates");
    await post(date.id, { kind: "list_reply" });
    assert(buttons().some(button => button.id.includes(":slot:")));
    assert.deepEqual(changes, []);
  });
  test("a failure in either the initial or an extended search reports an error rather than no availability", async () => {
    busy["calendar-synthetic-a"] = [{ start: DateTime.now().minus({ days: 1 }).toISO(),
      end: DateTime.now().setZone("America/Mexico_City").startOf("day").plus({ days: 30 }).toISO() }];
    for (const callNumber of [1, 2]) {
      calendarCalls.length = 0; failAtLookup = callNumber;
      await post("Cita");
      assert.equal(calendarCalls.length, callNumber);
      assert.match(outgoing.at(-1).payload.text.body, /No pude consultar el calendario/);
      assert(outgoing.at(-1).payload.text.body.endsWith('Escribe "menu" para volver al menú principal.'));
      assert.doesNotMatch(outgoing.at(-1).payload.text.body, /No encontré horarios|llamar al negocio/);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM business_customer_sessions").get().n, 0);
    }
    assert.deepEqual(changes, []);
    await post("MENU");
    assert.equal(buttons()[0].title, "Agendar una cita");
  });
  test("menu capitalization leaves read-only date/time browsing and invalidates old choices without calendar writes", async () => {
    for (const command of ["menu", "Menu", "MENU"]) {
      await openDates(); await post("mañana");
      const old = buttons()[0].id;
      const calls = calendarCalls.length;
      await post(command);
      assert.equal(buttons()[0].title, "Agendar una cita");
      assert.equal(stored().mode, "main_menu");
      await post(old, { kind: "button_reply" });
      assert.match(outgoing.at(-1).payload.text.body, /ya no está vigente/);
      assert.equal(calendarCalls.length, calls);
    }
    assert.deepEqual(changes, []);
  });
  test("queued concurrent messages are both processed instead of dropping the second", async () => {
    let release;
    gate = new Promise(resolve => { release = resolve; });
    try {
      await post("Hola");
      await post("Synthetic support request", { expectReply: false });
      release(); gate = undefined;
      await settle(() => db.prepare("SELECT COUNT(*) AS n FROM business_support_messages").get().n === 1);
      assert.equal(db.prepare("SELECT message_text FROM business_support_messages").get().message_text, "Synthetic support request");
    } finally { release(); gate = undefined; }
  });
  test("unknown receiving phone IDs are ignored without fallback to a customer's development route", async () => {
    assert.equal(await post("Cita", { business: "unknown", expectReply: false }), 200);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(outgoing.length, 0);
    assert.equal(calendarCalls.length, 0);
  });
});
