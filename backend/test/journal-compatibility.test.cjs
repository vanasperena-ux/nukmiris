"use strict";
const { describe, test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { compatibilityFixture, buttons, body, writes } = require("./helpers/compatibility-fixture.cjs");
const configs = [];
for (const management of [false, true]) for (const reliable of [false, true]) configs.push({ mode: "booking", management, reliable });
for (const reminders of ["dry-run", "live"]) configs.push({ mode: "booking", management: true, reliable: true, reminders });
for (const config of configs) describe(`journal compatibility: management ${config.management}, reliability ${config.reliable}, reminders ${config.reminders || "off"}`, { concurrency: false }, () => {
  let f;
  before(async () => { f = await compatibilityFixture(config); });
  beforeEach(() => f.reset());
  after(async () => { if (f) await f.cleanup(); });
  const bookingState = requestId => f.db.prepare("SELECT state FROM booking_requests WHERE request_id=?").get(requestId).state;
  const changeState = requestId => f.db.prepare("SELECT state FROM appointment_changes WHERE request_id=?").get(requestId).state;
  const intent = () => f.booking.createIntent({ businessId: "synthetic-a", sender: "synthetic-one", calendarId: "calendar-synthetic-a", slot: f.slot(10) });

  test("a new customer supplies a name once; invalid input cannot create or register an appointment", async () => {
    const offered = await f.post("cita", { sender: "synthetic-new" });
    const action = buttons(offered)[0].id;
    assert.match(body(await f.post(action, { sender: "synthetic-new", kind: "button_reply" })), /nombre completo/);
    const selected = f.session("a", "synthetic-new");
    await f.restart();
    assert.deepEqual(f.session("a", "synthetic-new"), selected);
    assert.match(body(await f.post("123", { sender: "synthetic-new" })), /nombre completo/);
    assert.equal(writes(f).length, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM business_customers WHERE whatsapp_id='synthetic-new'").get().n, 0);
    assert.match(body(await f.post("María Prueba Pérez", { sender: "synthetic-new" })), /está agendada/);
    const customer = f.db.prepare("SELECT * FROM business_customers WHERE whatsapp_id='synthetic-new'").get();
    assert.equal(customer.business_id, "synthetic-a"); assert.equal(customer.full_name, "María Prueba Pérez");
    assert.equal(writes(f).length, 1);
    assert.match(body(await f.post(action, { sender: "synthetic-new", kind: "button_reply" })), /está agendada/);
    assert.equal(writes(f).length, 1);
  });

  test("an expired current name selection cannot register a customer or book its saved slot", async () => {
    const offer = await f.post("cita", { sender: "synthetic-new" });
    await f.post(buttons(offer)[0].id, { sender: "synthetic-new", kind: "button_reply" });
    f.saveSession({ ...f.session("a", "synthetic-new"), expiresAt: f.clock - 1 }, { sender: "synthetic-new" });
    await f.restart();
    assert.match(body(await f.post("María Prueba Pérez", { sender: "synthetic-new" })), /ha vencido/);
    assert.equal(writes(f).length, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM business_customers WHERE whatsapp_id='synthetic-new'").get().n, 0);
  });

  if (config.reminders) test("historical registration and free-text confirmations remain inert with reminders configured", async () => {
    const baseline = f.calls().length;
    for (const mode of ["registration", "booking_confirm", "management_confirm"]) for (const expired of [false, true]) {
      for (const sender of ["synthetic-one", "synthetic-new"]) {
        f.saveSession({ mode, requestId: randomUUID() }, { sender, expired });
        const reply = await f.post("Sí, por favor", { sender });
        assert.match(body(reply), /deshabilitadas|ya no está vigente|Selecciona una/);
      }
    }
    assert.equal(f.calls().length, baseline); assert.equal(writes(f).length, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM appointment_attendance").get().n, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM reminder_jobs").get().n, 0);
  });

  for (const expiredSession of [false, true]) test(`valid historical booking:yes is journal-bound even with ${expiredSession ? "expired" : "fresh"} booking_confirm session`, async () => {
    const row = intent(), command = `booking:${row.requestId}:yes`;
    f.saveSession({ mode: "booking_confirm", requestId: row.requestId }, { expired: expiredSession });
    await f.restart();
    assert.match(body(await f.post(command, { kind: "button_reply" })), /está agendada/);
    assert.equal(bookingState(row.requestId), "confirmed");
    assert.equal(writes(f).length, 1);
    assert.match(body(await f.post(`booking:${row.requestId}:retry`, { kind: "button_reply" })), /está agendada/);
    assert.match(body(await f.post(`booking:${row.requestId}:status`, { kind: "button_reply" })), /está agendada/);
    assert.equal(writes(f).length, 1);
  });

  test("booking status never confirms an unused offer; no declines it and retry cannot revive it", async () => {
    const row = intent();
    await f.post(`booking:${row.requestId}:status`, { kind: "button_reply" });
    assert.equal(bookingState(row.requestId), "offered"); assert.equal(writes(f).length, 0);
    await f.post(`booking:${row.requestId}:no`, { kind: "button_reply" });
    assert.equal(bookingState(row.requestId), "declined"); assert.equal(writes(f).length, 0);
    await f.post(`booking:${row.requestId}:retry`, { kind: "button_reply" });
    assert.equal(bookingState(row.requestId), "declined"); assert.equal(writes(f).length, 0);
  });

  test("expiry belongs to the booking journal, not a freshly guessed confirmation session", async () => {
    const row = intent();
    f.db.prepare("UPDATE booking_requests SET expires_at=? WHERE request_id=?").run(f.clock - 1, row.requestId);
    f.saveSession({ mode: "booking_confirm", requestId: row.requestId });
    const reply = await f.post(`booking:${row.requestId}:yes`, { kind: "button_reply" });
    assert(!/está agendada/.test(body(reply))); assert.equal(bookingState(row.requestId), "rejected");
    assert.equal(writes(f).length, 0);
  });

  for (const state of ["pending", "uncertain"]) test(`${state} booking is reconciled by historical status after restart without another insert`, async () => {
    f.controls({ afterInsertError: 503, getError: 503 });
    const offer = await f.post("cita");
    const response = await f.post(buttons(offer)[0].id, { kind: "button_reply" });
    assert.match(body(response), /verificación/);
    const row = f.db.prepare("SELECT * FROM booking_requests").get(); assert.equal(row.state, "uncertain");
    // Both durable in-flight states can be restored from an older journal.
    if (state === "pending") f.db.prepare("UPDATE booking_requests SET state='pending' WHERE request_id=?").run(row.request_id);
    await f.post("menu");
    assert.equal(bookingState(row.request_id), state);
    assert.equal(f.db.prepare("SELECT request_id FROM calendar_booking_locks").get().request_id, row.request_id);
    f.controls({}); await f.restart();
    assert.match(body(await f.post(`booking:${row.request_id}:status`, { kind: "button_reply" })), /está agendada/);
    assert.equal(bookingState(row.request_id), "confirmed");
    assert.equal(writes(f).length, 1);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 0);
  });

  test("foreign business/customer journal IDs fail closed despite matching local confirmation sessions", async () => {
    const row = intent(), baseline = f.calls().length;
    for (const [business, sender] of [["b", "synthetic-one"], ["a", "synthetic-two"]]) {
      f.saveSession({ mode: "booking_confirm", requestId: row.requestId }, { business, sender });
      for (const decision of ["yes", "no", "retry", "status"]) {
        const reply = await f.post(`booking:${row.requestId}:${decision}`, { kind: "button_reply", business, sender });
        assert(!/está agendada/.test(body(reply)));
        assert.equal(bookingState(row.requestId), "offered");
      }
    }
    assert.equal(f.calls().length, baseline); assert.equal(writes(f).length, 0);
  });

  test("guessed/malformed actions and unsupported booking list replies cannot authorize a valid request", async () => {
    const row = intent(), baseline = f.calls().length;
    for (const action of [`booking:${randomUUID()}:yes`, `booking:${row.requestId}:guess`, "booking:not-an-id:yes", `change:${randomUUID()}:yes`]) {
      await f.post(action, { kind: "button_reply" });
      assert.equal(bookingState(row.requestId), "offered");
    }
    await f.post(`booking:${row.requestId}:yes`, { kind: "list_reply" });
    assert.equal(bookingState(row.requestId), "offered");
    assert.equal(f.calls().length, baseline); assert.equal(writes(f).length, 0);
  });

  test("a changed scoped Calendar mapping cannot be bypassed using an earlier valid booking token", async () => {
    const row = intent();
    const baseline = f.calls().length;
    f.db.prepare("UPDATE business_calendar_connections SET google_calendar_id='calendar-synthetic-replacement' WHERE business_id='synthetic-a'").run();
    try {
      assert(!/está agendada/.test(body(await f.post(`booking:${row.requestId}:yes`, { kind: "button_reply" }))));
      assert.equal(bookingState(row.requestId), "rejected"); assert.equal(writes(f).length, 0);
      assert.equal(f.calls().length, baseline);
    } finally {
      f.db.prepare("UPDATE business_calendar_connections SET google_calendar_id='calendar-synthetic-a' WHERE business_id='synthetic-a'").run();
    }
  });

  test("human chat blocks a valid journal confirmation until Menu and preserves the offered request", async () => {
    const menu = await f.post("menu"); await f.post(buttons(menu).find(button => button.id.endsWith(":human")).id, { kind: "button_reply" });
    const row = intent(), baseline = f.calls().length;
    assert.match(body(await f.post(`booking:${row.requestId}:yes`, { kind: "button_reply" })), /atención personal/);
    assert.equal(bookingState(row.requestId), "offered"); assert.equal(f.calls().length, baseline);
    await f.post("menu"); assert.equal(bookingState(row.requestId), "declined");
    assert.equal(writes(f).length, 0);
  });

  for (const terminal of ["rejected", "declined", "removed"]) test(`saved ${terminal} booking is not revived by yes/retry/status`, async () => {
    const row = intent(); f.db.prepare("UPDATE booking_requests SET state=? WHERE request_id=?").run(terminal, row.requestId);
    for (const action of ["yes", "retry", "status"]) await f.post(`booking:${row.requestId}:${action}`, { kind: "button_reply" });
    assert.equal(bookingState(row.requestId), terminal); assert.equal(writes(f).length, 0);
  });

  if (!config.management) test("management-disabled mode rejects even otherwise valid saved change confirmations", async () => {
    const source = await f.seed(), change = await f.intent(source, "cancel");
    f.saveSession({ mode: "management_confirm", requestId: change.requestId });
    for (const kind of ["button_reply", "list_reply"]) for (const action of ["yes", "no", "retry", "status"]) {
      assert.match(body(await f.post(`change:${change.requestId}:${action}`, { kind })), /ya no está vigente/);
      assert.equal(changeState(change.requestId), "offered");
    }
    assert.equal(bookingState(source.bookingRequestId), "confirmed"); assert.equal(writes(f).length, 0);
  });
  else {
    for (const kind of ["cancel", "reschedule"]) for (const decision of ["yes", "no"]) {
      test(`historical change:${decision} for ${kind} remains valid after restart, with no duplicate change`, async () => {
        const source = await f.seed(), change = await f.intent(source, kind);
        const original = structuredClone(f.events());
        f.saveSession({ mode: "management_confirm", requestId: change.requestId });
        await f.restart();
        // Management has always accepted both WhatsApp selection shapes.
        const selectionKind = decision === "yes" ? "button_reply" : "list_reply";
        const reply = await f.post(`change:${change.requestId}:${decision}`, { kind: selectionKind });
        assert.match(body(reply), decision === "no" ? /No realizamos cambios/ : kind === "cancel" ? /está cancelada/ : /está reagendada/);
        assert.equal(changeState(change.requestId), decision === "yes" ? "applied" : "declined");
        const expected = decision === "yes" ? 1 : 0; assert.equal(writes(f).length, expected);
        await f.post(`change:${change.requestId}:retry`, { kind: "button_reply" });
        await f.post(`change:${change.requestId}:status`, { kind: "list_reply" });
        assert.equal(writes(f).length, expected);
        if (decision === "no") assert.deepEqual(f.events(), original);
        else if (kind === "reschedule") {
          const previous = Object.values(original)[0], moved = Object.values(f.events())[0];
          assert.equal(moved.id, previous.id); assert.equal(moved.summary, previous.summary); assert.equal(moved.description, previous.description);
          for (const [key, value] of Object.entries(previous.extendedProperties.private)) assert.equal(moved.extendedProperties.private[key], value);
          assert.equal(writes(f)[0].method, "patch");
        } else assert.equal(bookingState(source.bookingRequestId), "removed");
      });
    }

    test("management status cannot execute an unused offer; expired journal cannot be rescued by a fresh session", async () => {
      const source = await f.seed(), change = await f.intent(source, "cancel");
      await f.post(`change:${change.requestId}:status`, { kind: "button_reply" });
      assert.equal(changeState(change.requestId), "offered"); assert.equal(writes(f).length, 0);
      f.db.prepare("UPDATE appointment_changes SET expires_at=? WHERE request_id=?").run(f.clock - 1, change.requestId);
      f.saveSession({ mode: "management_confirm", requestId: change.requestId });
      const reply = await f.post(`change:${change.requestId}:yes`, { kind: "button_reply" });
      assert(!/está cancelada/.test(body(reply))); assert.equal(changeState(change.requestId), "rejected"); assert.equal(writes(f).length, 0);
    });

    test("foreign change requests cannot borrow matching local sessions, including list selections", async () => {
      const source = await f.seed(), change = await f.intent(source, "cancel"), baseline = f.calls().length;
      for (const [business, sender] of [["b", "synthetic-one"], ["a", "synthetic-two"]]) {
        f.saveSession({ mode: "management_confirm", requestId: change.requestId }, { business, sender });
        for (const kind of ["button_reply", "list_reply"]) for (const action of ["yes", "no", "retry", "status"]) {
          const reply = await f.post(`change:${change.requestId}:${action}`, { business, sender, kind });
          assert(!/está cancelada|está reagendada/.test(body(reply)));
          assert.equal(changeState(change.requestId), "offered");
        }
      }
      assert.equal(f.calls().length, baseline); assert.equal(writes(f).length, 0);
    });

    test("a valid-looking current appointment selection cannot point to another business's booking", async () => {
      const source = await f.seed({ businessId: "synthetic-b" });
      const selectionId = randomUUID(), action = `owned:${selectionId}:pick:0`;
      const appointment = await f.management.readAppointment(source);
      f.saveSession({ mode: "management_select", kind: "cancel", selectionId, actions: [action],
        appointments: [{ bookingRequestId: source.bookingRequestId, etag: appointment.etag }] });
      const baseline = f.calls().length;
      assert.match(body(await f.post(action, { kind: "list_reply" })), /No pude completar/);
      assert.equal(f.calls().length, baseline); assert.equal(writes(f).length, 0);
      assert.equal(bookingState(source.bookingRequestId), "confirmed");
    });

    test("uncertain reschedule's historical status resolves after restart without a second Calendar patch", async () => {
      const source = await f.seed(), change = await f.intent(source, "reschedule");
      f.controls({ afterPatchReadError: true });
      assert.match(body(await f.post(`change:${change.requestId}:yes`, { kind: "button_reply" })), /verificación/);
      assert.equal(changeState(change.requestId), "uncertain"); assert.equal(writes(f).length, 1);
      await f.post("menu"); assert.equal(changeState(change.requestId), "uncertain");
      assert.equal(f.db.prepare("SELECT request_id FROM calendar_booking_locks").get().request_id, source.bookingRequestId);
      f.controls({}); await f.restart();
      assert.match(body(await f.post(`change:${change.requestId}:status`, { kind: "button_reply" })), /está reagendada/);
      assert.equal(changeState(change.requestId), "applied"); assert.equal(writes(f).length, 1);
      assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 0);
    });
  }
});

for (const config of [
  { mode: "booking", routing: "development", reliable: false, management: false },
  { mode: "support", routing: "development", reliable: true, management: false },
  { mode: "availability", routing: "development", reliable: true, management: false },
  { mode: "booking", reliable: true, management: false, reminders: "dry-run" },
  { mode: "booking", reliable: false, management: true, reminders: "live" },
  { mode: "support", reliable: true, management: true, reminders: "dry-run" },
  { mode: "availability", reliable: true, management: true, reminders: "live" },
]) test(`incompatible startup flags fail closed without enabling features: ${JSON.stringify(config)}`, async () => {
  await assert.rejects(compatibilityFixture(config), /Reliable delivery requires|Automatic booking requires|Reminders require/);
});
