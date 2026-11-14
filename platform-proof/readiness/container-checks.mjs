// Mounted outside the candidate. Keys generated in memory, never baked into it.
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  syntheticInputs,
  validateInputs,
} from "/proof/b1a2/runtime/inputs.mjs";
import { verifyServiceIdentity } from "/proof/b1a2/runtime/identity.mjs";
import {
  validateStartup,
  readMounts,
  startComponent,
} from "/proof/b1a2/runtime/startup.mjs";
const now = Date.now(),
  c = validateInputs(syntheticInputs(now), { now }),
  pair = generateKeyPairSync("rsa", { modulusLength: 2048 }),
  jwk = {
    ...pair.publicKey.export({ format: "jwk" }),
    kid: "local-only",
    alg: "RS256",
  },
  subject = "111111111111111111111",
  audience = "https://fixture.run.app";
const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: jwk.kid }),
  ).toString("base64url"),
  body = Buffer.from(
    JSON.stringify({
      iss: "https://b1a2.fixture.invalid",
      aud: audience,
      email: c.serviceIdentities.worker,
      email_verified: true,
      sub: subject,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 3600,
    }),
  ).toString("base64url"),
  jwt =
    header +
    "." +
    body +
    "." +
    sign(
      "RSA-SHA256",
      Buffer.from(header + "." + body),
      pair.privateKey,
    ).toString("base64url");
const args = {
    jwt,
    jwks: { keys: [jwk] },
    audience,
    expectedEmail: c.serviceIdentities.worker,
    expectedSubject: subject,
    now,
    mode: "LOCAL_SIMULATION",
  },
  identity = verifyServiceIdentity(args),
  profile = {
    schema: "B1A2_PROFILE_V1",
    role: "worker",
    identitySubject: subject,
    audience,
    inputDigest: c.inputDigest,
    sessionId: c.session.id,
    scopeId: c.session.scopeId,
    expiresAt: c.session.expiresAt,
    epoch: 1,
    revision: c.epochs.oldRevision,
    image: c.images.runtime,
  };
const base = { profile, identity, inputs: c, role: "worker", now };
assert.ok(validateStartup(base));
assert.throws(() => validateStartup({ ...base, identity: undefined }));
assert.throws(() => validateStartup({ ...base, identity: { ...identity } }));
assert.throws(() =>
  validateStartup({ ...base, profile: { ...profile, epoch: 3 } }),
);
assert.throws(() =>
  validateStartup({ ...base, now: Date.parse(c.session.expiresAt) + 1 }),
);
assert.throws(() => verifyServiceIdentity({ ...args, now: now + 3600001 }));
await assert.rejects(readMounts("/absent-secret-directory", "worker"));
let allowed = true;
const app = await startComponent({
  role: "worker",
  mounts: { profile },
  identity,
  inputs: c,
  db: {
    async query(sql) {
      return sql.includes("runtime_ready")
        ? { rows: [{ ready: allowed }] }
        : { rows: [] };
    },
  },
});
try {
  assert.equal(await app.ready(), true);
  allowed = false;
  assert.equal(await app.ready(), false);
  assert.equal((await app.tick()).state, "HELD");
} finally {
  await app.close();
}
console.log(
  JSON.stringify({
    scope: "PACKAGED_RUNTIME_WITH_LOCAL_SQL_READINESS_STUB_NOT_CLOUD",
    node: process.version,
    missingIdentityRejected: true,
    copiedIdentityRejected: true,
    invalidEpochRejected: true,
    expiredSessionRejected: true,
    expiredIdentityRejected: true,
    missingSecretsRejected: true,
    revokedAuthorizationHeld: true,
    actualSqlRevocation:
      "Separate full native PostgreSQL suite; this container test stubs SQL readiness",
    privateKeysBakedIntoImage: false,
  }),
);
