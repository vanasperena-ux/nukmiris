import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { syntheticInputs, validateInputs } from "../b1a2/runtime/inputs.mjs";
import { ObserverSigner } from "../b1a2/runtime/identity.mjs";
import {
  IndependentObserver,
  CanaryScheduler,
} from "../b1a2/runtime/observer.mjs";
import { LocalProcessCanaries } from "../b1a2/runtime/canaries.mjs";
import { providerJournal } from "../b1a2/runtime/journal.mjs";
import { FakeEvidenceClient } from "../b1a2/runtime/fake-client.mjs";
import { startFakeProvider } from "../b1a2/runtime/fake-provider.mjs";
import { protocolFixture } from "./b1a2-protocol-fixture.mjs";
import { certkit } from "./b1a2-certkit.mjs";
import { retirementDecision } from "../b1a/runtime/session-policy.mjs";
import {
  measuredClock,
  authenticatedObservation,
} from "../src/evidence-source.mjs";
import { hash } from "../src/protocol.mjs";
test("D-2/P-2 end-to-end independent adapters: real mTLS clock/ledger, Google-shaped 60s/120s metrics, 20 native stopped canaries and signed retirement", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "b1a2-observer-"));
  t.after(() => rm(dir, { force: true, recursive: true }));
  const b = Date.parse("2026-11-14T12:00Z");
  let at = b + 1000;
  const now = () => at,
    c = validateInputs(syntheticInputs(b), { now: b }),
    tls = await certkit(dir),
    records = [],
    journal = {
      async append(v) {
        records.push(v);
        return v;
      },
    },
    ledger = await providerJournal(join(dir, "fake.jsonl")),
    fake = await startFakeProvider({
      tls: tls.server,
      identities: { [tls.observer.fingerprint]: { role: "observer" } },
      sourceAllowlist: { observer: ["127.0.0.1"] },
      ledger,
      sessionId: c.session.id,
      scopeId: c.session.scopeId,
      now,
    });
  t.after(async () => {
    await fake.close();
    await ledger.close();
  });
  const client = new FakeEvidenceClient({
    address: fake.address,
    tls: tls.observer,
    sessionId: c.session.id,
    now,
  });
  const metricPoints = () =>
    ["active", "idle"].map((state) => ({
      metric: {
        type: "run.googleapis.com/container/instance_count",
        labels: { state },
      },
      resource: {
        type: "cloud_run_revision",
        labels: {
          service_name: c.names.gateway,
          revision_name: c.epochs.oldRevision,
        },
      },
      points: [56000, 116000, 176000].map((ms) => ({
        interval: { endTime: new Date(b + ms).toISOString() },
        value: { int64Value: "0" },
      })),
    }));
  let missingIdle = false;
  const protocol = await protocolFixture(c, {
    now,
    respond: ({ u, service, reply, res }) => {
      res.setHeader("Date", new Date(at).toUTCString());
      if (service === "monitoring")
        return reply(200, {
          timeSeries: missingIdle ? metricPoints().slice(0, 1) : metricPoints(),
        });
      if (service === "run" && u.pathname.includes("/operations/"))
        return reply(200, {
          done: true,
          metadata: { endTime: new Date(b + 30000).toISOString() },
        });
      if (service === "run" && u.pathname.includes("/revisions/"))
        return reply(404, { error: "deleted" });
      if (service === "run") return reply(200, { name: c.names.gateway });
      if (service === "logging") return reply(200, { entries: [] });
      return reply(404, {});
    },
  });
  t.after(() => protocol.close());
  const keys = generateKeyPairSync("ed25519"),
    signer = new ObserverSigner({
      privateKey: keys.privateKey.export({ format: "pem", type: "pkcs8" }),
      sessionId: c.session.id,
      issuer: "local-independent-observer",
      now,
    }),
    observer = new IndependentObserver({
      inputs: c,
      api: protocol.api,
      fake: client,
      signer,
      journal,
      now,
      clockPolicy: {
        precisionMs: 2,
        driftPpm: 50,
        resyncAllowanceMs: 5,
        maxExtrapolationMs: 21600000,
        platformTimestampAllowanceMs: 1000,
      },
    }),
    clock = await observer.calibrate(),
    waker = new LocalProcessCanaries({ journal, now });
  t.after(() => waker.close());
  const scheduler = new CanaryScheduler({
      inputs: c,
      signer,
      waker,
      journal,
      now,
      waitUntil: async (target) => {
        at = target;
      },
    }),
    schedule = await scheduler.prepare({
      firstWakeAt: b + 310000,
      spacingMs: 10000,
      count: 20,
    });
  assert.equal(schedule.count, 20);
  // Independent kill before any delayed wake; every PID identity checked.
  for (const attemptId of waker.children.keys())
    await waker.terminate(attemptId);
  at = b + 299000;
  const platformClock = await observer.calibratePlatform(),
    samples = await observer.metrics({ start: b + 50000, end: b + 180000 }),
    deletion = await observer.deletion(
      "projects/" +
        c.projects.runtime.id +
        "/locations/" +
        c.region +
        "/operations/delete-old",
    );
  assert.equal(samples.length, 3);
  assert.equal(samples[2].visibleAt, b + 299000);
  const canary = await scheduler.run({
    schedule,
    declaredAt: b + 299000,
    measuredWakeTailMs: 20000,
    networkTransitBoundMs: 1000,
  });
  assert.equal(
    authenticatedObservation(canary.token, "CANARY").payload.trials.length,
    20,
  );
  at = b + 529000;
  const exported = await observer.providerLedger();
  at = b + 530000;
  const payload = {
    retirementModel: "METRIC_LATENCY_V2",
    scope: c.session.scopeId,
    retiredEpoch: 1,
    retiredRevision: c.epochs.oldRevision,
    clockSource: "gcp-platform-clock",
    visibilityClockSource: "independent-observer-clock",
    requestClockSource: "independent-observer-clock",
    retirementRequestedAt: b + 1000,
    at: b + 56000,
    terminationTargetMs: 60000,
    thresholdOwnerApproved: false,
    deletion,
    revisionDeleted: true,
    declaredAt: b + 299000,
    coverUntil: b + 176000,
    samplingIntervalMs: 60000,
    publicationLatencyMs: 120000,
    zeroObservationIntervalMs: 120000,
    metricFreshnessMs: 600000,
    requiredStates: ["active", "idle"],
    samples,
  };
  const fence = signer.observe("FENCE", payload),
    bundle = {
      fence: fence.token,
      clock: clock.token,
      clocks: [platformClock.token],
      canary: canary.token,
      ledger: exported.observation.token,
      ledgerRecords: exported.records,
      now: at,
      uncertaintyMs: measuredClock(
        authenticatedObservation(clock.token, "CLOCK").payload,
      ).uncertaintyMs,
    };
  const result = retirementDecision(bundle);
  assert.equal(result.state, "EVIDENCE_READY", JSON.stringify(result));
  assert.throws(
    () =>
      observer.deriveActivities({
        ledgerReceipt: { value: exported.records },
        natReceipt: {},
        transitPolicy: {
          upperMs: 1,
          measurementRefs: ["forged"],
          validUntil: at + 1,
        },
      }),
    /independent/,
  );
  await assert.rejects(observer.preserve({ sourceVerified: true }));
  missingIdle = true;
  await assert.rejects(
    observer.metrics({ start: b, end: b + 180000 }),
    /missing_instance_state/,
  );
  const out = process.env.B1A2_EVIDENCE_DIR;
  if (out) {
    await writeFile(
      join(out, "observer-retirement.json"),
      JSON.stringify(
        {
          scope: "LOCAL_PROTOCOL_AND_NATIVE_SIGNALS_NOT_GCP",
          observerPublicKey: signer.publicKey,
          observerKeyId: signer.keyId,
          testedSource: process.env.B1A2_SOURCE_SHA,
          clock: JSON.parse(clock.wire),
          platformClock: JSON.parse(platformClock.wire),
          fence: JSON.parse(fence.wire),
          canary: JSON.parse(canary.wire),
          ledger: JSON.parse(exported.observation.wire),
          ledgerRecords: exported.records,
          result,
          records,
        },
        null,
        2,
      ) + "\n",
    );
  }
});
test("P-2 forged caller wake booleans cannot become signed canary evidence", async () => {
  const c = validateInputs(syntheticInputs(), {
      now: Date.parse("2026-11-14T12:00Z"),
    }),
    s = new CanaryScheduler({
      inputs: c,
      signer: {
        observe() {
          throw Error("must_not_sign");
        },
      },
      journal: { async append() {} },
      now: () => Date.parse(c.session.startedAt),
      waitUntil: async () => {},
      waker: {
        async prepare(v) {
          return v;
        },
        async wake(v) {
          return { ...v, independent: true, parkedBeforeConnect: true };
        },
      },
    });
  const schedule = await s.prepare({
    firstWakeAt: Date.parse(c.session.startedAt) + 10000,
    spacingMs: 1000,
  });
  await assert.rejects(
    s.run({
      schedule,
      declaredAt: Date.parse(c.session.startedAt) + 1,
      measuredWakeTailMs: 1,
      networkTransitBoundMs: 1,
    }),
    /independent_wake_receipt_required/,
  );
});
