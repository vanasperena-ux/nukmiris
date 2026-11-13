import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { GatewayStore } from "../src/store.mjs";
import { invokeOnce } from "../src/transport.mjs";
import {
  prepareLocalMutualTlsTarget,
  prepareSyntheticProfile,
  preparedDatabase,
  preparedProfile,
  preparedTarget,
} from "../b1a/runtime/profile.mjs";
import { randomUUID } from "node:crypto";

test("independent fake ledger authenticates per-epoch client certificate; spoofed epoch cannot apply", async (t) => {
  const f = await fixture(t, { mutualTls: true }),
    store = new GatewayStore({ ...f.db, user: "inc1_gateway" });
  try {
    const target = prepareLocalMutualTlsTarget(
      { host: "127.0.0.1", port: f.provider.port },
      f.clientTls,
    );
    for (const epoch of [1, 2]) {
      const b = await f.plan({
          epoch,
          revision: epoch === 1 ? "inc1-r1" : "inc1-r2",
        }),
        p = await store.enter(
          b.scopeId,
          b.attemptId,
          b.epoch,
          b.revision,
          async () => {},
        );
      assert.equal(p.state, "PERMIT_IN_PROCESS");
      const call = () =>
        invokeOnce({
          target,
          binding: p.consume(),
          hook: async () => {},
          trace: () => {},
        });
      if (epoch === 1) {
        await call();
        assert.equal(await store.applied(b.attemptId, p.ownerId), "APPLIED");
      } else {
        await assert.rejects(call(), /positive_proof_missing/);
        await store.unknown(b.attemptId, p.ownerId);
      }
      await f.checkpoint();
      const request = f.records.find(
        (r) => r.event === "REQUEST" && r.attemptId === b.attemptId,
      );
      assert.equal(request.authenticatedEpoch, 1);
      assert.match(request.authenticatedFingerprint, /^[A-F0-9:]+$/);
      assert.equal(
        f.records.filter(
          (r) => r.event === "EFFECT" && r.attemptId === b.attemptId,
        ).length,
        epoch === 1 ? 1 : 0,
      );
    }
    await f.evidence("b1a-authenticated-provider", {
      mutualTls: true,
      independentIdentityMapping: true,
      oldIdentityNotSilentlyRevokedToMaskViolations: true,
      cloudEvidence: false,
    });
  } finally {
    await store.close();
  }
});

test("cloud profile is pure privileged configuration; serialized or copied capabilities cannot bypass literal local defaults", async (t) => {
  const f = await fixture(t, { mutualTls: true }),
    input = {
      mode: "B1A_SYNTHETIC_PREPARATION",
      approvedFakeHost: "203.0.113.10",
      target: { host: "203.0.113.10", port: 443 },
      controlSessionId: randomUUID(),
      database: {
        host: "10.81.1.12",
        port: 5432,
        database: f.db.database,
        user: "inc1_gateway",
        password: "synthetic-not-used",
        ca: f.cert,
        servername: "sql.synthetic.invalid",
      },
      tls: f.clientTls,
    };
  const p = prepareSyntheticProfile(input);
  assert.equal(preparedProfile(p), true);
  assert.equal(preparedProfile({ ...p }), false);
  assert.equal(preparedDatabase(p.database).ssl.rejectUnauthorized, true);
  assert.equal(preparedDatabase({ ...p.database }), undefined);
  assert.equal(preparedTarget({ ...p.target }), undefined);
  assert.throws(
    () =>
      prepareSyntheticProfile({
        ...input,
        approvedFakeHost: "169.254.169.254",
        target: { host: "169.254.169.254", port: 443 },
      }),
    /allocated_fake/,
  );
  assert.throws(
    () => prepareSyntheticProfile({ ...input, controlSessionId: undefined }),
    /bounded_cloud/,
  );
  assert.throws(
    () =>
      prepareSyntheticProfile({
        ...input,
        database: { ...input.database, user: "postgres" },
      }),
    /bounded_cloud/,
  );
  assert.throws(() =>
    prepareSyntheticProfile({ ...input, tls: { ...f.clientTls, key: "bad" } }),
  );
  await f.evidence("b1a-cloud-profile-pure", {
    pureBuilder: true,
    actualCloudSocketOpened: false,
    opaqueCapabilities: true,
  });
});
