## Supporting evidence — Claude B1a review (PR #21 @ `38ad02a`, evidence `ac38ede`)

Companion to the [main review](https://github.com/vanasperena-ux/nukmiris/pull/21#issuecomment-6868306319). Everything below is review-only: none of it is added to the repo. "Adapted" means the exact `38ad02a` source with `src/` and `b1a/` untouched and **one changed test helper** (diff below). It runs on Node 22.23.4, a local PostgreSQL 16.15 cluster per fixture, the pinned `pg@8.16.3`, UTC, with `fsync`/`synchronous_commit` on. It is **not** the pinned Node 24.19 / PG 17.11 / Docker environment, and it is **not** cloud evidence.

### A. Integrity
| Check | Result |
|---|---|
| `SHA256SUMS.json` | 71/71 entries match; only the manifest itself is unlisted |
| Split archives | full `b6f0d989…` (13 parts) and fault `e15daf95…` (13 parts) reassemble to the exact recorded bytes/sha256; concurrency `ac49908f…` |
| `tested-files-sha256.json` vs `git show 38ad02a:<path>` | 50/50 |
| Protected trees `b4d0be0` vs `ac38ede` | `vnext/src 06b9b834`, `vnext/test 3ae5480f`, `vnext/local 11c3161e`, `package.json d9f587e4`, `package-lock 6c05cf0c`, `backend 1db9755e`: identical |
| `b1a/check.mjs` + `scripts/check.mjs` (worktree at `38ad02a`, scrubbed env) | PASS (127 manifest files, 35 historical files, protected source UNCHANGED, secret scan PASS) |
| Codex `b1a/verify-evidence.mjs` on my extracted archives | PASS for full, fault and concurrency |

### B. Execution
| Suite | Result |
|---|---|
| Non-DB suites from exact source (classifier, clock, evidence, ops, planning, unit) | 25/25 |
| DB suites with the adapter (gateway, identity, native-proof, session, permission, concurrency, fault, campaign, interruption) | **32/32 pass** (log tail below); my raw exports reverified (25 ledgers) |
| Not run | `b1a-diagnostics` (needs a Docker startup fault), `fixture.test` (Docker volumes) |

<details><summary>Adapter diff (test/helpers.mjs only)</summary>

```diff
--- test/helpers.orig.mjs	2026-11-13 18:10:59.794831817 -0600
+++ test/helpers.mjs	2026-11-13 18:10:59.805105341 -0600
@@ -46,7 +46,8 @@
     dbName = "inc1_" + randomBytes(8).toString("hex"),
     password = randomBytes(24).toString("hex");
   const volume = name + "-pgdata";
-  let admin, worker, provider;
+  let admin, worker, provider, pgdir, stopCluster = async () => {};
+  const PGBIN = "/usr/lib/postgresql/16/bin";
   let failureDiagnostic;
   const capture = async (reason) =>
     (failureDiagnostic ??= await captureFixtureDiagnostics({
@@ -60,14 +61,6 @@
     }));
   const children = new Set();
   t.after(async () => {
-    try {
-      const state = JSON.parse(
-        (await docker(["inspect", "--format", "{{json .State}}", name])).stdout,
-      );
-      if (!state.Running) await capture("container_exited_before_cleanup");
-    } catch {
-      /* Setup may have failed before the container existed. */
-    }
     await Promise.all(
       [...children].map(async (c) => {
         if (c.exitCode !== null || c.signalCode !== null) return;
@@ -78,87 +71,24 @@
     );
     await worker?.end();
     await admin?.end();
-    await docker(["rm", "-f", "-v", name]).catch(() => {});
-    await docker(["volume", "rm", volume]).catch((e) => {
-      if (!e.stderr?.toLowerCase().includes("no such volume"))
-        throw Error("owned_fixture_volume_cleanup_failed");
-    });
+    await stopCluster();
     await rm(dir, { recursive: true, force: true });
   });
   try {
-    await docker(["image", "inspect", IMAGE]);
-    await docker([
-      "volume",
-      "create",
-      "--label",
-      "nukmiris.inc1=local-proof",
-      "--label",
-      "nukmiris.inc1.owner=" + name,
-      volume,
-    ]);
-    await docker([
-      "run",
-      "--detach",
-      "--name",
-      name,
-      "--label",
-      "nukmiris.inc1=local-proof",
-      "--mount",
-      "type=volume,source=" + volume + ",target=/var/lib/postgresql/data",
-      "--publish",
-      "127.0.0.1::5432",
-      "--env",
-      "POSTGRES_PASSWORD=" + password,
-      "--env",
-      "POSTGRES_DB=" + dbName,
-      IMAGE,
-      "-c",
-      "timezone=UTC",
-      "-c",
-      "fsync=on",
-      "-c",
-      "synchronous_commit=on",
-      ...(startupFault ? ["-c", "b1a_unknown_setting=on"] : []),
-    ]);
-    const port = Number(
-      (await docker(["port", name, "5432/tcp"])).stdout
-        .trim()
-        .split(":")
-        .at(-1),
-    );
-    const db = {
-      host: "127.0.0.1",
-      port,
-      database: dbName,
-      user: "postgres",
-      password,
-    };
-    const startupDeadline = Date.now() + 60000;
-    for (;;) {
-      try {
-        admin = new pg.Pool(database(db));
-        await admin.query("SELECT 1");
-        break;
-      } catch (e) {
-        await admin?.end();
-        admin = null;
-        const state = JSON.parse(
-          (await docker(["inspect", "--format", "{{json .State}}", name]))
-            .stdout,
-        );
-        if (!state.Running || Date.now() >= startupDeadline)
-          throw Error(
-            "fixture_startup_failed " +
-              JSON.stringify({
-                status: state.Status,
-                exitCode: state.ExitCode,
-                oom: state.OOMKilled,
-                connectionCode: e.code,
-              }),
-          );
-        await new Promise((r) => setTimeout(r, 100));
-      }
-    }
+    // CLAUDE REVIEW ADAPTER (not upstream): per-fixture local PostgreSQL 16.15 cluster on loopback TCP
+    if (startupFault) throw Error("claude_adapter_does_not_reproduce_docker_startup_fault");
+    const port = await new Promise((r) => { const sv = net.createServer(); sv.listen(0, "127.0.0.1", () => { const p = sv.address().port; sv.close(() => r(p)); }); });
+    pgdir = await mkdtemp(join(tmpdir(), "b1a-pg-"));
+    await writeFile(join(pgdir, "pw"), password);
+    await run("chown", ["-R", "postgres", pgdir]);
+    const su = (cmd) => run("su", ["postgres", "-c", cmd], { timeout: 120000 });
+    await su(`${PGBIN}/initdb -D ${pgdir}/data -U postgres --auth=scram-sha-256 --pwfile=${pgdir}/pw -E UTF8 >/dev/null`);
+    await su(`${PGBIN}/pg_ctl -D ${pgdir}/data -l ${pgdir}/log -w -t 60 -o "-p ${port} -k ${pgdir} -c listen_addresses=127.0.0.1 -c timezone=UTC -c fsync=on -c synchronous_commit=on -c max_connections=200" start >/dev/null`);
+    stopCluster = async () => { await su(`${PGBIN}/pg_ctl -D ${pgdir}/data -m immediate stop >/dev/null 2>&1 || true`).catch(() => {}); await rm(pgdir, { recursive: true, force: true }); };
+    await su(`PGPASSWORD=${password} psql -h 127.0.0.1 -p ${port} -U postgres -d postgres -qc "CREATE DATABASE ${dbName}"`);
+    const db = { host: "127.0.0.1", port, database: dbName, user: "postgres", password };
+    admin = new pg.Pool(database(db));
+    await admin.query("SELECT 1");
     await admin.query(await readFile(join(root, "src/schema.sql"), "utf8"));
     if (control)
       await admin.query(await readFile(join(root, "b1a/schema.sql"), "utf8"));
@@ -290,35 +220,10 @@
       children,
       async enableSqlTls() {
         // Files and commands target only this owned disposable container/volume.
-        await docker([
-          "cp",
-          join(dir, "tls.pem"),
-          name + ":/var/lib/postgresql/data/server.crt",
-        ]);
-        await docker([
-          "cp",
-          join(dir, "tls.key"),
-          name + ":/var/lib/postgresql/data/server.key",
-        ]);
-        await docker([
-          "exec",
-          "--user",
-          "root",
-          name,
-          "chown",
-          "postgres:postgres",
-          "/var/lib/postgresql/data/server.crt",
-          "/var/lib/postgresql/data/server.key",
-        ]);
-        await docker([
-          "exec",
-          "--user",
-          "root",
-          name,
-          "chmod",
-          "0600",
-          "/var/lib/postgresql/data/server.key",
-        ]);
+        await run("cp", [join(dir, "tls.pem"), pgdir + "/data/server.crt"]);
+        await run("cp", [join(dir, "tls.key"), pgdir + "/data/server.key"]);
+        await run("chown", ["postgres", pgdir + "/data/server.crt", pgdir + "/data/server.key"]);
+        await run("chmod", ["0600", pgdir + "/data/server.key"]);
         await admin.query("ALTER SYSTEM SET ssl='on'");
         await admin.query("SELECT pg_reload_conf()");
       },
@@ -456,8 +361,8 @@
       },
     };
     if (
-      !process.versions.node.startsWith("24.") ||
-      !/PostgreSQL 17\.11\b/.test(f.version.version) ||
+      !/^(24|22)\./.test(process.versions.node) ||
+      !/PostgreSQL (17\.11|16\.15)\b/.test(f.version.version) ||
       f.version.timezone !== "UTC"
     )
       throw Error("INC1_requires_Node24_PostgreSQL17_11_UTC");
```
</details>

<details><summary>claude_verify_b1a.py: independent verifier (no shared code with Codex)</summary>

```python
"""Claude independent verifier for PR21 B1a raw evidence (no shared code with Codex verifiers).
Usage: python3 -I claude_verify_b1a.py <root-with-full/fault/concurrency>"""
import json, hashlib, sys, os, collections
def canon(v):
    if isinstance(v, dict): return '{' + ','.join(json.dumps(k, ensure_ascii=False) + ':' + canon(v[k]) for k in sorted(v)) + '}'
    if isinstance(v, list): return '[' + ','.join(canon(x) for x in v) + ']'
    return json.dumps(v, ensure_ascii=False, separators=(',', ':'))
H = lambda s: hashlib.sha256(s.encode()).hexdigest()
def chain(path, cp):
    text = open(path, encoding='utf-8').read(); assert text == '' or text.endswith('\n')
    prev, seq, recs = '0' * 64, 0, []
    for line in text.splitlines():
        r = json.loads(line); assert canon(r) == line, 'non-canonical'
        body = {k: v for k, v in r.items() if k != 'hash'}; seq += 1
        assert body['sequence'] == seq and body['previous'] == prev and H(canon(body)) == r['hash'], f'break {seq}'
        prev = r['hash']; recs.append(r)
    assert cp['sequence'] == seq and cp['hash'] == prev, 'checkpoint'
    return recs
root = sys.argv[1]; out = {'ledgers': 0, 'testedSource': set()}
for run in sorted(os.listdir(root)):
    for case in sorted(os.listdir(os.path.join(root, run))):
        d = os.path.join(root, run, case)
        recs = chain(os.path.join(d, 'provider.jsonl'), json.load(open(os.path.join(d, 'checkpoint.json'))))
        out['ledgers'] += 1
        res = json.load(open(os.path.join(d, 'result.json')))
        if 'testedSource' in res: out['testedSource'].add(res['testedSource'])
        per = collections.defaultdict(collections.Counter)
        for r in recs:
            if 'attemptId' in r: per[r['attemptId']][r['event']] += 1
        req = lambda a: per[a]['REQUEST']; eff = lambda a: per[a]['EFFECT']
        o = {'maxRequestPerAttempt': max([c['REQUEST'] for c in per.values()] or [0]), 'maxEffectPerAttempt': max([c['EFFECT'] for c in per.values()] or [0])}
        if case == 'b1a-cross-product-v1':
            oc = res['outcomes']; cells = collections.Counter('|'.join((x['point'], x['controlMode'], x['providerMode'])) for x in oc)
            o.update(schedules=len(oc), cells=len(cells), minPerCell=min(cells.values()), maxPerCell=max(cells.values()),
                     resultLedgerMismatch=sum(1 for x in oc if x['requests'] != req(x['attemptId']) or x['effects'] != eff(x['attemptId'])),
                     stoppedT=sum(1 for x in oc if x['identity'].get('state') == 'T'),
                     resumedSameStart=sum(1 for x in oc if x['resumed'].get('continued') and x['resumed'].get('startTime') == x['identity'].get('startTime')),
                     afterCommitREVOKE_effects=collections.Counter((x['providerMode'], x['result'].get('state'), eff(x['attemptId'])) for x in oc if x['point'] == 'afterCommit' and x['controlMode'] == 'REVOKE').__repr__(),
                     beforeAuthorityREVOKE=collections.Counter((x['result'].get('state'), x['durableState'], req(x['attemptId'])) for x in oc if x['point'] == 'beforeAuthority' and x['controlMode'] == 'REVOKE').__repr__(),
                     classification=collections.Counter(x['classification']['verdict'] for x in oc).__repr__(),
                     durable=dict(collections.Counter(x['durableState'] for x in oc)))
        if case == 'b1a-asynchronous-v1':
            oc = res['outcomes']; kills = [x for x in oc if x['exit']]
            last = lambda t: t[-1]['event'] if t else 'NONE'
            o.update(schedules=len(oc), kills=len(kills), continued=sum(1 for x in oc if (x['resumed'] or {}).get('continued')),
                     stoppedT=sum(1 for x in oc if x['identity'].get('state') == 'T'),
                     resultLedgerMismatch=sum(1 for x in oc if x['requests'] != req(x['attemptId']) or x['effects'] != eff(x['attemptId'])),
                     killExitObservedSamePidStart=sum(1 for x in kills if x['exit'].get('exitObserved') and x['exit'].get('signal') == 'SIGKILL' and x['exit'].get('pidStart') == x['identity'].get('startTime')),
                     oldTraceAfterExit=sum(1 for x in kills for t in x['oldTrace'] if t['at'] > x['exit']['at']),
                     ledgerRequestAfterExit_byOldProcess=sum(1 for x in kills for r in recs if r.get('attemptId') == x['attemptId'] and r['event'] == 'REQUEST' and r['at'] > x['exit']['at'] and not x['newTrace']),
                     resendAfterUnknown=sum(1 for x in kills if x['recoveryState'] == 'UNKNOWN' and any(t['event'] == 'CONNECT_BEGIN' for t in x['newTrace'])),
                     replayOfArmedSentOnce=sum(1 for x in kills if x['recoveryState'] == 'ARMED' and req(x['attemptId']) == 1),
                     stateAtStop=dict(collections.Counter(x['stateAtStop'] for x in oc)),
                     lastTraceEventAtStop=dict(collections.Counter(last(x['traceAtStop']) for x in oc)),
                     controlMode=dict(collections.Counter(x['controlMode'] for x in oc)),
                     classification=dict(collections.Counter(x['classification']['verdict'] for x in oc)),
                     durable=dict(collections.Counter(x['durableState'] for x in oc)))
        if case.startswith('b1a-commit-') or case.startswith('b1a-proof-') or case in ('b1a-direct-kill', 'b1a-native-kill-classification', 'b1a-retired-recovery', 'b1a-session-budget-hold', 'b1a-sealer-ack'):
            o['result'] = {k: v for k, v in res.items() if k not in ('version', 'trace', 'outcomes', 'evidenceScope', 'testedSource')}
        out[f'{run}/{case}'] = o
out['testedSource'] = sorted(out['testedSource'])
print(json.dumps(out, indent=1, default=str))
```
</details>

<details><summary>Verifier output over published archives (selected cases)</summary>

```json
{
 "ledgers": 50,
 "testedSource": [
  "38ad02abbb0b7353f6768ff67f74542a4df0dedb"
 ],
 "concurrency/b1a-retired-recovery": {
  "maxRequestPerAttempt": 0,
  "maxEffectPerAttempt": 0,
  "result": {
   "neverRearmed": true,
   "originalBindingsPreserved": true,
   "crossScopeDenied": true,
   "cloudRetirementTested": false
  }
 },
 "concurrency/b1a-sealer-ack": {
  "maxRequestPerAttempt": 0,
  "maxEffectPerAttempt": 0,
  "result": {
   "verifiedCommitBeforeAck": true,
   "unavailableStatus": 503,
   "journalUnavailableNoAck": true,
   "cloudColdStartMeasured": false
  }
 },
 "concurrency/b1a-session-budget-hold": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "result": {
   "state": {
    "epoch": 2,
    "scopeId": "bf548fd6-0676-4f88-ba83-134df7844dfc",
    "revision": "inc1-r2",
    "expiresAt": "2026-11-13T21:13:16.471+00:00",
    "sessionId": "3b797b35-cfe3-448c-89bf-72b8c852daaf",
    "generation": 5,
    "holdReason": "FENCE_INCOMPLETE",
    "retiredEpoch": 1,
    "dispatchEnabled": false,
    "retiredRevision": "inc1-r1"
   },
   "monthlyResetAutomaticPromotion": false,
   "cloudBudgetSystemTested": false
  }
 },
 "concurrency/concurrency": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1
 },
 "fault/b1a-asynchronous-v1": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "schedules": 400,
  "kills": 130,
  "continued": 270,
  "stoppedT": 400,
  "resultLedgerMismatch": 0,
  "killExitObservedSamePidStart": 130,
  "oldTraceAfterExit": 0,
  "ledgerRequestAfterExit_byOldProcess": 0,
  "resendAfterUnknown": 0,
  "replayOfArmedSentOnce": 8,
  "stateAtStop": {
   "ARMED": 54,
   "UNKNOWN": 31,
   "ENTERED": 234,
   "APPLIED": 81
  },
  "lastTraceEventAtStop": {
   "NONE": 83,
   "RESPONSE_END": 123,
   "WRITE_CALLBACK": 45,
   "CONNECT_BEGIN": 75,
   "CONNECTED": 58,
   "WRITE_BEGIN": 14,
   "TLS_READY": 2
  },
  "controlMode": {
   "RESUME": 181,
   "EXPIRE": 86,
   "REVOKE": 133
  },
  "classification": {
   "NOT_PROVEN": 323,
   "PRE_FENCE": 77
  },
  "durable": {
   "APPLIED": 207,
   "UNKNOWN": 181,
   "ARMED": 11,
   "EXPIRED": 1
  }
 },
 "fault/b1a-cross-product-v1": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "schedules": 1080,
  "cells": 54,
  "minPerCell": 20,
  "maxPerCell": 20,
  "resultLedgerMismatch": 0,
  "stoppedT": 1080,
  "resumedSameStart": 1080,
  "afterCommitREVOKE_effects": "Counter({('DROP', 'UNKNOWN', 1): 20, ('OK', 'APPLIED', 1): 20})",
  "beforeAuthorityREVOKE": "Counter({('DENIED', 'ARMED', 0): 40})",
  "classification": "Counter({'NOT_PROVEN': 1080})",
  "durable": {
   "APPLIED": 340,
   "UNKNOWN": 660,
   "ARMED": 40,
   "EXPIRED": 40
  }
 },
 "full/b1a-asynchronous-v1": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "schedules": 400,
  "kills": 130,
  "continued": 270,
  "stoppedT": 400,
  "resultLedgerMismatch": 0,
  "killExitObservedSamePidStart": 130,
  "oldTraceAfterExit": 0,
  "ledgerRequestAfterExit_byOldProcess": 0,
  "resendAfterUnknown": 0,
  "replayOfArmedSentOnce": 13,
  "stateAtStop": {
   "ARMED": 73,
   "ENTERED": 214,
   "UNKNOWN": 35,
   "APPLIED": 78
  },
  "lastTraceEventAtStop": {
   "NONE": 100,
   "WRITE_CALLBACK": 26,
   "RESPONSE_END": 120,
   "CONNECTED": 58,
   "CONNECT_BEGIN": 73,
   "WRITE_PART": 5,
   "TLS_READY": 1,
   "WRITE_BEGIN": 17
  },
  "controlMode": {
   "RESUME": 181,
   "EXPIRE": 86,
   "REVOKE": 133
  },
  "classification": {
   "NOT_PROVEN": 332,
   "PRE_FENCE": 68
  },
  "durable": {
   "APPLIED": 202,
   "UNKNOWN": 184,
   "ARMED": 10,
   "EXPIRED": 4
  }
 },
 "full/b1a-authenticated-provider": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1
 },
 "full/b1a-cloud-profile-pure": {
  "maxRequestPerAttempt": 0,
  "maxEffectPerAttempt": 0
 },
 "full/b1a-commit-ack_lost": {
  "maxRequestPerAttempt": 0,
  "maxEffectPerAttempt": 0,
  "result": {
   "mode": "ACK_LOST",
   "firstCaller": "UNKNOWN",
   "durableAfterLoss": "UNKNOWN",
   "replayCaller": "UNKNOWN",
   "intercepted": 1
  }
 },
 "full/b1a-commit-before_server": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "result": {
   "mode": "BEFORE_SERVER",
   "firstCaller": "UNKNOWN",
   "durableAfterLoss": "ARMED",
   "replayCaller": "APPLIED",
   "intercepted": 1
  }
 },
 "full/b1a-commit-rollback_tag": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "result": {
   "mode": "ROLLBACK_TAG",
   "firstCaller": "UNKNOWN",
   "durableAfterLoss": "ARMED",
   "replayCaller": "APPLIED",
   "intercepted": 1
  }
 },
 "full/b1a-cross-product-v1": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "schedules": 1080,
  "cells": 54,
  "minPerCell": 20,
  "maxPerCell": 20,
  "resultLedgerMismatch": 0,
  "stoppedT": 1080,
  "resumedSameStart": 1080,
  "afterCommitREVOKE_effects": "Counter({('DROP', 'UNKNOWN', 1): 20, ('OK', 'APPLIED', 1): 20})",
  "beforeAuthorityREVOKE": "Counter({('DENIED', 'ARMED', 0): 40})",
  "classification": "Counter({'NOT_PROVEN': 1080})",
  "durable": {
   "APPLIED": 340,
   "UNKNOWN": 660,
   "ARMED": 40,
   "EXPIRED": 40
  }
 },
 "full/b1a-direct-kill": {
  "maxRequestPerAttempt": 0,
  "maxEffectPerAttempt": 0,
  "result": {
   "signals": [
    "SIGKILL"
   ],
   "decisionAt": 1794603576539,
   "exit": {
    "decisionAt": 1794603576539,
    "at": 1794603576542,
    "pid": 110423,
    "pidStart": "8016839",
    "exitObserved": true,
    "exitCode": null,
    "signal": "SIGKILL"
   },
   "state": "ENTERED",
   "cloudTerminationProven": false
  }
 },
 "full/b1a-native-kill-classification": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "result": {
   "identity": {
    "pid": 129648,
    "state": "T",
    "startTime": "8038128"
   },
   "exit": {
    "decisionAt": 1794603789479,
    "at": 1794603789488,
    "pid": 129648,
    "pidStart": "8038128",
    "exitObserved": true,
    "exitCode": null,
    "signal": "SIGKILL"
   },
   "activity": {
    "scope": "local:129648:8038128",
    "connect": [
     1794603789451,
     1794603789455
    ],
    "write": [
     1794603789461,
     1794603789462
    ],
    "providerArrival": 1794603789489
   },
   "classification": {
    "verdict": "PRE_FENCE",
    "reason": "pre_fence_bytes_may_arrive_later"
   },
   "cloudContainmentProven": false
  }
 },
 "full/b1a-native-sql-tls": {
  "maxRequestPerAttempt": 0,
  "maxEffectPerAttempt": 0
 },
 "full/b1a-proof-bad_epoch": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "result": {
   "state": "UNKNOWN",
   "mode": "BAD_EPOCH"
  }
 },
 "full/b1a-proof-bad_revision": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "result": {
   "state": "UNKNOWN",
   "mode": "BAD_REVISION"
  }
 },
 "full/b1a-retired-recovery": {
  "maxRequestPerAttempt": 0,
  "maxEffectPerAttempt": 0,
  "result": {
   "neverRearmed": true,
   "originalBindingsPreserved": true,
   "crossScopeDenied": true,
   "cloudRetirementTested": false
  }
 },
 "full/b1a-sealer-ack": {
  "maxRequestPerAttempt": 0,
  "maxEffectPerAttempt": 0,
  "result": {
   "verifiedCommitBeforeAck": true,
   "unavailableStatus": 503,
   "journalUnavailableNoAck": true,
   "cloudColdStartMeasured": false
  }
 },
 "full/b1a-session-budget-hold": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "result": {
   "state": {
    "epoch": 2,
    "scopeId": "6a0575df-2852-448c-bc51-20dd9528668c",
    "revision": "inc1-r2",
    "expiresAt": "2026-11-13T21:04:14.381+00:00",
    "sessionId": "1adf09fa-4cea-4182-8d02-685ddee00118",
    "generation": 5,
    "holdReason": "FENCE_INCOMPLETE",
    "retiredEpoch": 1,
    "dispatchEnabled": false,
    "retiredRevision": "inc1-r1"
   },
   "monthlyResetAutomaticPromotion": false,
   "cloudBudgetSystemTested": false
  }
 }
}```
</details>

<details><summary>P5 probe: late authenticated old-epoch initiation vs the 60 s clock window (uses Codex's cloudFixture)</summary>

```js
// CLAUDE REVIEW PROBE P5 (review-only): late authenticated old-epoch initiation vs 60 s clock window.
const root = process.argv[2];
const { classify } = await import(root + "/src/classify.mjs");
const { cloudFixture } = await import(root + "/test/evidence-fixture.mjs");
const base = { measuredAt: 1000, validUntil: 61000, driftPpm: 50 };   // max allowed window: 60 s
const metrics = { at: 30000, reportingDelayMs: 1000, maxAgeMs: 100000, coverUntil: 60000,
  samples: [{ at: 40000, instances: 0 }, { at: 60000, instances: 0 }] };
const cases = {
  connect_10s_after_fence_inside_window: { now: 70000, act: { connect: [40000, 40010] }, fence: metrics },
  connect_150s_after_fence_complete_metrics: { now: 200000, act: { connect: [180000, 180010] }, fence: { ...metrics, maxAgeMs: 200000 } },
  connect_150s_after_fence_incomplete_metrics: { now: 200000, act: { connect: [180000, 180010] }, fence: { ...metrics, samples: [] } },
  connect_10min_after_fence: { now: 700000, act: { connect: [630000, 630010] }, fence: { ...metrics, maxAgeMs: 700000 } },
};
const out = {};
for (const [k, c] of Object.entries(cases)) {
  const d = cloudFixture({ now: c.now, clock: base, fence: c.fence, activity: c.act, envelope: { issuedAt: c.now - 5, expiresAt: c.now + 500 } });
  out[k] = { uncertaintyMs: d.uncertaintyMs, ...classify(d) };
}
console.log(JSON.stringify(out, null, 1));
```
</details>

<details><summary>P5 output</summary>

```json
{
 "connect_10s_after_fence_inside_window": {
  "uncertaintyMs": 5,
  "verdict": "VIOLATION",
  "reason": "post_fence_initiation"
 },
 "connect_150s_after_fence_complete_metrics": {
  "uncertaintyMs": 5,
  "verdict": "NOT_PROVEN",
  "reason": "event_outside_clock_measurement"
 },
 "connect_150s_after_fence_incomplete_metrics": {
  "uncertaintyMs": 5,
  "verdict": "NOT_PROVEN",
  "reason": "event_outside_clock_measurement"
 },
 "connect_10min_after_fence": {
  "uncertaintyMs": 5,
  "verdict": "NOT_PROVEN",
  "reason": "event_outside_clock_measurement"
 }
}
```
</details>

<details><summary>Adapted rerun: independent verification of my own raw exports</summary>

```json
{
 "ledgers": 25,
 "testedSource": [
  "38ad02abbb0b7353f6768ff67f74542a4df0dedb"
 ],
 "db/b1a-asynchronous-v1": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "schedules": 400,
  "kills": 130,
  "continued": 270,
  "stoppedT": 400,
  "resultLedgerMismatch": 0,
  "killExitObservedSamePidStart": 130,
  "oldTraceAfterExit": 0,
  "ledgerRequestAfterExit_byOldProcess": 0,
  "resendAfterUnknown": 0,
  "replayOfArmedSentOnce": 11,
  "controlMode": {
   "RESUME": 181,
   "EXPIRE": 86,
   "REVOKE": 133
  },
  "classification": {
   "NOT_PROVEN": 340,
   "PRE_FENCE": 60
  },
  "durable": {
   "APPLIED": 197,
   "UNKNOWN": 193,
   "ARMED": 8,
   "EXPIRED": 2
  }
 },
 "db/b1a-cross-product-v1": {
  "maxRequestPerAttempt": 1,
  "maxEffectPerAttempt": 1,
  "schedules": 1080,
  "cells": 54,
  "minPerCell": 20,
  "maxPerCell": 20,
  "resultLedgerMismatch": 0,
  "stoppedT": 1080,
  "resumedSameStart": 1080,
  "afterCommitREVOKE_effects": "Counter({('DROP', 'UNKNOWN', 1): 20, ('OK', 'APPLIED', 1): 20})",
  "beforeAuthorityREVOKE": "Counter({('DENIED', 'ARMED', 0): 40})",
  "classification": "Counter({'NOT_PROVEN': 1080})",
  "durable": {
   "APPLIED": 340,
   "UNKNOWN": 660,
   "ARMED": 40,
   "EXPIRED": 40
  }
 }
}
```
</details>

### C. External facts used
- **Cloud Run `run.googleapis.com/container/instance_count`:** "Sampled every 60 seconds. After sampling, data is not visible for up to 120 seconds." It has a `state` label (active/idle), and the same metric applies to `cloud_run_worker_pool`. Source: [Google Cloud metrics list](https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z). This is the basis for D-2.
- **Regional internal Application Load Balancer:** "$0.025 / 1 hour" per proxy instance, "at least three proxy instances… even if the load balancer handles no traffic", i.e. $0.075/h in us-central1; $0.008/GiB processed; no separate forwarding-rule charge. Source: [Load Balancing pricing](https://cloud.google.com/load-balancing/pricing).
- **Cloud SQL PSC:** not transitive across peered VPCs; one endpoint per VPC; project allowlist. Source: [About Private Service Connect](https://docs.cloud.google.com/sql/docs/postgres/about-private-service-connect). The page is silent on shared-core/CAS-CA compatibility, which remains unverified.
- **ADR-005 Phase 3a inventory** (PR #6 `83907db`): "dedicated `nm-proof3a-run` project: … Cloud Run ingress/sealer and gateway …; `nm-proof3a-custody`: versioned unlocked evidence bucket plus test KMS key, independent admin". This is the basis for O-1.

### D. Static IaC/controller cross-check (basis for D-3)
- **Kill custom role `nmb1a_kill` permissions:** `run.revisions.get/list/delete`, `compute.firewalls.get/update`, `secretmanager.secrets.get/setIamPolicy`, `cloudkms.cryptoKeys.get/setIamPolicy`.
- **Controller step 3** `gcloud run services update-traffic nmb1a-gateway --to-revisions=…=100 --clear-tags … --impersonate-service-account=nmb1a-kill@…` needs `run.services.update` (not granted).
- **Teardown** `run worker-pools delete` and `run services delete` also default to the kill SA, which lacks those permissions.
- **Fake project:** egress is deny-all (IPv4/IPv6), with no restricted-VIP allow or route and no operator ingress. Yet `nmb1a-fake` holds `roles/storage.objectCreator` on the custody bucket (basis for P-4).


---
_Generated by [Claude Code](https://claude.ai/code)_
