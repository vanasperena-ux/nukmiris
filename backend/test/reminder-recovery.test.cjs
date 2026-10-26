"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { fork } = require("node:child_process");
const { once } = require("node:events");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("node:crypto");
const { reminderFixture } = require("./helpers/reminder-fixture.cjs");
const { prepareReliabilitySchema } = require("../lib/reliable-delivery");

async function setup(t, { accepted = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-reminder-process-"));
  const children = new Map();
  let db;
  async function stop(child) {
    const state = children.get(child);
    if (state.closed) return;
    if (child.exitCode === null && !child.signalCode) child.kill("SIGKILL");
    await state.closePromise;
  }
  // Test hooks run in registration order. Windows cannot remove an open SQLite
  // file, and a failing earlier hook prevents the child-cleanup hook from running.
  t.after(async () => {
    await Promise.all([...children.keys()].map(stop));
    if (db?.isOpen) db.close();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const f = reminderFixture({ filename: path.join(directory, "synthetic.sqlite") });
  db = f.db;
  prepareReliabilitySchema(f.db);
  const source = await f.book();
  if (accepted) await f.at(source.requestId, "confirmation");
  const job = f.jobs(source.requestId).find(j => j.kind === "confirmation"), token = f.row(source.requestId).action_token;
  fs.writeFileSync(path.join(directory, "events.json"), JSON.stringify(Object.fromEntries(f.events)));
  f.db.close();
  async function start(clock = job.due_at, crash = "") {
    const child = fork(path.join(__dirname, "helpers/reminder-runtime.cjs"), [], {
      env: { ...process.env, SYNTHETIC_REMINDER_DIRECTORY: directory, SYNTHETIC_REMINDER_CLOCK: String(clock), SYNTHETIC_REMINDER_CRASH: crash },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    const state = { closed: false, stderr: "" };
    state.closePromise = new Promise(resolve => child.once("close", () => { state.closed = true; resolve(); }));
    children.set(child, state);
    child.stdout.resume();
    child.stderr.on("data", data => { state.stderr = (state.stderr + data).slice(-8000); });
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer); child.off("message", ready); child.off("exit", exited); child.off("error", failed);
      };
      const ready = message => { cleanup(); message.ready ? resolve() : reject(new Error("Synthetic child did not report ready")); };
      const failed = error => { cleanup(); reject(error); };
      const exited = (code, signal) => failed(new Error(`Synthetic child exited early: ${code ?? signal}. ${state.stderr}`));
      const timer = setTimeout(() => failed(new Error(`Synthetic child startup timeout. ${state.stderr}`)), 10000);
      child.on("message", ready); child.once("exit", exited); child.once("error", failed);
    });
    return child;
  }
  function command(child, payload) {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const cleanup = () => { clearTimeout(timer); child.off("message", listener); child.off("close", closed); };
      const failed = error => { cleanup(); reject(error); };
      const listener = message => { if (message.done !== id) return; cleanup(); message.error ? reject(new Error(message.error)) : resolve(message.result); };
      const closed = () => failed(new Error(`Synthetic child closed during ${payload.action}. ${children.get(child).stderr}`));
      const timer = setTimeout(() => failed(new Error(`Synthetic child command timeout: ${payload.action}. ${children.get(child).stderr}`)), 10000);
      child.on("message", listener); child.once("close", closed);
      child.send({ ...payload, id }, error => { if (error) failed(error); });
    });
  }
  async function killAtPause(child) {
    const deadline = performance.now() + 5000;
    while (!fs.existsSync(path.join(directory, "paused"))) {
      if (performance.now() > deadline) throw new Error("Synthetic crash checkpoint timeout");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    await stop(child);
    fs.unlinkSync(path.join(directory, "paused"));
  }
  const calls = kind => fs.existsSync(path.join(directory, "calls.jsonl"))
    ? fs.readFileSync(path.join(directory, "calls.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse).filter(call => call.kind === kind).length : 0;
  return { directory, source, job, token, start, command, killAtPause, calls };
}

test("a future reminder persists across an actual backend-process restart", { timeout: 20000 }, async t => {
  const f = await setup(t), first = await f.start(f.job.due_at - 1000);
  await f.command(first, { action: "tick" }); assert.equal(f.calls("send"), 0);
  first.send({ action: "stop" }); await once(first, "exit");
  const second = await f.start(); await f.command(second, { action: "tick" });
  assert.equal(f.calls("send"), 1);
  await f.command(second, { action: "tick" }); assert.equal(f.calls("send"), 1);
});

test("a crash after Meta may have accepted a reminder cannot cause a blind duplicate send", { timeout: 20000 }, async t => {
  const f = await setup(t), first = await f.start(f.job.due_at, "meta");
  first.send({ action: "tick", id: "synthetic-crash" }); await f.killAtPause(first);
  const second = await f.start(); await f.command(second, { action: "tick" });
  assert.equal(f.calls("send"), 1);
  const db = new DatabaseSync(path.join(f.directory, "synthetic.sqlite"), { readOnly: true });
  assert.equal(db.prepare("SELECT state FROM reminder_jobs WHERE job_id=?").get(f.job.job_id).state, "uncertain"); db.close();
});

test("a crash after the attendance Calendar patch recovers the original operation without a second patch", { timeout: 20000 }, async t => {
  const f = await setup(t, { accepted: true }), first = await f.start(f.job.due_at, "calendar");
  first.send({ action: "confirm", context: f.source, token: f.token, id: "synthetic-crash" }); await f.killAtPause(first);
  const second = await f.start();
  const result = await f.command(second, { action: "confirm", context: f.source, token: f.token });
  assert.equal(result.status, "confirmed"); assert.equal(f.calls("patch"), 1);
  const db = new DatabaseSync(path.join(f.directory, "synthetic.sqlite"), { readOnly: true });
  assert.equal(db.prepare("SELECT attendance FROM appointment_attendance").get().attendance, "CONFIRMED");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM calendar_booking_locks").get().n, 0); db.close();
});
