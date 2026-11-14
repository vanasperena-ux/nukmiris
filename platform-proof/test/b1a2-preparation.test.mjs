import test from "node:test";
import assert from "node:assert/strict";
import { syntheticInputs, validateInputs } from "../b1a2/runtime/inputs.mjs";
import { identityKit } from "./b1a2-identity-kit.mjs";
import { protocolFixture } from "./b1a2-protocol-fixture.mjs";
import {
  preparationAudience,
  collectPreparation,
} from "../b1a2/runtime/preparation.mjs";
import { startupProfile } from "../b1a2/runtime/startup.mjs";
import { hash } from "../src/protocol.mjs";
test("P-1 cross-process preparation requires independent actual config and purpose-bound signed identities for all roles", async (t) => {
  const now = Date.parse("2026-11-14T12:00Z"),
    c = validateInputs(syntheticInputs(now), { now }),
    profiles = {},
    tokens = {};
  let keys,
    wrongImage = false;
  for (const role of ["gateway", "worker", "ingress", "sealer"]) {
    const email = c.serviceIdentities[role === "gateway" ? "gatewayOld" : role],
      base = identityKit({ email, now });
    const p = (profiles[role] = {
      schema: "B1A2_PROFILE_V1",
      role,
      identitySubject: base.subject,
      audience: "https://fixture.run.app",
      inputDigest: c.inputDigest,
      sessionId: c.session.id,
      scopeId: c.session.scopeId,
      expiresAt: c.session.expiresAt,
      epoch: 1,
      revision: c.epochs.oldRevision,
      image: c.images.runtime,
      deploymentRevision:
        role === "gateway"
          ? c.epochs.oldRevision
          : c.names[role] + "-e000001-prepared",
    });
    const k = identityKit({ email, now, audience: preparationAudience(p) });
    keys = k.jwks;
    tokens[role] = k.jwt;
  }
  const f = await protocolFixture(c, {
    now: () => now,
    respond: ({ service, u, body, reply }) => {
      if (service === "jwks") return reply(200, keys);
      if (service === "run") {
        const role = Object.keys(profiles).find((role) =>
          u.pathname.endsWith("/" + c.names[role]),
        );
        return reply(200, {
          template: {
            serviceAccount:
              c.serviceIdentities[role === "gateway" ? "gatewayOld" : role],
            containers: [{ image: wrongImage ? "wrong" : c.images.runtime }],
            revision: profiles[role].deploymentRevision,
          },
        });
      }
      if (service === "logging") {
        const role = Object.keys(profiles).find((r) =>
          JSON.parse(body).filter.includes('jsonPayload.role="' + r + '"'),
        );
        return reply(200, {
          entries: [
            {
              jsonPayload: {
                event: "B1A2_PREPARED",
                role,
                sessionId: c.session.id,
                profileDigest: hash(profiles[role]),
                attestationJwt: tokens[role],
              },
            },
          ],
        });
      }
      reply(404, {});
    },
  });
  t.after(() => f.close());
  const args = {
    api: f.api,
    inputs: c,
    profiles,
    journal: { async append() {} },
    now: () => now,
    mode: "LOCAL_SIMULATION",
  };
  const caps = await collectPreparation(args);
  assert.equal(caps.length, 4);
  assert.ok(caps.every((cap) => startupProfile(cap)));
  wrongImage = true;
  await assert.rejects(collectPreparation(args), /resource_mismatch/);
  wrongImage = false;
  tokens.ingress = tokens.gateway;
  await assert.rejects(collectPreparation(args), /signature|binding|expiry/);
});
