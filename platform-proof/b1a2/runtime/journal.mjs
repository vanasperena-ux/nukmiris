import { open, readFile } from "node:fs/promises";
import { canonical, hash } from "../../src/protocol.mjs";
import { ZERO, verifyRecords } from "../../src/ledger.mjs";
/** Native provider ledger: restart requires an independently retained head. A
 * missing/partial/forked tail never silently starts a fresh history. */
export async function providerJournal(
  file,
  { checkpoint, observe = async () => {} } = {},
) {
  let head = { sequence: 0, hash: ZERO },
    records = [],
    existed = false;
  try {
    const text = await readFile(file, "utf8");
    existed = true;
    if (!checkpoint || (text && !text.endsWith("\n")))
      throw Error("trusted_provider_checkpoint_required");
    records = text.trim() ? text.trimEnd().split("\n").map(JSON.parse) : [];
    head = verifyRecords(records, checkpoint);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    if (checkpoint && checkpoint.sequence !== 0)
      throw Error("missing_provider_history");
  }
  const h = await open(file, existed ? "a" : "ax", 0o600);
  let pending = Promise.resolve(),
    failed;
  return {
    append(event) {
      const p = pending.then(async () => {
        if (failed) throw failed;
        if (
          ["sequence", "previous", "hash"].some((k) => Object.hasOwn(event, k))
        )
          throw Error("reserved_ledger_field");
        const v = {
            ...event,
            sequence: head.sequence + 1,
            previous: head.hash,
          },
          record = { ...v, hash: hash(v) };
        await h.write(canonical(record) + "\n");
        await h.sync();
        head = { sequence: record.sequence, hash: record.hash };
        records.push(record);
        await observe(record);
        return record;
      });
      pending = p.catch((e) => {
        failed = e;
      });
      return p;
    },
    async snapshot() {
      await pending;
      if (failed) throw failed;
      return {
        records: structuredClone(records),
        checkpoint: { ...head },
        observedUntil: Date.now(),
      };
    },
    async close() {
      await pending;
      await h.close();
      if (failed) throw failed;
    },
  };
}
/** Immutable generation-zero slots provide a single agreed next record even
 * across two attempted writers. Ambiguous PUTs latch HELD until read-only
 * resolution of that same slot; never allocate a replacement record identity.
 * This is a B1a test journal, not the production authenticated-index proof. */
export class CustodyJournal {
  constructor({ api, sessionId, allowNewSession = false }) {
    this.api = api;
    this.sessionId = sessionId;
    this.allowNewSession = allowNewSession;
    this.head = { sequence: 0, hash: ZERO };
    this.records = [];
    this.ready = false;
    this.pending = Promise.resolve();
    this.uncertain = null;
  }
  get prefix() {
    return "sessions/" + this.sessionId + "/records/";
  }
  slot(sequence) {
    return this.prefix + String(sequence).padStart(8, "0") + ".json";
  }
  async load() {
    const listed = await this.api.storage("LIST", this.prefix);
    if (listed.status !== 200 || listed.value?.nextPageToken)
      throw Error("complete_custody_listing_required");
    const items = listed.value.items ?? [];
    if (!items.length && !this.allowNewSession)
      throw Error("missing_independent_custody_history");
    const records = [];
    for (const [i, x] of [...items]
      .sort((a, b) => a.name.localeCompare(b.name))
      .entries()) {
      if (x.name !== this.slot(i + 1) || !/^[1-9][0-9]*$/.test(x.generation))
        throw Error("custody_history_gap");
      const r = await this.api.storage("GET", x.name, {
        generation: x.generation,
      });
      if (r.status !== 200) throw Error("missing_custody_record");
      records.push(r.value);
    }
    const cp = records.length
      ? { sequence: records.length, hash: records.at(-1).hash }
      : { sequence: 0, hash: ZERO };
    verifyRecords(records, cp);
    this.records = records;
    this.head = cp;
    this.ready = true;
    return cp;
  }
  append(event) {
    const p = this.pending.then(async () => {
      if (!this.ready) await this.load();
      if (this.uncertain) throw Error("custody_write_uncertain_held");
      const value = {
        ...event,
        sequence: this.head.sequence + 1,
        previous: this.head.hash,
      };
      if (["sequence", "previous", "hash"].some((k) => Object.hasOwn(event, k)))
        throw Error("reserved_custody_field");
      const r = { ...value, hash: hash(value) },
        slot = this.slot(r.sequence);
      this.uncertain = { slot, record: r };
      let response;
      try {
        response = await this.api.storage("PUT", slot, { body: r });
      } catch {
        throw Error("custody_write_uncertain_held");
      }
      if (response.status === 412) throw Error("custody_slot_conflict_held");
      if (response.status !== 200 && response.status !== 201)
        throw Error("custody_write_uncertain_held");
      if (!/^[1-9][0-9]*$/.test(response.value?.generation ?? ""))
        throw Error("custody_generation_receipt_required");
      this.head = { sequence: r.sequence, hash: r.hash };
      this.records.push(r);
      this.uncertain = null;
      return r;
    });
    this.pending = p.catch(() => {});
    return p;
  }
  async resolve() {
    if (!this.uncertain) return { state: "NO_UNCERTAINTY" };
    const r = await this.api.storage("GET", this.uncertain.slot);
    if (
      r.status !== 200 ||
      canonical(r.value) !== canonical(this.uncertain.record)
    )
      return { state: "HELD", reason: "original_slot_not_proven" };
    const record = this.uncertain.record;
    verifyRecords([...this.records, record], {
      sequence: record.sequence,
      hash: record.hash,
    });
    this.records.push(record);
    this.head = { sequence: record.sequence, hash: record.hash };
    this.uncertain = null;
    return { state: "RESOLVED_ORIGINAL_RECORD", record };
  }
  async findSeal(scopeId, batchId, digest) {
    await this.pending;
    if (!this.ready) await this.load();
    if (this.uncertain) await this.resolve();
    if (this.uncertain) throw Error("custody_write_uncertain_held");
    const rows = this.records.filter(
      (r) =>
        r.event === "SYNTHETIC_ADMISSION_SEAL" &&
        r.scopeId === scopeId &&
        r.batchId === batchId,
    );
    if (rows.some((r) => r.digest !== digest))
      throw Error("custody_seal_conflict");
    return rows[0];
  }
  async snapshot() {
    await this.pending;
    if (this.uncertain) throw Error("custody_write_uncertain_held");
    return {
      records: structuredClone(this.records),
      checkpoint: { ...this.head },
    };
  }
}
