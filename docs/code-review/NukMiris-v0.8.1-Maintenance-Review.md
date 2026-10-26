# NukMiris — v0.8.1 Maintenance Review (provisional)

Prepared October 26, 2026, America/Mexico_City. **Work Package A only.** The application package remains **0.8.0**. Neither v0.8.1 acceptance nor any merge is implied. Work Packages B/C/D require the preceding approval gates and have not begun.

## 1. Baseline and deliverable

| Reference | Exact value |
| --- | --- |
| Owner-accepted v0.8.0 application/test baseline | `52b0ded7979480905daca470368cb044618c53a7` |
| Audited/accepted documentation snapshot; unchanged `main` at task start | `7215deb6b682d87ab4be086df4dba75fc18c87b4` |
| Original audit | [`0107d84106faa6fcef2bb56629c8a01d0f8e65cc`](https://github.com/vanasperena-ux/nukmiris/blob/0107d84106faa6fcef2bb56629c8a01d0f8e65cc/docs/code-review/NukMiris-v0.8.0-Legacy-Code-Audit.md), preserved unchanged on its audit branch |
| Correctness branch | `fix/v0.8.0-reconciliation-reminders`, based on `7215deb` |
| Code/test commit | `02c887c4a76bc259830ea83bfca956d8ca776d79` |
| Baseline check | Version 0.8.0, clean working tree; the only difference on the audit branch was its Markdown report. No newer application changes were overwritten. |
| Delivery gate | Review Work Package A before authorizing B. No automatic merge. |

The owner accepted v0.8.0 after all 648 PC tests and the first reminder's saved dry-run result passed. That acceptance and the original audit remain historical evidence. The Services Catalog is intentionally absent and belongs to a future feature release; its absence is **not a defect** and no catalog work is included.

## 2. Root cause and investigation

The running webhook constructs `createBookingService` and `createAppointmentManagement` with the reminder subsystem's `onCommitted` callback. The booking service invokes it only while committing a verified `pending`/`uncertain` booking as `confirmed`, inside the same SQL transaction that finalizes the request and releases the Calendar lock. The management service likewise invokes it inside the transaction applying a verified reschedule/cancellation.

The two standalone reconciliation scripts constructed these same services without that callback, whose default is a no-op. They could read Google and finalize the correct booking/change journal while omitting the corresponding local reminder metadata update. The audit reproduced the booking case; this package also reproduced cancellation and both pending/confirmed-attendance rescheduling cases through the actual CLI entry points.

| Recovered operation | Before this correction | After this correction, when reminders are configured in dry-run/live mode |
| --- | --- | --- |
| Eligible uncertain booking → confirmed | Booking confirmed; reminder tracking/schedule could be absent. | Booking and applicable reminder metadata commit together. |
| Uncertain cancellation → applied | Booking removed; previously pending local reminder metadata could remain until later reconciliation. | Pending reminders are invalidated and attendance tracking is cancelled in the same transaction. |
| Uncertain reschedule → applied | Booking times updated; reminder version, attendance and jobs could remain at the previous schedule. | Existing tracking resets to the committed schedule, rotates its token/version, invalidates pending old jobs and creates only future applicable jobs. |
| Repeated recovery of a terminal request | Existing terminal state returned. | Same behavior; hooks do not run again or duplicate schedules. |
| Uncertain/unverifiable outcome | Protected pending/uncertain state and lock retained. | Same behavior; no premature reminders or false successful outcome. |

## 3. Exact corrective implementation

Only these runtime files change:

- [`backend/scripts/reconcile-booking.js`](https://github.com/vanasperena-ux/nukmiris/blob/02c887c4a76bc259830ea83bfca956d8ca776d79/backend/scripts/reconcile-booking.js): import `createAppointmentReminders`, construct it with the same database/availability object and the existing configured reminder mode (default `off`), and pass its `committed` closure as `onCommitted`.
- [`backend/scripts/reconcile-management.js`](https://github.com/vanasperena-ux/nukmiris/blob/02c887c4a76bc259830ea83bfca956d8ca776d79/backend/scripts/reconcile-management.js): the same wiring for the existing change transaction. Reconciliation performs no Calendar PATCH, so there is no new rescheduling-field transformation here; the original submitted change is only verified.

There are no changes to `booking.js`, `appointment-management.js`, `appointment-reminders.js`, scheduling/permission/template code or the webhook. No duplicate scheduling implementation was introduced. The existing callback supplies all eligibility, cancellation and versioning rules.

The scripts **do not start a worker, call `tick`, verify/submit Meta templates or send messages**. They still only read Google; their normal operational purpose includes updating local status, and the correction adds the matching local reminder metadata within that existing commit. No real command was run against an existing owner database during this task.

`off` remains off and requires no reminder tables for booking recovery. Active modes require the existing prepared metadata and valid configuration. A reminder-enrollment failure rolls back the booking status/metadata transaction, retains protection and reports an uncertain result; the CLI's existing exit-code convention for `uncertain` remains unchanged. A zero process exit code alone is therefore not proof that a request became confirmed/applied: inspect the printed status.

## 4. Regression tests added

- [`backend/test/reconciliation-reminders.test.cjs`](https://github.com/vanasperena-ux/nukmiris/blob/02c887c4a76bc259830ea83bfca956d8ca776d79/backend/test/reconciliation-reminders.test.cjs): 24 new cases using actual standalone CLI invocations in separate Node processes, real disposable SQLite fixtures and synthetic Calendar responses.
- [`backend/test/helpers/reconciliation-runtime.cjs`](https://github.com/vanasperena-ux/nukmiris/blob/02c887c4a76bc259830ea83bfca956d8ca776d79/backend/test/helpers/reconciliation-runtime.cjs): child-process preload replacing the Google boundary, fixing the test clock and rejecting any HTTP/fetch call or Calendar insert/PATCH/delete. Only reads of the synthetic event store are permitted.
- `backend/package.json`: append the new test file to the existing complete suite. No test was removed; dependency versions, lockfile and package version are unchanged.

| Coverage group | Cases | Evidence asserted |
| --- | --- | --- |
| Eligible enrollment and repeated/restarted CLI processes | 3 | Dry-run/live configuration both enroll; four applicable pending jobs; no immediate preview/send; repeated commands preserve one schedule, its token and confirmed state. |
| Read uncertainty and ownership | 6 | 404/503 remain uncertain; another business is rejected before Calendar access; changed event owner, scoped customer identity or calendar mapping cannot enroll or falsely finalize. |
| Eligibility and existing state | 6 | Pre-activation, disabled and unprepared businesses stay excluded; inside-two-hour booking creates no obsolete jobs; off works without reminder tables; already-confirmed untracked bookings are not backfilled. |
| Failed enrollment and restart after repair | 1 | Invalid synthetic interval configuration rolls back all enrollment and confirmation, retains the lock, then succeeds once after fixture repair in a new CLI process. |
| Recovered cancellation | 1 | Pending jobs skipped, attendance cancelled, booking removed; repeated booking/change reconciliation cannot resurrect reminders. |
| Recovered rescheduling | 2 | Both pending and confirmed attendance reset to the new committed version; old pending jobs invalidated; correct future job count; repeated CLI does not duplicate or alter Calendar data. |
| Uncertain/foreign management recovery | 1 | No source schedule changes or lock release without a verifiable outcome. |
| Manually moved confirmed appointment | 1 | Existing `REVIEW` hold and reason survive an already-confirmed booking reconciliation. |
| Dry-run processing | 1 | CLI creates pending metadata only; the normal test worker previews once; saved `dry_run` jobs never replay on repeated recovery. |
| Permission and template gates | 2 | CLI does not grant permission or send; the existing live dispatch path still skips missing permission and rejects unapproved templates. |
| **Total** | **24** | No real Calendar or WhatsApp integration calls. |

The new enrollment/cancellation/rescheduling regressions failed against the original scripts before hook wiring. The corrected targeted suite passed. These are Work Package A correctness tests, not the broader legacy compatibility matrix reserved for Work Package B.

## 5. Test results and behavior-preservation evidence

Platform: Linux x64, Node **v24.19.0**. Code/test tree: `02c887c4a76bc259830ea83bfca956d8ca776d79`.

| Run | Passed | Failed | Cancelled | Skipped |
| --- | --- | --- | --- | --- |
| Targeted `reconciliation-reminders.test.cjs` | 24 | 0 | 0 | 0 |
| Complete `npm test` suite | 672 | 0 | 0 | 0 |

The targeted run completed in 52.94 seconds; the complete run completed in 244.14 seconds with five suites. The complete suite retains all 648 accepted tests and adds the 24 cases above. The core libraries, main dispatcher, authentication, event metadata, template identity/text/buttons, schemas, example environment and lockfile are byte-for-byte unchanged from the accepted source. Existing tests continue covering immediate booking, two-plus-two/date UX, natural-language parsing, tenant isolation, reliable delivery, old buttons, Calendar ownership, ETags/locks, restart recovery and reminders.

Windows execution of these **new** tests and owner review remain pending. The baseline Windows suite remains owner-accepted; Linux synthetic tests do not establish new live Meta approval/delivery or Google attendance behavior. No real credentials, environment file, customer data, Calendar events or Meta assets were modified.

## 6. Category A removal and remaining legacy work

**Actual legacy lines removed: 0.** All seven disabling function signatures/throws, unreachable tails, supporting bindings, existing callers and the entire legacy dispatcher remain unchanged. No Category B, C or D code was removed or refactored.

| Work package | Current status |
| --- | --- |
| A — reconciliation correctness | Implemented; all 672 tests passed. Owner review/approval is required before B. |
| B — general legacy compatibility regressions | Not started; requires review/approval of A, then its own branch/PR and full-suite result. |
| C — A01–A09 dead-code removal | Not started; requires the preceding approval gates. The original estimate remains approximately 403 main-file lines plus one unused imported name, subject to fresh range checks. |
| D — remaining Category B assessment | Deferred until approved Category A cleanup. Assessment only; no B deletion is authorized by this package. |

The original audit still governs B01–B19: obsolete formatting/registration/search/selection/management helpers, local locks/fixed-hour list, overlapping dispatcher branches, retired fixture settings and exposed helper API members. Their classifications are not changed by this correctness fix. The 24 recovery tests are not evidence to promote those candidates to A. Compatibility guards, old journal-bound buttons, current recovery and active public/operational entry points must remain.

## 7. Remaining risks and limitations

1. **No retrospective import/backfill.** This fixes the pending/uncertain → terminal commit path. A booking already marked confirmed without tracking by the older code is not automatically enrolled later. That preserves the existing exclusion of old/untracked bookings; any data-repair tool requires separate scope and approval.
2. **Existing modes and eligibility remain authoritative.** If reminders are off, their hook is a no-op. Missing/withdrawn permission and template/account checks still control live sending. Invalid metadata/configuration can keep a recovery uncertain or fail the command rather than falsely finalize it.
3. **Google verification remains required.** Missing, changed or unverifiable events retain the existing uncertain outcome and lock. This package does not repeat an insert, move or delete to force a successful recovery.
4. **No hosted/multi-worker expansion.** Existing singleton ownership, local SQLite, PC uptime, external race/uncertainty and throughput limits remain. Future correctness, monitoring, credential onboarding or hosting work must be separately scoped.
5. **No v0.8.1 acceptance.** The review filename is provisional. Version promotion, live reminder activation, merge and the next work package all await explicit owner decisions.

## 8. Manual PC validation after owner review

Use **`npm.cmd`** in PowerShell. This branch is a review candidate, not a released or accepted v0.8.1. Stop Node before switching code and preserve existing local changes. From the existing `backend` folder:

```powershell
git status --short
git fetch origin
git switch fix/v0.8.0-reconciliation-reminders
node -p "require('./package.json').version"
npm.cmd test
```

Expect package **0.8.0** and **672 passing tests**, with no failures/cancellations/skips. No dependency reinstall, OAuth reset, schema preparation or configuration change is required by this package. The tests use temporary synthetic databases and mock integrations.

Keep the existing reminder setting `off` or `dry-run`; do not activate live delivery for this review. If returning to the normal app, use `npm.cmd start` and verify the existing startup mode and Menu flow. Do not manufacture an uncertain booking by editing real database rows or intentionally creating/changing Calendar events to exercise this fix. The new subprocess tests cover those failure/recovery cases without live writes.

Only if an actual existing uncertain request already needs operator recovery, use its real recorded request ID with the established command:

```powershell
npm.cmd run booking:reconcile -- EXISTING_BOOKING_REQUEST_ID
npm.cmd run reminders:status -- --business-id juanita-nails
```

For an already pending/uncertain management request, use `npm.cmd run management:reconcile -- EXISTING_CHANGE_REQUEST_ID` instead. These commands read Google and update local status/metadata only when the original outcome is verifiable; they do not send reminders or edit Calendar events. Repeat the same command/ID and confirm no duplicate jobs, version changes or resurrection after cancellation. Review the printed outcome, not just the exit code. Never clear unknown requests or locks to force success, and do not post tokens, database contents or customer details in feedback.

## 9. Rollback and approval

The branch starts from the immutable `7215deb` acceptance snapshot; the accepted application/test code also remains at `52b0ded`. No merge into `main` is permitted without explicit approval. A rollback is a code checkout/revert, not a database restore: stop Node, preserve local changes, and return to the preceding approved source (`main` remains unchanged while this PR is unmerged). Restart a single backend with its existing database and environment.

Reminder metadata legitimately committed during operator recovery should not be deleted to undo a code change. Both revisions use the same schema; restoring an older database can lose newer bookings. Preserve all requests, jobs, permission evidence, backups and uncertain locks. No version or data migration rollback is required by this package.

**Stop after delivering Work Package A and its test results. Await owner approval before Work Package B, Category A cleanup, further assessment or any merge.**
