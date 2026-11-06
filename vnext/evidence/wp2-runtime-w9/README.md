# W9 correction — pinned execution evidence

Exact tested source **a61e65f7cf794432857fb855836b4d6ca36748d9**;
tree **1afc754275f9418d0f4a20bd317844d25f53ed82**, parent6691a55.
The follow-up adds only this evidence directory and Claude handoff14.

The owner ran original source8432dd8 on Windows11/Node24.21.0/npm11.19.0/Docker
Desktop4.98.0/Linux containers/measured PG17.11: **24 PASS /5 FAIL /0 SKIP**.
Native ACL EXECUTED and passed. Four W3 cases and the published CLI lifecycle
failed EPERM/fsync. See [owner-reported evidence](owner-native-report.json).
This is a real owner native run; it is not Codex execution or correction acceptance.

## Codex execution at the corrected pin

| Command from vnext | PASS | FAIL | SKIP | Evidence |
|---|---:|---:|---:|---|
| node --test --test-concurrency=1 local/command-lock.test.mjs | 10 | 0 | 1 native W9 | [focused.log](focused.log) |
| npm run test:runtime | 34 | 0 | 2 native-only | [runtime.log](runtime.log) |
| npm test | 259 | 0 | 0 | [full.log](full.log) |
| npm run test:fault | 249 | 0 | 0 | [fault.log](fault.log) |
| npm run test:concurrency | 120 | 0 | 0 | [concurrency.log](concurrency.log) |
| npm run typecheck / npm run check:scope | PASS | 0 | — | [typecheck.log](typecheck.log), [scope.log](scope.log) |

Suites overlap. Linux, Node **24.19.0**, npm **11.9.0**, measured PostgreSQL
**17.11 (Debian17.11-1.pgdg12+2)**. Native Windows correction **NOT EXECUTED** by
Codex. The two skips are native ACL and native W9 read-only-fsync reproduction/
writable publication. Both must execute on the owner's corrected Windows checkout.
[Measured runtime](measured-runtime.json), [summary](summary.json), environment
JSONs, [77 source hashes](source-sha256.txt), [artifact hashes](artifact-sha256.txt).

All **five previously failing scenarios pass on Linux** unchanged: the four W3
cases and the actual published CLI prepare/start/smoke/backup/stop/reset test with
spaces/Unicode. New OS-contract tests model Windows EPERM for a read-only flush,
then execute the corrected writable create/write/sync/close/rename on actual files.
They inject write/flush/close/rename failures and preserve EEXIST collisions. The
native-only regression separately checks actual Windows handles; mocks do not close
native acceptance. The correction does not ignore EPERM or weaken archive durability.

Fresh exact-source checkout: npm ci --ignore-scripts, then commands in the table.
On native PowerShell use npm.cmd; return console, measured versions and actual
nativeWindowsAcl:EXECUTED plus nativeWindowsMetadataSync:EXECUTED. Do not upload
state.json, worker logs, backups, keys, SQL/archive databases or .local-demo data.
This checked-in evidence contains only plain logs, hashes and non-secret summaries.

[Root cause/publication contract](../../../docs/greenfield/26-WINDOWS-W9-METADATA-PUBLICATION.md)
· [Claude re-verification](../../../docs/greenfield/reviews/14-CLAUDE-WINDOWS-W9-REVERIFICATION.md).
The runtime stays inert/health-only; W8 is still required before persistent demo
use and is handled on the separate L2 branch. All custody/provider/uncertainty/OPS01
gates remain. Keep Draft/unmerged; no v0.8.1, real Meta/Google, GCP or deployment.
