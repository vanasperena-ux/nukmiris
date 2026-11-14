import { isIP } from "node:net";
import { verifiedPostgresTls } from "../../src/database-transport.mjs";
const users = {
  gateway: "inc1_gateway",
  worker: "inc1_worker",
  ingress: "inc1_ingress",
  sealer: "inc1_sealer",
  controller: "inc1_controller",
};
export function privateProofSql(config, { role, installer = false } = {}) {
  const v = config,
    keys = ["host", "port", "database", "user", "password", "ca", "servername"];
  const parts =
    typeof v?.host === "string" ? v.host.split(".").map(Number) : [];
  const privateAddress =
    isIP(v?.host ?? "") === 4 &&
    (parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168));
  if (
    !v ||
    Object.keys(v).length !== keys.length ||
    !keys.every((k) => Object.hasOwn(v, k)) ||
    !privateAddress ||
    v.port !== 5432 ||
    !/^inc1_[a-f0-9]{16}$/.test(v.database) ||
    v.user !== (installer ? "postgres" : users[role]) ||
    typeof v.password !== "string" ||
    !v.password ||
    (!installer && !users[role])
  )
    throw Error("restricted_private_proof_sql_required");
  return {
    host: v.host,
    port: v.port,
    database: v.database,
    user: v.user,
    password: v.password,
    ssl: verifiedPostgresTls(v),
    options: "-c timezone=UTC",
    max: 1,
    connectionTimeoutMillis: 2000,
    statement_timeout: 3000,
  };
}
