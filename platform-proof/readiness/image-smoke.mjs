import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile),
  image = process.argv[2];
if (!/^sha256:[a-f0-9]{64}$/.test(image ?? ""))
  throw Error("exact_image_required");
const env = {
  ...process.env,
  DOCKER_CONFIG: "/tmp/nukmiris-readiness-docker-config",
};
for (const k of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[k];
const driver = new URL("./container-checks.mjs", import.meta.url).pathname;
const name = "readiness-checks-" + randomBytes(6).toString("hex");
try {
  const result = await exec(
    "docker",
    [
      "--host=unix:///var/run/docker.sock",
      "run",
      "--rm",
      "--name",
      name,
      "--network=none",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--mount",
      "type=bind,source=" + driver + ",target=/checks.mjs,readonly",
      "--entrypoint",
      "node",
      image,
      "/checks.mjs",
    ],
    { env, timeout: 60000, maxBuffer: 1048576 },
  );
  process.stdout.write(result.stdout);
} finally {
  await exec(
    "docker",
    ["--host=unix:///var/run/docker.sock", "rm", "--force", "--volumes", name],
    { env, timeout: 30000 },
  ).catch(() => {});
}
