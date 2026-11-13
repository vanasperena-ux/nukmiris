import http from "node:http";
/** Inert container bootstrap. A future reviewed owner-approved mounted profile
 * and workload-identity adapter must be wired explicitly. No ADC, metadata
 * server, provider URLs, credentials or autoactivation on restart are read here.
 */
export async function startInert({ role, host = "127.0.0.1", port = 0 }) {
  if (
    !["gateway", "ingress", "sealer", "worker"].includes(role) ||
    !["127.0.0.1", "0.0.0.0"].includes(host) ||
    !Number.isInteger(port) ||
    port < 0 ||
    port > 65535
  )
    throw Error("inert_configuration");
  const server = http.createServer((req, res) => {
    const alive = req.method === "GET" && req.url === "/healthz";
    res.writeHead(alive ? 200 : 503, {
      "content-type": "application/json",
      connection: "close",
    });
    res.end(
      JSON.stringify({
        role,
        state: "INERT_UNCONFIGURED",
        dispatchEnabled: false,
        ready: false,
      }),
    );
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return {
    address: server.address(),
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    },
  };
}
if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  if (process.env.B1A_MODE !== "INERT_UNCONFIGURED")
    throw Error("future_mounted_bootstrap_requires_separate_review");
  const app = await startInert({
    role: process.env.B1A_ROLE,
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 8080),
  });
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await app.close();
  };
  process.once("SIGTERM", close);
  process.once("SIGINT", close);
}
