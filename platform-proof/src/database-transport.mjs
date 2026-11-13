import { isIP } from "node:net";
import { X509Certificate } from "node:crypto";

/** Pure configuration builder; this module never opens a connection or loads ADC. */
export function verifiedPostgresTls({ ca, servername }) {
  if (
    typeof ca !== "string" ||
    ca.length > 32768 ||
    typeof servername !== "string" ||
    !/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(servername) ||
    isIP(servername)
  )
    throw Error("verified_sql_ca_and_dns_name_required");
  // Parse every supplied PEM certificate. No private keys, URLs, implicit
  // system trust downgrade, rejectUnauthorized override or sslmode fallback.
  const blocks = ca.match(
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
  );
  if (
    !blocks?.length ||
    blocks.join("").replace(/\s/g, "") !== ca.replace(/\s/g, "")
  )
    throw Error("verified_sql_ca_required");
  for (const pem of blocks) {
    const cert = new X509Certificate(pem);
    if (!cert.ca) throw Error("sql_ca_certificate_required");
  }
  return Object.freeze({
    ca,
    servername,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  });
}

/** Cloud SQL preparation only. A privileged, opaque synthetic
 * profile can consume this config; live cloud bootstrap remains gated.
 * Private-IP allowlisting is not substituted for certificate identity checking.
 */
export function prepareCloudSqlConfig(v) {
  const keys = [
    "host",
    "port",
    "database",
    "user",
    "password",
    "ca",
    "servername",
  ];
  if (
    !v ||
    Object.keys(v).length !== keys.length ||
    !keys.every((k) => Object.hasOwn(v, k)) ||
    !privateIp(v.host) ||
    v.port !== 5432 ||
    !/^inc1_[a-f0-9]{16}$/.test(v.database) ||
    !["inc1_gateway", "inc1_worker"].includes(v.user) ||
    typeof v.password !== "string" ||
    !v.password
  )
    throw Error("bounded_synthetic_cloud_sql_configuration_required");
  return {
    host: v.host,
    port: v.port,
    database: v.database,
    user: v.user,
    password: v.password,
    ssl: verifiedPostgresTls(v),
    max: 2,
    options: "-c timezone=UTC",
    connectionTimeoutMillis: 2000,
    statement_timeout: 3000,
  };
}
function privateIp(host) {
  if (isIP(host) !== 4) return false;
  const [a, b] = host.split(".").map(Number);
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
}
