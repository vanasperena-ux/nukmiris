# INC1 acceptance traceability

All execution here is local Linux synthetic only. No cloud safety gate passes by
analogy. Source pins/results are in [evidence](evidence/README.md).

| Owner/Claude criterion | Implemented proof and evidence | Boundary still open |
|---|---|---|
| A / §9a ≥1000 real randomized SIGSTOP/SIGCONT | Original campaign: 1,000 real stops per full/fault run, parked at instrumented hooks; seeded order/delays across nine pause points, **18/27 pause-point × control-mode cells**, not a full cross-product. `/proc` T state/PID start and sibling wake observed; raw outcome `mode` is provider mode, with control mode overwritten. [A-1 counts and all nine missing cells](evidence/README.md#a-1--original-campaign-coverage-correction). | No arbitrary asynchronous-instruction coverage in the original campaign. Separate Claude P2/P3 adapted-environment evidence below; B-1 remains before B1a. SQL retirement remains NOT_PROVEN physical containment; no Cloud Run kill/metrics measurement. |
| B / §9b fresh socket and unsafe reuse | raw TLS1.3 transport, Connection:close, ≤1 request/attempt; unsafe HTTPS Agent demonstrably carries two requests across logical fence on one connection | No live provider/network path; no raw SYN packet claim |
| C / §9c no duplicate effect | 32 concurrent callers, four replays, eight distinct operations; wire proxy drops actual COMMIT acknowledgement; process crash/restart; immutable identity and role negatives; one-use closure test | ENTERED stays held if uncertainty recording unavailable; app integration/rearm not implemented |
| D / §9d deadline < inbound | SQL constraint/worker validation plus gateway checks; absolute socket abort; stop past deadline at TCP/TLS/partial/full write | Frozen timers/check→syscall residual remains; real request-billed CPU test unexecuted |
| E / §9e ledger tamper | independent provider fsync/hash chain; supervisor checkpoints; changed/reordered/truncated/rehashed/partial/missing data rejected | Shared local supervisor/host trust; production chain AND index extension verifier still mandatory |
| F / §9f evidence classification | pre-fence delayed arrival; post-fence violation; straddling intervals, missing/stale/unknown-scope/deletion data NOT_PROVEN | Cloud platform evidence examples are unit fixtures, not observations |
| G / §9g IaC pins | planning.test + native Terraform validate: explicit region/edition/tier, max1 services/manual1 worker, epoch labels, connection budget13≤15, privateSQL/no final or retained backups | Template is blocked skeleton; IAM/control-plane completion and review before any provisioning |
| H / §9h isolation/secrets | literal-loopback validation, own credentials/container/schema/labeled SQL volume, explicit pg/TLS options, no provider SDK, repository secret scan, temporary key/volume cleanup regression | Not a hostile-host sandbox or forensic scan of unrelated accounts |
| I / §9i source integrity | only platform-proof changes; accepted root tree stays recorded; protected subtree OIDs and127 source hashes checked | New additive branch has a new root tree by definition |
| J / §9j accurate claims | Local-only labels, preserved original evidence and A-1 coverage/field-interpretation correction. Claude reviewed implementation3204e73 with GO WITH CONDITIONS; this correction is documentation only. | No claim that Claude reviewed the A-1 correction; no cloud/provider acceptance or B1a authorization. |
| ≥20 dead-man canaries / DR-01 | actual stopped live processes independently resume and invoke; completed local SIGKILL prevents a pending request; delayed accepted request can still apply later | Cloud canary zero-after-verified-fence criterion must run later with platform evidence |
| Seven-step fence / RL-6, DR-01/02/06/07/10 | print-only executable inventory of actions/evidence; rejects --execute | No traffic/tag/IAM/firewall/revocation/deletion command executed |
| Teardown / MB-07 | SQL backups/PITR/final/retained, PSA/ranges, IPs/NAT, secrets/KMS, storage versions/images/logs/disks, +48h/statement review | No cloud inventory queried; named responsible operators still owner decision |
| Cloud SQL compatibility / MB-01/02 | READ ONLY disposable-prefix guarded psql probe; no grants/DDL/RLS weakening; worker/gateway local role negatives | Script not run live; intended IAM identity/session_user/SET ROLE/RLS/saturation B1b gate remains |
| Cost extension / MB-02/06/12 | original PR18 calculator hash/output preserved; ≤6h, max1 load, G1 and Enterprise Plus sensitivity; residual inventory | No account/credit/SKU invoice verification, alerts ≠hard cap; spend-cap provider gap explicit |

No skipped test can be counted as a pass. `npm test` includes all proof suites;
`test:fault` and `test:concurrency` overlap it. Existing accepted application's
suites are not relabeled proof results; its bytes/behavior were not changed.

## A-1 closure scope and independent evidence

Exact finding: [Claude PR20 review, A-1 / F-1, §3 item 3 and §5](https://github.com/vanasperena-ux/nukmiris/pull/20#issuecomment-6838315312).
The original campaign leaves RESUME at `beforeAuthority`, `beforeConnect` and
`beforeWrite`, and REVOKE at `beforeCommit`, `afterCommit`, `afterConnect`,
`afterTls`, `midWrite` and `afterWrite` unexercised. Stops occurred inside
instrumented `await hook()` waits; the random shuffle did not remove modular
aliasing between pause point and control mode. Raw `result.json` outcome `mode`
was overwritten with the provider mode (`OK`/`DROP`); seeded regeneration recovers
control mode. No historical raw field, log, checksum or test result is rewritten.

[Claude's P1–P4 and outputs](https://github.com/vanasperena-ux/nukmiris/pull/20#issuecomment-6838315843)
are separate independent evidence: P1 covers COMMIT lost before the server; P2
exercises **54 combinations** (9 pause points × 3 control modes × 2 provider
modes), 20 each/1,080 schedules; P3 adds 400 uninstrumented asynchronous stops
(270 continue, 130 direct kill); P4 reproduces the classifier counterexample,
leaving B-2 open. Claude reports 4/4 probe checks, not four resolved design gaps.

Those tests used Linux Node22.23.4/PostgreSQL16.15 with pg8.16.3 and an adapted
local-cluster helper, UTC/fsync/synchronous_commit on, unchanged `src/`. They are
not original Node24.19.0/PostgreSQL17.11/Docker results; Claude inspected rather
than reran the Docker/volume and Terraform evidence. A-1 adds no test execution,
harness changes or B1a implementation. Original implementation
`3204e73c823d7e552c0aacad74294617490465f6` / tree
`e77226c95b35855b551ae680d0a6488f3cde1d78` remains the reviewed baseline.
The original checksum manifest remains tied to evidence commit133430a; its two
amended-document hashes still identify the historical README/publication versions.
B-1–B-8 and all previously open gates remain. Claude has not reviewed this correction.
