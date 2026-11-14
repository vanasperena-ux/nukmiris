import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/classify.mjs";
import { cloudFixture } from "./evidence-fixture.mjs";
const base = {
  measuredAt: 1000,
  validUntil: 61000,
  driftPpm: 50,
  maxExtrapolationMs: 21600000,
  resyncAllowanceMs: 5,
};
for (const delay of [10000, 150000, 600000])
  test(
    "D-1/P5 authenticated late initiation " + delay + "ms remains VIOLATION",
    () => {
      for (const samples of [
        [],
        [
          { at: 40000, instances: 0 },
          { at: 60000, instances: 0 },
        ],
      ]) {
        const d = cloudFixture({
          now: 30000 + delay + 100,
          clock: base,
          fence: { at: 30000, samples, coverUntil: 60000, maxAgeMs: 700000 },
          activity: { connect: [30000 + delay, 30010 + delay] },
        });
        assert.equal(classify(d).verdict, "VIOLATION");
      }
    },
  );
test("D-1 bounded extrapolation does not invent precision beyond horizon or at overlapping boundary", () => {
  const far = cloudFixture({
    now: 30000000,
    clock: base,
    fence: { at: 30000 },
    activity: { connect: [29000000, 29000010] },
  });
  assert.equal(classify(far).verdict, "NOT_PROVEN");
  assert.match(classify(far).reason, /expired/);
  const overlap = cloudFixture({
    now: 200000,
    clock: { ...base, driftPpm: 1000, resyncAllowanceMs: 2000 },
    fence: { at: 180000, samples: [] },
    activity: { connect: [180001, 180002] },
  });
  assert.equal(classify(overlap).verdict, "NOT_PROVEN");
});
test("D-1 multiple authenticated measurements intersect; inconsistent offsets fail closed", () => {
  const d = cloudFixture({
    now: 700000,
    clock: base,
    fence: { at: 30000, samples: [] },
    activity: { connect: [630000, 630010] },
  });
  const second = (offset) =>
    d.verifier.verify(
      d.raw("CLOCK", {
        ...d.clock,
        model: "BOUNDED_DRIFT_V2",
        referenceClockSource: "fixture-observer-clock",
        remoteClockSource: "fixture-gateway-clock",
        samples: [
          [600000, 600000 + offset, 600000 + offset, 600000],
          [600001, 600001 + offset, 600001 + offset, 600001],
          [600002, 600002 + offset, 600002 + offset, 600002],
        ],
        measuredAt: 600005,
        validUntil: 660005,
        precisionMs: 1,
        driftPpm: 50,
        maxExtrapolationMs: 21600000,
        resyncAllowanceMs: 5,
        sourceVerified: undefined,
      }),
    );
  assert.equal(classify({ ...d, clocks: [second(0)] }).verdict, "VIOLATION");
  assert.equal(
    classify({ ...d, clocks: [second(10000)] }).verdict,
    "NOT_PROVEN",
  );
  assert.match(
    classify({ ...d, clocks: [second(10000)] }).reason,
    /conflicting/,
  );
  assert.equal(classify({ ...d, clock: undefined }).verdict, "NOT_PROVEN");
  assert.equal(
    classify({ ...d, activity: { ...d.activity } }).verdict,
    "NOT_PROVEN",
  );
});
