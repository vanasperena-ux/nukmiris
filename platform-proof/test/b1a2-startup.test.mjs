import { SyntheticInitialization } from "../b1a2/runtime/initialize.mjs";
import { BillingSupervisor } from "../b1a2/runtime/billing.mjs";
import { SessionController } from "../b1a/runtime/session-policy.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fixture, request } from "./helpers.mjs";
import { identityKit } from "./b1a2-identity-kit.mjs";
import { certkit } from "./b1a2-certkit.mjs";
import { protocolFixture } from "./b1a2-protocol-fixture.mjs";
import { syntheticInputs, validateInputs } from "../b1a2/runtime/inputs.mjs";
import {
  startComponent,
  validateStartup,
  callJson,
  readMounts,
} from "../b1a2/runtime/startup.mjs";
import { verifyServiceIdentity } from "../b1a2/runtime/identity.mjs";
import { CustodyJournal, providerJournal } from "../b1a2/runtime/journal.mjs";
import { startFakeProvider } from "../b1a2/runtime/fake-provider.mjs";
import { FakeEvidenceClient } from "../b1a2/runtime/fake-client.mjs";
import { hash } from "../src/protocol.mjs";
function roleDb(f, role) {
  return {
    async query(sql, args) {
      const c = await f.admin.connect();
      try {
        await c.query("BEGIN");
        await c.query("SET LOCAL ROLE " + role);
        const r = await c.query(sql, args);
        await c.query("COMMIT");
        return r;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    },
  };
}
test("P-1 mounted identity/session/epoch/revision/expiry/image/secret invalid states remain inert", async () => {
  const now = Date.parse("2026-11-14T12:00Z"),
    c = validateInputs(syntheticInputs(now), { now }),
    k = identityKit({ email: c.serviceIdentities.gatewayOld, now }),
    p = {
      schema: "B1A2_PROFILE_V1",
      role: "gateway",
      identitySubject: k.subject,
      audience: k.audience,
      inputDigest: c.inputDigest,
      sessionId: c.session.id,
      scopeId: c.session.scopeId,
      expiresAt: c.session.expiresAt,
      epoch: 1,
      revision: c.epochs.oldRevision,
      image: c.images.runtime,
    };
  assert.ok(
    validateStartup({
      profile: p,
      identity: k.identity,
      inputs: c,
      role: "gateway",
      now,
    }),
  );
  for (const change of [
    {},
    { epoch: 3 },
    { revision: "stale" },
    { scopeId: randomUUID() },
    { sessionId: randomUUID() },
    { expiresAt: new Date(now - 1).toISOString() },
    { image: "mutable:latest" },
    { inputDigest: "forged" },
    { role: "worker" },
  ]) {
    if (Object.keys(change).length)
      assert.throws(() =>
        validateStartup({
          profile: { ...p, ...change },
          identity: k.identity,
          inputs: c,
          role: "gateway",
          now,
        }),
      );
  }
  assert.throws(() =>
    validateStartup({ identity: k.identity, inputs: c, role: "gateway", now }),
  );
  assert.throws(() =>
    validateStartup({
      profile: p,
      identity: { ...k.identity },
      inputs: c,
      role: "gateway",
      now,
    }),
  );
  await assert.rejects(
    readMounts("/tmp/b1a2-absent-secret-directory", "gateway"),
  );
  assert.throws(
    () => verifyServiceIdentity({ ...k.args, now: now + 3600001 }),
    /expiry/,
  );
  assert.throws(() =>
    verifyServiceIdentity({ ...k.args, jwt: k.jwt.slice(0, -5) + "aaaaa" }),
  );
});
test("P-1 full synthetic SQL admission → independent custody → worker → COMMIT-gated gateway → mTLS fake, restart and revocation", async (t) => {
  const f = await fixture(t, { control: true });
  await f.admin.query(
    await readFile(new URL("../b1a2/schema.sql", import.meta.url), "utf8"),
  );
  const now = Date.now(),
    raw = syntheticInputs(now);
  raw.epochs.oldRevision = "inc1-r1";
  raw.session.expiresAt = new Date(now + 3600000).toISOString();
  const c = validateInputs(raw, { now }),
    session = c.session.id,
    scope = c.session.scopeId;
  await f.admin.query(
    "INSERT INTO proof.authority(scope_id,epoch,revision) VALUES($1,1,$2)",
    [scope, c.epochs.oldRevision],
  );
  await roleDb(f, "inc1_controller").query(
    "SELECT proof.control_create($1,$2,1,$3,$4)",
    [session, scope, c.epochs.oldRevision, c.session.expiresAt],
  );
  const kit = await certkit(f.dir),
    callerKey = randomBytes(24).toString("hex"),
    ledger = await providerJournal(f.dir + "/b1a2-fake.jsonl"),
    fake = await startFakeProvider({
      tls: kit.server,
      sessionId: session,
      scopeId: scope,
      ledger,
      identities: {
        [kit.gateway.fingerprint]: {
          role: "gateway",
          epoch: 1,
          revision: "inc1-r1",
        },
        [kit.observer.fingerprint]: { role: "observer" },
      },
      sourceAllowlist: { gateway: ["127.0.0.1"], observer: ["127.0.0.1"] },
    });
  t.after(async () => {
    await fake.close();
    await ledger.close();
  });
  const client = new FakeEvidenceClient({
      address: fake.address,
      tls: kit.observer,
      sessionId: session,
    }),
    protocol = await protocolFixture(c);
  t.after(() => protocol.close());
  const custody = new CustodyJournal({
    api: protocol.api,
    sessionId: session,
    allowNewSession: true,
  });
  const make = (role) => {
    const k = identityKit({
      email: c.serviceIdentities[role === "gateway" ? "gatewayOld" : role],
      now,
    });
    return {
      role,
      inputs: c,
      identity: k.identity,
      db: roleDb(f, "inc1_" + role),
      mounts: {
        profile: {
          schema: "B1A2_PROFILE_V1",
          role,
          identitySubject: k.subject,
          audience: k.audience,
          inputDigest: c.inputDigest,
          sessionId: session,
          scopeId: scope,
          expiresAt: c.session.expiresAt,
          epoch: 1,
          revision: "inc1-r1",
          image: c.images.runtime,
          target: fake.address,
        },
        database: { ...f.db, user: "inc1_" + role },
        callerKey,
        tls: kit.gateway,
      },
    };
  };
  const config = make("gateway"),
    gateway = await startComponent(config);
  t.after(() => gateway.close());
  assert.equal(await gateway.ready(), false);
  const sealer = await startComponent({ ...make("sealer"), custody });
  t.after(() => sealer.close());
  const ingress = await startComponent({
    ...make("ingress"),
    callSealer: (v) => sealer.seal(v),
  });
  t.after(() => ingress.close());
  const worker = await startComponent({
    ...make("worker"),
    gatewayAddress: gateway.address,
  });
  t.after(() => worker.close());
  assert.equal((await worker.tick()).state, "HELD");
  await assert.rejects(
    roleDb(f, "inc1_gateway").query(
      "SELECT proof.enter_b1a($1,$2,$3,$4,1,$5)",
      [session, scope, randomUUID(), randomUUID(), "inc1-r1"],
    ),
    /permission denied/,
  );
  await assert.rejects(
    roleDb(f, "inc1_worker").query(
      "SELECT proof.plan($1,$2,$3,1,$4,$5,$6,$7,$8)",
      [
        scope,
        randomUUID(),
        randomUUID(),
        "inc1-r1",
        hash({ synthetic: true }),
        { synthetic: true },
        new Date(Date.now() + 1000),
        new Date(Date.now() + 2000),
      ],
    ),
    /permission denied/,
  );
  const initializer = new SyntheticInitialization({
    controller: new SessionController({
      db: roleDb(f, "inc1_controller"),
      sessionId: session,
    }),
    inputs: c,
    journal: custody,
    fake: client,
    custody,
  });
  await initializer.enable({
    profiles: [
      gateway.startupProfile,
      worker.startupProfile,
      ingress.startupProfile,
      sealer.startupProfile,
    ],
    operatorApprovalRef: "LOCAL_FIXTURE_ONLY_NO_CLOUD_AUTHORIZATION",
  });
  assert.equal(await gateway.ready(), true);
  const binding = {
    synthetic: true,
    scopeId: scope,
    attemptId: randomUUID(),
    operationId: randomUUID(),
    epoch: 1,
    revision: "inc1-r1",
    payload: { synthetic: true },
    payloadDigest: hash({ synthetic: true }),
    deadlineAt: new Date(Date.now() + 15000).toISOString(),
    inboundTimeoutAt: new Date(Date.now() + 16000).toISOString(),
    mode: "OK",
  };
  await client.plan(binding);
  const admission = await callJson({
    address: ingress.address,
    path: "/admit",
    key: callerKey,
    body: { scopeId: scope, batchId: randomUUID(), payload: binding },
  });
  assert.equal(admission.ack, true);
  assert.equal((await custody.snapshot()).records.length, 2);
  const outcome = await worker.tick();
  assert.equal(outcome.results[0].state, "APPLIED");
  await worker.tick();
  assert.equal(
    (await client.ledger()).value.records.filter((r) => r.event === "EFFECT")
      .length,
    1,
  );
  await roleDb(f, "inc1_controller").query("SELECT proof.control_hold($1,$2)", [
    session,
    "OPERATOR_HOLD",
  ]);
  assert.equal(await gateway.ready(), false);
  assert.equal((await worker.tick()).state, "HELD");
  const supervisor = new BillingSupervisor({
    controller: new SessionController({
      db: roleDb(f, "inc1_controller"),
      sessionId: session,
    }),
    journal: custody,
  });
  for (const type of [
    "BUDGET_RESET",
    "BILLING_DELAY",
    "CAPACITY_PAUSE",
    "WORKER_RESTART",
    "ACCOUNT_SUSPENDED",
    "RESOURCE_SUSPENDED",
    "SUSPENSION_RECOVERED",
    "SESSION_EXPIRED",
  ]) {
    await supervisor.event({ type, at: Date.now() });
    assert.equal(await gateway.ready(), false);
    assert.equal((await worker.tick()).state, "HELD");
  }
  const restarted = new CustodyJournal({
    api: protocol.api,
    sessionId: session,
  });
  await restarted.load();
  assert.equal((await restarted.snapshot()).records.length, 10);
  const invalid = await startComponent({
    ...make("worker"),
    db: {
      async query() {
        throw Error("invalid_database_state");
      },
    },
  });
  t.after(() => invalid.close());
  assert.equal(await invalid.ready(), false);
  await f.admin.query(
    "UPDATE proof.experiment_control SET dispatch_enabled=true,hold_reason='NONE' WHERE session_id=$1",
    [session],
  );
  await f.admin.query(
    "UPDATE proof.experiment_control SET lease_until=clock_timestamp()-interval '1 second' WHERE session_id=$1",
    [session],
  );
  assert.equal(await gateway.ready(), false);
  const renewed = await roleDb(f, "inc1_controller").query(
    "SELECT proof.control_renew($1,1,(SELECT (proof.control_read($1)->>'generation')::bigint)) renewed",
    [session],
  );
  assert.equal(renewed.rows[0].renewed, false);
  assert.equal((await worker.tick()).state, "HELD");
  await f.evidence("b1a2-startup-chain", {
    independentCustody: true,
    exactOriginalAttempt: binding.attemptId,
    revokedDispatchHeld: true,
    liveCloudTested: false,
  });
});
