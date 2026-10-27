"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { reminderFixture } = require("./helpers/reminder-fixture.cjs");
const { DEFAULT_TEMPLATES, templateDefinitions, templatePayload, templateMismatches, validTemplate, createTemplateVerifier } = require("../lib/reminder-templates");
const { checkTemplates, reminderStatus } = require("../scripts/reminders");
const cwd = path.resolve(__dirname, "..");

function configFor(f, businessId = "synthetic-a") {
  return f.db.prepare(`SELECT r.*,w.phone_number_id FROM reminder_business_settings r
    JOIN business_whatsapp_connections w USING(business_id) WHERE r.business_id=?`).get(businessId);
}
function approved(definition) { return { ...structuredClone(definition), id: "123456789", status: "APPROVED", quality_score: { score: "UNKNOWN" } }; }
function verifierWith(transform = value => value) {
  const calls = [];
  const verify = createTemplateVerifier({ token: "synthetic-token", request: async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://graph.facebook.com");
    assert.equal(options.method || "GET", "GET", "readiness must never send a message or update an asset");
    calls.push(parsed.pathname);
    const definition = templateDefinitions().find(item => item.name === parsed.searchParams.get("name"));
    return new Response(JSON.stringify({ data: parsed.pathname.endsWith("/phone_numbers") ? [{ id: "phone-synthetic-a" }]
      : [transform(approved(definition), definition)] }));
  } });
  return { verify, calls };
}

test("quality-pending approved assets verify all four exact Mexico-Spanish contracts without sends", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const v = verifierWith();
  const report = await checkTemplates(configFor(f), v.verify);
  assert.equal(report.ready, true);
  assert.equal(v.calls.length, 8);
  assert.deepEqual(report.templates.map(item => item.observed.name), [
    "nukmiris_seven_day_v1", "nukmiris_confirmation_v1", "nukmiris_followup_v1", "nukmiris_final_v1",
  ]);
  assert(report.templates.every(item => item.ok && item.observed.language === "es_MX" && item.observed.category === "UTILITY" &&
    item.observed.status === "APPROVED" && item.expected.status === "APPROVED" && item.observed.quality.score === "UNKNOWN"));
  assert.deepEqual(report.templates.map(item => item.ttlSeconds), [900, 900, 900, 300]);
  for (const item of report.templates) {
    const payload = templatePayload({ customer_name: "Cliente de prueba", sender: "5213312345678", start_iso: "2026-11-04T18:00:00-06:00",
      time_zone: "America/Mexico_City", action_token: "01234567-89ab-cdef-0123-456789abcdef" }, { kind: item.kind, job_id: "synthetic-job" }, configFor(f), "Negocio de prueba");
    assert.equal(payload.template.name, DEFAULT_TEMPLATES[item.kind]);
    assert.equal(payload.template.language.code, "es_MX");
    assert.deepEqual(payload.template.components[0].parameters, ["Cliente de prueba", "Negocio de prueba", "miércoles 4 de noviembre de 2026", "18:00"].map(text => ({ type: "text", text })));
    assert.equal(payload.to, "523312345678");
    assert.equal(payload.template.components.length, ["confirmation", "followup"].includes(item.kind) ? 3 : 1);
    if (payload.template.components.length === 3) {
      assert.deepEqual(payload.template.components.slice(1).map(button => [button.sub_type, button.index, button.parameters[0].payload]), [
        ["quick_reply", "0", "reminder:01234567-89ab-cdef-0123-456789abcdef:confirm"],
        ["quick_reply", "1", "reminder:01234567-89ab-cdef-0123-456789abcdef:reschedule"],
      ]);
    }
  }
  assert.equal(f.sent.length, 0);
});

for (const [label, mutate, reason] of [
  ["paused", actual => { actual.status = "PAUSED"; }, "status_mismatch"],
  ["category", actual => { actual.category = "MARKETING"; }, "category_mismatch"],
  ["language", actual => { actual.language = "es_ES"; }, "language_mismatch"],
  ["name", actual => { actual.name = "other_template"; }, "name_mismatch"],
  ["body", actual => { actual.components[0].text += " Changed"; }, "body_text_mismatch"],
  ["named parameters", actual => { actual.parameter_format = "NAMED"; }, "parameter_format_mismatch"],
  ["missing TTL", actual => { delete actual.message_send_ttl_seconds; }, "ttl_missing"],
  ["null TTL", actual => { actual.message_send_ttl_seconds = null; }, "ttl_missing"],
  ["string TTL", actual => { actual.message_send_ttl_seconds = "900"; }, "ttl_invalid"],
  ["default TTL", actual => { actual.message_send_ttl_seconds = 2592000; }, "ttl_out_of_range"],
  ["30-day sentinel", actual => { actual.message_send_ttl_seconds = -1; }, "ttl_out_of_range"],
  ["button order", actual => { actual.components[1].buttons.reverse(); }, "button_order_mismatch"],
  ["button count", actual => { actual.components[1].buttons.pop(); }, "button_count_mismatch"],
  ["button type", actual => { actual.components[1].buttons[0].type = "URL"; }, "button_0_type_mismatch"],
  ["button text", actual => { actual.components[1].buttons[0].text = "Otra acción"; }, "button_0_text_mismatch"],
  ["header", actual => { actual.components.push({ type: "HEADER", text: "Unexpected" }); }, "component_type_mismatch"],
  ["malformed components", actual => { actual.components = {}; }, "components_invalid"],
  ["malformed buttons", actual => { actual.components[1].buttons = {}; }, "buttons_invalid"],
]) test(`live diagnostic identifies ${label} and preserves strict rejection`, () => {
  const expected = templateDefinitions()[1], actual = approved(expected);
  mutate(actual);
  assert.equal(validTemplate(actual, expected), false);
  assert(templateMismatches(actual, expected).includes(reason));
});

test("a mismatched first asset does not hide readiness of the other three or expose provider bodies", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const v = verifierWith((actual, definition) => {
    if (definition.name === "nukmiris_seven_day_v1") {
      actual.message_send_ttl_seconds = null;
      actual.components[0].text = "Never print this unexpected provider body";
      actual.access_token = "NEVER_PRINT_SYNTHETIC_SECRET";
    }
    return actual;
  });
  const report = await checkTemplates(configFor(f), v.verify);
  assert.equal(report.ready, false); assert.equal(report.templates.length, 4); assert.equal(v.calls.length, 8);
  assert.deepEqual(report.templates[0].mismatches, ["ttl_missing", "body_text_mismatch"]);
  assert(report.templates.slice(1).every(item => item.ok));
  assert.equal(report.templates[0].expected.ttlSeconds, 900);
  assert.equal(report.templates[0].observed.ttlSeconds, null);
  assert.equal(report.templates[0].observed.bodyMatches, false);
  assert.equal(typeof report.templates[0].observed.bodyFingerprint, "string");
  assert(!JSON.stringify(report).includes("NEVER_PRINT_SYNTHETIC_SECRET"));
  assert(!JSON.stringify(report).includes("Never print this unexpected provider body"));
});

test("missing templates and management errors produce safe per-kind failures without short-circuiting", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const report = await checkTemplates(configFor(f), async (_config, kind) => {
    if (kind === "seven_day") throw new Error("reminder_template_check_http_403: Bearer NEVER_PRINT_SYNTHETIC_SECRET");
    throw new Error("Unexpected raw body containing NEVER_PRINT_SYNTHETIC_SECRET");
  });
  assert.equal(report.templates.length, 4); assert.equal(report.ready, false);
  assert.equal(report.templates[0].error, "reminder_template_check_http_403");
  assert(report.templates.slice(1).every(item => item.error === "reminder_template_check_unavailable"));
  assert(!JSON.stringify(report).includes("NEVER_PRINT_SYNTHETIC_SECRET"));
  assert.deepEqual(templateMismatches(undefined, templateDefinitions()[0]), ["template_missing"]);
});

function diskFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-live-diagnostics-"));
  const filename = path.join(directory, "synthetic.sqlite"), f = reminderFixture({ filename });
  t.after(() => {
    if (f.db.isOpen) f.db.close();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  return { directory, filename, f };
}
function command(filename, args, options = {}) {
  return spawnSync(process.execPath, [...(options.preload ? ["--require", options.preload] : []), "scripts/reminders.js", ...args], {
    cwd, encoding: "utf8", timeout: 10000, env: { ...process.env, NODE_ENV: "test", WHATSAPP_TOKEN: "synthetic-token",
      WHATSAPP_API_VERSION: "v26.0", NUKMIRIS_DB_PATH: filename, NUKMIRIS_BUSINESS_ID: "synthetic-a", ...options.env },
  });
}
for (const mismatch of [false, true]) test(`template JSON CLI checks every asset, is read-only and exits ${mismatch ? "nonzero for mismatch" : "successfully"}`, t => {
  const { directory, filename, f } = diskFixture(t);
  const preload = path.join(directory, "synthetic-meta.cjs"), callsFile = path.join(directory, "calls.json");
  fs.writeFileSync(preload, `"use strict";
    const fs = require("node:fs");
    const { templateDefinitions } = require(${JSON.stringify(path.resolve(cwd, "lib/reminder-templates.js"))});
    const calls=[];
    process.on("exit",()=>fs.writeFileSync(${JSON.stringify(callsFile)},JSON.stringify(calls)));
    global.fetch=async (url,options)=>{
      const parsed=new URL(url);calls.push({path:parsed.pathname,method:options.method||"GET"});
      if(parsed.origin!=="https://graph.facebook.com"||(options.method||"GET")!=="GET") throw new Error("Unexpected network mutation");
      if(parsed.pathname.endsWith("/phone_numbers")) return new Response(JSON.stringify({data:[{id:"phone-synthetic-a"}]}));
      const definition=templateDefinitions().find(item=>item.name===parsed.searchParams.get("name"));
      if(!definition) throw new Error("Unexpected template query");
      const actual={...definition,id:"123456789",status:"APPROVED",quality_score:{score:"UNKNOWN"}};
      if(${mismatch}&&actual.name==="nukmiris_seven_day_v1") actual.message_send_ttl_seconds=null;
      return new Response(JSON.stringify({data:[actual]}));
    };`);
  f.db.close();
  const before = createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
  const result = command(filename, ["--templates", "--check", "--json"], { preload });
  assert.equal(result.status, mismatch ? 1 : 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ready, !mismatch); assert.equal(report.templates.length, 4); assert.equal(report.apiVersion, "v26.0");
  assert.equal(report.businessId, "synthetic-a");
  const calls = JSON.parse(fs.readFileSync(callsFile, "utf8"));
  assert.equal(calls.length, 8); assert(calls.every(call => call.method === "GET"));
  assert.equal(createHash("sha256").update(fs.readFileSync(filename)).digest("hex"), before);
  assert(!result.stdout.includes("synthetic-token"));
});

test("status distinguishes API acceptance from delivered/read proof and retains scoped attempt history", async t => {
  const { filename, f } = diskFixture(t);
  const source = await f.book(), foreign = await f.book({ businessId: "synthetic-b" });
  await f.at(source.requestId, "confirmation");
  const job = f.jobs(source.requestId).find(item => item.kind === "confirmation");
  const foreignJob = f.jobs(foreign.requestId).find(item => item.kind === "confirmation");
  const accepted = reminderStatus(f.db, source.businessId, configFor(f)).recentJobs.find(item => item.job_id === job.job_id);
  assert.equal(accepted.state, "accepted"); assert.equal(accepted.meta_status, null);
  assert.equal(accepted.meta_message_id, job.meta_message_id);
  for (const status of ["sent", "delivered", "read", "sent", "failed"]) f.reminders.receipt({ business_id: source.businessId, phone_number_id: "phone-synthetic-a" }, {
    biz_opaque_callback_data: `nukmiris-reminder:${job.job_id}`, id: job.meta_message_id, recipient_id: "523312345678", status,
  });
  f.db.close();
  const result = command(filename, ["--status"]); assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout), observed = report.recentJobs.find(item => item.job_id === job.job_id);
  assert.equal(report.businessStatus, "test");
  assert.equal(observed.state, "accepted"); assert.equal(observed.meta_status, "read");
  assert.equal(observed.booking_request_id, source.requestId); assert.equal(observed.schedule_version, 1);
  assert.equal(observed.attempts, 1); assert.equal(observed.last_error, null);
  assert.equal(report.attempts.find(item => item.job_id === job.job_id).meta_message_id, job.meta_message_id);
  assert(report.attempts.every(item => item.booking_request_id === source.requestId));
  assert(!JSON.stringify(report).includes(foreign.requestId));
  assert(!JSON.stringify(report).includes(foreignJob.job_id));
  for (const existing of ["attendance", "jobs", "scheduled", "needsReview", "confirmationOperations"]) assert(Array.isArray(report[existing]));
});

test("recent job and attempt diagnostics are bounded and do not expose foreign-business history", async t => {
  const f = reminderFixture(); t.after(() => f.db.close());
  const source = await f.book(), foreign = await f.book({ businessId: "synthetic-b" });
  await f.at(source.requestId, "confirmation");
  const job = f.jobs(source.requestId).find(item => item.kind === "confirmation");
  for (let index = 2; index <= 220; index++) {
    f.db.prepare("INSERT INTO reminder_attempts VALUES (?,?,?,'uncertain','meta_transport_unknown',NULL)").run(job.job_id, index, f.now() + index);
    for (const current of [source, foreign]) f.db.prepare(`INSERT INTO reminder_jobs
      (job_id,booking_request_id,schedule_version,kind,due_at,expires_at,state) VALUES (?,?,?,'seven_day',?,?,'pending')`)
      .run(`synthetic-${current.businessId}-${index}`, current.requestId, index, f.now() + index, f.now() + index + 900000);
  }
  const report = reminderStatus(f.db, source.businessId, configFor(f));
  assert.equal(report.recentJobs.length, 200); assert.equal(report.attempts.length, 200);
  const selected = new Set(report.recentJobs.map(item => item.job_id));
  assert(report.attempts.every(item => selected.has(item.job_id) && item.booking_request_id === source.requestId));
  assert(report.recentJobs.every(item => item.booking_request_id === source.requestId));
  assert(!JSON.stringify(report).includes(foreign.requestId));
});
