# L0a B1/B2 correction evidence

**Tested source:** `ff45a8e9b41fa9be99e773ff053c6cd6a1ea38b7`.
Tree: `4447bea4a410bf570566fd439eeaf9cd29d896fb`.
Parent/reviewed baseline evidence: `a376f1eb51205b392e7ec0355bc8ac64525c8319`.
The evidence follow-up changes only this directory and handoff 07/status note 06.
The [51 source hashes](source-sha256.txt) cover all source, tests, scripts, package/
lockfile and tsconfig. Baseline reports retain their original pinned measurements;
their README trust-boundary wording is explicitly corrected for B2.

Review basis: [Claude GO WITH CONDITIONS](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6622229074).
**These are Codex-executed corrections/results. L0a remains OPEN until independent
Claude re-verification accepts B1/B2. L0b has not started.**

| Check | Result / readable evidence |
|---|---|
| Node / PostgreSQL | **v24.19.0 / 17.11 (Debian 17.11-1.pgdg12+2)** in both full/fault runs |
| Typecheck / confinement | PASS; [checks.log](checks.log) |
| Archive suites | **51/51 PASS**, zero skips; [archive.log](archive.log) |
| Dedicated concurrency | **20/20 PASS**, zero skips; [concurrency.log](concurrency.log) |
| Full | **155/155 PASS**, zero skips; [full.log](full.log) |
| Fault | **145/145 PASS**, zero skips; [fault.log](fault.log) |
| Capacity / killed-appender repair | **PASS**, 1k/10k/100k/1M plus full 1,000,097-record repair; [capacity.log](capacity.log), [capacity.json](capacity.json) |

The full/fault suites retain all earlier 137/127 cases plus 18 new regressions.
Image: `postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`.
DB containers have `--network none`; guarded PG roles use unique disposable Unix-
socket fixtures. Fake HTTP providers bind loopback only. The retained F13 physical-
cutoff counterexample still reproduces. No real provider or GCP action is included.

## What the new tests establish

B1's forced await barriers reproduce X4's service-concurrency shape: sixteen
distinct keys all commit, sixteen identical keys allocate exactly once, and lookup/
verify/records wait across before-data-commit, after-data-commit and after-witness-
commit cuts. Instance repair uses that same mutex and admits queued calls only
after completion. Rollback releases connection ownership; post-commit failure
releases the mutex **without** erasing the pending hold. Real SQLite contention
across connections, the 64-operation queue bound and active-close protection return
typed `ArchiveBusyError`. Original process SIGKILL/recovery/convergence tests pass.

**B2/X1 is REPRODUCED, not fixed.** The security-boundary test uses archive HMAC/AES
keys and the original witness writer read/CAS capability; it never accesses the
original witness signing key or operator repair permit. A larger fork obtains a
valid signature, replaces `ORIGINAL-OWNER` with `FORGED-OWNER`, loses `history/1`
into authenticated absence, passes cold audit and reopens even with the *older*
minimum checkpoint. It then actually reallocates that original key. This expected
counterexample is a passing test for the documented residual, not a passing
production integrity guarantee. It is adapted from Claude's published X1.

The checkpoint witness checks CAS and monotonic size/epoch. It **does not
independently verify append-only extension of either record chain or key index**.
History integrity assumes honest writer code/keys. Documentation cannot resolve
this production vulnerability. Independent verification of **both** extension
properties is mandatory under production 009/017 before any non-fixture custody;
chain-tip extension alone is insufficient. See [requirements 16 additions](../../../docs/greenfield/16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md).

N4 tests reject foreign/null `businessId` recursively in nested envelopes, intent
payloads and arrays, both in match and allocation, before sealing. Same-tenant
nested records survive read/repair. Existing PG mixed-batch STOP/binding refusal
continues to pass; that does not implement N5 multi-tenant admission binding.
N1 distinguishes pending/repair/busy, with caller wiring still required before
inbound expansion. N3 explicitly demonstrates a pre-existing transaction committing
after witness fencing, failing CAS and being adopted with its original owner.
N2 partial forensic publication is still unresolved at production gate 011.

## Capacity and recovery observations (N6)

| Records | Hit p50 / p95 / p99 (ms) | Miss p95 (ms) | Max node reads | Archive bytes | Process RSS bytes |
|---:|---:|---:|---:|---:|---:|
| 1,000 | 0.451 / 0.642 / 1.709 | 0.439 | 12 | 1,712,128 | 72,347,648 |
| 10,000 | 0.385 / 0.510 / 17.408 | 0.385 | 15 | 16,666,624 | 156,635,136 |
| 100,000 | 0.404 / 0.559 / 1.117 | 0.447 | 19 | 166,649,856 | 319,512,576 |
| 1,000,000 | 0.444 / 0.549 / 0.833 | 0.423 | 23 | 1,667,801,088 | 316,973,056 |

Each hit decrypts one record, each miss none, with no ordinary full audit. Root
height 24, at most 23 node reads and 1,667,801,088 archive bytes at 1M match the
reviewed baseline. Samples are after reopen with OS caches retained. Twelve guarded
PG workflows with two competing dispatchers each produce exactly 12 fake calls
and 12 appointments. Admission p50/p95: **13.48 / 29.35ms**; concurrent dispatch
p50/p95: **7.68 / 18.77ms** (includes held contenders). Raw samples are in capacity.json.

After a real SIGKILL after data commit, lookup stays held. Explicit fenced repair
authenticates/rebuilds **1,000,097 records in 334.796 seconds** (5m34.8s), preserves
the original ARM owner/identity and older history, and does not replay or reallocate.
Peak process RSS: **416,493,568 bytes** (about 397 MiB). Whole capacity/workflow/
crash/repair run: **704.289 seconds** (11m44.3s). Node v24.19.0 / SQLite 3.53.3.


Measurements are host observations, not SLOs or Windows acceptance. Repair is
linear and holds reads/writes. Reserve roughly 3× archive disk plus headroom for
backup/staging/WAL; published archive bytes alone exclude those temporary files.
Process SIGKILL is not a filesystem/host power-loss proof. Native Windows storage,
locks, child lifecycle, RAM/disk budgets and owner smoke remain open.

## Reproduce / stop-go

Checkout the tested source; from `vnext/` with Node 24/npm 11/Docker:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm run test:archive
npm run test:archive:concurrency
npm test
npm run test:fault
npm run test:archive:capacity
```

The capacity wrapper builds then runs `node scripts/archive-capacity.mjs`; that
script was executed after build here. It generates the actual API corpus, races
guarded PG dispatchers at 1M, kills an appender and fully repairs history. Generated
fixture keys, SQL snapshots, archive databases and incomplete/completed forensics
stay local/ignored. Only readable logs, measurement summaries and hashes are
published. The source/commands regenerate random fixture IDs; timing is host-specific.

[Independent re-verification handoff 07](../../../docs/greenfield/reviews/07-CLAUDE-WP2-L0A-B1-B2-REVERIFICATION.md)
asks Claude for explicit B1/B2 acceptance and bounded local L0a closure. The
[owned N1–N6 register](../../../docs/greenfield/18-WP2-L0A-B1-B2-AND-FOLLOWUPS.md)
requires N1 caller handling, N4 validation acceptance and N5 route/custody binding
before L0b expands inbound. N2/N3 remain recovery gates; N6 remains operational.
Production 009/011/017, 001/F13, 013/016, OPS01, Windows, provider and merge/GCP
gates are unchanged. v0.8.1 and its working data were not modified.
