import { generateKeyPairSync, randomUUID } from "node:crypto";
import { ObserverSigner } from "../b1a2/runtime/identity.mjs";
import { cloudFixture } from "./evidence-fixture.mjs";
import { hash } from "../src/protocol.mjs";
import { authenticatedObservation } from "../src/evidence-source.mjs";
import { ZERO } from "../src/ledger.mjs";
import {
  TRANSIT_PROTOCOL,
  TRANSIT_PHASES,
} from "../b1a2/runtime/transit-evidence.mjs";
export function signedRecords(base, events) {
  let previous = ZERO;
  const records = events.map((r, i) => {
    const { hash: old, previous: prev, sequence, ...v } = r;
    const value = { ...v, sequence: i + 1, previous },
      row = { ...value, hash: hash(value) };
    previous = row.hash;
    return row;
  });
  return {
    ...base,
    ledgerRecords: records,
    ledger: base.verifier.verify(
      base.raw("LEDGER", {
        ...base.le,
        checkpoint: { sequence: records.length, hash: previous },
        recordsDigest: hash(records),
      }),
    ),
  };
}
export function transitFixture({
  phaseAt = [10000, 11000, 12000, 13000, 14000],
  arrivalAt = 15000,
  now = 530000,
  fenceAt = 59000,
} = {}) {
  const d = cloudFixture({
    now,
    clock: {
      measuredAt: 1000,
      validUntil: 61000,
      driftPpm: 50,
      resyncAllowanceMs: 5,
    },
  });
  const signer = (issuer) => {
    const pair = generateKeyPairSync("ed25519");
    return new ObserverSigner({
      sessionId: d.sessionId,
      issuer,
      now: () => now,
      privateKey: pair.privateKey.export({ type: "pkcs8", format: "pem" }),
    });
  };
  const probeSigner = signer("independent-controlled-probe"),
    providerSigner = signer("independent-provider-observer"),
    scopeId = randomUUID(),
    attemptId = randomUUID(),
    operationId = randomUUID(),
    expected = {
      sessionId: d.sessionId,
      scopeId,
      epoch: 1,
      revision: "old-r1",
      probeKeyId: probeSigner.keyId,
      providerObserverKeyId: providerSigner.keyId,
      providerFingerprint: "BB:".repeat(31) + "BB",
      probeFingerprint: "AA:".repeat(31) + "AA",
    },
    payloadDigest = hash({ synthetic: true }),
    sample = {
      protocol: TRANSIT_PROTOCOL,
      scopeId,
      epoch: 1,
      revision: "old-r1",
      attemptId,
      operationId,
      payloadDigest,
      providerFingerprint: expected.providerFingerprint,
      probeFingerprint: expected.probeFingerprint,
      localPort: 40000,
      clockSource: "fixture-observer-clock",
      phases: TRANSIT_PHASES.map((phase, i) => ({
        phase,
        at: phaseAt[i],
        monotonicNs: String(i + 1),
      })),
    };
  const identity = {
    authenticatedEpoch: 1,
    authenticatedRevision: "old-r1",
    authenticatedFingerprint: expected.probeFingerprint,
  };
  let previous = ZERO;
  const records = [
    {
      event: "TLS_READY",
      at: phaseAt[2],
      connectionId: "flow",
      remotePort: 40000,
      ...identity,
    },
    {
      event: "REQUEST",
      at: arrivalAt,
      connectionId: "flow",
      attemptId,
      operationId,
      scopeId,
      payloadDigest,
      actualDigest: payloadDigest,
      ...identity,
    },
  ].map((r, i) => {
    const value = { ...r, sequence: i + 1, previous },
      record = { ...value, hash: hash(value) };
    previous = record.hash;
    return record;
  });
  const ledgerPayload = {
    scope: scopeId,
    epoch: 1,
    revision: "old-r1",
    clockSource: "fixture-observer-clock",
    observedUntil: now - 1,
    providerFingerprint: expected.providerFingerprint,
    checkpoint: { sequence: records.length, hash: previous },
    recordsDigest: hash(records),
  };
  return {
    expected,
    fenceAt,
    now,
    clock: providerSigner.observe(
      "CLOCK",
      authenticatedObservation(d.clock, "CLOCK").payload,
    ).token,
    clocks: [],
    uncertaintyMs: d.uncertaintyMs,
    candidateUpperMs: 5000,
    probe: probeSigner.observe("ACTIVITY", sample).token,
    ledger: providerSigner.observe("LEDGER", ledgerPayload).token,
    ledgerRecords: records,
    sample,
    ledgerPayload,
    probeSigner,
    providerSigner,
  };
}
