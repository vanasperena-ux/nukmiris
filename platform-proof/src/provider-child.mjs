import https from "node:https";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { openLedger } from "./ledger.mjs";
import { hash, id } from "./protocol.mjs";
const send = (v) => process.send?.(v);
const config = await new Promise((r) => process.once("message", r));
const ledger = await openLedger(config.ledger, (r) =>
  send({ type: "record", record: r }),
);
const plans = new Map(),
  connections = new WeakMap(),
  sockets = new Set(),
  releases = new Map();
const append = (e) => ledger.append({ at: Date.now(), ...e });
const server = https.createServer(
  {
    key: config.key,
    cert: config.cert,
    minVersion: "TLSv1.3",
    ...(config.mutualTls
      ? { ca: config.cert, requestCert: true, rejectUnauthorized: true }
      : {}),
  },
  (req, res) => {
    void (async () => {
      const connectionId = req.socket.__inc1ConnectionId;
      let raw = "";
      for await (const b of req) {
        raw += b;
        if (raw.length > 4096) throw Error("payload_limit");
      }
      const attemptId = id(req.headers["x-inc1-attempt"]),
        p = plans.get(attemptId);
      const peer = config.mutualTls
          ? req.socket.getPeerCertificate()
          : undefined,
        identity = peer ? config.identities?.[peer.fingerprint256] : undefined;
      const binding = {
        scopeId: req.headers["x-inc1-scope"],
        attemptId,
        operationId: req.headers["x-inc1-operation"],
        epoch: Number(req.headers["x-inc1-epoch"]),
        revision: req.headers["x-inc1-revision"],
        payloadDigest: req.headers["x-inc1-digest"],
      };
      await append({
        event: "REQUEST",
        connectionId,
        ...binding,
        actualDigest: hash(raw),
        ...(peer
          ? {
              authenticatedFingerprint: peer.fingerprint256,
              authenticatedEpoch: identity?.epoch,
              authenticatedRevision: identity?.revision,
            }
          : {}),
      });
      if (
        (config.mutualTls &&
          (!req.socket.authorized ||
            !identity ||
            identity.epoch !== binding.epoch ||
            identity.revision !== binding.revision)) ||
        req.url !== "/effect" ||
        req.method !== "POST" ||
        !p ||
        Object.entries(binding).some(([k, v]) => p[k] !== v) ||
        binding.payloadDigest !== hash(raw)
      ) {
        await append({ event: "REJECTED", connectionId, ...binding });
        res.writeHead(403, { Connection: "close", "Content-Length": 0 });
        res.end();
        return;
      }
      if (p.mode === "REJECT") {
        await append({ event: "REJECTED", connectionId, ...binding });
        res.writeHead(503, { Connection: "close", "Content-Length": 0 });
        res.end();
        return;
      }
      if (p.mode === "STALL") {
        await append({ event: "STALLED", connectionId, ...binding });
        return;
      }
      if (p.mode === "DELAY") {
        await append({ event: "DELAY_BEFORE_APPLY", connectionId, ...binding });
        await new Promise((r) => {
          releases.set(attemptId, r);
          send({ type: "providerPaused", attemptId });
        });
      }
      await append({ event: "EFFECT", connectionId, ...binding });
      if (p.mode === "DROP") {
        await append({ event: "RESPONSE_DROPPED", connectionId, ...binding });
        req.socket.destroy();
        return;
      }
      const body = JSON.stringify({
        ...binding,
        ...(p.mode === "BAD_PROOF" ? { operationId: randomUUID() } : {}),
        ...(p.mode === "BAD_EPOCH" ? { epoch: binding.epoch + 1 } : {}),
        ...(p.mode === "BAD_REVISION"
          ? { revision: binding.revision + "-wrong" }
          : {}),
        accepted: true,
      });
      await append({ event: "RESPONSE", connectionId, ...binding });
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Connection: p.mode === "KEEP_ALIVE" ? "keep-alive" : "close",
      });
      res.end(body);
    })().catch(async () => {
      await append({ event: "PROVIDER_ERROR" }).catch(() => {});
      req.socket.destroy();
    });
  },
);
server.on("connection", (socket) => {
  const connectionId = randomUUID();
  connections.set(socket, connectionId);
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  void append({
    event: "TCP_ACCEPT",
    connectionId,
    remotePort: socket.remotePort,
  });
});
server.on("secureConnection", (socket) => {
  const connectionId = connections.get(socket._parent) || randomUUID();
  socket.__inc1ConnectionId = connectionId;
  void append({
    event: "TLS_READY",
    connectionId,
    protocol: socket.getProtocol(),
  });
});
server.on("tlsClientError", () => {});
server.keepAliveTimeout = 5000;
await new Promise((r) => server.listen(0, "127.0.0.1", r));
// A second local endpoint accepts TCP but deliberately never negotiates TLS.
const stall = net.createServer((s) => {
  sockets.add(s);
  s.on("close", () => sockets.delete(s));
  void append({ event: "TLS_STALL_TCP_ACCEPT", connectionId: randomUUID() });
});
await new Promise((r) => stall.listen(0, "127.0.0.1", r));
send({
  type: "ready",
  port: server.address().port,
  stallPort: stall.address().port,
});
process.on("message", (m) => {
  void (async () => {
    if (m.type === "plan") {
      plans.set(m.binding.attemptId, m.binding);
      send({ type: "ack", request: m.request });
    }
    if (m.type === "checkpoint")
      send({
        type: "checkpoint",
        request: m.request,
        head: await ledger.checkpoint(),
      });
    if (m.type === "release") {
      releases.get(m.attemptId)?.();
      releases.delete(m.attemptId);
    }
    if (m.type === "close") {
      for (const s of sockets) s.destroy();
      server.close();
      stall.close();
      const head = await ledger.checkpoint();
      await ledger.close();
      send({ type: "closed", head });
      process.disconnect();
    }
  })().catch(() => process.exit(2));
});
