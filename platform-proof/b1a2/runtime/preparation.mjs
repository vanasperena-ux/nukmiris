import { hash } from "../../src/protocol.mjs";
import { verifyServiceIdentity } from "./identity.mjs";
import { validateStartup } from "./startup.mjs";
import { receiptData } from "./transport.mjs";
export const preparationAudience = (p) =>
  "https://b1a2-attestation.invalid/" +
  p.sessionId +
  "/" +
  p.role +
  "/" +
  hash(p);
/** Public, purpose-bound startup attestation. This JWT audience cannot authorize
 * a Run invocation or provider effect. The independent collector checks the
 * approved public profile, exact SA/subject, image and current experiment. */
export async function emitPreparation({
  api,
  role,
  profile,
  db,
  emit = console.log,
}) {
  if (["gateway", "worker", "ingress", "sealer"].includes(role)) {
    const r = await db.query("SELECT current_user identity");
    if (r.rows[0].identity !== "inc1_" + role)
      throw Error("prepared_database_role_mismatch");
    await db.query("SELECT proof.runtime_ready($1,$2,$3,$4)", [
      profile.sessionId,
      profile.scopeId,
      profile.epoch,
      profile.revision,
    ]);
  }
  const actual =
    role === "worker" ? process.env.CLOUD_RUN_REVISION : process.env.K_REVISION;
  if (actual !== profile.deploymentRevision)
    throw Error("stale_actual_deployment_revision");
  const r = await api.metadataIdentity(preparationAudience(profile));
  if (r.metadataFlavor !== "Google" || typeof r.value !== "string")
    throw Error("prepared_identity_unavailable");
  emit(
    JSON.stringify({
      event: "B1A2_PREPARED",
      role,
      sessionId: profile.sessionId,
      profileDigest: hash(profile),
      attestationJwt: r.value,
    }),
  );
}
export async function collectPreparation({
  api,
  inputs,
  profiles,
  journal,
  now = Date.now,
  mode = "CLOUD",
}) {
  const keys = await api.googleSigningKeys(),
    caps = [];
  for (const role of ["gateway", "worker", "ingress", "sealer"]) {
    const p = profiles[role];
    if (!p || p.role !== role) throw Error("approved_public_profile_required");
    const cfg = await api.component(role);
    if (
      !receiptData(cfg) ||
      cfg.value.template?.serviceAccount !==
        inputs.serviceIdentities[role === "gateway" ? "gatewayOld" : role] ||
      cfg.value.template?.containers?.[0]?.image !== p.image ||
      cfg.value.template?.revision?.split("/").at(-1) !== p.deploymentRevision
    )
      throw Error("actual_prepared_resource_mismatch");
    const r = await api.preparationLogs(role);
    if (
      !receiptData(r) ||
      r.status !== 200 ||
      r.value?.nextPageToken ||
      !Array.isArray(r.value?.entries)
    )
      throw Error("complete_preparation_log_required");
    const matches = r.value.entries
      .map((v) => v.jsonPayload)
      .filter(
        (v) =>
          v?.event === "B1A2_PREPARED" &&
          v.sessionId === inputs.session.id &&
          v.role === role &&
          v.profileDigest === hash(p),
      );
    const unique = [...new Set(matches.map((v) => v.attestationJwt))];
    if (unique.length !== 1)
      throw Error("missing_or_conflicting_preparation_attestation");
    const audience = preparationAudience(p),
      identity = verifyServiceIdentity({
        jwt: unique[0],
        jwks: keys.value,
        audience,
        expectedEmail:
          inputs.serviceIdentities[role === "gateway" ? "gatewayOld" : role],
        expectedSubject: p.identitySubject,
        now: now(),
        mode,
      });
    const cap = validateStartup({
      profile: { ...p, audience },
      identity,
      role,
      inputs,
      now: now(),
    });
    caps.push(cap);
    await journal.append({
      event: "INDEPENDENT_PREPARATION_VERIFIED",
      role,
      sessionId: inputs.session.id,
      publicProfileDigest: hash(p),
      rawLogDigest: r.rawDigest,
      attestationDigest: hash(unique[0]),
      at: now(),
    });
  }
  return caps;
}
