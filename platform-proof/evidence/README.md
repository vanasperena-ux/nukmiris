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

Suites overlap. Full and fault each contain1,000 real SIGSTOP/SIGCONT schedules,
same deterministic shuffle seed448864294, with independent process wake-ups;
2,000 final executed schedules, **not2,000 independent random seeds**. Nine cuts:
authority112, and111 each beforeCOMMIT/afterCOMMIT/beforeconnect/afterconnect/TLS/
beforewrite/midwrite/afterwrite. Each run observed811 provider invocations/effects,
maximum1/attempt; caller outcomes739APPLIED,149UNKNOWN,12EXPIRED,100DENIED.
The100 denied attempts remain ARMED under revoked authority, never permitted.

All1,000 cases/run classify physical containment **NOT_PROVEN**, because SQL epoch
revocation or absent cloud evidence does not establish termination. Cloud class
examples are unit fixtures only. Each full/fault run additionally executes20
live-silence counterexamples and20 killed-canary delayed wakes:0 post-local-exit
invocations. Independent provider ledgers prove only local fake effects, not real
provider acceptance/idempotency or cloud retirement.

## Complete raw evidence and offline verification

The archives contain **only synthetic result.json, checkpoint.json and
provider.jsonl** files. No SQL dump, profile, password, caller key, certificate
private key or owner data is included. Each case's schedule, identity, observed
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

Archive/file hashes: [SHA256SUMS.json](SHA256SUMS.json). Cross-check against the
immutable GitHub evidence commit, not a substituted archive+checkpoint pair.
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
