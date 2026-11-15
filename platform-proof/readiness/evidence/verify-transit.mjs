// Evidence-only local replay at the recorded clock, never cloud authority.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  createEvidenceVerifier,
  evidenceKeyId,
  measuredClock,
} from "../../src/evidence-source.mjs";
import {
  assessTransitEvidence,
  transitCollectionGate,
} from "../../b1a2/runtime/transit-evidence.mjs";
import { hash } from "../../src/protocol.mjs";
const file = process.argv[2],
  expectedSource = process.argv[3];
assert.match(expectedSource ?? "", /^[a-f0-9]{40}$/);
const v = JSON.parse(await readFile(file, "utf8"));
assert.equal(v.scope, "LOCAL_NATIVE_SIGNALS_AND_MTLS_NOT_GCP");
assert.equal(v.testedSource, expectedSource);
// Pins are published local-fixture keys, not an account/cloud trust bootstrap.
const pins = [
  {
    role: "INDEPENDENT_OBSERVER",
    issuer: "independent-native-probe",
    keyId: evidenceKeyId(v.probePublicKey),
    publicKey: v.probePublicKey,
    types: ["ACTIVITY"],
  },
  {
    role: "INDEPENDENT_OBSERVER",
    issuer: "independent-native-provider-observer",
    keyId: evidenceKeyId(v.observerPublicKey),
    publicKey: v.observerPublicKey,
    types: ["CLOCK", "LEDGER"],
  },
];
const verifier = createEvidenceVerifier({
    sessionId: v.sessionId,
    now: () => v.now,
    trustedSources: pins,
  }),
  token = (x) => verifier.verify(JSON.stringify(x)),
  clock = token(v.clock),
  probe = token(v.probe),
  ledger = token(v.ledger);
const result = assessTransitEvidence({
  probe,
  ledger,
  clock,
  ledgerRecords: v.ledgerRecords,
  expected: {
    sessionId: v.sessionId,
    scopeId: "22222222-2222-4222-8222-222222222222",
    epoch: 1,
    revision: "b1a2-gateway-e000001-r1",
    probeKeyId: pins[0].keyId,
    providerObserverKeyId: pins[1].keyId,
    providerFingerprint: v.ledger.payload.providerFingerprint,
    probeFingerprint: v.probe.payload.probeFingerprint,
  },
  fenceAt: v.fenceAt,
  now: v.now,
  uncertaintyMs: measuredClock(v.clock.payload).uncertaintyMs,
  candidateUpperMs: 5000,
});
assert.equal(result.state, "VIOLATION");
assert.equal(hash(result), hash(v.result));
assert.deepEqual(transitCollectionGate(result), v.gate);
console.log(
  JSON.stringify(
    {
      scope: "LOCAL_REPLAY_AT_RECORDED_TIME_NOT_LIVE_PROMOTION_AUTHORITY",
      runtimeSource: expectedSource,
      signaturesVerified: true,
      ledgerChainAndDigestVerified: true,
      result,
      gate: v.gate,
    },
    null,
    2,
  ),
);
