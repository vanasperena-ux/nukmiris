import { cloudFixture } from "./evidence-fixture.mjs";
import { randomUUID } from "node:crypto";
import { hash } from "../src/protocol.mjs";
import { ZERO } from "../src/ledger.mjs";
export function retirementFixture({
  now = 530000,
  fence = {},
  activity = {},
  canary = {},
  ledger = {},
  envelope = {},
  clock = {},
} = {}) {
  const samples = [59000, 119000, 179000].map((sampleAt) => ({
    sampleAt,
    visibleAt: sampleAt + 120000,
    states: { active: 0, idle: 0 },
    rawDigest: "a".repeat(64),
  }));
  const d = cloudFixture({
    now,
    envelope,
    clock: {
      measuredAt: 1000,
      validUntil: 61000,
      driftPpm: 50,
      maxExtrapolationMs: 21600000,
      resyncAllowanceMs: 5,
      ...clock,
    },
    fence: {
      retirementModel: "METRIC_LATENCY_V2",
      at: 59000,
      retirementRequestedAt: 1000,
      terminationTargetMs: 60000,
      thresholdOwnerApproved: false,
      deletion: {
        operationDone: true,
        revisionNotFound: true,
        revision: "old-r1",
        completedAt: 30000,
        receiptObservedAt: 31000,
        rawDigest: "b".repeat(64),
      },
      declaredAt: 299000,
      coverUntil: 179000,
      samplingIntervalMs: 60000,
      publicationLatencyMs: 120000,
      zeroObservationIntervalMs: 120000,
      metricFreshnessMs: 600000,
      requiredStates: ["active", "idle"],
      samples,
      ...fence,
    },
    activity: { connect: [10000, 10010], ...activity },
  });
  const trials = Array.from({ length: 20 }, (_, i) => ({
    attemptId: randomUUID(),
    scheduledWakeAt: 310000 + i * 10000,
    wakeObservedAt: 310005 + i * 10000,
    independentWakeAttempted: true,
    parkedBeforeConnect: true,
    independentWakeSource: "fixture-independent-waker",
  }));
  const ca = {
      scope: "old",
      epoch: 1,
      revision: "old-r1",
      clockSource: "fixture-observer-clock",
      measuredWakeTailMs: 20000,
      networkTransitBoundMs: 1000,
      trials,
      ...canary,
    },
    le = {
      scope: "old",
      epoch: 1,
      revision: "old-r1",
      clockSource: "fixture-observer-clock",
      observedUntil: 529000,
      checkpoint: { sequence: 0, hash: ZERO },
      recordsDigest: hash([]),
      ...ledger,
    };
  return {
    ...d,
    activities: [d.activity],
    canary: d.verifier.verify(d.raw("CANARY", ca)),
    ledger: d.verifier.verify(d.raw("LEDGER", le)),
    ledgerRecords: [],
    ca,
    le,
  };
}
