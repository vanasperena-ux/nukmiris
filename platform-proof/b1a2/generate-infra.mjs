import { readFile, writeFile, mkdir } from "node:fs/promises";
import { permissionCatalog } from "./ops/plan.mjs";
import {
  syntheticInputs,
  validateInputs,
  ownerTemplate,
} from "./runtime/inputs.mjs";
const dir = new URL("./", import.meta.url),
  old = JSON.parse(
    await readFile(new URL("../b1a/terraform/main.tf.json", dir), "utf8"),
  );
const artifact = JSON.parse(
  await readFile(new URL("./build/artifact.json", import.meta.url), "utf8"),
);
const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === "--owner-inputs"))
  throw Error("offline_generator_owner_inputs_only");
const now = args.length ? Date.now() : Date.parse("2026-11-14T12:00Z");
const supplied = args.length
  ? JSON.parse(await readFile(args[1], "utf8"))
  : syntheticInputs(now);
const candidateImage =
  "us-central1-docker.pkg.dev/" +
  supplied.projects.runtime.id +
  "/b1a2/harness@" +
  artifact.ociManifestDigest;
if (!args.length)
  supplied.images = {
    runtime: candidateImage,
    fake: candidateImage,
    approvalRef: "SYNTHETIC_ONLY_NOT_PUSHED",
  };
const c = validateInputs(supplied, {
  now,
  purpose: args.length ? "PROVISIONING_PLAN" : "LOCAL_SIMULATION",
});
if (c.epochs.old !== 1 || c.epochs.next !== 2)
  throw Error("disposable_initial_epoch_pair_required");
// Preserve historical generator/config byte-for-byte. This is a new compiler.
let s = JSON.stringify(old)
  .replaceAll("nmb1a-plan-run", "@@RUN@@")
  .replaceAll("nmb1a-plan-custody", "@@CUSTODY@@")
  .replaceAll("nmb1a-plan-fake", "@@FAKE@@")
  .replaceAll("nmb1a", "b1a2")
  .replaceAll("@@RUN@@", c.projects.runtime.id)
  .replaceAll("@@CUSTODY@@", c.projects.custody.id)
  .replaceAll("@@FAKE@@", c.projects.fake.id)
  .replaceAll("10.81.", "10.91.")
  .replaceAll("10.82.", "10.92.");
s = s
  .replaceAll("b1a2-e000001", c.epochs.oldTag)
  .replaceAll("b1a2-e000002", c.epochs.nextTag);
const x = JSON.parse(s),
  r = x.resource,
  removed = [];
const drop = (t, n) => {
  if (r[t]?.[n]) {
    removed.push(t + "." + n);
    delete r[t][n];
    if (!Object.keys(r[t]).length) delete r[t];
  }
};
for (const [t, rs] of Object.entries(r))
  for (const [n, v] of Object.entries(rs)) {
    if (
      (t === "google_compute_network" && n === "custody") ||
      (t === "google_compute_subnetwork" &&
        ["custody", "proxy", "psc_nat"].includes(n)) ||
      (t === "google_compute_address" &&
        ["sql_custody", "sealer_consumer", "sealer_lb"].includes(n)) ||
      (t === "google_compute_forwarding_rule" &&
        ["sql_custody", "sealer_consumer", "sealer_lb"].includes(n)) ||
      (t === "google_compute_firewall" &&
        [
          "deny_custody_v4",
          "deny_custody_v6",
          "sql_custody",
          "restricted_custody",
          "sealer_call",
          "sealer_proxy",
        ].includes(n)) ||
      (t === "google_compute_route" && n === "restricted_custody") ||
      (t.startsWith("google_dns_") &&
        (n.endsWith("_custody") || n === "sealer")) ||
      [
        "google_compute_region_network_endpoint_group",
        "google_compute_region_backend_service",
        "google_compute_region_url_map",
        "google_compute_region_ssl_certificate",
        "google_compute_region_target_https_proxy",
        "google_compute_service_attachment",
      ].includes(t)
    )
      drop(t, n);
  }
// Bind the approved major names/ranges; remaining exact names are inventory outputs.
r.google_compute_network.run.name = c.names.network;
r.google_compute_subnetwork.gateway.ip_cidr_range = c.network.gateway;
r.google_compute_subnetwork.private.ip_cidr_range = c.network.private;
r.google_compute_subnetwork.fake.ip_cidr_range = c.network.fake;
const privateBase = c.network.private.split("/")[0].split(".");
privateBase[3] = String(Number(privateBase[3]) + 12);
const sqlIp = privateBase.join(".");
r.google_compute_address.sql_run.address = sqlIp;
r.google_compute_firewall.sql_run.destination_ranges = [sqlIp + "/32"];
r.google_sql_database_instance.epoch.name = c.names.database;
for (const role of ["gateway", "ingress", "sealer"])
  r.google_cloud_run_v2_service[role].name = c.names[role];
r.google_cloud_run_v2_service.gateway.template.revision =
  c.names.gateway + "-inert-bootstrap";
r.google_cloud_run_v2_worker_pool.worker.name = c.names.worker;
r.google_compute_instance.fake.name = c.names.fake;
const placementRemoved = [...removed];
const gate = ["terraform_data.never_apply"];
const add = (t, n, v, project = c.projects.runtime.id) => {
  r[t] ??= {};
  r[t][n] = {
    ...v,
    depends_on: [...new Set([...(v.depends_on ?? []), ...gate])],
    ...(project ? { project } : {}),
  };
};
for (const key of [
  "synthetic_sealer_tls_key",
  "synthetic_sealer_tls_certificate",
  "billing_currency",
])
  delete x.variable[key];
x.variable.runtime_project_number.default = c.projects.runtime.number;
x.variable.session_started_at.default = c.session.startedAt;
x.variable.billing_account.default = c.budget.billingAccountId;
x.variable.organization_mode.default = c.organizationMode;
x.variable.standalone_risk_reviewed.default = Boolean(c.standaloneRiskReview);
x.variable.candidate_image.default = c.images.runtime;
x.variable.fake_host_image = {
  type: "string",
  default: "UNAPPROVED_IMMUTABLE_HOST_IMAGE_REQUIRED",
};
x.variable.owner_inputs_approved = {
  type: "bool",
  default: false,
  validation: {
    condition: "${var.owner_inputs_approved == false}",
    error_message:
      "B1a-2 source-only: changing flags cannot authorize execution.",
  },
};
x.resource.terraform_data.never_apply.lifecycle.precondition.push({
  condition: "${var.owner_inputs_approved}",
  error_message:
    "Exact inputs, hashes, images, FX, named operators and window require separate owner approval.",
});
x.locals.b1a2_input_digest = c.inputDigest;
x.locals.b1a2_fixture_only = c.mode === "SYNTHETIC_FIXTURE";
r.google_sql_database_instance.epoch.settings.ip_configuration.psc_config.allowed_consumer_projects =
  [c.projects.runtime.id];
const sealer = r.google_cloud_run_v2_service.sealer;
sealer.project = c.projects.runtime.id;
delete sealer.default_uri_disabled;
delete sealer.custom_audiences;
sealer.template.vpc_access.network_interfaces = [
  {
    network: "${google_compute_network.run.name}",
    subnetwork: "${google_compute_subnetwork.private.name}",
    tags: ["b1a2-sealer"],
  },
];
r.google_service_account.sealer.project = c.projects.runtime.id;
r.google_secret_manager_secret.sealer_db.project = c.projects.runtime.id;
r.google_secret_manager_secret_iam_member.sealer_db.project =
  c.projects.runtime.id;
r.google_cloud_run_v2_service_iam_member.ingress_sealer.project =
  c.projects.runtime.id;
for (const name of ["sql_run", "restricted_run"])
  r.google_compute_firewall[name].target_tags.push("b1a2-sealer");
const saNames = {
  gatewayOld: "gw_e000001",
  gatewayNext: "gw_e000002",
  ingress: "ingress",
  worker: "worker",
  sealer: "sealer",
  controller: "controller",
  kill: "kill",
  cleanup: "cleanup",
  custodyCleanup: "custody_cleanup",
  observer: "observer",
  deployer: "deployer",
  fake: "fake",
};
for (const [role, email] of Object.entries(c.serviceIdentities)) {
  const n = saNames[role],
    project = email.split("@")[1].split(".iam.")[0];
  add(
    "google_service_account",
    n,
    { account_id: email.split("@")[0], display_name: "B1a2 " + role },
    project,
  );
}
for (const [key, secret] of Object.entries(r.google_secret_manager_secret)) {
  if (key === "effect_e000001") secret.secret_id = "b1a2-effect-old";
  if (key === "effect_e000002") secret.secret_id = "b1a2-effect-next";
}
// No secret payloads or TLS private-key resources are managed in state.
for (const role of ["gateway", "worker", "ingress", "sealer"]) {
  const service =
      role === "worker"
        ? r.google_cloud_run_v2_worker_pool.worker
        : r.google_cloud_run_v2_service[role],
    t = service.template;
  const paths = [
    "manifest.json",
    "profile.json",
    "database.json",
    "callerKey.txt",
    ...(role === "gateway" ? ["tls.json"] : []),
  ];
  const secret = role === "gateway" ? "effect_e000001" : "bundle_" + role;
  if (role !== "gateway") {
    add("google_secret_manager_secret", secret, {
      secret_id: "b1a2-" + role + "-bundle",
      replication: { auto: {} },
      labels: "${local.labels}",
    });
    add("google_secret_manager_secret_iam_member", secret, {
      secret_id: "${google_secret_manager_secret." + secret + ".id}",
      role: "roles/secretmanager.secretAccessor",
      member: "serviceAccount:" + c.serviceIdentities[role],
    });
  }
  t.volumes = [
    {
      name: "synthetic-bundle",
      secret: {
        secret: "${google_secret_manager_secret." + secret + ".secret_id}",
        items: paths.map((path, i) => ({ version: String(i + 1), path })),
      },
    },
  ];
  if (t.containers[0].readiness_probe)
    t.containers[0].readiness_probe.http_get.path = "/healthz";
  t.containers[0].env = [
    { name: "B1A2_ROLE", value: role },
    { name: "B1A2_MODE", value: "INERT_UNCONFIGURED" },
  ];
  t.containers[0].volume_mounts = [
    { name: "synthetic-bundle", mount_path: "/secrets" },
  ];
}
// Keep sealer custody independent. Reads are required for crash repair of exact
// immutable slots; narrow prefix condition, no runtime delete permission.
add(
  "google_storage_bucket_iam_member",
  "sealer_recovery",
  {
    bucket: "${google_storage_bucket.custody.name}",
    role: "roles/storage.objectViewer",
    member: "serviceAccount:" + c.serviceIdentities.sealer,
    condition: {
      title: "B1a2RecordsOnly",
      expression:
        'resource.name.startsWith("projects/_/buckets/' +
        c.names.bucket +
        '/objects/sessions/")',
    },
  },
  null,
);
r.google_storage_bucket.custody.name = c.names.bucket;
r.google_artifact_registry_repository.harness.repository_id = "b1a2";
const fake = r.google_compute_instance.fake;
fake.boot_disk.initialize_params.image = "${var.fake_host_image}";
fake.service_account = {
  email: "${google_service_account.fake.email}",
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
};
fake.metadata = {
  "block-project-ssh-keys": "true",
  "enable-oslogin": "TRUE",
  "b1a2-lifetime-seconds": "21600",
  "b1a2-container-image": c.images.fake,
  "b1a2-activation": "REVIEWED_SOURCE_CHANGE_REQUIRED",
  "b1a2-owner-inputs": "UNAPPROVED",
};
add(
  "google_compute_firewall",
  "fake_iap",
  {
    name: "b1a2-fake-iap-443",
    network: "${google_compute_network.fake.id}",
    direction: "INGRESS",
    source_ranges: ["35.235.240.0/20"],
    target_tags: ["b1a2-fake"],
    allow: [{ protocol: "tcp", ports: ["443"] }],
  },
  c.projects.fake.id,
);
add(
  "google_compute_firewall",
  "restricted_fake",
  {
    name: "b1a2-restricted-fake",
    network: "${google_compute_network.fake.id}",
    direction: "EGRESS",
    priority: 1000,
    target_tags: ["b1a2-fake"],
    destination_ranges: ["199.36.153.4/30"],
    allow: [{ protocol: "tcp", ports: ["443"] }],
  },
  c.projects.fake.id,
);
add(
  "google_compute_route",
  "restricted_fake",
  {
    name: "b1a2-restricted-fake",
    network: "${google_compute_network.fake.id}",
    dest_range: "199.36.153.4/30",
    next_hop_gateway: "default-internet-gateway",
    priority: 900,
  },
  c.projects.fake.id,
);
add(
  "google_dns_managed_zone",
  "apis_fake",
  {
    name: "b1a2-apis-fake",
    dns_name: "googleapis.com.",
    visibility: "private",
    private_visibility_config: {
      networks: [{ network_url: "${google_compute_network.fake.id}" }],
    },
  },
  c.projects.fake.id,
);
add(
  "google_dns_record_set",
  "apis_fake",
  {
    name: "*.googleapis.com.",
    type: "A",
    ttl: 30,
    managed_zone: "${google_dns_managed_zone.apis_fake.name}",
    rrdatas: ["199.36.153.4", "199.36.153.5", "199.36.153.6", "199.36.153.7"],
  },
  c.projects.fake.id,
);
// Replace obsolete broad principal grants with the command scope catalog.
for (const typ of [
  "google_project_iam_custom_role",
  "google_project_iam_member",
  "google_service_account_iam_member",
])
  for (const n of Object.keys(r[typ] ?? {})) drop(typ, n);
for (const [i, g] of permissionCatalog(c).entries()) {
  if (g.scope === "database:proof" || g.scope.startsWith("billingAccounts/"))
    continue;
  const project = g.scope.startsWith("projects/")
    ? g.scope.split("/")[1]
    : g.scope.startsWith("serviceAccounts/")
      ? g.scope.split("@")[1].split(".iam.")[0]
      : c.projects.custody.id;
  const key = "scope_" + i;
  add(
    "google_project_iam_custom_role",
    key,
    {
      role_id: "b1a2_scope_" + i,
      title: "B1a2 " + g.role + " scoped " + i,
      permissions: g.permissions,
    },
    project,
  );
  const role = "${google_project_iam_custom_role." + key + ".name}",
    member = "serviceAccount:" + g.principal;
  if (g.scope.startsWith("serviceAccounts/"))
    add(
      "google_service_account_iam_member",
      key,
      {
        service_account_id:
          "projects/" + project + "/serviceAccounts/" + g.scope.slice(16),
        role,
        member,
      },
      null,
    );
  else if (g.scope.startsWith("buckets/"))
    add(
      "google_storage_bucket_iam_member",
      key,
      { bucket: g.scope.slice(8), role, member },
      null,
    );
  else if (g.scope.includes("/secrets/"))
    add(
      "google_secret_manager_secret_iam_member",
      key,
      { secret_id: g.scope, role, member },
      project,
    );
  else if (g.scope.includes("/cryptoKeys/"))
    add(
      "google_kms_crypto_key_iam_member",
      key,
      { crypto_key_id: g.scope, role, member },
      null,
    );
  else if (g.scope.includes("/repositories/"))
    add(
      "google_artifact_registry_repository_iam_member",
      key,
      { location: c.region, repository: "b1a2", role, member },
      project,
    );
  else add("google_project_iam_member", key, { role, member }, project);
}
const amount = c.budgetPlan.amountMinorUnits;
const units = String(BigInt(amount) / 100n),
  nanos = Number(BigInt(amount) % 100n) * 10000000;
r.google_billing_budget.session.amount.specified_amount = {
  currency_code: c.budgetPlan.accountCurrency,
  units,
  nanos,
};
r.google_billing_budget.session.display_name =
  "B1a2 SYNTHETIC FX example; alerts are not hard caps";
// Inventory is exact Terraform address plus API name/project; no wildcard deletion.
const inventory = [];
for (const [type, rs] of Object.entries(r))
  for (const [key, v] of Object.entries(rs))
    inventory.push({
      address: type + "." + key,
      type,
      key,
      project:
        v.project ??
        v.service_account_id?.match(/^projects\/([^/]+)\//)?.[1] ??
        ([
          "google_org_policy_policy",
          "terraform_data",
          "google_billing_budget",
        ].includes(type) || JSON.stringify(v).includes("effect")
          ? c.projects.runtime.id
          : c.projects.custody.id),
      name:
        v.name ??
        v.secret_id ??
        v.account_id ??
        v.role_id ??
        v.repository_id ??
        v.bucket ??
        key,
      dependencies: [
        ...new Set([
          ...(v.depends_on ?? []),
          ...(JSON.stringify(v).match(
            /(?:google_[a-z0-9_]+)\.[a-z0-9_]+(?=\.)/g,
          ) ?? []),
        ]),
      ],
      cleanupRole:
        v.project === c.projects.custody.id ||
        type.includes("storage_bucket") ||
        (type.includes("kms_") && JSON.stringify(v).includes("custody"))
          ? "custodyCleanup"
          : "cleanup",
      lifetimeSeconds: 21600,
      retention:
        type === "google_sql_database_instance"
          ? "B1A_ONLY_1_DAY_NO_FINAL_OR_RETAINED"
          : ["google_kms_key_ring", "google_kms_crypto_key"].includes(type)
            ? "NON_DELETABLE_METADATA; KEY_VERSIONS_DESTROY_AND_PROJECT_DISPOSAL"
            : "DELETE_EXACT_RESOURCE",
    });
await mkdir(new URL("terraform/", dir), { recursive: true });
await writeFile(
  new URL("terraform/main.tf.json", dir),
  JSON.stringify(x, null, 2) + "\n",
);
await writeFile(
  new URL("inventory.json", dir),
  JSON.stringify(
    {
      mode:
        c.mode === "SYNTHETIC_FIXTURE"
          ? "SYNTHETIC_FIXTURE_NOT_AUTHORIZED"
          : "OWNER_INPUT_PLAN_NOT_EXECUTION_AUTHORITY",
      oldResourceCount: Object.values(old.resource).reduce(
        (n, v) => n + Object.keys(v).length,
        0,
      ),
      placementRemovedCount: placementRemoved.length,
      placementRemoved,
      postPlacementCount:
        Object.values(old.resource).reduce(
          (n, v) => n + Object.keys(v).length,
          0,
        ) - placementRemoved.length,
      candidateResourceCount: inventory.length,
      inventory,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  new URL("owner-inputs.template.json", dir),
  JSON.stringify(ownerTemplate(), null, 2) + "\n",
);
console.log(
  JSON.stringify({
    placementRemoved: placementRemoved.length,
    resources: inventory.length,
    budget: c.budgetPlan,
  }),
);
