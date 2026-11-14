import test from "node:test";
import assert from "node:assert/strict";
import { PlatformPreflight } from "../b1a2/runtime/preflight.mjs";
import { protocolFixture } from "./b1a2-protocol-fixture.mjs";
import { syntheticInputs, validateInputs } from "../b1a2/runtime/inputs.mjs";
test("P-2/P-7 exact service/API/quota protocol preflight holds on unknown, missing or mismatched evidence", async (t) => {
  const c = validateInputs(syntheticInputs(), {
    now: Date.parse("2026-11-14T12:00Z"),
  });
  let available = true,
    identity = true;
  const f = await protocolFixture(c, {
    respond: ({ service, u, reply }) => {
      if (
        service === "serviceusage" &&
        u.pathname.endsWith("/consumerQuotaMetrics")
      )
        return reply(200, {
          metrics: available
            ? [
                {
                  metric: "synthetic-instance-quota",
                  consumerQuotaLimits: [
                    {
                      name: "synthetic-regional-limit",
                      quotaBuckets: [
                        {
                          dimensions: { region: c.region },
                          effectiveLimit: "2",
                        },
                      ],
                    },
                  ],
                },
              ]
            : [],
        });
      if (service === "serviceusage") return reply(200, { state: "ENABLED" });
      if (service === "run")
        return reply(200, {
          name:
            "projects/" +
            c.projects.runtime.id +
            "/locations/" +
            c.region +
            "/services/" +
            c.names.gateway,
          template: {
            serviceAccount: identity ? c.serviceIdentities.gatewayOld : "wrong",
            containers: [{ image: c.images.runtime }],
            vpcAccess: { egress: "ALL_TRAFFIC" },
          },
          ingress: "INGRESS_TRAFFIC_INTERNAL_ONLY",
        });
      reply(404, {});
    },
  });
  t.after(() => f.close());
  const p = new PlatformPreflight({
      inputs: c,
      api: f.api,
      journal: { async append() {} },
    }),
    requirements = {
      quotaRequirements: [
        {
          project: c.projects.runtime.id,
          metric: "synthetic-instance-quota",
          limit: "synthetic-regional-limit",
          minimum: 2,
        },
      ],
      expectedService: {
        identity: c.serviceIdentities.gatewayOld,
        image: c.images.runtime,
      },
    };
  assert.equal((await p.run({})).state, "HOLD");
  assert.equal((await p.run(requirements)).state, "PREFLIGHT_READY");
  available = false;
  assert.equal((await p.run(requirements)).state, "HOLD");
  available = true;
  identity = false;
  assert.equal((await p.run(requirements)).state, "HOLD");
});
