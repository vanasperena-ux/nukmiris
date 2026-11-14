import test from "node:test";
import assert from "node:assert/strict";
import {
  assessTransitEvidence,
  transitCollectionGate,
} from "../b1a2/runtime/transit-evidence.mjs";
import {
  attestLocalTransitProbe,
  runLocalTransitProbe,
} from "../b1a2/runtime/transit-probe.mjs";
import { retirementV2 } from "../b1a2/runtime/retirement.mjs";
import { retirementFixture } from "./b1a2-fixture.mjs";
import { transitFixture } from "./readiness-fixtures.mjs";
test("G-2/1 valid independently signed sample collects conservative intervals but never certifies a finite cloud bound", () => {
  const f = transitFixture(),
    v = assessTransitEvidence(f);
  assert.equal(v.state, "COLLECTED", JSON.stringify(v));
  assert.ok(v.observedDelayMs.upper > 1000 && v.observedDelayMs.upper < 5000);
  assert.equal(v.initiationClass, "PRE_FENCE");
  assert.equal(v.usableAsRetirementPolicy, false);
  assert.equal(transitCollectionGate(v).dispatchEnabled, false);
});
test("G-2/2 missing, forged, copied and stale source evidence hold", () => {
  const f = transitFixture();
  for (const patch of [
    { probe: undefined },
    { probe: { ...f.probe } },
    { ledger: { ...f.ledger } },
    { now: f.now + 3600001 },
    {
      expected: { ...f.expected, probeKeyId: f.expected.providerObserverKeyId },
    },
  ])
    assert.equal(assessTransitEvidence({ ...f, ...patch }).state, "HOLD");
  assert.throws(
    () => attestLocalTransitProbe({ ...f.sample }, f.probeSigner),
    /native_transit/,
  );
});
test("G-2/3,5 long delivery/buffering after a pre-fence write is held without relabeling it as a new send", () => {
  const f = transitFixture({ arrivalAt: 520000 }),
    v = assessTransitEvidence(f);
  assert.equal(v.state, "HOLD");
  assert.equal(v.reason, "observed_delay_exceeds_candidate_bound");
  assert.equal(v.initiationClass, "PRE_FENCE");
  assert.ok(v.observedDelayMs.upper > 500000);
  assert.equal(transitCollectionGate(v).newIdentityAllocated, false);
});
test("G-2/4,6 frozen old sender writes on its pre-fence connection after the fence: VIOLATION", () => {
  const v = assessTransitEvidence(
    transitFixture({
      phaseAt: [10000, 11000, 12000, 520000, 520010],
      arrivalAt: 520020,
    }),
  );
  assert.equal(v.state, "VIOLATION");
  assert.equal(v.initiationClass, "POST_FENCE");
  assert.match(transitCollectionGate(v).reason, /independent_kill/);
});
test("G-2/7 mismatched session, provider, epoch, revision, flow or raw digest never becomes accepted measurement", () => {
  const f = transitFixture();
  for (const key of [
    "sessionId",
    "scopeId",
    "epoch",
    "revision",
    "providerFingerprint",
    "probeFingerprint",
  ])
    assert.equal(
      assessTransitEvidence({
        ...f,
        expected: { ...f.expected, [key]: "wrong" },
      }).state,
      "HOLD",
    );
  const bad = f.ledgerRecords.map((r, i) =>
    i ? { ...r, actualDigest: "0".repeat(64) } : r,
  );
  assert.equal(
    assessTransitEvidence({ ...f, ledgerRecords: bad }).reason,
    "transit_ledger_chain_invalid",
  );
});
test("G-2/8 uncertain fence ordering, incomplete phases and inconsistent clock ordering hold", () => {
  const f = transitFixture();
  assert.equal(
    assessTransitEvidence({ ...f, fenceAt: 13000 }).reason,
    "transit_fence_order_uncertain",
  );
  const probe = f.probeSigner.observe("ACTIVITY", {
    ...f.sample,
    phases: f.sample.phases.slice(1),
  }).token;
  assert.equal(assessTransitEvidence({ ...f, probe }).state, "HOLD");
  const v = assessTransitEvidence(transitFixture({ arrivalAt: 1000 }));
  assert.equal(v.reason, "transit_clock_order_inconsistent");
});
test("G-2/9 signed but late/unobserved canary wake holds; unsigned assertions are rejected", () => {
  const f = transitFixture(),
    w = {
      scope: f.expected.scopeId,
      epoch: 1,
      revision: "old-r1",
      clockSource: "fixture-observer-clock",
      trials: [
        {
          independentWakeAttempted: true,
          scheduledWakeAt: 600000,
          wakeObservedAt: 600001,
        },
      ],
    };
  assert.equal(
    assessTransitEvidence({
      ...f,
      canary: f.providerSigner.observe("CANARY", w).token,
    }).reason,
    "late_canary_wake_not_observed",
  );
  assert.equal(
    assessTransitEvidence({ ...f, canary: { ...w } }).reason,
    "authenticated_transit_canary_required",
  );
});
test("G-2/10 absent or exceeded hypotheses and cloud-scoped sample maxima cannot authorize retirement", () => {
  const f = transitFixture();
  assert.equal(
    assessTransitEvidence({ ...f, candidateUpperMs: undefined }).reason,
    "no_finite_cloud_transit_basis",
  );
  assert.equal(
    assessTransitEvidence({ ...f, candidateUpperMs: 1 }).state,
    "HOLD",
  );
  const b = retirementFixture(),
    ledger = b.verifier.verify(
      b.raw("LEDGER", {
        ...b.le,
        transitPolicy: { ...b.le.transitPolicy, scope: "CLOUD_MEASURED" },
      }),
    );
  assert.equal(retirementV2({ ...b, ledger }).state, "HOLD");
  for (const value of [
    undefined,
    assessTransitEvidence(f),
    { state: "EVIDENCE_READY", upperMs: 1 },
  ]) {
    const v = transitCollectionGate(value);
    assert.equal(v.state, "HOLD");
    assert.equal(v.promotionAuthorized, false);
    assert.equal(v.automaticResend, false);
  }
});
test("G-2 probe refuses cloud mode, remote targets and non-synthetic payload before socket access", async () => {
  for (const patch of [
    { mode: "CLOUD" },
    { address: { host: "example.com", port: 443 } },
    { binding: { payload: { synthetic: false } } },
  ])
    await assert.rejects(
      runLocalTransitProbe({
        address: { host: "127.0.0.1", port: 12345 },
        binding: { payload: { synthetic: false } },
        ...patch,
      }),
      /local_synthetic/,
    );
});
