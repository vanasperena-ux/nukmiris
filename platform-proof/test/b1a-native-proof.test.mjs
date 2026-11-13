import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { fixture, arm, suspend, stop, message } from "./helpers.mjs";
import { verifiedPostgresTls } from "../src/database-transport.mjs";
import { classify } from "../src/classify.mjs";

test("B-5: native PostgreSQL TLS verifies both CA and hostname without fallback", async (t) => {
  const f = await fixture(t);
  await f.enableSqlTls();
  const ssl = verifiedPostgresTls({ ca: f.cert, servername: "localhost" }),
    good = new pg.Pool({ ...f.db, ssl, max: 1 });
  good.on("error", () => {});
  try {
    let row;
    for (let i = 0; i < 20; i++) {
      try {
        row = (
          await good.query(
            "SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()",
          )
        ).rows[0];
        break;
      } catch (e) {
        if (i === 19) throw e;
        await new Promise((r) => setTimeout(r, 30));
      }
    }
    assert.equal(row.ssl, true);
    assert.match(row.version, /TLSv1\.[23]/);
    await promisify(execFile)(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-keyout",
        join(f.dir, "other.key"),
        "-out",
        join(f.dir, "other.pem"),
        "-subj",
        "/CN=other-root",
      ],
      { timeout: 30000 },
    );
    for (const bad of [
      {
        ca: await readFile(join(f.dir, "other.pem"), "utf8"),
        servername: "localhost",
      },
      { ca: f.cert, servername: "wrong-host.invalid" },
    ]) {
      const pool = new pg.Pool({
        ...f.db,
        ssl: verifiedPostgresTls(bad),
        max: 1,
      });
      try {
        await assert.rejects(
          pool.query("SELECT 1"),
          /certificate|self.signed|hostname|altname/i,
        );
      } finally {
        await pool.end();
      }
    }
    await f.evidence("b1a-native-sql-tls", {
      ssl: row.ssl,
      protocol: row.version,
      caMismatchRejected: true,
      hostnameMismatchRejected: true,
      cloudSqlTested: false,
    });
  } finally {
    await good.end();
  }
});

test("B-2/B-3: real stopped/kill trace distinguishes pre-exit bytes from later provider application", async (t) => {
  const f = await fixture(t),
    g = await f.gateway(),
    b = await f.plan({ mode: "DELAY" }),
    { hook } = await arm(g, b, "afterWrite"),
    providerPaused = message(
      f.provider.c,
      (m) => m.type === "providerPaused" && m.attemptId === b.attemptId,
    ),
    pending = f.request(g, b);
  await hook;
  await providerPaused;
  const identity = await suspend(g);
  await new Promise((r) => setTimeout(r, 12));
  const exit = await stop(g);
  await pending;
  f.provider.c.send({ type: "release", attemptId: b.attemptId });
  await new Promise((r) => setTimeout(r, 20));
  await f.checkpoint();
  const trace = g.trace.filter((r) => r.attemptId === b.attemptId),
    at = (e) => trace.find((r) => r.event === e)?.at,
    scope = "local:" + identity.pid + ":" + identity.startTime,
    activity = {
      scope,
      connect: [at("CONNECT_BEGIN"), at("CONNECTED")],
      write: [at("WRITE_BEGIN"), at("WRITE_CALLBACK")],
      providerArrival: f.records.find(
        (r) => r.event === "EFFECT" && r.attemptId === b.attemptId,
      ).at,
    };
  const classification = classify({
    fence: { ...exit, kind: "LOCAL_PROCESS_EXIT", scope },
    activity,
    now: Date.now(),
    uncertaintyMs: 2,
  });
  assert.equal(classification.verdict, "PRE_FENCE");
  assert.ok(activity.providerArrival >= exit.at);
  assert.equal(
    classify({
      fence: { ...exit, kind: "CLOUD", scope, sourceVerified: true },
      activity,
      now: Date.now(),
      uncertaintyMs: 2,
    }).verdict,
    "NOT_PROVEN",
  );
  await f.evidence("b1a-native-kill-classification", {
    identity,
    exit,
    activity,
    trace,
    classification,
    cloudContainmentProven: false,
  });
});
