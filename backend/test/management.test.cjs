"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const { fixture } = require("./helpers/management-fixture.cjs");
const { prepareManagementSchema, createAppointmentManagement } = require("../lib/appointment-management");
const countLocks = f => f.db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n;
const eventFor = (f, source) => f.events.get(`calendar-${source.businessId}:${source.eventId}`);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test("management schema is additive and repeatable, with a backup made before preparation", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-management-prepare-"));
  const filename = path.join(directory, "synthetic.sqlite");
  const f = fixture(filename);
  try {
    const source = await f.seed();
    f.db.exec("DROP TABLE appointment_changes");
    const result = spawnSync(process.execPath, [path.resolve(__dirname, "../scripts/prepare-management.js")], {
      env: { ...process.env, NODE_ENV: "test", NUKMIRIS_DB_PATH: filename }, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const backup = fs.readdirSync(directory).find(name => name.includes(".before-management-"));
    assert(backup);
    const old = new DatabaseSync(path.join(directory, backup), { readOnly: true });
    try { assert(!old.prepare("SELECT 1 FROM sqlite_master WHERE name='appointment_changes'").get()); }
    finally { old.close(); }
    prepareManagementSchema(f.db);
    assert.equal(f.db.prepare("SELECT state FROM booking_requests WHERE request_id=?").get(source.bookingRequestId).state, "confirmed");
    assert.equal(f.deletes.length + f.patches.length, 0);
  } finally { f.db.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
test("choosing or declining cancellation never changes the event", async () => {
  const f = fixture();
  try {
    const source = await f.seed(), offer = await f.intent(source, "cancel");
    assert.equal(f.deletes.length, 0);
    assert.equal(f.management.decline(f.changeScope(offer.requestId)).status, "declined");
    assert.equal((await f.management.confirm(f.changeScope(offer.requestId))).status, "declined");
    assert.equal(eventFor(f, source).status, "confirmed");
    assert.equal(f.deletes.length, 0);
  } finally { f.db.close(); }
});
test("confirmed cancellation deletes only the owned event once and cannot resurrect a booking", async () => {
  const f = fixture();
  try {
    const source = await f.seed(), etag = eventFor(f, source).etag;
    const offer = await f.intent(source, "cancel"), scope = f.changeScope(offer.requestId);
    assert.equal((await f.management.confirm(scope)).status, "applied");
    assert.equal((await f.managementService().confirm(scope)).status, "applied");
    assert.equal(f.deletes.length, 1);
    assert.equal(f.deletes[0].args.calendarId, "calendar-synthetic-a");
    assert.equal(f.deletes[0].args.eventId, source.eventId);
    assert.equal(f.deletes[0].options.headers["If-Match"], etag);
    assert.equal(f.deletes[0].args.sendUpdates, "none");
    assert.equal(countLocks(f), 0);
    assert.equal((await f.booking.confirm({ ...source, requestId: source.bookingRequestId })).status, "removed");
    assert.equal(f.inserts.length, 1);
    assert((await f.availability.listSlots(source.businessId)).some(slot => slot.start === f.slot(10).start));
  } finally { f.db.close(); }
});
test("rescheduling moves the same event, preserves its other fields, and updates the booking journal", async () => {
  const f = fixture();
  try {
    const source = await f.seed();
    eventFor(f, source).description = "Preserve this business note";
    eventFor(f, source).extendedProperties.private.custom = "preserved";
    const offer = await f.intent(source), scope = f.changeScope(offer.requestId);
    assert.equal(f.patches.length, 0);
    assert.equal((await f.management.confirm(scope)).status, "applied");
    assert.equal((await f.managementService().confirm(scope)).status, "applied");
    assert.equal(f.patches.length, 1);
    assert.equal(f.inserts.length, 1);
    assert.equal(eventFor(f, source).id, source.eventId);
    assert.equal(eventFor(f, source).start.dateTime, f.slot(11).start);
    assert.equal(eventFor(f, source).description, "Preserve this business note");
    assert.equal(eventFor(f, source).extendedProperties.private.custom, "preserved");
    assert.equal(f.patches[0].args.requestBody.summary, undefined);
    const original = await f.booking.confirm({ ...source, requestId: source.bookingRequestId });
    assert.equal(original.start, f.slot(11).start);
    assert.equal(countLocks(f), 0);
    const slots = await f.availability.listSlots(source.businessId);
    assert(slots.some(slot => slot.start === f.slot(10).start));
    assert(!slots.some(slot => slot.start === f.slot(11).start));
  } finally { f.db.close(); }
});

for (const lostResponse of [false, true]) test(`rescheduling preserves new customer details and ownership${lostResponse ? " after a lost response" : ""}`, async () => {
  const f = fixture();
  try {
    const sender = "5215500000002";
    f.db.prepare("INSERT INTO business_customers VALUES (?,?,?,?,?,?)")
      .run("synthetic-phone-customer", "synthetic-a", sender, "Cliente de Prueba", "fixture", "fixture");
    const source = await f.seed({ sender });
    const before = structuredClone(eventFor(f, source));
    assert.equal(before.summary, "Cliente de Prueba — Cita");
    assert.equal(before.description, "Cliente: Cliente de Prueba\nWhatsApp: +525500000002\nEstado: Reservada\nOrigen: NukMiris WhatsApp");
    const offer = await f.intent(source), scope = f.changeScope(offer.requestId, source.businessId, sender);
    if (lostResponse) f.controls.afterPatchError = 503;
    assert.equal((await f.management.confirm(scope)).status, "applied");
    assert.equal((await f.managementService().confirm(scope)).status, "applied");
    const after = eventFor(f, source);
    assert.equal(after.summary, before.summary); assert.equal(after.description, before.description);
    assert.equal(after.id, before.id); assert.equal(after.start.dateTime, f.slot(11).start);
    assert.deepEqual(after.extendedProperties.private, { ...before.extendedProperties.private, nukmirisChangeRequestId: offer.requestId });
    assert.deepEqual(Object.keys(f.patches[0].args.requestBody).sort(), ["end", "extendedProperties", "start"]);
    assert.equal(f.inserts.length, 1); assert.equal(f.patches.length, 1);
  } finally { f.db.close(); }
});

test("rescheduling a legacy event does not replace its title or description with the new format", async () => {
  const f = fixture();
  try {
    const source = await f.seed(), event = eventFor(f, source);
    event.summary = "Business synthetic-a — Cliente Sintético";
    event.description = "Appointment confirmed through NukMiris WhatsApp.";
    const before = structuredClone(event);
    const offer = await f.intent(source);
    assert.equal((await f.management.confirm(f.changeScope(offer.requestId))).status, "applied");
    assert.equal(eventFor(f, source).summary, before.summary);
    assert.equal(eventFor(f, source).description, before.description);
    assert.equal(eventFor(f, source).id, before.id);
    assert.equal(f.patches.length, 1); assert.equal(f.inserts.length, 1);
  } finally { f.db.close(); }
});
test("business/customer scope and original ownership are checked for listing and both actions", async () => {
  const f = fixture();
  try {
    const source = await f.seed(), offer = await f.intent(source, "cancel");
    for (const foreign of [{ ...source, businessId: "synthetic-b" }, { ...source, sender: "synthetic-two" }]) {
      assert.deepEqual(await f.management.listAppointments(foreign), []);
      await assert.rejects(f.management.readAppointment(foreign));
      assert.equal((await f.management.confirm({ ...foreign, requestId: offer.requestId })).status, "invalid");
    }
    eventFor(f, source).extendedProperties.private.nukmirisCustomerId = "synthetic-two";
    assert.deepEqual(await f.management.listAppointments(source), []);
    assert.equal((await f.management.confirm(f.changeScope(offer.requestId))).status, "rejected");
    assert.equal(f.deletes.length + f.patches.length, 0);
  } finally { f.db.close(); }
});
test("changed calendar mappings and expired confirmations cannot write", async () => {
  for (const reason of ["mapping", "expiry"]) {
    const f = fixture();
    try {
      const source = await f.seed(), offer = await f.intent(source);
      if (reason === "mapping") f.db.prepare("UPDATE business_calendar_connections SET google_calendar_id='synthetic-other' WHERE business_id='synthetic-a'").run();
      else f.setNow("2026-10-26T09:16:00-06:00");
      assert.equal((await f.management.confirm(f.changeScope(offer.requestId))).status, "rejected");
      assert.equal(f.patches.length, 0);
      assert.equal(countLocks(f), 0);
    } finally { f.db.close(); }
  }
});
test("an event edited after selection or immediately before either write is protected by its ETag", async () => {
  for (const kind of ["reschedule", "cancel"]) {
    for (const timing of ["before-confirm", "during-write"]) {
      const f = fixture();
      try {
        const source = await f.seed(), offer = await f.intent(source, kind);
        if (timing === "before-confirm") eventFor(f, source).etag = '"manually-edited"';
        else f.controls[kind === "cancel" ? "beforeDelete" : "beforePatch"] = async () => { eventFor(f, source).etag = '"manually-edited"'; };
        assert.equal((await f.management.confirm(f.changeScope(offer.requestId))).status, "rejected");
        assert.equal(eventFor(f, source).start.dateTime, f.slot(10).start);
        assert.equal(eventFor(f, source).status, "confirmed");
        assert.equal(countLocks(f), 0);
      } finally { f.db.close(); }
    }
  }
});
test("a newly busy target leaves the original appointment in place", async () => {
  const f = fixture();
  try {
    const source = await f.seed(), offer = await f.intent(source);
    f.events.set("calendar-synthetic-a:external", { id: "external", start: { dateTime: f.slot(11).start }, end: { dateTime: f.slot(11).end } });
    assert.equal((await f.management.confirm(f.changeScope(offer.requestId))).status, "rejected");
    assert.equal(f.patches.length, 0);
    assert.equal(eventFor(f, source).start.dateTime, f.slot(10).start);
  } finally { f.db.close(); }
});
test("overlapping moves ignore the customer's own event while retaining all other busy events", async () => {
  const f = fixture();
  try {
    f.db.prepare("UPDATE business_settings SET appointment_duration_minutes=120 WHERE business_id='synthetic-a'").run();
    const source = await f.seed({ duration: 120 });
    assert((await f.management.listSlots(source)).some(slot => slot.start === f.slot(11, 120).start));
    f.events.set("calendar-synthetic-a:external", { id: "external", start: { dateTime: f.slot(12).start }, end: { dateTime: f.slot(12).end } });
    assert(!(await f.management.listSlots(source)).some(slot => slot.start === f.slot(11, 120).start));
    f.events.delete("calendar-synthetic-a:external");
    const offer = await f.intent(source, "reschedule", 11, 120);
    assert.equal((await f.management.confirm(f.changeScope(offer.requestId))).status, "applied");
  } finally { f.db.close(); }
});
test("reschedule availability follows event pages, blocks all-day events, and ignores transparent/cancelled events", async () => {
  const f = fixture();
  try {
    const source = await f.seed();
    f.controls.listPages = {
      first: { items: [{ id: "transparent", transparency: "transparent" }, { id: "cancelled", status: "cancelled" }], nextPageToken: "second" },
      second: { items: [{ id: "all-day", start: { date: "2026-10-27" }, end: { date: "2026-10-28" } }] },
    };
    const slots = await f.management.listSlots(source);
    assert(!slots.some(slot => slot.start.startsWith("2026-10-27")));
    assert(slots.some(slot => slot.start.startsWith("2026-10-26")));
    assert.equal(f.lists[1].pageToken, "second");
    assert(f.lists.every(call => call.calendarId === "calendar-synthetic-a" && call.singleEvents));
  } finally { f.db.close(); }
});
test("manual/unowned, past, and recurring events cannot be managed", async () => {
  for (const change of [event => { event.extendedProperties = {}; }, event => { event.recurringEventId = "synthetic-series"; },
    event => { event.start.dateTime = "2026-10-25T10:00:00-06:00"; event.end.dateTime = "2026-10-25T11:00:00-06:00"; }]) {
    const f = fixture();
    try {
      const source = await f.seed(); change(eventFor(f, source));
      assert.deepEqual(await f.management.listAppointments(source), []);
      await assert.rejects(f.intent(source, "cancel"));
      assert.equal(f.deletes.length, 0);
    } finally { f.db.close(); }
  }
});
test("missing permission and calendar read failures fail before any write", async () => {
  const f = fixture();
  try {
    const source = await f.seed(), offer = await f.intent(source, "cancel");
    const denied = createAppointmentManagement({ db: f.db, availability: f.availability, enabled: true,
      verifyAuthorization: async () => { throw new Error("Synthetic denied permission"); } });
    await assert.rejects(denied.confirm(f.changeScope(offer.requestId)));
    f.controls.failList = true;
    await assert.rejects(f.management.listSlots(source));
    assert.equal(f.patches.length + f.deletes.length, 0);
    assert.equal(countLocks(f), 0);
  } finally { f.db.close(); }
});
test("lost reschedule and cancellation responses are recovered without repeating the write", async () => {
  for (const kind of ["reschedule", "cancel"]) {
    const f = fixture();
    try {
      const source = await f.seed(), offer = await f.intent(source, kind), scope = f.changeScope(offer.requestId);
      f.controls[kind === "cancel" ? "afterDeleteError" : "afterPatchError"] = 503;
      assert.equal((await f.management.confirm(scope)).status, "applied");
      assert.equal((await f.managementService().confirm(scope)).status, "applied");
      assert.equal(f.patches.length + f.deletes.length, 1);
      assert.equal(countLocks(f), 0);
    } finally { f.db.close(); }
  }
});
test("unresolved writes persist protection, do not retry, and block new bookings and other changes", async () => {
  const f = fixture();
  try {
    const source = await f.seed(), offer = await f.intent(source), scope = f.changeScope(offer.requestId);
    f.controls.patchError = 503;
    assert.equal((await f.management.confirm(scope)).status, "uncertain");
    assert.equal((await f.managementService().confirm(scope)).status, "uncertain");
    assert.equal(f.management.decline(scope).status, "uncertain");
    assert.equal(f.patches.length, 1);
    assert.equal(countLocks(f), 1);
    const next = f.booking.createIntent({ businessId: source.businessId, sender: "synthetic-two", calendarId: "calendar-synthetic-a", slot: f.slot(12) });
    assert.equal((await f.booking.confirm({ businessId: source.businessId, sender: "synthetic-two", requestId: next.requestId })).status, "busy");
    const cancellation = await f.intent(source, "cancel");
    assert.equal((await f.management.confirm(f.changeScope(cancellation.requestId))).status, "busy");
    const event = eventFor(f, source);
    event.start.dateTime = offer.start; event.end.dateTime = offer.end;
    event.extendedProperties.private.nukmirisChangeRequestId = offer.requestId;
    assert.equal((await f.management.reconcile(scope)).status, "applied");
    assert.equal(countLocks(f), 0);
  } finally { f.db.close(); }
});
test("an ambiguous cancellation remains protected until Google confirms the event is gone", async () => {
  const f = fixture();
  try {
    const source = await f.seed(), offer = await f.intent(source, "cancel"), scope = f.changeScope(offer.requestId);
    f.controls.deleteError = 503;
    assert.equal((await f.management.confirm(scope)).status, "uncertain");
    assert.equal((await f.management.confirm(scope)).status, "uncertain");
    assert.equal(f.deletes.length, 1);
    f.events.delete(`calendar-${source.businessId}:${source.eventId}`);
    assert.equal((await f.management.reconcile(scope)).status, "applied");
    assert.equal(countLocks(f), 0);
  } finally { f.db.close(); }
});
test("concurrent duplicate confirmation performs one patch and recovery reads only", async () => {
  const f = fixture(), entered = deferred(), release = deferred();
  try {
    const source = await f.seed(), offer = await f.intent(source), scope = f.changeScope(offer.requestId);
    f.controls.beforePatch = async () => { entered.resolve(); await release.promise; };
    const first = f.management.confirm(scope);
    await entered.promise;
    assert.equal((await f.managementService().confirm(scope)).status, "uncertain");
    release.resolve();
    assert.equal((await first).status, "applied");
    assert.equal(f.patches.length, 1);
  } finally { release.resolve(); f.db.close(); }
});
test("separate SQLite connections share management protection and recover after reopening", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-management-persist-"));
  const filename = path.join(directory, "synthetic.sqlite");
  const f = fixture(filename);
  let other;
  try {
    const source = await f.seed(), offer = await f.intent(source), scope = f.changeScope(offer.requestId);
    f.controls.patchError = 503;
    await f.management.confirm(scope);
    other = new DatabaseSync(filename); other.exec("PRAGMA foreign_keys=ON");
    assert.equal((await f.managementService(other).confirm(scope)).status, "uncertain");
    other.close(); other = new DatabaseSync(filename);
    assert.equal((await f.managementService(other).reconcile(scope)).status, "uncertain");
    assert.equal(f.patches.length, 1);
    assert.equal(other.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 1);
  } finally { if (other) other.close(); f.db.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
test("a competing customer cannot move into a slot just taken by a completed reschedule", async () => {
  const f = fixture(), entered = deferred(), release = deferred();
  try {
    const first = await f.seed(), second = await f.seed({ sender: "synthetic-two", hour: 12 });
    const one = await f.intent(first), two = await f.intent(second);
    f.controls.beforePatch = async () => { entered.resolve(); await release.promise; };
    const pending = f.management.confirm(f.changeScope(one.requestId));
    await entered.promise;
    const scope = f.changeScope(two.requestId, "synthetic-a", "synthetic-two");
    assert.equal((await f.management.confirm(scope)).status, "busy");
    release.resolve(); await pending;
    assert.equal((await f.management.confirm(scope)).status, "rejected");
    assert.equal(f.patches.length, 1);
    assert.equal(eventFor(f, second).start.dateTime, f.slot(12).start);
  } finally { release.resolve(); f.db.close(); }
});
test("a late booking response cannot release or overwrite a subsequent management lock", async () => {
  const f = fixture(), stored = deferred(), releaseInsert = deferred(), deleting = deferred(), releaseDelete = deferred();
  try {
    f.controls.afterInsert = async () => { stored.resolve(); await releaseInsert.promise; throw f.error(503); };
    const original = f.booking.createIntent({ businessId: "synthetic-a", sender: "synthetic-one", calendarId: "calendar-synthetic-a", slot: f.slot(10) });
    const bookingScope = { businessId: "synthetic-a", sender: "synthetic-one", requestId: original.requestId };
    const pending = f.booking.confirm(bookingScope);
    await stored.promise;
    assert.equal((await f.bookingService().confirm(bookingScope)).status, "confirmed");
    const offer = await f.intent(f.scope(original.requestId), "cancel");
    f.controls.beforeDelete = async () => { deleting.resolve(); await releaseDelete.promise; };
    const cancellation = f.management.confirm(f.changeScope(offer.requestId));
    await deleting.promise;
    releaseInsert.resolve(); await pending;
    assert.equal(countLocks(f), 1);
    assert.equal(f.db.prepare("SELECT state FROM booking_requests WHERE request_id=?").get(original.requestId).state, "confirmed");
    releaseDelete.resolve(); assert.equal((await cancellation).status, "applied");
  } finally { releaseInsert.resolve(); releaseDelete.resolve(); f.db.close(); }
});
test("a late change response cannot resurrect an applied request or release a newer lock", async () => {
  const f = fixture(), patched = deferred(), releasePatch = deferred(), deleting = deferred(), releaseDelete = deferred();
  try {
    const source = await f.seed(), offer = await f.intent(source), scope = f.changeScope(offer.requestId);
    f.controls.afterPatch = async () => { patched.resolve(); await releasePatch.promise; throw f.error(503); };
    const pending = f.management.confirm(scope);
    await patched.promise;
    assert.equal((await f.managementService().confirm(scope)).status, "applied");
    const cancel = await f.intent(source, "cancel");
    f.controls.beforeDelete = async () => { deleting.resolve(); await releaseDelete.promise; };
    const cancellation = f.management.confirm(f.changeScope(cancel.requestId));
    await deleting.promise;
    releasePatch.resolve(); assert.equal((await pending).status, "applied");
    assert.equal(countLocks(f), 1);
    assert.equal(f.db.prepare("SELECT state FROM appointment_changes WHERE request_id=?").get(offer.requestId).state, "applied");
    releaseDelete.resolve(); assert.equal((await cancellation).status, "applied");
  } finally { releasePatch.resolve(); releaseDelete.resolve(); f.db.close(); }
});
test("a confirmed journal entry protects a target even if the event list temporarily omits it", async () => {
  const f = fixture();
  try {
    const source = await f.seed(), offer = await f.intent(source);
    const other = await f.seed({ sender: "synthetic-two", hour: 11 });
    f.controls.omitIds = new Set([other.eventId]);
    assert.equal((await f.management.confirm(f.changeScope(offer.requestId))).status, "rejected");
    assert.equal(f.patches.length, 0);
  } finally { f.db.close(); }
});
test("a mismatched reschedule recovery never claims success", async () => {
  const f = fixture();
  try {
    const source = await f.seed(), offer = await f.intent(source), scope = f.changeScope(offer.requestId);
    f.controls.patchError = 503;
    await f.management.confirm(scope);
    eventFor(f, source).start.dateTime = offer.start; eventFor(f, source).end.dateTime = offer.end;
    assert.equal((await f.management.reconcile(scope)).status, "uncertain");
    assert.equal(countLocks(f), 1);
  } finally { f.db.close(); }
});
test("management is disabled unless opted in and startup never prepares its journal implicitly", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-management-start-"));
  const filename = path.join(directory, "synthetic.sqlite"), f = fixture(filename);
  try {
    const source = await f.seed(), offer = await f.intent(source, "cancel");
    const disabled = createAppointmentManagement({ db: f.db, availability: f.availability });
    assert.equal((await disabled.confirm(f.changeScope(offer.requestId))).status, "disabled");
    await assert.rejects(disabled.listAppointments(source));
    f.db.exec("DROP TABLE appointment_changes");
    const result = spawnSync(process.execPath, [path.resolve(__dirname, "../whatsapp-webhook.js")], {
      env: { ...process.env, NODE_ENV: "test", NUKMIRIS_DB_PATH: filename, NUKMIRIS_MODE: "booking",
        NUKMIRIS_ROUTING_MODE: "receiving_number", NUKMIRIS_ENABLE_MANAGEMENT: "true",
        WHATSAPP_TOKEN: "synthetic", WHATSAPP_PHONE_NUMBER_ID: "synthetic", WHATSAPP_VERIFY_TOKEN: "synthetic", META_APP_SECRET: "synthetic" },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /prerequisite missing: appointment_changes/);
    assert(!f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='appointment_changes'").get());
    assert.equal(f.deletes.length + f.patches.length, 0);
  } finally { f.db.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
test("late recovery reads for bookings and changes cannot release a newer cancellation's lock", async () => {
  for (const kind of ["booking", "change"]) {
    const f = fixture(), reading = deferred(), releaseRead = deferred(), deleting = deferred(), releaseDelete = deferred();
    try {
      const source = await f.seed();
      let recover;
      if (kind === "booking") {
        // Simulate a process stopping after insertion but before recording success.
        f.db.prepare("UPDATE booking_requests SET state='pending' WHERE request_id=?").run(source.bookingRequestId);
        f.db.prepare("INSERT INTO calendar_booking_locks VALUES (?,?,?)").run("calendar-synthetic-a", source.bookingRequestId, "fixture");
        recover = () => f.bookingService().reconcile({ ...source, requestId: source.bookingRequestId });
      } else {
        const offer = await f.intent(source), scope = f.changeScope(offer.requestId);
        f.controls.patchError = 503;
        await f.management.confirm(scope);
        const event = eventFor(f, source);
        event.start.dateTime = offer.start; event.end.dateTime = offer.end;
        event.extendedProperties.private.nukmirisChangeRequestId = offer.requestId;
        event.etag = '"late-application"';
        recover = () => f.managementService().reconcile(scope);
      }
      let firstRead = true;
      f.controls.afterGet = async () => { if (firstRead) { firstRead = false; reading.resolve(); await releaseRead.promise; } };
      const oldRecovery = recover();
      await reading.promise;
      await recover();
      const cancel = await f.intent(source, "cancel");
      f.controls.beforeDelete = async () => { deleting.resolve(); await releaseDelete.promise; };
      const cancellation = f.management.confirm(f.changeScope(cancel.requestId));
      await deleting.promise;
      releaseRead.resolve(); await oldRecovery;
      assert.equal(countLocks(f), 1);
      releaseDelete.resolve(); assert.equal((await cancellation).status, "applied");
    } finally { releaseRead.resolve(); releaseDelete.resolve(); f.db.close(); }
  }
});
