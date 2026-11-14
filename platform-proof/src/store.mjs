import pg from "pg";
import { randomUUID } from "node:crypto";
import { database, hash, id } from "./protocol.mjs";
import { preparedDatabase } from "../b1a/runtime/profile.mjs";
export class GatewayStore {
  constructor(config, { sessionId, entryVersion = 1 } = {}) {
    if (sessionId !== undefined) id(sessionId);
    this.sessionId = sessionId;
    this.entryVersion = entryVersion;
    this.pool = new pg.Pool(preparedDatabase(config) ?? database(config));
    this.pool.on("error", () => {});
    this.pool.on("connect", (client) => client.on("error", () => {}));
  }
  async enter(scopeId, attemptId, epoch, revision, hook) {
    id(scopeId);
    id(attemptId);
    const ownerId = randomUUID(),
      db = await this.pool.connect();
    let value,
      released = false;
    try {
      await db.query("BEGIN");
      await hook("beforeAuthority", attemptId);
      value = (
        await db.query(
          this.sessionId
            ? this.entryVersion === 2
              ? "SELECT proof.enter_b1a2($1,$2,$3,$4,$5,$6) v"
              : "SELECT proof.enter_b1a($1,$2,$3,$4,$5,$6) v"
            : "SELECT proof.enter($1,$2,$3,$4,$5) v",
          [
            ...(this.sessionId ? [this.sessionId] : []),
            scopeId,
            attemptId,
            ownerId,
            epoch,
            revision,
          ],
        )
      ).rows[0].v;
      await hook("beforeCommit", attemptId);
      const completion = await db.query("COMMIT");
      // PostgreSQL can answer COMMIT with a ROLLBACK command tag for an aborted
      // transaction. A resolved query alone must never create effect authority.
      if (completion.command !== "COMMIT") throw Error("commit_not_confirmed");
      // Sole permission-creating continuation. No serialized/recoverable ticket.
      if (!value.entered) return { state: value.state };
      await hook("afterCommit", attemptId);
      let unused = true;
      return {
        state: "PERMIT_IN_PROCESS",
        binding: value,
        ownerId,
        consume() {
          if (!unused) throw Error("one_use_continuation_consumed");
          unused = false;
          if (hash(value.payload) !== value.payloadDigest)
            throw Error("stored_binding_invalid");
          return value;
        },
      };
    } catch (e) {
      await db.query("ROLLBACK").catch(() => {});
      db.release(e);
      released = true;
      const recovery = await this.unknown(attemptId, ownerId);
      return {
        state: "UNKNOWN",
        reason: "commit_or_continuation_uncertain",
        recovery,
      };
    } finally {
      if (!released) db.release();
    }
  }
  async unknown(a, o) {
    try {
      return (
        await this.pool.query("SELECT proof.finish($1,$2,false) state", [a, o])
      ).rows[0].state;
    } catch (e) {
      return "HELD_DATABASE_UNAVAILABLE_" + (e.code || "transport");
    }
  }
  async applied(a, o) {
    const v = await this.pool.query("SELECT proof.finish($1,$2,true) v", [
      a,
      o,
    ]);
    return v.rows[0].v;
  }
  async close() {
    await this.pool.end();
  }
}
