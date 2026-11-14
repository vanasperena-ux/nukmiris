import { teardownInventory } from "../b1a2/ops/teardown.mjs";

/** An independent entry point must not require a deployer credential or grants
 * merely to construct its controller. Each command still checks exact grants.
 * No new commands or executor are introduced, and live execution stays closed. */
export function independentAuthorityPlan(plan, kind) {
  const roles =
    kind === "KILL"
      ? ["kill"]
      : kind === "CLEANUP"
        ? ["cleanup", "custodyCleanup"]
        : null;
  if (!roles || plan.liveExecutionEnabled !== false)
    throw Error("exact_local_authority_plan_required");
  const principals = roles.map((k) => plan.inputs.serviceIdentities[k]);
  const select = (rows) => rows.filter((v) => principals.includes(v.principal));
  const commands =
    kind === "KILL"
      ? [
          ...select(plan.commands).filter((v) =>
            ["deny", "secret", "decrypt", "delete"].includes(v.semantic),
          ),
          ...select(plan.emergency),
        ]
      : select(plan.teardown);
  if (!commands.length) throw Error("independent_authority_commands_missing");
  return {
    ...plan,
    commands: [],
    access: [],
    emergency: kind === "KILL" ? commands : [],
    teardown: kind === "CLEANUP" ? commands : [],
    grants: plan.grants.filter((g) => principals.includes(g.principal)),
    isolation: {
      humanCount: 1,
      separateTechnicalPrincipals: true,
      independentHumans: false,
      deploymentCredentialRequired: false,
      authority: kind,
    },
  };
}
export function cleanupReceiptChecklist(manifest) {
  return teardownInventory(manifest).map((v) => ({
    address: v.address,
    type: v.type,
    project: v.project,
    sequence: v.sequence,
    requiredAuthority: v.requiredAuthority,
    originalResourceId: null,
    independentReadReceipt: null,
    deletionReceipt: null,
    status: "NOT_EXECUTED",
    successEvidence: v.successEvidence,
    retention: v.retention,
    manualBillingAccountAction: v.type === "google_billing_budget",
    reviewAt: ["after cleanup", "+2h", "+48h", "billing statement"],
  }));
}
