import { spawn, execFile, fork } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID, X509Certificate } from "node:crypto";
import { once } from "node:events";
import http from "node:http";
import net from "node:net";
import pg from "pg";
import { MODE, hash, canonical, database } from "../src/protocol.mjs";
import { captureFixtureDiagnostics } from "./fixture-diagnostics.mjs";
export const root = dirname(dirname(fileURLToPath(import.meta.url)));
const run = promisify(execFile),
  env = { ...process.env };
for (const k of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[k];
export const IMAGE =
  "postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5";
async function docker(args) {
  return run("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    env,
    timeout: 120000,
    maxBuffer: 1048576,
  });
}
export async function fixture(
  t,
  {
    startupFault = false,
    control = false,
    mutualTls = false,
    diagnosticDirectory = process.env.B1A_DIAGNOSTIC_DIR ||
      join(tmpdir(), "b1a-fixture-diagnostics"),
  } = {},
) {
  const dir = await mkdtemp(join(tmpdir(), "inc1-proof-")),
    name = "inc1-" + randomBytes(8).toString("hex"),
    dbName = "inc1_" + randomBytes(8).toString("hex"),
    password = randomBytes(24).toString("hex");
  const volume = name + "-pgdata";
  let admin, worker, provider;
  let failureDiagnostic;
  const capture = async (reason) =>
    (failureDiagnostic ??= await captureFixtureDiagnostics({
      docker,
      name,
      volume,
      directory: diagnosticDirectory,
      reason,
      secrets: [password],
      intentional: startupFault,
    }));
  const children = new Set();
  t.after(async () => {
    try {
      const state = JSON.parse(
        (await docker(["inspect", "--format", "{{json .State}}", name])).stdout,
      );
      if (!state.Running) await capture("container_exited_before_cleanup");
    } catch {
      /* Setup may have failed before the container existed. */
    }
    await Promise.all(
      [...children].map(async (c) => {
        if (c.exitCode !== null || c.signalCode !== null) return;
        const exited = once(c, "exit");
        c.kill("SIGKILL");
        await exited;
      }),
    );
    await worker?.end();
    await admin?.end();
    await docker(["rm", "-f", "-v", name]).catch(() => {});
    await docker(["volume", "rm", volume]).catch((e) => {
      if (!e.stderr?.toLowerCase().includes("no such volume"))
        throw Error("owned_fixture_volume_cleanup_failed");
    });
    await rm(dir, { recursive: true, force: true });
  });
  try {
    await docker(["image", "inspect", IMAGE]);
    await docker([
      "volume",
      "create",
      "--label",
      "nukmiris.inc1=local-proof",
      "--label",
      "nukmiris.inc1.owner=" + name,
      volume,
    ]);
    await docker([
      "run",
      "--detach",
      "--name",
      name,
      "--label",
      "nukmiris.inc1=local-proof",
      "--mount",
      "type=volume,source=" + volume + ",target=/var/lib/postgresql/data",
      "--publish",
      "127.0.0.1::5432",
      "--env",
      "POSTGRES_PASSWORD=" + password,
      "--env",
      "POSTGRES_DB=" + dbName,
      IMAGE,
      "-c",
      "timezone=UTC",
      "-c",
      "fsync=on",
      "-c",
      "synchronous_commit=on",
      ...(startupFault ? ["-c", "b1a_unknown_setting=on"] : []),
    ]);
    const port = Number(
      (await docker(["port", name, "5432/tcp"])).stdout
        .trim()
        .split(":")
        .at(-1),
    );
    const db = {
      host: "127.0.0.1",
      port,
      database: dbName,
      user: "postgres",
      password,
    };
    const startupDeadline = Date.now() + 60000;
    for (;;) {
      try {
        admin = new pg.Pool(database(db));
        await admin.query("SELECT 1");
        break;
      } catch (e) {
        await admin?.end();
        admin = null;
        const state = JSON.parse(
          (await docker(["inspect", "--format", "{{json .State}}", name]))
            .stdout,
        );
        if (!state.Running || Date.now() >= startupDeadline)
          throw Error(
            "fixture_startup_failed " +
              JSON.stringify({
                status: state.Status,
                exitCode: state.ExitCode,
                oom: state.OOMKilled,
                connectionCode: e.code,
              }),
          );
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    await admin.query(await readFile(join(root, "src/schema.sql"), "utf8"));
    if (control)
      await admin.query(await readFile(join(root, "b1a/schema.sql"), "utf8"));
    await admin.query(
      "ALTER ROLE inc1_worker PASSWORD '" +
        password +
        "'; ALTER ROLE inc1_gateway PASSWORD '" +
        password +
        "'",
    );
    worker = new pg.Pool(database({ ...db, user: "inc1_worker" }));
    await run(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-keyout",
        join(dir, "tls.key"),
        "-out",
        join(dir, "tls.pem"),
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1",
      ],
      { timeout: 30000 },
    );
    const cert = await readFile(join(dir, "tls.pem"), "utf8"),
      key = await readFile(join(dir, "tls.key"), "utf8"),
      records = [];
    async function child(file, config) {
      const c = fork(join(root, "src", file), [], {
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      children.add(c);
      let stderr = "";
      c.stderr.on("data", (d) => (stderr += d));
      c.on("exit", (code) => {
        if (code && code !== null) c.failure = stderr;
      });
      const ready = message(c, (m) => m.type === "ready");
      c.send(config);
      const info = await ready;
      return { c, ...info };
    }
    let clientTls;
    if (mutualTls) {
      await run(
        "openssl",
        [
          "req",
          "-newkey",
          "rsa:2048",
          "-nodes",
          "-keyout",
          join(dir, "client.key"),
          "-out",
          join(dir, "client.csr"),
          "-subj",
          "/CN=nmb1a-e000001",
        ],
        { timeout: 30000 },
      );
      await writeFile(
        join(dir, "client.ext"),
        "basicConstraints=critical,CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=clientAuth\n",
      );
      await run(
        "openssl",
        [
          "x509",
          "-req",
          "-in",
          join(dir, "client.csr"),
          "-CA",
          join(dir, "tls.pem"),
          "-CAkey",
          join(dir, "tls.key"),
          "-CAcreateserial",
          "-days",
          "1",
          "-out",
          join(dir, "client.pem"),
          "-extfile",
          join(dir, "client.ext"),
        ],
        { timeout: 30000 },
      );
      clientTls = {
        cert: await readFile(join(dir, "client.pem"), "utf8"),
        key: await readFile(join(dir, "client.key"), "utf8"),
        ca: cert,
        servername: "localhost",
      };
    }
    provider = await child("provider-child.mjs", {
      key,
      cert,
      ledger: join(dir, "provider.jsonl"),
      mutualTls,
      identities: clientTls
        ? {
            [new X509Certificate(clientTls.cert).fingerprint256]: {
              epoch: 1,
              revision: "inc1-r1",
            },
          }
        : undefined,
    });
    provider.c.on("message", (m) => {
      if (m.type === "record") records.push(m.record);
    });
    const callerKey = randomBytes(24).toString("hex");
    const f = {
      dir,
      volume,
      db,
      admin,
      worker,
      provider,
      records,
      cert,
      clientTls,
      children,
      async enableSqlTls() {
        // Files and commands target only this owned disposable container/volume.
        await docker([
          "cp",
          join(dir, "tls.pem"),
          name + ":/var/lib/postgresql/data/server.crt",
        ]);
        await docker([
          "cp",
          join(dir, "tls.key"),
          name + ":/var/lib/postgresql/data/server.key",
        ]);
        await docker([
          "exec",
          "--user",
          "root",
          name,
          "chown",
          "postgres:postgres",
          "/var/lib/postgresql/data/server.crt",
          "/var/lib/postgresql/data/server.key",
        ]);
        await docker([
          "exec",
          "--user",
          "root",
          name,
          "chmod",
          "0600",
          "/var/lib/postgresql/data/server.key",
        ]);
        await admin.query("ALTER SYSTEM SET ssl='on'");
        await admin.query("SELECT pg_reload_conf()");
      },
      version: (
        await admin.query(
          "SELECT version(), current_setting('TimeZone') timezone",
        )
      ).rows[0],
      async gateway(overrides = {}) {
        const g = await child("gateway-child.mjs", {
          mode: MODE,
          database: { ...db, user: "inc1_gateway" },
          target: { host: "127.0.0.1", port: provider.port },
          ca: cert,
          callerKey,
          epoch: 1,
          revision: "inc1-r1",
          ...overrides,
        });
        g.trace = [];
        g.identity = await processIdentity(g.c.pid);
        g.c.on("message", (m) => {
          if (m.type === "trace")
            g.trace.push({
              ...m,
              pid: g.c.pid,
              pidStart: g.identity.startTime,
            });
        });
        return g;
      },
      async plan({
        mode = "OK",
        deadlineMs = 1800,
        inboundMs = deadlineMs + 1500,
        payload = { synthetic: true },
        scopeId = randomUUID(),
        attemptId = randomUUID(),
        operationId = randomUUID(),
        epoch = 1,
        revision = "inc1-r1",
      } = {}) {
        const now = Date.now(),
          b = {
            scopeId,
            attemptId,
            operationId,
            epoch,
            revision,
            payloadDigest: hash(payload),
            payload,
            deadlineAt: new Date(now + deadlineMs).toISOString(),
            inboundTimeoutAt: new Date(now + inboundMs).toISOString(),
            mode,
          };
        await admin.query(
          "INSERT INTO proof.authority(scope_id,epoch,revision) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [scopeId, epoch, b.revision],
        );
        await worker.query("SELECT proof.plan($1,$2,$3,$4,$5,$6,$7,$8,$9)", [
          scopeId,
          attemptId,
          operationId,
          epoch,
          b.revision,
          b.payloadDigest,
          payload,
          b.deadlineAt,
          b.inboundTimeoutAt,
        ]);
        await rpc(provider.c, { type: "plan", binding: b });
        return b;
      },
      async request(g, b) {
        return request(
          g.address,
          { scopeId: b.scopeId, attemptId: b.attemptId },
          callerKey,
        );
      },
      async state(b) {
        return (
          await admin.query("SELECT state FROM proof.attempt WHERE id=$1", [
            b.attemptId,
          ])
        ).rows[0].state;
      },
      async fence(b) {
        await admin.query(
          "UPDATE proof.authority SET epoch=2,revision=$2,changed_at=clock_timestamp() WHERE scope_id=$1",
          [b.scopeId, "inc1-r2"],
        );
        return Date.now();
      },
      async checkpoint() {
        const request = randomUUID(),
          waiting = message(
            provider.c,
            (m) => m.type === "checkpoint" && m.request === request,
          );
        provider.c.send({ type: "checkpoint", request });
        return (await waiting).head;
      },
      async evidence(label, extra = {}) {
        const head = await f.checkpoint();
        const evidenceRoot =
          process.env.B1A_EVIDENCE_DIR || process.env.INC1_EVIDENCE_DIR;
        if (evidenceRoot) {
          const out = join(evidenceRoot, label);
          await mkdir(out, { recursive: true });
          await writeFile(
            join(out, "provider.jsonl"),
            await readFile(join(dir, "provider.jsonl")),
          );
          await writeFile(
            join(out, "checkpoint.json"),
            JSON.stringify(head, null, 2) + "\n",
          );
          await writeFile(
            join(out, "result.json"),
            JSON.stringify(
              {
                ...extra,
                version: f.version,
                evidenceScope: "B1A_LOCAL_SYNTHETIC_PREPARATION",
                testedSource:
                  process.env.B1A_SOURCE_SHA || "UNPINNED_DEVELOPMENT_RUN",
              },
              null,
              2,
            ) + "\n",
          );
        }
        return head;
      },
    };
    if (
      !process.versions.node.startsWith("24.") ||
      !/PostgreSQL 17\.11\b/.test(f.version.version) ||
      f.version.timezone !== "UTC"
    )
      throw Error("INC1_requires_Node24_PostgreSQL17_11_UTC");
    return f;
  } catch (error) {
    const diagnostic = await capture("fixture_setup_failed");
    throw Object.assign(
      Error("fixture_setup_failed; diagnostics captured before cleanup"),
      {
        diagnosticPath: diagnostic.path,
        diagnostic: diagnostic.record,
        setupErrorCode: error.code || "setup_error",
        fixtureVolume: volume,
      },
    );
  }
}
export async function ownedVolumePresent(name) {
  if (!/^inc1-[a-f0-9]{16}-pgdata$/.test(name))
    throw Error("not_owned_fixture_volume");
  try {
    const x = JSON.parse((await docker(["volume", "inspect", name])).stdout)[0];
    return x.Labels?.["nukmiris.inc1"] === "local-proof";
  } catch (e) {
    if (e.stderr?.toLowerCase().includes("no such volume")) return false;
    throw e;
  }
}
export function message(c, predicate, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clean();
      reject(Error("child_message_timeout " + c.failure));
    }, timeout);
    const listener = (m) => {
      if (predicate(m)) {
        clean();
        resolve(m);
      }
    };
    const exit = () => {
      clean();
      reject(Error("child_exited " + c.failure));
    };
    function clean() {
      clearTimeout(timer);
      c.off("message", listener);
      c.off("exit", exit);
    }
    c.on("message", listener);
    c.on("exit", exit);
  });
}
export async function rpc(c, m) {
  const request = randomUUID(),
    waiting = message(c, (v) => v.type === "ack" && v.request === request);
  c.send({ ...m, request });
  await waiting;
}
export async function arm(g, b, point) {
  const hook = message(
    g.c,
    (m) => m.type === "hook" && m.attemptId === b.attemptId,
  );
  await rpc(g.c, { type: "armHook", point, attemptId: b.attemptId });
  return { hook };
}
export async function processIdentity(pid) {
  const stat = await readFile("/proc/" + pid + "/stat", "utf8"),
    v = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  return { pid, state: v[0], startTime: v[19] };
}
export async function suspend(g) {
  g.c.kill("SIGSTOP");
  for (let i = 0; i < 100; i++) {
    const p = await processIdentity(g.c.pid);
    if (p.state === "T") return p;
    await new Promise((r) => setTimeout(r, 1));
  }
  throw Error("SIGSTOP_not_observed");
}
export async function wake(g, p, delay, { allowAbsent = false } = {}) {
  const c = fork(
    join(root, "src/waker.mjs"),
    [JSON.stringify({ ...p, delay })],
    { stdio: ["ignore", "ignore", "ignore", "ipc"] },
  );
  const m = await message(c, (v) => Object.hasOwn(v, "continued"));
  if (!m.continued && !allowAbsent) throw Error("independent_wake_failed");
  return m;
}
export async function stop(g) {
  if (g.c.exitCode !== null || g.c.signalCode !== null)
    return g.localExitObservation;
  const decisionAt = Date.now();
  const exited = once(g.c, "exit");
  g.c.kill("SIGKILL");
  const [exitCode, signal] = await exited;
  g.localExitObservation = {
    decisionAt,
    at: Date.now(),
    pid: g.c.pid,
    pidStart: g.identity?.startTime,
    exitObserved: true,
    exitCode,
    signal,
  };
  return g.localExitObservation;
}
export async function request(address, body, key) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        ...address,
        path: "/attempt",
        method: "POST",
        headers: {
          Authorization: "Local " + key,
          Connection: "close",
          "Content-Type": "application/json",
        },
        agent: false,
        timeout: 12000,
      },
      (res) => {
        let raw = "";
        res.on("data", (b) => (raw += b));
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve({ state: "UNKNOWN", transport: "invalid_response" });
          }
        });
        res.on("error", () =>
          resolve({ state: "UNKNOWN", transport: "response_lost" }),
        );
      },
    );
    req.on("error", () =>
      resolve({ state: "UNKNOWN", transport: "request_lost" }),
    );
    req.on("timeout", () => req.destroy());
    req.end(JSON.stringify(body));
  });
}
/** Drop the actual server COMMIT acknowledgement after it is generated. */
export async function lostCommitProxy(target) {
  let dropped = 0;
  const sockets = new Set();
  const server = net.createServer((client) => {
    const upstream = net.connect(target);
    for (const s of [client, upstream]) {
      sockets.add(s);
      s.on("error", () => {});
      s.on("close", () => sockets.delete(s));
    }
    client.pipe(upstream);
    let buffer = Buffer.alloc(0);
    upstream.on("data", (b) => {
      buffer = Buffer.concat([buffer, b]);
      while (buffer.length >= 5) {
        const n = buffer.readInt32BE(1) + 1;
        if (n < 5 || n > 1e7) {
          client.destroy();
          upstream.destroy();
          return;
        }
        if (buffer.length < n) return;
        const frame = buffer.subarray(0, n);
        buffer = buffer.subarray(n);
        if (frame[0] === 67 && frame.subarray(5).toString() === "COMMIT\0") {
          dropped++;
          client.destroy();
          upstream.destroy();
          return;
        }
        client.write(frame);
      }
    });
    upstream.on("close", () => client.destroy());
    client.on("close", () => upstream.destroy());
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    port: server.address().port,
    get dropped() {
      return dropped;
    },
    async close() {
      for (const s of sockets) s.destroy();
      await new Promise((r) => server.close(r));
    },
  };
}
