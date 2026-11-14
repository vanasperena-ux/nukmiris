// Local-fixture reproduction only. Never live promotion authority. Original
// signed envelopes/results remain immutable; corrected results are separate.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createEvidenceVerifier,
  measuredClock,
} from "../../src/evidence-source.mjs";
import { hash } from "../../src/protocol.mjs";
import { retirementV2, DERIVATION_PROTOCOL } from "../runtime/retirement.mjs";
const HISTORICAL_SOURCE = "ecc085f3a2e413c9f3a228066292b81ad9c1be73";

export async function verifyRetirementEvidence(
  file,
  expectedSource = HISTORICAL_SOURCE,
) {
  const v = JSON.parse(await readFile(file, "utf8"));
  if (
    v.scope !== "LOCAL_PROTOCOL_AND_NATIVE_SIGNALS_NOT_GCP" ||
    !/^[a-f0-9]{40}$/.test(expectedSource) ||
    v.testedSource !== expectedSource
  )
    throw Error("exact_local_source_and_scope_required");
  const now = v.result.evidenceCompletedAt,
    verify = createEvidenceVerifier({
      sessionId: v.fence.sessionId,
      now: () => now,
      maxEnvelopeAgeMs: 3600000,
      trustedSources: [
        {
          role: "INDEPENDENT_OBSERVER",
          issuer: v.fence.issuer,
          keyId: v.observerKeyId,
          publicKey: v.observerPublicKey,
          types: ["FENCE", "ACTIVITY", "CLOCK", "CANARY", "LEDGER"],
        },
      ],
    });
  const token = (x) => verify.verify(JSON.stringify(x)),
    bundle = {
      fence: token(v.fence),
      clock: token(v.clock),
      clocks: [token(v.platformClock)],
      canary: token(v.canary),
      ledger: token(v.ledger),
      ledgerRecords: v.ledgerRecords,
      now,
      uncertaintyMs: measuredClock(v.clock.payload).uncertaintyMs,
    },
    result = retirementV2(bundle);
  if (result.state !== "EVIDENCE_READY" || v.result.state !== "EVIDENCE_READY")
    throw Error("corrected_retirement_not_ready " + JSON.stringify(result));
  if (v.result.derivationProtocol === DERIVATION_PROTOCOL) {
    if (hash(result) !== hash(v.result))
      throw Error("corrected_retirement_result_mismatch");
  } else {
    // These historical e2e exports supplied no ACTIVITY array. Verify their
    // original digest recipe separately, then apply the corrected derivation.
    const originalDigest = hash([
      bundle.fence.envelopeDigest,
      bundle.clock.envelopeDigest,
      ...bundle.clocks.map((c) => c.envelopeDigest),
      bundle.canary.envelopeDigest,
      bundle.ledger.envelopeDigest,
    ]);
    if (
      v.testedSource !== HISTORICAL_SOURCE ||
      originalDigest !== v.result.evidenceDigest ||
      [
        "timeModel",
        "physicalBoundary",
        "declaredAt",
        "evidenceCompletedAt",
        "thresholdBasis",
      ].some((k) => result[k] !== v.result[k])
    )
      throw Error("historical_retirement_result_mismatch");
  }
  return {
    scope: "LOCAL_REVERIFICATION_ONLY",
    testedSource: v.testedSource,
    result,
    recordedResult: v.result,
    originalResultPreserved: true,
    derivedActivityCount: result.derivedActivityCount,
    canaries: v.canary.payload.trials.length,
    authenticatedSignaturesVerified: true,
    livePromotionAuthorized: false,
  };
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  console.log(
    JSON.stringify(
      await verifyRetirementEvidence(process.argv[2], process.argv[3]),
      null,
      2,
    ),
  );
