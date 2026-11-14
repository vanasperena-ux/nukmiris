/** Dependency-safe exact inventory removal. IAM/key metadata are tracked to
 * closure; nondeletable KMS rings must be residuals, never claimed removed. */
export function teardownInventory(manifest) {
  const nodes = new Map(manifest.inventory.map((v) => [v.address, v]));
  const order = [],
    seen = new Set(),
    visiting = new Set();
  const visit = (key) => {
    if (seen.has(key)) return;
    if (visiting.has(key)) throw Error("inventory_dependency_cycle " + key);
    visiting.add(key);
    const v = nodes.get(key);
    for (const d of v.dependencies) if (nodes.has(d)) visit(d);
    visiting.delete(key);
    seen.add(key);
    order.push(v);
  };
  for (const key of nodes.keys()) visit(key);
  return order.reverse().map((v, i) => ({
    ...v,
    sequence: i + 1,
    mode: "PRINT_ONLY_OR_LOCAL_SIMULATION",
    command: ["B1A2_DELETE_EXACT", v.type, v.project, v.name, v.address],
    preconditions: [
      "SQL dispatch durably held",
      "All epochs fenced and retirement verified",
      "Approved independent evidence export",
      "Exact resource read-back identity matches inventory",
    ],
    requiredAuthority: v.cleanupRole,
    successEvidence: v.retention.startsWith("NON_DELETABLE")
      ? "Residual metadata accepted only by separately authorized project disposal; key versions scheduled destroyed"
      : "API deletion receipt AND subsequent exact-resource absence; missing permission remains HOLD",
    onAmbiguity: "HOLD exact original resource; never guess or wildcard-delete",
  }));
}
export async function simulateTeardown({ manifest, journal, adapter }) {
  if (adapter.mode !== "LOCAL_SIMULATION") throw Error("local_teardown_only");
  const residuals = [];
  for (const item of teardownInventory(manifest)) {
    await journal.append({
      event: "TEARDOWN_INTENT",
      address: item.address,
      command: item.command,
    });
    if (item.retention.startsWith("NON_DELETABLE")) {
      if (item.type === "google_kms_crypto_key") {
        const retired = await adapter.retireKeyVersions?.(item);
        if (retired?.state !== "VERSIONS_RETIRED")
          return {
            state: "HOLD",
            address: item.address,
            reason: "key_versions_not_retired",
            residuals,
          };
        await journal.append({
          event: "KEY_VERSIONS_RETIRED",
          address: item.address,
          receipt: retired,
        });
      }
      residuals.push({
        address: item.address,
        state: "RESIDUAL_NON_DELETABLE_METADATA",
        incursActiveKeyCostUntilDestroyed: true,
      });
      continue;
    }
    const r = await adapter.removeExact(item);
    if (r?.identity !== item.address || r.state !== "ABSENT")
      return { state: "HOLD", address: item.address, residuals };
    await journal.append({
      event: "TEARDOWN_ABSENCE",
      address: item.address,
      receipt: r,
    });
  }
  return {
    state: residuals.length
      ? "REMOVABLE_INVENTORY_CLEARED_METADATA_RESIDUALS"
      : "CLEARED",
    residuals,
    followup: [
      "+2h billing/resource check",
      "+48h resource/billing check",
      "next statement check",
    ],
    automaticRecreation: false,
  };
}
