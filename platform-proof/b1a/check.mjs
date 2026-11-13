import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { hash } from "../src/protocol.mjs";
const cwd = new URL("../../", import.meta.url),
  base = "2ca5cf215b68f187bfa48b42aaa041bbe93cf56d";
const git = (...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
execFileSync(process.execPath, ["platform-proof/scripts/check.mjs"], {
  cwd,
  stdio: "inherit",
});
for (const path of [
  "platform-proof/evidence",
  "platform-proof/planning",
  "docs",
  "vnext",
  "backend",
])
  if (git("diff", base, "--name-only", "--", path))
    throw Error("historical_or_application_change " + path);
const committed = git(
  "ls-tree",
  "-r",
  "--name-only",
  base,
  "platform-proof/evidence",
  "platform-proof/planning",
).split("\n");
for (const path of committed) {
  const original = execFileSync("git", ["show", base + ":" + path], { cwd });
  if (hash(original) !== hash(await readFile(new URL(path, cwd))))
    throw Error("historical_bytes_changed " + path);
}
const inventory = JSON.parse(
  await readFile(new URL("./inventory.json", import.meta.url), "utf8"),
);
if (
  inventory.scope !== "B1A_SOURCE_ONLY_NOT_AUTHORIZED" ||
  inventory.session.maximumHours !== 6 ||
  inventory.session.allocationUsd !== 20
)
  throw Error("bounded_inventory_required");
console.log(
  JSON.stringify({
    scope: "B1A_SOURCE_ONLY",
    base,
    accepted: "b4d0be0cb98c7f2b69be318e18b93f4de102c511",
    historicalFilesVerified: committed.length,
    changeBoundary: "platform-proof ONLY",
    sourceHead: git("rev-parse", "HEAD"),
    sourceTree: git("rev-parse", "HEAD^{tree}"),
    actualCloudResourcesCreated: 0,
    actualProviderCalls: 0,
  }),
);
