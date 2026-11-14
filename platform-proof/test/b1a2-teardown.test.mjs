import test from "node:test";
import assert from "node:assert/strict";
import {
  bindInventoryState,
  PreparedTerraformTeardown,
  FutureTerraformTransport,
} from "../b1a2/ops/terraform-teardown.mjs";
import { hash } from "../src/protocol.mjs";
test("P-3 exact teardown preserves independent cleanup authority, handles lost destroy ack, forbids replay and unknown/replaced state", async () => {
  const item = {
      address: "google_compute_instance.fake",
      type: "google_compute_instance",
      project: "synthetic-fake",
    },
    manifest = { inventory: [item] },
    snapshot = {
      lineage: "synthetic-lineage",
      serial: 1,
      resources: [
        {
          mode: "managed",
          type: item.type,
          name: "fake",
          instances: [
            {
              attributes: {
                id: "projects/synthetic-fake/zones/us-central1-a/instances/fake",
                project: item.project,
              },
            },
          ],
        },
      ],
    },
    boundState = bindInventoryState({
      snapshot,
      manifest,
      approvedStateDigest: hash(snapshot),
      cleanupAuthority: {
        principal: "synthetic:independent-cleanup-human",
        managedByExperiment: false,
      },
    });
  let current = structuredClone(snapshot),
    calls = 0;
  const transport = {
      mode: "LOCAL_SIMULATION",
      cleanupPrincipal: boundState.cleanupPrincipal,
      async state() {
        return structuredClone(current);
      },
      async destroyExact() {
        calls++;
        current.resources = [];
        current.serial++;
        throw Error("crash_after_delete");
      },
      async absence(v) {
        return { id: v.id, state: "ABSENT" };
      },
    },
    journal = { async append() {} };
  const t = new PreparedTerraformTeardown({ boundState, transport, journal });
  assert.equal((await t.removeExact(item)).state, "HOLD");
  assert.equal((await t.resolve(item)).state, "ABSENT");
  assert.equal((await t.removeExact(item)).state, "ABSENT");
  assert.equal(calls, 1);
  current.resources = [{ ...snapshot.resources[0], name: "unexpected" }];
  await assert.rejects(t.removeExact(item), /unexpected/);
  assert.throws(
    () => new FutureTerraformTransport({ directory: "/tmp", environment: {} }),
    /activation/,
  );
  assert.throws(() =>
    bindInventoryState({
      snapshot,
      manifest,
      approvedStateDigest: "forged",
      cleanupAuthority: {},
    }),
  );
});
import { ExactResourceProbe } from "../b1a2/ops/absence-probe.mjs";
import { protocolFixture } from "./b1a2-protocol-fixture.mjs";
import { syntheticInputs, validateInputs } from "../b1a2/runtime/inputs.mjs";
test("P-3 independent NAT/permission/key-version absence is not fabricated from a nonexistent NAT subresource or missing state", async (t) => {
  const c = validateInputs(syntheticInputs(), {
    now: Date.parse("2026-11-14T12:00Z"),
  });
  let nat = true,
    permission = 403,
    enabled = true;
  const f = await protocolFixture(c, {
    respond: ({ u, service, reply }) => {
      if (service === "compute")
        return reply(200, { nats: nat ? [{ name: "synthetic-nat" }] : [] });
      if (service === "secretmanager") return reply(permission, {});
      if (service === "cloudkms")
        return reply(200, {
          cryptoKeyVersions: [
            { state: enabled ? "ENABLED" : "DESTROY_SCHEDULED" },
          ],
        });
      return reply(404, {});
    },
  });
  t.after(() => f.close());
  const p = new ExactResourceProbe({ transport: f.transport, inputs: c }),
    v = {
      type: "google_compute_router_nat",
      id:
        "projects/" +
        c.projects.runtime.id +
        "/regions/us-central1/routers/r/nat/synthetic-nat",
      project: c.projects.runtime.id,
      attributes: { region: "us-central1", router: "r", name: "synthetic-nat" },
    };
  assert.equal((await p.read(v)).state, "PRESENT_OR_INCOMPLETE");
  nat = false;
  assert.equal((await p.read(v)).state, "ABSENT");
  assert.ok(f.calls.every((v) => !v.url.includes("/nat/")));
  const secret = {
    type: "google_secret_manager_secret",
    id: "projects/" + c.projects.runtime.id + "/secrets/synthetic",
    project: c.projects.runtime.id,
  };
  assert.equal((await p.read(secret)).state, "UNKNOWN");
  permission = 404;
  assert.equal((await p.read(secret)).state, "ABSENT");
  const key = {
    type: "google_kms_crypto_key",
    id:
      "projects/" +
      c.projects.custody.id +
      "/locations/us-central1/keyRings/r/cryptoKeys/k",
    project: c.projects.custody.id,
  };
  assert.equal((await p.keyVersions(key)).state, "HOLD");
  enabled = false;
  assert.equal((await p.keyVersions(key)).state, "VERSIONS_RETIRED");
  await assert.rejects(
    p.read({ ...v, id: "projects/foreign/regions/x" }),
    /foreign/,
  );
});
