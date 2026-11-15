import test from "node:test";
import assert from "node:assert/strict";
import { retirementFixture } from "./b1a2-fixture.mjs";
import { signedRecords } from "./readiness-fixtures.mjs";
import { retirementV2 } from "../b1a2/runtime/retirement.mjs";
import { validateProviderIdentities } from "../b1a2/runtime/provider-identities.mjs";
import { startFakeProvider } from "../b1a2/runtime/fake-provider.mjs";
import { syntheticInputs, validateInputs } from "../b1a2/runtime/inputs.mjs";
import { validateStartup } from "../b1a2/runtime/startup.mjs";
import { identityKit } from "./b1a2-identity-kit.mjs";
const fp = "AA:".repeat(31) + "AA";
test("H-3 Q29/Q30/Q31 partial retired identities are retained as HOLD, never ignored", () => {
  for (const fields of [
    { authenticatedEpoch: 1, authenticatedRevision: "old-r9" },
    { authenticatedEpoch: 1 },
    { authenticatedRevision: "old-r1" },
    { authenticatedEpoch: 2, authenticatedRevision: "old-r1" },
  ]) {
    const d = signedRecords(retirementFixture(), [
      { event: "TLS_READY", at: 519995, connectionId: "partial", ...fields },
      {
        event: "REQUEST",
        at: 520000,
        connectionId: "partial",
        attemptId: "partial",
        ...fields,
      },
    ]);
    const v = retirementV2(d);
    assert.equal(v.state, "HOLD");
    assert.equal(v.reason, "provider_retired_identity_ambiguous");
    assert.equal(v.derivedActivityCount, 2);
  }
});
test("H-3 conclusive authenticated old traffic remains VIOLATION despite misleading header identities or another partial record", () => {
  const d = signedRecords(retirementFixture(), [
    {
      event: "TLS_READY",
      at: 10000,
      connectionId: "ambiguous",
      authenticatedEpoch: 1,
    },
    {
      event: "REQUEST",
      at: 520000,
      attemptId: "certain",
      authenticatedEpoch: 1,
      authenticatedRevision: "old-r1",
      epoch: 2,
      revision: "forged",
    },
  ]);
  assert.equal(retirementV2(d).state, "VIOLATION");
  assert.equal(retirementV2({ ...d, ledger: { ...d.ledger } }).state, "HOLD");
});
test("H-3 provider startup rejects missing/wrong/conflicting gateway maps before listening", async () => {
  const expected = [{ epoch: 1, revision: "old-r1" }];
  assert.ok(
    validateProviderIdentities(
      { [fp]: { role: "gateway", epoch: 1, revision: "old-r1" } },
      expected,
    ),
  );
  for (const fields of [
    { role: "gateway", epoch: 1 },
    { role: "gateway", revision: "old-r1" },
    { role: "gateway", epoch: 1, revision: "wrong" },
    { role: "observer", epoch: 1, revision: "old-r1" },
    { role: "gateway", epoch: 1, revision: "old-r1", tenantId: "forged" },
  ]) {
    assert.throws(() => validateProviderIdentities({ [fp]: fields }, expected));
    await assert.rejects(
      startFakeProvider({
        tls: { key: "not-read", cert: "not-read", ca: "not-read" },
        identities: { [fp]: fields },
        expectedGateways: expected,
        sourceAllowlist: { gateway: [] },
        sessionId: "11111111-1111-4111-8111-111111111111",
        scopeId: "22222222-2222-4222-8222-222222222222",
        ledger: {},
      }),
      /identity|epoch|observer/,
    );
  }
});
test("H-3 mounted live profile cannot redefine the approved gateway epoch/revision pair", () => {
  const now = Date.parse("2026-11-14T12:00Z"),
    c = validateInputs(syntheticInputs(now), { now }),
    k = identityKit({ email: c.serviceIdentities.fake, now });
  const p = {
    schema: "B1A2_PROFILE_V1",
    role: "fake",
    identitySubject: k.subject,
    audience: k.audience,
    inputDigest: c.inputDigest,
    sessionId: c.session.id,
    scopeId: c.session.scopeId,
    expiresAt: c.session.expiresAt,
    epoch: 1,
    revision: c.epochs.oldRevision,
    image: c.images.fake,
    provider: {
      identities: {
        [fp]: { role: "gateway", epoch: 1, revision: "unexpected-r1" },
      },
    },
  };
  assert.throws(
    () =>
      validateStartup({
        profile: p,
        identity: k.identity,
        role: "fake",
        inputs: c,
        now,
      }),
    /provider_gateway_epoch_revision/,
  );
});
