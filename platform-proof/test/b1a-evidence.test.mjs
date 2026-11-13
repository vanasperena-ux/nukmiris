import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { ZERO } from "../src/ledger.mjs";
const verify = new URL("../b1a/verify-evidence.mjs", import.meta.url);
async function data(t, value) {
  const dir = await mkdtemp(join(tmpdir(), "b1a-export-test-")),
    sub = join(dir, "fixture");
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(sub);
  await writeFile(join(sub, "provider.jsonl"), "");
  await writeFile(
    join(sub, "checkpoint.json"),
    JSON.stringify({ sequence: 0, hash: ZERO }),
  );
  await writeFile(join(sub, "result.json"), JSON.stringify(value));
  return dir;
}
const run = (dir) =>
  JSON.parse(
    execFileSync(process.execPath, [verify.pathname, dir], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
test("published evidence verifier consumes the exact helper scope and testedSource schema", async (t) => {
  const dir = await data(t, {
    evidenceScope: "B1A_LOCAL_SYNTHETIC_PREPARATION",
    testedSource: "a".repeat(40),
  });
  assert.equal(run(dir).results[0].chainAndHeadVerified, true);
});
test("published evidence verifier rejects missing source pin and a false hash-chain head", async (t) => {
  const dir = await data(t, {
    evidenceScope: "B1A_LOCAL_SYNTHETIC_PREPARATION",
    testedSource: "UNPINNED_DEVELOPMENT_RUN",
  });
  assert.throws(() => run(dir));
  await writeFile(
    join(dir, "fixture", "result.json"),
    JSON.stringify({
      evidenceScope: "B1A_LOCAL_SYNTHETIC_PREPARATION",
      testedSource: "a".repeat(40),
    }),
  );
  await writeFile(
    join(dir, "fixture", "checkpoint.json"),
    JSON.stringify({ sequence: 1, hash: "a".repeat(64) }),
  );
  assert.throws(() => run(dir));
});
