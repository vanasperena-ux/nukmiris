import { hash } from "../../src/protocol.mjs";
const text = { type: "string", minLength: 1 },
  digest = { type: "string", pattern: "^[a-f0-9]{64}$" };
const object = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const list = (items) => ({
  type: "array",
  items,
  minItems: 1,
  uniqueItems: true,
});
const yes = { const: true },
  accountId = {
    type: "string",
    pattern: "^[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{6}$",
  };
const project = object({
  id: text,
  number: { type: "string", pattern: "^[1-9][0-9]{11}$" },
  organizationId: text,
});
export const ACCOUNT_RECEIPT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  ...object({
    schema: { const: "B1A_READ_ONLY_ACCOUNT_RECEIPTS_V1" },
    provenance: object({
      authorizationRef: text,
      capturedAt: { type: "number" },
      validUntil: { type: "number" },
      sourceDigests: list(digest),
    }),
    organization: object({
      id: { type: "string", pattern: "^[1-9][0-9]{5,19}$" },
      policyAdminPrincipal: text,
      policyAdministrationVerified: yes,
      allTrafficPolicyVerified: yes,
      noVpcDeploymentDeniedVerified: yes,
    }),
    projects: object({ runtime: project, custody: project, fake: project }),
    billing: object({
      accountId,
      currency: { const: "MXN" },
      localPerUsd: { type: "string", pattern: "^[1-9][0-9]*(\\.[0-9]{1,6})?$" },
      fxAsOf: { type: "number" },
      fxValidUntil: { type: "number" },
      fxOwnerApprovalRef: text,
      trialExpiry: text,
      freeTrialEligibilityVerified: yes,
      noAutomaticPaidUpgrade: yes,
    }),
    environment: object({
      region: { const: "us-central1" },
      enabledApis: list(text),
      quotasVerified: yes,
      skuAvailabilityVerified: yes,
      sqlEdition: { const: "ENTERPRISE" },
      sqlTier: { enum: ["db-f1-micro", "db-g1-small"] },
      sqlPscTlsRoleCompatibilityVerified: yes,
      sqlConnectionLimit: { type: "integer", minimum: 13, maximum: 25 },
      syntheticImageCandidate: {
        type: "string",
        pattern: "^sha256:[a-f0-9]{64}$",
      },
    }),
    operator: object({
      name: text,
      principal: text,
      singlePersonRiskAccepted: yes,
      duties: list({
        enum: ["supervisor", "kill", "cleanup", "billing", "custodian"],
      }),
      policyApprovalRef: text,
    }),
    technicalIdentities: object({
      deployment: text,
      kill: text,
      cleanup: text,
      custodyCleanup: text,
    }),
    authority: object({
      independentlyScopedKillVerified: yes,
      independentlyScopedCleanupVerified: yes,
      directOperatorAccessWithoutDeployerVerified: yes,
      cleanupSurvivesExperimentDeletionVerified: yes,
      manualBillingBudgetCleanupAccepted: yes,
      permissionReceipts: list(digest),
    }),
    window: object({
      startsAt: text,
      expiresAt: text,
      terminationTargetMs: { const: 60000 },
      allocationUsd: { const: "30.00" },
      noSpendAuthorizedByThisReceipt: yes,
      independentExpiryHoldVerified: yes,
      cleanupResponsibilitiesAccepted: yes,
    }),
    retention: object({
      b1aPitrDays: { const: 1 },
      b1aRestoreDrill: { const: false },
      b1bRestoreRequired: yes,
    }),
  }),
};

function errors(schema, value, path = "$") {
  const out = [],
    bad = () => out.push(path);
  if (Object.hasOwn(schema, "const") && value !== schema.const) bad();
  if (schema.enum && !schema.enum.includes(value)) bad();
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return [path];
    for (const k of schema.required)
      if (!Object.hasOwn(value, k)) out.push(path + "." + k);
    for (const [k, v] of Object.entries(value)) {
      if (!schema.properties[k]) {
        if (schema.additionalProperties === false) out.push(path + "." + k);
      } else out.push(...errors(schema.properties[k], v, path + "." + k));
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return [path];
    if (
      value.length < schema.minItems ||
      (schema.uniqueItems && new Set(value.map(hash)).size !== value.length)
    )
      bad();
    value.forEach((v, i) =>
      out.push(...errors(schema.items, v, path + "[" + i + "]")),
    );
  } else if (schema.type) {
    if (
      (schema.type === "integer"
        ? !Number.isSafeInteger(value)
        : typeof value !== schema.type) ||
      (typeof value === "number" &&
        (!Number.isFinite(value) ||
          value < (schema.minimum ?? -Infinity) ||
          value > (schema.maximum ?? Infinity))) ||
      (typeof value === "string" &&
        (value.length < (schema.minLength ?? 0) ||
          (schema.pattern && !new RegExp(schema.pattern).test(value))))
    )
      bad();
  }
  return out;
}
/** Offline structure/coherence only. These data are not authenticated cloud
 * receipts merely because an operator supplied JSON or true-valued fields. */
export function validateAccountReceipts(v, { inputs, now = Date.now() } = {}) {
  const invalid = errors(ACCOUNT_RECEIPT_SCHEMA, v);
  const hold = (reason) => ({
    state: "HOLD",
    reason,
    invalidFields: [...new Set(invalid)],
    runtimeReady: false,
    actualAccountVerified: false,
    provisioningAuthorized: false,
  });
  if (invalid.length || !inputs)
    return hold("mandatory_owner_account_receipts_missing_or_invalid");
  if (
    v.provenance.capturedAt > now ||
    v.provenance.validUntil <= now ||
    v.provenance.validUntil - v.provenance.capturedAt > 86400000 ||
    v.billing.fxAsOf > now ||
    v.billing.fxValidUntil <= now ||
    v.billing.fxValidUntil - v.billing.fxAsOf > 86400000 ||
    Date.parse(v.billing.trialExpiry) <= now ||
    !Number.isFinite(Date.parse(v.billing.trialExpiry))
  )
    return hold("account_or_fx_receipts_stale");
  const start = Date.parse(v.window.startsAt),
    end = Date.parse(v.window.expiresAt);
  if (
    ![start, end].every(Number.isFinite) ||
    end <= start ||
    end - start > 21600000 ||
    end <= now ||
    start !== Date.parse(inputs.session.startedAt) ||
    end !== Date.parse(inputs.session.expiresAt) ||
    inputs.timing.terminationTargetMs !== 60000 ||
    inputs.budget.allocationUsd !== "30.00" ||
    inputs.optionalRestoreDrill !== false ||
    end > Date.parse("2026-12-17T23:59:59Z") ||
    end > Date.parse(v.billing.trialExpiry)
  )
    return hold("account_session_window_invalid");
  if (
    inputs.organizationMode !== "ORG_ENFORCED" ||
    !["runtime", "custody", "fake"].every(
      (k) =>
        v.projects[k].id === inputs.projects[k].id &&
        v.projects[k].number === inputs.projects[k].number &&
        v.projects[k].organizationId === v.organization.id,
    ) ||
    !inputs.allowedApis.every((k) => v.environment.enabledApis.includes(k)) ||
    v.billing.accountId !== inputs.budget.billingAccountId ||
    v.billing.localPerUsd !== inputs.budget.localPerUsd ||
    v.billing.currency !== inputs.budget.accountCurrency ||
    v.environment.sqlConnectionLimit !== inputs.quotas.sqlConnections
  )
    return hold("account_scope_currency_or_api_mismatch");
  if (
    new Set(Object.values(v.technicalIdentities)).size !== 4 ||
    !Object.entries({
      deployment: "deployer",
      kill: "kill",
      cleanup: "cleanup",
      custodyCleanup: "custodyCleanup",
    }).every(
      ([k, role]) =>
        v.technicalIdentities[k] === inputs.serviceIdentities[role],
    ) ||
    !["supervisor", "kill", "cleanup", "billing", "custodian"].every(
      (k) =>
        v.operator.duties.includes(k) &&
        inputs.operators[k] === v.operator.principal,
    )
  )
    return hold("separate_technical_authority_and_sole_operator_required");
  return {
    state: "OFFLINE_RECEIPTS_STRUCTURALLY_VALID",
    inputDigest: hash(v),
    runtimeReady: false,
    actualAccountVerified: false,
    provisioningAuthorized: false,
    remaining: [
      "authenticated account verification under separate authorization",
      "registry digest approval",
      "cloud-only proofs",
      "resource-specific owner authorization",
    ],
  };
}
export function accountReceiptTemplate() {
  const blank = (s) =>
    s.type === "object"
      ? Object.fromEntries(
          Object.entries(s.properties).map(([k, v]) => [k, blank(v)]),
        )
      : s.type === "array"
        ? []
        : Object.hasOwn(s, "const") && ![true].includes(s.const)
          ? s.const
          : null;
  return blank(ACCOUNT_RECEIPT_SCHEMA);
}
