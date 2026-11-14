import { createPublicKey, verify, createHash } from "node:crypto";
import { canonical, hash, id } from "./protocol.mjs";
const verified = new WeakMap();
export const OBSERVATION_SCHEMA = "nukmiris.b1a.observation/v1";
const types = new Set(["FENCE", "ACTIVITY", "CLOCK", "CANARY", "LEDGER"]);
function freeze(value) {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
const fail = (code) => {
  throw Object.assign(Error(code), { code });
};
export function evidenceKeyId(publicKey) {
  const key = createPublicKey(publicKey);
  if (key.asymmetricKeyType !== "ed25519") fail("evidence_key_type");
  return createHash("sha256")
    .update(key.export({ format: "der", type: "spki" }))
    .digest("hex");
}

/** Bootstrap supplies PUBLIC trust pins under independent administration. No
 * request body can register a key or assert sourceVerified. No network, ADC or
 * ambient credential-file access. Local signed fixtures establish authenticated
 * local provenance, never actual Google Cloud observations.
 */
export function createEvidenceVerifier({
  sessionId,
  trustedSources,
  now = Date.now,
  maxEnvelopeAgeMs = 60000,
}) {
  id(sessionId);
  if (
    !Array.isArray(trustedSources) ||
    !trustedSources.length ||
    trustedSources.length > 8 ||
    typeof now !== "function" ||
    !Number.isFinite(maxEnvelopeAgeMs) ||
    maxEnvelopeAgeMs <= 0 ||
    maxEnvelopeAgeMs > 3600000
  )
    fail("evidence_trust_configuration");
  const pins = new Map();
  for (const source of trustedSources) {
    if (
      source.role !== "INDEPENDENT_OBSERVER" ||
      typeof source.issuer !== "string" ||
      !source.issuer ||
      !Array.isArray(source.types) ||
      !source.types.length ||
      source.types.some((t) => !types.has(t))
    )
      fail("independent_evidence_source_required");
    const keyId = evidenceKeyId(source.publicKey);
    if (source.keyId !== keyId || pins.has(keyId)) fail("evidence_key_pin");
    pins.set(keyId, {
      issuer: source.issuer,
      key: createPublicKey(source.publicKey),
      types: new Set(source.types),
    });
  }
  return Object.freeze({
    verify(text) {
      if (typeof text !== "string" || Buffer.byteLength(text) > 1048576)
        fail("evidence_envelope_size");
      const envelope = JSON.parse(text),
        keys = [
          "schema",
          "issuer",
          "keyId",
          "sessionId",
          "recordType",
          "issuedAt",
          "expiresAt",
          "payload",
          "signature",
        ];
      if (
        !envelope ||
        Object.keys(envelope).length !== keys.length ||
        !keys.every((k) => Object.hasOwn(envelope, k))
      )
        fail("evidence_envelope_schema");
      const { signature, ...body } = envelope,
        pin = pins.get(body.keyId),
        at = now();
      if (
        body.schema !== OBSERVATION_SCHEMA ||
        body.sessionId !== sessionId ||
        !pin ||
        pin.issuer !== body.issuer ||
        !pin.types.has(body.recordType)
      )
        fail("evidence_origin_not_trusted");
      if (
        ![at, body.issuedAt, body.expiresAt].every(Number.isFinite) ||
        body.issuedAt > at ||
        body.expiresAt <= body.issuedAt ||
        body.expiresAt - body.issuedAt > maxEnvelopeAgeMs
      )
        fail("evidence_envelope_stale");
      if (
        typeof signature !== "string" ||
        !/^[A-Za-z0-9+/]{86}==$/.test(signature) ||
        !verify(
          null,
          Buffer.from(canonical(body)),
          pin.key,
          Buffer.from(signature, "base64"),
        )
      )
        fail("evidence_signature_invalid");
      if (
        !body.payload ||
        typeof body.payload !== "object" ||
        Array.isArray(body.payload) ||
        Object.hasOwn(body.payload, "sourceVerified")
      )
        fail("evidence_payload_schema");
      const data = freeze({
        ...structuredClone(body),
        fresh: at < body.expiresAt && at - body.issuedAt <= maxEnvelopeAgeMs,
      });
      const token = freeze({
        ...structuredClone(body.payload),
        kind: body.recordType === "FENCE" ? "CLOUD" : body.recordType,
        sourceVerified: true,
        envelopeDigest: hash(body),
        sessionId,
      });
      verified.set(token, data);
      return token;
    },
  });
}
export function authenticatedObservation(token, type) {
  const data =
    token && typeof token === "object" ? verified.get(token) : undefined;
  return data?.recordType === type ? data : undefined;
}

/** Four-timestamp offset interval: remote-reference lies between t3-t4 and
 * t2-t1. Intersect measured bounds and include timestamp precision/drift.
 * Sampling data must be authenticated by an independent CLOCK envelope.
 */
export function measuredClock(payload) {
  const extended = payload.model === "BOUNDED_DRIFT_V2";
  const {
    referenceClockSource,
    remoteClockSource,
    samples,
    precisionMs,
    driftPpm,
    measuredAt,
    validUntil,
  } = payload;
  if (
    typeof referenceClockSource !== "string" ||
    !referenceClockSource ||
    typeof remoteClockSource !== "string" ||
    !remoteClockSource ||
    referenceClockSource === remoteClockSource ||
    !Array.isArray(samples) ||
    samples.length < 3 ||
    samples.length > 100 ||
    ![precisionMs, driftPpm, measuredAt, validUntil].every(Number.isFinite) ||
    precisionMs <= 0 ||
    driftPpm < 0 ||
    driftPpm > 1000 ||
    validUntil <= measuredAt ||
    validUntil - measuredAt > (extended ? 21600000 : 60000) ||
    (extended &&
      (![payload.maxExtrapolationMs, payload.resyncAllowanceMs].every(
        Number.isFinite,
      ) ||
        payload.maxExtrapolationMs <= 0 ||
        payload.maxExtrapolationMs > 21600000 ||
        validUntil - measuredAt > payload.maxExtrapolationMs ||
        payload.resyncAllowanceMs < 0 ||
        payload.resyncAllowanceMs > 60000))
  )
    fail("measured_clock_required");
  let lower = -Infinity,
    upper = Infinity;
  for (const sample of samples) {
    if (
      !Array.isArray(sample) ||
      sample.length !== 4 ||
      !sample.every(Number.isFinite)
    )
      fail("clock_sample_invalid");
    const [t1, t2, t3, t4] = sample;
    if (t4 < t1 || t3 < t2 || t4 > measuredAt) fail("clock_sample_order");
    const lo = t3 - t4,
      hi = t2 - t1;
    if (lo > hi) fail("clock_sample_order");
    lower = Math.max(lower, lo);
    upper = Math.min(upper, hi);
  }
  if (lower > upper) fail("clock_samples_contradictory");
  return freeze({
    referenceClockSource,
    remoteClockSource,
    remoteMinusReferenceMs: (lower + upper) / 2,
    measuredAt,
    validUntil,
    uncertaintyMs:
      (upper - lower) / 2 +
      2 * precisionMs +
      (extended
        ? payload.resyncAllowanceMs
        : (driftPpm * (validUntil - measuredAt)) / 1000000),
    ...(extended
      ? {
          model: payload.model,
          baseUncertaintyMs: (upper - lower) / 2 + 2 * precisionMs,
          driftPpm,
          resyncAllowanceMs: payload.resyncAllowanceMs,
          maxExtrapolationMs: payload.maxExtrapolationMs,
        }
      : {}),
  });
}
