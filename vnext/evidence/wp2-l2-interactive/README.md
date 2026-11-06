# L2 interactive application — reproducible execution evidence

Exact tested source **75491d9734def18471bf7b96f5004d7fd4988314**;
tree **730e29a99b38203852ef255367fd9fe7cc83ecd7**.
The evidence-only follow-up adds this directory and Claude handoff15.

## Run the application on a fresh Windows checkout

Node24.x/npm11, Docker Desktop running Linux containers; from vnext:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run test:runtime
npm.cmd run demo:book
```

Open the private127.0.0.1 browser URL printed by demo:book. Known customer: type
menu/cita → two suggestions → select → confirmed booking/employee. New customer:
select → name → automatic revalidation/booking. More/date, human/Menu, fake-calendar
viewer and Needs Attention are interactive. No real providers/accounts are used.
Default DB15432/browser3077 and probed guard ports are below49152 (W8). W9 uses a
writable metadata creator handle through sync/close/atomic rename. Keep the legacy
checkout/data separate. [Full walkthrough/lifecycle/backup/inert restore](../../../docs/greenfield/25-L2-INTERACTIVE-LOCAL.md).

**Native integrated L2 Windows execution is NOT RUN by Codex.** The owner previously
ran runtime8432dd8 on Windows:24 PASS/5 FAIL/0 SKIP, with native ACL passed and W9
identified. Corrected W9 sourcea61e65f and integrated L2 still need owner re-test and
independent review. [Focused PR12 W9 handoff](https://github.com/vanasperena-ux/nukmiris/pull/12#issuecomment-6672882540).

## Executed at the exact source

Linux, Node **24.19.0**, npm **11.9.0**, measured PostgreSQL
**17.11 (Debian17.11-1.pgdg12+2)**. Suites overlap; do not add their totals.

| Command from vnext | PASS | FAIL | SKIP | Evidence |
|---|---:|---:|---:|---|
| npm run test:l2 | 158 | 0 | 0 | [focused.log](focused.log) |
| npm test | 445 | 0 | 0 | [full.log](full.log) |
| npm run test:fault | 435 | 0 | 0 | [fault.log](fault.log) |
| npm run test:concurrency | 306 | 0 | 0 | [concurrency.log](concurrency.log) |
| npm run test:runtime | 38 | 0 | 2 native-only | [runtime.log](runtime.log) |
| npm run test:browser -- chromium | 1 | 0 | 0 | [browser.log](browser.log) |
| typecheck / check:scope | PASS | 0 | — | [typecheck.log](typecheck.log), [scope.log](scope.log) |

Full/fault/concurrency/focused use the pinned container's isolated Unix socket.
Runtime/CLI uses actual TCP/SCRAM/UTC and portable process APIs. Browser proof uses
actual Chromium via loopback CDP; it drives both customer flows, calendar and tenant
selector and checks that the composer stays visible while history scrolls. Windows
ACL and actual read-only-fsync reproduction are explicitly skipped on Linux. The
Windows-shaped contract tests are models, not native acceptance.

## Acceptance mapping

| Requirement | Automated acceptance |
|---|---|
| C2 views/actions/tenant | Real SQL consumption, revisions/DB expiry, duplicate delivery, concurrent IDs, foreign tenant/conversation, altered request and valid seal with missing claim/session denied. Original IDs survive COMMIT cuts. |
| Known/new booking | Two suggestions/more/date, direct known selection, validated name after slot with no early reservation, same-time qualified reassignment, explicit buffers and the complete real-browser flow. |
| Natural dates | All100 accepted v0.8.1 parser tests execute unchanged against the local port in a read-only sandbox. Running application imports no legacy code. |
| C1 recovery | Runtime starts/stops RecoveryWorker; silent expired work recovers without original input, entered/UNKNOWN stay held, original identities/MOVE history retained. |
| Replies/C3 | Entry/COMMIT/effect cuts, late read-only proof, pending/entered expiry separation, both confirmation-expiry/Menu schedules, unknown booking→Menu→late proof→expired confirmation shows ACTIVE fact in order. Long history remains within message limits. |
| C4 terminal conflicts | Stale selection, resource conflict after recheck and forced SQL lock timeout yield informative fresh choose-again views, no rejected-plan retry or success claim. |
| Human/Menu | Ordinary and stale-action inputs stay human until Menu; concurrent supersession before reservation cannot book; entered uncertainty is not released. |
| Fake-provider uncertainty | Lost applied response reconciles from append-only SQL ledger; absent proof stays held across time/restart with Needs Attention, zero reissue. |
| Windows W8/W9/CLI | Low ports, EACCES/netsh/confirmed guard relocation and Windows bind diagnostic; writable metadata flush/failure preservation, active owner/crash/reboot/legacy protection; actual published CLI flows with spaces/Unicode. |
| Persistence/backup | Actual app crash/restart reopens indexed custody with original data; quiesced coherent SQL/ledger/archive/witness/key/config backup, hash/corruption checks and separate authenticated inert restore. Restored dispatch/activation refused. |

See [summary](summary.json), measured runtime/browser JSONs, environment JSONs,
[source provenance](source-provenance.json), [source hashes](source-sha256.txt)
and [artifact hashes](artifact-sha256.txt). O3's actual synthetic contention and
forced50/3000ms timeout observations are retained in the three L1-O3 JSONs here;
they are Linux observations, not a Windows SLO. No SQL snapshots, archives, keys,
backups, private URLs or provider state are published in this evidence.

Reproduce from the exact source: npm ci --ignore-scripts; run every command in
the table. Full fault/process suites require Linux/WSL; test:runtime is the native
TCP/ACL/CLI entry point. test:browser accepts a Chromium/Edge executable argument.
For Windows use npm.cmd. Return console/measured results, not private state.

[Claude handoff15](../../../docs/greenfield/reviews/15-CLAUDE-L2-INTERACTIVE-BOOKING.md).
This is the first booking workflow; move/cancel/admin catalog UI and real provider
contracts are not implemented. Independent L2/Windows acceptance remains open.
All production custody/repair/witness, X1/F13,009/011/production017,N2/N3,A2/A3,
013/016, W7/O5/O6, native Windows/N6 and OPS01 gates remain. No PR merge, legacy
change, real Meta/Google, GCP, deployment or production cutover.
