import http from "node:http";
import https from "node:https";
import { readFile, lstat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import pg from "pg";
import {
  serviceIdentity,
  verifyServiceIdentity,
  ObserverSigner,
} from "./identity.mjs";
import { futureCloudTransport, LIVE_CLOUD_EXECUTION } from "./transport.mjs";
import { CloudApi } from "./cloud-api.mjs";
import { CustodyJournal } from "./journal.mjs";
import { IndependentObserver, CanaryScheduler } from "./observer.mjs";
import { FakeEvidenceClient } from "./fake-client.mjs";
import { startFakeProvider } from "./fake-provider.mjs";
import {
  prepareSyntheticProfile,
  prepareLocalMutualTlsTarget,
} from "../../b1a/runtime/profile.mjs";
import { SyntheticAdmission } from "../../b1a/runtime/admission.mjs";
import { startGateway } from "../../src/gateway.mjs";
import { database, hash, id, MODE } from "../../src/protocol.mjs";
import { startInert } from "../../b1a/runtime/bootstrap.mjs";
const startupCaps = new WeakMap();
export const startupProfile = (cap) => startupCaps.get(cap);
const ROLES = {
  gateway: "inc1_gateway",
  worker: "inc1_worker",
  ingress: "inc1_ingress",
  sealer: "inc1_sealer",
};
/** Mounts are read from an explicit directory; no env/ADC fallback or arbitrary
 * paths in HTTP input. The session profile itself is not a dispatch capability. */
export async function readMounts(directory, role) {
  if (
    !isAbsolute(directory) ||
    !["gateway", "worker", "ingress", "sealer", "observer", "fake"].includes(
      role,
    )
  )
    throw Error("exact_mount_directory_and_role_required");
  const manifest = JSON.parse(
    await readFile(resolve(directory, "manifest.json"), "utf8"),
  );
  const names = {
    gateway: ["profile", "database", "callerKey", "tls"],
    worker: ["profile", "database", "callerKey"],
    ingress: ["profile", "database", "callerKey"],
    sealer: ["profile", "database", "callerKey"],
    observer: ["profile", "observerSigningKey", "tls"],
    fake: ["profile", "tls"],
  };
  const out = {};
  for (const key of names[role]) {
    const file = manifest[key];
    if (
      typeof file !== "string" ||
      !/^[A-Za-z0-9_.-]+$/.test(file) ||
      file === "." ||
      file === ".."
    )
      throw Error("required_secret_mount_missing");
    const st = await lstat(resolve(directory, file));
    if (!st.isFile() || st.isSymbolicLink() || st.size > 65536)
      throw Error("regular_bounded_mount_required");
    const raw = await readFile(resolve(directory, file), "utf8");
    out[key] = ["callerKey", "observerSigningKey"].includes(key)
      ? raw.trim()
      : JSON.parse(raw);
  }
  return out;
}
export function validateStartup({
  profile: p,
  identity,
  role,
  now = Date.now(),
  inputs,
}) {
  const who = serviceIdentity(identity),
    expected =
      role === "gateway"
        ? p?.epoch === inputs?.epochs.old
          ? "gatewayOld"
          : "gatewayNext"
        : role;
  if (
    !p ||
    p.schema !== "B1A2_PROFILE_V1" ||
    p.role !== role ||
    !who ||
    who.expiresAt <= now ||
    who.email !== inputs.serviceIdentities[expected] ||
    who.subject !== p.identitySubject ||
    who.audience !== p.audience ||
    p.inputDigest !== inputs.inputDigest ||
    p.sessionId !== inputs.session.id ||
    p.scopeId !== inputs.session.scopeId ||
    p.expiresAt !== inputs.session.expiresAt ||
    now < Date.parse(inputs.session.startedAt) ||
    now >= Date.parse(p.expiresAt)
  )
    throw Error("startup_identity_session_or_expiry");
  id(p.sessionId);
  id(p.scopeId);
  if (
    ![inputs.epochs.old, inputs.epochs.next].includes(p.epoch) ||
    p.revision !==
      (p.epoch === inputs.epochs.old
        ? inputs.epochs.oldRevision
        : inputs.epochs.nextRevision) ||
    (p.image !== inputs.images.runtime && role !== "fake") ||
    (role === "fake" && p.image !== inputs.images.fake)
  )
    throw Error("startup_epoch_revision_or_image");
  const cap = Object.freeze({ ...p });
  startupCaps.set(cap, { profile: cap, identityExpiresAt: who.expiresAt });
  return cap;
}
export function connectRole(config, role, mode) {
  if (config?.user !== ROLES[role]) throw Error("restricted_sql_role_required");
  if (mode !== "LOCAL_SIMULATION")
    throw Error("cloud_sql_startup_requires_reviewed_activation");
  const pool = new pg.Pool({ ...database(config), max: 1 });
  pool.on("error", () => {});
  return pool;
}
/** Successful assembly is distinct from readiness. Every dispatch and ingress
 * request rechecks the SQL session; failed checks never invoke an effect. */
export async function startComponent({
  role,
  mounts,
  identity,
  inputs,
  db,
  mode = "LOCAL_SIMULATION",
  custody,
  now = Date.now,
  gatewayAddress,
  callSealer,
  tokenFor,
  port = 0,
  host = "127.0.0.1",
}) {
  if (mode !== "LOCAL_SIMULATION" && !LIVE_CLOUD_EXECUTION)
    throw Error("cloud_execution_requires_reviewed_activation_change");
  const p = validateStartup({
    profile: mounts.profile,
    identity,
    role,
    now: now(),
    inputs,
  });
  if (!ROLES[role] || db?.query === undefined)
    throw Error("runtime_sql_dependency_required");
  const authority = async () => {
    try {
      validateStartup({ profile: p, identity, role, now: now(), inputs });
      return (
        (
          await db.query("SELECT proof.runtime_ready($1,$2,$3,$4) ready", [
            p.sessionId,
            p.scopeId,
            p.epoch,
            p.revision,
          ])
        ).rows[0].ready === true
      );
    } catch {
      return false;
    }
  };
  const onlyScope = (v) => {
    if (v?.scopeId !== p.scopeId) throw Error("session_scope_mismatch");
  };
  let app;
  if (role === "gateway") {
    if (!/^[a-f0-9]{48}$/.test(mounts.callerKey ?? ""))
      throw Error("required_secret_mount_missing");
    let prepared, target;
    if (mode === "LOCAL_SIMULATION")
      target = prepareLocalMutualTlsTarget(p.target, mounts.tls);
    else
      prepared = prepareSyntheticProfile({
        mode: "B1A_SYNTHETIC_PREPARATION",
        approvedFakeHost: p.target.host,
        target: p.target,
        controlSessionId: p.sessionId,
        database: mounts.database,
        tls: mounts.tls,
      });
    app = await startGateway(
      {
        mode: MODE,
        database: mounts.database,
        prepared,
        target,
        ca: mounts.tls.ca,
        callerKey: mounts.callerKey,
        epoch: p.epoch,
        revision: p.revision,
        controlSessionId: p.sessionId,
        entryVersion: 2,
      },
      { readiness: authority },
    );
  } else {
    let sealerTail = Promise.resolve();
    const seal = (v) => {
      const work = sealerTail.then(async () => {
        onlyScope(v);
        if (!(await authority())) throw Error("synthetic_dispatch_held");
        const row = (
          await db.query("SELECT proof.admission_sealer_read($1,$2) value", [
            v.scopeId,
            v.batchId,
          ])
        ).rows[0].value;
        if (!row || hash(row.payload) !== row.digest)
          throw Error("committed_batch_not_verified");
        if (row.state === "ELIGIBLE")
          return { batchId: v.batchId, sealDigest: row.sealDigest };
        if (!custody) throw Error("independent_custody_required");
        const existing = await custody.findSeal?.(
          v.scopeId,
          v.batchId,
          row.digest,
        );
        const record =
          existing ??
          (await custody.append({
            event: "SYNTHETIC_ADMISSION_SEAL",
            scopeId: v.scopeId,
            batchId: v.batchId,
            digest: row.digest,
            at: now(),
          }));
        await db.query("SELECT proof.admission_seal($1,$2,$3,$4)", [
          v.scopeId,
          v.batchId,
          row.digest,
          record.hash,
        ]);
        return { batchId: v.batchId, sealDigest: record.hash };
      });
      sealerTail = work.catch(() => {});
      return work;
    };
    const admission =
      role === "ingress"
        ? new SyntheticAdmission({
            ingressDb: db,
            callSealer:
              callSealer ??
              ((v) =>
                callJson({
                  url: p.sealerUrl,
                  path: "/seal",
                  body: v,
                  key: mounts.callerKey,
                })),
          })
        : null;
    const tick = async () => {
      if (role !== "worker" || !(await authority())) return { state: "HELD" };
      const rows = (
        await db.query("SELECT proof.worker_pending($1,$2,$3,$4) value", [
          p.sessionId,
          p.scopeId,
          p.epoch,
          p.revision,
        ])
      ).rows;
      const results = [];
      for (const row of rows) {
        const v = row.value;
        onlyScope(v);
        const b = (
          await db.query(
            "SELECT proof.worker_plan_b1a2($1,$2,$3,$4,$5) value",
            [p.sessionId, p.scopeId, v.batchId, p.epoch, p.revision],
          )
        ).rows[0].value;
        results.push(
          await callJson({
            address: gatewayAddress,
            url: p.gatewayUrl,
            path: "/attempt",
            body: b,
            key: mounts.callerKey,
            identityToken: tokenFor ? await tokenFor(p.gatewayUrl) : undefined,
          }),
        );
      }
      return { state: "POLLED", results };
    };
    if (role === "sealer" && !custody)
      throw Error("independent_custody_required");
    app = await serve({
      host,
      port,
      handler: async (req, body) => {
        if (req.url === "/healthz")
          return { status: 200, value: { alive: true } };
        const ready = await authority();
        if (req.url === "/readyz")
          return { status: ready ? 200 : 503, value: { ready } };
        if (!ready || req.headers.authorization !== "Local " + mounts.callerKey)
          return { status: 503, value: { state: "HELD" } };
        if (req.method !== "POST") throw Error("bounded_post_required");
        onlyScope(body);
        if (role === "sealer" && req.url === "/seal")
          return { value: await seal(body) };
        if (role === "ingress" && req.url === "/admit") {
          if (body.payload?.synthetic !== true)
            throw Error("synthetic_payload_required");
          return { value: await admission.admit(body) };
        }
        throw Error("unknown_synthetic_endpoint");
      },
    });
    let closed = false,
      active = Promise.resolve(),
      timer;
    if (role === "worker") {
      const poll = () => {
        if (closed) return;
        active = tick()
          .catch(() => ({ state: "HELD" }))
          .finally(() => {
            if (!closed) timer = setTimeout(poll, 100);
          });
      };
      timer = setTimeout(poll, 100);
    }
    const close = app.close;
    app = {
      ...app,
      tick,
      seal: role === "sealer" ? seal : undefined,
      async close() {
        closed = true;
        clearTimeout(timer);
        await active;
        await sealerTail;
        await close();
      },
    };
  }
  return {
    ...app,
    ready: authority,
    profileDigest: hash(p),
    startupProfile: p,
  };
}
export function callJson({ address, url, path, body, key, identityToken }) {
  return new Promise((resolve, reject) => {
    if (!address && !url) throw Error("exact_service_endpoint_required");
    const u = url ? new URL(url) : null;
    if (u && u.protocol !== "https:") throw Error("service_tls_required");
    const client = u ? https : http;
    const r = client.request(
      u
        ? new URL(path, u)
        : new URL("http://" + address.host + ":" + address.port + path),
      {
        method: "POST",
        agent: false,
        headers: {
          authorization: "Local " + key,
          ...(identityToken
            ? { "X-Serverless-Authorization": "Bearer " + identityToken }
            : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (b) => {
          raw += b;
          if (raw.length > 65536) res.destroy(Error("bounded_response"));
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(Error("typed_service_response_required"));
          }
        });
        res.on("error", reject);
      },
    );
    const t = setTimeout(
      () => r.destroy(Error("bounded_service_deadline")),
      2000,
    );
    r.on("close", () => clearTimeout(t));
    r.on("error", reject);
    r.end(JSON.stringify(body));
  });
}
async function serve({ host, port, handler }) {
  const server = http.createServer((req, res) => {
    void (async () => {
      let raw = "";
      for await (const b of req) {
        raw += b;
        if (raw.length > 8192) throw Error("bounded_request");
      }
      const out = await handler(req, raw ? JSON.parse(raw) : null);
      res.writeHead(out.status ?? 200, {
        "content-type": "application/json",
        connection: "close",
      });
      res.end(JSON.stringify(out.value));
    })().catch(() => {
      res.writeHead(503);
      res.end('{"state":"HELD"}');
    });
  });
  await new Promise((r, j) => {
    server.once("error", j);
    server.listen(port, host, r);
  });
  return {
    address: { host: "127.0.0.1", port: server.address().port },
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    },
  };
}
/** Future cloud assembly is fully explicit, but the immutable gate prevents any
 * metadata/credential/secret read in this increment, including from this CLI. */
export async function cloudMain() {
  if (!LIVE_CLOUD_EXECUTION)
    throw Error("cloud_execution_requires_reviewed_activation_change");
  const { mountedCloudMain } = await import("./assembly.mjs");
  return mountedCloudMain({ role: process.env.B1A2_ROLE });
}
