import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
import {
  fencePlan,
  teardownPlan,
  spendCapTemplate,
  inventory,
} from "../b1a/ops/controller.mjs";
import { startInert } from "../b1a/runtime/bootstrap.mjs";
const root = new URL("../", import.meta.url);

test("B1a controller prints exact seven steps, independent kill, no execute mode or cloud SDK", async () => {
  const plan = fencePlan();
  assert.equal(plan.steps.length, 7);
  assert.deepEqual(
    plan.steps.map((s) => s.step),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.match(JSON.stringify(plan.steps[0]), /--no-traffic/);
  assert.match(JSON.stringify(plan.steps[2]), /--clear-tags/);
  assert.match(JSON.stringify(plan.steps[3]), /--no-disabled/);
  assert.match(JSON.stringify(plan.steps[3]), /nmb1a-kill@/);
  assert.match(
    JSON.stringify(plan.steps[4]),
    /missing Monitoring series is NOT a zero/,
  );
  assert.match(JSON.stringify(plan.steps[6]), /epoch3/);
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        ["b1a/ops/controller.mjs", "fence", "--execute"],
        { cwd: root, stdio: "pipe" },
      ),
    /Command failed/,
  );
  const source = await readFile(
    new URL("../b1a/ops/controller.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /from ["'](?:node:)?(?:child_process|https?|net|tls)|\bfetch\(/,
  );
});

test("B1a inventory covers EVERY generated resource and teardown explicitly carries retained descendants", async () => {
  const tf = JSON.parse(
      await readFile(
        new URL("../b1a/terraform/main.tf.json", import.meta.url),
        "utf8",
      ),
    ),
    actual = Object.entries(tf.resource).flatMap(([t, rs]) =>
      Object.keys(rs).map((n) => t + "." + n),
    );
  assert.deepEqual(
    inventory.terraformResources.map((v) => v.type + "." + v.name).sort(),
    actual.sort(),
  );
  assert.equal(new Set(actual).size, actual.length);
  const end = JSON.stringify(teardownPlan());
  for (const term of [
    "SQL backups",
    "PITR",
    "KMS",
    "bucket versions",
    "+48h",
    "sealer-consumer",
    "nmb1a-sql-custody",
    "nmb1a-sealer-lb",
  ])
    assert.ok(end.includes(term));
  for (const p of Object.values(inventory.projects)) assert.ok(end.includes(p));
  assert.equal(tf.variable.provisioning_authorized.default, false);
  assert.equal(
    tf.variable.provisioning_authorized.validation.condition,
    "${var.provisioning_authorized == false}",
  );
  for (const [type, rs] of Object.entries(tf.resource))
    for (const body of Object.values(rs))
      if (type !== "terraform_data")
        assert.ok(body.depends_on.includes("terraform_data.never_apply"));
});

test("B1a network/IAM/SQL bounds, alerts and spend-cap template preserve fail-closed boundary", async () => {
  const tf = JSON.parse(
      await readFile(
        new URL("../b1a/terraform/main.tf.json", import.meta.url),
        "utf8",
      ),
    ),
    r = tf.resource;
  for (const e of [1, 2]) {
    assert.ok(r.google_compute_firewall["gateway_fake_" + e]);
    assert.equal(
      r.google_compute_firewall["epoch_deny_" + e + "_v4"].priority,
      100,
    );
  }
  assert.equal(r.google_compute_router_nat.gateway.log_config.filter, "ALL");
  assert.equal(
    r.google_cloud_run_v2_service.gateway.template.vpc_access.egress,
    "ALL_TRAFFIC",
  );
  assert.equal(
    r.google_cloud_run_v2_service.gateway.template.containers[0].resources
      .cpu_idle,
    false,
  );
  assert.equal(r.google_cloud_run_v2_service.sealer.default_uri_disabled, true);
  assert.ok(r.google_compute_service_attachment.sealer);
  assert.ok(r.google_compute_forwarding_rule.sql_custody);
  assert.ok(r.google_cloud_run_v2_service_iam_member.worker_gateway);
  assert.equal(
    r.google_sql_database_instance.epoch.settings.edition,
    "ENTERPRISE",
  );
  assert.equal(
    r.google_sql_database_instance.epoch.settings.tier,
    "db-f1-micro",
  );
  assert.equal(
    r.google_sql_database_instance.epoch.settings.ip_configuration.ipv4_enabled,
    false,
  );
  assert.ok(
    Object.values(inventory.sql.connectionBudget).reduce((a, b) => a + b, 0) <=
      15,
  );
  assert.equal(inventory.sql.measured, false);
  assert.deepEqual(
    r.google_billing_budget.session.threshold_rules.map(
      (x) => x.threshold_percent,
    ),
    [0.5, 0.75, 0.9, 1],
  );
  const cap = spendCapTemplate();
  assert.equal(cap.body.spendCap.inputState, "CONFIGURED");
  assert.equal(cap.body.budgetFilter.projects.length, 1);
  assert.equal(cap.body.budgetFilter.services[0], "services/152E-C115-5142");
  assert.equal(
    cap.body.budgetFilter.creditTypesTreatment,
    "EXCLUDE_ALL_CREDITS",
  );
  const secrets = r.google_secret_manager_secret_iam_member;
  for (const e of ["000001", "000002"])
    assert.equal(
      secrets["effect_e" + e].member,
      "serviceAccount:${google_service_account.gw_e" + e + ".email}",
    );
});

test("inert container profile health is alive, readiness/invocation false across restart", async () => {
  const request = (port) =>
    new Promise((resolve, reject) => {
      http
        .get({ host: "127.0.0.1", port, path: "/attempt" }, (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode));
        })
        .on("error", reject);
    });
  for (const role of ["gateway", "ingress", "sealer", "worker"]) {
    const app = await startInert({ role });
    try {
      assert.equal(await request(app.address.port), 503);
    } finally {
      await app.close();
    }
  }
});

test("elapsed-time supervisor plans teardown on deadline and never resurrects on monthly reset or regressed clock", async () => {
  const { sessionAction } = await import("../b1a/runtime/watchdog.mjs"),
    base = {
      startedAt: 1000,
      expiresAt: 21601000,
      lastObservedAt: 1000,
      billingState: "CONFIGURED",
    };
  assert.equal(
    sessionAction({ ...base, now: 21601000 }).action,
    "FENCE_EXPORT_TEARDOWN",
  );
  assert.equal(
    sessionAction({ ...base, now: 500 }).action,
    "HOLD_AND_INDEPENDENT_KILL",
  );
  assert.equal(sessionAction({ ...base, now: 2000 }).dispatchEnabled, false);
  assert.equal(
    sessionAction({ ...base, now: 2000, billingState: "ENFORCED" }).action,
    "HOLD_AND_INDEPENDENT_KILL",
  );
  assert.equal(
    sessionAction({ ...base, now: 2000, expiresAt: 25201000 }).action,
    "HOLD_AND_INDEPENDENT_KILL",
  );
});
