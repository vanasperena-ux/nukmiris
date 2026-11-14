import https from "node:https";
import { isIP } from "node:net";
import { X509Certificate, randomUUID } from "node:crypto";
import { canonical, hash, id } from "../../src/protocol.mjs";
function reply(res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": body.length,
    connection: "close",
  });
  res.end(body);
}
function ipAllowed(address, list) {
  const ip = address?.replace(/^::ffff:/, "");
  if (isIP(ip) !== 4) return false;
  const n = ip.split(".").reduce((n, x) => n * 256 + Number(x), 0);
  return list.some((v) => {
    const [base, p = "32"] = v.split("/");
    if (isIP(base) !== 4 || !/^\d+$/.test(p) || Number(p) > 32) return false;
    const size = 2 ** (32 - Number(p)),
      a = base.split(".").reduce((n, x) => n * 256 + Number(x), 0);
    return Math.floor(n / size) === Math.floor(a / size);
  });
}
export async function startFakeProvider({
  tls,
  identities,
  sourceAllowlist,
  ledger,
  host = "127.0.0.1",
  port = 0,
  now = Date.now,
  sessionId,
  scopeId,
}) {
  if (
    !tls?.key ||
    !tls?.cert ||
    !tls?.ca ||
    !identities ||
    !sourceAllowlist ||
    !["127.0.0.1", "0.0.0.0"].includes(host)
  )
    throw Error("synthetic_provider_configuration_required");
  id(sessionId);
  id(scopeId);
  const plans = new Map(),
    sockets = new Set();
  const server = https.createServer(
    {
      ...tls,
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: "TLSv1.3",
    },
    (req, res) => {
      void (async () => {
        const cert = req.socket.getPeerCertificate(),
          principal = identities[cert.fingerprint256];
        if (
          !req.socket.authorized ||
          !principal ||
          !ipAllowed(
            req.socket.remoteAddress,
            sourceAllowlist[principal.role] ?? [],
          )
        ) {
          reply(res, 403, { state: "DENIED" });
          return;
        }
        const url = new URL(req.url, "https://localhost");
        if (
          principal.role === "observer" &&
          req.method === "GET" &&
          url.pathname === "/clock"
        ) {
          const nonce = url.searchParams.get("nonce");
          id(nonce);
          const receivedAt = now();
          reply(res, 200, {
            sessionId,
            nonce,
            receivedAt,
            sentAt: now(),
            clockSource: "independent-fake-clock",
          });
          return;
        }
        if (
          principal.role === "observer" &&
          req.method === "GET" &&
          url.pathname === "/ledger"
        ) {
          const nonce = url.searchParams.get("nonce");
          id(nonce);
          const snapshot = await ledger.snapshot();
          reply(res, 200, {
            ...snapshot,
            sessionId,
            nonce,
            observedUntil: now(),
            clockSource: "independent-fake-clock",
          });
          return;
        }
        let raw = "";
        for await (const b of req) {
          raw += b;
          if (Buffer.byteLength(raw) > 65536)
            throw Error("bounded_provider_body");
        }
        if (
          principal.role === "observer" &&
          req.method === "POST" &&
          url.pathname === "/control/plan"
        ) {
          const p = JSON.parse(raw);
          id(p.scopeId);
          if (p.scopeId !== scopeId) throw Error("foreign_provider_scope");
          id(p.attemptId);
          id(p.operationId);
          if (
            !Number.isInteger(p.epoch) ||
            !p.revision ||
            !/^[a-f0-9]{64}$/.test(p.payloadDigest) ||
            ![
              "OK",
              "DROP",
              "DELAY",
              "REJECT",
              "BAD_EPOCH",
              "BAD_REVISION",
            ].includes(p.mode)
          )
            throw Error("bounded_fake_plan");
          const old = plans.get(p.attemptId);
          if (old && canonical(old) !== canonical(p))
            throw Error("immutable_fake_plan");
          plans.set(p.attemptId, Object.freeze(p));
          reply(res, 200, { planned: p.attemptId });
          return;
        }
        if (
          principal.role !== "gateway" ||
          req.method !== "POST" ||
          url.pathname !== "/effect"
        ) {
          reply(res, 403, { state: "DENIED" });
          return;
        }
        const binding = {
            scopeId: id(req.headers["x-inc1-scope"]),
            attemptId: id(req.headers["x-inc1-attempt"]),
            operationId: id(req.headers["x-inc1-operation"]),
            epoch: Number(req.headers["x-inc1-epoch"]),
            revision: req.headers["x-inc1-revision"],
            payloadDigest: req.headers["x-inc1-digest"],
          },
          plan = plans.get(binding.attemptId),
          connectionId = req.socket.b1a2Connection;
        if (
          binding.scopeId !== scopeId ||
          !Number.isInteger(binding.epoch) ||
          !/^[a-z0-9-]{1,63}$/.test(binding.revision ?? "") ||
          !/^[a-f0-9]{64}$/.test(binding.payloadDigest ?? "")
        )
          throw Error("malformed_provider_binding");
        const payload = JSON.parse(raw);
        if (!payload || payload.synthetic !== true)
          throw Error("synthetic_effect_payload_only");
        const receivedAt = now();
        await ledger.append({
          event: "REQUEST",
          at: receivedAt,
          connectionId,
          ...binding,
          actualDigest: hash(raw),
          authenticatedEpoch: principal.epoch,
          authenticatedRevision: principal.revision,
          authenticatedFingerprint: cert.fingerprint256,
        });
        if (
          !plan ||
          Object.entries(binding).some(([k, v]) => v !== plan[k]) ||
          principal.epoch !== binding.epoch ||
          principal.revision !== binding.revision ||
          hash(raw) !== binding.payloadDigest ||
          plan.mode === "REJECT"
        ) {
          await ledger.append({
            event: "REJECTED",
            at: now(),
            connectionId,
            ...binding,
          });
          reply(res, 403, { accepted: false });
          return;
        }
        if (plan.mode === "DELAY")
          await new Promise((r) =>
            setTimeout(r, Math.min(30000, Math.max(1, plan.delayMs ?? 50))),
          );
        await ledger.append({
          event: "EFFECT",
          at: now(),
          connectionId,
          ...binding,
        });
        if (plan.mode === "DROP") {
          await ledger.append({
            event: "RESPONSE_DROPPED",
            at: now(),
            connectionId,
            ...binding,
          });
          req.socket.destroy();
          return;
        }
        await ledger.append({
          event: "RESPONSE",
          at: now(),
          connectionId,
          ...binding,
        });
        reply(res, 200, {
          ...binding,
          accepted: true,
          ...(plan.mode === "BAD_EPOCH" ? { epoch: binding.epoch + 1 } : {}),
          ...(plan.mode === "BAD_REVISION"
            ? { revision: binding.revision + "-wrong" }
            : {}),
        });
      })().catch(() => {
        if (!res.headersSent) reply(res, 503, { state: "HELD" });
        else req.socket.destroy();
      });
    },
  );
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.on("secureConnection", (socket) => {
    socket.b1a2Connection = randomUUID();
    const cert = socket.getPeerCertificate(),
      principal = identities[cert.fingerprint256];
    void ledger
      .append({
        event: "TLS_READY",
        at: now(),
        connectionId: socket.b1a2Connection,
        authenticatedFingerprint: cert.fingerprint256,
        authenticatedEpoch: principal?.epoch ?? null,
        authenticatedRevision: principal?.revision ?? null,
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
      })
      .catch(() => socket.destroy());
  });
  server.on("tlsClientError", () => {});
  server.requestTimeout = 5000;
  server.keepAliveTimeout = 1;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return {
    address: { host: "127.0.0.1", port: server.address().port },
    async close() {
      for (const s of sockets) s.destroy();
      await new Promise((r) => server.close(r));
    },
  };
}
