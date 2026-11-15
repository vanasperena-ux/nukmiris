import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { hash } from "../src/protocol.mjs";
import { LIVE_CLOUD_EXECUTION } from "../b1a2/runtime/transport.mjs";
const root = new URL("../../", import.meta.url),
  base = "1e720fce1102dcf7867df567fabaf3b50eebf668",
  git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16777216,
    }).trim();
execFileSync(process.execPath, ["platform-proof/b1a2/check.mjs"], {
  cwd: root,
  stdio: "inherit",
});
const files = git(
  "ls-tree",
  "-r",
  "--name-only",
  base,
  "platform-proof/evidence",
  "platform-proof/planning",
  "platform-proof/b1a/evidence",
  "platform-proof/b1a2/evidence",
  "docs",
  "reviews",
  "src",
  "tests",
  "vnext",
  "backend",
)
  .split("\n")
  .filter(Boolean);
for (const file of files) {
  const original = execFileSync("git", ["show", base + ":" + file], {
    cwd: root,
    maxBuffer: 16777216,
  });
  if (hash(original) !== hash(await readFile(new URL(file, root))))
    throw Error("historical_or_application_bytes_changed " + file);
}
const changed = git("diff", "--name-only", base).split("\n").filter(Boolean);
if (changed.some((p) => !p.startsWith("platform-proof/")))
  throw Error("scope_expansion");
if (LIVE_CLOUD_EXECUTION !== false) throw Error("live_guard_changed");
console.log(
  JSON.stringify({
    scope: "G123_LOCAL_SOURCE_ONLY",
    base,
    historicalAndApplicationFilesVerified: files.length,
    changedTrackedPaths: changed.length,
    sourceOnlyApplyGuard: "PRESERVED",
    liveCloudExecution: false,
    actualCloudProof: "NOT_EXECUTED",
  }),
);
