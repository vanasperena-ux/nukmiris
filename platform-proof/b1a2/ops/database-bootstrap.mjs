import pg from "pg";
import { readFile } from "node:fs/promises";
import { LIVE_CLOUD_EXECUTION } from "../runtime/transport.mjs";
import { database } from "../../src/protocol.mjs";
import { privateProofSql } from "../runtime/sql.mjs";
/** One fresh disposable database, explicit operator credentials, never runtime.
 * No DROP, migration, repair of an existing schema, ADC, IAM fallback or network
 * discovery. In cloud mode the source gate is checked before pool creation. */
export async function bootstrapDatabase({
  config,
  logins,
  mode = "LOCAL_SIMULATION",
  expectedDatabase,
  session,
}) {
  if (mode !== "LOCAL_SIMULATION" && !LIVE_CLOUD_EXECUTION)
    throw Error("cloud_execution_requires_reviewed_activation_change");
  if (
    !session?.id ||
    Date.parse(session.expiresAt) <= Date.now() ||
    config?.database !== expectedDatabase ||
    !expectedDatabase ||
    config.user !== "postgres"
  )
    throw Error("explicit_disposable_bootstrap_authority_required");
  const roles = [
    "inc1_gateway",
    "inc1_worker",
    "inc1_ingress",
    "inc1_sealer",
    "inc1_controller",
  ];
  if (!logins || roles.some((r) => !/^[a-f0-9]{48}$/.test(logins[r] ?? "")))
    throw Error("fresh_role_mounts_required");
  const pool = new pg.Pool({
    ...(mode === "LOCAL_SIMULATION"
      ? database(config)
      : privateProofSql(config, { installer: true })),
    max: 1,
  });
  const db = await pool.connect();
  try {
    const existing = await db.query(
      "SELECT to_regnamespace('proof') AS schema, EXISTS(SELECT FROM pg_roles WHERE rolname=ANY($1::text[])) AS roles",
      [roles],
    );
    if (existing.rows[0].schema || existing.rows[0].roles)
      throw Error("existing_proof_database_or_roles_held");
    await db.query("BEGIN");
    await db.query(
      await readFile(new URL("../../src/schema.sql", import.meta.url), "utf8"),
    );
    await db.query(
      await readFile(new URL("../../b1a/schema.sql", import.meta.url), "utf8"),
    );
    await db.query(
      await readFile(new URL("../schema.sql", import.meta.url), "utf8"),
    );
    for (const role of roles)
      await db.query("ALTER ROLE " + role + " PASSWORD '" + logins[role] + "'");
    await db.query("COMMIT");
    return {
      state: "FRESH_SYNTHETIC_SQL_READY",
      database: expectedDatabase,
      sessionId: session.id,
      dispatchEnabled: false,
      administratorRemainsSeparate: true,
    };
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
    await pool.end();
  }
}
