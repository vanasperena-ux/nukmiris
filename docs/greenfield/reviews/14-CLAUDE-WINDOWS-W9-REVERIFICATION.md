# Claude re-verification — W9 native Windows metadata failure

Review exact source **a61e65f7cf794432857fb855836b4d6ca36748d9**, tree
**1afc754275f9418d0f4a20bd317844d25f53ed82**, parent6691a55. The follow-up adds only
this handoff and vnext/evidence/wp2-runtime-w9/. Verify that split/source hashes.

The owner actually ran source8432dd8 on Windows11/Node24.21.0/npm11.19.0/Docker
Desktop4.98.0/measured PG17.11: **24 PASS /5 FAIL /0 SKIP**. Native ACL EXECUTED and
passed; the four W3 cases and published CLI sequence failed EPERM/fsync. This owner
report supersedes the earlier NOT RUN status for that original source, and does
not accept the new correction. W1–W6's independent acceptance is retained.

Cause: metadata was reopened read-only before fsync; Windows FlushFileBuffers
requires GENERIC_WRITE. The correction writes and flushes the same 'wx'/0600
exclusive creator handle, closes it, then atomically renames in the same directory.
It never suppresses flush errors or publishes unflushed content. Prior metadata is
preserved on write/sync/close/rename failure; cleanup never removes a pre-existing
temp-file collision. The original OS socket guard and all owner/legacy rules remain.

Please re-verify:

1. Handle access/order, exclusive creation, atomic replacement and failure cleanup.
2. Four original W3 schedules (live exclusion, actual child death, concurrent reboot/
   PID reuse, explicit legacy recovery) and the published prepare/start/smoke/backup/
   stop/reset sequence with spaces/Unicode. No changed test expectation masks W9.
3. Windows-shaped EPERM control versus successful writable publication, all injected
   failures, EEXIST preservation; actual native-only read-only failure/new-publication
   test is EXECUTED on Windows and skipped on Linux.
4. Only command metadata code/tests and doc26 change in the source commit. No SQL,
   archive, booking identity, dispatcher fencing, provider or production gate change.

Executed by Codex on Linux/Node24.19.0/npm11.9.0/measured PG17.11: **34 runtime PASS /
2 native-only SKIP;259 full/249 fault/120 concurrency PASS**, zero failures.
Focused command-lock: **10 PASS /1 native-only SKIP**. Typecheck/confinement pass.
Suites overlap. [Evidence/reproduction](../../../vnext/evidence/wp2-runtime-w9/README.md)
and [root cause/owner retest](../26-WINDOWS-W9-METADATA-PUBLICATION.md).

State your exact environment/commands and corrected/rejected verdict. After review,
the owner retests this exact source with npm.cmd run test:runtime; require actual
nativeWindowsAcl:EXECUTED and nativeWindowsMetadataSync:EXECUTED plus zero failures.
Neither Linux execution nor the Windows access-mode model closes native acceptance.
Never upload private state/backups/keys/databases.

W8 remains required before relying on persistent demo ports, tracked separately in
the L2 implementation. Keep PR12 Draft/unmerged. Preserve native Windows/N6,W7,
X1/F13,009/011/production017,N2/N3,A2/A3,013/016 and OPS01/custody/provider gates.
No v0.8.1, real Meta/Google, GCP, deployment or cutover changes.
