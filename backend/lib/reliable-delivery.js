"use strict";
const { createHash, randomUUID } = require("node:crypto");
const os = require("node:os");

function transaction(db, action) {
  db.exec("BEGIN IMMEDIATE");
  try { const value = action(); db.exec("COMMIT"); return value; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
function prepareReliabilitySchema(db) {
  transaction(db, () => db.exec(`
    CREATE TABLE IF NOT EXISTS message_inbox (
      inbox_id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id TEXT NOT NULL REFERENCES businesses(business_id),
      message_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      phone_number_id TEXT NOT NULL,
      message_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      capabilities TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('queued','processing','completed','blocked')),
      received_at INTEGER NOT NULL,
      customer_time INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      snapshot_json TEXT,
      continuation_json TEXT,
      last_error TEXT,
      UNIQUE(business_id,message_id)
    );
    CREATE INDEX IF NOT EXISTS idx_inbox_customer ON message_inbox(business_id,sender,inbox_id,state);
    CREATE TABLE IF NOT EXISTS message_outbox (
      outbox_id TEXT PRIMARY KEY,
      inbox_id INTEGER NOT NULL REFERENCES message_inbox(inbox_id),
      ordinal INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('pending','sending','accepted','uncertain','failed','expired')),
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      meta_message_id TEXT,
      meta_status TEXT,
      last_error TEXT,
      UNIQUE(inbox_id,ordinal)
    );
    CREATE INDEX IF NOT EXISTS idx_outbox_pending ON message_outbox(state,next_attempt_at,inbox_id,ordinal);
    CREATE TABLE IF NOT EXISTS delivery_worker (
      singleton INTEGER PRIMARY KEY CHECK(singleton=1),
      host TEXT NOT NULL,
      pid INTEGER NOT NULL,
      owner TEXT NOT NULL
    );
  `));
}
function normalizedRecipient(sender) { return /^521\d{10}$/.test(sender) ? "52" + sender.slice(3) : sender; }
function supportedMessage(message) {
  if (!message || typeof message.from !== "string" || !message.from || typeof message.id !== "string" || !message.id) return null;
  const base = { id: message.id, from: message.from, type: message.type };
  if (message.type === "text" && typeof message.text?.body === "string") return { ...base, text: { body: message.text.body } };
  const kind = message.interactive?.type;
  if (message.type === "interactive" && ["button_reply", "list_reply"].includes(kind) && typeof message.interactive[kind]?.id === "string") {
    return { ...base, interactive: { type: kind, [kind]: { id: message.interactive[kind].id } } };
  }
  return null;
}
function createReliableDelivery({ db, capabilities, resolveBusiness, now = Date.now,
  processAlive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code !== "ESRCH"; } },
  host = os.hostname(), pid = process.pid }) {
  let owner;
  function assertOwner() {
    const current = db.prepare("SELECT owner FROM delivery_worker WHERE singleton=1").get();
    if (!owner || current?.owner !== owner) throw new Error("Reliable delivery worker ownership was lost");
  }
  function acquire() {
    transaction(db, () => {
      const previous = db.prepare("SELECT * FROM delivery_worker WHERE singleton=1").get();
      if (previous && (previous.host !== host || processAlive(previous.pid))) throw new Error("Another reliability worker owns this database; stop that process first");
      owner = randomUUID();
      db.prepare("INSERT OR REPLACE INTO delivery_worker VALUES (1,?,?,?)").run(host, pid, owner);
      // No time-based lease stealing: an in-flight Calendar write may still be
      // running. Recovery is allowed only after the local owner process is dead.
      db.exec("UPDATE message_inbox SET state='queued' WHERE state='processing'; UPDATE message_outbox SET state='uncertain',last_error='restart_during_send' WHERE state='sending';");
    });
  }
  function release() {
    if (owner) db.prepare("DELETE FROM delivery_worker WHERE owner=?").run(owner);
    owner = undefined;
  }
  function receipt(business, status) {
    const reference = status?.biz_opaque_callback_data;
    if (typeof reference !== "string" || !reference.startsWith("nukmiris:")) return;
    const row = db.prepare(`SELECT o.*,i.sender,i.business_id,i.phone_number_id FROM message_outbox o
      JOIN message_inbox i USING(inbox_id) WHERE o.outbox_id=?`).get(reference.slice(9));
    if (!row || row.business_id !== business.business_id || row.phone_number_id !== business.phone_number_id ||
        typeof status.id !== "string" || (row.meta_message_id && row.meta_message_id !== status.id) ||
        normalizedRecipient(status.recipient_id || "") !== normalizedRecipient(row.sender)) return;
    if (["sent", "delivered", "read"].includes(status.status)) {
      const rank = { sent: 1, failed: 2, delivered: 2, read: 3 };
      if ((rank[row.meta_status] || 0) <= rank[status.status]) {
        db.prepare("UPDATE message_outbox SET state='accepted',meta_message_id=?,meta_status=?,last_error=NULL WHERE outbox_id=?")
          .run(status.id, status.status, row.outbox_id);
      }
    } else if (status.status === "failed" && !["delivered", "read"].includes(row.meta_status)) {
      db.prepare("UPDATE message_outbox SET state='failed',meta_message_id=?,meta_status='failed',last_error='meta_delivery_failed' WHERE outbox_id=?")
        .run(status.id, row.outbox_id);
    }
  }
  function accept(body) {
    assertOwner();
    if (!Array.isArray(body?.entry)) throw Object.assign(new Error("Invalid webhook shape"), { status: 400 });
    return transaction(db, () => {
      let inserted = 0;
      for (const entry of body.entry) {
        if (!Array.isArray(entry.changes)) continue;
        for (const change of entry.changes) {
          const phone = change.value?.metadata?.phone_number_id;
          const business = typeof phone === "string" ? resolveBusiness(phone) : null;
          if (!business) continue;
          for (const status of Array.isArray(change.value?.statuses) ? change.value.statuses : []) receipt(business, status);
          for (const raw of Array.isArray(change.value?.messages) ? change.value.messages : []) {
            const message = supportedMessage(raw);
            if (!message) {
              if (raw?.type === "text" || (raw?.type === "interactive" && ["button_reply", "list_reply"].includes(raw.interactive?.type))) {
                throw Object.assign(new Error("A supported message needs a stable ID and sender"), { status: 400 });
              }
              continue;
            }
            const json = JSON.stringify(message), hash = createHash("sha256").update(json).digest("hex");
            const existing = db.prepare("SELECT content_hash FROM message_inbox WHERE business_id=? AND message_id=?").get(business.business_id, message.id);
            if (existing) {
              if (existing.content_hash !== hash) throw Object.assign(new Error("Conflicting message identity"), { status: 409 });
              continue;
            }
            const timestamp = Number(raw.timestamp) * 1000;
            const customerTime = Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now() + 300000 ? timestamp : now();
            db.prepare(`INSERT INTO message_inbox
              (business_id,message_id,sender,phone_number_id,message_json,content_hash,capabilities,state,received_at,customer_time)
              VALUES (?,?,?,?,?,?,?,'queued',?,?)`).run(business.business_id, message.id, message.from,
                business.phone_number_id, json, hash, capabilities, now(), customerTime);
            inserted++;
          }
        }
      }
      return inserted;
    });
  }
  function businessForRow(row) {
    const business = resolveBusiness(row.phone_number_id);
    if (!business || business.business_id !== row.business_id || row.capabilities !== capabilities) return null;
    return business;
  }
  function restoreSnapshot(row) {
    const saved = JSON.parse(row.snapshot_json);
    db.prepare("DELETE FROM business_customer_sessions WHERE business_id=? AND whatsapp_id=?").run(row.business_id, row.sender);
    if (saved.session) db.prepare("INSERT INTO business_customer_sessions VALUES (?,?,?,?)")
      .run(row.business_id, row.sender, saved.session.session_json, saved.session.expires_at);
    if (saved.support) {
      const s = saved.support;
      db.prepare(`INSERT INTO business_support_conversations VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(business_id,whatsapp_id) DO UPDATE SET customer_id=excluded.customer_id,status=excluded.status,
        assigned_to=excluded.assigned_to,created_at=excluded.created_at,updated_at=excluded.updated_at`)
        .run(s.business_id, s.whatsapp_id, s.customer_id, s.status, s.assigned_to, s.created_at, s.updated_at);
    } else {
      db.prepare("DELETE FROM business_support_messages WHERE business_id=? AND whatsapp_id=? AND id=?").run(row.business_id, row.sender, row.message_id);
      db.prepare("DELETE FROM business_support_conversations WHERE business_id=? AND whatsapp_id=?").run(row.business_id, row.sender);
    }
  }
  function claimInput() {
    assertOwner();
    return transaction(db, () => {
      const row = db.prepare(`SELECT i.* FROM message_inbox i WHERE i.state='queued' AND i.next_attempt_at<=?
        AND NOT EXISTS (SELECT 1 FROM message_inbox old WHERE old.business_id=i.business_id AND old.sender=i.sender
          AND old.inbox_id<i.inbox_id AND (old.state<>'completed' OR EXISTS
            (SELECT 1 FROM message_outbox o WHERE o.inbox_id=old.inbox_id AND o.state NOT IN ('accepted','expired'))))
        ORDER BY i.inbox_id LIMIT 1`).get(now());
      if (!row) return null;
      const business = businessForRow(row);
      if (!business) {
        db.prepare("UPDATE message_inbox SET state='blocked',last_error='configuration_changed' WHERE inbox_id=?").run(row.inbox_id);
        return { blocked: true };
      }
      if (row.snapshot_json && !row.continuation_json) restoreSnapshot(row);
      if (!row.snapshot_json) {
        row.snapshot_json = JSON.stringify({
          session: db.prepare("SELECT * FROM business_customer_sessions WHERE business_id=? AND whatsapp_id=?").get(row.business_id, row.sender) || null,
          support: db.prepare("SELECT * FROM business_support_conversations WHERE business_id=? AND whatsapp_id=?").get(row.business_id, row.sender) || null,
        });
      }
      db.prepare("UPDATE message_inbox SET state='processing',snapshot_json=?,attempts=attempts+1 WHERE inbox_id=?").run(row.snapshot_json, row.inbox_id);
      return { ...row, business, message: JSON.parse(row.message_json), continuation: row.continuation_json ? JSON.parse(row.continuation_json) : null };
    });
  }
  function checkpoint(inboxId, continuation, saveState = () => {}) {
    assertOwner();
    transaction(db, () => {
      const row = db.prepare("SELECT state,continuation_json FROM message_inbox WHERE inbox_id=?").get(inboxId);
      const json = JSON.stringify(continuation);
      if (row?.state !== "processing" || (row.continuation_json && row.continuation_json !== json)) throw new Error("Invalid message continuation");
      saveState();
      db.prepare("UPDATE message_inbox SET continuation_json=? WHERE inbox_id=?").run(json, inboxId);
    });
  }
  function outputs(inboxId, payloads) {
    assertOwner();
    return transaction(db, () => {
      const row = db.prepare("SELECT * FROM message_inbox WHERE inbox_id=? AND state='processing'").get(inboxId);
      if (!row || !payloads.length) throw new Error("Output must belong to the current message");
      const last = db.prepare("SELECT MAX(customer_time) AS t FROM message_inbox WHERE business_id=? AND sender=?").get(row.business_id, row.sender).t;
      const session = db.prepare("SELECT expires_at FROM business_customer_sessions WHERE business_id=? AND whatsapp_id=?").get(row.business_id, row.sender);
      for (const [ordinal, payload] of payloads.entries()) {
        if (payload.to !== normalizedRecipient(row.sender)) throw new Error("Reply recipient does not match the incoming customer");
        const id = randomUUID();
        const buttons = payload.interactive?.action.buttons?.map(item => item.reply.id) || [];
        const rows = payload.interactive?.action.sections?.flatMap(section => section.rows.map(item => item.id)) || [];
        const browsing = [...buttons, ...rows].some(value => /^(availability|menu|manage|owned|intent):/.test(value));
        const expires = Math.min(last + 24 * 3600000, browsing && session ? session.expires_at : Infinity);
        db.prepare("INSERT INTO message_outbox (outbox_id,inbox_id,ordinal,payload_json,state,expires_at) VALUES (?,?,?,?,'pending',?)")
          .run(id, inboxId, ordinal, JSON.stringify({ ...payload, biz_opaque_callback_data: `nukmiris:${id}` }), expires);
      }
      db.prepare("UPDATE message_inbox SET state='completed',last_error=NULL WHERE inbox_id=?").run(inboxId);
    });
  }
  function complete(inboxId) {
    assertOwner();
    db.prepare("UPDATE message_inbox SET state='completed',last_error=NULL WHERE inbox_id=? AND state='processing'").run(inboxId);
  }
  function inputFailed(inboxId) {
    assertOwner();
    const row = db.prepare("SELECT attempts,state FROM message_inbox WHERE inbox_id=?").get(inboxId);
    if (row?.state === "processing") db.prepare("UPDATE message_inbox SET state=?,next_attempt_at=?,last_error='handler_failed' WHERE inbox_id=?")
      .run(row.attempts >= 5 ? "blocked" : "queued", now() + Math.min(60000, 1000 * 2 ** row.attempts), inboxId);
  }
  function claimOutput() {
    assertOwner();
    return transaction(db, () => {
      db.prepare("UPDATE message_outbox SET state='expired',last_error='reply_expired' WHERE state='pending' AND expires_at<=?").run(now());
      const row = db.prepare(`SELECT o.*,i.business_id,i.sender,i.phone_number_id,i.capabilities FROM message_outbox o
        JOIN message_inbox i USING(inbox_id) WHERE o.state='pending' AND o.next_attempt_at<=?
        AND NOT EXISTS (SELECT 1 FROM message_outbox old JOIN message_inbox oi USING(inbox_id)
          WHERE oi.business_id=i.business_id AND oi.sender=i.sender AND old.state NOT IN ('accepted','expired')
          AND (old.inbox_id<o.inbox_id OR (old.inbox_id=o.inbox_id AND old.ordinal<o.ordinal)))
        ORDER BY o.inbox_id,o.ordinal LIMIT 1`).get(now());
      if (!row) return null;
      if (!businessForRow(row)) {
        db.prepare("UPDATE message_outbox SET state='failed',last_error='configuration_changed' WHERE outbox_id=?").run(row.outbox_id);
        return { blocked: true };
      }
      db.prepare("UPDATE message_outbox SET state='sending',attempts=attempts+1 WHERE outbox_id=?").run(row.outbox_id);
      return { ...row, payload: JSON.parse(row.payload_json) };
    });
  }
  function outputResult(row, result) {
    assertOwner();
    // A signed Meta status can arrive before the HTTP response. Never overwrite
    // that proof of acceptance with a later timeout/error from the POST call.
    if (result.state === "accepted") {
      db.prepare("UPDATE message_outbox SET state='accepted',meta_message_id=?,last_error=NULL WHERE outbox_id=? AND state='sending'")
        .run(result.metaMessageId, row.outbox_id);
    } else db.prepare("UPDATE message_outbox SET state=?,next_attempt_at=?,last_error=? WHERE outbox_id=? AND state='sending'")
      .run(result.state, now() + Math.min(600000, 1000 * 2 ** Math.min(row.attempts + 1, 10)), result.error, row.outbox_id);
  }
  function retry({ businessId, uncertain = false } = {}) {
    if (!businessId) throw new Error("Select the business whose messages need retry");
    transaction(db, () => {
      db.prepare("UPDATE message_inbox SET state='queued',attempts=0,next_attempt_at=0 WHERE business_id=? AND state='blocked' AND last_error='handler_failed'").run(businessId);
      for (const row of db.prepare("SELECT * FROM message_inbox WHERE business_id=? AND state='blocked' AND last_error='configuration_changed'").all(businessId)) {
        if (businessForRow(row)) db.prepare("UPDATE message_inbox SET state='queued',attempts=0,next_attempt_at=0,last_error=NULL WHERE inbox_id=?").run(row.inbox_id);
      }
      for (const row of db.prepare(`SELECT o.outbox_id,i.* FROM message_outbox o JOIN message_inbox i USING(inbox_id)
        WHERE i.business_id=? AND o.state='failed' AND o.last_error='configuration_changed'`).all(businessId)) {
        if (businessForRow(row)) db.prepare("UPDATE message_outbox SET state='pending',next_attempt_at=0,last_error=NULL WHERE outbox_id=?").run(row.outbox_id);
      }
      db.prepare(`UPDATE message_outbox SET state='pending',next_attempt_at=0 WHERE inbox_id IN
        (SELECT inbox_id FROM message_inbox WHERE business_id=?) AND
        ((state='failed' AND last_error<>'configuration_changed') ${uncertain ? "OR state='uncertain'" : ""})`).run(businessId);
    });
  }
  return { acquire, release, accept, claimInput, checkpoint, outputs, complete, inputFailed, claimOutput, outputResult, retry };
}

async function sendStoredReply({ row, token, apiVersion = "v26.0", request = fetch }) {
  try {
    const response = await request(`https://graph.facebook.com/${apiVersion}/${row.phone_number_id}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(row.payload), signal: AbortSignal.timeout(15000),
    });
    let data;
    try { data = await response.json(); } catch { return { state: "uncertain", error: "unreadable_meta_response" }; }
    if (response.ok && typeof data.messages?.[0]?.id === "string") return { state: "accepted", metaMessageId: data.messages[0].id };
    if (!response.ok && data.error && !data.messages) {
      return { state: response.status === 429 || response.status >= 500 || data.error.is_transient ? "pending" : "failed", error: `meta_http_${response.status}` };
    }
    return { state: "uncertain", error: "unverified_meta_response" };
  } catch { return { state: "uncertain", error: "meta_transport_unknown" }; }
}
function createDeliveryWorker({ delivery, handle, resume, runInContext, send, intervalMs = 1000, onError = () => {} }) {
  let stopped = true, timer, active;
  async function drain() {
    if (active) return active;
    active = (async () => {
      let progressed;
      do {
        progressed = false;
        const reply = delivery.claimOutput();
        if (reply) {
          progressed = true;
          if (!reply.blocked) delivery.outputResult(reply, await send(reply));
        }
        if (stopped) break;
        const input = delivery.claimInput();
        if (input) {
          progressed = true;
          if (!input.blocked) {
            try {
              await runInContext(input, () => input.continuation ? resume(input) : handle(input));
              delivery.complete(input.inbox_id);
            } catch { delivery.inputFailed(input.inbox_id); onError(); }
          }
        }
      } while (progressed && !stopped);
    })().catch(onError).finally(() => { active = undefined; });
    return active;
  }
  function schedule() {
    if (stopped || timer) return;
    timer = setTimeout(async () => { timer = undefined; await drain(); schedule(); }, intervalMs);
    timer.unref();
  }
  function start() { stopped = false; schedule(); }
  function wake() { if (!stopped) { clearTimeout(timer); timer = undefined; void drain().then(schedule); } }
  async function stop() { stopped = true; clearTimeout(timer); timer = undefined; await active; }
  return { start, wake, stop, drain };
}
module.exports = { prepareReliabilitySchema, createReliableDelivery, createDeliveryWorker, sendStoredReply, normalizedRecipient };
