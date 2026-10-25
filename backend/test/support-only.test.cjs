"use strict";

const { describe, test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const http = require("node:http");
const { once } = require("node:events");
const { randomUUID, createHmac } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const { DatabaseSync } = require("node:sqlite");

const backendRoot = path.resolve(__dirname, "..");
const sender = "synthetic-customer";
const businessA = "synthetic-business-a";
const businessB = "synthetic-business-b";
const buttonId = "11111111-1111-4111-8111-111111111111";
const nativeFetch = globalThis.fetch;

describe("v6A.4 support-only baseline", { concurrency: false }, () => {
  let directory;
  let databasePath;
  let fixture;
  let runtime;
  let server;
  let origin;
  const outgoing = [];
  const integrationCalls = [];
  const originalEnvironment = new Map();

  before(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-baseline-test-"));
    databasePath = path.join(directory, "synthetic.sqlite");
    fixture = new DatabaseSync(databasePath);
    fixture.exec(fs.readFileSync(path.join(__dirname, "fixtures/schema.sql"), "utf8"));
    for (const [id, name] of [[businessA, "Synthetic salon A"], [businessB, "Synthetic salon B"]]) {
      fixture.prepare("INSERT INTO businesses VALUES (?,?,?,'America/Mexico_City','test','fixture','fixture')")
        .run(id, name, "synthetic");
      fixture.prepare("INSERT INTO business_customers VALUES (?,?,?,?,?,?)")
        .run(`customer-${id}`, id, sender, `Synthetic customer at ${name}`, "fixture", "fixture");
    }
    fixture.prepare("INSERT INTO dev_test_business_routes VALUES (?,?,?)").run(sender, businessA, "synthetic fixture only");

    const environment = {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "0",
      NUKMIRIS_DB_PATH: databasePath,
      WHATSAPP_TOKEN: "synthetic-unused-token",
      WHATSAPP_PHONE_NUMBER_ID: "synthetic-unused-channel",
      WHATSAPP_VERIFY_TOKEN: "synthetic-verification-value",
      WHATSAPP_API_VERSION: "v26.0",
      META_APP_SECRET: "synthetic-app-secret",
      NUKMIRIS_MODE: "support",
      NUKMIRIS_ENABLE_RELIABILITY: "false",
      NUKMIRIS_ROUTING_MODE: "development",
    };
    for (const [key, value] of Object.entries(environment)) {
      originalEnvironment.set(key, process.env[key]);
      process.env[key] = value;
    }

    // Fail closed on outbound integrations. No real credentials or service calls.
    mock.method(require("@google-cloud/local-auth"), "authenticate", async () => {
      integrationCalls.push("Google OAuth");
      throw new Error("Google OAuth is forbidden in offline tests");
    });
    mock.method(require("googleapis").google, "calendar", () => {
      integrationCalls.push("Google Calendar");
      throw new Error("Google Calendar is forbidden in offline tests");
    });
    mock.method(https, "request", () => {
      integrationCalls.push("outbound HTTPS");
      throw new Error("Outbound HTTPS is forbidden in offline tests");
    });
    mock.method(http, "request", () => {
      integrationCalls.push("outbound HTTP");
      throw new Error("Use the loopback test client; outbound HTTP is forbidden");
    });
    mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(String(url), "https://graph.facebook.com/v26.0/synthetic-unused-channel/messages");
      assert.equal(options.method, "POST");
      outgoing.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ messages: [{ id: "synthetic-outgoing" }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    });
    mock.method(console, "log", () => {});
    mock.method(console, "error", () => {});

    runtime = require("../whatsapp-webhook.js");
    server = await runtime.start();
    if (!server.listening) await once(server, "listening");
    origin = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(() => {
    outgoing.length = 0;
    fixture.exec("DELETE FROM business_support_messages; DELETE FROM business_support_conversations; DELETE FROM business_customer_sessions;");
    fixture.prepare("UPDATE dev_test_business_routes SET business_id=? WHERE sender_whatsapp_id=?").run(businessA, sender);
  });

  afterEach(() => {
    assert.deepEqual(integrationCalls, [], "No OAuth, Calendar, or actual outbound transport may be used");
  });

  after(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (runtime) runtime.close();
    if (fixture) fixture.close();
    mock.restoreAll();
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });

  async function deliver(body, kind = "text", options = {}) {
    const message = kind === "text"
      ? { from: options.from || sender, id: options.id || randomUUID(), type: "text", text: { body } }
      : { from: options.from || sender, id: options.id || randomUUID(), type: "interactive", interactive: { type: kind, [kind]: { id: body } } };
    const payload = JSON.stringify({ entry: [{ changes: [{ value: {
      metadata: { phone_number_id: "synthetic-receiving-channel" }, messages: [message],
    } }] }] });
    const response = await nativeFetch(`${origin}/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=" + createHmac("sha256", "synthetic-app-secret").update(payload).digest("hex") },
      body: payload,
    });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
    // The existing webhook acknowledges before completing its asynchronous handler.
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    return message;
  }

  function saveSession(mode, expiresAt) {
    fixture.prepare("INSERT INTO business_customer_sessions VALUES (?,?,?,?)")
      .run(businessA, sender, JSON.stringify({ mode, expiresAt }), expiresAt);
  }

  test("the real application starts on a temporary loopback port without initializing Google", () => {
    assert.equal(server.address().address, "127.0.0.1");
    assert(server.address().port > 0);
    assert.deepEqual(integrationCalls, []);
  });

  test("the patched UUID dependency supports the legacy auth transport's multipart boundary", async () => {
    const localAuthRequire = createRequire(require.resolve("@google-cloud/local-auth"));
    const authRequire = createRequire(localAuthRequire.resolve("google-auth-library"));
    const gaxiosRequire = createRequire(authRequire.resolve("gaxios"));
    assert.equal(gaxiosRequire("uuid/package.json").version, "11.1.1");
    const { Gaxios } = authRequire("gaxios");
    let multipartBody;
    const response = await new Gaxios().request({
      url: "https://synthetic.invalid/offline-only", method: "POST",
      multipart: [{ headers: { "Content-Type": "text/plain" }, content: "synthetic-payload" }],
      adapter: async options => {
        assert.match(options.headers["Content-Type"], /^multipart\/related; boundary=[0-9a-f-]{36}$/);
        const chunks = [];
        for await (const chunk of options.body) chunks.push(Buffer.from(chunk));
        multipartBody = Buffer.concat(chunks).toString();
        return { config: options, status: 200, statusText: "OK", headers: {}, data: "synthetic-result" };
      },
    });
    assert.equal(response.data, "synthetic-result");
    assert.match(multipartBody, /synthetic-payload/);
  });

  test("subscription verification accepts the configured value and rejects a wrong value", async () => {
    const valid = await nativeFetch(`${origin}/webhook?hub.mode=subscribe&hub.verify_token=synthetic-verification-value&hub.challenge=synthetic-challenge`);
    assert.equal(valid.status, 200);
    assert.equal(await valid.text(), "synthetic-challenge");
    const invalid = await nativeFetch(`${origin}/webhook?hub.mode=subscribe&hub.verify_token=wrong`);
    assert.equal(invalid.status, 403);
    await invalid.arrayBuffer();
  });

  test("Hola creates the business-specific Spanish main menu", async () => {
    await deliver("Hola");
    assert.equal(outgoing.length, 1);
    const menu = outgoing[0].interactive;
    assert.match(menu.body.text, /bienvenido a Synthetic salon A/);
    assert.deepEqual(menu.action.buttons.map(button => button.reply.title), ["Agendar una cita", "Reagendar / cancelar", "Hablar con alguien"]);
    const stored = fixture.prepare("SELECT session_json FROM business_customer_sessions WHERE business_id=? AND whatsapp_id=?").get(businessA, sender);
    assert.equal(JSON.parse(stored.session_json).mode, "main_menu");
  });

  const appointmentInputs = [
    ["Cita", "text"], ["Reagendar", "text"], ["Cancelar", "text"],
    [`book:${buttonId}:1`, "button_reply"], [`reschedule:${buttonId}:1`, "button_reply"],
    [`appointment:${buttonId}:1`, "button_reply"], [`appointment:${buttonId}:1`, "list_reply"],
    [`cancel:${buttonId}:si`, "button_reply"], [`manage:${buttonId}:cancel`, "button_reply"],
    [`menu:${buttonId}:book`, "button_reply"], [`menu:${buttonId}:manage`, "button_reply"],
  ];
  for (const [body, kind] of appointmentInputs) {
    test(`appointment action stays paused: ${kind} ${body}`, async () => {
      await deliver(body, kind);
      assert.equal(outgoing.length, 1);
      assert.match(outgoing[0].text.body, /Las citas están temporalmente deshabilitadas/);
    });
  }
  test("natural Spanish intents and clarification buttons keep all support-only mutations paused", async () => {
    for (const phrase of ["Hola, quiero una cita", "Quiero cambiar la hora", "Cancélame la cita por favor", "Quiero sacar turno"]) {
      await deliver(phrase);
      assert.match(outgoing.at(-1).text.body, /Las citas están temporalmente deshabilitadas/);
    }
    await deliver("Necesita información");
    assert.equal(outgoing.at(-1).interactive.body.text, "No entendí qué necesitas. ¿En qué puedo ayudarte?");
    const options = outgoing.at(-1).interactive.action.buttons;
    for (const action of options) {
      await deliver("Necesita información");
      const current = outgoing.at(-1).interactive.action.buttons.find(button => button.reply.title === action.reply.title);
      await deliver(current.reply.id, "button_reply");
      assert.match(outgoing.at(-1).text.body, /Las citas están temporalmente deshabilitadas/);
    }
    assert.deepEqual(integrationCalls, []);
  });
  test("human chat retains natural and exact appointment messages verbatim until Menu", async () => {
    await deliver("Menu");
    await deliver(outgoing.at(-1).interactive.action.buttons[2].reply.id, "button_reply");
    const messages = ["¡Quiero AGENDAR una cita!", "No puedo mañana", "Cancelar", "mañana", "13 oct"];
    const count = outgoing.length;
    for (const message of messages) await deliver(message);
    assert.equal(outgoing.length, count);
    assert.deepEqual(fixture.prepare("SELECT message_text FROM business_support_messages ORDER BY rowid").all().map(row => row.message_text), messages);
    await deliver("Menu");
    assert.equal(outgoing.at(-1).interactive.action.buttons[0].reply.title, "Agendar una cita");
    assert.deepEqual(integrationCalls, []);
  });

  for (const mode of ["book", "reschedule", "cancel", "choose_cancel", "choose_reschedule", "registration", "manage_menu"]) {
    for (const expired of [false, true]) {
      test(`${expired ? "expired" : "active"} legacy ${mode} session is cleared before dispatch`, async () => {
        saveSession(mode, Date.now() + (expired ? -60000 : 60000));
        await deliver(mode === "cancel" ? "si" : "1");
        assert.equal(fixture.prepare("SELECT COUNT(*) AS n FROM business_customer_sessions").get().n, 0);
        assert.equal(outgoing.length, 1);
        assert.match(outgoing[0].text.body, /temporalmente deshabilitadas/);
      });
    }
  }

  test("a stale human-support button is rejected without opening a conversation", async () => {
    await deliver(`menu:${buttonId}:human`, "button_reply");
    assert.match(outgoing[0].text.body, /ya no está vigente/);
    assert.equal(fixture.prepare("SELECT COUNT(*) AS n FROM business_support_conversations").get().n, 0);
  });

  test("human support stores messages and Menu exits the persistent conversation", async () => {
    await deliver("Hola");
    const human = outgoing[0].interactive.action.buttons.find(button => button.reply.id.endsWith(":human"));
    await deliver(human.reply.id, "button_reply");
    assert.equal(outgoing.at(-1).text.body, 'Escribe tu mensaje.\n\nPara organizar tu cita o cancelar, escribe "menu".');
    await deliver("Synthetic support request");
    const stored = fixture.prepare("SELECT * FROM business_support_messages").all();
    assert.equal(stored.length, 1);
    assert.equal(stored[0].business_id, businessA);
    assert.equal(stored[0].whatsapp_id, sender);
    assert.equal(stored[0].message_text, "Synthetic support request");
    await deliver("Menu");
    assert.equal(fixture.prepare("SELECT status FROM business_support_conversations WHERE business_id=? AND whatsapp_id=?").get(businessA, sender).status, "closed");
    assert.equal(outgoing.at(-1).interactive.type, "button");
  });

  test("support data stays separate when the development route changes between businesses", async () => {
    await deliver("Hola");
    await deliver("Synthetic support for A");
    fixture.prepare("UPDATE dev_test_business_routes SET business_id=? WHERE sender_whatsapp_id=?").run(businessB, sender);
    await deliver("Hola");
    assert.match(outgoing.at(-1).interactive.body.text, /bienvenido a Synthetic salon B/);
    await deliver("Synthetic support for B");
    await deliver("Menu");
    const messages = fixture.prepare("SELECT business_id, message_text FROM business_support_messages ORDER BY business_id").all();
    assert.deepEqual(messages.map(row => [row.business_id, row.message_text]), [
      [businessA, "Synthetic support for A"], [businessB, "Synthetic support for B"],
    ]);
    assert.equal(fixture.prepare("SELECT status FROM business_support_conversations WHERE business_id=? AND whatsapp_id=?").get(businessA, sender).status, "waiting");
    assert.equal(fixture.prepare("SELECT status FROM business_support_conversations WHERE business_id=? AND whatsapp_id=?").get(businessB, sender).status, "closed");
  });

  test("session data stays separate when the development route changes", async () => {
    await deliver("Hola");
    const first = fixture.prepare("SELECT session_json FROM business_customer_sessions WHERE business_id=?").get(businessA).session_json;
    fixture.prepare("UPDATE dev_test_business_routes SET business_id=? WHERE sender_whatsapp_id=?").run(businessB, sender);
    await deliver("Hola");
    assert.equal(fixture.prepare("SELECT COUNT(*) AS n FROM business_customer_sessions WHERE whatsapp_id=?").get(sender).n, 2);
    assert.equal(fixture.prepare("SELECT session_json FROM business_customer_sessions WHERE business_id=?").get(businessA).session_json, first);
  });

  test("an unknown development sender cannot create customer or support data", async () => {
    await deliver("Hola", "text", { from: "unknown-synthetic-customer" });
    assert.equal(outgoing.length, 0);
    assert.equal(fixture.prepare("SELECT COUNT(*) AS n FROM business_customers").get().n, 2);
    assert.equal(fixture.prepare("SELECT COUNT(*) AS n FROM business_support_conversations").get().n, 0);
  });

  test("a completed delivery is not processed a second time in the same process", async () => {
    const id = randomUUID();
    await deliver("Hola", "text", { id });
    await deliver("Hola", "text", { id });
    assert.equal(outgoing.length, 1);
  });

  function runInvalidConfiguration(overrides) {
    return spawnSync(process.execPath, [path.join(backendRoot, "whatsapp-webhook.js")], {
      cwd: directory,
      env: {
        NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0", NUKMIRIS_DB_PATH: databasePath,
        WHATSAPP_TOKEN: "synthetic-unused-token", WHATSAPP_PHONE_NUMBER_ID: "synthetic-unused-channel",
        WHATSAPP_VERIFY_TOKEN: "synthetic-verification-value",
        META_APP_SECRET: "synthetic-app-secret", NUKMIRIS_MODE: "support", NUKMIRIS_ROUTING_MODE: "development",
        ...overrides,
      },
      encoding: "utf8", timeout: 10000,
    });
  }

  test("missing configuration stops startup without printing configured values", () => {
    const result = runInvalidConfiguration({ WHATSAPP_VERIFY_TOKEN: "" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing WhatsApp configuration/);
    assert.doesNotMatch(result.stderr, /synthetic-unused-token|synthetic-unused-channel/);
  });

  test("a missing database is rejected without creating a file", () => {
    const missing = path.join(directory, "must-not-be-created.sqlite");
    const result = runInvalidConfiguration({ NUKMIRIS_DB_PATH: missing });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Existing Phase 6A.3 database required/);
    assert.equal(fs.existsSync(missing), false);
  });

  test("a database without the prerequisite tables is rejected", () => {
    const empty = path.join(directory, "synthetic-empty.sqlite");
    new DatabaseSync(empty).close();
    const result = runInvalidConfiguration({ NUKMIRIS_DB_PATH: empty });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Phase 6A prerequisite missing/);
  });

  test("an invalid port is rejected before opening the database", () => {
    const result = runInvalidConfiguration({ PORT: "invalid" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PORT must be an integer/);
  });

  test("a missing Meta app secret stops startup", () => {
    const result = runInvalidConfiguration({ META_APP_SECRET: "" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing WhatsApp configuration/);
  });

  test("an unsupported runtime mode cannot enable calendar changes", () => {
    const result = runInvalidConfiguration({ NUKMIRIS_MODE: "rescheduling" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must be support, availability, or booking/);
  });

  test("automatic booking rejects the legacy sender-number simulation", () => {
    const result = runInvalidConfiguration({ NUKMIRIS_MODE: "booking", NUKMIRIS_ROUTING_MODE: "development" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires receiving-number routing/);
  });

  test("automatic booking requires prepared journal tables rather than migrating during startup", () => {
    fixture.exec(`CREATE TABLE IF NOT EXISTS business_whatsapp_connections (business_id TEXT PRIMARY KEY,phone_number_id TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS business_calendar_connections (business_id TEXT PRIMARY KEY,google_calendar_id TEXT UNIQUE);`);
    const result = runInvalidConfiguration({ NUKMIRIS_MODE: "booking", NUKMIRIS_ROUTING_MODE: "receiving_number" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /booking_requests/);
    assert.equal(fixture.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='booking_requests'").get().n, 0);
  });
});
