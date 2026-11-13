import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../../", import.meta.url)),
  base = "d3fa65192374ca206ff1f6d166a789c295a15e97",
  accepted = "b4d0be0cb98c7f2b69be318e18b93f4de102c511";
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const changed = [
  ...new Set(
    [
      ...git("diff", base, "--name-only").split("\n"),
      ...git("ls-files", "--others", "--exclude-standard").split("\n"),
    ].filter(Boolean),
  ),
];
if (changed.some((p) => !p.startsWith("platform-proof/")))
  throw Error("source_isolation_failed");
const tree = git("rev-parse", accepted + "^{tree}");
if (tree !== "03d08322e27d9d54485fa887b482743fe076556b")
  throw Error("accepted_tree_mismatch");
for (const path of [
  "backend",
  "vnext/src",
  "vnext/local",
  "vnext/package.json",
  "vnext/package-lock.json",
  "vnext/test",
])
  if (
    git("rev-parse", accepted + ":" + path) !== git("rev-parse", "HEAD:" + path)
  )
    throw Error("protected_tree_changed " + path);
const manifest = (
  await readFile(
    join(root, "vnext/evidence/pr16-final-functional/source-sha256.txt"),
    "utf8",
  )
)
  .trim()
  .split("\n");
for (const line of manifest) {
  const [, expected, path] = line.match(/^([a-f0-9]{64})  (.+)$/);
  const actual = createHash("sha256")
    .update(await readFile(join(root, path)))
    .digest("hex");
  if (actual !== expected) throw Error("accepted_file_changed " + path);
}
const files = [];
async function scan(dir) {
  for (const d of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".terraform", ".runs"].includes(d.name)) continue;
    const path = join(dir, d.name);
    if (d.isDirectory()) await scan(path);
    else {
      files.push(path);
      const txt = await readFile(path, "utf8");
      if (
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9]{30,}|ya29\.[A-Za-z0-9_-]{30,}/.test(
          txt,
        )
      )
        throw Error("possible_secret " + path);
    }
  }
}
await scan(join(root, "platform-proof"));
const forbiddenCredentialNames = Object.keys(process.env).filter(
  (k) =>
    /^(GOOGLE_APPLICATION_CREDENTIALS|GOOGLE_OAUTH_ACCESS_TOKEN|CLOUDSDK_AUTH_ACCESS_TOKEN|CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE|META_ACCESS_TOKEN|WHATSAPP_ACCESS_TOKEN)$/.test(
      k,
    ) && process.env[k],
);
if (forbiddenCredentialNames.length)
  throw Error("proof_environment_has_provider_credential_variables");
console.log(
  JSON.stringify(
    {
      mode: "LOCAL_SYNTHETIC_ONLY",
      base,
      accepted,
      acceptedTree: tree,
      manifestFiles: manifest.length,
      changedFiles: changed.length,
      scannedFiles: files.length,
      secretScan: "PASS",
      providerCredentialVariables: 0,
      protectedSource: "UNCHANGED",
      note: "Repository-content scan, not a forensic scan of unrelated host accounts; runtime uses explicit loopback only.",
    },
    null,
    2,
  ),
);
