import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import { canonical } from "../src/protocol.mjs";
import {
  OBSERVATION_SCHEMA,
  createEvidenceVerifier,
  evidenceKeyId,
  measuredClock,
} from "../src/evidence-source.mjs";

/** Synthetic signed records only. Never described as actual cloud observations. */
export function cloudFixture({
  now = 155,
  fence = {},
  activity = {},
  clock = {},
  envelope = {},
} = {}) {
  const pair = generateKeyPairSync("ed25519"),
    publicKey = pair.publicKey.export({ type: "spki", format: "pem" }),
    keyId = evidenceKeyId(publicKey),
    sessionId = randomUUID(),
    issuer = "local-independent-observer-fixture";
  const verifier = createEvidenceVerifier({
    sessionId,
    now: () => now,
    trustedSources: [
      {
        role: "INDEPENDENT_OBSERVER",
        issuer,
        keyId,
        publicKey,
        types: ["FENCE", "ACTIVITY", "CLOCK", "CANARY", "LEDGER"],
      },
    ],
  });
  function raw(recordType, payload, overrides = {}) {
    const body = JSON.parse(
      JSON.stringify({
        schema: OBSERVATION_SCHEMA,
        issuer,
        keyId,
        sessionId,
        recordType,
        issuedAt: now - 5,
        expiresAt: now + 500,
        payload,
        ...envelope,
        ...overrides,
      }),
    );
    return JSON.stringify({
      ...body,
      signature: sign(
        null,
        Buffer.from(canonical(body)),
        pair.privateKey,
      ).toString("base64"),
    });
  }
  const clockPayload = {
    model: "BOUNDED_DRIFT_V2",
    maxExtrapolationMs: 21600000,
    resyncAllowanceMs: 0,
    referenceClockSource: "fixture-observer-clock",
    remoteClockSource: "fixture-gateway-clock",
    samples: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [2, 2, 2, 2],
    ],
    precisionMs: 1,
    driftPpm: 0,
    measuredAt: 5,
    validUntil: 1000,
    ...clock,
  };
  const f = {
    scope: "old",
    at: 100,
    clockSource: clockPayload.referenceClockSource,
    retiredEpoch: 1,
    retiredRevision: "old-r1",
    revisionDeleted: true,
    reportingDelayMs: 20,
    maxAgeMs: 30,
    coverUntil: 150,
    samples: [
      { at: 125, instances: 0 },
      { at: 150, instances: 0 },
    ],
    ...fence,
  };
  delete f.sourceVerified;
  delete f.kind;
  const a = {
    scope: "old",
    epoch: 1,
    revision: "old-r1",
    clockSource: clockPayload.remoteClockSource,
    connect: [20, 30],
    ...activity,
  };
  let uncertaintyMs;
  try {
    uncertaintyMs = measuredClock(clockPayload).uncertaintyMs;
  } catch {
    uncertaintyMs = undefined;
  }
  return {
    fence: verifier.verify(raw("FENCE", f)),
    activity: verifier.verify(raw("ACTIVITY", a)),
    clock: verifier.verify(raw("CLOCK", clockPayload)),
    uncertaintyMs,
    now,
    raw,
    verifier,
    publicKey,
    keyId,
    sessionId,
  };
}
