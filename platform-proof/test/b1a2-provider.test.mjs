import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { certkit } from "./b1a2-certkit.mjs";
import { providerJournal } from "../b1a2/runtime/journal.mjs";
import { startFakeProvider } from "../b1a2/runtime/fake-provider.mjs";
import { FakeEvidenceClient } from "../b1a2/runtime/fake-client.mjs";
import { NetworkPolicyModel } from "../b1a2/runtime/network-policy.mjs";
import { prepareLocalMutualTlsTarget } from "../b1a/runtime/profile.mjs";
import { invokeOnce } from "../src/transport.mjs";
import { hash } from "../src/protocol.mjs";
async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), "b1a2-provider-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const tls = await certkit(dir),
    sessionId = randomUUID(),
    scopeId = randomUUID(),
    ledger = await providerJournal(join(dir, "provider.jsonl")),
    identities = {
      [tls.gateway.fingerprint]: {
        role: "gateway",
        epoch: 1,
        revision: "b1a2-old-r1",
      },
      [tls.observer.fingerprint]: { role: "observer" },
    },
    p = await startFakeProvider({
      tls: tls.server,
      identities,
      sessionId,
      scopeId,
      sourceAllowlist: { gateway: ["127.0.0.1"], observer: ["127.0.0.1"] },
      ledger,
    });
  t.after(async () => {
    await p.close();
    await ledger.close();
  });
  const observer = new FakeEvidenceClient({
    address: p.address,
    tls: tls.observer,
    sessionId,
  });
  return { dir, tls, sessionId, scopeId, ledger, p, observer };
}
test("P-4 deployable fake accepts epoch-bound mTLS effect; observer exports fsynced ledger; unauthorized identities reject", async (t) => {
  const f = await setup(t),
    binding = {
      scopeId: f.scopeId,
      attemptId: randomUUID(),
      operationId: randomUUID(),
      epoch: 1,
      revision: "b1a2-old-r1",
      payload: { synthetic: true },
      payloadDigest: hash({ synthetic: true }),
      deadlineAt: new Date(Date.now() + 3000).toISOString(),
    };
  await f.observer.plan({ ...binding, mode: "OK" });
  const target = prepareLocalMutualTlsTarget(f.p.address, f.tls.gateway);
  await invokeOnce({ target, binding, hook: async () => {}, trace: () => {} });
  const exported = await f.observer.ledger();
  assert.equal(
    exported.value.records.filter((r) => r.event === "EFFECT").length,
    1,
  );
  assert.ok(exported.value.records.some((r) => r.authenticatedEpoch === 1));
  const forbidden = new FakeEvidenceClient({
    address: f.p.address,
    tls: f.tls.gateway,
    sessionId: f.sessionId,
  });
  await assert.rejects(forbidden.ledger(), /denied_403/);
  const unknown = new FakeEvidenceClient({
    address: f.p.address,
    tls: f.tls.unknown,
    sessionId: f.sessionId,
  });
  await assert.rejects(unknown.ledger(), /denied_403/);
  assert.ok(
    (await readFile(join(f.dir, "provider.jsonl"), "utf8")).endsWith("\n"),
  );
});
test("P-4 modeled old-tag deny blocks only new connections, preserving the established-flow termination requirement", () => {
  const p = new NetworkPolicyModel();
  assert.equal(
    p.connect({ id: "old", role: "gateway", epoch: 1, destination: "fake:443" })
      .allowed,
    true,
  );
  p.revoke(1);
  assert.equal(
    p.connect({
      id: "late",
      role: "gateway",
      epoch: 1,
      destination: "fake:443",
    }).allowed,
    false,
  );
  assert.equal(p.existing("old").allowed, true);
  p.terminate(1);
  assert.equal(p.existing("old").allowed, false);
  assert.equal(
    p.connect({ id: "bad", role: "worker", epoch: 2, destination: "fake:443" })
      .allowed,
    false,
  );
  assert.equal(
    p.connect({
      id: "export",
      role: "fake",
      destination: "restricted-google-api:443",
    }).allowed,
    true,
  );
});
