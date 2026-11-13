import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture, ownedVolumePresent } from "./helpers.mjs";
import { sanitizeFixtureText } from "./fixture-diagnostics.mjs";

test("B-8: intentional PostgreSQL startup failure captures state/logs before scoped cleanup", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "b1a-startup-diagnostic-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let failure;
  await t.test("failed owned fixture", async (child) => {
    await assert.rejects(
      () =>
        fixture(child, {
          startupFault: true,
          diagnosticDirectory: process.env.B1A_DIAGNOSTIC_DIR || directory,
        }),
      (e) => {
        failure = e;
        return e.message.includes("diagnostics captured");
      },
    );
    const saved = JSON.parse(await readFile(failure.diagnosticPath, "utf8"));
    assert.equal(saved.capturedBeforeResourceRemoval, true);
    assert.equal(saved.intentionalTestFault, true);
    assert.equal(saved.state.exitCode, 1);
    assert.equal(saved.state.oomKilled, false);
    assert.match(
      saved.postgresLogs,
      /b1a_unknown_setting|unrecognized configuration parameter/i,
    );
    assert.equal(saved.startupTimeoutMs, 60000);
    assert.equal(saved.volume, failure.fixtureVolume);
    assert.match(saved.name, /^inc1-[a-f0-9]{16}$/);
    assert.ok(!saved.postgresLogs.includes("POSTGRES_PASSWORD="));
  });
  assert.equal(await ownedVolumePresent(failure.fixtureVolume), false);
});
test("B-8: diagnostics redact generated secrets and bound log size", () => {
  const secret = "synthetic-secret-not-a-real-credential",
    text =
      "POSTGRES_PASSWORD=" + secret + " " + secret + " " + "x".repeat(50000);
  const result = sanitizeFixtureText(text, [secret]);
  assert.ok(!result.includes(secret));
  assert.ok(result.length <= 32768);
});
