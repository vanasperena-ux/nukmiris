"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("./helpers/database.cjs");
const { prepareReliabilitySchema, createReliableDelivery, sendStoredReply } = require("../lib/reliable-delivery");
function fixture() {
  const db = createDatabase(); prepareReliabilitySchema(db); prepareReliabilitySchema(db);
  let clock = 1000000;
  const resolveBusiness = phone => db.prepare(`SELECT b.business_id,b.business_name,w.phone_number_id FROM businesses b
    JOIN business_whatsapp_connections w USING(business_id) WHERE w.phone_number_id=? AND b.status IN ('test','active')`).get(phone);
  const options = { db, capabilities: "synthetic-capabilities", resolveBusiness, now: () => clock, host: "synthetic-host", pid: 1001, processAlive: () => false };
  const queue = createReliableDelivery(options); queue.acquire();
  const payload = (text = "Menu", id = "synthetic-id", sender = "synthetic-customer", business = "a") => ({ entry: [{ changes: [{ value: {
    metadata: { phone_number_id: `phone-synthetic-${business}` }, messages: [{ id, from: sender, type: "text", text: { body: text } }],
  } }] }] });
  const reply = (body = "Synthetic reply", to = "synthetic-customer") => ({ messaging_product: "whatsapp", to, type: "text", text: { body } });
  return { db, queue, options, payload, reply, advance: ms => { clock += ms; } };
}
test("incoming messages persist, deduplicate across owners, and conflicting batches roll back", () => {
  const f = fixture();
  try {
    assert.equal(f.queue.accept(f.payload()), 1);
    assert.equal(f.queue.accept(f.payload()), 0);
    const batch = f.payload("Other", "new-id");
    batch.entry[0].changes[0].value.messages.push(f.payload("Conflicting").entry[0].changes[0].value.messages[0]);
    assert.throws(() => f.queue.accept(batch), /Conflicting/);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM message_inbox").get().n, 1);
    const other = createReliableDelivery({ ...f.options, pid: 1002 }); other.acquire();
    assert.equal(other.accept(f.payload()), 0);
    assert.throws(() => f.queue.claimInput(), /ownership/);
    other.release();
  } finally { f.db.close(); }
});
test("unsupported events and unknown business numbers do not create work; invalid supported messages cannot be acknowledged", () => {
  const f = fixture();
  try {
    assert.equal(f.queue.accept(f.payload("Menu", "unknown", "synthetic-customer", "unknown")), 0);
    const body = f.payload(); body.entry[0].changes[0].value.messages[0].type = "image";
    assert.equal(f.queue.accept(body), 0);
    const missing = f.payload(); delete missing.entry[0].changes[0].value.messages[0].id;
    assert.throws(() => f.queue.accept(missing), /stable ID/);
    assert.throws(() => f.queue.accept({}), /shape/);
  } finally { f.db.close(); }
});
test("a crash before reply creation restores the previous menu and human-support state", () => {
  const f = fixture();
  try {
    f.db.prepare("INSERT INTO business_customer_sessions VALUES ('synthetic-a','synthetic-customer',?,?)").run('{"mode":"old-menu"}', 9999999);
    f.queue.accept(f.payload()); const input = f.queue.claimInput();
    f.db.prepare("UPDATE business_customer_sessions SET session_json=?").run('{"mode":"not-yet-delivered"}');
    f.db.exec("INSERT INTO business_support_conversations VALUES ('synthetic-a','synthetic-customer',NULL,'waiting',NULL,'fixture','fixture')");
    f.db.exec("INSERT INTO business_support_messages VALUES ('synthetic-id','synthetic-a','synthetic-customer','incoming','synthetic','fixture')");
    const next = createReliableDelivery({ ...f.options, pid: 1002 }); next.acquire();
    const resumed = next.claimInput();
    assert.equal(resumed.inbox_id, input.inbox_id);
    assert.equal(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json, '{"mode":"old-menu"}');
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM business_support_conversations").get().n, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM business_support_messages").get().n, 0);
  } finally { f.db.close(); }
});
test("receipt and continuation are atomic and survive recovery without restoring an older session", () => {
  const f = fixture();
  try {
    f.queue.accept(f.payload()); const input = f.queue.claimInput();
    const continuation = { kind: "booking", requestId: "synthetic-request", decision: "yes" };
    assert.throws(() => f.queue.checkpoint(input.inbox_id, continuation, () => { throw new Error("Synthetic storage failure"); }));
    assert.equal(f.db.prepare("SELECT continuation_json FROM message_inbox").get().continuation_json, null);
    f.queue.checkpoint(input.inbox_id, continuation, () => {
      f.db.prepare("INSERT INTO business_customer_sessions VALUES ('synthetic-a','synthetic-customer',?,?)").run('{"mode":"booking_result"}', 9999999);
    });
    assert.throws(() => f.queue.checkpoint(input.inbox_id, { ...continuation, requestId: "other" }), /continuation/);
    const next = createReliableDelivery({ ...f.options, pid: 1002 }); next.acquire();
    assert.deepEqual(next.claimInput().continuation, continuation);
    assert.equal(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json, '{"mode":"booking_result"}');
  } finally { f.db.close(); }
});
test("all menu reply chunks and completion are committed together, and a restart sends stored payloads", () => {
  const f = fixture();
  try {
    f.queue.accept(f.payload()); const input = f.queue.claimInput();
    f.queue.outputs(input.inbox_id, [f.reply("Overview"), f.reply("Buttons")]);
    assert.equal(f.db.prepare("SELECT state FROM message_inbox").get().state, "completed");
    const next = createReliableDelivery({ ...f.options, pid: 1002 }); next.acquire();
    assert.equal(next.claimInput(), null);
    const first = next.claimOutput();
    assert.equal(first.payload.text.body, "Overview");
    assert.match(first.payload.biz_opaque_callback_data, /^nukmiris:/);
    next.outputResult(first, { state: "accepted", metaMessageId: "meta-one" });
    assert.equal(next.claimOutput().payload.text.body, "Buttons");
  } finally { f.db.close(); }
});
test("customer ordering waits for previous replies while other customers and businesses can proceed", () => {
  const f = fixture();
  try {
    f.queue.accept(f.payload("one", "one")); f.queue.accept(f.payload("two", "two"));
    f.queue.accept(f.payload("three", "three", "synthetic-other"));
    f.queue.accept(f.payload("four", "four", "synthetic-customer", "b"));
    const one = f.queue.claimInput(); f.queue.outputs(one.inbox_id, [f.reply()]);
    const other = f.queue.claimInput(); assert.equal(other.sender, "synthetic-other"); f.queue.complete(other.inbox_id);
    const business = f.queue.claimInput(); assert.equal(business.business_id, "synthetic-b"); f.queue.complete(business.inbox_id);
    assert.equal(f.queue.claimInput(), null);
    const outgoing = f.queue.claimOutput(); f.queue.outputResult(outgoing, { state: "accepted", metaMessageId: "accepted" });
    assert.equal(f.queue.claimInput().message_id, "two");
  } finally { f.db.close(); }
});
test("live or foreign-host owners cannot be replaced by a timeout", () => {
  const f = fixture();
  try {
    assert.throws(() => createReliableDelivery({ ...f.options, pid: 1002, processAlive: () => true }).acquire(), /Another/);
    f.advance(1000000000);
    assert.throws(() => createReliableDelivery({ ...f.options, host: "another-host" }).acquire(), /Another/);
    assert.equal(f.db.prepare("SELECT pid FROM delivery_worker").get().pid, 1001);
  } finally { f.db.close(); }
});
test("a restart during a Meta send retains uncertainty and does not blindly resend", () => {
  const f = fixture();
  try {
    f.queue.accept(f.payload()); const input = f.queue.claimInput(); f.queue.outputs(input.inbox_id, [f.reply()]);
    f.queue.claimOutput();
    const next = createReliableDelivery({ ...f.options, pid: 1002 }); next.acquire();
    assert.equal(next.claimOutput(), null);
    assert.equal(f.db.prepare("SELECT state FROM message_outbox").get().state, "uncertain");
  } finally { f.db.close(); }
});
test("signed Meta receipts resolve uncertain sends only for the matching business and recipient", () => {
  const f = fixture();
  try {
    f.queue.accept(f.payload()); const input = f.queue.claimInput(); f.queue.outputs(input.inbox_id, [f.reply()]);
    const outgoing = f.queue.claimOutput(); f.queue.outputResult(outgoing, { state: "uncertain", error: "synthetic" });
    const body = f.payload(); body.entry[0].changes[0].value.messages = [];
    const status = { id: "meta-known", status: "delivered", recipient_id: "synthetic-customer", biz_opaque_callback_data: outgoing.payload.biz_opaque_callback_data };
    body.entry[0].changes[0].value.statuses = [{ ...status, recipient_id: "wrong" }];
    f.queue.accept(body); assert.equal(f.db.prepare("SELECT state FROM message_outbox").get().state, "uncertain");
    body.entry[0].changes[0].value.statuses = [{ ...status, status: "failed" }]; f.queue.accept(body);
    assert.equal(f.db.prepare("SELECT state FROM message_outbox").get().state, "failed");
    body.entry[0].changes[0].value.statuses = [{ ...status, status: "sent" }]; f.queue.accept(body);
    assert.equal(f.db.prepare("SELECT state FROM message_outbox").get().state, "failed");
    body.entry[0].changes[0].value.statuses = [status]; f.queue.accept(body);
    assert.equal(f.db.prepare("SELECT state FROM message_outbox").get().state, "accepted");
    body.entry[0].changes[0].value.statuses = [{ ...status, status: "sent" }]; f.queue.accept(body);
    assert.equal(f.db.prepare("SELECT meta_status FROM message_outbox").get().meta_status, "delivered");
    f.queue.outputResult(outgoing, { state: "uncertain", error: "late_timeout" });
    assert.equal(f.db.prepare("SELECT state FROM message_outbox").get().state, "accepted");
  } finally { f.db.close(); }
});
test("safe rejection retries use backoff and explicit uncertain retries stay business-scoped", () => {
  const f = fixture();
  try {
    for (const business of ["a", "b"]) {
      f.queue.accept(f.payload("Menu", business, "synthetic-customer", business)); const input = f.queue.claimInput(); f.queue.outputs(input.inbox_id, [f.reply()]);
    }
    const one = f.queue.claimOutput(); f.queue.outputResult(one, { state: "pending", error: "meta_http_503" });
    const two = f.queue.claimOutput(); f.queue.outputResult(two, { state: "uncertain", error: "unknown" });
    assert.equal(f.queue.claimOutput(), null);
    f.advance(4000); const retry = f.queue.claimOutput(); assert.equal(retry.outbox_id, one.outbox_id);
    f.queue.outputResult(retry, { state: "uncertain", error: "unknown" });
    f.queue.retry({ businessId: "synthetic-a" }); assert.equal(f.queue.claimOutput(), null);
    f.queue.retry({ businessId: "synthetic-a", uncertain: true });
    assert.equal(f.queue.claimOutput().outbox_id, one.outbox_id);
    assert.equal(f.db.prepare("SELECT state FROM message_outbox WHERE outbox_id=?").get(two.outbox_id).state, "uncertain");
  } finally { f.db.close(); }
});
test("expired interactive prompts are retained as history and do not block fresh customer messages", () => {
  const f = fixture();
  try {
    f.queue.accept(f.payload()); const input = f.queue.claimInput();
    f.db.prepare("INSERT INTO business_customer_sessions VALUES ('synthetic-a','synthetic-customer','{}',?)").run(1000001);
    f.queue.outputs(input.inbox_id, [{ ...f.reply(), type: "interactive", interactive: { action: { buttons: [{ reply: { id: "menu:synthetic:book" } }] } } }]);
    f.advance(2); assert.equal(f.queue.claimOutput(), null);
    assert.equal(f.db.prepare("SELECT state FROM message_outbox").get().state, "expired");
    f.queue.accept(f.payload("Menu", "fresh")); assert.equal(f.queue.claimInput().message_id, "fresh");
  } finally { f.db.close(); }
});
test("wrong recipients and changed runtime capabilities fail closed without Calendar work", () => {
  const f = fixture();
  try {
    f.queue.accept(f.payload()); const input = f.queue.claimInput();
    assert.throws(() => f.queue.outputs(input.inbox_id, [f.reply("wrong", "other-customer")]), /recipient/);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM message_outbox").get().n, 0);
    const next = createReliableDelivery({ ...f.options, pid: 1002, capabilities: "changed" }); next.acquire();
    assert.equal(next.claimInput().blocked, true);
    assert.equal(f.db.prepare("SELECT state FROM message_inbox").get().state, "blocked");
  } finally { f.db.close(); }
});
test("Meta delivery distinguishes verified acceptance, rejection, and unknown outcomes", async () => {
  const row = { phone_number_id: "synthetic-phone", payload: { synthetic: true } };
  const cases = [
    [200, { messages: [{ id: "synthetic-meta" }] }, "accepted"], [503, { error: { code: 1 } }, "pending"],
    [429, { error: { code: 1 } }, "pending"], [403, { error: { code: 1 } }, "failed"], [200, {}, "uncertain"],
  ];
  for (const [status, payload, expected] of cases) {
    const result = await sendStoredReply({ row, token: "synthetic", request: async () => new Response(JSON.stringify(payload), { status }) });
    assert.equal(result.state, expected);
  }
  assert.equal((await sendStoredReply({ row, token: "synthetic", request: async () => { throw new Error("unknown delivery"); } })).state, "uncertain");
});
test("handler errors retry from the saved session, back off, and require review after five attempts", () => {
  const f = fixture();
  try {
    f.db.prepare("INSERT INTO business_customer_sessions VALUES ('synthetic-a','synthetic-customer',?,?)").run('{"mode":"before"}', 9999999);
    f.queue.accept(f.payload());
    for (let attempt = 0; attempt < 5; attempt++) {
      const input = f.queue.claimInput(); assert(input);
      assert.equal(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json, '{"mode":"before"}');
      f.db.prepare("UPDATE business_customer_sessions SET session_json=?").run('{"mode":"interrupted"}');
      f.queue.inputFailed(input.inbox_id); assert.equal(f.queue.claimInput(), null);
      f.advance(60001);
    }
    assert.equal(f.db.prepare("SELECT state FROM message_inbox").get().state, "blocked");
    f.queue.retry({ businessId: "synthetic-b" }); assert.equal(f.queue.claimInput(), null);
    f.queue.retry({ businessId: "synthetic-a" }); assert(f.queue.claimInput());
    assert.equal(f.db.prepare("SELECT session_json FROM business_customer_sessions").get().session_json, '{"mode":"before"}');
  } finally { f.db.close(); }
});
