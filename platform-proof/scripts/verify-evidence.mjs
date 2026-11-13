import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { readLedger, verifyRecords } from "../src/ledger.mjs";
const root = resolve(process.argv[2] || "evidence/runs");
const results = [];
for (const name of await readdir(root)) {
  const dir = join(root, name),
    head = JSON.parse(await readFile(join(dir, "checkpoint.json"), "utf8"));
  let records;
  try {
    records = (await readFile(join(dir, "provider.jsonl"), "utf8"))
      .trimEnd()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    records = [];
    for (const file of (await readdir(dir))
      .filter((n) => /^provider-\d+\.jsonl$/.test(n))
      .sort())
      records.push(
        ...(await readFile(join(dir, file), "utf8"))
          .trimEnd()
          .split("\n")
          .filter(Boolean)
          .map(JSON.parse),
      );
  }
  verifyRecords(records, head);
  const result = JSON.parse(await readFile(join(dir, "result.json"), "utf8"));
  if (name === "campaign") {
    if (
      result.schedules !== 1000 ||
      result.outcomes.length !== 1000 ||
      result.actualSigstop !== 1000 ||
      result.actualSigcont !== 1000
    )
      throw Error("campaign_count");
    for (const v of result.outcomes)
      if (
        v.identity.state !== "T" ||
        !v.resumed.continued ||
        v.requests > 1 ||
        v.effects > 1 ||
        !v.classification
      )
        throw Error("campaign_invariant");
  }
  results.push({
    name,
    records: records.length,
    verified: true,
    ...(name === "campaign" ? { schedules: 1000 } : {}),
  });
}
console.log(JSON.stringify({ mode: "LOCAL_SYNTHETIC_ONLY", results }, null, 2));
