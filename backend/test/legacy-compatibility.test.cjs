"use strict";
const { describe, test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { compatibilityFixture, buttons, body, writes } = require("./helpers/compatibility-fixture.cjs");
const id = "11111111-1111-4111-8111-111111111111";
const historical = ["book", "reschedule", "cancel", "choose_cancel", "choose_reschedule", "registration", "manage_menu", "booking_confirm", "management_confirm"];
const current = ["availability", "booking_name", "booking_result", "management_menu", "management_select", "management_result", "reschedule_browse", "intent_clarification"];
const rejected = /deshabilitadas|no está disponible|ya no está vigente|Selecciona una|No entendí qué necesitas/;
function legacySession(mode) {
  return { mode, offerId: id, selectionId: id, confirmationId: id, menuId: id, requestId: id,
    appointments: [{ id: "obsolete-event", start: "2026-10-27T10:00:00-06:00" }],
    slots: [{ start: "2026-10-27T10:00:00-06:00", end: "2026-10-27T11:00:00-06:00" }],
    action: "book", kind: "cancel" };
}
function legacyAction(mode) {
  if (mode.startsWith("choose_")) return `appointment:${id}:1`;
  if (mode === "cancel") return `cancel:${id}:si`;
  if (mode === "manage_menu") return `manage:${id}:cancel`;
  return `${mode === "reschedule" ? "reschedule" : "book"}:${id}:1`;
}
const configurations = [];
for (const mode of ["support", "availability", "booking"]) {
  for (const management of [false, true]) {
    for (const reliable of [false, true]) configurations.push({ mode, management, reliable, routing: "receiving_number" });
    if (mode !== "booking") configurations.push({ mode, management, reliable: false, routing: "development" });
  }
}
for (const config of configurations) {
  const label = `${config.mode}, management flag ${config.management}, reliability ${config.reliable}, ${config.routing}`;
  describe(`legacy compatibility: ${label}`, { concurrency: false }, () => {
    let f;
    before(async () => { f = await compatibilityFixture(config); });
    beforeEach(() => f.reset());
    after(async () => { if (f) await f.cleanup(); });

    for (const mode of historical) test(`${mode}: fresh/expired, known/new, text/button/list cannot use obsolete operations`, async () => {
      const customers = f.db.prepare("SELECT * FROM business_customers ORDER BY customer_id").all();
      const callCount = f.calls().length;
      for (const expired of [false, true]) for (const sender of ["synthetic-one", "synthetic-new"]) {
        for (const kind of ["text", "button_reply", "list_reply"]) {
          f.resetSessions(); f.saveSession(legacySession(mode), { sender, expired });
          const reply = await f.post(kind === "text" ? "Nombre Prueba" : legacyAction(mode), { sender, kind });
          assert.match(body(reply), rejected, `${mode}/${expired}/${sender}/${kind}`);
          assert(!/está agendada|está reagendada|está cancelada|nombre completo/.test(body(reply)));
        }
      }
      assert.equal(f.calls().length, callCount, "old input must not even invoke a Calendar read");
      assert.deepEqual(f.events(), {});
      assert.deepEqual(f.db.prepare("SELECT * FROM business_customers ORDER BY customer_id").all(), customers);
      assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM booking_requests").get().n, 0);
      assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM appointment_changes").get().n, 0);
    });

    test("obsolete action families and guessed indexes are rejected even with matching saved state", async () => {
      const callCount = f.calls().length;
      for (const [mode, action] of [["book", `book:${id}:1`], ["reschedule", `reschedule:${id}:1`],
        ["choose_cancel", `appointment:${id}:1`], ["cancel", `cancel:${id}:si`]]) {
        for (const kind of ["button_reply", "list_reply"]) for (const index of [action, action.replace(id, randomUUID()), action.replace(/:1$/, ":999")]) {
          f.saveSession(legacySession(mode));
          assert.match(body(await f.post(index, { kind })), /deshabilitadas|no está disponible/);
        }
      }
      assert.equal(f.calls().length, callCount);
      assert.deepEqual(writes(f), []);
    });

    test("global Menu leaves every historical/current state and rejects the previous main-menu token", async () => {
      const callCount = f.calls().length;
      for (const mode of [...historical, ...current]) {
        f.saveSession({ ...legacySession(mode), selectionCommand: `availability:${id}:slot:0` });
        const menu = await f.post("MENU");
        assert.equal(f.session().mode, "main_menu");
        assert.deepEqual(buttons(menu).map(button => button.title), ["Agendar una cita", "Reagendar / cancelar", "Hablar con alguien"]);
        const old = buttons(menu).find(button => button.id.endsWith(":human")).id;
        await f.post("menu");
        assert.match(body(await f.post(old, { kind: "button_reply" })), /ya no está vigente/);
      }
      assert.equal(f.calls().length, callCount);
    });

    test("human support owns appointment words and old actions until Menu, scoped to this business", async () => {
      const menu = await f.post("menu"), human = buttons(menu).find(button => button.id.endsWith(":human")).id;
      await f.post(human, { kind: "button_reply" });
      const callCount = f.calls().length;
      for (const text of ["cita", "reagendar", "cancelar", "Cliente Nombre"]) {
        const result = await f.deliver(f.incoming(text));
        assert.deepEqual(result.replies, []);
      }
      for (const kind of ["button_reply", "list_reply"]) {
        assert.match(body(await f.post(`book:${id}:1`, { kind })), /atención personal/);
      }
      assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM business_support_messages WHERE business_id='synthetic-a'").get().n, 4);
      assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM business_support_messages WHERE business_id='synthetic-b'").get().n, 0);
      assert.equal(f.calls().length, callCount);
      await f.post("Menu");
      assert.equal(f.db.prepare("SELECT status FROM business_support_conversations WHERE business_id='synthetic-a'").get().status, "closed");
      assert.equal(f.session().mode, "main_menu");
    });

    test("current main-menu booking uses only the configured calendar and preserves immediate selection semantics", async () => {
      const menu = await f.post("menu"), action = buttons(menu).find(button => button.id.endsWith(":book")).id;
      const callCount = f.calls().length;
      const offered = await f.post(action, { kind: "button_reply" });
      if (config.mode === "support") {
        assert.match(body(offered), /deshabilitadas/); assert.equal(f.calls().length, callCount); return;
      }
      assert.deepEqual(buttons(offered).map(button => button.title).slice(2), ["Más opciones"]);
      assert.equal(buttons(offered).length, 3);
      assert(f.calls().slice(callCount).every(call => call.calendarId === "calendar-synthetic-a"));
      const reply = await f.post(buttons(offered)[0].id, { kind: "button_reply" });
      if (config.mode === "availability") {
        assert.match(body(reply), /reserva automática todavía no está activada/); assert.deepEqual(writes(f), []);
      } else {
        assert.match(body(reply), /está agendada/);
        assert.equal(writes(f).length, 1); assert.equal(writes(f)[0].method, "insert");
        assert.equal(f.db.prepare("SELECT state FROM booking_requests").get().state, "confirmed");
        assert.equal(f.session().mode, "booking_result");
      }
    });

    test("management flags do not activate unavailable functionality in other modes", async () => {
      const callCount = f.calls().length;
      for (const command of ["Reagendar", "Cancelar"]) {
        const reply = await f.post(command);
        assert.match(body(reply), config.mode === "booking" && config.management
          ? /No encontré citas próximas/ : /deshabilitadas|no está disponible/);
      }
      assert.equal(f.calls().length, callCount);
      assert.deepEqual(writes(f), []);
    });

    if (config.mode !== "booking") test("otherwise valid journal actions remain unavailable outside booking mode", async () => {
      const source = await f.seed({ hour: 11 });
      const booking = f.booking.createIntent({ businessId: "synthetic-a", sender: "synthetic-one", calendarId: "calendar-synthetic-a", slot: f.slot(10) });
      const change = await f.intent(source, "cancel");
      const callCount = f.calls().length;
      for (const [prefix, requestId] of [["booking", booking.requestId], ["change", change.requestId]]) {
        f.saveSession({ mode: prefix === "booking" ? "booking_confirm" : "management_confirm", requestId });
        for (const kind of ["button_reply", "list_reply"]) for (const decision of ["yes", "no", "retry", "status"]) {
          assert.match(body(await f.post(`${prefix}:${requestId}:${decision}`, { kind })), /ya no está vigente/);
        }
      }
      assert.equal(f.calls().length, callCount); assert.deepEqual(writes(f), []);
      assert.equal(f.db.prepare("SELECT state FROM booking_requests WHERE request_id=?").get(booking.requestId).state, "offered");
      assert.equal(f.db.prepare("SELECT state FROM appointment_changes WHERE request_id=?").get(change.requestId).state, "offered");
      assert.equal(f.db.prepare("SELECT state FROM booking_requests WHERE request_id=?").get(source.bookingRequestId).state, "confirmed");
    });

    test("verified routing and signature checks cannot borrow another business's saved menu", async () => {
      const menu = await f.post("menu"), old = buttons(menu)[0].id;
      const callCount = f.calls().length;
      assert.equal((await f.deliver(f.incoming("cita"), { signed: false })).status, 403);
      if (config.routing === "receiving_number") {
        const foreign = await f.post(old, { business: "b", kind: "button_reply" });
        assert.match(body(foreign), /ya no está vigente|deshabilitadas/);
        assert.equal(f.session().mode, "main_menu");
        assert.deepEqual((await f.deliver(f.incoming("cita", { channel: "unmapped-number" }))).replies, []);
      } else {
        // Explicit development routing follows the approved sender mapping;
        // untrusted receiving metadata cannot choose a different business.
        assert.match(body(await f.post("menu", { business: "b" })), /Business synthetic-a/);
        assert.deepEqual((await f.deliver(f.incoming("cita", { sender: "unmapped-sender" }))).replies, []);
      }
      assert.equal(f.calls().length, callCount);
      assert.deepEqual(writes(f), []);
    });

    test("repeated webhook delivery sends only one reply for both current and obsolete actions", async () => {
      for (const [text, kind] of [["menu", "text"], [`book:${id}:1`, "button_reply"], [`appointment:${id}:1`, "list_reply"]]) {
        const payload = f.incoming(text, { kind });
        assert.equal((await f.deliver(payload)).replies.length, 1);
        assert.deepEqual((await f.deliver(payload)).replies, []);
      }
      assert.deepEqual(writes(f), []);
    });

    test("persisted old state remains rejected and a current saved choice survives a real process restart", async () => {
      f.saveSession(legacySession("registration"));
      await f.restart();
      assert.match(body(await f.post("Nombre Prueba")), /deshabilitadas/);
      assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM business_customers WHERE whatsapp_id='synthetic-new'").get().n, 0);
      if (config.mode === "support") return;
      const offer = await f.post("cita"), action = buttons(offer)[0].id;
      const saved = f.session(); await f.restart(); assert.deepEqual(f.session(), saved);
      const payload = f.incoming(action, { kind: "button_reply" });
      assert.match(body((await f.deliver(payload)).replies[0]), config.mode === "booking" ? /está agendada/ : /reserva automática todavía no está activada/);
      await f.restart();
      const repeat = await f.deliver(payload);
      if (config.reliable) assert.deepEqual(repeat.replies, [], "durable inbox survives restart");
      // Compatibility mode loses its in-memory message cache, but a saved
      // booking receipt still resolves the same request without another insert.
      assert.equal(writes(f).length, config.mode === "booking" ? 1 : 0);
    });
  });
}
