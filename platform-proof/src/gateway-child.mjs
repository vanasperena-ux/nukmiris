import { startGateway } from "./gateway.mjs";
const send = (v) => process.send?.(v);
const config = await new Promise((r) => process.once("message", r));
const hooks = new Map(),
  releases = new Map();
const gateway = await startGateway(config, {
  hook: async (point, attemptId) => {
    if (hooks.get(attemptId) !== point) return;
    hooks.delete(attemptId);
    await new Promise((resolve) => {
      releases.set(attemptId, resolve);
      send({ type: "hook", point, attemptId, at: Date.now() });
    });
  },
  trace: (event) => send({ type: "trace", ...event }),
});
send({ type: "ready", address: gateway.address });
process.on("message", (m) => {
  if (m.type === "armHook") {
    hooks.set(m.attemptId, m.point);
    send({ type: "ack", request: m.request });
  }
  if (m.type === "release") {
    releases.get(m.attemptId)?.();
    releases.delete(m.attemptId);
  }
  if (m.type === "close") {
    void gateway.close().then(() => process.disconnect());
  }
});
