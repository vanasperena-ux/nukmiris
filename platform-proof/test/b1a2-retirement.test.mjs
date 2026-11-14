import test from "node:test";
import assert from "node:assert/strict";
import { retirementDecision } from "../b1a/runtime/session-policy.mjs";
import { retirementFixture } from "./b1a2-fixture.mjs";
test("D-2 realistic 60s sampling,120s visibility delay,20 delayed canaries reaches EVIDENCE_READY", () => {
  const d = retirementFixture(),
    v = retirementDecision(d);
  assert.equal(v.state, "EVIDENCE_READY");
  assert.equal(v.physicalBoundary, 59000);
  assert.equal(v.declaredAt, 299000);
  assert.equal(v.evidenceCompletedAt, 530000);
  assert.equal(v.thresholdBasis, "PROVISIONAL_SYNTHETIC_TARGET");
});
test("D-2 physical deadline is separate from delayed reporting and cannot be waived", () => {
  const d = retirementFixture({ fence: { terminationTargetMs: 30000 } });
  assert.equal(
    retirementDecision(d).reason,
    "physical_termination_deadline_exceeded",
  );
});
test("D-2 every state and every sampling interval must be present, zero and fresh", () => {
  const s = retirementFixture().fence.samples;
  for (const samples of [
    [s[0], s[2]],
    [{ ...s[0], states: { active: 0 } }, s[1], s[2]],
    [s[0], { ...s[1], states: { active: 0, idle: 1 } }, s[2]],
    [s[0], s[1], { ...s[2], visibleAt: 900000 }],
  ])
    assert.equal(
      retirementDecision(retirementFixture({ fence: { samples } })).state,
      "HOLD",
    );
  assert.equal(
    retirementDecision(
      retirementFixture({ fence: { metricFreshnessMs: 1000 } }),
    ).state,
    "HOLD",
  );
});
test("D-2 missing/late deletion and incomplete canary or network-tail evidence holds", () => {
  for (const fence of [
    { deletion: null },
    { deletion: { operationDone: false } },
    {
      deletion: {
        operationDone: true,
        revisionNotFound: true,
        revision: "old-r1",
        completedAt: 30000,
        receiptObservedAt: 600000,
        rawDigest: "b".repeat(64),
      },
    },
  ])
    assert.equal(
      retirementDecision(retirementFixture({ fence })).state,
      "HOLD",
    );
  assert.equal(
    retirementDecision(retirementFixture({ ledger: { observedUntil: 500000 } }))
      .reason,
    "canary_or_network_tail_not_observed",
  );
  assert.equal(
    retirementDecision(retirementFixture({ canary: { trials: [] } })).state,
    "HOLD",
  );
});
test("D-2 frozen old sender after minutes is VIOLATION even with incomplete unrelated metrics", () => {
  const d = retirementFixture({
    now: 700000,
    fence: { samples: [] },
    activity: { connect: [650000, 650010] },
  });
  assert.equal(retirementDecision(d).state, "VIOLATION");
});
test("D-2 pre-fence initiation with delayed application is retained; stale signatures cannot promote", () => {
  assert.equal(
    retirementDecision(
      retirementFixture({ activity: { providerArrival: 520000 } }),
    ).state,
    "EVIDENCE_READY",
  );
  assert.equal(
    retirementDecision(
      retirementFixture({ envelope: { issuedAt: 1000, expiresAt: 2000 } }),
    ).state,
    "HOLD",
  );
  const d = retirementFixture();
  assert.equal(
    retirementDecision({ ...d, fence: { ...d.fence } }).state,
    "HOLD",
  );
});
