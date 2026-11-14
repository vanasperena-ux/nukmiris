// New readiness helper; historical packaging/evidence files are never written.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  readdir,
  chown,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { certkit } from "../test/b1a2-certkit.mjs";
import { FakeEvidenceClient } from "../b1a2/runtime/fake-client.mjs";
import { prepareLocalMutualTlsTarget } from "../b1a/runtime/profile.mjs";
import { invokeOnce } from "../src/transport.mjs";
import { hash } from "../src/protocol.mjs";
import { verifyRecords } from "../src/ledger.mjs";
const image = process.argv[2];
assert.match(image ?? "", /^sha256:[a-f0-9]{64}$/);
const exec = promisify(execFile),
  env = {
    ...process.env,
    DOCKER_CONFIG: "/tmp/nukmiris-readiness-docker-config",
  };
for (const k of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[k];
const docker = async (args) =>
  (
    await exec("docker", ["--host=unix:///var/run/docker.sock", ...args], {
      env,
      timeout: 60000,
      maxBuffer: 1048576,
    })
  ).stdout;
const dir = await mkdtemp(join(tmpdir(), "nukmiris-readiness-package-")),
  name = "readiness-fake-" + randomBytes(6).toString("hex");
try {
  const tls = await certkit(dir),
    sessionId = randomUUID(),
    scopeId = randomUUID(),
    bridge = JSON.parse(await docker(["network", "inspect", "bridge"]))[0].IPAM
      .Config[0].Gateway;
  await mkdir(join(dir, "ledger"));
  await writeFile(
    join(dir, "config.json"),
    JSON.stringify({
      tls: tls.server,
      sessionId,
      scopeId,
      expectedGateways: [{ epoch: 1, revision: "readiness-packaged-r1" }],
      identities: {
        [tls.gateway.fingerprint]: {
          role: "gateway",
          epoch: 1,
          revision: "readiness-packaged-r1",
        },
        [tls.observer.fingerprint]: { role: "observer" },
      },
      sourceAllowlist: {
        gateway: [bridge + "/32"],
        observer: [bridge + "/32"],
      },
    }),
    { mode: 0o600 },
  );
  if (process.getuid() === 0) {
    await chown(dir, 1000, 1000);
    for (const f of await readdir(dir)) await chown(join(dir, f), 1000, 1000);
  }
  const script =
    "import{readFile}from'node:fs/promises';import{providerJournal}from'./b1a2/runtime/journal.mjs';import{startFakeProvider}from'./b1a2/runtime/fake-provider.mjs';const c=JSON.parse(await readFile('/fixtures/config.json','utf8'));const a=await providerJournal('/ledger/allowed.jsonl');await startFakeProvider({...c,ledger:a,host:'0.0.0.0',port:8443});const b=await providerJournal('/ledger/denied.jsonl');await startFakeProvider({...c,ledger:b,sourceAllowlist:{...c.sourceAllowlist,gateway:['192.0.2.1/32']},host:'0.0.0.0',port:8444});";
  await docker([
    "run",
    "--detach",
    "--name",
    name,
    "--label",
    "nukmiris.readiness=synthetic-local",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--publish",
    "127.0.0.1::8443",
    "--publish",
    "127.0.0.1::8444",
    "--mount",
    "type=bind,source=" + dir + ",target=/fixtures,readonly",
    "--mount",
    "type=bind,source=" + join(dir, "ledger") + ",target=/ledger",
    "--entrypoint",
    "node",
    image,
    "--input-type=module",
    "-e",
    script,
  ]);
  const address = async (p) => ({
      host: "127.0.0.1",
      port: Number(
        (await docker(["port", name, p + "/tcp"])).trim().split(":").at(-1),
      ),
    }),
    allowed = await address(8443),
    denied = await address(8444),
    observer = new FakeEvidenceClient({
      address: allowed,
      tls: tls.observer,
      sessionId,
    });
  let up = false;
  for (let i = 0; i < 40; i++) {
    try {
      await observer.clock();
      up = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (!up)
    throw Error("packaged_fake_failed " + (await docker(["logs", name])));
  const binding = {
    scopeId,
    attemptId: randomUUID(),
    operationId: randomUUID(),
    epoch: 1,
    revision: "readiness-packaged-r1",
    payload: { synthetic: true },
    payloadDigest: hash({ synthetic: true }),
    deadlineAt: new Date(Date.now() + 5000).toISOString(),
    mode: "OK",
  };
  await observer.plan(binding);
  await invokeOnce({
    target: prepareLocalMutualTlsTarget(allowed, tls.gateway),
    binding,
    hook: async () => {},
    trace: () => {},
  });
  const exported = (await observer.ledger()).value;
  verifyRecords(exported.records, exported.checkpoint);
  assert.equal(exported.records.filter((r) => r.event === "EFFECT").length, 1);
  await assert.rejects(
    new FakeEvidenceClient({
      address: allowed,
      tls: tls.unknown,
      sessionId,
    }).ledger(),
  );
  const other = new FakeEvidenceClient({
    address: denied,
    tls: tls.observer,
    sessionId,
  });
  await other.plan(binding);
  await assert.rejects(
    invokeOnce({
      target: prepareLocalMutualTlsTarget(denied, tls.gateway),
      binding,
      hook: async () => {},
      trace: () => {},
    }),
  );
  const no = (await other.ledger()).value;
  verifyRecords(no.records, no.checkpoint);
  assert.ok(!no.records.some((r) => ["REQUEST", "EFFECT"].includes(r.event)));
  console.log(
    JSON.stringify({
      scope: "LOCAL_PACKAGED_MTLS_AND_SOURCE_ALLOWLIST_NOT_GCP",
      testedSource: process.env.B1A2_SOURCE_SHA,
      image,
      nonRootUser: JSON.parse(await docker(["inspect", name]))[0].Config.User,
      syntheticEffects: 1,
      unknownIdentityRejected: true,
      unauthorizedSourceRejected: true,
      exportedLedgerVerified: true,
      keysMountedOutsideImage: true,
    }),
  );
} finally {
  await docker(["rm", "--force", "--volumes", name]).catch(() => {});
  await rm(dir, { force: true, recursive: true });
  const cleanup = {
    scope: "LOCAL_CLEANUP",
    containerRemoved:
      JSON.parse(
        (await docker([
          "ps",
          "--all",
          "--filter",
          "name=^" + name + "$",
          "--format",
          "json",
        ])) || "null",
      ) === null,
    fixtureDirectoryRemoved: true,
  };
  console.log(JSON.stringify(cleanup));
  assert.equal(
    cleanup.containerRemoved,
    true,
    "owned_packaged_container_cleanup_incomplete",
  );
}
