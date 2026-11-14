import test from "node:test";
import assert from "node:assert/strict";
import { retirementV2 as retirementDecision } from "../b1a2/runtime/retirement.mjs";
import { retirementFixture } from "./b1a2-fixture.mjs";
import { hash } from "../src/protocol.mjs";
import { ZERO } from "../src/ledger.mjs";
import { verifyRetirementEvidence } from "../b1a2/evidence/verify-retirement.mjs";
import { readFile } from "node:fs/promises";
import { authenticatedObservation } from "../src/evidence-source.mjs";

const identity = {
  authenticatedEpoch: 1,
  authenticatedRevision: "old-r1",
  authenticatedFingerprint: "AA:BB",
};
function events(at, { appliedAt = at + 1, key = "one" } = {}) {
  return [
    { event: "TLS_READY", at: at - 5, connectionId: key, ...identity },
    { event: "REQUEST", at, connectionId: key, attemptId: key, ...identity },
    { event: "EFFECT", at: appliedAt, attemptId: key, ...identity },
  ];
}
function withRecords(b, rows, { ledger = {}, canary = b.ca } = {}) {
  let previous = ZERO;
  const records = rows.map((r, i) => {
    const { hash: ignored, sequence, previous: oldPrevious, ...e } = r;
    const value = { ...e, sequence: i + 1, previous },
      record = { ...value, hash: hash(value) };
    previous = record.hash;
    return record;
  });
  return {
    ...b,
    ledgerRecords: records,
    ledger: b.verifier.verify(
      b.raw("LEDGER", {
        ...b.le,
        checkpoint: { sequence: records.length, hash: previous },
        recordsDigest: hash(records),
        ...ledger,
      }),
    ),
    canary: b.verifier.verify(b.raw("CANARY", canary)),
  };
}
test("D-2 realistic 60s sampling,120s visibility delay,20 delayed canaries reaches EVIDENCE_READY", () => {
  const d = retirementFixture(),
    v = retirementDecision(d);
  assert.equal(v.state, "EVIDENCE_READY");
  assert.equal(v.physicalBoundary, 59000);
  assert.equal(v.declaredAt, 299000);
  assert.equal(v.evidenceCompletedAt, 530000);
  assert.equal(v.thresholdBasis, "PROVISIONAL_SYNTHETIC_TARGET");
  assert.equal(v.derivedActivityCount, 3);
});

test("C-1/P10b: authenticated TLS/REQUEST/EFFECT eight minutes after fence cannot be hidden by caller activities", () => {
  const b = retirementFixture(),
    d = withRecords(b, events(520000));
  for (const supplied of [
    {},
    { activities: [] },
    { activities: b.activities },
    { activities: null },
  ]) {
    const { activities, ...without } = d;
    const v = retirementDecision({ ...without, ...supplied });
    assert.equal(v.state, "VIOLATION", JSON.stringify(v));
    assert.equal(v.reason, "post_fence_initiation");
    assert.equal(v.derivedActivityCount, 3);
  }
});
test("C-1/P10b: signed transit interval overlapping fence is HOLD with an empty caller list", () => {
  const d = withRecords(retirementFixture(), events(100000));
  const v = retirementDecision({ ...d, activities: [] });
  assert.equal(v.state, "HOLD");
  assert.equal(v.reason, "unresolved_activity_interval");
  assert.equal(v.derivedActivityCount, 3);
});
test("C-1/H-1: standalone old TLS and REQUEST are violations; an unbound EFFECT never fabricates initiation", () => {
  for (const event of [events(520000)[0], events(520000)[1]]) {
    const v = retirementDecision(withRecords(retirementFixture(), [event]));
    assert.equal(v.state, "VIOLATION");
    assert.equal(v.derivedActivityCount, 1);
  }
  const v = retirementDecision(
    withRecords(retirementFixture(), [events(520000)[2]]),
  );
  assert.equal(v.state, "HOLD");
  assert.equal(v.reason, "provider_effect_initiation_missing");
});
test("C-1/P9: canary REQUEST outranks unrelated incomplete trial, only 19 trials, metrics and short tail", () => {
  const b = retirementFixture(),
    rows = [
      { event: "REQUEST", at: 520000, attemptId: b.ca.trials[5].attemptId },
    ];
  const variants = [
    {},
    {
      canary: {
        ...b.ca,
        trials: b.ca.trials.map((t, i) =>
          i === 0 ? { ...t, wakeObservedAt: t.scheduledWakeAt - 1 } : t,
        ),
      },
    },
    { canary: { ...b.ca, trials: b.ca.trials.slice(0, 19) } },
    { ledger: { observedUntil: 500000 } },
  ];
  for (const update of variants) {
    const d = withRecords(b, rows, update),
      v = retirementDecision(d);
    assert.equal(v.state, "VIOLATION", JSON.stringify(v));
    assert.equal(v.reason, "old_canary_invocation_after_declared_retirement");
    assert.equal(
      retirementDecision({
        ...d,
        fence: b.verifier.verify(
          b.raw("FENCE", {
            ...authenticatedObservation(b.fence, "FENCE").payload,
            samples: [],
          }),
        ),
      }).state,
      "VIOLATION",
    );
  }
});
test("C-1: scan all authenticated activity before HOLD for another interval, metrics, deletion or trials", () => {
  const b = retirementFixture({
    fence: { samples: [], deletion: null },
    canary: { trials: [] },
  });
  const rows = [
    ...events(100000, { key: "overlap" }),
    ...events(520000, { key: "late" }),
  ];
  const v = retirementDecision(withRecords(b, rows));
  assert.equal(v.state, "VIOLATION");
  assert.equal(v.derivedActivityCount, 6);
  for (const ledger of [
    { observedUntil: 500000 },
    { transitPolicy: { ...b.le.transitPolicy, validUntil: 525000 } },
  ])
    assert.equal(
      retirementDecision(withRecords(b, events(520000), { ledger })).state,
      "VIOLATION",
    );
});
test("C-1: delayed application inherits the original pre-fence request, but a later write is a violation", () => {
  const b = retirementFixture();
  const v = retirementDecision(
    withRecords(b, events(10000, { appliedAt: 520000 })),
  );
  assert.equal(v.state, "EVIDENCE_READY");
  assert.equal(v.derivedActivityCount, 3);
  const rows = events(10000, { appliedAt: 520001 });
  rows[1].at = 520000;
  assert.equal(retirementDecision(withRecords(b, rows)).state, "VIOLATION");
});
test("C-1: only a signed bounded transit policy can authorize derived activity", () => {
  const b = retirementFixture();
  for (const transitPolicy of [
    undefined,
    { ...b.le.transitPolicy, upperMs: 0 },
    { ...b.le.transitPolicy, upperMs: 60001 },
    { ...b.le.transitPolicy, validUntil: 1000 },
    { ...b.le.transitPolicy, measurementRefs: [] },
  ]) {
    const d = withRecords(b, b.ledgerRecords, { ledger: { transitPolicy } });
    assert.equal(
      retirementDecision({ ...d, transitPolicy: b.le.transitPolicy }).state,
      "HOLD",
    );
  }
});
test("C-1: signature, session, chain, checkpoint and exact records digest fail closed before a violation", () => {
  const b = retirementFixture(),
    d = withRecords(b, events(520000));
  assert.equal(
    retirementDecision({ ...d, ledger: { ...d.ledger } }).reason,
    "authenticated_retirement_bundle_required",
  );
  const corrupt = structuredClone(d.ledgerRecords);
  corrupt[0].at++;
  assert.equal(
    retirementDecision({ ...d, ledgerRecords: corrupt }).reason,
    "provider_ledger_chain_or_head_invalid",
  );
  assert.equal(
    retirementDecision({ ...d, ledgerRecords: d.ledgerRecords.slice(1) }).state,
    "HOLD",
  );
  const mismatch = withRecords(b, events(520000), {
    ledger: { recordsDigest: hash([]) },
  });
  assert.equal(
    retirementDecision(mismatch).reason,
    "provider_export_not_verified",
  );
  assert.equal(
    retirementDecision({ ...d, ledger: retirementFixture().ledger }).reason,
    "stale_or_mixed_retirement_bundle",
  );
});
test("C-1: a caller activity cannot alter the ledger-derived digest or invent a violation", () => {
  const b = retirementFixture(),
    v = retirementDecision(b);
  assert.deepEqual(
    retirementDecision({ ...b, activities: [{ invented: true }] }),
    v,
  );
  assert.deepEqual(retirementDecision({ ...b, activities: [] }), v);
  const unknown = withRecords(b, [
    { event: "REQUEST", at: 520000, attemptId: "unattributed" },
  ]);
  assert.equal(retirementDecision(unknown).state, "HOLD");
});
test("C-1/H-2: all three original signed realistic-latency bundles reverify without changing historical results", async () => {
  for (const kind of ["full", "fault", "concurrency"]) {
    const file = new URL(
      "../b1a2/evidence/retirement/" + kind + ".json",
      import.meta.url,
    );
    const before = await readFile(file),
      result = await verifyRetirementEvidence(file);
    assert.equal(result.result.state, "EVIDENCE_READY");
    assert.equal(result.derivedActivityCount, 0); // original exports contain observer TLS only
    assert.equal(result.originalResultPreserved, true);
    assert.notEqual(
      result.result.evidenceDigest,
      result.recordedResult.evidenceDigest,
    );
    assert.deepEqual(await readFile(file), before);
  }
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
