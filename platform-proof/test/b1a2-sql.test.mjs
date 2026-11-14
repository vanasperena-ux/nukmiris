import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { certkit } from "./b1a2-certkit.mjs";
import { privateProofSql } from "../b1a2/runtime/sql.mjs";
test("P-1 all five restricted roles support pinned private SQL TLS; runtime never accepts installer/admin, public host or fallback", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "b1a2-sql-profile-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const tls = await certkit(dir),
    base = {
      host: "10.91.1.12",
      port: 5432,
      database: "inc1_1234567890abcdef",
      password: "synthetic-only",
      ca: tls.server.ca,
      servername: "localhost",
    };
  for (const role of ["gateway", "worker", "ingress", "sealer", "controller"]) {
    const cfg = privateProofSql({ ...base, user: "inc1_" + role }, { role });
    assert.equal(cfg.ssl.rejectUnauthorized, true);
    assert.equal(cfg.max, 1);
    assert.equal(cfg.options, "-c timezone=UTC");
    assert.throws(
      () => privateProofSql({ ...base, user: "postgres" }, { role }),
      /restricted/,
    );
  }
  assert.equal(
    privateProofSql({ ...base, user: "postgres" }, { installer: true }).user,
    "postgres",
  );
  assert.throws(() =>
    privateProofSql(
      { ...base, user: "inc1_worker", host: "8.8.8.8" },
      { role: "worker" },
    ),
  );
  assert.throws(() =>
    privateProofSql(
      { ...base, user: "inc1_worker", ssl: false },
      { role: "worker" },
    ),
  );
});
