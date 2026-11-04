# WP1 CP1 / initial CP2 evidence

**Source commit:** [`108adb62604b9963bd3468ab8b43c36b69fcef6e`](https://github.com/vanasperena-ux/nukmiris/commit/108adb62604b9963bd3468ab8b43c36b69fcef6e).
Owner approved WP1 on 2026-11-01. This is Codex implementation/test evidence;
**independent Claude review remains NOT RUN**. No WP2, live provider, merge or
deployment is authorized. Read the [actual review handoff](../../../docs/greenfield/11-WP1-CLAUDE-REVIEW-HANDOFF.md).

## Reproduction and integrity

From isolated `vnext/`, Node 24.19.0/npm 11.9.0:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:fault
```

This execution used a workspace npm cache and sandbox permission for local sockets.
PostgreSQL 17.11 image digest is pinned in the fixture. Its container has no
network, published ports or persistent volume; clients use a mounted Unix socket.
Fake HTTP providers run only on loopback. No working POC data/credentials were read.

[Tested source manifest](tested-source-manifest.json) includes 34 implementation,
test, script, package/lock/config and README file SHA-256 values. Canonical manifest
SHA-256: `cd2555827b219f03dac7c86b7790a5b38dad5649e0a4f4a796d73b778fba4645`.
The final evidence-only commit does not change these tested files. Compare hashes
after checkout; compiled `dist/` and installed dependencies are not committed.
[Artifact manifest](artifact-manifest.json) hashes the evidence files (excluding
the manifest itself to avoid a circular digest).

## Results and complete stored evidence

| Artifact | Actual result / interpretation |
|---|---|
| [Full raw log](full-test-output.txt) | **64 passed, 0 failed/cancelled/skipped**, 19.297 s |
| [Fault raw log](fault-test-output.txt) | **54 passed, 0 failed/cancelled/skipped**, 12.921 s; separate fresh cluster |
| [Static checks](static-checks.txt) | Strict TS and source/dependency/client confinement passed |
| [Dependency audit](dependency-audit.json) | npm reported **0 known vulnerabilities**, 18 dependency entries; not a security certification |
| [Full environment](full-environment.json), [fault environment](fault-environment.json) | Exact Node/PG/image and isolation profile |
| [Database inventory](database-inventory.json) | Executed-schema table owners/RLS, roles, definer/search-path/function ACLs and actual table grants |
| [1,000 schedules](seeded-schedules.json.gz) | **1,000 seeds / 1,000 distinct orders** using real restricted-role SQL gate/revoke/status functions; no HTTP calls in this exploration |
| [Full boundary traces](full-boundary-traces.json.gz), [fault traces](fault-boundary-traces.json.gz) | Original IDs, rows, permission/status heads and fake-provider invocation counts for named cases |
| [Full SQL snapshots](full-sql-snapshots.tar.gz), [fault SQL snapshots](fault-sql-snapshots.tar.gz) | Consistent compressed pre-cleanup fixture snapshots, retained before destroying disposable DBs |
| [Full snapshot manifest](full-fixture-manifest.jsonl), [fault manifest](fault-fixture-manifest.jsonl) | Each snapshot's uncompressed SHA-256, unique fixture DB and local diagnosis directory |
| [F13 residual counterexample](F13-RESIDUAL-LATE-SUBMISSION.json) | **REPRODUCED**, not a proven physical cutoff; details below |
| [Development findings/dispositions](development-findings.json) | Setup/permission/cleanup/assertion corrections before the final frozen runs; not an independent-review disposition |

All data is synthetic. Snapshot archives contain only named fixture SQL state;
no real OAuth, Meta, payment, production DB or working POC secret is included.
The synthetic archive encryption keys are not published. SQL seals/traces retain
original fake evidence bodies/identity hashes needed for review. Local fixture
files remain under `/tmp/nukmiris-wp1-*` for diagnosis. No snapshot is a deployment
or migration artifact.

## Requirement → case → evidence → result → reviewer

Executor/reviewer of every local row below: **Codex**. Independent reviewer:
**pending Claude**. These are scoped local results, not universal provider proofs.

| Requirement | Actual cases | Evidence | Result |
|---|---|---|---|
| INV01/02; SC1/2; Q7; DB01 | F01–07, all A1–A5 cuts, signature/route/conflict/repack and staged claim denial | ingress test names in full log, F03 boundary traces | PASS local |
| INV03; SC4; DB02–04 | Same-event all mutator kinds, actual two-session same-resource race, distinct resources, finite ranges, source/target merge, buffer/duration retention | database log + DB03/state snapshots | PASS local |
| INV04/05; SC5/6; DB06 | Duplicate loops/owners, before/after ARM SIGSTOP/SIGKILL, lost commit/response, conservative unknown HTTP classes, read-only reconcile | dispatch/process logs, F11/F14 rows and provider calls | PASS local single-invocation/fail-closed scope |
| INV06; DB05 | Four finalizer statement failures, result-archive outage, idempotent repeat and stale result vs successor guard | F16/F18/F19 log and stored before/after rows | PASS local |
| INV07; SC7 | Receipt before response, failed after read, wrong recipient/orphan, uncertain output barrier vs unsent expiry | F20/F22 traces + dispatch log | PASS local |
| INV08; SC8; DB07 | Unknown head creation, archive outage, STOP during preflight and actual PG row-lock wait, stale/tied/future grants | permission log, F12/heads, 1,000 SQL schedules | PASS local |
| INV09/13; G06; DB08 | Due/deadline/budget/calendar revision, queued mutation/message suspension, no stale replay after reactivation | database/dispatch/permission logs and schedules | PASS synthetic gate; full reminder/billing workflows deferred |
| INV10; SC3/11; SEC01–04 | Raw signature/receiving route, composite tuple/FK, RLS/SET ROLE/context/pool, PUBLIC function ACLs, copied/wrong proof denial, receipt not command | full log + database-inventory + snapshots | PASS tested local cases; production auth/MFA/KMS deferred |
| INV11; SC13; REC01 subset | SQL destruction after snapshot, grant→STOP/unknown STOP, original missing identities held, broken prefix/tail/head/witness/key/version | REC01 traces, SQL snapshots and source-ID cases | PASS inert hold; no operational resume implemented |
| INV12; SC14 / Q13 | Old-process restart and lost SQL snapshot/possible ARM retains hold | process/restore logs | PASS local subset; real HA/fencing NOT RUN |
| F13 / OPS01 | Pause after gate, suspend, prevent successor, resume original | dedicated F13 JSON and process log | RESIDUAL REPRODUCED; production activation blocked |
| C5 scope | No source provider/HTTP/env/FS/child-process client; no app start/deployment; accepted backend/static/config diff empty | static-checks + PR diff/source manifest | PASS |
| C6 independent review | Actual diff + protocols + failure matrix + logs/rows handed off | docs/greenfield/11 | NOT RUN / pending Claude |

F26 proves old-key retention and fail-closed missing/corrupt local evidence, not
complete KMS rotation. F27 is synthetic final admission timing, not all four P0
reminder intervals. F29 is local snapshot/old-worker closure, not real managed
failover. No native Windows, actual provider, offsite archive, production privacy
or uptime guarantee is established.

## Explicit residual and stop

The F13 trace has one submission admitted **before** suspension and physically
invoked after the paused process resumes. It also shows a successor denied, so
there is one invocation, not two. This demonstrates why a SQL gate/lease cannot
retract an already admitted HTTP request. It is retained as an OPS01 deployed
containment blocker before activation; its test does not silently weaken G06.

The file archive shares this machine/failure domain. Missing trusted head/witness
fails closed; simultaneous rollback of all trusted custody cannot be certified by
an old internally consistent chain. Restore is intentionally inert, never a new
effectful reducer replay. Prototype role scopes/local PG trust and fault-injection
entry points are not production defaults. **Stop for independent CP1/initial CP2
review; WP2 has not started.**
