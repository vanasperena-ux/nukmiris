import { readFile } from "node:fs/promises";
import { hash } from "../../src/protocol.mjs";
export const inventory = JSON.parse(
  await readFile(new URL("../inventory.json", import.meta.url), "utf8"),
);
const p = inventory.projects.runtime,
  c = inventory.projects.custody,
  f = inventory.projects.fake,
  r = inventory.region,
  g = inventory.gateway;
const cloud = (argv, principal = inventory.identities.kill) => [
  "gcloud",
  ...argv,
  "--project=" + p,
  "--impersonate-service-account=" + principal,
  "--quiet",
];
const step = (number, title, commands, evidence) => ({
  step: number,
  title,
  commands,
  evidence,
  onFailure:
    "STOP; keep dispatch disabled; retain original identities and all evidence; independent kill operator investigates. Never auto-promote.",
});
/** Data only: no SDK, shell, subprocess, credentials or network. Commands are
 * proposals for a future separately reviewed operator, never executed here. */
export function fencePlan() {
  return {
    mode: "PRINT_ONLY_B1A_NOT_AUTHORIZED",
    inventoryDigest: hash(inventory),
    serviceModel: "one service, unique revision/SA/tag per epoch",
    preconditions: [
      "Separate source acceptance AND inventory-specific resource authorization",
      "Named supervisor, kill, cleanup, billing and backup humans",
      "Approved image digest replaces all-zero placeholder; SQL schema/policy digests pinned",
      "Independent observer trust pins; measured clock and reporting delay; owner-approved fence threshold",
      "Candidate dispatch disabled in SQL; no credentials or live APIs used by this tool",
    ],
    steps: [
      step(
        1,
        "Stage candidate inert; never route by latest after bootstrap",
        [
          cloud(
            [
              "run",
              "deploy",
              g.service,
              "--region=" + r,
              "--image=us-central1-docker.pkg.dev/" +
                p +
                "/b1a/harness@sha256:" +
                "0".repeat(64),
              "--revision-suffix=e000002-r1",
              "--service-account=" + g.candidateSa,
              "--network=nmb1a-run",
              "--subnet=nmb1a-gateway",
              "--network-tags=" + g.candidateTag,
              "--vpc-egress=all-traffic",
              "--no-traffic",
              "--min=1",
              "--max=2",
              "--min-instances=1",
              "--max-instances=1",
              "--no-cpu-throttling",
              "--concurrency=1",
              "--timeout=15s",
              "--update-env-vars=B1A_MODE=INERT_UNCONFIGURED,DEPLOYMENT_EPOCH=2",
            ],
            "nmb1a-deployer@" + p + ".iam.gserviceaccount.com",
          ),
        ],
        [
          "Assert actual returned revision exactly " + g.candidateRevision,
          "Snapshot effective ingress/all-traffic/tag/SA/image/limits; mismatch aborts",
          "Runtime configuration/bootstrap and image approval remain review gates; command intentionally stages inert",
        ],
      ),
      step(
        2,
        "Freeze and advance authority in one SQL transaction",
        [
          [
            "psql",
            "service=B1A_CONTROLLER_VERIFY_FULL",
            "--set=ON_ERROR_STOP=1",
            "--file=platform-proof/b1a/ops/advance.sql",
          ],
        ],
        [
          "Bind SQL variables session UUID, oldEpoch=1,newEpoch=2,newRevision=" +
            g.candidateRevision,
          "Read committed control row: epoch 2, dispatch false, generation incremented; no effect permit in worker",
        ],
      ),
      step(
        3,
        "Move all traffic to inert candidate; remove all old traffic tags",
        [
          cloud([
            "run",
            "services",
            "update-traffic",
            g.service,
            "--region=" + r,
            "--to-revisions=" + g.candidateRevision + "=100",
            "--clear-tags",
          ]),
        ],
        [
          "Exact service traffic/tag export; 0% old traffic is NOT termination; old warm/min instances still hazardous",
        ],
      ),
      step(
        4,
        "Independent kill: deny old egress, remove credentials/decrypt, delete old revision",
        [
          ...g.oldDenyRules.map((name) =>
            cloud([
              "compute",
              "firewall-rules",
              "update",
              name,
              "--no-disabled",
            ]),
          ),
          cloud([
            "secrets",
            "remove-iam-policy-binding",
            "nmb1a-effect-e000001",
            "--member=serviceAccount:" + g.oldSa,
            "--role=roles/secretmanager.secretAccessor",
          ]),
          cloud([
            "kms",
            "keys",
            "remove-iam-policy-binding",
            "nmb1a-effect",
            "--keyring=nmb1a-effect",
            "--location=" + r,
            "--member=serviceAccount:" + g.oldSa,
            "--role=roles/cloudkms.cryptoKeyDecrypter",
          ]),
          cloud(["run", "revisions", "delete", g.oldRevision, "--region=" + r]),
        ],
        [
          "Independent principal receipts; verify old priority100 IPv4/IPv6 deny takes precedence1000",
          "Cached credentials are not revoked by IAM changes; network + deletion + canary evidence mandatory",
          "Delete receipt plus system logs, never presume all processes gone",
        ],
      ),
      step(
        5,
        "Independently observe platform, network, clocks, delayed canaries and full fake ledger",
        [
          cloud(
            [
              "run",
              "revisions",
              "describe",
              g.oldRevision,
              "--region=" + r,
              "--format=json",
            ],
            inventory.identities.observer,
          ),
          cloud(
            [
              "logging",
              "read",
              'resource.type="cloud_run_revision" AND resource.labels.revision_name="' +
                g.oldRevision +
                '"',
              "--format=json",
            ],
            inventory.identities.observer,
          ),
          [
            "PRINT_ONLY_HTTPS_GET",
            "https://monitoring.googleapis.com/v3/projects/" +
              p +
              "/timeSeries",
            'filter=metric.type="run.googleapis.com/container/instance_count" AND resource.labels.service_name="' +
              g.service +
              '" AND resource.labels.revision_name="' +
              g.oldRevision +
              '"',
            "start/end=session fence window; aggregation/distribution interpreted by independent observer",
          ],
        ],
        [
          "404 deletion is only one input; missing Monitoring series is NOT a zero sample",
          "Signed independent FENCE/ACTIVITY/CLOCK/CANARY/LEDGER envelopes; full chain/head; explicit uncertainty",
          ">=20 canaries independently scheduled after deletion+reporting window; measured wake tail; provider ledger observed past every wake tail",
          "No actual Google evidence adapter executed locally; source contract cannot manufacture Google facts",
        ],
      ),
      step(
        6,
        "Reconcile original attempts without resending uncertain work",
        [
          [
            "psql",
            "service=B1A_CONTROLLER_VERIFY_FULL",
            "--set=ON_ERROR_STOP=1",
            "--file=platform-proof/b1a/ops/reconcile.sql",
          ],
        ],
        [
          "May-have-entered → UNKNOWN protected; APPLIED stays; ARMED may be explicitly replayed only original identity and matching authority",
          "No deleted history, auto rearm, replacement identity or invented external outcome",
        ],
      ),
      step(
        7,
        "Explicit compare-and-swap promotion only after independent complete evidence",
        [
          [
            "PRINT_ONLY_NODE_API",
            "SessionController.promote(authenticatedBundle)",
            "session from approved inventory; bundle must bind current session/scope and retired epoch/revision; generation CAS",
          ],
        ],
        [
          "VIOLATION blocks; stale/missing/conflicting => HOLD/NOT_PROVEN",
          "Record signed decision + evidence digest; billing/session reset never automatically enables",
          "Rollback prior image must be epoch3/new SA/tag/revision through entire fence; never reactivate epoch1",
        ],
      ),
    ],
    abort:
      "Any incomplete evidence leaves dispatch disabled; freeze old/new work, invoke independent kill, preserve custody. Watchdog expiry never promotes.",
  };
}

export function teardownPlan() {
  return {
    mode: "PRINT_ONLY_B1A_NOT_AUTHORIZED",
    inventoryDigest: hash(inventory),
    deadline: "min(session start + 6h, 2026-12-17)",
    preconditions: [
      "Only future owner-authorized disposable projects listed here; verify exact project numbers before any destructive operation",
      "Freeze ingress/dispatch; fence ALL started epochs, not only epoch1; preserve export before deleting SQL/custody",
      "No automatic Terraform recreation; all future apply jobs disabled after expiry; dual-human signoff",
    ],
    phases: [
      {
        phase: 1,
        action: "Freeze/fence/export",
        commands: [
          [
            "PRINT_ONLY",
            "execute fence steps2–6 for every epoch in signed session registry",
          ],
          [
            "PRINT_ONLY",
            "export SQL, full ledgers, signed heads, observer decisions and resource inventory to owner-controlled inert evidence package",
          ],
        ],
      },
      {
        phase: 2,
        action: "Remove compute and private connections in dependency order",
        commands: [
          cloud([
            "run",
            "worker-pools",
            "delete",
            "nmb1a-worker",
            "--region=" + r,
          ]),
          ...["gateway", "ingress"].map((s) =>
            cloud(["run", "services", "delete", "nmb1a-" + s, "--region=" + r]),
          ),
          [
            "gcloud",
            "run",
            "services",
            "delete",
            "nmb1a-sealer",
            "--region=" + r,
            "--project=" + c,
          ],
          [
            "gcloud",
            "compute",
            "instances",
            "delete",
            "nmb1a-fake",
            "--zone=us-central1-a",
            "--delete-disks=all",
            "--project=" + f,
          ],
          ...["sealer-consumer", "sql-run"].map((n) => [
            "gcloud",
            "compute",
            "forwarding-rules",
            "delete",
            "nmb1a-" + n,
            "--region=" + r,
            "--project=" + p,
          ]),
          [
            "gcloud",
            "compute",
            "forwarding-rules",
            "delete",
            "nmb1a-sql-custody",
            "--region=" + r,
            "--project=" + c,
          ],
          [
            "gcloud",
            "compute",
            "service-attachments",
            "delete",
            "nmb1a-sealer-published",
            "--region=" + r,
            "--project=" + c,
          ],
          [
            "gcloud",
            "compute",
            "forwarding-rules",
            "delete",
            "nmb1a-sealer-lb",
            "--region=" + r,
            "--project=" + c,
          ],
          [
            "gcloud",
            "compute",
            "target-https-proxies",
            "delete",
            "nmb1a-sealer-https",
            "--region=" + r,
            "--project=" + c,
          ],
          [
            "gcloud",
            "compute",
            "url-maps",
            "delete",
            "nmb1a-sealer-map",
            "--region=" + r,
            "--project=" + c,
          ],
          [
            "gcloud",
            "compute",
            "backend-services",
            "delete",
            "nmb1a-sealer-backend",
            "--region=" + r,
            "--project=" + c,
          ],
          [
            "gcloud",
            "compute",
            "network-endpoint-groups",
            "delete",
            "nmb1a-sealer-neg",
            "--region=" + r,
            "--project=" + c,
          ],
          [
            "gcloud",
            "compute",
            "ssl-certificates",
            "delete",
            "nmb1a-sealer-synthetic-tls",
            "--region=" + r,
            "--project=" + c,
          ],
          cloud(["sql", "instances", "delete", inventory.sql.name]),
        ],
      },
      {
        phase: 3,
        action:
          "Verify all billable/retained descendants then remove exact disposable projects",
        commands: [
          ...Object.values(inventory.projects).map((project) => [
            "gcloud",
            "asset",
            "search-all-resources",
            "--scope=projects/" + project,
            "--format=json",
          ]),
          [
            "PRINT_ONLY",
            "enumerate/delete SQL backups/PITR/WAL/restore instances; VM disks/snapshots; PSC/ALB/proxies/addresses; all bucket versions/exports; log buckets/sinks; AR images/build caches; secret versions; schedule every KMS key version destruction",
          ],
          ...Object.values(inventory.projects).map((project) => [
            "gcloud",
            "projects",
            "delete",
            project,
          ]),
        ],
        requiredInventory: inventory.terraformResources,
      },
      {
        phase: 4,
        action: "Independent residual-billing verification",
        commands: [
          [
            "PRINT_ONLY",
            "verify resource absence at +2h (Direct VPC IP/subnet release can lag), +48h billing and next statement; record pending charges and KMS destruction completion; remove budget notification wiring only after closeout",
          ],
        ],
        failClosed:
          "Missing absence/billing evidence => cleanup incomplete, named backup operator follows up; never reopen experiment automatically",
      },
    ],
    recreation:
      "Impossible apply guard remains; durable expiry and disabled deployment jobs; a reboot/reset/new billing month is not authorization.",
  };
}
export function spendCapTemplate() {
  return {
    mode: "PRINT_ONLY_NOT_AN_API_REQUEST",
    method: "POST",
    url: "https://billingbudgets.googleapis.com/v1/billingAccounts/OWNER_AUTHORIZED_ACCOUNT_ID/budgets",
    body: {
      displayName: "B1a runtime Cloud Run spend cap ONLY",
      budgetFilter: {
        projects: ["projects/OWNER_AUTHORIZED_RUNTIME_NUMBER"],
        services: ["services/152E-C115-5142"],
        creditTypesTreatment: "EXCLUDE_ALL_CREDITS",
        calendarPeriod: "MONTH",
        ownershipScope: "ALL_USERS",
      },
      amount: {
        specifiedAmount: {
          currencyCode: "OWNER_VERIFIED_ACCOUNT_CURRENCY",
          units: "OWNER_APPROVED_CONVERSION_OF_ALLOCATION",
        },
      },
      thresholdRules: [0.5, 0.8, 1].map((thresholdPercent) => ({
        thresholdPercent,
        spendBasis: "CURRENT_SPEND",
      })),
      notificationsRule: { enableProjectLevelRecipients: true },
      spendCap: { inputState: "CONFIGURED" },
    },
    limitations: [
      "Account/API/Free Trial eligibility unverified; may be unavailable",
      "Delayed, service/project scoped; SQL, NAT, LB, VM, storage and inflight work continue billing",
      "USD20 is proposed gross TOTAL allocation, not 20MXN; owner must verify currency/FX and preexisting monthly spend",
      "ENFORCED or reset CONFIGURED/AWAITING_NEXT_PERIOD durably holds dispatch; independent explicit promotion required",
      "Separate gross alert budget 10/15/18/20 USD equivalent; alerts are not hard caps",
    ],
  };
}
const kinds = {
  fence: fencePlan,
  teardown: teardownPlan,
  "spend-cap": spendCapTemplate,
};
if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  const [kind, ...rest] = process.argv.slice(2);
  if (!kinds[kind] || rest.length)
    throw Error(
      "PRINT_ONLY: fence|teardown|spend-cap; execution flags forbidden",
    );
  console.log(JSON.stringify(kinds[kind](), null, 2));
}
