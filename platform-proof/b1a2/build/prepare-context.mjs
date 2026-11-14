import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "../../src/protocol.mjs";
const proof = fileURLToPath(new URL("../../", import.meta.url)),
  out = resolve(process.argv[2] ?? "/tmp/nukmiris-b1a2-build-context");
if (!out.startsWith("/tmp/nukmiris-b1a2-"))
  throw Error("owned_temp_context_required");
await mkdir(out, { recursive: true, mode: 0o700 });
for (const path of [
  "package.json",
  "package-lock.json",
  "node_modules",
  "src",
  "b1a/runtime",
  "b1a2/runtime",
])
  await cp(resolve(proof, path), resolve(out, path), { recursive: true });
await cp(new URL("./Dockerfile", import.meta.url), resolve(out, "Dockerfile"));
console.log(
  JSON.stringify({
    context: out,
    sourceRoots: ["src", "b1a/runtime", "b1a2/runtime"],
    secretsIncluded: false,
    lockDigest: hash(
      await readFile(resolve(proof, "package-lock.json"), "utf8"),
    ),
  }),
);
