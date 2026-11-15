import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { certkit } from "./b1a2-certkit.mjs";
import { providerJournal } from "../b1a2/runtime/journal.mjs";
import { startFakeProvider } from "../b1a2/runtime/fake-provider.mjs";
import { FakeEvidenceClient } from "../b1a2/runtime/fake-client.mjs";
import { IndependentObserver } from "../b1a2/runtime/observer.mjs";
import { ObserverSigner } from "../b1a2/runtime/identity.mjs";
import { syntheticInputs, validateInputs } from "../b1a2/runtime/inputs.mjs";
import {
  createEvidenceVerifier,
  evidenceKeyId,
  authenticatedObservation,
  measuredClock,
} from "../src/evidence-source.mjs";
import { hash } from "../src/protocol.mjs";
import {
  assessTransitEvidence,
  transitCollectionGate,
} from "../b1a2/runtime/transit-evidence.mjs";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
test("G-2 native separate process SIGSTOP after TLS then post-fence write on that same connection is a violation; signed raw ledger preserved", async (t) => {
  assert.equal(
    process.platform,
    "linux",
    "native signal evidence requires Linux",
  );
  const dir = await mkdtemp(join(tmpdir(), "nukmiris-readiness-native-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const c = validateInputs(syntheticInputs(Date.now()), { now: Date.now() }),
    tls = await certkit(dir),
    ledger = await providerJournal(join(dir, "provider.jsonl"));
  const fake = await startFakeProvider({
    tls: tls.server,
    identities: {
      [tls.gateway.fingerprint]: {
        role: "gateway",
        epoch: 1,
        revision: c.epochs.oldRevision,
      },
      [tls.observer.fingerprint]: { role: "observer" },
    },
    expectedGateways: [{ epoch: 1, revision: c.epochs.oldRevision }],
    sessionId: c.session.id,
    scopeId: c.session.scopeId,
    sourceAllowlist: { gateway: ["127.0.0.1"], observer: ["127.0.0.1"] },
    ledger,
  });
  t.after(async () => {
    await fake.close();
    await ledger.close();
  });
  const client = new FakeEvidenceClient({
    address: fake.address,
    tls: tls.observer,
    sessionId: c.session.id,
  });
  const pair = generateKeyPairSync("ed25519"),
    probeKey = generateKeyPairSync("ed25519"),
    publicKey = probeKey.publicKey.export({ type: "spki", format: "pem" }),
    keyId = evidenceKeyId(publicKey),
    signer = new ObserverSigner({
      privateKey: pair.privateKey.export({ type: "pkcs8", format: "pem" }),
      sessionId: c.session.id,
      issuer: "independent-native-provider-observer",
    }),
    records = [];
  const observer = new IndependentObserver({
    inputs: c,
    fake: client,
    signer,
    journal: {
      async append(r) {
        records.push(r);
      },
    },
    clockPolicy: {
      precisionMs: 1,
      driftPpm: 50,
      resyncAllowanceMs: 2,
      maxExtrapolationMs: 60000,
    },
  });
  const clock = await observer.calibrate(),
    binding = {
      scopeId: c.session.scopeId,
      attemptId: randomUUID(),
      operationId: randomUUID(),
      epoch: 1,
      revision: c.epochs.oldRevision,
      payload: { synthetic: true },
      payloadDigest: hash({ synthetic: true }),
    };
  await client.plan({ ...binding, mode: "OK" });
  const child = fork(
    new URL("./readiness-probe-child.mjs", import.meta.url),
    [],
    { stdio: ["ignore", "ignore", "pipe", "ipc"] },
  );
  t.after(() => {
    try {
      child.kill("SIGKILL");
    } catch {}
  });
  const parked = once(child, "message");
  child.send({
    config: {
      address: fake.address,
      tls: tls.gateway,
      binding,
      sessionId: c.session.id,
    },
    privateKey: probeKey.privateKey.export({ type: "pkcs8", format: "pem" }),
    sessionId: c.session.id,
  });
  assert.equal((await parked)[0].state, "TLS_PARKED");
  const identityBefore = (
    await readFile("/proc/" + child.pid + "/stat", "utf8")
  )
    .split(") ")[1]
    .split(" ")[19];
  child.kill("SIGSTOP");
  let stopped = false;
  for (let i = 0; i < 100; i++) {
    if (
      /State:\s+T/.test(
        await readFile("/proc/" + child.pid + "/status", "utf8"),
      )
    ) {
      stopped = true;
      break;
    }
    await pause(2);
  }
  assert.ok(stopped);
  const fenceAt = Date.now();
  await pause(80);
  const done = once(child, "message");
  child.kill("SIGCONT");
  child.send({ release: true });
  const message = (await done)[0];
  assert.equal(message.state, "DONE", message.message);
  const verifier = createEvidenceVerifier({
    sessionId: c.session.id,
    trustedSources: [
      {
        role: "INDEPENDENT_OBSERVER",
        issuer: "independent-native-probe",
        keyId,
        publicKey,
        types: ["ACTIVITY"],
      },
    ],
  });
  const probe = verifier.verify(message.wire),
    exported = await observer.providerLedger(),
    now = Date.now(),
    result = assessTransitEvidence({
      probe,
      ledger: exported.observation.token,
      ledgerRecords: exported.records,
      clock: clock.token,
      expected: {
        sessionId: c.session.id,
        scopeId: c.session.scopeId,
        epoch: 1,
        revision: c.epochs.oldRevision,
        probeKeyId: keyId,
        providerObserverKeyId: signer.keyId,
        providerFingerprint: tls.server.fingerprint,
        probeFingerprint: tls.gateway.fingerprint,
      },
      fenceAt,
      now,
      uncertaintyMs: measuredClock(
        authenticatedObservation(clock.token, "CLOCK").payload,
      ).uncertaintyMs,
      candidateUpperMs: 5000,
    });
  assert.equal(result.state, "VIOLATION", JSON.stringify(result));
  assert.equal(transitCollectionGate(result).state, "HOLD");
  for (const event of ["TLS_READY", "REQUEST", "EFFECT"])
    assert.equal(
      exported.records.filter(
        (r) =>
          r.event === event &&
          (event === "TLS_READY"
            ? r.authenticatedEpoch === 1
            : r.attemptId === binding.attemptId),
      ).length,
      1,
    );
  const out = process.env.B1A2_EVIDENCE_DIR;
  if (out)
    await writeFile(
      join(out, "readiness-native-transit.json"),
      JSON.stringify(
        {
          scope: "LOCAL_NATIVE_SIGNALS_AND_MTLS_NOT_GCP",
          testedSource: process.env.B1A2_SOURCE_SHA,
          sessionId: c.session.id,
          probePublicKey: publicKey,
          observerPublicKey: signer.publicKey,
          pid: child.pid,
          linuxStartTicks: identityBefore,
          stopObserved: true,
          fenceAt,
          now,
          clock: JSON.parse(clock.wire),
          probe: JSON.parse(message.wire),
          ledger: JSON.parse(exported.observation.wire),
          ledgerRecords: exported.records,
          result,
          gate: transitCollectionGate(result),
          records,
        },
        null,
        2,
      ) + "\n",
    );
});
