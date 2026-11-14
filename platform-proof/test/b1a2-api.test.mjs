import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  localApiTransport,
  futureCloudTransport,
  receiptData,
} from "../b1a2/runtime/transport.mjs";
import { CloudApi, decodeCounts } from "../b1a2/runtime/cloud-api.mjs";
import { syntheticInputs, validateInputs } from "../b1a2/runtime/inputs.mjs";
async function fixture(t) {
  const now = Date.parse("2026-11-14T12:00:00Z"),
    c = validateInputs(syntheticInputs(now), { now }),
    requests = [];
  let states = ["active", "idle"];
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, service: req.headers["x-b1a2-api-service"] });
    res.setHeader("content-type", "application/json");
    if (req.url.includes("/timeSeries"))
      res.end(
        JSON.stringify({
          timeSeries: states.map((state) => ({
            metric: {
              type: "run.googleapis.com/container/instance_count",
              labels: { state },
            },
            resource: {
              labels: {
                service_name: c.names.gateway,
                revision_name: c.epochs.oldRevision,
              },
            },
            points: [
              {
                interval: { endTime: new Date(now - 60000).toISOString() },
                value: { int64Value: "0" },
              },
            ],
          })),
        }),
      );
    else if (req.url.includes("/identity?")) {
      res.setHeader("Metadata-Flavor", "Google");
      res.end("synthetic.jwt.value");
    } else res.end(JSON.stringify({ name: "fixture", enabled: true }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  return {
    c,
    requests,
    api: new CloudApi({
      inputs: c,
      transport: localApiTransport({
        endpoint: "http://127.0.0.1:" + server.address().port,
        now: () => now,
      }),
    }),
    now,
    setStates(v) {
      states = v;
    },
  };
}
test("P-2 Google protocol adapters use only localhost fixtures; typed metric states are complete and immutable", async (t) => {
  const f = await fixture(t),
    r = await f.api.instanceCounts({
      revision: f.c.epochs.oldRevision,
      start: f.now - 120000,
      end: f.now,
    });
  const rows = decodeCounts(r, {
    service: f.c.names.gateway,
    revision: f.c.epochs.oldRevision,
  });
  assert.equal(rows[0].states.active + rows[0].states.idle, 0);
  assert.ok(receiptData(r));
  assert.equal(receiptData({ ...r }), undefined);
  assert.throws(() => {
    r.value.timeSeries[0].points[0].value.int64Value = "9";
  }, TypeError);
  f.setStates(["active"]);
  await assert.rejects(
    async () =>
      decodeCounts(
        await f.api.instanceCounts({
          revision: f.c.epochs.oldRevision,
          start: f.now - 120000,
          end: f.now,
        }),
        { service: f.c.names.gateway, revision: f.c.epochs.oldRevision },
      ),
    /missing_instance/,
  );
  assert.equal(
    (await f.api.metadataIdentity("https://example.run.app")).value,
    "synthetic.jwt.value",
  );
  assert.ok(
    f.requests.every(
      (r) => r.service === "metadata" || r.service === "monitoring",
    ),
  );
});
test("P-2 live cloud/credential access cannot be enabled by environment or flags", () => {
  process.env.B1A2_EXECUTE = "true";
  assert.throws(() => futureCloudTransport(), /reviewed_activation/);
  delete process.env.B1A2_EXECUTE;
  assert.throws(
    () => localApiTransport({ endpoint: "https://run.googleapis.com" }),
    /literal_local/,
  );
});
