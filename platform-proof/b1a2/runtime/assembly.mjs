import { privateProofSql } from "./sql.mjs";
import { emitPreparation } from "./preparation.mjs";
import {
  readMounts,
  startComponent,
  validateStartup,
  callJson,
} from "./startup.mjs";
import { validateInputs } from "./inputs.mjs";
import { verifyServiceIdentity, ObserverSigner } from "./identity.mjs";
import { futureCloudTransport, LIVE_CLOUD_EXECUTION } from "./transport.mjs";
import { CloudApi } from "./cloud-api.mjs";
import { FakeEvidenceClient } from "./fake-client.mjs";
import { CustodyJournal, providerJournal } from "./journal.mjs";
import { IndependentObserver, CanaryScheduler } from "./observer.mjs";
import { startFakeProvider } from "./fake-provider.mjs";
import { prepareCloudSqlConfig } from "../../src/database-transport.mjs";
import pg from "pg";
/** Dependency-injected assembly is exercised with real local SQL/TLS/protocol
 * fixtures. The CLI cloud branch is compiled closed before all credential I/O. */
export async function assemble({
  mounts,
  role,
  inputs,
  identity,
  api,
  db,
  mode = "LOCAL_SIMULATION",
  now = Date.now,
  addresses = {},
  waker,
  journal,
}) {
  validateStartup({
    profile: mounts.profile,
    identity,
    role,
    inputs,
    now: now(),
  });
  if (role === "fake")
    return startFakeProvider({
      ...mounts.profile.provider,
      tls: mounts.tls,
      sessionId: inputs.session.id,
      scopeId: inputs.session.scopeId,
      ledger: await providerJournal(mounts.profile.ledgerFile, {
        checkpoint: mounts.profile.checkpoint,
      }),
      host: mode === "LOCAL_SIMULATION" ? "127.0.0.1" : "0.0.0.0",
      port: mode === "LOCAL_SIMULATION" ? 0 : 8443,
    });
  if (role === "observer") {
    const signer = new ObserverSigner({
      privateKey: mounts.observerSigningKey,
      sessionId: inputs.session.id,
      issuer: inputs.serviceIdentities.observer,
      now,
    });
    const fake = new FakeEvidenceClient({
      address: addresses.fake ?? mounts.profile.target,
      tls: mounts.tls,
      sessionId: inputs.session.id,
      mode,
      now,
    });
    const custody =
      journal ??
      new CustodyJournal({
        api,
        sessionId: inputs.session.id,
        allowNewSession: mounts.profile.freshSession === true,
      });
    await custody.load?.();
    const observer = new IndependentObserver({
      inputs,
      api,
      fake,
      signer,
      journal: custody,
      clockPolicy: mounts.profile.clockPolicy,
      now,
    });
    return {
      observer,
      signer,
      canaries: waker
        ? new CanaryScheduler({
            inputs,
            signer,
            waker,
            journal: custody,
            now,
            waitUntil: async (at) => {
              const delay = at - now();
              if (delay > 0) await new Promise((r) => setTimeout(r, delay));
            },
          })
        : null,
      async close() {
        await custody.snapshot();
      },
    };
  }
  const custody =
    role === "sealer"
      ? new CustodyJournal({
          api,
          sessionId: inputs.session.id,
          allowNewSession: mounts.profile.freshSession === true,
        })
      : undefined;
  const tokenFor = async (audience) => {
    const r = await api.metadataIdentity(audience);
    if (r.metadataFlavor !== "Google" || typeof r.value !== "string")
      throw Error("service_invocation_identity_unavailable");
    return r.value;
  };
  const callSealer =
    role === "ingress" && mode !== "LOCAL_SIMULATION"
      ? async (body) =>
          callJson({
            url: mounts.profile.sealerUrl,
            path: "/seal",
            body,
            key: mounts.callerKey,
            identityToken: await tokenFor(mounts.profile.sealerUrl),
          })
      : addresses.callSealer;
  return startComponent({
    role,
    mounts,
    identity,
    inputs,
    db,
    mode,
    custody,
    now,
    callSealer,
    gatewayAddress: addresses.gateway,
    host: mode === "LOCAL_SIMULATION" ? "127.0.0.1" : "0.0.0.0",
    port: mode === "LOCAL_SIMULATION" ? 0 : 8080,
    tokenFor,
  });
}
export async function mountedCloudMain({ role, directory = "/secrets" }) {
  if (!LIVE_CLOUD_EXECUTION)
    throw Error("cloud_execution_requires_reviewed_activation_change");
  const mounts = await readMounts(directory, role),
    inputs = validateInputs(mounts.profile.inputs, {
      purpose: "PROVISIONING_PLAN",
    }),
    transport = futureCloudTransport(),
    api = new CloudApi({ inputs, transport });
  const jwt = await api.metadataIdentity(mounts.profile.audience),
    keys = await api.googleSigningKeys();
  if (jwt.metadataFlavor !== "Google") throw Error("metadata_identity_flavor");
  const identity = verifyServiceIdentity({
    jwt: jwt.value,
    jwks: keys.value,
    audience: mounts.profile.audience,
    expectedEmail:
      inputs.serviceIdentities[
        role === "gateway"
          ? mounts.profile.epoch === inputs.epochs.old
            ? "gatewayOld"
            : "gatewayNext"
          : role
      ],
    expectedSubject: mounts.profile.identitySubject,
    now: Date.now(),
  });
  const db = ["gateway", "worker", "ingress", "sealer"].includes(role)
    ? new pg.Pool({ ...privateProofSql(mounts.database, { role }), max: 1 })
    : undefined;
  const app = await assemble({
    mounts,
    role,
    inputs,
    identity,
    api,
    db,
    mode: "CLOUD",
  });
  if (["gateway", "worker", "ingress", "sealer"].includes(role))
    await emitPreparation({ api, role, profile: mounts.profile, db });
  const close = async () => {
    await app.close();
    await db?.end();
  };
  process.once("SIGTERM", close);
  process.once("SIGINT", close);
  return app;
}
