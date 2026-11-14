import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LIVE_CLOUD_EXECUTION, receiptData } from "../runtime/transport.mjs";
import { hash } from "../../src/protocol.mjs";
import { assertPermissionCoverage } from "./plan.mjs";
import { retirementDecision } from "../../b1a/runtime/session-policy.mjs";
const run = promisify(execFile);
/** Exact argv only; never a shell. Even the constructor is closed before an
 * SDK, metadata server, credentials, account settings or subprocess is touched. */
export class FutureCloudCommandExecutor {
  constructor({ plan, environment }) {
    if (!LIVE_CLOUD_EXECUTION)
      throw Error("cloud_execution_requires_reviewed_activation_change");
    this.mode = "CLOUD";
    this.plan = plan;
    this.environment = environment;
  }
  async execute(op) {
    if (!LIVE_CLOUD_EXECUTION) throw Error("cloud_execution_disabled");
    if (
      !this.plan.permissionMatrix.some(
        (v) => hash(v.argv) === hash(op.argv) && v.principal === op.principal,
      ) ||
      op.argv[0] !== "gcloud"
    )
      throw Error("unapproved_command");
    const { stdout } = await run(
      "gcloud",
      [...op.argv.slice(1), "--format=json"],
      {
        env: this.environment,
        timeout: 180000,
        maxBuffer: 8388608,
        shell: false,
      },
    );
    return JSON.parse(stdout || "{}");
  }
}
/** Protocol preparation adapter accepts a deliberately local executor in tests.
 * SQL and evidence dependencies use their real, restricted implementations.
 * No acknowledgement is upgraded to physical-death evidence here. */
export class PreparedOperationalAdapter {
  constructor({
    plan,
    executor,
    controller,
    observer,
    preflight,
    readBack,
    originalAttemptIds = [],
    initializer,
    initialization,
    heartbeat,
  }) {
    if (executor.mode !== "LOCAL_SIMULATION" && !LIVE_CLOUD_EXECUTION)
      throw Error("cloud_execution_disabled");
    this.mode = executor.mode;
    this.plan = plan;
    this.executor = executor;
    this.controller = controller;
    this.observer = observer;
    this.preflight = preflight;
    this.probe = readBack;
    this.originalAttemptIds = originalAttemptIds;
    this.initializer = initializer;
    this.initialization = initialization;
    this.heartbeat = heartbeat;
  }
  async apply(op, { bundle } = {}) {
    assertPermissionCoverage([op], this.plan.inputs);
    let value;
    const c = this.plan.inputs;
    switch (op.semantic) {
      case "preflight":
        value = await this.preflight();
        if (value?.state !== "PREFLIGHT_READY") throw Error("preflight_held");
        break;
      case "initialize": {
        const old = await this.controller.read();
        if (old) {
          if (
            old.sessionId !== c.session.id ||
            old.scopeId !== c.session.scopeId ||
            old.epoch !== c.epochs.old ||
            old.revision !== c.epochs.oldRevision ||
            Date.parse(old.expiresAt) !== Date.parse(c.session.expiresAt) ||
            old.dispatchEnabled
          )
            throw Error("existing_session_conflict");
          value = old;
        } else {
          await this.controller.db.query(
            "SELECT proof.control_create($1,$2,$3,$4,$5)",
            [
              c.session.id,
              c.session.scopeId,
              c.epochs.old,
              c.epochs.oldRevision,
              c.session.expiresAt,
            ],
          );
          value = await this.controller.read();
        }
        break;
      }
      case "bootstrap":
        value = await this.initializer.enable(this.initialization);
        break;
      case "advance":
        value = await this.controller.advance(
          c.epochs.old,
          c.epochs.next,
          c.epochs.nextRevision,
        );
        break;
      case "observe":
        value = retirementDecision(bundle ?? {});
        if (value.state !== "EVIDENCE_READY") throw Error("retirement_held");
        break;
      case "recover":
        value = await this.controller.reconcile(
          bundle,
          this.originalAttemptIds,
        );
        if (value.state !== "RECONCILED_OR_HELD") throw Error("recovery_held");
        break;
      case "promote":
        value = await this.controller.promote(bundle);
        if (!value.dispatchEnabled) throw Error("promotion_held");
        this.heartbeat?.start();
        break;
      case "emergency":
        try {
          await this.controller.hold("OPERATOR_HOLD");
        } catch {
          /* Independent kill must still execute if SQL authority is unavailable. */
        }
        value = await this.executor.execute(op);
        break;
      default:
        value = await this.executor.execute(op);
    }
    return {
      state: "CONCLUSIVE",
      commandDigest: hash(op),
      id: op.id,
      receiptDigest: hash(value),
      provenance:
        this.mode === "LOCAL_SIMULATION"
          ? "LOCAL_PREPARED_ADAPTER"
          : "EXACT_PLATFORM_COMMAND_AND_RESTRICTED_SQL",
      physicalRetirementProven: false,
    };
  }
  async readBack(intent) {
    const receipt = await this.probe(intent);
    if (!receiptData(receipt) && this.mode !== "LOCAL_SIMULATION")
      return { state: "UNKNOWN" };
    const result = receiptData(receipt)?.value ?? receipt;
    if (
      result?.state !== "CONCLUSIVE" ||
      result.commandDigest !== intent.commandDigest
    )
      return { state: "UNKNOWN" };
    return result;
  }
}
