# INC1 measured local evidence — tested source3204e73

Implementation **3204e73c823d7e552c0aacad74294617490465f6**, tree
**e77226c95b35855b551ae680d0a6488f3cde1d78**, branch
`implementation/inc1-local-gateway-proof`, [Draft PR20](https://github.com/vanasperena-ux/nukmiris/pull/20).
This evidence publication is additive; it changes no tested runtime, test, SQL,
IaC or calculator code. [Machine-readable pins/results](publication.json).

| Command | Pass | Fail / skipped |
|---|---:|---:|
| `npm test` |22 (includes fixture parent/subtest) |0 /0 |
| `npm run test:fault` |8 |0 /0 |
| `npm run test:concurrency` |1 |0 /0 |
| native Terraform1.17.2/Google8.11.0 validate |valid |0 errors /0 warnings |

Suites overlap. Full and fault each contain 1,000 real SIGSTOP/SIGCONT schedules,
with the same deterministic shuffle seed 448864294 and independent process
wake-ups: 2,000 executed schedules, not 2,000 independent random seeds. These are
**instrumented suspension-point schedules covering 18 of 27 pause-point ×
control-mode combinations**, not complete cross-product or arbitrary-instruction
coverage. The A-1 correction below defines their coverage precisely. Each run
observed 811 provider invocations/effects, maximum 1/attempt; caller outcomes
739 APPLIED, 149 UNKNOWN, 12 EXPIRED, 100 DENIED. The 100 denied attempts remain
ARMED under revoked authority, never permitted.

All1,000 cases/run classify physical containment **NOT_PROVEN**, because SQL epoch
revocation or absent cloud evidence does not establish termination. Cloud class
examples are unit fixtures only. Each full/fault run additionally executes20
live-silence counterexamples and20 killed-canary delayed wakes:0 post-local-exit
invocations. Independent provider ledgers prove only local fake effects, not real
provider acceptance/idempotency or cloud retirement.

## A-1 — original campaign coverage correction

This additive documentation correction addresses **A-1 / F-1** in
[Claude's review, §3 item 3 and §5](https://github.com/vanasperena-ux/nukmiris/pull/20#issuecomment-6838315312).
Claude's **GO WITH CONDITIONS** is tied to implementation
`3204e73c823d7e552c0aacad74294617490465f6`; it is not a review of this correction.
The original source/tree pins, raw archives, results, logs and hashes are retained.
No implementation change or new gateway/provider execution accompanies A-1.

Each original full/fault campaign has the following counts. A zero marks a
combination **not exercised by that campaign**; repeating its seed does not add
missing combinations.

| Instrumented pause point | RESUME | REVOKE | EXPIRE |
|---|---:|---:|---:|
| `beforeAuthority` | 0 | 100 | 12 |
| `beforeCommit` | 100 | 0 | 11 |
| `afterCommit` | 100 | 0 | 11 |
| `beforeConnect` | 0 | 100 | 11 |
| `afterConnect` | 100 | 0 | 11 |
| `afterTls` | 100 | 0 | 11 |
| `beforeWrite` | 0 | 100 | 11 |
| `midWrite` | 100 | 0 | 11 |
| `afterWrite` | 100 | 0 | 11 |

The nine unexercised combinations are:

- **RESUME:** `beforeAuthority`, `beforeConnect`, `beforeWrite`.
- **REVOKE:** `beforeCommit`, `afterCommit`, `afterConnect`, `afterTls`,
  `midWrite`, `afterWrite`.

The pause point uses `cuts[i % 9]`, while the control mode uses
`i % 10 === 0 ? EXPIRE : i % 3 === 0 ? REVOKE : RESUME` before shuffling.
Those choices are correlated; randomizing order and delay does not create an
independent cross-product. In particular, `beforeCommit × REVOKE` is absent from
the campaign (it is covered once separately in `permission.test.mjs`), and
`afterCommit × REVOKE` is absent. The 100 DENIED cases are exactly
`beforeAuthority × REVOKE`.

**Stops were real, but parked at hooks.** The gateway first reached an
instrumented `await hook()` suspension point; the parent then issued SIGSTOP,
observed `/proc` state `T`, and an independent sibling issued SIGCONT after
checking PID start time. This did not stop the gateway at arbitrary asynchronous
instructions or demonstrate every check-to-syscall interleaving.

**Raw field interpretation:** in `campaign/result.json`, each outcome's `mode`
contains the **provider mode (`OK` or `DROP`)**, not the control mode
(`RESUME`, `REVOKE`, `EXPIRE`). Evidence generation spread `...s` then `...b`;
the binding's `b.mode` overwrote the schedule's `s.mode`. The separate
`providerMode` field also contains the provider mode. Recover the original
control mode by regenerating the seeded schedule; `authorityFenceAt` corroborates
REVOKE, but its absence alone cannot distinguish RESUME from EXPIRE. The outcome
`i` is the shuffled execution index, not the pre-shuffle generation index.
This field defect is documented here; the historical raw files are not repaired.

For this correction, offline regeneration matched all 1,000 point/provider-mode/
delay tuples in each original full/fault archive and all REVOKE/fence indicators.
This was inspection of existing data, not a rerun of the gateway test suites.

### Separate independent evidence — Claude P1–P4

[Claude's supporting evidence](https://github.com/vanasperena-ux/nukmiris/pull/20#issuecomment-6838315843)
contains the adapter diff, coverage-regeneration script, probes and outputs.
Claude reports **4/4 probe checks** on Linux **Node 22.23.4 / PostgreSQL 16.15**,
`pg@8.16.3`, UTC, fsync/synchronous_commit on. Only `test/helpers.mjs` was adapted
to replace Docker with fresh local PostgreSQL clusters; `src/` was unchanged.
This is separate from the original **Node 24.19.0 / PostgreSQL 17.11 / Docker**
environment. Claude did not execute its Docker/volume-cleanup test, exact pinned
environment or Terraform validation. These probes were review-only, not committed
to the original harness, and were not rerun for A-1.

| Probe | Independent evidence and limits |
|---|---|
| P1 | COMMIT dropped before reaching PostgreSQL: caller UNKNOWN, durable ARMED; later replay produced exactly one request/effect. Durable state remains authoritative. |
| P2 | **54 combinations = 9 pause points × 3 control modes × 2 provider modes**, 20 schedules each (1,080 total). At most one request/effect/connect per attempt in every cell. This covers the original missing combinations independently; it does not expand the original campaign's 18/27 coverage or implement B-1. SQL retirement still permits pre-authorized effects (F13 residual). |
| P3 | 400 uninstrumented asynchronous stop trials, without hooks: 270 continued, 130 directly killed; no request after the kill call in those trials, at most one request/effect. This asynchronous coverage belongs to Claude's adapted environment, not the published campaign. |
| P4 | Reproduced classifier masking of a post-fence connect when CLOUD evidence was incomplete, plus the 2 ms default-uncertainty boundary. Passing this probe means reproducing the counterexample, not resolving it; B-2 remains open. |

A-1 changes claims only. B-1–B-8 and all existing cloud, custody, provider and
OPS01 gates remain. No B1a work or provisioning is authorized. This correction
has not itself been independently reviewed by Claude; local acceptance can be
recorded through the owner's review process without claiming a new Claude verdict.

## Complete raw evidence and offline verification

The archives contain **only synthetic result.json, checkpoint.json and
provider.jsonl** files. No SQL dump, profile, password, caller key, certificate
private key or owner data is included. Each case's recorded schedule fields
(with the control-mode overwrite described above), identity, observed
T state, actual continue receipt, timing, state, invocation count and classification
is retained. Ledger/checkpoints were collected from separate local processes.

```
cd platform-proof
python3 -m tarfile -e evidence/runs-full.tar.gz .runs/published/full
python3 -m tarfile -e evidence/runs-fault.tar.gz .runs/published/fault
python3 -m tarfile -e evidence/runs-concurrency.tar.gz .runs/published/concurrency
node scripts/verify-evidence.mjs .runs/published/full
node scripts/verify-evidence.mjs .runs/published/fault
node scripts/verify-evidence.mjs .runs/published/concurrency
```

Archive/file hashes: [SHA256SUMS.json](SHA256SUMS.json), retained **unchanged** from
original evidence commit `133430a2e4988d334e071d4b64f43393beb992eb`. Its README and
publication.json hashes refer to their original versions at that immutable commit,
not the A-1 documentation addenda. All other listed files, including archives and
logs, remain byte-for-byte unchanged. Use the additive A-1 Git commit for the new
documentation identities; do not regenerate the historical checksum manifest.
Cross-check against the immutable GitHub evidence commit, not a substituted
archive+checkpoint pair.
Shared-host/admin compromise remains outside this proof's trust model. The
production independent record-chain **and index extension** gate remains open.
All published archive ledgers and checkpoint heads were reverified after extraction.

Logs: [full](full.log), [fault](fault.log), [concurrency](concurrency.log).
[Environment](environment.json): Linux, Node24.19.0, npm11.9.0,
PostgreSQL17.11 measured/UTC. [Terraform validation](terraform-validation.json),
[tool versions](terraform-version.json), [source integrity](source-integrity-after.json),
[protected worktrees](protected-worktrees.json),
[full ledger verification](ledger-verification-full.json).
Print-only controller/teardown/probe outputs are retained. No Terraform plan/apply,
Cloud SQL probe execution, cloud API/account/billing access or real-provider call.
Native Windows and all cloud-specific execution remain untested.

## Earlier failure, correction and limits

At superseded sourcef5ea869, full20/20 passed but a fault repeat failed7/8 before
its canary started: SQL container exited1, and loopback readiness exhausted10s.
[Original failing log](earlier-f5ea869-fault-FAILED.log) is retained, not counted as
a final pass. The precise original exit cause could not be established after
container cleanup; disk pressure is a hypothesis. Investigation proved that
anonymous SQL volumes survived `docker rm -f`.25 volumes were attributed through
label-filtered container events joined to volume mount events, then removed;
**no broad prune or unrelated volume/profile deletion**.
[Attribution/cleanup evidence](fixture-cleanup-correction.json).

Corrected source uses explicit labeled per-fixture volumes, removes them, tests
cleanup and bounds readiness60s while checking exit/OOM state. The new complete
full/fault/concurrency suites above passed. The earlier lost-COMMIT test also
exposed a checked-out pg client error; the handler now records UNKNOWN safely and
all final lost-COMMIT tests pass. Tool-setup sandbox/cache errors are separately
recorded in publication.json; no skipped execution is counted.

Local key/temp directories, containers and labeled volumes were cleaned. Historical
accepted sources/127 hashes remain unchanged; PR16 remains Draft/unmerged.
F13 check→syscall/suspended-timer risk, already-accepted late effects, local
checkpoint trust and all unexecuted cloud/production/provider/OPS01 gates remain.
