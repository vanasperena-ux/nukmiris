import { startupProfile } from "./startup.mjs";
import { fakeReceipt } from "./fake-client.mjs";
import { hash } from "../../src/protocol.mjs";
/** Explicit initial synthetic enable, distinct from retirement promotion. No
 * HTTP route exposes this. It never clears a prior hold or re-enables restart. */
export class SyntheticInitialization {
  constructor({
    controller,
    inputs,
    journal,
    fake,
    custody,
    heartbeat,
    now = Date.now,
  }) {
    this.controller = controller;
    this.c = inputs;
    this.journal = journal;
    this.fake = fake;
    this.custody = custody;
    this.heartbeat = heartbeat;
    this.now = now;
  }
  async enable({ profiles, operatorApprovalRef }) {
    if (
      !operatorApprovalRef ||
      !Array.isArray(profiles) ||
      profiles.length !== 4
    )
      throw Error("explicit_synthetic_initialization_required");
    const caps = profiles.map(startupProfile);
    if (
      caps.some(
        (v) =>
          !v ||
          v.identityExpiresAt <= this.now() ||
          v.profile.sessionId !== this.c.session.id ||
          v.profile.scopeId !== this.c.session.scopeId ||
          v.profile.epoch !== this.c.epochs.old ||
          v.profile.revision !== this.c.epochs.oldRevision ||
          Date.parse(v.profile.expiresAt) <= this.now(),
      ) ||
      new Set(caps.map((v) => v.profile.role)).size !== 4 ||
      !["gateway", "worker", "ingress", "sealer"].every((role) =>
        caps.some((v) => v.profile.role === role),
      )
    )
      throw Error("verified_inert_startup_profiles_required");
    const state = await this.controller.read();
    if (
      !state ||
      state.dispatchEnabled ||
      state.holdReason !== "BOOTSTRAP" ||
      state.epoch !== this.c.epochs.old ||
      state.scopeId !== this.c.session.scopeId
    )
      throw Error("initialization_not_bootstrap");
    await this.custody.load();
    const clock = await this.fake.clock(),
      r = fakeReceipt(clock);
    if (!r || r.value.sessionId !== this.c.session.id)
      throw Error("independent_fake_preflight_required");
    const record = await this.journal.append({
      event: "EXPLICIT_SYNTHETIC_INITIALIZATION",
      sessionId: this.c.session.id,
      scopeId: this.c.session.scopeId,
      operatorApprovalRef,
      profileDigests: caps.map((v) => hash(v.profile)),
      fakeClockDigest: r.rawDigest,
      at: this.now(),
    });
    await this.controller.db.query(
      "SELECT proof.control_promote($1,$2,$3,$4)",
      [this.c.session.id, state.epoch, state.generation, record.hash],
    );
    this.heartbeat?.start();
    return this.controller.read();
  }
}
