import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/classify.mjs";
import {
  createEvidenceVerifier,
  measuredClock,
} from "../src/evidence-source.mjs";
import { cloudFixture } from "./evidence-fixture.mjs";

test("B-2/P4: authenticated post-fence initiation is VIOLATION before metrics completeness", () => {
  for (const fence of [
    { samples: undefined },
    { revisionDeleted: false, samples: [] },
    { samples: [{ at: 110, instances: 3 }] },
    {
      samples: [
        { at: 150, instances: 0 },
        { at: 125, instances: 0 },
      ],
    },
  ]) {
    const data = cloudFixture({
      now: 200,
      fence,
      activity: { connect: [150, 160] },
    });
    assert.equal(classify(data).verdict, "VIOLATION");
  }
});
test("B-2: a conclusive write or older-epoch connect cannot be hidden by unrelated invalid fields", () => {
  assert.equal(
    classify(
      cloudFixture({
        now: 200,
        fence: { samples: [] },
        activity: { connect: [20, 30], write: [150, 160] },
      }),
    ).verdict,
    "VIOLATION",
  );
  assert.equal(
    classify(
      cloudFixture({
        now: 200,
        fence: { samples: [] },
        activity: { connect: [150, 160], write: [NaN, 1] },
      }),
    ).verdict,
    "VIOLATION",
  );
  assert.equal(
    classify(
      cloudFixture({
        now: 200,
        fence: { retiredEpoch: 2, retiredRevision: "old-r2", samples: [] },
        activity: { epoch: 1, revision: "old-r1", connect: [150, 160] },
      }),
    ).verdict,
    "VIOLATION",
  );
});
test("B-2: incomplete, stale, contradictory samples never turn pre-fence traffic into containment proof", () => {
  for (const fence of [
    { samples: [] },
    { revisionDeleted: false },
    { samples: [{ at: 110, instances: 0 }] },
    {
      samples: [
        { at: 125, instances: 1 },
        { at: 150, instances: 0 },
      ],
    },
    {
      samples: [
        { at: 150, instances: 0 },
        { at: 125, instances: 0 },
      ],
    },
    { maxAgeMs: 1 },
    { scope: "wrong" },
  ])
    assert.equal(classify(cloudFixture({ fence })).verdict, "NOT_PROVEN");
});
test("B-2: explicit measured clock uncertainty and named clock sources are mandatory for CLOUD", () => {
  const data = cloudFixture();
  assert.equal(classify(data).verdict, "PRE_FENCE");
  for (const override of [
    { uncertaintyMs: undefined },
    { uncertaintyMs: 0 },
    { uncertaintyMs: NaN },
    { clock: undefined },
  ])
    assert.equal(classify({ ...data, ...override }).verdict, "NOT_PROVEN");
  assert.equal(
    classify(cloudFixture({ activity: { clockSource: "unmeasured-clock" } }))
      .verdict,
    "NOT_PROVEN",
  );
  assert.equal(
    classify(cloudFixture({ clock: { samples: [] } })).verdict,
    "NOT_PROVEN",
  );
  assert.equal(
    classify(cloudFixture({ clock: { validUntil: 100 } })).verdict,
    "NOT_PROVEN",
  );
});
test("B-2: measured offsets across two clocks distinguish pre-fence bytes, ambiguity and post-fence initiation", () => {
  const clock = {
    samples: [
      [0, 1000, 1000, 0],
      [1, 1001, 1001, 1],
      [2, 1002, 1002, 2],
    ],
  };
  assert.equal(
    classify(
      cloudFixture({
        clock,
        activity: { connect: [1020, 1030], providerArrival: 160 },
      }),
    ).verdict,
    "PRE_FENCE",
  );
  assert.equal(
    classify(cloudFixture({ clock, activity: { connect: [1099, 1101] } }))
      .verdict,
    "NOT_PROVEN",
  );
  assert.equal(
    classify(
      cloudFixture({
        now: 200,
        clock,
        fence: { samples: [] },
        activity: { connect: [1110, 1120] },
      }),
    ).verdict,
    "VIOLATION",
  );
  assert.equal(
    classify(cloudFixture({ activity: { connect: [30, 40], write: [20, 25] } }))
      .verdict,
    "NOT_PROVEN",
  );
});
test("B-2: caller-controlled sourceVerified, serialized copies and mutated evidence have no authority", () => {
  const data = cloudFixture();
  assert.equal(data.fence.sourceVerified, true);
  assert.equal(
    classify({ ...data, fence: { ...data.fence } }).verdict,
    "NOT_PROVEN",
  );
  assert.equal(
    classify({ ...data, activity: JSON.parse(JSON.stringify(data.activity)) })
      .verdict,
    "NOT_PROVEN",
  );
  assert.equal(
    classify({
      ...data,
      fence: { kind: "CLOUD", sourceVerified: true, ...data.fence },
    }).verdict,
    "NOT_PROVEN",
  );
  assert.throws(() => {
    data.fence.revisionDeleted = false;
  }, TypeError);
  assert.throws(() => {
    data.fence.samples[0].instances = 4;
  }, TypeError);
  const wire = JSON.parse(data.raw("ACTIVITY", { scope: "old" }));
  wire.payload.scope = "different";
  assert.throws(
    () => data.verifier.verify(JSON.stringify(wire)),
    /signature_invalid/,
  );
  assert.throws(
    () => data.verifier.verify(data.raw("FENCE", { sourceVerified: true })),
    /payload_schema/,
  );
});
test("B-2: trusted issuer, public-key pin, role, session, and signature are independently checked", () => {
  const data = cloudFixture();
  assert.throws(
    () => data.verifier.verify(data.raw("FENCE", {}, { issuer: "worker" })),
    /origin_not_trusted/,
  );
  assert.throws(
    () =>
      data.verifier.verify(
        data.raw(
          "FENCE",
          {},
          { sessionId: "00000000-0000-0000-0000-000000000000" },
        ),
      ),
    /origin_not_trusted/,
  );
  assert.throws(
    () =>
      createEvidenceVerifier({
        sessionId: data.sessionId,
        trustedSources: [
          {
            publicKey: data.publicKey,
            keyId: data.keyId,
            issuer: "worker",
            role: "GATEWAY",
            types: ["FENCE"],
          },
        ],
      }),
    /independent_evidence_source_required/,
  );
  const activityOnly = createEvidenceVerifier({
    sessionId: data.sessionId,
    now: () => 155,
    trustedSources: [
      {
        publicKey: data.publicKey,
        keyId: data.keyId,
        issuer: "local-independent-observer-fixture",
        role: "INDEPENDENT_OBSERVER",
        types: ["ACTIVITY"],
      },
    ],
  });
  assert.throws(
    () => activityOnly.verify(data.raw("FENCE", {})),
    /origin_not_trusted/,
  );
});
test("B-2: authentic expired records cannot PASS but retain a conclusive historical violation", () => {
  const data = cloudFixture({
    now: 200,
    envelope: { issuedAt: 100, expiresAt: 180 },
    fence: { samples: [] },
    activity: { connect: [150, 160] },
  });
  assert.equal(classify(data).verdict, "VIOLATION");
  assert.equal(
    classify(
      cloudFixture({ now: 200, envelope: { issuedAt: 100, expiresAt: 180 } }),
    ).verdict,
    "NOT_PROVEN",
  );
});
test("B-2: four-timestamp clock calibration rejects contradictory samples and includes drift/precision", () => {
  const p = {
      referenceClockSource: "a",
      remoteClockSource: "b",
      samples: [
        [0, 20, 21, 5],
        [10, 30, 31, 15],
        [20, 40, 41, 25],
      ],
      precisionMs: 1,
      driftPpm: 50,
      measuredAt: 30,
      validUntil: 1030,
    },
    m = measuredClock(p);
  assert.equal(m.remoteMinusReferenceMs, 18);
  assert.equal(m.uncertaintyMs, 4.05);
  assert.throws(
    () =>
      measuredClock({
        ...p,
        samples: [
          [0, 20, 21, 5],
          [10, 100, 101, 15],
          [20, 40, 41, 25],
        ],
      }),
    /contradictory/,
  );
  assert.throws(
    () =>
      measuredClock({
        ...p,
        samples: [
          [0, 1, 0, 5],
          [10, 30, 31, 15],
          [20, 40, 41, 25],
        ],
      }),
    /order/,
  );
});
