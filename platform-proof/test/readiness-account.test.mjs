import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  accountReceiptTemplate,
  validateAccountReceipts,
  ACCOUNT_RECEIPT_SCHEMA,
} from "../b1a2/runtime/account-receipts.mjs";
import {
  syntheticInputs,
  ownerTemplate,
  validateInputs,
} from "../b1a2/runtime/inputs.mjs";
function fixture() {
  const now = Date.parse("2026-11-14T12:00Z"),
    c = syntheticInputs(now),
    r = accountReceiptTemplate();
  c.budget.allocationUsd = "30.00";
  c.optionalRestoreDrill = false;
  for (const key of Object.keys(c.operators))
    c.operators[key] = "synthetic:sole-operator";
  Object.assign(r, {
    provenance: {
      authorizationRef: "LOCAL_FIXTURE_NOT_ACCOUNT_ACCESS",
      capturedAt: now - 1,
      validUntil: now + 60000,
      sourceDigests: ["a".repeat(64)],
    },
    organization: {
      id: "123456789",
      policyAdminPrincipal: "synthetic:policy-admin",
      policyAdministrationVerified: true,
      allTrafficPolicyVerified: true,
      noVpcDeploymentDeniedVerified: true,
    },
    projects: Object.fromEntries(
      Object.entries(c.projects).map(([k, v]) => [
        k,
        { ...v, organizationId: "123456789" },
      ]),
    ),
    billing: {
      accountId: c.budget.billingAccountId,
      currency: "MXN",
      localPerUsd: c.budget.localPerUsd,
      fxAsOf: now - 1,
      fxValidUntil: now + 60000,
      fxOwnerApprovalRef: "LOCAL_FIXTURE_ONLY",
      trialExpiry: "2026-12-22T00:00:00Z",
      freeTrialEligibilityVerified: true,
      noAutomaticPaidUpgrade: true,
    },
    environment: {
      region: c.region,
      enabledApis: c.allowedApis,
      quotasVerified: true,
      skuAvailabilityVerified: true,
      sqlEdition: "ENTERPRISE",
      sqlTier: "db-f1-micro",
      sqlPscTlsRoleCompatibilityVerified: true,
      sqlConnectionLimit: 25,
      syntheticImageCandidate: "sha256:" + "1".repeat(64),
    },
    operator: {
      name: "Synthetic fixture operator",
      principal: "synthetic:sole-operator",
      singlePersonRiskAccepted: true,
      duties: ["supervisor", "kill", "cleanup", "billing", "custodian"],
      policyApprovalRef: "LOCAL_FIXTURE_ONLY",
    },
    technicalIdentities: Object.fromEntries(
      Object.entries({
        deployment: "deployer",
        kill: "kill",
        cleanup: "cleanup",
        custodyCleanup: "custodyCleanup",
      }).map(([k, v]) => [k, c.serviceIdentities[v]]),
    ),
    authority: {
      independentlyScopedKillVerified: true,
      independentlyScopedCleanupVerified: true,
      directOperatorAccessWithoutDeployerVerified: true,
      cleanupSurvivesExperimentDeletionVerified: true,
      manualBillingBudgetCleanupAccepted: true,
      permissionReceipts: ["b".repeat(64)],
    },
    window: {
      startsAt: c.session.startedAt,
      expiresAt: c.session.expiresAt,
      terminationTargetMs: 60000,
      allocationUsd: "30.00",
      noSpendAuthorizedByThisReceipt: true,
      independentExpiryHoldVerified: true,
      cleanupResponsibilitiesAccepted: true,
    },
    retention: {
      b1aPitrDays: 1,
      b1aRestoreDrill: false,
      b1bRestoreRequired: true,
    },
  });
  return { now, c, r };
}
test("G-3 offline account receipt template never grants readiness; published schema/template are exact and no account facts invented", async () => {
  const { now, c } = fixture();
  assert.equal(
    validateAccountReceipts(accountReceiptTemplate(), { inputs: c, now }).state,
    "HOLD",
  );
  const template = ownerTemplate();
  assert.equal(template.budget.allocationUsd, "30.00");
  assert.equal(template.organizationMode, "ORG_ENFORCED");
  assert.equal(template.optionalRestoreDrill, false);
  assert.equal(template.accountReceipts.operator.name, null);
  assert.throws(() =>
    validateInputs(template, { now, purpose: "PROVISIONING_PLAN" }),
  );
  for (const [file, value] of [
    ["account-receipts.schema.json", ACCOUNT_RECEIPT_SCHEMA],
    ["account-receipts.template.json", accountReceiptTemplate()],
  ])
    assert.deepEqual(
      JSON.parse(
        await readFile(
          new URL("../readiness/" + file, import.meta.url),
          "utf8",
        ),
      ),
      value,
    );
});
test("G-3 structurally valid simulated receipts retain runtime/account/cloud hold and separate technical identities despite one human", () => {
  const { now, c, r } = fixture(),
    out = validateAccountReceipts(r, { inputs: c, now });
  assert.equal(
    out.state,
    "OFFLINE_RECEIPTS_STRUCTURALLY_VALID",
    JSON.stringify(out),
  );
  for (const k of [
    "runtimeReady",
    "actualAccountVerified",
    "provisioningAuthorized",
  ])
    assert.equal(out[k], false);
});
test("G-3 missing account facts, invalid currency/FX, unknown keys, stale evidence, window and impersonation ambiguity hold", () => {
  const { now, c, r } = fixture();
  const cases = [
    (v) => delete v.operator.name,
    (v) => (v.billing.currency = "USD"),
    (v) => (v.billing.localPerUsd = "NaN"),
    (v) => (v.billing.localPerUsd = "19.00"),
    (v) => (v.billing.fxValidUntil = now),
    (v) => (v.provenance.validUntil = now),
    (v) => (v.organization.id = "invented"),
    (v) => (v.authority.directOperatorAccessWithoutDeployerVerified = false),
    (v) => (v.window.expiresAt = new Date(now + 21600001).toISOString()),
    (v) => (v.technicalIdentities.kill = v.technicalIdentities.deployment),
    (v) => (v.operator.principal = "synthetic:someone-else"),
    (v) => (v.environment.enabledApis = []),
    (v) => (v.retention.b1aPitrDays = 7),
    (v) => (v.retention.b1aRestoreDrill = true),
    (v) => (v.extra = "unexpected"),
  ];
  for (const change of cases) {
    const v = structuredClone(r);
    change(v);
    assert.equal(
      validateAccountReceipts(v, { inputs: c, now }).state,
      "HOLD",
      String(change),
    );
  }
});
