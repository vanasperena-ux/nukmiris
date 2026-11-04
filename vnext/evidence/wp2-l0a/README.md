# WP2-L0a reproducible results

**Tested source:** `edbb0d226b000761b8e0173470f6e3cae69b25c9`.
Tree: `a3ce3bf687761655e5df5b3e9191414208fd4b7e`.
Parent: `84ff73d36cc6defc493a30a4f07445e4818ce1c8` (accepted WP1 evidence head).
The follow-up commit adds only this evidence directory and the independent review
handoff. [48 source hashes](source-sha256.txt) bind implementation, tests, scripts,
lockfile/package and tsconfig. The accepted v0.8.1 tree/data were not modified.

WP1 closure is [independently accepted](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6620571487)
for bounded synthetic use. **L0a independent acceptance is pending.** These are
Codex-executed results, not a Claude review.

| Check | Result |
|---|---|
| Clean dependency installation | PASS; `npm ci --ignore-scripts --offline --cache /workspace/work/wp1-npm-cache`, 18 pinned packages |
| TypeScript / source confinement | PASS; [checks.log](checks.log) |
| Full suite | **137/137 PASS**, zero skipped/cancelled; [full.log](full.log) |
| Fault suite | **127/127 PASS**, zero skipped/cancelled; [fault.log](fault.log) |
| Regression coverage | All prior 98 full / 88 fault tests retained; 39 archive/integration/process cases added |
| Capacity / full repair | **PASS**, 1k/10k/100k/1M corpus; [capacity.log](capacity.log) and [capacity.json](capacity.json) |

Both full/fault runs use **Node v24.19.0** and **PostgreSQL 17.11
(Debian 17.11-1.pgdg12+2)**. The Docker image is pinned to
`postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`;
PG container network is `none`, clients use its uniquely generated Unix socket,
and every database/role fixture is disposable. Fake provider HTTP binds loopback
only; no real Meta/Google call or cloud provisioning occurred.

The full run includes 1,000 seeded real-SQL schedules, existing C1/C4 regressions,
the deliberately retained F13 residual counterexample, all archive corruption/
rollback/rotation/capacity/tenant cases, four actual SIGKILL append cuts, six
competing processes, stale-writer fencing and interrupted repair. Guarded SQL
integration verifies UNKNOWN keeps protection and cannot resubmit; read-only fake
proof finalizes once; missing ARM and pre-gate suspension produce zero calls;
restore stays inert and corruption makes completeness unknown. The native Windows
process/PG harness remains unverified.

## Capacity observations

The actual `ensureBatch` API creates the corpus, capped at 1,000 records per
transaction. At each size, the archive is closed/reopened and 100 known keys plus
100 absent keys are sampled. Each hit decrypts exactly one record; each miss
decrypts none. No normal full audit runs. OS caches are not flushed: these are
API measurements after reopen, not cold-disk measurements or an SLO.

| Records | Hit p50 / p95 / p99 (ms) | Miss p95 (ms) | Max authenticated node reads | Archive bytes | Process RSS bytes |
|---:|---:|---:|---:|---:|---:|
| 1,000 | 0.363 / 0.997 / 2.454 | 0.583 | 12 | 1,712,128 | 64,667,648 |
| 10,000 | 0.400 / 0.655 / 9.296 | 0.538 | 15 | 16,666,624 | 153,497,600 |
| 100,000 | 0.397 / 0.518 / 0.764 | 0.445 | 19 | 166,649,856 | 311,263,232 |
| 1,000,000 | 0.482 / 0.880 / 28.756 | 0.596 | 23 | 1,667,801,088 | 358,408,192 |

At one million records, twelve actual guarded admissions and calendar mutations
use distinct synthetic customers. Two concurrent dispatchers race each attempt:
one APPLIED, one HELD; exactly **12 fake-provider invocations** and 12 appointments.
Admission p50/p95: **11.50 / 29.65 ms** (12 samples); concurrent dispatch p50/p95:
**6.76 / 21.97 ms** (24 samples, including held contenders). There are no ordinary
full archive scans. Raw samples and host/SQLite versions are in [capacity.json](capacity.json).

A real SIGKILL after data commit leaves the added ARM tail held. Explicitly fenced
repair authenticated/rebuilt **1,000,097 records** in **340.167 seconds** (5m40s),
preserved the original ARM owner/identity and verified older history without replay
or reallocation. Peak process RSS was **419,860,480 bytes** (about 400 MiB). The
complete corpus/workflow/crash/repair run took **723.742 seconds** (12m04s). Cold
recovery is linear and keeps writers/readers held; this measured downtime is a
local operational limit to verify on the owner's Windows storage before acceptance.

The 1.1M hard capacity policy rejects new records before allocation, permits exact
existing-key replay, and never evicts history. File size here excludes forensic
copies, rebuild staging and WAL; reserve additional disk for all three. Published
RSS/latencies describe this host/run; they are not production sizing guarantees.

## Reproduce and review

Checkout the source SHA, then from `vnext/` with Node 24, npm 11 and Docker:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm run test:archive
npm test
npm run test:fault
npm run test:archive:capacity
```

Capacity takes minutes and several GB of local disk. The script prints its unique
ignored evidence directory. It places forensic copies there and archive data in
an isolated OS temp directory. Never point it at v0.8.1 paths/data. The reviewed
script regenerates random synthetic fixture keys and witness; it does not need
production secrets or published encrypted state to reproduce the experiment.

Only readable logs, synthetic measurement summaries and hashes are published.
SQL snapshots, encrypted archive databases, forensic copies and test keys remain
local; the raw state is not attached. Artifact hashes cover the readable published
files. This does not claim byte-for-byte reproduction of random fixture IDs or
host timing.

Protocol/trust limits: [implementation 17](../../../docs/greenfield/17-WP2-L0A-INDEXED-ARCHIVE.md).
Independent stop/go checklist: [Claude handoff](../../../docs/greenfield/reviews/06-CLAUDE-WP2-L0A-REVIEW-HANDOFF.md).
Production 009/011/017, F13/001, provider contracts 013/016 and all OPS01 activation
gates remain open. Same-host fixture custody, process death and SQLite FULL do not
prove offsite retention, host power-loss durability, native Windows operation or
production sealer authentication. After independent L0a acceptance, implement
L0b's sealed classification/terminal reductions and reservation priority tests
before booking/UI expansion; complete Windows L0 runtime prerequisites toward
the L1/L2 booking demo.
