import { hash, id } from "../../src/protocol.mjs";
/** Synthetic platform ports only: no accepted application code/data is imported. */
export class SyntheticAdmission {
  constructor({ ingressDb, callSealer, timeoutMs = 1000 }) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2000)
      throw Error("bounded_sealer_deadline_required");
    this.db = ingressDb;
    this.callSealer = callSealer;
    this.timeoutMs = timeoutMs;
  }
  async admit({ scopeId, batchId, payload }) {
    id(scopeId);
    id(batchId);
    const digest = hash(payload);
    await this.db.query("SELECT proof.admission_stage($1,$2,$3,$4)", [
      scopeId,
      batchId,
      digest,
      payload,
    ]);
    let timer;
    const abort = new AbortController();
    try {
      await Promise.race([
        this.callSealer({ scopeId, batchId }, { signal: abort.signal }),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            abort.abort();
            reject(Error("sealer_deadline"));
          }, this.timeoutMs);
        }),
      ]);
    } catch {
      return {
        ack: false,
        status: 503,
        reason: "SEALER_UNAVAILABLE_OR_UNCERTAIN",
        batchId,
      };
    } finally {
      clearTimeout(timer);
    }
    const result = await this.db.query(
      "SELECT proof.admission_status($1,$2) value",
      [scopeId, batchId],
    );
    const row = result.rows[0].value;
    return row?.state === "ELIGIBLE" && row.digest === digest
      ? { ack: true, status: 200, batchId }
      : {
          ack: false,
          status: 503,
          reason: "DURABLE_SEAL_NOT_VERIFIED",
          batchId,
        };
  }
}
export class SyntheticSealer {
  constructor({ sealerDb, ledger }) {
    this.db = sealerDb;
    this.ledger = ledger;
  }
  async seal({ scopeId, batchId }) {
    id(scopeId);
    id(batchId);
    // Read the independently committed SQL batch under the sealer's own role;
    // never accept a caller digest or caller-supplied batch contents as truth.
    const result = await this.db.query(
        "SELECT proof.admission_sealer_read($1,$2) value",
        [scopeId, batchId],
      ),
      row = result.rows[0].value;
    if (!row || hash(row.payload) !== row.digest)
      throw Error("committed_batch_not_verified");
    const record = await this.ledger.append({
      event: "SYNTHETIC_ADMISSION_SEAL",
      scopeId,
      batchId,
      digest: row.digest,
      at: Date.now(),
    });
    await this.db.query("SELECT proof.admission_seal($1,$2,$3,$4)", [
      scopeId,
      batchId,
      row.digest,
      record.hash,
    ]);
    return { batchId, sealDigest: record.hash };
  }
}
