const revision = (v) =>
  typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,62}$/.test(v);
/** The certificate map is configuration, not a source of new authority. Every
 * gateway entry must equal an independently approved epoch/revision pair. */
export function validateProviderIdentities(identities, expectedGateways) {
  if (
    !identities ||
    typeof identities !== "object" ||
    Array.isArray(identities) ||
    !Object.keys(identities).length ||
    Object.keys(identities).length > 8 ||
    !Array.isArray(expectedGateways) ||
    !expectedGateways.length ||
    expectedGateways.some(
      (v) =>
        !Number.isSafeInteger(v?.epoch) || v.epoch < 1 || !revision(v.revision),
    )
  )
    throw Error("approved_provider_identity_map_required");
  for (const [fingerprint, v] of Object.entries(identities)) {
    if (
      !/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(fingerprint) ||
      !v ||
      !["gateway", "observer"].includes(v.role)
    )
      throw Error("provider_certificate_identity_invalid");
    if (
      v.role === "gateway" &&
      (!Number.isSafeInteger(v.epoch) ||
        v.epoch < 1 ||
        !revision(v.revision) ||
        !expectedGateways.some(
          (e) => e.epoch === v.epoch && e.revision === v.revision,
        ))
    )
      throw Error("provider_gateway_epoch_revision_mismatch");
    if (v.role === "observer" && (v.epoch != null || v.revision != null))
      throw Error("observer_must_not_impersonate_gateway");
    if (Object.keys(v).some((k) => !["role", "epoch", "revision"].includes(k)))
      throw Error("unsupported_provider_identity_field");
  }
  return structuredClone(identities);
}
