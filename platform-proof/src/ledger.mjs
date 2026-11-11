import { open, readFile } from "node:fs/promises";
import { hash, canonical } from "./protocol.mjs";
export const ZERO = "0".repeat(64);
export function verifyRecords(records, checkpoint) {
  let previous = ZERO,
    sequence = 0;
  for (const record of records) {
    const { hash: claimed, ...value } = record;
    if (
      value.sequence !== ++sequence ||
      value.previous !== previous ||
      hash(value) !== claimed
    )
      throw Error("ledger_chain_invalid");
    previous = claimed;
  }
  if (
    !checkpoint ||
    checkpoint.sequence !== sequence ||
    checkpoint.hash !== previous
  )
    throw Error("ledger_checkpoint_mismatch");
  return { sequence, hash: previous };
}
export async function readLedger(file, checkpoint) {
  const text = await readFile(file, "utf8");
  if (text && !text.endsWith("\n")) throw Error("ledger_partial_record");
  return verifyRecords(
    text.trim() ? text.trimEnd().split("\n").map(JSON.parse) : [],
    checkpoint,
  );
}
export async function openLedger(file, observe) {
  const handle = await open(file, "ax", 0o600);
  let head = { sequence: 0, hash: ZERO },
    pending = Promise.resolve(),
    failure;
  return {
    append(event) {
      const work = pending.then(async () => {
        if (failure) throw failure;
        if (
          ["hash", "sequence", "previous"].some((k) => Object.hasOwn(event, k))
        )
          throw Error("ledger_reserved_field");
        const value = {
            ...event,
            sequence: head.sequence + 1,
            previous: head.hash,
          },
          record = { ...value, hash: hash(value) };
        await handle.write(canonical(record) + "\n");
        await handle.sync();
        head = { sequence: record.sequence, hash: record.hash };
        await observe(record);
        return record;
      });
      pending = work.catch((e) => {
        failure = e;
      });
      return work;
    },
    async checkpoint() {
      await pending;
      if (failure) throw failure;
      return { ...head };
    },
    async close() {
      await pending;
      await handle.close();
      if (failure) throw failure;
    },
  };
}
