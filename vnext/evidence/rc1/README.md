# RC-1 local synthetic implementation evidence

[Draft PR #27](https://github.com/vanasperena-ux/nukmiris/pull/27) / [Issue #26](https://github.com/vanasperena-ux/nukmiris/issues/26). Tested application source **`77ea22b59d1b7022cecb3cf7a007ca14affee9ff`**, Git tree **`33e683382e48f492fbd9a8c722b0d07ff4c8fbe4`**. Accepted N1 foundation `95b122771b0958c0bc9bda07db1dab14f35aeb67`, RC-1 base/docs `8f69e34cd265d197485dc6b947bac86a23ae796c`. Requirements: register **v1.4 / `59cde023d2dff088161c1d01bd76c1099386e13f`**, Issue #26 final authorization and owner inactive-service clarification. Documentation/evidence publication after this tested source changes no executable files.

Final measured results are in [results.json](results.json); commands in [commands.json](commands.json); raw logs in `logs/`. Runtime/browser measurements use the actual Linux environment: Node **24.19.0**, npm **11.9.0**, PostgreSQL **17.11**, UTC TCP fixture, Docker **28.4.0**, Chromium **154.0.8037.57**. Core suites use an isolated network-none PostgreSQL container and Unix socket. All providers are fake/local. No native Windows execution or real provider acceptance is claimed.

The complete core suite includes **41 RC-1 tests**, existing fault/concurrency/role/order cases and all SE-1/N1 regressions. Do not add overlapping subset counts. Portable runtime uses the actual indexed archive and fake SQL ledger, child-process crash/restart and coherent SQL/archive/ledger backup with inert restore. Actual Chromium exercises direct move/cancel, explicit sole-appointment selection, retained history, grey cancelled toggle, tenant switch and mobile layout; the existing SE-1 owner-forms browser regression is separate. Two native-only Windows probes are explicitly skipped on Linux in the full portable suite, not treated as passes.

`source-integrity.json` records 139 executable/test/tool files, their SHA-256 and Git blob identifiers. `manifest.json` hashes the evidence files. GitHub source publication was fetched back anonymously and its tree matched the local staged tree; verify published evidence bytes against the manifest. Neither local backups nor custody keys/private profiles are published.

## Reproduction

Use a fresh isolated Linux checkout with Node 24, Docker and Chromium, detach the exact tested source above, then from `vnext`:

```bash
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:runtime
npm run test:rc1:browser
npm run test:services:browser
```

`npm run test:rc1` optionally selects the 41 core tests already included in `npm test`. `npm run test:rc1:runtime` selects the two portable RC-1 tests already included in the full runtime suite. The complete core run already exercises all test files selected by the repository's fault/concurrency commands. Run Docker suites serially on small machines. Tests create only isolated synthetic fixtures. Actual process crashes and deterministic injected exceptions/transaction cuts are distinct; neither proves arbitrary-instruction or real-provider crash behavior.

## Initial failed run, preserved

`development/initial-full-4922269.log` and its original environment file retain the first frozen-source run at `4922269b4d0978ae12091260b5729d9a09621507`: **730 PASS / 1 FAIL / 0 SKIP**. The older non-catalog harness required management-unavailable menu wording. The correction keeps that truthful legacy-harness wording while displaying the implemented management instructions in catalog-backed RC-1. It adds the RC-1 assertion and clarifies the historical test title without deleting its assertions. Final evidence is generated on the corrected commit; historical output is not rewritten or represented as passing. Earlier uncommitted development runs remain local, not evidence for final acceptance.

## Acceptance and limits

[Windows fresh-profile walkthrough](../../../docs/greenfield/34-RC1-LOCAL-ACCEPTANCE.md), [flow/copy matrix](../../../docs/greenfield/33-RC1-FLOW-COPY.md), [focused Claude handoff](CLAUDE-HANDOFF.md). Keep RC-1 open pending independent safety review and owner functional/native Windows acceptance. The guide uses a NEW checkout/profile, original-employee rescheduling, exact cancellation and owner history. No upgrade/reset of accepted profiles or Ana's protected case. A held outcome remains held; absence alone is not proof and no blind resubmit is allowed.

Real Google Calendar exact delete/move, authenticated provider reconciliation and duplicate-event limitations remain gated; no real integration is implemented or activated. No employee accounts/notifications, unrelated N2–N5 changes, cloud, registry push, spending, deployment or merges. Existing accepted source, raw evidence and data are unchanged. Stop for review.

Measured final results on `77ea22b59d1b7022cecb3cf7a007ca14affee9ff`: **731 core PASS / 0 FAIL / 0 SKIP**, **48 runtime PASS / 0 FAIL / 2 native-only SKIP**, **1 RC-1 browser PASS** and **1 SE-1 browser PASS**; typecheck/scope PASS. RC-1's 41 core and 2 TCP cases are included in those totals, not additional tests.
