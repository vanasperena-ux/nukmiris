import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syntheticInputs } from "../b1a2/runtime/inputs.mjs";
import { operationalPlan } from "../b1a2/ops/plan.mjs";
import {
  LocalOperationController,
  LocalCloudModel,
} from "../b1a2/ops/controller.mjs";
import {
  independentAuthorityPlan,
  cleanupReceiptChecklist,
} from "../readiness/operations.mjs";
import {
  bindInventoryState,
  PreparedTerraformTeardown,
} from "../b1a2/ops/terraform-teardown.mjs";
import { providerJournal } from "../b1a2/runtime/journal.mjs";
import { hash } from "../src/protocol.mjs";
test("G-3 sole human may independently construct kill/cleanup controllers with NO deployer grants/credential and seven shutdown steps remain exact", async () => {
  const raw = syntheticInputs();
  for (const k of Object.keys(raw.operators))
    raw.operators[k] = "synthetic:sole-operator";
  raw.budget.allocationUsd = "30.00";
  raw.optionalRestoreDrill = false;
  const plan = operationalPlan(raw);
  assert.deepEqual(plan.fenceSteps, [1, 2, 3, 4, 5, 6, 7]);
  for (const kind of ["KILL", "CLEANUP"]) {
    const p = independentAuthorityPlan(plan, kind);
    assert.equal(p.isolation.deploymentCredentialRequired, false);
    assert.equal(p.isolation.independentHumans, false);
    assert.ok(
      !p.grants.some(
        (g) => g.principal === plan.inputs.serviceIdentities.deployer,
      ),
    );
    const model = new LocalCloudModel({ plan: p });
    const ctl = new LocalOperationController({
      plan: p,
      adapter: model,
      journal: { async append() {} },
    });
    if (kind === "KILL") {
      assert.ok(p.emergency.some((v) => v.id === "deny-v4"));
      assert.ok(p.emergency.some((v) => v.id === "revision-delete"));
      assert.equal(
        (await ctl.execute("emergency-service-delete")).state,
        "CONFIRMED",
      );
    }
  }
  const kill = independentAuthorityPlan(plan, "KILL");
  assert.throws(
    () =>
      new LocalOperationController({
        plan: kill,
        adapter: new LocalCloudModel({ plan: kill }),
        journal: { async append() {} },
        grants: [],
      }),
    /permission/,
  );
});
test("G-3 every exact inventory resource has a receipt slot, manual billing and nondeletable KMS residuals remain explicit", async () => {
  const manifest = JSON.parse(
      await readFile(
        new URL("../b1a2/inventory.json", import.meta.url),
        "utf8",
      ),
    ),
    rows = cleanupReceiptChecklist(manifest);
  assert.equal(rows.length, 140);
  assert.equal(new Set(rows.map((r) => r.address)).size, 140);
  assert.ok(
    rows.every(
      (r) =>
        r.status === "NOT_EXECUTED" &&
        r.originalResourceId === null &&
        r.independentReadReceipt === null &&
        r.requiredAuthority,
    ),
  );
  assert.ok(rows.some((r) => r.manualBillingAccountAction));
  assert.ok(rows.some((r) => r.retention.startsWith("NON_DELETABLE")));
});
async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), "nukmiris-readiness-cleanup-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const item = {
      address: "google_compute_instance.fake",
      type: "google_compute_instance",
      project: "synthetic-fake",
    },
    snapshot = {
      lineage: "synthetic-cleanup",
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
      manifest: { inventory: [item] },
      approvedStateDigest: hash(snapshot),
      cleanupAuthority: {
        principal: "synthetic:cleanup",
        managedByExperiment: false,
      },
    }),
    path = join(dir, "cleanup.jsonl");
  let current = structuredClone(snapshot),
    calls = 0,
    absence = "UNKNOWN";
  const transport = {
    mode: "LOCAL_SIMULATION",
    cleanupPrincipal: boundState.cleanupPrincipal,
    async state() {
      return structuredClone(current);
    },
    async destroyExact() {
      calls++;
      throw Error("lost_ack");
    },
    async absence(v) {
      return { id: v.id, state: absence };
    },
  };
  return {
    item,
    snapshot,
    boundState,
    path,
    transport,
    get calls() {
      return calls;
    },
    set absent(v) {
      absence = v;
    },
    dropState() {
      current.resources = [];
      current.serial++;
    },
  };
}
test("G-3 cleanup restart replays authenticated intent; no repeated destructive call; missing Terraform state is NOT independent absence", async (t) => {
  const f = await setup(t),
    journal = await providerJournal(f.path),
    a = new PreparedTerraformTeardown({
      boundState: f.boundState,
      transport: f.transport,
      journal,
    });
  assert.equal((await a.removeExact(f.item)).state, "HOLD");
  const checkpoint = (await journal.snapshot()).checkpoint;
  await journal.close();
  const restored = await providerJournal(f.path, { checkpoint });
  t.after(() => restored.close());
  const b = new PreparedTerraformTeardown({
    boundState: f.boundState,
    transport: f.transport,
    journal: restored,
  });
  assert.equal(
    (await b.removeExact(f.item)).reason,
    "ambiguous_prior_destroy; readback only",
  );
  assert.equal(f.calls, 1);
  f.dropState();
  assert.equal((await b.removeExact(f.item)).state, "HOLD");
  f.absent = "ABSENT";
  assert.equal((await b.resolve(f.item)).state, "ABSENT");
  assert.equal(f.calls, 1);
});
test("G-3 cleanup corrupt ledger and changed original identity fail closed before destructive calls", async (t) => {
  const f = await setup(t);
  const a = new PreparedTerraformTeardown({
    boundState: f.boundState,
    transport: f.transport,
    journal: {
      async snapshot() {
        return {
          records: [
            {
              event: "EXACT_TERRAFORM_DESTROY_INTENT",
              address: f.item.address,
              originalResourceId: "wrong",
            },
          ],
          checkpoint: { sequence: 1, hash: "bad" },
        };
      },
    },
  });
  await assert.rejects(a.removeExact(f.item));
  assert.equal(f.calls, 0);
});
