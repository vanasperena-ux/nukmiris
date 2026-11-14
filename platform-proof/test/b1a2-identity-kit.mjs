import { generateKeyPairSync, sign } from "node:crypto";
import { verifyServiceIdentity } from "../b1a2/runtime/identity.mjs";
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 }),
  jwk = {
    ...pair.publicKey.export({ format: "jwk" }),
    kid: "local-disposable",
    alg: "RS256",
  };
export function identityKit({
  email,
  subject = "111111111111111111111",
  audience = "https://fixture.run.app",
  now = Date.now(),
  claims = {},
}) {
  const head = Buffer.from(
      JSON.stringify({ alg: "RS256", kid: jwk.kid }),
    ).toString("base64url"),
    body = Buffer.from(
      JSON.stringify({
        iss: "https://b1a2.fixture.invalid",
        aud: audience,
        email,
        email_verified: true,
        sub: subject,
        iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + 3600,
        ...claims,
      }),
    ).toString("base64url"),
    jwt =
      head +
      "." +
      body +
      "." +
      sign(
        "RSA-SHA256",
        Buffer.from(head + "." + body),
        pair.privateKey,
      ).toString("base64url");
  const args = {
    jwt,
    jwks: { keys: [jwk] },
    expectedEmail: email,
    expectedSubject: subject,
    audience,
    now,
    mode: "LOCAL_SIMULATION",
  };
  return {
    args,
    jwt,
    jwks: args.jwks,
    identity: verifyServiceIdentity(args),
    subject,
    audience,
  };
}
