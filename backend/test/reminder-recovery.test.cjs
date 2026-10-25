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
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const f = reminderFixture({ filename: path.join(directory, "synthetic.sqlite") });
  prepareReliabilitySchema(f.db);
  const source = await f.book();
  if (accepted) await f.at(source.requestId, "confirmation");
  const job = f.jobs(source.requestId).find(j => j.kind === "confirmation"), token = f.row(source.requestId).action_token;
  fs.writeFileSync(path.join(directory, "events.json"), JSON.stringify(Object.fromEntries(f.events)));
  f.db.close();
  const children = [];
  t.after(async () => {
    for (const child of children) if (child.exitCode === null && !child.signalCode) { child.kill("SIGKILL"); await once(child, "exit"); }
  });
  async function start(clock = job.due_at, crash = "") {
    const child = fork(path.join(__dirname, "helpers/reminder-runtime.cjs"), [], {
      env: { ...process.env, SYNTHETIC_REMINDER_DIRECTORY: directory, SYNTHETIC_REMINDER_CLOCK: String(clock), SYNTHETIC_REMINDER_CRASH: crash },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    children.push(child);
    const result = await Promise.race([
      once(child, "message"), once(child, "exit").then(([code]) => { throw new Error(`Synthetic child exited early: ${code}`); }),
    ]);
    assert.equal(result[0].ready, true);
    return child;
  }
  function command(child, payload) {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const listener = message => { if (message.done !== id) return; child.off("message", listener); message.error ? reject(new Error(message.error)) : resolve(message.result); };
      child.on("message", listener); child.send({ ...payload, id });
    });
  }
  async function killAtPause(child) {
    const deadline = performance.now() + 5000;
    while (!fs.existsSync(path.join(directory, "paused"))) {
      if (performance.now() > deadline) throw new Error("Synthetic crash checkpoint timeout");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    child.kill("SIGKILL"); await once(child, "exit");
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
