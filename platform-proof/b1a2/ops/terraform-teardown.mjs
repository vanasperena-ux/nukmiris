import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { hash } from "../../src/protocol.mjs";
import { LIVE_CLOUD_EXECUTION } from "../runtime/transport.mjs";
const exec = promisify(execFile),
  caps = new WeakMap();
/** Snapshot comes from separately authorized Terraform state, not an HTTP body.
 * Do not infer targets from names, labels or current account defaults. */
export function bindInventoryState({
  snapshot,
  manifest,
  approvedStateDigest,
  cleanupAuthority,
}) {
  if (
    hash(snapshot) !== approvedStateDigest ||
    !snapshot.lineage ||
    !Number.isInteger(snapshot.serial) ||
    snapshot.serial < 0 ||
    !Array.isArray(snapshot.resources) ||
    !cleanupAuthority ||
    cleanupAuthority.managedByExperiment !== false ||
    !cleanupAuthority.principal
  )
    throw Error("approved_independent_cleanup_and_state_required");
  const owned = new Map(manifest.inventory.map((v) => [v.address, v])),
    bindings = new Map();
  for (const r of snapshot.resources) {
    if (r.mode !== "managed") continue;
    const address = r.type + "." + r.name,
      item = owned.get(address);
    if (
      !item ||
      !Array.isArray(r.instances) ||
      r.instances.length !== 1 ||
      r.module
    )
      throw Error("unexpected_state_resource_held");
    const a = r.instances[0].attributes;
    if (!a?.id || (a.project && a.project !== item.project))
      throw Error("state_resource_identity_mismatch");
    bindings.set(address, {
      id: a.id,
      project: a.project ?? item.project,
      type: r.type,
      attributes: structuredClone(a),
    });
  }
  const cap = Object.freeze({
    lineage: snapshot.lineage,
    serial: snapshot.serial,
    digest: approvedStateDigest,
    cleanupPrincipal: cleanupAuthority.principal,
  });
  caps.set(cap, { bindings, manifest, authority: cleanupAuthority });
  return cap;
}
export class FutureTerraformTransport {
  constructor({ directory, environment, cleanupPrincipal, absenceProbe }) {
    if (!LIVE_CLOUD_EXECUTION)
      throw Error("cloud_execution_requires_reviewed_activation_change");
    this.directory = directory;
    this.environment = environment;
    this.cleanupPrincipal = cleanupPrincipal;
    if (!absenceProbe?.read) throw Error("independent_absence_probe_required");
    this.absence = (original) => absenceProbe.read(original);
    this.keyVersions = (original) => absenceProbe.keyVersions(original);
  }
  async state() {
    if (!LIVE_CLOUD_EXECUTION) throw Error("cloud_execution_disabled");
    return JSON.parse(
      (
        await exec("terraform", ["-chdir=" + this.directory, "state", "pull"], {
          env: this.environment,
          timeout: 60000,
          maxBuffer: 16777216,
          shell: false,
        })
      ).stdout,
    );
  }
  async destroyExact(address) {
    if (!LIVE_CLOUD_EXECUTION) throw Error("cloud_execution_disabled");
    if (!/^(terraform_data|google_[a-z0-9_]+)\.[a-z0-9_]+$/.test(address))
      throw Error("exact_inventory_address_required");
    return exec(
      "terraform",
      [
        "-chdir=" + this.directory,
        "destroy",
        "-lock=true",
        "-lock-timeout=30s",
        "-input=false",
        "-auto-approve",
        "-target=" + address,
      ],
      {
        env: this.environment,
        timeout: 180000,
        maxBuffer: 8388608,
        shell: false,
      },
    );
  }
}
/** The pinned provider implements resource-specific IAM etag CAS/deletions.
 * This adapter constrains its state and targets; it never removes/recreates an
 * unrecognized resource or the externally administered cleanup authority. */
export class PreparedTerraformTeardown {
  constructor({ boundState, transport, journal }) {
    const bound = caps.get(boundState);
    if (
      !bound ||
      transport.cleanupPrincipal !== boundState.cleanupPrincipal ||
      (transport.mode !== "LOCAL_SIMULATION" && !LIVE_CLOUD_EXECUTION)
    )
      throw Error("bound_teardown_transport_required");
    this.mode = transport.mode;
    this.bound = bound;
    this.cap = boundState;
    this.transport = transport;
    this.journal = journal;
    this.pending = new Set();
  }
  async removeExact(item) {
    const original = this.bound.bindings.get(item.address);
    if (!original)
      return {
        state: "HOLD",
        identity: item.address,
        reason:
          "missing_original_state_binding; independently inspect possible partial provisioning",
      };
    const before = await this.transport.state();
    this.#validate(before);
    const present = this.#lookup(before, item.address);
    if (!present) return { state: "ABSENT", identity: item.address };
    if (present.id !== original.id)
      throw Error("original_resource_id_changed_held");
    if (this.pending.has(item.address))
      return {
        state: "HOLD",
        identity: item.address,
        reason: "ambiguous_prior_destroy; readback only",
      };
    await this.journal.append({
      event: "EXACT_TERRAFORM_DESTROY_INTENT",
      address: item.address,
      originalResourceId: original.id,
      stateDigest: hash(before),
      cleanupPrincipal: this.cap.cleanupPrincipal,
    });
    this.pending.add(item.address);
    try {
      await this.transport.destroyExact(item.address);
    } catch {
      return {
        state: "HOLD",
        identity: item.address,
        reason: "delete_failed_or_uncertain",
      };
    }
    const after = await this.transport.state();
    this.#validate(after);
    if (this.#lookup(after, item.address))
      return {
        state: "HOLD",
        identity: item.address,
        reason: "resource_still_in_state",
      };
    // Terraform-state absence is not a cloud API absence receipt. An independent
    // exact API read is mandatory (404 alone is still not instance-death proof).
    const receipt = await this.transport.absence(original);
    if (receipt?.id !== original.id || receipt.state !== "ABSENT")
      return {
        state: "HOLD",
        identity: item.address,
        reason: "independent_absence_required",
      };
    this.pending.delete(item.address);
    await this.journal.append({
      event: "EXACT_RESOURCE_ABSENT",
      address: item.address,
      originalResourceId: original.id,
      receipt,
    });
    return {
      state: "ABSENT",
      identity: item.address,
      originalResourceId: original.id,
    };
  }
  async retireKeyVersions(item) {
    const original = this.bound.bindings.get(item.address);
    if (!original || item.type !== "google_kms_crypto_key")
      return { state: "HOLD" };
    const before = await this.transport.state();
    this.#validate(before);
    await this.journal.append({
      event: "KMS_VERSION_RETIRE_INTENT",
      address: item.address,
      originalKey: original.id,
    });
    if (!this.pending.has(item.address)) {
      this.pending.add(item.address);
      try {
        await this.transport.destroyExact(item.address);
      } catch {
        /* No replacement key or automatic retry. Read exact original versions. */
      }
    }
    const proof = await this.transport.keyVersions(original);
    if (proof?.state !== "VERSIONS_RETIRED" || proof.id !== original.id)
      return { state: "HOLD" };
    this.pending.delete(item.address);
    return proof;
  }
  async resolve(item) {
    const original = this.bound.bindings.get(item.address),
      state = await this.transport.state();
    this.#validate(state);
    if (this.#lookup(state, item.address))
      return { state: "HOLD", identity: item.address };
    const r = await this.transport.absence(original);
    if (r?.state !== "ABSENT" || r.id !== original?.id)
      return { state: "HOLD", identity: item.address };
    this.pending.delete(item.address);
    return { state: "ABSENT", identity: item.address };
  }
  #lookup(state, address) {
    const r = state.resources.find((v) => v.type + "." + v.name === address);
    return r?.instances?.[0]?.attributes;
  }
  #validate(state) {
    if (state.lineage !== this.cap.lineage || state.serial < this.cap.serial)
      throw Error("state_rollback_or_lineage_changed");
    for (const r of state.resources) {
      if (r.mode !== "managed") continue;
      const id = r.type + "." + r.name,
        original = this.bound.bindings.get(id);
      if (
        !original ||
        r.instances?.length !== 1 ||
        r.instances[0].attributes.id !== original.id
      )
        throw Error("unexpected_or_replaced_state_resource_held");
    }
  }
}
