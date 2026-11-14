import { hash } from "../../src/protocol.mjs";
import { validateInputs } from "../runtime/inputs.mjs";
const unique = (v) => [...new Set(v)];
export function permissionCatalog(c) {
  const run = "projects/" + c.projects.runtime.id,
    fake = "projects/" + c.projects.fake.id,
    custody = "projects/" + c.projects.custody.id,
    sa = (role) => "serviceAccounts/" + c.serviceIdentities[role];
  const grants = [];
  const grant = (role, scope, permissions, note) =>
    grants.push({
      role,
      principal: c.serviceIdentities[role],
      scope,
      permissions,
      note,
    });
  grant(
    "deployer",
    run,
    [
      "run.services.create",
      "run.services.get",
      "run.services.update",
      "run.revisions.get",
      "run.revisions.list",
      "run.operations.get",
      "run.workerpools.create",
      "run.workerpools.get",
      "run.workerpools.update",
    ],
    "Dedicated runtime project; no custody/deletion/kill authority",
  );
  for (const role of [
    "gatewayOld",
    "gatewayNext",
    "ingress",
    "sealer",
    "worker",
  ])
    grant(
      "deployer",
      sa(role),
      ["iam.serviceAccounts.actAs"],
      "Exact runtime identity attachment only",
    );
  grant(
    "kill",
    run,
    [
      "run.services.get",
      "run.services.update",
      "run.services.delete",
      "run.revisions.get",
      "run.revisions.list",
      "run.revisions.delete",
      "run.operations.get",
      "run.workerpools.get",
      "run.workerpools.delete",
      "compute.firewalls.get",
      "compute.firewalls.update",
    ],
    "Independent emergency authority in disposable runtime project; service DELETE does not need deployer/actAs",
  );
  grant(
    "kill",
    sa("gatewayNext"),
    ["iam.serviceAccounts.actAs"],
    "Traffic management guide requires Service Account User; only staged candidate gateway identity, never all SAs",
  );
  const repo = run + "/locations/" + c.region + "/repositories/b1a2";
  for (const role of ["deployer", "kill", "fake"])
    grant(
      role,
      repo,
      [
        "artifactregistry.repositories.get",
        "artifactregistry.repositories.downloadArtifacts",
      ],
      "Only approved harness image repository",
    );
  grant(
    "kill",
    run + "/secrets/b1a2-effect-old",
    [
      "secretmanager.secrets.getIamPolicy",
      "secretmanager.secrets.setIamPolicy",
    ],
    "Old synthetic effect bundle only; IAM withdrawal is not cached-secret revocation",
  );
  grant(
    "kill",
    run +
      "/locations/" +
      c.region +
      "/keyRings/b1a2-effect/cryptoKeys/b1a2-effect",
    ["cloudkms.cryptoKeys.getIamPolicy", "cloudkms.cryptoKeys.setIamPolicy"],
    "Exact effect key",
  );
  grant(
    "observer",
    run,
    [
      "run.services.get",
      "run.revisions.get",
      "run.revisions.list",
      "run.operations.get",
      "serviceusage.services.get",
      "serviceusage.quotas.get",
      "monitoring.timeSeries.list",
      "logging.logEntries.list",
    ],
    "Read-only platform evidence; missing metrics never zero",
  );
  grant(
    "observer",
    fake,
    [
      "compute.instances.get",
      "compute.instances.list",
      "iap.tunnelInstances.accessViaIAP",
      "logging.logEntries.list",
    ],
    "IAP TCP443, not SSH; no actAs needed for start-iap-tunnel",
  );
  grant(
    "observer",
    custody + "/secrets/b1a2-observer-signing",
    ["secretmanager.versions.access"],
    "Independent observer key custody, never runtime/deployer",
  );
  grant(
    "observer",
    "buckets/" + c.names.bucket,
    ["storage.objects.get", "storage.objects.list"],
    "Independent evidence read",
  );
  grant(
    "cleanup",
    run,
    [
      "run.services.get",
      "run.services.delete",
      "run.workerpools.get",
      "run.workerpools.delete",
      "run.revisions.get",
      "run.revisions.list",
      "compute.forwardingRules.get",
      "compute.forwardingRules.delete",
      "compute.addresses.get",
      "compute.addresses.delete",
      "compute.routers.get",
      "compute.routers.update",
      "compute.routers.delete",
      "compute.subnetworks.get",
      "compute.subnetworks.delete",
      "compute.firewalls.get",
      "compute.firewalls.delete",
      "compute.routes.get",
      "compute.routes.delete",
      "compute.networks.get",
      "compute.networks.delete",
      "cloudsql.instances.get",
      "cloudsql.instances.delete",
      "cloudsql.backupRuns.list",
      "cloudsql.backupRuns.delete",
      "dns.managedZones.get",
      "dns.managedZones.delete",
      "dns.resourceRecordSets.list",
      "dns.changes.create",
      "secretmanager.secrets.get",
      "secretmanager.secrets.delete",
      "secretmanager.versions.list",
      "secretmanager.versions.destroy",
      "artifactregistry.repositories.get",
      "artifactregistry.repositories.delete",
      "iam.serviceAccounts.get",
      "iam.serviceAccounts.delete",
      "resourcemanager.projects.get",
      "cloudasset.assets.searchAllResources",
    ],
    "Exact disposable inventory; no automatic deletion of unexpected resources",
  );
  grant(
    "cleanup",
    fake,
    [
      "compute.instances.get",
      "compute.instances.delete",
      "compute.disks.get",
      "compute.disks.delete",
      "compute.addresses.get",
      "compute.addresses.delete",
      "compute.subnetworks.get",
      "compute.subnetworks.delete",
      "compute.firewalls.get",
      "compute.firewalls.delete",
      "compute.routes.get",
      "compute.routes.delete",
      "compute.networks.get",
      "compute.networks.delete",
      "dns.managedZones.get",
      "dns.managedZones.delete",
      "dns.resourceRecordSets.list",
      "dns.changes.create",
      "resourcemanager.projects.get",
      "cloudasset.assets.searchAllResources",
    ],
    "Fake host+network only",
  );
  grant(
    "custodyCleanup",
    custody,
    [
      "storage.buckets.get",
      "storage.buckets.delete",
      "storage.objects.get",
      "storage.objects.list",
      "storage.objects.delete",
      "cloudkms.cryptoKeyVersions.list",
      "cloudkms.cryptoKeyVersions.destroy",
      "secretmanager.secrets.get",
      "secretmanager.secrets.delete",
      "secretmanager.versions.list",
      "secretmanager.versions.destroy",
      "resourcemanager.projects.get",
      "cloudasset.assets.searchAllResources",
    ],
    "Independent approved synthetic evidence export/deletion; key rings not individually deletable",
  );
  for (const role of ["cleanup", "custodyCleanup"]) {
    const project = role === "cleanup" ? run : custody;
    grant(
      role,
      project,
      [
        "iam.roles.get",
        "iam.roles.delete",
        "resourcemanager.projects.getIamPolicy",
        "resourcemanager.projects.setIamPolicy",
        "iam.serviceAccounts.get",
        "iam.serviceAccounts.delete",
        "iam.serviceAccounts.getIamPolicy",
        "iam.serviceAccounts.setIamPolicy",
        "secretmanager.secrets.getIamPolicy",
        "secretmanager.secrets.setIamPolicy",
        "cloudkms.cryptoKeys.getIamPolicy",
        "cloudkms.cryptoKeys.setIamPolicy",
        "cloudkms.cryptoKeyVersions.list",
        "cloudkms.cryptoKeyVersions.destroy",
        "artifactregistry.repositories.getIamPolicy",
        "artifactregistry.repositories.setIamPolicy",
        "run.services.getIamPolicy",
        "run.services.setIamPolicy",
        "orgpolicy.policies.get",
        "orgpolicy.policies.delete",
      ],
      "Privileged teardown only in disposable project; exact inventory policy CAS, independently supervised; never a normal runtime/deployer grant",
    );
  }
  grant(
    "cleanup",
    fake,
    [
      "iam.roles.get",
      "iam.roles.delete",
      "iam.serviceAccounts.get",
      "iam.serviceAccounts.delete",
      "resourcemanager.projects.getIamPolicy",
      "resourcemanager.projects.setIamPolicy",
    ],
    "Exact fake identity/policy teardown only",
  );
  grant(
    "custodyCleanup",
    "buckets/" + c.names.bucket,
    [
      "storage.buckets.get",
      "storage.buckets.delete",
      "storage.buckets.getIamPolicy",
      "storage.buckets.setIamPolicy",
      "storage.objects.get",
      "storage.objects.list",
      "storage.objects.delete",
    ],
    "Exact synthetic evidence bucket only, export approval first",
  );
  grant(
    "cleanup",
    "billingAccounts/" + c.budget.billingAccountId,
    ["billing.budgets.get", "billing.budgets.delete"],
    "Owner must authorize exact billing account budget cleanup; no account upgrade or billing-spend permission",
  );
  grant(
    "controller",
    "database:proof",
    [
      "sql.execute:control_read",
      "sql.execute:control_renew",
      "sql.execute:control_create",
      "sql.execute:control_hold",
      "sql.execute:control_advance",
      "sql.execute:control_promote",
      "sql.execute:recover_retired",
    ],
    "Restricted SQL SECURITY DEFINER functions; no table DML, no admin role",
  );
  return grants;
}
export function requiredByCommand(argv, c) {
  const run = "projects/" + c.projects.runtime.id,
    fake = "projects/" + c.projects.fake.id;
  if (argv[0] === "B1A2_LOCAL_SQL") {
    const commands = {
      initialize: ["control_read", "control_create"],
      bootstrap: ["control_read", "control_promote", "control_renew"],
      advance: ["control_advance", "control_read"],
      "recover-retired": ["recover_retired", "control_read"],
      promote: ["control_promote", "control_read"],
    };
    const keys = commands[argv[1]];
    if (!keys) throw Error("unmapped_SQL_command");
    return [
      {
        scope: "database:proof",
        permissions: keys.map((x) => "sql.execute:" + x),
      },
    ];
  }
  if (argv[0] === "B1A2_OBSERVER")
    return [
      {
        scope: run,
        permissions: [
          "monitoring.timeSeries.list",
          "logging.logEntries.list",
          "run.revisions.get",
        ],
      },
    ];
  if (argv[0] !== "gcloud") throw Error("unsupported_command_kind");
  const project = argv.find((x) => x.startsWith("--project="))?.split("=")[1],
    scope = "projects/" + project;
  const key = argv.slice(1, 5).join(" ");
  if (key.startsWith("run deploy "))
    return [
      {
        scope,
        permissions: [
          "run.services.get",
          "run.services.update",
          "run.operations.get",
        ],
      },
      {
        scope: "serviceAccounts/" + c.serviceIdentities.gatewayNext,
        permissions: ["iam.serviceAccounts.actAs"],
      },
      {
        scope: run + "/locations/" + c.region + "/repositories/b1a2",
        permissions: [
          "artifactregistry.repositories.get",
          "artifactregistry.repositories.downloadArtifacts",
        ],
      },
    ];
  if (
    key.startsWith("run services update ") ||
    key.startsWith("run worker-pools update ")
  ) {
    const worker = key.startsWith("run worker-pools"),
      name = argv[4],
      role = worker
        ? "worker"
        : name === c.names.gateway
          ? "gatewayOld"
          : name === c.names.ingress
            ? "ingress"
            : "sealer";
    return [
      {
        scope,
        permissions: worker
          ? [
              "run.workerpools.get",
              "run.workerpools.update",
              "run.operations.get",
            ]
          : ["run.services.get", "run.services.update", "run.operations.get"],
      },
      {
        scope: "serviceAccounts/" + c.serviceIdentities[role],
        permissions: ["iam.serviceAccounts.actAs"],
      },
    ];
  }
  if (key.startsWith("run services update-traffic "))
    return [
      {
        scope,
        permissions: [
          "run.services.get",
          "run.services.update",
          "run.operations.get",
        ],
      },
      {
        scope: "serviceAccounts/" + c.serviceIdentities.gatewayNext,
        permissions: ["iam.serviceAccounts.actAs"],
      },
      {
        scope: run + "/locations/" + c.region + "/repositories/b1a2",
        permissions: [
          "artifactregistry.repositories.get",
          "artifactregistry.repositories.downloadArtifacts",
        ],
      },
    ];
  if (key.startsWith("run revisions delete "))
    return [
      {
        scope,
        permissions: [
          "run.revisions.get",
          "run.revisions.delete",
          "run.operations.get",
        ],
      },
    ];
  if (key.startsWith("run services delete "))
    return [
      { scope, permissions: ["run.services.get", "run.services.delete"] },
    ];
  if (key.startsWith("run worker-pools delete "))
    return [
      { scope, permissions: ["run.workerpools.get", "run.workerpools.delete"] },
    ];
  if (key.startsWith("run revisions describe "))
    return [{ scope, permissions: ["run.revisions.get"] }];
  if (key.startsWith("compute firewall-rules update "))
    return [
      {
        scope,
        permissions: ["compute.firewalls.get", "compute.firewalls.update"],
      },
    ];
  if (key.startsWith("secrets remove-iam-policy-binding "))
    return [
      {
        scope: run + "/secrets/b1a2-effect-old",
        permissions: [
          "secretmanager.secrets.getIamPolicy",
          "secretmanager.secrets.setIamPolicy",
        ],
      },
    ];
  if (key.startsWith("kms keys remove-iam-policy-binding "))
    return [
      {
        scope:
          run +
          "/locations/" +
          c.region +
          "/keyRings/b1a2-effect/cryptoKeys/b1a2-effect",
        permissions: [
          "cloudkms.cryptoKeys.getIamPolicy",
          "cloudkms.cryptoKeys.setIamPolicy",
        ],
      },
    ];
  if (key.startsWith("compute start-iap-tunnel "))
    return [
      {
        scope: fake,
        permissions: [
          "iap.tunnelInstances.accessViaIAP",
          "compute.instances.get",
          "compute.instances.list",
        ],
      },
    ];
  if (key.startsWith("compute instances delete "))
    return [
      {
        scope,
        permissions: [
          "compute.instances.get",
          "compute.instances.delete",
          "compute.disks.delete",
        ],
      },
    ];
  if (key.startsWith("sql instances delete "))
    return [
      {
        scope,
        permissions: ["cloudsql.instances.get", "cloudsql.instances.delete"],
      },
    ];
  if (key.startsWith("asset search-all-resources "))
    return [{ scope, permissions: ["cloudasset.assets.searchAllResources"] }];
  throw Error("unmapped_command_permission " + key);
}
export function assertPermissionCoverage(
  commands,
  c,
  grants = permissionCatalog(c),
) {
  for (const op of commands) {
    if (op.principal !== c.serviceIdentities[op.principalRole])
      throw Error("command_identity_mismatch " + op.id);
    if (
      op.argv[0] === "gcloud" &&
      !op.argv.includes("--impersonate-service-account=" + op.principal)
    )
      throw Error("explicit_impersonation_required");
    for (const req of requiredByCommand(op.argv, c))
      for (const p of req.permissions)
        if (
          !grants.some(
            (g) =>
              g.principal === op.principal &&
              g.scope === req.scope &&
              g.permissions.includes(p),
          )
        )
          throw Error(
            "blocking_permission_missing " + op.id + " " + p + " " + req.scope,
          );
  }
  return true;
}
export function operationalPlan(
  input,
  {
    now = Date.parse(input.session?.startedAt),
    purpose = "LOCAL_SIMULATION",
  } = {},
) {
  const c = validateInputs(input, { now, purpose }),
    run = c.projects.runtime.id,
    fake = c.projects.fake.id,
    commands = [];
  const add = (
    id,
    phase,
    principalRole,
    argv,
    preconditions,
    evidence,
    semantic,
  ) => {
    const principal = c.serviceIdentities[principalRole];
    if (argv[0] === "gcloud")
      argv = [
        ...argv,
        "--project=" +
          (["fake-delete", "fake-tunnel"].includes(id) ? fake : run),
        "--impersonate-service-account=" + principal,
        "--quiet",
      ];
    commands.push({
      id,
      phase,
      principalRole,
      principal,
      argv,
      preconditions,
      evidence,
      semantic,
      onFailure:
        "HOLD; independent emergency stop; never auto-promote/rearm/recreate",
    });
  };
  add(
    "preflight",
    0,
    "observer",
    ["B1A2_OBSERVER", "preflight", c.inputDigest],
    ["Owner decisions/account inputs validated; source guard retained"],
    ["Exact identity/API/quota/image/digest/region/network config snapshots"],
    "preflight",
  );
  add(
    "initialize",
    0,
    "controller",
    [
      "B1A2_LOCAL_SQL",
      "initialize",
      c.session.id,
      c.session.scopeId,
      c.session.expiresAt,
    ],
    ["No existing different session/identity"],
    ["Committed control row starts dispatch=false"],
    "initialize",
  );
  for (const role of ["gateway", "ingress", "sealer", "worker"])
    add(
      "prepare-" + role,
      0,
      "deployer",
      [
        "gcloud",
        "run",
        role === "worker" ? "worker-pools" : "services",
        "update",
        c.names[role],
        "--region=" + c.region,
        "--revision-suffix=e000001-prepared",
        "--update-env-vars=B1A2_MODE=MOUNTED_PREPARATION,B1A2_ROLE=" + role,
      ],
      [
        "Pinned role bundle and approved public profile use the exact prepared revision suffix; SQL remains inert",
      ],
      [
        "Purpose-bound startup attestation, actual service/worker identity+image+revision and restricted DB check",
      ],
      "prepare",
    );
  add(
    "retire-inert-bootstrap",
    0,
    "kill",
    [
      "gcloud",
      "run",
      "revisions",
      "delete",
      c.names.gateway + "-inert-bootstrap",
      "--region=" + c.region,
    ],
    [
      "Prepared old revision serves100% latest traffic; inert bootstrap had no dispatch capability",
    ],
    ["Delete receipt and exact absence of initial inert bootstrap"],
    "delete-inert",
  );
  add(
    "bootstrap",
    0,
    "controller",
    [
      "B1A2_LOCAL_SQL",
      "bootstrap",
      c.session.id,
      "VERIFIED_INERT_PROFILES_AND_INDEPENDENT_CUSTODY",
    ],
    [
      "Fresh BOOTSTRAP only; explicit owner session approval; four verified profiles; fake/custody preflight",
    ],
    [
      "Committed initial promotion and short authority lease; never re-enable a prior hold",
    ],
    "bootstrap",
  );
  add(
    "stage",
    1,
    "deployer",
    [
      "gcloud",
      "run",
      "deploy",
      c.names.gateway,
      "--region=" + c.region,
      "--image=" + c.images.runtime,
      "--revision-suffix=" +
        c.epochs.nextRevision.slice(c.names.gateway.length + 1),
      "--service-account=" + c.serviceIdentities.gatewayNext,
      "--network=" + c.names.network,
      "--subnet=b1a2-gateway",
      "--network-tags=" + c.epochs.nextTag,
      "--vpc-egress=all-traffic",
      "--no-traffic",
      "--no-cpu-throttling",
      "--concurrency=1",
      "--timeout=15s",
      "--update-env-vars=B1A2_MODE=MOUNTED_PREPARATION,B1A2_ROLE=gateway",
      "--update-secrets=/secrets/manifest.json=b1a2-effect-next:1,/secrets/profile.json=b1a2-effect-next:2,/secrets/database.json=b1a2-effect-next:3,/secrets/callerKey.txt=b1a2-effect-next:4,/secrets/tls.json=b1a2-effect-next:5",
    ],
    ["Exact pinned build/profile approved; no candidate dispatch"],
    [
      "Actual returned revision/SA/tag/image exact match; actAs scoped to candidate",
    ],
    "stage",
  );
  add(
    "advance",
    2,
    "controller",
    [
      "B1A2_LOCAL_SQL",
      "advance",
      c.session.id,
      String(c.epochs.old),
      String(c.epochs.next),
      c.epochs.nextRevision,
    ],
    ["Candidate inert"],
    ["Epoch CAS committed, dispatch false; original attempts unchanged"],
    "advance",
  );
  add(
    "traffic",
    3,
    "kill",
    [
      "gcloud",
      "run",
      "services",
      "update-traffic",
      c.names.gateway,
      "--region=" + c.region,
      "--to-revisions=" + c.epochs.nextRevision + "=100",
      "--clear-tags",
    ],
    ["Epoch advanced; candidate inert"],
    ["100% candidate, no old traffic tag; traffic0 not termination"],
    "traffic",
  );
  for (const family of ["v4", "v6"])
    add(
      "deny-" + family,
      4,
      "kill",
      [
        "gcloud",
        "compute",
        "firewall-rules",
        "update",
        c.epochs.oldTag + "-deny-" + family,
        "--no-disabled",
      ],
      ["Kill principal independent of deployer"],
      [
        "Priority100 deny over allow1000; includes restricted GoogleVIP; established sockets still dangerous",
      ],
      "deny",
    );
  add(
    "secret-withdraw",
    4,
    "kill",
    [
      "gcloud",
      "secrets",
      "remove-iam-policy-binding",
      "b1a2-effect-old",
      "--member=serviceAccount:" + c.serviceIdentities.gatewayOld,
      "--role=roles/secretmanager.secretAccessor",
    ],
    ["Old tag deny initiated"],
    [
      "Exact old synthetic bundle IAM receipt; cached values still require termination",
    ],
    "secret",
  );
  add(
    "decrypt-withdraw",
    4,
    "kill",
    [
      "gcloud",
      "kms",
      "keys",
      "remove-iam-policy-binding",
      "b1a2-effect",
      "--keyring=b1a2-effect",
      "--location=" + c.region,
      "--member=serviceAccount:" + c.serviceIdentities.gatewayOld,
      "--role=roles/cloudkms.cryptoKeyDecrypter",
    ],
    ["Old tag deny initiated"],
    ["Exact effect key IAM receipt"],
    "decrypt",
  );
  add(
    "revision-delete",
    4,
    "kill",
    [
      "gcloud",
      "run",
      "revisions",
      "delete",
      c.epochs.oldRevision,
      "--region=" + c.region,
    ],
    ["Old traffic/tags removed; deny applied"],
    ["Deletion LRO and not-found receipt; not sufficient alone"],
    "delete",
  );
  add(
    "observe",
    5,
    "observer",
    ["B1A2_OBSERVER", "retirement", c.session.id, c.epochs.oldRevision],
    ["No physical bound inferred from delayed reporting"],
    [
      "Sample60s,visible latency120s, all active/idle labels, signed clocks, >=20 independent canaries, full fake ledger",
    ],
    "observe",
  );
  add(
    "recover",
    6,
    "controller",
    [
      "B1A2_LOCAL_SQL",
      "recover-retired",
      c.session.id,
      "ORIGINAL_ATTEMPTS_FROM_VERIFIED_LEDGER",
    ],
    ["Authenticated retirement evidence complete"],
    [
      "Only retired ENTERED→UNKNOWN; APPLIED/ARMED/UNKNOWN preserved; no new IDs",
    ],
    "recover",
  );
  add(
    "promote",
    7,
    "controller",
    ["B1A2_LOCAL_SQL", "promote", c.session.id, "VERIFIED_EVIDENCE_DIGEST"],
    [
      "EVIDENCE_READY and exact session/scope/predecessor/generation CAS; expiry still valid",
    ],
    ["Explicit recorded promotion; rollback is new epoch N+2"],
    "promote",
  );
  const emergency = [];
  const before = commands.length;
  add(
    "emergency-service-delete",
    8,
    "kill",
    [
      "gcloud",
      "run",
      "services",
      "delete",
      c.names.gateway,
      "--region=" + c.region,
    ],
    ["Immediate SQL hold; old-tag deny attempted; no deployer dependency"],
    [
      "Whole service and all revisions requested deleted; no actAs/AR read dependency; independent platform/canary evidence still required",
    ],
    "emergency",
  );
  add(
    "emergency-worker-delete",
    8,
    "kill",
    [
      "gcloud",
      "run",
      "worker-pools",
      "delete",
      c.names.worker,
      "--region=" + c.region,
    ],
    ["Dispatch held"],
    [
      "Worker-pool delete receipt; IAM permission is run.workerpools.delete (lowercase)",
    ],
    "emergency",
  );
  emergency.push(...commands.splice(before));
  const teardownStart = commands.length;
  for (const name of [c.names.gateway, c.names.ingress, c.names.sealer])
    add(
      "delete-" + name,
      9,
      "cleanup",
      ["gcloud", "run", "services", "delete", name, "--region=" + c.region],
      ["All epochs fenced; coherent evidence exported"],
      [
        "Exact service absent; retained revisions/instances independently checked",
      ],
      "teardown",
    );
  add(
    "worker-delete",
    9,
    "cleanup",
    [
      "gcloud",
      "run",
      "worker-pools",
      "delete",
      c.names.worker,
      "--region=" + c.region,
    ],
    ["Dispatch held"],
    ["Worker pool absent"],
    "teardown",
  );
  add(
    "fake-delete",
    9,
    "cleanup",
    [
      "gcloud",
      "compute",
      "instances",
      "delete",
      c.names.fake,
      "--zone=" + c.region + "-a",
      "--delete-disks=all",
    ],
    ["Independent ledger/export secured"],
    ["Fake VM and boot disk absent"],
    "teardown",
  );
  add(
    "sql-delete",
    9,
    "cleanup",
    ["gcloud", "sql", "instances", "delete", c.names.database],
    ["Evidence export, no real data; no final/retained backups"],
    ["Instance/backup/PITR absence (B1a-only 1day)"],
    "teardown",
  );
  add(
    "residual",
    10,
    "cleanup",
    [
      "gcloud",
      "asset",
      "search-all-resources",
      "--scope=projects/" + run,
      "--format=json",
    ],
    ["Every exact inventory resource processed"],
    [
      "No unexpected/retained resources; +2h,+48h,next statement verification; unknown resources held for owner",
    ],
    "residual",
  );
  const teardown = commands.splice(teardownStart);
  const accessStart = commands.length;
  add(
    "fake-tunnel",
    0,
    "observer",
    [
      "gcloud",
      "compute",
      "start-iap-tunnel",
      c.names.fake,
      "443",
      "--zone=" + c.region + "-a",
      "--local-host-port=127.0.0.1:18443",
    ],
    ["IAP+mTLS observer identity; no SSH or public0/0 rule"],
    [
      "Local encrypted tunnel to fake clock/ledger endpoint; no actAs privilege needed",
    ],
    "tunnel",
  );
  const access = commands.splice(accessStart);
  const all = [...commands, ...emergency, ...teardown, ...access];
  assertPermissionCoverage(all, c);
  return {
    mode: "PRINT_ONLY_OR_LOCAL_SIMULATION",
    liveExecutionEnabled: false,
    inputDigest: c.inputDigest,
    inputs: c,
    fenceSteps: [1, 2, 3, 4, 5, 6, 7],
    commands,
    emergency,
    teardown,
    access,
    permissionMatrix: all.map((o) => ({
      ...o,
      requirements: requiredByCommand(o.argv, c),
    })),
    grants: permissionCatalog(c),
    futureActivation:
      "Separate reviewed source change AND exact owner authorization; flags/CI cannot activate",
    callerImpersonation:
      "Named humans require iam.serviceAccounts.getAccessToken on only their approved controller/kill/cleanup/observer identities; not a runtime grant",
    rollback: "Prior image at fresh N+2, never old revision",
  };
}
