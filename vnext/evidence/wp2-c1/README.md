# C1 conversation progress correction evidence

Exact tested source **`c46f22949fa996a1a79139218d768c51013dec6b`**, tree
`8cbf8143ef413dfd045b703ed393b4f4274d149e`, parent L0b head `a0eca88c`.
Only this directory and handoff 09 follow that source; no runtime code changes.

Node **24.19.0**, PostgreSQL **17.11** pinned image, Linux Unix-socket harness:

| Command in vnext | Result | Evidence |
|---|---|---|
| npm test | 259/259, zero skips | [full.log](full.log), [environment](full-environment.json) |
| npm run test:fault | 249/249, zero skips | [fault.log](fault.log), [environment](fault-environment.json) |
| npm run test:concurrency | 120/120, zero skips | [concurrency.log](concurrency.log), [environment](concurrency-environment.json) |
| npm run typecheck / npm run check:scope | PASS | [static.log](static.log) |

The 52 new progress/O2/O4 cases are included in each run. Suites overlap. The
dedicated `npm run test:progress` command selects them. Install with Node 24/npm11,
`npm ci --ignore-scripts`, then execute the commands above at the exact source.
[Source hashes](source-sha256.txt), [artifact hashes](artifact-sha256.txt),
[summary](summary.json), [implementation](../../../docs/greenfield/20-C1-NORMAL-CONVERSATION-PROGRESS.md).

C1 covers both priority messages, both attempt types and PREPARED/ARMED, real child
crash/SIGSTOP before arm/entry, both concurrent entry/supersession orders,
confirmation expiry/entry orders, failed custody, SQL rollback/COMMIT loss, MOVE
source restoration and protected entered/UNKNOWN. The accepted full regressions
remain, including NULL argument denial. O2 distinguishes PLAN_INVALID from genuine
resource/output conflicts; O4 rejects punctuated aliases and accepts representative
synthetic provider field names. Actual Meta contract compatibility stays gate 016.

**Independent C1 verification is pending before L2.** Windows L0/L1 implementation
is authorized by Claude's L0b GO WITH CONDITIONS. X1/F13 still reproduce; this
correction does not fix production history-extension integrity or physical cutoff.
009/011/production-017, N2/N3, A2/A3, 013/016, OPS01 and native Windows/N6 remain.
v0.8.1, migrations 001–004 and roles.sql are unchanged. No merge/providers/GCP.
Generated SQL/archive/forensic/key state stays local; only readable evidence is
published. Native Windows is not established by Linux process tests.
