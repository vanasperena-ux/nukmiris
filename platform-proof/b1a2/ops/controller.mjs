import { hash } from "../../src/protocol.mjs";
import { assertPermissionCoverage } from "./plan.mjs";
import { retirementDecision } from "../../b1a/runtime/session-policy.mjs";
import { LIVE_CLOUD_EXECUTION } from "../runtime/transport.mjs";
/** No shell/gcloud execution primitive exists in this module. Intents and exact
 * receipts survive process interruption; unknown outcomes require read-back. */
export class LocalOperationController {
  constructor({ plan, journal, adapter, records = [], grants = plan.grants }) {
    if (
      plan.liveExecutionEnabled !== false ||
      adapter.mode !== "LOCAL_SIMULATION"
    )
      throw Error("local_simulation_only");
    assertPermissionCoverage(
      [...plan.commands, ...plan.emergency, ...plan.teardown, ...plan.access],
      plan.inputs,
      grants,
    );
    this.plan = plan;
    this.journal = journal;
    this.adapter = adapter;
    this.grants = grants;
    this.done = new Set();
    this.pending = new Map();
    this.active = Promise.resolve();
    for (const r of records) {
      if (r.inputDigest !== plan.inputDigest)
        throw Error("operation_journal_scope_mismatch");
      if (r.event === "OP_INTENT") this.pending.set(r.id, r);
      if (r.event === "OP_RESULT") {
        this.done.add(r.id);
        this.pending.delete(r.id);
      }
    }
  }
  #commands() {
    return [
      ...this.plan.commands,
      ...this.plan.emergency,
      ...this.plan.teardown,
      ...this.plan.access,
    ];
  }
  async resume() {
    for (const [id, intent] of this.pending) {
      const actual = await this.adapter.readBack(intent);
      if (
        !actual ||
        actual.commandDigest !== intent.commandDigest ||
        actual.state !== "CONCLUSIVE"
      )
        return {
          state: "HOLD",
          reason: "interrupted_operation_not_conclusive",
          id,
        };
      await this.journal.append({
        event: "OP_RESULT",
        id,
        inputDigest: this.plan.inputDigest,
        commandDigest: intent.commandDigest,
        receipt: actual,
        resolvedOriginalIntent: true,
      });
      this.done.add(id);
      this.pending.delete(id);
    }
    return { state: "RESUMED_WITHOUT_REPLAY" };
  }
  execute(id, { bundle, interruptAfterEffect = false } = {}) {
    const p = this.active.then(() =>
      this.#execute(id, { bundle, interruptAfterEffect }),
    );
    this.active = p.catch(() => {});
    return p;
  }
  async #execute(id, { bundle, interruptAfterEffect }) {
    const op = this.#commands().find((v) => v.id === id);
    if (!op) throw Error("unknown_exact_command");
    assertPermissionCoverage([op], this.plan.inputs, this.grants);
    if (
      this.pending.size &&
      (!this.plan.emergency.includes(op) || this.pending.has(id))
    )
      return { state: "HOLD", reason: "unresolved_prior_intent" };
    if (this.done.has(id)) return { state: "ALREADY_CONFIRMED_NO_REEXECUTION" };
    const isEmergency = this.plan.emergency.includes(op),
      isTeardown = this.plan.teardown.includes(op);
    if (!isEmergency && !isTeardown && this.plan.commands.includes(op)) {
      const missing = this.plan.commands.filter(
        (v) =>
          this.plan.commands.indexOf(v) < this.plan.commands.indexOf(op) &&
          !this.done.has(v.id),
      );
      if (missing.length)
        return {
          state: "HOLD",
          reason: "seven_step_predecessor_missing",
          missing: missing.map((v) => v.id),
        };
    }
    if (["observe", "recover", "promote"].includes(id)) {
      const decision = retirementDecision(bundle ?? {});
      if (decision.state !== "EVIDENCE_READY")
        return {
          state: "HOLD",
          reason: "independent_retirement_not_ready",
          decision,
        };
    }
    if (
      isTeardown &&
      this.plan.teardown
        .slice(0, this.plan.teardown.indexOf(op))
        .some((v) => !this.done.has(v.id))
    )
      return { state: "HOLD", reason: "teardown_predecessor_missing" };
    const intent = {
      event: "OP_INTENT",
      id,
      inputDigest: this.plan.inputDigest,
      commandDigest: hash(op),
      principal: op.principal,
      exactArgv: op.argv,
    };
    await this.journal.append(intent);
    this.pending.set(id, intent);
    let receipt;
    try {
      receipt = await this.adapter.apply(op, { bundle });
    } catch {
      return { state: "HOLD", reason: "operation_failed_or_uncertain", id };
    }
    if (interruptAfterEffect)
      return { state: "HOLD", reason: "simulated_crash_after_effect", id };
    if (
      !receipt ||
      receipt.commandDigest !== intent.commandDigest ||
      receipt.state !== "CONCLUSIVE"
    )
      return { state: "HOLD", reason: "unverified_result", id };
    await this.journal.append({
      event: "OP_RESULT",
      id,
      inputDigest: this.plan.inputDigest,
      commandDigest: intent.commandDigest,
      receipt,
    });
    this.pending.delete(id);
    this.done.add(id);
    return { state: "CONFIRMED", id, receipt };
  }
}
export class LocalCloudModel {
  constructor({ plan, controller }) {
    this.mode = "LOCAL_SIMULATION";
    this.plan = plan;
    this.controller = controller;
    this.applied = new Map();
    this.state = {
      epoch: plan.inputs.epochs.old,
      dispatch: false,
      resources: new Set(),
      denied: false,
    };
  }
  async apply(op, { bundle } = {}) {
    if (this.applied.has(op.id)) throw Error("model_refuses_automatic_replay");
    if (op.semantic === "advance") {
      await this.controller?.advance(
        this.plan.inputs.epochs.old,
        this.plan.inputs.epochs.next,
        this.plan.inputs.epochs.nextRevision,
      );
      this.state.epoch = this.plan.inputs.epochs.next;
      this.state.dispatch = false;
    }
    if (op.semantic === "deny") this.state.denied = true;
    if (op.semantic === "emergency") {
      await this.controller?.hold("OPERATOR_HOLD");
      this.state.dispatch = false;
    }
    if (op.semantic === "promote") {
      if (this.controller) {
        const result = await this.controller.promote(bundle);
        if (!result?.dispatchEnabled) throw Error("SQL_promotion_held");
      }
      this.state.dispatch = true;
    }
    const receipt = {
      state: "CONCLUSIVE",
      commandDigest: hash(op),
      id: op.id,
      scope: this.plan.inputDigest,
      provenance: "LOCAL_CLOUD_MODEL_NOT_GCP",
      epoch: this.state.epoch,
    };
    this.applied.set(op.id, receipt);
    return receipt;
  }
  async readBack(intent) {
    return this.applied.get(intent.id) ?? { state: "UNKNOWN" };
  }
}
export function executeLive() {
  if (!LIVE_CLOUD_EXECUTION)
    throw Error("cloud_execution_requires_reviewed_activation_change");
  throw Error("separately_reviewed_executor_required");
}
