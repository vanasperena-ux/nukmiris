import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export function sanitizeFixtureText(text, secrets = []) {
  let value = String(text || "");
  for (const secret of secrets)
    if (secret) value = value.split(secret).join("[SYNTHETIC_REDACTED]");
  return value
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      "[PRIVATE_KEY_REDACTED]",
    )
    .replace(/(POSTGRES_PASSWORD=)[^\s]+/g, "$1[REDACTED]")
    .slice(-32768);
}
export async function captureFixtureDiagnostics({
  docker,
  name,
  volume,
  directory,
  reason,
  secrets = [],
  intentional = false,
}) {
  if (!/^inc1-[a-f0-9]{16}$/.test(name) || volume !== name + "-pgdata")
    throw Error("diagnostics_owned_fixture_required");
  let state = null,
    logs = "",
    inspectError = null,
    logError = null;
  try {
    const result = await docker([
      "inspect",
      "--format",
      "{{json .State}}",
      name,
    ]);
    const raw = JSON.parse(result.stdout);
    state = {
      status: raw.Status,
      exitCode: raw.ExitCode,
      reason: sanitizeFixtureText(raw.Error, secrets),
      oomKilled: raw.OOMKilled,
      startedAt: raw.StartedAt,
      finishedAt: raw.FinishedAt,
    };
  } catch (e) {
    inspectError = sanitizeFixtureText(
      e.stderr || e.code || "unavailable",
      secrets,
    );
  }
  try {
    const result = await docker(["logs", "--tail", "100", name]);
    logs = sanitizeFixtureText(result.stdout + "\n" + result.stderr, secrets);
  } catch (e) {
    logError = sanitizeFixtureText(
      e.stderr || e.code || "unavailable",
      secrets,
    );
  }
  const record = {
    scope: "OWNED_LOCAL_B1A_FIXTURE_ONLY",
    observedAt: new Date().toISOString(),
    name,
    volume,
    reason,
    intentionalTestFault: intentional,
    startupTimeoutMs: 60000,
    state,
    postgresLogs: logs,
    inspectError,
    logError,
    capturedBeforeResourceRemoval: true,
    source: process.env.B1A_SOURCE_SHA || "UNPINNED_DEVELOPMENT_RUN",
  };
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, name + "-" + randomUUID() + ".json");
  await writeFile(path, JSON.stringify(record, null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
  return { path, record };
}
