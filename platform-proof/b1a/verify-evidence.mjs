import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { verifyRecords } from "../src/ledger.mjs";
const root = resolve(process.argv[2]),
  results = [];
for (const name of await readdir(root)) {
  const dir = join(root, name),
    head = JSON.parse(await readFile(join(dir, "checkpoint.json"), "utf8")),
    result = JSON.parse(await readFile(join(dir, "result.json"), "utf8")),
    text = await readFile(join(dir, "provider.jsonl"), "utf8");
  if (text && !text.endsWith("\n")) throw Error("partial_record");
  const records = text.trim() ? text.trimEnd().split("\n").map(JSON.parse) : [];
  verifyRecords(records, head);
  if (
    result.evidenceScope !== "B1A_LOCAL_SYNTHETIC_PREPARATION" ||
    !/^[a-f0-9]{40}$/.test(result.testedSource)
  )
    throw Error("new_source_pin_required");
  if (
    name.startsWith("b1a-cross-product") ||
    name.startsWith("b1a-asynchronous")
  ) {
    const cross = name.includes("cross-product"),
      expected = cross ? 1080 : 400;
    if (
      result.schedules !== expected ||
      result.outcomes.length !== expected ||
      result.actualSIGSTOP !== expected
    )
      throw Error("campaign_count");
    const matrix = {};
    let killed = 0,
      continued = 0;
    for (const v of result.outcomes) {
      if (
        !["RESUME", "REVOKE", "EXPIRE"].includes(v.controlMode) ||
        !["OK", "DROP"].includes(v.providerMode) ||
        Object.hasOwn(v, "mode") ||
        v.identity.state !== "T"
      )
        throw Error("campaign_metadata");
      const events = records.filter((r) => r.attemptId === v.attemptId),
        n = (e) => events.filter((r) => r.event === e).length;
      if (
        v.requests !== n("REQUEST") ||
        v.effects !== n("EFFECT") ||
        v.requests > 1 ||
        v.effects > 1
      )
        throw Error("campaign_ledger_mismatch");
      if (cross) {
        const cell = [v.point, v.controlMode, v.providerMode].join("|");
        matrix[cell] = (matrix[cell] ?? 0) + 1;
      }
      if (v.exit) {
        killed++;
        if (!v.exit.exitObserved || v.exit.signal !== "SIGKILL" || v.resumed)
          throw Error("direct_kill_required");
      }
      if (v.resumed?.continued) continued++;
    }
    if (
      cross &&
      (Object.keys(matrix).length !== 54 ||
        Object.values(matrix).some((v) => v !== 20) ||
        JSON.stringify(Object.entries(matrix).sort()) !==
          JSON.stringify(Object.entries(result.coverage).sort()))
    )
      throw Error("full_matrix_required");
    if (
      !cross &&
      (killed !== 130 || continued !== 270 || result.instrumented !== false)
    )
      throw Error("asynchronous_count");
  }
  results.push({
    case: name,
    records: records.length,
    chainAndHeadVerified: true,
    ...(result.schedules ? { schedules: result.schedules } : {}),
    cloudContainmentProven: false,
  });
}
console.log(
  JSON.stringify(
    { scope: "B1A_LOCAL_SYNTHETIC_PREPARATION", results },
    null,
    2,
  ),
);
