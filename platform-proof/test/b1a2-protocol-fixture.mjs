import http from "node:http";
import { localApiTransport } from "../b1a2/runtime/transport.mjs";
import { CloudApi } from "../b1a2/runtime/cloud-api.mjs";
export async function protocolFixture(
  inputs,
  { now = Date.now, respond } = {},
) {
  const objects = new Map(),
    calls = [];
  let gen = 0,
    ambiguous = false;
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const b of req) body += b;
    const u = new URL(req.url, "http://127.0.0.1"),
      service = req.headers["x-b1a2-api-service"];
    calls.push({ method: req.method, url: req.url, service });
    const reply = (status, value) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "Metadata-Flavor": "Google",
      });
      res.end(JSON.stringify(value));
    };
    if (service === "storage") {
      if (req.method === "POST") {
        const name = u.searchParams.get("name");
        if (objects.has(name)) return reply(412, { error: "exists" });
        objects.set(name, {
          name,
          generation: String(++gen),
          value: JSON.parse(body),
        });
        if (ambiguous) {
          ambiguous = false;
          req.socket.destroy();
          return;
        }
        return reply(200, { generation: String(gen) });
      }
      const match = u.pathname.match(/\/o\/(.+)$/);
      if (match) {
        const name = decodeURIComponent(match[1]),
          v = objects.get(name);
        return reply(v ? 200 : 404, v?.value ?? { error: "absent" });
      }
      return reply(200, {
        items: [...objects.values()]
          .filter((v) => v.name.startsWith(u.searchParams.get("prefix")))
          .map(({ name, generation }) => ({ name, generation })),
      });
    }
    if (respond) return respond({ req, res, u, service, body, reply });
    reply(404, { error: "fixture_unhandled" });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const transport = localApiTransport({
    endpoint: "http://127.0.0.1:" + server.address().port,
    now,
  });
  return {
    api: new CloudApi({ inputs, transport }),
    transport,
    objects,
    calls,
    interruptNextWrite() {
      ambiguous = true;
    },
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    },
  };
}
