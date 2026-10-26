# NukMiris — v0.8.1 Maintenance Review (provisional)

Updated October 26, 2026, America/Mexico_City. **A, B and C are owner-PC-validated; D is assessment only and is complete.** The application package remains **0.8.0**. Neither v0.8.1 acceptance nor any merge is implied. No further Category B deletion has been implemented. [D's detailed remaining-legacy assessment](NukMiris-v0.8.1-Remaining-Legacy-Assessment.md) supplies the future recommendation.

## 1. Baseline and deliverable

| Reference | Exact value |
| --- | --- |
| Owner-accepted v0.8.0 application/test baseline | `52b0ded7979480905daca470368cb044618c53a7` |
| Audited/accepted documentation snapshot; unchanged `main` at task start | `7215deb6b682d87ab4be086df4dba75fc18c87b4` |
| Original audit | [`0107d84106faa6fcef2bb56629c8a01d0f8e65cc`](https://github.com/vanasperena-ux/nukmiris/blob/0107d84106faa6fcef2bb56629c8a01d0f8e65cc/docs/code-review/NukMiris-v0.8.0-Legacy-Code-Audit.md), preserved unchanged on its audit branch |
| Correctness branch | `fix/v0.8.0-reconciliation-reminders`, based on `7215deb` |
| A code/test commit | `02c887c4a76bc259830ea83bfca956d8ca776d79` |
| B code/test commit | `4cba14f4e3d26ec00d317cb6f92d07446fdf961a` |
| C code/test commit | `62726af92ae42602ebde92ed489cd77ecda2b8fe` |
| Baseline check | Version 0.8.0, clean working tree; the only difference on the audit branch was its Markdown report. No newer application changes were overwritten. |
| Owner's A validation / B authorization | “work package A tested on PC, 0 errors, continue” on October 26, 2026. This authorizes B, not a merge or Category A deletion. |
| Compatibility branch / base | `test/v0.8.0-legacy-compatibility`, based on the complete A delivery `8c7e8dc4eff4173fed48c3da617ec16822c2abcf` |
| Owner's B validation / C authorization | “very good, 1,089 tests passed on my PC, please continue” on October 26, 2026. This authorizes C, not a merge or version promotion. |
| Cleanup branch / base | `cleanup/v0.8.0-category-a`, based on the complete B delivery `93258882c89404cd8142ce49966abbc9f44e3aea` |
| Owner's C validation / D authorization | “1,089 passed; zero failures and I did the tests as indicated in PC Checklist. all good, proceed” on October 26, 2026. This validates C's reported PC checkpoint and authorizes D's assessment; it does not approve merging or further deletion. |
| D assessment branch / base | `audit/v0.8.0-remaining-legacy`, from C's complete delivery `e0af76524069b1973ded8584ef36f035718b13e9` |
| Delivery gate | D is documentation only. Final integration/version acceptance requires explicit owner approval; Category B removal requires distinct future authorization. |

The correctness branch is published. Automatic draft-PR creation for A was attempted with the prepared scope, validation, risk, rollback and manual-check description, but this environment's GitHub API connection returned **403 Forbidden** for the GraphQL request (the read-only REST attempt was also blocked). This was an API/network response, not a code/test failure or a merge approval. No A PR number was obtained and no PR is claimed to exist. [Review A or open its PR form](https://github.com/vanasperena-ux/nukmiris/compare/main...fix/v0.8.0-reconciliation-reminders?expand=1). Main remains at the acceptance snapshot above. The owner's subsequent PC result satisfies A's gate and authorizes the separate B branch; it does not authorize merging either branch.

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

## 4. Work Package A regression tests added

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

## 5. Work Package A results and behavior-preservation evidence

Platform: Linux x64, Node **v24.19.0**. Code/test tree: `02c887c4a76bc259830ea83bfca956d8ca776d79`.

| Run | Passed | Failed | Cancelled | Skipped |
| --- | --- | --- | --- | --- |
| Targeted `reconciliation-reminders.test.cjs` | 24 | 0 | 0 | 0 |
| Complete `npm test` suite | 672 | 0 | 0 | 0 |

The targeted run completed in 52.94 seconds; the complete run completed in 244.14 seconds with five suites. The complete suite retains all 648 accepted tests and adds the 24 cases above. The core libraries, main dispatcher, authentication, event metadata, template identity/text/buttons, schemas, example environment and lockfile are byte-for-byte unchanged from the accepted source. Existing tests continue covering immediate booking, two-plus-two/date UX, natural-language parsing, tenant isolation, reliable delivery, old buttons, Calendar ownership, ETags/locks, restart recovery and reminders.

The owner subsequently reported Work Package A tested on the PC with zero errors and authorized continuation. No separate PC execution log or exact PC commit SHA was supplied. This validates A at the owner's reported checkpoint; it does not establish new live Meta approval/delivery or Google attendance behavior. No real credentials, environment file, customer data, Calendar events or Meta assets were modified by the cloud work.

## 6. Category A removal and remaining legacy work

**Actual legacy lines removed by C: 403 from `backend/whatsapp-webhook.js`, plus one unused test import binding.** The 403 comprise 398 unreachable tail lines and five unused binding lines. All seven disabling function signatures/throws/closing braces, existing retained callers and the entire dispatcher remain unchanged. The test import occupies the same physical line; no test is removed. No Category B, C or D code was removed or refactored. See Section 11 for exact regions and verification.

| Work package | Current status |
| --- | --- |
| A — reconciliation correctness | Implemented; all 672 cloud tests passed. Owner PC validation reported zero errors; B authorized. Unmerged. |
| B — general legacy compatibility regressions | Implemented; complete cloud suite: 1,089 passed. Owner explicitly reported 1,089 PC tests passed and authorized C. Unmerged. |
| C — A01–A09 dead-code removal | Implemented; complete cloud suite: 1,089 passed, zero failures/cancellations/skips. Owner also reported 1,089 PC tests passed, zero failures and the checklist completed. Unmerged. |
| D — remaining Category B assessment | Complete, assessment only; Section 12 links the updated inventory/evidence/recommendation. No additional code removed. Final merge/version decision remains with the owner. |

The original audit remains historical evidence for B01–B19. D updates their post-C ranges/caller graph and recommends future handling without authorizing removal or promoting them to Category A. A's 24 recovery tests and B's 417 compatibility tests do not themselves authorize deletion. Compatibility guards, old journal-bound buttons, current recovery and active public/operational entry points remain. The separate D report distinguishes 503 helper-function lines, three private declarations and a conditional dispatcher projection from protected live code.

## 7. Remaining risks and limitations

1. **No retrospective import/backfill.** This fixes the pending/uncertain → terminal commit path. A booking already marked confirmed without tracking by the older code is not automatically enrolled later. That preserves the existing exclusion of old/untracked bookings; any data-repair tool requires separate scope and approval.
2. **Existing modes and eligibility remain authoritative.** If reminders are off, their hook is a no-op. Missing/withdrawn permission and template/account checks still control live sending. Invalid metadata/configuration can keep a recovery uncertain or fail the command rather than falsely finalize it.
3. **Google verification remains required.** Missing, changed or unverifiable events retain the existing uncertain outcome and lock. This package does not repeat an insert, move or delete to force a successful recovery.
4. **No hosted/multi-worker expansion.** Existing singleton ownership, local SQLite, PC uptime, external race/uncertainty and throughput limits remain. Future correctness, monitoring, credential onboarding or hosting work must be separately scoped.
5. **No v0.8.1 acceptance.** The review filenames are provisional. C's owner PC report authorized D's documentation only. Version promotion, live reminder activation, merge and any further Category B cleanup still require their explicit owner decisions.

## 8. Work Package A manual PC validation (completed by owner report)

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

## 9. Work Package A rollback and approval history

The branch starts from the immutable `7215deb` acceptance snapshot; the accepted application/test code also remains at `52b0ded`. No merge into `main` is permitted without explicit approval. A rollback is a code checkout/revert, not a database restore: stop Node, preserve local changes, and return to the preceding approved source (`main` remains unchanged while this PR is unmerged). Restart a single backend with its existing database and environment.

Reminder metadata legitimately committed during operator recovery should not be deleted to undo a code change. Both revisions use the same schema; restoring an older database can lose newer bookings. Preserve all requests, jobs, permission evidence, backups and uncertain locks. No version or data migration rollback is required by this package.

The A, B and C stop gates were honored. Their subsequent successful PC reports authorized B, C and D respectively. D now documents remaining legacy candidates; **no merge or version acceptance is implied by those reports**.

## 10. Work Package B — compatibility regression evidence

### Scope and review boundary

B was a tests-only change relative to A's complete delivery at `8c7e8dc`. Its comparison/PR base is `fix/v0.8.0-reconciliation-reminders`, not `main`, so a reviewer sees only B. The branch retains A's correctness fix without merging it. The v0.8.0 baseline, original audit, frozen v0.7.3 walkthrough, existing tests, production libraries/scripts/webhook, dependencies, package version, schemas and environment examples were unchanged by B. No Category A/B/C/D code was removed in B. **Legacy lines removed at B's delivery: zero.** C's subsequent authorized deletion is recorded separately in Section 11.

The B branch is published. Creating its draft PR with the complete scope/test/risk/rollback/checklist description was attempted after validation and push; GitHub's GraphQL endpoint returned **403 Forbidden**. No B PR number was obtained and no PR is claimed to exist. This is an API/network block, not an automatic approval-review rejection. [Review B's changes or open its PR form](https://github.com/vanasperena-ux/nukmiris/compare/fix/v0.8.0-reconciliation-reminders...test/v0.8.0-legacy-compatibility?expand=1). The prepared PR description is retained locally at `/tmp/nukmiris-work-package-b-pr.md`; this section supplies the same review information on GitHub. A's branch and `main` remain unchanged and unmerged.

Changed files:

| File | Purpose |
| --- | --- |
| `backend/test/legacy-compatibility.test.cjs` (new) | Signed HTTP tests across every supported mode/management-flag/reliability/routing combination, saved historical states, old selections, current menus, human chat, duplicate delivery and actual process restarts. |
| `backend/test/journal-compatibility.test.cjs` (new) | Real webhook tests for valid/invalid historical journal decisions, current name collection, uncertainty/recovery, tenant/customer/calendar mismatches, disabled features and invalid startup combinations. |
| `backend/test/helpers/compatibility-fixture.cjs` (new) | Parent-side disposable synthetic SQLite and Calendar fixtures, signed loopback client, state assertions and bounded child lifecycle. Reuses existing management fixtures and service factories for journal setup. |
| `backend/test/helpers/compatibility-runtime.cjs` (new) | Actual application child process with synthetic Google/Meta boundaries and persistent mock event store. Unscoped/`primary` Calendar, legacy OAuth, external HTTP(S), unexpected fetch and proactive template sends are forbidden and recorded even if application code catches the exception. |
| `backend/package.json` | Append the two new files to `npm test`; retain all previous test paths and dependencies, with package version 0.8.0. |
| This review | Record A's reported PC validation, B's evidence, review/rollback instructions and the next approval gate. |

### Coverage mapped to audit Section 9

The 16 supported combinations are six support configurations, six availability configurations and four booking configurations. Support/availability each cover management flag false/true with receiving-number routing and reliability false/true, plus explicit development routing with reliability false. Booking covers receiving-number routing with both management/reliability settings. Setting the management flag in support/availability must not activate management. Invalid booking/development or reliability/development combinations are negative startup tests, not silently omitted supported cases.

| Area | New evidence |
| --- | --- |
| Old persisted states | Nine shapes: `book`, `reschedule`, `cancel`, `choose_cancel`, `choose_reschedule`, `registration`, `manage_menu`, `booking_confirm`, `management_confirm`. Each runs fresh/expired × known/unknown customer × text/button/list across all 16 configurations: **1,728 input cases**, grouped into state-level tests. No obsolete Calendar reads/writes or customer registration may occur. Mode-specific rejection/clarification behavior is retained. |
| Obsolete buttons/lists | Matching old tokens, unrelated tokens and guessed hidden indexes from `book:`, `reschedule:`, `appointment:`, `cancel:` are rejected even alongside matching saved state. This is distinct from still-supported journal-bound `booking:`/`change:` actions. |
| Current states and navigation | Menu clears nine historical and eight current state shapes, emits the existing three choices and invalidates the prior menu token. Human chat owns appointment words and interactive actions until Menu, and support messages remain business-scoped. |
| Active flows and disabled features | Current main-menu booking retains two immediate slot choices plus “Más opciones”, uses only the scoped Calendar and books known customers immediately on selection. Existing date-menu tests continue protecting the complete two-plus-two/date flow. Availability remains read-only; support remains paused; enabled management retains the short empty-result response. Otherwise-valid saved journal actions cannot activate booking outside booking mode or management when disabled. |
| Current registration | A selected new-customer slot survives restart, invalid names neither register nor book, a valid name registers once and books once, and reselecting the same action does not duplicate the event. An expired name selection cannot register or book. Historical free-text registration/confirmation remains inert with reminders off/dry-run/live. |
| Valid historical decisions | Fresh/expired saved confirmation sessions cannot override journal scope/expiry. A still-valid `booking:yes` or `change:yes/no` is processed using its actual journal. Status never executes an unused offer. Terminal/declined/removed bookings cannot be revived. Management's supported button/list selection shapes remain usable. |
| Restart and uncertainty | Actual child stop/start preserves current availability and booking receipts. Pending/uncertain booking status verifies the existing synthetic event without a second insert; uncertain rescheduling verifies the existing patch without repeating it. Menu preserves unresolved journals and locks. Duplicate delivery is suppressed within a process; reliable mode also suppresses it after restart. Non-reliable mode retains journal idempotency without claiming a persistent incoming-message cache. |
| Isolation and invalid actions | Signed receiving-number routing, development sender routing, unknown mappings, unsigned ingress, foreign business/customer request IDs paired with matching local confirmation sessions, changed Calendar mapping, guessed/malformed IDs and a foreign appointment hidden inside an apparently valid local selection all fail safely. |
| Reminder configuration | Additional dry-run/live-configured subprocesses exercise name and journal compatibility without any enabled reminder business, permission import or template send. Seven incompatible startup combinations must fail rather than auto-enable flags. Existing reminder/compliance tests continue providing the active scheduling, permission, WABA/template and receipt coverage; B's configuration cases do not establish live Meta approval or delivery. |

All data is generated inside OS temporary folders. Token JSON contains only synthetic values; the app runs with `NODE_ENV=test` and does not load the owner's `.env`. Google writes are mock event-file changes only. Cleanup stops and waits for each child process's `close` event, then closes SQLite before bounded directory deletion, retaining the Windows close-before-delete correction. Unexpected integration calls remain in the complete trace despite per-test count resets.

### Verification, limits and risks

Code/test commit: [`4cba14f4e3d26ec00d317cb6f92d07446fdf961a`](https://github.com/vanasperena-ux/nukmiris/commit/4cba14f4e3d26ec00d317cb6f92d07446fdf961a). Platform: Linux x64, Node **v24.19.0**. Within B's delivery through `9325888`, subsequent commits documented validation only; C changes the code in its separate commit/branch.

| Run | Passed | Failed | Cancelled | Skipped | Duration |
| --- | --- | --- | --- | --- | --- |
| Focused journal compatibility run | 133 | 0 | 0 | 0 | 60.54 seconds |
| Complete `npm test` suite | **1,089** | **0** | **0** | **0** | **243.95 seconds**, 27 suites |

The complete run retains all **672** tests from approved A and adds **417** B tests: **284** mode/state compatibility tests and **133** journal/startup tests. The 284 tests group many inputs, including the 1,728 historical state cases above; these are not an additional 1,728 Node test declarations. Syntax checks for all four new JavaScript files and `git diff --check` passed. A structured package comparison verified that only the two test paths were appended; the version, dependency/override declarations and every pre-existing test path remain unchanged. Direct Git comparisons confirmed all production libraries, scripts, webhook, lockfile, environment example, original baseline and frozen walkthrough unchanged from A's `8c7e8dc`.

B is now owner-PC-verified: the owner explicitly reported **1,089 tests passed** and authorized continuation. No separate PC execution log or exact PC commit SHA was supplied. Early development failures were assertions/test-fixture mistakes (reply wording, cumulative call accounting and a test mapping violating the existing unique-Calendar constraint); they do not establish application defects and required no business-logic changes.

This is table-driven compatibility evidence, not an exhaustive product of every journal state, malformed input, reminder policy, race and transport failure. Current Menu tests deliberately use saved state shapes; active valid selection/name/journal paths additionally use real service-created data and restart processes. Existing recovery/crash tests continue supplying hard-crash coverage; B's additional restarts are orderly. No hosted/multi-PC coordination, live WhatsApp session history or actual Meta/Google outage is simulated as proven production behavior. Category B candidates are **not** promoted to safe removal by these tests.

### B PC checklist and rollback (completed by owner report)

After reviewing B, stop the normal backend and preserve local changes. From its existing `backend` folder in PowerShell:

```powershell
git status --short
git fetch origin
git switch test/v0.8.0-legacy-compatibility
node -p "require('./package.json').version"
npm.cmd test
```

Expect package **0.8.0** and **1,089 passing tests**, with zero failures/cancellations/skips. Run the complete suite to its final summary; the new subprocess/combination tests take additional time (the cloud run took about four minutes; Windows time can differ). No reinstall, configuration edit, reminder preparation, schema change, database reset or Google/Meta reconnection is required. Keep production reminder settings off/dry-run. Tests do not require the normal app, tunnel or live accounts to be running and must not create real appointments.

This package changed no production behavior, so no new live booking experiment was required for B. The owner has now confirmed the Windows tests. C has its own subsequent checklist below.

Rollback B by stopping Node and returning to the approved A branch `fix/v0.8.0-reconciliation-reminders` at `8c7e8dc`, preserving local changes and the same database/environment. Do not reset/restore the database or remove reminder metadata. Main has not received A/B; switching to main also drops A's accepted fix and is not the preferred B-only rollback.

**B's approval gate was honored and the owner authorized C. C's gate was subsequently met and D's assessment is documented in Section 12. No merge, version bump or production reminder activation was authorized by those reports.**

## 11. Work Package C — exact Category A cleanup

### Source, scope and changed files

Branch: `cleanup/v0.8.0-category-a`; comparison/PR base: the approved B branch `test/v0.8.0-legacy-compatibility` at `93258882c89404cd8142ce49966abbc9f44e3aea`. Code/test commit: [`62726af92ae42602ebde92ed489cd77ecda2b8fe`](https://github.com/vanasperena-ux/nukmiris/commit/62726af92ae42602ebde92ed489cd77ecda2b8fe). The working tree was clean at C's start; version was 0.8.0. Remote main/A/B still matched their recorded deliveries. No new worktree, merge or version change was made.

The C branch is published. After completing validation and pushing the reviewable result, draft-PR creation with the prepared scope/results/risk/rollback/checklist description was attempted. GitHub's GraphQL endpoint returned **403 Forbidden**; no C PR number was obtained and no PR is claimed to exist. This is an API/network block, not an automatic approval-review rejection. [Review C's exact changes or open its PR form](https://github.com/vanasperena-ux/nukmiris/compare/test/v0.8.0-legacy-compatibility...cleanup/v0.8.0-category-a?expand=1). The prepared description is retained at `/tmp/nukmiris-work-package-c-pr.md`; this section supplies the same information on GitHub. Main, A and B remain unchanged and unmerged.

The two target files were byte-identical to the audited `7215deb` before cleanup. A and B therefore required no adjustment to the approved removal ranges. Each range was checked again against its signature, unconditional throw and closing brace before deletion. The audit estimate is confirmed exactly; no extra tidy-up was added to reach a line target.

Only three files differ from B:

| File | C change |
| --- | --- |
| `backend/whatsapp-webhook.js` | Delete exactly 403 approved lines: the seven dead tails and their five unused bindings. No replacement logic. File shrinks from **1,971 to 1,568 physical lines**. |
| `backend/test/dynamic-availability.test.cjs` | Remove only `selectedDate` from its destructured import. The import of `readSearchPolicy`/`dayOf`, all test declarations/assertions and the exported production function remain. **Zero net physical lines removed** from this file. |
| This maintenance review | Record B's PC acceptance, exact deletion/preservation evidence, tests and C's owner checklist/rollback. |

### Exact approved removals and retained stops

The original line numbers below refer to B's unchanged pre-cleanup source at `9325888`, also identical to the audit's `7215deb` for these files. Post-cleanup links refer to the tested C code.

| Audit item | Removed pre-cleanup lines | Removed count | Preserved post-cleanup stub |
| --- | --- | --- | --- |
| A01 — `connectCalendar` | 244–260 | 17 | [237–239](https://github.com/vanasperena-ux/nukmiris/blob/62726af92ae42602ebde92ed489cd77ecda2b8fe/backend/whatsapp-webhook.js#L237-L239) |
| A02 — `getBusyPeriods` | 530–545 | 16 | [506–508](https://github.com/vanasperena-ux/nukmiris/blob/62726af92ae42602ebde92ed489cd77ecda2b8fe/backend/whatsapp-webhook.js#L506-L508) |
| A03 — `findCustomerAppointments` | 632–653 | 22 | [592–594](https://github.com/vanasperena-ux/nukmiris/blob/62726af92ae42602ebde92ed489cd77ecda2b8fe/backend/whatsapp-webhook.js#L592-L594) |
| A04 — `createAppointment` | 740–786 | 47 | [678–680](https://github.com/vanasperena-ux/nukmiris/blob/62726af92ae42602ebde92ed489cd77ecda2b8fe/backend/whatsapp-webhook.js#L678-L680) |
| A05 — `rescheduleAppointment` | 795–875 | 81 | [686–688](https://github.com/vanasperena-ux/nukmiris/blob/62726af92ae42602ebde92ed489cd77ecda2b8fe/backend/whatsapp-webhook.js#L686-L688) |
| A06 — `chooseAppointment` | 1094–1168 | 75 | [904–906](https://github.com/vanasperena-ux/nukmiris/blob/62726af92ae42602ebde92ed489cd77ecda2b8fe/backend/whatsapp-webhook.js#L904-L906) |
| A07 — `confirmCancellation` | 1225–1364 | 140 | [960–962](https://github.com/vanasperena-ux/nukmiris/blob/62726af92ae42602ebde92ed489cd77ecda2b8fe/backend/whatsapp-webhook.js#L960-L962) |
| **A01–A07 subtotal** | Code/blank lines strictly after the throw and before the closing brace | **398** | All seven exact signatures/error strings/closing braces retained |
| A08 — five unused bindings | 10, 11, 50, 55, 76 | **5** | Remove local `authenticate`, `google`, `CALENDAR_ID`, `CREDENTIALS`, `calendar` only; active modules' imports and all six installed dependencies remain |
| **Main-file total** | Only A01–A08 | **403** | No Category B/C/D deletion |
| A09 — unused test import name | `dynamic-availability.test.cjs:8` | **One binding; zero net lines** | [Remaining import](https://github.com/vanasperena-ux/nukmiris/blob/62726af92ae42602ebde92ed489cd77ecda2b8fe/backend/test/dynamic-availability.test.cjs#L8) |

The before/after behavior is the same for these functions: invoking a retained stub immediately rejects with its original error. No code after that throw could execute before cleanup. Previously supported modern operations continue through the business-scoped libraries, not these stubs. A08 removes local unused imports/declarations only; it does not remove packages or alter OAuth scopes/credentials.

### Preservation checks and validation

A one-off structural verification reconstructed the entire expected main file by filtering only the exact approved pre-cleanup line numbers, then compared every remaining byte to C. It also compared each three-line stub to the original signature/throw/closing brace, and verified that A09's entire file is identical after its one exact import-name substitution. These checks passed. This is inspection evidence, not a new npm test or an altered application feature.

The complete suffix from `async function handleMessage(message) {` through the end of the file is byte-identical to B: SHA-256 `737ceb094910216645e55a0e302e560cd7eff115b34095c1d02c0ff9b720e1c1`. This covers the full dispatcher, Meta ingress/signature behavior and startup/close lifecycle. The all-file reconstruction additionally proves that retained legacy callers, Category B helper bodies, customer/session stores, current factories and compatibility guards outside that suffix are unchanged.

Active integration remains in the same factories at [main lines 112–128](https://github.com/vanasperena-ux/nukmiris/blob/62726af92ae42602ebde92ed489cd77ecda2b8fe/backend/whatsapp-webhook.js#L112-L128): `createCalendarAvailability`, scoped booking/management and reminder commit hooks, template verification and the shared sender. Current `lib/google-calendar.js` still imports `googleapis`; `scripts/google-connect.js` still imports the active authenticator; booking/management still use the actual `selectedDate` export. No reference to a removed local binding remains in the main file.

Direct Git comparisons against B confirm no changes to production libraries, operational scripts (including A's reconciliation fix), configuration, schemas, package/lockfile, existing test helpers, credentials/environment examples, baseline or frozen walkthrough. The original audit remains unchanged on its historical branch. No installed dependency is removed. No customer database, existing backup, `.env`, Google event or Meta asset is changed by cloud work; full tests use disposable synthetic integrations/data.

Platform: **Linux x64, Node v24.19.0**. Test source: `62726af92ae42602ebde92ed489cd77ecda2b8fe`. No code/test changes followed this commit; later commits document validation and delivery only.

| C validation | Passed | Failed | Cancelled | Skipped | Duration |
| --- | --- | --- | --- | --- | --- |
| Complete `npm test` | **1,089** | **0** | **0** | **0** | **247.97 seconds**, 27 suites |

Syntax checks passed for both changed JavaScript files; whitespace and exact-deletion checks passed. The package remains **0.8.0**, with all **1,089** existing tests retained and no new test declarations needed for this deletion. C's results match approved B's passing count with zero unexpected skips. In particular, the suite starts the actual app with synthetic providers across supported mode/routing/management/reliability combinations; checks current immediate booking and two-plus-two/date menus; rejects old/foreign/guessed actions; exercises normal management, reminders/permission/template gates and dry-run; and tests real subprocess restart/crash recovery plus A's standalone reconciliation integration. No provider/client startup error or deleted-test gap was observed. The owner subsequently reported **1,089 passed, zero failures and all indicated PC checklist tests completed successfully**. No separate PC execution log or exact PC commit SHA was supplied; this records the owner's checkpoint report separately from cloud verification.

### Remaining legacy and risks

All original B01–B19 candidates were retained in C; C itself did not reassess their classifications. The 503 helper-function lines plus separately listed dispatcher/binding/API-surface candidates are **not authorized deletions**. Keeping the seven stopping stubs and compatibility guards is intentional even though their obsolete consumers remain visible. D's subsequent assessment is linked in Section 12 and removes no Category B code.

Tests, byte comparisons and the owner's reported C PC checklist support behavior preservation. Synthetic startup/provider tests and the reported ordinary-flow/off-or-dry-run checkpoint do not establish new live template approval/delivery, account permissions, attendance writes, hosting or independent multi-PC safety. The original accepted v0.8.0 deployment limits remain. There is no new feature, service catalog, additional WhatsApp interaction, event migration, reminder activation or version acceptance.

### C owner PC verification checklist (completed by owner report)

Stop Node before switching code and preserve any local changes. Use the same PC database/settings and **`npm.cmd`**. From the existing `backend` folder:

```powershell
git status --short
git fetch origin
git switch cleanup/v0.8.0-category-a
node -p "require('./package.json').version"
npm.cmd test
```

Expect **0.8.0** and **1,089 passed**, with zero failures/cancellations/skips. No dependency reinstall, authorization reset, reminder preparation, environment change, schema migration or data clearing is required by C.

After the suite, use `npm.cmd start` with the existing off/dry-run reminder setting. For the normal-flow check, use designated test appointments/identities rather than other customers' appointments:

1. Check startup, `menu`, two immediate time choices, “Más opciones”, the next choices and date selection. A natural-language date must still use the business's available hours, timezone and existing compact labels.
2. Book once as an existing test customer. If a designated new-customer identity is available, check selection → name collection → immediate booking once. Do not delete customer/journal records to manufacture a new identity. Verify one Calendar event per booking with the existing customer title/description; there must be no added confirmation screen.
3. For a newly booked reminder-eligible test appointment, run `npm.cmd run reminders:status -- --business-id juanita-nails`. Its applicable future jobs should be present once; old/manual events should not be imported. Keep live reminders disabled. Do not change the PC clock or reminder intervals to force a due time.
4. Reschedule and cancel designated test appointments using the existing choices. Verify one move/deletion, correct customer details after the move and the expected replacement/invalidation of pending reminders. Other appointments must remain unchanged.
5. Check `Hablar con alguien`: appointment words stay in human chat; `menu` returns to the main menu. Restart after receiving a current availability choice, then select it within its existing validity period; the selected operation must not duplicate a Calendar event/change.

These are owner-run ordinary-flow checks. No real Calendar event was created or edited by the cloud review. There is no need to manufacture uncertain requests, edit database rows, clear locks, reauthorize providers or enable live reminders to test C. Existing synthetic tests cover the failure/recovery cases.

### C rollback and approval

Rollback C by stopping Node, preserving local changes and switching back to approved B at `93258882c89404cd8142ce49966abbc9f44e3aea` (`test/v0.8.0-legacy-compatibility`), then restarting one backend with the same database/environment. This preserves A's accepted reconciliation fix and B's tests. Do not restore an older database, delete appointments/reminder/permission/recovery records, clear locks or reset credentials; C has no migration to undo. Main still lacks these unmerged packages and is not the preferred C-only rollback.

**C's delivery gate was honored. The owner's successful suite/checklist report authorized D's assessment; merging and version promotion remain separate final decisions.**

## 12. Work Package D — remaining legacy assessment and final handoff

[Read the complete post-C assessment](NukMiris-v0.8.1-Remaining-Legacy-Assessment.md). D is on the separate documentation-only branch `audit/v0.8.0-remaining-legacy`, based on C's `e0af76524069b1973ded8584ef36f035718b13e9`. Its only changed files are that new assessment and this review recording C's successful PC checkpoint. No application, test, package, dependency, schema, configuration, credential or data change is included.

The assessment maps all B01–B19 candidates to current line ranges and references. Eight of the fifteen old helpers have only other legacy callers; seven still have late dispatcher references intercepted by earlier current-flow/compatibility gates. Current `booking:`/`change:` decisions, stored continuations, old-message hash/context support, reminder action versions and Menu/human support remain active and must be retained. Three associated private declarations remain candidates; the old dispatcher windows also contain live validation/rejection code and cannot be deleted wholesale.

The measured future candidate inventory is **503 helper-function lines + 3 private declaration lines = 506 gross lines**. A separately reviewed equivalent dispatcher rewrite could conditionally save another **63 net lines**, for a **569-line projection before replacement adapters**. This is a planning estimate only; no additional deletion is implemented or authorized, and no original Category B candidate is promoted automatically to A. The report identifies specific additional comparison/text/restart/action-shape/reminder-context tests before such a rewrite. B19's public members are recommended for retention because their size benefit is negligible and external consumers cannot be ruled out.

**Recommendation:** finish this authorized maintenance round with A–C's owner-verified changes and D's assessment. Keep further Category B cleanup as optional, separately authorized work. The Services Catalog remains intentionally absent; production reminder activation and hosting are separate decisions.

D's backend tree is verified byte-for-byte identical to C's inspected source (`e0af765`) and tested code/test tree (`62726af`). Source links/ranges, function/line arithmetic and documentation whitespace were checked. The full suite was not rerun for documentation-only D; the exact unchanged app/test tree retains C's **1,089 passed, zero failures/cancellations/skips** cloud result and the owner's successful additional PC suite/checklist report. No further PC installation or test round is required for D's documents; the owner may keep running C's accepted checkout.

All work is prepared for the final integration decision. The original task explicitly requires: **“Do not merge any pull request without explicit owner approval.”** Main and the delivered A/B/C branches remain unchanged/unmerged. Version stays **0.8.0**; the v0.8.1 filenames are provisional. D does not merge, publish a release, enable live reminders or authorize further code removal. Documentation-only rollback is a return to C's checkout; do not restore/delete existing database records.
