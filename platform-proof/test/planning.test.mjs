import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
test("plan pins: Enterprise/shared-core, region, limits, identity/epoch, no retained/final backups", async () => {
  const inv = JSON.parse(await read("planning/inventory.json")),
    tf = JSON.parse(await read("planning/terraform/main.tf.json")),
    r = tf.resource,
    db = r.google_sql_database_instance.epoch;
  assert.equal(db.settings.edition, "ENTERPRISE");
  assert.equal(db.settings.tier, "db-f1-micro");
  assert.equal(db.region, "${local.region}");
  assert.equal(tf.locals.region, "us-central1");
  assert.equal(db.deletion_protection, false);
  assert.equal(db.settings.retain_backups_on_delete, false);
  assert.equal(db.settings.final_backup_config.enabled, false);
  assert.equal(db.settings.ip_configuration.ipv4_enabled, false);
  assert.equal(db.settings.disk_autoresize, false);
  for (const s of Object.values(r.google_cloud_run_v2_service)) {
    assert.equal(s.scaling.max_instance_count, 1);
    assert.equal(s.template.scaling.max_instance_count, 1);
    assert.equal(s.labels, "${local.labels}");
    assert.match(s.template.service_account, /google_service_account/);
  }
  assert.equal(
    r.google_cloud_run_v2_worker_pool.worker.scaling.manual_instance_count,
    1,
  );
  assert.equal(inv.sessionHoursMax, 6);
  assert.equal(inv.labels.expires, "2026-12-17");
  assert.ok(
    Object.values(inv.database.connectionBudget).reduce((a, b) => a + b, 0) <=
      15,
  );
  assert.equal(inv.database.measured, false);
  assert.equal(inv.budget.hardCap, false);
  assert.deepEqual(inv.budget.alertsUsd, [10, 25, 40]);
  assert.equal(inv.network.natGatewaySubnetOnly, true);
  assert.equal(
    inv.custody.chainAndIndexExtensionVerifierRequiredBeforeB1b,
    true,
  );
});
test("plan-only guard: all resources depend on impossible apply gate; no live token or auto-apply workflow", async () => {
  const tf = JSON.parse(await read("planning/terraform/main.tf.json"));
  assert.equal(tf.variable.provisioning_authorized.default, false);
  assert.equal(
    tf.variable.provisioning_authorized.validation.condition,
    "${var.provisioning_authorized == false}",
  );
  assert.equal(
    tf.resource.terraform_data.never_apply.lifecycle.precondition[0].condition,
    "${var.provisioning_authorized}",
  );
  for (const [kind, rs] of Object.entries(tf.resource))
    if (kind !== "terraform_data")
      for (const r of Object.values(rs))
        assert.ok(r.depends_on.includes("terraform_data.never_apply"));
  assert.match(
    await read("planning/terraform/versions.tf"),
    /PLAN_ONLY_NOT_A_CREDENTIAL/,
  );
});
test("operational tools are print-only and reject execution; exactly seven fence steps", () => {
  const cli = new URL("../ops/dry-run.mjs", import.meta.url);
  for (const kind of ["fence", "teardown"]) {
    const v = JSON.parse(
      execFileSync(process.execPath, [cli.pathname, kind], {
        encoding: "utf8",
      }),
    );
    assert.equal(v.mode, "PRINT_ONLY_NO_CLOUD_EXECUTION");
    assert.equal(v.steps.length, kind === "fence" ? 7 : 9);
  }
  assert.throws(() =>
    execFileSync(process.execPath, [cli.pathname, "fence", "--execute"], {
      stdio: "ignore",
    }),
  );
  const sql = execFileSync(process.execPath, [cli.pathname, "probe"], {
    encoding: "utf8",
  });
  assert.match(sql, /BEGIN READ ONLY/);
  assert.match(sql, /inc1_disposable_/);
  assert.doesNotMatch(sql, /DISABLE ROW LEVEL SECURITY|BYPASSRLS;|ALTER ROLE/i);
});
test("additive offline calculator reproduces prior evidence and six-hour/max-one/G1 scenarios", async () => {
  const script = new URL("../planning/calculate-costs.py", import.meta.url),
    x = JSON.parse(
      execFileSync("python3", [script.pathname], { encoding: "utf8" }),
    ),
    saved = JSON.parse(await read("planning/cost-results.json"));
  assert.deepEqual(x, saved);
  assert.equal(x.prior72hUnchanged.subtotal, "32.83");
  assert.equal(x.newScenarios.sixHourMaxOneHighLoad.hours, 6);
  assert.ok(Number(x.newScenarios.sixHourMaxOneHighLoad.with25Percent) < 20);
  assert.ok(
    Number(x.newScenarios.sixHourG1Small.grossUsd) >
      Number(x.newScenarios.sixHourMaxOneHighLoad.grossUsd),
  );
});
