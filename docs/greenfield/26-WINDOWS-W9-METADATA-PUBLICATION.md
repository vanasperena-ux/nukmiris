# W9 — Windows command metadata flush correction

The owner executed reviewed source8432dd846237efd959e4656ae8ddb2d7ff74adea on
Windows11, Node24.21.0/npm11.19.0, Docker Desktop4.98.0/Linux containers and measured
PostgreSQL17.11, in a fresh isolated checkout. Dependency/type/scope checks passed;
runtime returned **24 PASS /5 FAIL /0 SKIP**. Native ACL was EXECUTED and passed.
TCP/UTC, booking smoke, fixture backup/restore, process lifecycle and isolation
passed. Four W3 lock cases and the published CLI lifecycle failed with EPERM/fsync.
This is owner-supplied native evidence, not a Codex Windows execution.

## Cause and correction

publish() wrote/closed the temporary metadata file, then reopened it with 'r'
before sync(). Node/libuv's Windows fsync uses FlushFileBuffers, which requires a
writable file handle. Linux permits the earlier read-only flush, explaining why
Linux and command-contract tests did not detect the defect. See Microsoft's
[FlushFileBuffers access requirement](https://learn.microsoft.com/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers)
and [libuv Windows fsync implementation](https://github.com/libuv/libuv/blob/v1.x/src/win/fs.c).
The owner's EPERM is consistent with this access-mode error.

publishCommandMetadata() now exclusively creates the same-directory temporary file
with 'wx'/0600, writes and syncs **that same writable handle**, closes it, and only
then renames it onto .command.lock. Failed write, flush, close or rename propagates;
there is no EPERM suppression or unflushed fallback. Failure preserves the previous
record and removes only the temporary file created by this attempt. An EEXIST
collision never deletes a pre-existing temporary file.

This changes **CLI diagnostic metadata only**. Exclusive OS-held socket ownership,
owner/instance validation, crash/reboot recovery, PID-reuse protection and explicit
legacy-file recovery are unchanged. The metadata file never grants archive custody
or dispatch authority. This does not claim directory-entry persistence against
arbitrary power loss; damaged legacy metadata still holds for explicit recovery.
No archive/SQL/identity/dispatcher/provider/production guard is weakened or changed.

## Regression and owner re-test

The focused suite retains all four W3 cases: active exclusion, actual child death,
concurrent reboot/PID-reuse recovery, and confirmed legacy handling. New tests
reproduce the Windows read-only-access failure as an explicit OS-contract model,
check write→sync→close→rename order, inject write/flush/close/rename failures, and
check exclusive-create collision preservation. A separate native-only test attempts
the actual read-only fsync, then verifies the corrected writable publication; it
prints nativeWindowsMetadataSync:EXECUTED on Windows and explicitly skips on Linux.
Mocks/model results do not constitute native Windows acceptance.

test:runtime also executes the original published CLI prepare/start/smoke/backup/
stop/reset sequence in a path containing spaces and Unicode. Reproduce from vnext:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run typecheck
npm.cmd run check:scope
npm.cmd run test:runtime
```

Use the exact corrected source SHA in the PR evidence/handoff, in a fresh isolated
checkout. Return console output, measured versions, nativeWindowsAcl:EXECUTED and
nativeWindowsMetadataSync:EXECUTED. Do not upload state.json, worker logs, backups,
SQL/archive databases, keys or .local-demo contents. Codex Linux results and the
owner's earlier native failure are recorded separately; **native correction
acceptance remains pending** until the corrected source is actually re-tested.

W8 remains required before relying on a persistent interactive profile across
reboots. Its low-port allocation, reserved-port diagnostics and confirmed relocation
are being implemented with the separate L2 application, not included in this
focused PR12 correction. Native Windows/N6, W7, X1/F13,009/011/production017,N2/N3,
A2/A3,013/016, production custody/provider and OPS01 gates remain. Keep Draft/unmerged;
no v0.8.1, real Meta/Google, GCP, deployment or cutover changes.
