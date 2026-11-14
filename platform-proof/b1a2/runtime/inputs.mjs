import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { hash } from "../../src/protocol.mjs";
import { budgetPlan } from "./billing.mjs";
export const REQUIRED_APIS = [
  "run.googleapis.com",
  "compute.googleapis.com",
  "sqladmin.googleapis.com",
  "storage.googleapis.com",
  "secretmanager.googleapis.com",
  "cloudkms.googleapis.com",
  "monitoring.googleapis.com",
  "logging.googleapis.com",
  "artifactregistry.googleapis.com",
  "dns.googleapis.com",
  "iam.googleapis.com",
  "serviceusage.googleapis.com",
  "billingbudgets.googleapis.com",
  "iap.googleapis.com",
];
export const SERVICE_ROLES = [
  "gatewayOld",
  "gatewayNext",
  "ingress",
  "sealer",
  "worker",
  "controller",
  "kill",
  "cleanup",
  "custodyCleanup",
  "observer",
  "deployer",
  "fake",
];
export const OWNER_DECISIONS = [
  "organizationMode",
  "operators",
  "timingPolicy",
  "budgetAndWindow",
  "optionalRestoreDrill",
];
const frozen = (v) => {
  if (v && typeof v === "object") {
    Object.values(v).forEach(frozen);
    Object.freeze(v);
  }
  return v;
};
export function validateInputs(
  v,
  { now = Date.now(), purpose = "LOCAL_SIMULATION" } = {},
) {
  const fixture =
    purpose === "LOCAL_SIMULATION" && v?.mode === "SYNTHETIC_FIXTURE";
  if (
    !v ||
    !["LOCAL_SIMULATION", "PROVISIONING_PLAN"].includes(purpose) ||
    (!fixture &&
      (v.mode !== "OWNER_SUPPLIED" ||
        !v.ownerApprovalRef ||
        /UNAPPROVED|SYNTHETIC/.test(v.ownerApprovalRef)))
  )
    throw Error("explicit_owner_inputs_required");
  if (
    !v.projects ||
    !["runtime", "custody", "fake"].every((k) => {
      const p = v.projects[k];
      return (
        p &&
        /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(p.id) &&
        /^[1-9][0-9]{11}$/.test(p.number)
      );
    }) ||
    new Set(Object.values(v.projects).map((p) => p.id)).size !== 3
  )
    throw Error("exact_project_ids_and_numbers_required");
  if (
    !["ORG_ENFORCED", "STANDALONE_REVIEW_REQUIRED"].includes(
      v.organizationMode,
    ) ||
    (!fixture &&
      v.organizationMode === "STANDALONE_REVIEW_REQUIRED" &&
      !v.standaloneRiskReview)
  )
    throw Error("owner_organization_decision_required");
  if (
    v.region !== "us-central1" ||
    !Array.isArray(v.allowedApis) ||
    v.allowedApis.length !== REQUIRED_APIS.length ||
    !REQUIRED_APIS.every((x) => v.allowedApis.includes(x)) ||
    !v.quotas ||
    v.quotas.gatewayInstances !== 2 ||
    v.quotas.workerInstances !== 1 ||
    v.quotas.sqlConnections < 13 ||
    v.quotas.sqlConnections > 25
  )
    throw Error("reviewed_region_api_and_quota_inputs_required");
  const s = v.session,
    begin = Date.parse(s?.startedAt),
    end = Date.parse(s?.expiresAt);
  if (
    !s ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s.id) ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s.scopeId) ||
    ![begin, end, now].every(Number.isFinite) ||
    end <= begin ||
    end - begin > 21600000 ||
    end <= now ||
    end > Date.parse("2026-12-17T23:59:59Z")
  )
    throw Error("approved_bounded_session_window_required");
  if (
    !v.operators ||
    !["supervisor", "kill", "cleanup", "billing", "backup", "custodian"].every(
      (k) => typeof v.operators[k] === "string" && v.operators[k],
    ) ||
    (!fixture &&
      Object.values(v.operators).some((x) =>
        /synthetic|UNASSIGNED|UNAPPROVED/i.test(x),
      ))
  )
    throw Error("named_operators_required");
  if (
    !v.names ||
    !Object.values(v.names).every(
      (x) => typeof x === "string" && /^[a-z][a-z0-9-]{2,62}$/.test(x),
    ) ||
    ![
      "gateway",
      "ingress",
      "sealer",
      "worker",
      "fake",
      "database",
      "bucket",
      "network",
    ].every((k) => v.names[k])
  )
    throw Error("exact_resource_names_required");
  if (
    !v.serviceIdentities ||
    !SERVICE_ROLES.every((k) => {
      const project = ["observer", "custodyCleanup"].includes(k)
        ? v.projects.custody.id
        : k === "fake"
          ? v.projects.fake.id
          : v.projects.runtime.id;
      return (
        typeof v.serviceIdentities[k] === "string" &&
        /^[a-z][a-z0-9-]{4,28}[a-z0-9]@/.test(v.serviceIdentities[k]) &&
        v.serviceIdentities[k].endsWith(
          "@" + project + ".iam.gserviceaccount.com",
        )
      );
    }) ||
    new Set(Object.values(v.serviceIdentities)).size !== SERVICE_ROLES.length
  )
    throw Error("exact_distinct_service_identities_required");
  if (
    !v.epochs ||
    !Number.isInteger(v.epochs.old) ||
    v.epochs.next !== v.epochs.old + 1 ||
    !["oldRevision", "nextRevision", "oldTag", "nextTag"].every((k) =>
      /^[a-z][a-z0-9-]{1,62}$/.test(v.epochs[k]),
    ) ||
    v.epochs.oldRevision === v.epochs.nextRevision ||
    v.epochs.oldTag === v.epochs.nextTag
  )
    throw Error("fresh_epoch_revision_and_tag_required");
  const nets = ["gateway", "private", "fake"];
  if (
    !v.network ||
    Object.keys(v.network).length !== 3 ||
    !nets.every((k) => {
      const c = v.network[k];
      if (
        typeof c !== "string" ||
        !/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}\/(?:1[6-9]|2[0-6])$/.test(c) ||
        isIP(c.split("/")[0]) !== 4
      )
        return false;
      const [addr, prefix] = c.split("/"),
        n = addr.split(".").reduce((n, x) => n * 256 + Number(x), 0);
      return n % 2 ** (32 - Number(prefix)) === 0;
    })
  )
    throw Error("reviewed_private_network_ranges_required");
  const ranges = nets.map((k) => {
    const [ip, p] = v.network[k].split("/"),
      a = ip.split(".").reduce((n, x) => n * 256 + Number(x), 0);
    return [a, a + 2 ** (32 - Number(p)) - 1];
  });
  if (
    ranges.some((r, i) =>
      ranges.some((s, j) => i !== j && r[0] <= s[1] && s[0] <= r[1]),
    )
  )
    throw Error("overlapping_network_ranges");
  if (
    !v.timing ||
    !Number.isFinite(v.timing.terminationTargetMs) ||
    v.timing.terminationTargetMs <= 0 ||
    v.timing.terminationTargetMs > 60000 ||
    v.timing.canaryCount < 20 ||
    v.timing.samplingIntervalMs !== 60000 ||
    v.timing.publicationLatencyMs < 120000 ||
    (!fixture && !v.timing.ownerApprovalRef)
  )
    throw Error("explicit_timing_policy_required");
  if (
    !v.images ||
    !["runtime", "fake"].every(
      (k) =>
        typeof v.images[k] === "string" &&
        /@sha256:[a-f0-9]{64}$/.test(v.images[k]) &&
        !/@sha256:0{64}$/.test(v.images[k]),
    ) ||
    (!fixture &&
      (!v.images.approvalRef ||
        /fixture|UNAPPROVED/i.test(v.images.approvalRef)))
  )
    throw Error("pinned_approved_images_required");
  if (
    !/^[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{6}$/.test(
      v.budget?.billingAccountId ?? "",
    ) ||
    (!fixture && v.budget.billingAccountId === "000000-000000-000000")
  )
    throw Error("explicit_billing_account_id_required");
  const budget = budgetPlan(v.budget, now);
  return frozen({
    ...structuredClone(v),
    budgetPlan: budget,
    inputDigest: hash(v),
    sourceMode: fixture
      ? "LOCAL_SYNTHETIC_ONLY"
      : "OWNER_DATA_ONLY_NOT_EXECUTION_AUTHORITY",
  });
}
export function ownerTemplate() {
  return {
    mode: "OWNER_SUPPLIED",
    ownerApprovalRef: null,
    projects: {
      runtime: { id: null, number: null },
      custody: { id: null, number: null },
      fake: { id: null, number: null },
    },
    organizationMode: null,
    standaloneRiskReview: null,
    region: null,
    allowedApis: REQUIRED_APIS,
    quotas: { gatewayInstances: 2, workerInstances: 1, sqlConnections: 25 },
    names: null,
    serviceIdentities: Object.fromEntries(SERVICE_ROLES.map((k) => [k, null])),
    network: null,
    epochs: null,
    session: null,
    operators: null,
    timing: null,
    images: null,
    budget: {
      billingAccountId: null,
      allocationUsd: "20.00",
      accountCurrency: null,
      localPerUsd: null,
      fxAsOf: null,
      fxValidUntil: null,
      fxApprovalRef: null,
    },
    optionalRestoreDrill: null,
  };
}
export function syntheticInputs(now = Date.parse("2026-11-14T12:00:00Z")) {
  const identities = Object.fromEntries(
    SERVICE_ROLES.map((k) => {
      const project = ["observer", "custodyCleanup"].includes(k)
        ? "b1a2-fixture-custody"
        : k === "fake"
          ? "b1a2-fixture-fake"
          : "b1a2-fixture-run";
      return [
        k,
        "b1a2-" +
          k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()) +
          "@" +
          project +
          ".iam.gserviceaccount.com",
      ];
    }),
  );
  return {
    serviceIdentities: identities,
    mode: "SYNTHETIC_FIXTURE",
    ownerApprovalRef: "SYNTHETIC_ONLY_NOT_AUTHORIZED",
    projects: {
      runtime: { id: "b1a2-fixture-run", number: "111111111111" },
      custody: { id: "b1a2-fixture-custody", number: "222222222222" },
      fake: { id: "b1a2-fixture-fake", number: "333333333333" },
    },
    organizationMode: "ORG_ENFORCED",
    standaloneRiskReview: null,
    region: "us-central1",
    allowedApis: REQUIRED_APIS,
    quotas: { gatewayInstances: 2, workerInstances: 1, sqlConnections: 25 },
    names: {
      gateway: "b1a2-gateway",
      ingress: "b1a2-ingress",
      sealer: "b1a2-sealer",
      worker: "b1a2-worker",
      fake: "b1a2-fake",
      database: "b1a2-epoch",
      bucket: "b1a2-fixture-custody-evidence",
      network: "b1a2-run",
    },
    network: {
      gateway: "10.91.0.0/26",
      private: "10.91.1.0/26",
      fake: "10.92.0.0/26",
    },
    epochs: {
      old: 1,
      next: 2,
      oldRevision: "b1a2-gateway-e000001-r1",
      nextRevision: "b1a2-gateway-e000002-r1",
      oldTag: "b1a2-e000001",
      nextTag: "b1a2-e000002",
    },
    session: {
      id: "11111111-1111-4111-8111-111111111111",
      scopeId: "22222222-2222-4222-8222-222222222222",
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 21600000).toISOString(),
    },
    operators: Object.fromEntries(
      ["supervisor", "kill", "cleanup", "billing", "backup", "custodian"].map(
        (x) => [x, "synthetic:" + x],
      ),
    ),
    timing: {
      terminationTargetMs: 60000,
      canaryCount: 20,
      samplingIntervalMs: 60000,
      publicationLatencyMs: 120000,
      ownerApprovalRef: null,
    },
    images: {
      runtime: "fixture.invalid/b1a2@sha256:" + "1".repeat(64),
      fake: "fixture.invalid/b1a2@sha256:" + "1".repeat(64),
      approvalRef: "SYNTHETIC_ONLY",
    },
    budget: {
      billingAccountId: "000000-000000-000000",
      allocationUsd: "20.00",
      accountCurrency: "MXN",
      localPerUsd: "20.50",
      fxAsOf: now,
      fxValidUntil: now + 86400000,
      fxApprovalRef: "SYNTHETIC_FX_NOT_OWNER_APPROVAL",
    },
    optionalRestoreDrill: null,
  };
}
