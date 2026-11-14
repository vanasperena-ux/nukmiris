import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { hash } from "../src/protocol.mjs";
import { LIVE_CLOUD_EXECUTION } from "./runtime/transport.mjs";
import { syntheticInputs } from "./runtime/inputs.mjs";
import { operationalPlan } from "./ops/plan.mjs";
import { assertTeardownAuthority } from "./ops/teardown-permissions.mjs";
const cwd = new URL("../../", import.meta.url),
  base = "ac38ede7777e5493a458995b021a103e55a0059e",
  git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 16777216,
    }).trim();
execFileSync(process.execPath, ["platform-proof/b1a/check.mjs"], {
  cwd,
  stdio: "inherit",
});
const historical = git(
  "ls-tree",
  "-r",
  "--name-only",
  base,
  "platform-proof/evidence",
  "platform-proof/planning",
  "platform-proof/b1a/evidence",
).split("\n");
for (const path of historical) {
  const original = execFileSync("git", ["show", base + ":" + path], {
    cwd,
    maxBuffer: 16777216,
  });
  if (hash(original) !== hash(await readFile(new URL(path, cwd))))
    throw Error("historical_bytes_changed " + path);
}
if (LIVE_CLOUD_EXECUTION !== false) throw Error("cloud_guard_changed");
const manifest = JSON.parse(
    await readFile(new URL("./inventory.json", import.meta.url), "utf8"),
  ),
  plan = operationalPlan(syntheticInputs());
assertTeardownAuthority(manifest, plan.inputs, plan.grants);
const tf = JSON.parse(
  await readFile(new URL("./terraform/main.tf.json", import.meta.url), "utf8"),
);
if (
  tf.variable.provisioning_authorized.validation.condition !==
    "${var.provisioning_authorized == false}" ||
  tf.resource.google_sql_database_instance.epoch.settings.backup_configuration
    .transaction_log_retention_days !== 1 ||
  tf.resource.google_compute_network.custody ||
  tf.resource.google_compute_region_ssl_certificate ||
  Object.keys(tf.variable).some((k) => /tls.*key/.test(k))
)
  throw Error("infra_boundary_changed");
console.log(
  JSON.stringify({
    scope: "B1A2_LOCAL_SOURCE_ONLY",
    historicalFilesVerified: historical.length,
    acceptedApplication: "UNCHANGED",
    cloudExecution: false,
    resourceCount: manifest.candidateResourceCount,
    placementRemoved: manifest.placementRemovedCount,
    teardownAuthority: "STATIC_SCOPE_COVERAGE_PASS",
    actualCloudEvidence: "NOT_PROVEN",
  }),
);
