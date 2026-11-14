import { createPublicKey, verify, createPrivateKey, sign } from "node:crypto";
import { canonical, hash } from "../../src/protocol.mjs";
import {
  createEvidenceVerifier,
  evidenceKeyId,
  OBSERVATION_SCHEMA,
} from "../../src/evidence-source.mjs";
const verified = new WeakMap();
function decode(s) {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]+$/.test(s))
    throw Error("jwt_encoding");
  const b = Buffer.from(s, "base64url");
  if (b.toString("base64url") !== s) throw Error("jwt_encoding");
  return b;
}
export function verifyServiceIdentity({
  jwt,
  jwks,
  audience,
  expectedEmail,
  expectedSubject,
  now,
  mode = "CLOUD",
}) {
  if (
    typeof jwt !== "string" ||
    jwt.length > 16384 ||
    !Array.isArray(jwks?.keys) ||
    !Number.isFinite(now)
  )
    throw Error("service_identity_required");
  const parts = jwt.split(".");
  if (parts.length !== 3) throw Error("service_identity_required");
  const header = JSON.parse(decode(parts[0])),
    claims = JSON.parse(decode(parts[1]));
  if (
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    header.crit ||
    header.jku ||
    header.x5u
  )
    throw Error("pinned_jwt_algorithm_and_key_required");
  const keys = jwks.keys.filter(
    (k) =>
      k.kid === header.kid && k.kty === "RSA" && (!k.alg || k.alg === "RS256"),
  );
  if (
    keys.length !== 1 ||
    !verify(
      "RSA-SHA256",
      Buffer.from(parts[0] + "." + parts[1]),
      createPublicKey({ key: keys[0], format: "jwk" }),
      decode(parts[2]),
    )
  )
    throw Error("service_identity_signature");
  if (
    !(
      mode === "LOCAL_SIMULATION"
        ? ["https://b1a2.fixture.invalid"]
        : ["https://accounts.google.com", "accounts.google.com"]
    ).includes(claims.iss) ||
    claims.aud !== audience ||
    claims.email !== expectedEmail ||
    claims.sub !== expectedSubject ||
    claims.email_verified !== true ||
    ![claims.iat, claims.exp].every(Number.isFinite) ||
    claims.iat * 1000 > now ||
    claims.exp * 1000 <= now ||
    claims.exp - claims.iat > 3600
  )
    throw Error("service_identity_binding_or_expiry");
  const token = Object.freeze({
    email: claims.email,
    subject: claims.sub,
    audience,
    expiresAt: claims.exp * 1000,
    issuer: claims.iss,
    digest: hash(jwt),
  });
  verified.set(token, token);
  return token;
}
export function serviceIdentity(v) {
  return verified.get(v);
}
/** Private signer material is supplied only to the independent observer process
 * via its own secret mount. It is never returned in an envelope or log. */
export class ObserverSigner {
  #key;
  #verifier;
  constructor({ privateKey, sessionId, issuer, now = Date.now }) {
    this.#key = createPrivateKey(privateKey);
    if (this.#key.asymmetricKeyType !== "ed25519")
      throw Error("independent_ed25519_key_required");
    this.sessionId = sessionId;
    this.issuer = issuer;
    this.now = now;
    this.publicKey = createPublicKey(this.#key).export({
      format: "pem",
      type: "spki",
    });
    this.keyId = evidenceKeyId(this.publicKey);
    this.#verifier = createEvidenceVerifier({
      sessionId,
      now,
      maxEnvelopeAgeMs: 3600000,
      trustedSources: [
        {
          role: "INDEPENDENT_OBSERVER",
          issuer,
          keyId: this.keyId,
          publicKey: this.publicKey,
          types: ["FENCE", "ACTIVITY", "CLOCK", "CANARY", "LEDGER"],
        },
      ],
    });
  }
  observe(type, payload, { ttlMs = 60000 } = {}) {
    if (ttlMs <= 0 || ttlMs > 3600000) throw Error("bounded_observation_ttl");
    const at = this.now(),
      body = {
        schema: OBSERVATION_SCHEMA,
        issuer: this.issuer,
        keyId: this.keyId,
        sessionId: this.sessionId,
        recordType: type,
        issuedAt: at,
        expiresAt: at + ttlMs,
        payload,
      },
      wire = JSON.stringify({
        ...body,
        signature: sign(null, Buffer.from(canonical(body)), this.#key).toString(
          "base64",
        ),
      });
    return { wire, token: this.#verifier.verify(wire) };
  }
}
