import { X509Certificate, createPrivateKey } from "node:crypto";
import { isIP } from "node:net";
import { prepareCloudSqlConfig } from "../../src/database-transport.mjs";
import { id, endpoint } from "../../src/protocol.mjs";
const databases = new WeakMap(),
  targets = new WeakMap(),
  profiles = new WeakMap();
function certificateIdentity({ cert, key, ca, servername }) {
  const client = new X509Certificate(cert),
    privateKey = createPrivateKey(key);
  if (
    !client.checkPrivateKey(privateKey) ||
    client.ca ||
    !ca ||
    !servername ||
    isIP(servername) ||
    !/^[a-z0-9.-]+$/i.test(servername) ||
    Date.parse(client.validTo) <= Date.now() ||
    Date.parse(client.validFrom) > Date.now()
  )
    throw Error("synthetic_mutual_tls_identity_required");
  return Object.freeze({
    cert,
    key,
    ca,
    servername,
    rejectUnauthorized: true,
    minVersion: "TLSv1.3",
  });
}
/** Pure, privileged bootstrap builder. It opens no sockets/SDKs and reads no ADC.
 * Input is future owner-approved inventory + secret mounts, NEVER HTTP input.
 * No metadata-server credential loading or default provider fallback exists.
 */
export function prepareSyntheticProfile(v) {
  if (
    v?.mode !== "B1A_SYNTHETIC_PREPARATION" ||
    v.approvedFakeHost !== v.target?.host ||
    isIP(v.approvedFakeHost) !== 4 ||
    v.target.port !== 443 ||
    !v.controlSessionId ||
    v.database?.user !== "inc1_gateway"
  )
    throw Error("bounded_cloud_synthetic_profile_required");
  id(v.controlSessionId);
  const ip = v.approvedFakeHost.split(".").map(Number);
  if (
    ip[0] === 0 ||
    ip[0] === 10 ||
    ip[0] === 127 ||
    ip[0] >= 224 ||
    (ip[0] === 169 && ip[1] === 254) ||
    (ip[0] === 192 && ip[1] === 168) ||
    (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31)
  )
    throw Error("allocated_fake_public_ipv4_required");
  const db = Object.freeze(prepareCloudSqlConfig(v.database)),
    tls = certificateIdentity(v.tls),
    target = Object.freeze({ host: v.approvedFakeHost, port: 443 });
  databases.set(db, db);
  targets.set(target, Object.freeze({ ...target, ...tls }));
  const profile = Object.freeze({
    mode: v.mode,
    database: db,
    target,
    controlSessionId: v.controlSessionId,
  });
  profiles.set(profile, true);
  return profile;
}
export function preparedDatabase(v) {
  return databases.get(v);
}
export function preparedTarget(v) {
  return targets.get(v);
}
export function preparedProfile(v) {
  return profiles.has(v);
}
/** Runtime-generated loopback TLS fixture only; no private/non-loopback target.
 * It cannot mint a cloud-profile or permit a private SQL connection.
 */
export function prepareLocalMutualTlsTarget(target, tls) {
  const to = Object.freeze(endpoint(target));
  targets.set(to, Object.freeze({ ...to, ...certificateIdentity(tls) }));
  return to;
}
