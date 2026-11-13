import { createHash } from "node:crypto";
export const MODE = "INC1_LOCAL_SYNTHETIC_ONLY";
export function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(v)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
      .join(",") +
    "}"
  );
}
export const hash = (v) =>
  createHash("sha256")
    .update(typeof v === "string" || Buffer.isBuffer(v) ? v : canonical(v))
    .digest("hex");
export function id(v) {
  if (
    typeof v !== "string" ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v)
  )
    throw Error("proof_identity_invalid");
  return v;
}
export function endpoint(v) {
  if (
    !v ||
    v.host !== "127.0.0.1" ||
    !Number.isInteger(v.port) ||
    v.port < 1024 ||
    v.port > 65535 ||
    Object.keys(v).some((k) => !["host", "port"].includes(k))
  )
    throw Error("literal_loopback_endpoint_required");
  return { host: "127.0.0.1", port: v.port };
}
export function database(v) {
  dbEndpoint(v);
  if (
    Object.keys(v).some(
      (k) => !["host", "port", "database", "user", "password"].includes(k),
    ) ||
    !/^inc1_[a-f0-9]{16}$/.test(v.database) ||
    !["inc1_gateway", "inc1_worker", "postgres"].includes(v.user) ||
    typeof v.password !== "string" ||
    !v.password
  )
    throw Error("independent_inc1_database_required");
  return {
    ...v,
    max: 2,
    ssl: false,
    options: "-c timezone=UTC",
    connectionTimeoutMillis: 2000,
    statement_timeout: 3000,
  };
}
export function dbEndpoint(v) {
  return endpoint({ host: v.host, port: v.port });
}
export function exact(v, keys) {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).length !== keys.length ||
    !keys.every((k) => Object.hasOwn(v, k))
  )
    throw Error("proof_schema");
  return v;
}
export function beforeDeadline(deadline) {
  if (!Number.isFinite(deadline) || Date.now() >= deadline)
    throw Error("effect_deadline");
}
