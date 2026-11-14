import { fork } from "node:child_process";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { receiptData } from "./transport.mjs";
import { hash } from "../../src/protocol.mjs";
const wakes = new WeakMap(),
  plans = new WeakMap();
export const wakeReceipt = (v) => wakes.get(v);
export const scheduledCanary = (v) => plans.get(v);
async function stat(pid) {
  try {
    const s = await readFile("/proc/" + pid + "/stat", "utf8"),
      v = s.slice(s.lastIndexOf(")") + 2).split(" ");
    return { pid, state: v[0], start: v[19] };
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
export class LocalProcessCanaries {
  constructor({ journal, now = Date.now, configuration = () => ({}) }) {
    this.journal = journal;
    this.now = now;
    this.configuration = configuration;
    this.children = new Map();
  }
  async prepare({ attemptId, scheduledWakeAt, revision }) {
    const nonce = randomUUID(),
      child = fork(new URL("./canary-child.mjs", import.meta.url), [], {
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      });
    let armed;
    try {
      armed = await new Promise((r, j) => {
        const t = setTimeout(() => j(Error("canary_arm_deadline")), 3000);
        child.once("error", j);
        child.once("message", (m) => {
          clearTimeout(t);
          m.type === "armed" && m.attemptId === attemptId
            ? r(m)
            : j(Error("canary_arm_binding"));
        });
        child.send({ ...this.configuration(attemptId), attemptId });
      });
      let observed;
      for (let i = 0; i < 100; i++) {
        observed = await stat(child.pid);
        if (observed?.state === "T") break;
        await new Promise((r) => setTimeout(r, 2));
      }
      if (observed?.state !== "T")
        throw Error("independent_stopped_state_required");
      const record = {
        attemptId,
        scheduledWakeAt,
        revision,
        nonce,
        pid: child.pid,
        pidStart: observed.start,
        parkedBeforeConnect: true,
        source: "LOCAL_PROC_AND_INDEPENDENT_SIGCONT",
        preparedAt: this.now(),
      };
      await this.journal.append({
        event: "INDEPENDENT_CANARY_PREPARED",
        ...record,
      });
      const cap = Object.freeze(record);
      plans.set(cap, record);
      this.children.set(attemptId, { child, cap });
      return cap;
    } catch (e) {
      child.kill("SIGKILL");
      throw e;
    }
  }
  async wake(plan) {
    const p = scheduledCanary(plan),
      owned = this.children.get(p?.attemptId);
    if (!p || !owned || owned.cap !== plan)
      throw Error("opaque_canary_plan_required");
    const current = await stat(p.pid);
    if (current && current.start !== p.pidStart)
      throw Error("canary_pid_reuse");
    if (current && current.state !== "T" && current.state !== "Z")
      throw Error("canary_not_stopped");
    const existed = current && current.state !== "Z";
    if (existed) process.kill(p.pid, "SIGCONT");
    const value = {
      ...p,
      wakeObservedAt: this.now(),
      independent: true,
      independentWakeAttempted: true,
      terminatedBeforeWake: !existed,
      source: p.source,
    };
    await this.journal.append({ event: "INDEPENDENT_CANARY_WAKE", ...value });
    const cap = Object.freeze(value);
    wakes.set(cap, value);
    return cap;
  }
  async terminate(attemptId) {
    const v = this.children.get(attemptId);
    if (!v) throw Error("owned_canary_required");
    if (v.child.exitCode !== null || v.child.signalCode !== null) return;
    const current = await stat(v.child.pid);
    if (current?.start !== scheduledCanary(v.cap).pidStart)
      throw Error("canary_pid_reuse");
    const exited = once(v.child, "exit");
    v.child.kill("SIGKILL");
    await exited;
  }
  async close() {
    for (const key of this.children.keys()) await this.terminate(key);
  }
}
/** Future cloud waker uses independently retrieved platform/control logs bound
 * to an observer-issued nonce, exact revision, experiment and original trial.
 * A missing observation holds. It cannot turn a supplied boolean into evidence.
 * Logs attest the non-Byzantine harness control, NOT physical instance death. */
export class CloudLoggedCanaries {
  constructor({ api, inputs, journal, control, now = Date.now }) {
    this.api = api;
    this.c = inputs;
    this.journal = journal;
    this.control = control;
    this.now = now;
  }
  async prepare(v) {
    const nonce = randomUUID();
    await this.journal.append({
      event: "CLOUD_CANARY_SCHEDULE",
      ...v,
      nonce,
      sessionId: this.c.session.id,
    });
    const cap = Object.freeze({
      ...v,
      nonce,
      sessionId: this.c.session.id,
      source: "INDEPENDENT_CONTROL_AND_CLOUD_LOG_RECEIPT",
    });
    plans.set(cap, cap);
    await this.control.schedule(cap);
    return cap;
  }
  async wake(plan) {
    const p = scheduledCanary(plan);
    if (!p || p.sessionId !== this.c.session.id)
      throw Error("opaque_canary_plan_required");
    await this.control.wake(p);
    const receipt = await this.api.logs({ revision: p.revision });
    const r = receiptData(receipt);
    if (!r || r.status !== 200 || r.value.nextPageToken)
      throw Error("independent_wake_export_required");
    const rows = r.value.entries?.filter(
      (e) =>
        e.resource?.labels?.revision_name === p.revision &&
        e.jsonPayload?.sessionId === p.sessionId &&
        e.jsonPayload?.attemptId === p.attemptId &&
        e.jsonPayload?.nonce === p.nonce &&
        e.jsonPayload?.event === "CANARY_WAKE_ATTEMPT" &&
        e.jsonPayload?.parkedBeforeConnect === true,
    );
    if (rows?.length !== 1)
      throw Error("independent_wake_log_missing_or_conflicting");
    const value = Object.freeze({
      ...p,
      parkedBeforeConnect: true,
      independent: true,
      independentWakeAttempted: true,
      wakeObservedAt: this.now(),
      receiptDigest: r.rawDigest,
    });
    wakes.set(value, value);
    await this.journal.append({ event: "CLOUD_CANARY_WAKE_RECEIPT", ...value });
    return value;
  }
}
