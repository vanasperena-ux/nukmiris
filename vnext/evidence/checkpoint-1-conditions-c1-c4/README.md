# WP1 C1–C4 follow-up evidence

**Tested source:** [`991ca8141ffef3471a955c450e9f789dd8aef1a7`](https://github.com/vanasperena-ux/nukmiris/commit/991ca8141ffef3471a955c450e9f789dd8aef1a7).
Tree: `711b2f1b442a74c29fccd79fb7efb0e5bfca34e4`. Later evidence/docs commits do not
change tested files. **C1 independent re-verification and formal CP1/initial CP2
closure are PENDING. No WP2 application development has begun.** PR #4 remains Draft.

[Condition dispositions](../../../docs/greenfield/reviews/04-CODEX-WP1-C1-C4-REMEDIATION.md),
[Claude handoff](../../../docs/greenfield/reviews/05-CLAUDE-WP1-C1-REVERIFICATION-HANDOFF.md),
[WP2 requirements and preserved gates](../../../docs/greenfield/16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md).
Claude's [prior independent review](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6619904951)
recommended GO WITH CONDITIONS on the earlier source. Its PG16/Node22 SQL results
are separate from the executions below. No unavailable independent run is called passed.

## Actual frozen-source results

| Check | Result / artifact |
|---|---|
| Full suite | **98 pass**, 0 fail/cancel/skip, **35.016 s**; [raw log](full-test-output.txt) |
| Fault suite, new cluster | **88 pass**, 0 fail/cancel/skip, **26.280 s**; [raw log](fault-test-output.txt) |
| Strict TypeScript / source confinement | PASS; [raw log](static-checks.txt) |
| C1/C4 condition tests | Ten tests included in both suites; 23 invalid purpose/identity variants, real unique-index wait, final-output schema test, payload/owner permission boundaries; [minimal results](condition-results.json) |
| Existing coverage | 1,000 SQL schedules, 256 overlapping schedules, real process crash/freeze and F13 residual included; names/results in logs |
| Pre-fix condition probes | 6 fail / 4 pass on unchanged reviewed migrations; [raw log](before-conditions-test-output.txt), [provenance](review-source-provenance.json) |
| Schema / permissions | [Executed condition inventory](database-condition-inventory.json): unique index, actual output constraints, nine enabled append-only triggers, NOLOGIN owner, all nine runtime/tenant roles denied helper EXECUTE |
| Independent verification of C1 patch | **PENDING** |
| Native Windows/WSL, real providers/gateway/custody/cloud | **NOT RUN**; no activation authorization |

Node **24.19.0**, npm **11.9.0**, PostgreSQL **17.11** (Debian), image
`postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`.
[Full environment](full-environment.json), [fault environment](fault-environment.json).
Each disposable container has `--network none`, tmpfs data, Unix socket, fsync and
synchronous_commit. Fake providers bind only loopback; no real account is configured.
The fixture-only private DB clock remains isolated from runtime roles. Actual
source authority is clock_timestamp(), not a worker-controlled production clock.

## What C1 and C4 establish

Invalid outputPurpose/outputId is rejected before reservation. Pending plans retain
exclusive future output IDs; a contender that cannot see an uncommitted plan still
loses at the unique index and rolls back. Exact replay remains idempotent. The shared
real output INSERT is preflighted in a rolled-back subtransaction; no output survives
preparation. An added real output-table CHECK fails preparation before any provider
continuation can exist. Valid purposes still finalize once through the fake provider.

recovery_case payload UPDATE/DELETE is denied while its trigger is enabled. Owner
state changes and owner DDL/trigger disabling **without superuser** are intentionally
shown as possible, then rolled back. Ownership is NOLOGIN/migration-only; runtime
roles cannot assume it or call the internal helper. This is not production custody
or protection from a compromised owner/migration identity.

The before log is a defect-probe run, not the accepted full WP1 suite. Those probes
used original migration/role bytes, with hashes in provenance. New internal-helper
ACL assertions were added after that baseline run; defect assertions are unchanged.
No claim is made to execute Claude's entire shell harness verbatim. Its linked
original A4 reproductions remain available for independent re-verification.

## Integrity and publication boundaries

[Tested source manifest](tested-source-manifest.json): **39 files** plus the pinned
WP2 design document hash; SHA-256 of manifest:
`27689bf7e85e3196e302b9f7468001f66b6761bec8a69c9295cfa7ab0a176d19`.
[Artifact manifest](artifact-manifest.json) hashes every package file except itself.
[Preservation audit](scope-and-preservation.txt) records unchanged accepted-app paths,
original Claude documents and prior evidence. No accepted application DB/secrets read.

Only readable logs, small synthetic case-result summaries, schema metadata and
hashes are published. Consistent fixture SQL snapshots and detailed run traces
remain in ignored local evidence/runs directories. Prior compressed SQL/state
publication restrictions remain in force; no upload retry or alternate encoding
has been attempted. Existing checkpoint-1 and checkpoint-1-remediation-1 files
are unchanged. No real credential, archive encryption key or customer data is included.

## Reproduction and stop

From isolated vnext/, Linux Node24/npm11/Docker:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:fault
```

For focused re-verification: `npm run test:conditions` (builds and runs the ten
C1/C4 tests against a fresh pinned cluster). Use a writable npm cache if necessary.
The runner stops only its own uniquely named fixture container. Windows/WSL is
unverified; do not run this over the accepted PC installation.

The corrected source is ready for independent C1 re-verification. **Do not start
WP2 until C1 is independently accepted and the WP1 gate formally closed.** Keep
001/013/016 disabled and 009/011/017/OPS01 prerequisites unchanged. No merge,
provider activity, GCP or cutover follows from these passing local tests.
