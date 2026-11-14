import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
const exec = promisify(execFile),
  env = { ...process.env, DOCKER_CONFIG: "/tmp/nukmiris-b1a2-docker-config" };
for (const k of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[k];
const docker = async (args) =>
  (
    await exec("docker", ["--host=unix:///var/run/docker.sock", ...args], {
      env,
      timeout: 60000,
      maxBuffer: 1048576,
    })
  ).stdout;
const image = process.argv[2];
if (!/^sha256:[a-f0-9]{64}$/.test(image ?? ""))
  throw Error("exact_local_image_id_required");
const name = "b1a2-smoke-" + randomBytes(6).toString("hex");
try {
  await docker([
    "run",
    "--detach",
    "--name",
    name,
    "--label",
    "nukmiris.b1a2=synthetic-local",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--publish",
    "127.0.0.1::8080",
    image,
  ]);
  const mapped = (await docker(["port", name, "8080/tcp"])).trim(),
    port = Number(mapped.split(":").at(-1));
  let health;
  for (let i = 0; i < 50; i++) {
    try {
      health = await fetch("http://127.0.0.1:" + port + "/healthz");
      if (health.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!health?.ok)
    throw Error(
      "container_health_not_ready " +
        (await docker(["logs", "--tail=20", name]).catch((e) => e.stderr)),
    );
  const ready = await fetch("http://127.0.0.1:" + port + "/readyz");
  if (ready.status !== 503) throw Error("unconfigured_container_must_be_inert");
  const blocked = await docker([
    "run",
    "--rm",
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--env",
    "B1A2_MODE=CLOUD",
    "--env",
    "B1A2_EXECUTE=true",
    image,
  ]).then(
    () => false,
    (e) => /cloud_execution_requires_reviewed_activation_change/.test(e.stderr),
  );
  if (!blocked) throw Error("cloud_gate_bypass");
  console.log(
    JSON.stringify({
      image,
      health: health.status,
      ready: ready.status,
      liveActivationBlocked: true,
      localContainerOnly: true,
    }),
  );
} finally {
  await docker(["rm", "--force", "--volumes", name]).catch(() => {});
}
