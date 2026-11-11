import http from "node:http";
import { GatewayStore } from "./store.mjs";
import { invokeOnce } from "./transport.mjs";
import { MODE, endpoint, exact, id } from "./protocol.mjs";
/** Service authentication identifies a caller; it is NOT an effect permit. */
export async function startGateway(
  config,
  { hook = async () => {}, trace = () => {} } = {},
) {
  if (
    config.mode !== MODE ||
    config.database.user !== "inc1_gateway" ||
    !/^[a-f0-9]{48}$/.test(config.callerKey) ||
    !Number.isInteger(config.epoch) ||
    config.epoch < 1 ||
    !/^[a-z0-9-]{1,63}$/.test(config.revision)
  )
    throw Error("local_gateway_configuration");
  endpoint(config.target);
  const store = new GatewayStore(config.database),
    active = new Set();
  const server = http.createServer((req, res) => {
    void (async () => {
      if (
        req.method !== "POST" ||
        req.url !== "/attempt" ||
        req.headers.authorization !== "Local " + config.callerKey
      ) {
        res.writeHead(403);
        res.end();
        return;
      }
      let raw = "";
      for await (const b of req) {
        raw += b;
        if (raw.length > 512) throw Error("request_too_large");
      }
      const p = exact(JSON.parse(raw), ["scopeId", "attemptId"]);
      id(p.scopeId);
      id(p.attemptId);
      const work = (async () => {
        const permit = await store.enter(
          p.scopeId,
          p.attemptId,
          config.epoch,
          config.revision,
          hook,
        );
        if (permit.state !== "PERMIT_IN_PROCESS")
          return {
            state: permit.state,
            attemptId: p.attemptId,
            ...(permit.recovery ? { recovery: permit.recovery } : {}),
          };
        let binding;
        try {
          binding = permit.consume();
        } catch {
          await store.unknown(p.attemptId, permit.ownerId);
          return { state: "UNKNOWN", attemptId: p.attemptId };
        }
        const deadline = Date.parse(binding.deadlineAt),
          inbound = Date.parse(binding.inboundTimeoutAt);
        if (
          !Number.isFinite(deadline) ||
          !Number.isFinite(inbound) ||
          deadline >= inbound
        ) {
          await store.unknown(p.attemptId, permit.ownerId);
          return { state: "UNKNOWN", attemptId: p.attemptId };
        }
        const end = setTimeout(
          () => {
            if (!res.writableEnded) res.destroy();
          },
          Math.max(1, inbound - Date.now()),
        );
        try {
          await invokeOnce({
            target: config.target,
            ca: config.ca,
            binding,
            hook,
            trace: (event, connection = {}) =>
              trace({
                ...p,
                event,
                ...connection,
                at: Date.now(),
                epoch: config.epoch,
                revision: config.revision,
              }),
          });
          const state = await store.applied(p.attemptId, permit.ownerId);
          return { state, attemptId: p.attemptId };
        } catch {
          await store.unknown(p.attemptId, permit.ownerId);
          return { state: "UNKNOWN", attemptId: p.attemptId };
        } finally {
          clearTimeout(end);
        }
      })();
      active.add(work);
      try {
        const value = await work;
        if (!res.destroyed) {
          res.writeHead(200, {
            "Content-Type": "application/json",
            Connection: "close",
          });
          res.end(JSON.stringify(value));
        }
      } finally {
        active.delete(work);
      }
    })().catch(() => {
      if (!res.headersSent) {
        res.writeHead(400);
        res.end('{"state":"HELD"}');
      } else res.destroy();
    });
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    address: { host: "127.0.0.1", port: server.address().port },
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await Promise.allSettled([...active]);
      await store.close();
    },
  };
}
