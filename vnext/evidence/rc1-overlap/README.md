# RC-1 customer-overlap correction evidence

Draft [PR #27](https://github.com/vanasperena-ux/nukmiris/pull/27). **Tested source `47f485b691c62dc8968ad2aec7cf6f05aaf7df93`**, tree `de03771ed5110dcee98e5c5d0edd8f884b36c045`. Parent: prior RC-1 evidence head `4d61f52ba89f288d195bd48057f1b2dcf061046b`; prior reviewed executable `77ea22b59d1b7022cecb3cf7a007ca14affee9ff`. The later evidence/docs publication changes no executable bytes. Previous RC-1 and SE-1/N1 evidence is preserved in its original directories.

[Investigation, exact SQL rule and short Windows retest](../../../docs/greenfield/35-RC1-CUSTOMER-OVERLAP.md). Authority is the owner's current correction request, conditioned on confirming existing SQL. Register v1.4 `59cde023d2dff088161c1d01bd76c1099386e13f` contains NM-038's earlier open-policy status; the current request authorizes this bounded offer/SQL alignment, without exceptions or a SQL policy change. Decisions 139/147 remain unchanged.

**Cause:** protected availability was employee-specific and had no customer context. SQL already checked all of the same customer's other protected ranges across employees/calendars, including both buffers, with half-open boundaries and no appointment-state shortcut. The correction uses the server-authenticated customer in that shared reader and refreshes navigation searches. Other customers retain other employees' free capacity; MOVE excludes only its own source. Final slot/name revalidation and unchanged SQL serialization remain necessary for races after an offer is shown.

## Tests and reproduction

Final measured results are recorded in [results.json](results.json), [environment.json](environment.json), [commands.json](commands.json) and raw `logs/`. Counts overlap: the **18 new core cases** are included in the complete suite and in the optional 59-case RC-1 subset; the new TCP case is included in the three-case RC-1 runtime subset and the complete portable runtime suite.

| Required scenario | Automated evidence |
|---|---|
|Exact owner finding|`rc1-customer-overlap.test.ts`: Nov 17, 2026 / Mexico City / 09:00–10:00 / Lucía, new customer becomes known; no duplicate slot from Sofía.|
|Exact, partial, adjacent and both buffers|Before/after half-open boundaries; candidate buffer reaches an existing appointment; existing buffer is applied once; 10:15 boundary valid on a 15-minute test grid.|
|More/date paths|Initial search, Más opciones, date list, date entry and time pagination; newly added protection refreshes cached more/time navigation.|
|Different customers|Two customers book the same time on distinct qualified employees; other-customer/other-calendar capacity stays available.|
|Reschedule|Only selected source excluded; another appointment on another employee still blocks; source-overlapping shift remains possible; original employee/event retained.|
|Stale/racing booking|Another signed channel creates a same-customer protection after display; recheck refreshes. A competitor on a different employee inserted at `prepare.afterArchive` is rejected by unchanged SQL before a second operation/effect.|
|Protection and release|PREPARED, ARMED, SUBMISSION_ENTERED and UNKNOWN ranges remain busy without relying on a fake event. Only safe abandonment/proven cancellation frees the range.|
|Restart/replay/tenant|Stable request replay creates no duplicate; restart retains filtering; equal customer subjects in different businesses do not share protections; scoped composition helper rechecks.|
|Portable HTTP|Formerly new customer, second request, more options, another customer at the same time, crash/restart, idempotent requests and Bernard tenant separation; existing RC-1 held-outcome/restore cases retained.|

From a fresh checkout detached at the tested source, in `vnext`, with Node 24 and Docker:

```bash
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:runtime
npm run test:rc1:browser
npm run test:services:browser
```

The complete core suite already includes the repository's fault and concurrency test files. Optional `npm run test:rc1` selects the overlapping 59 cases. Run Docker suites serially. The full runtime includes two native-only Windows probes, which are skipped on Linux and never counted as passes. The core harness uses Linux Unix sockets; `test:rc1:runtime` is the portable TCP/native Windows retest (three cases). Browser checks use Chromium/Edge through local CDP. All fixtures/provider effects are synthetic and isolated.

## Preserved development evidence

- `development/before-correction.log`: **41 PASS / 1 FAIL** on the earlier application plus the new uncommitted regression test. The regression demonstrates the duplicate customer slot; it is not a complete rerun of the earlier source's 731 cases or a native Windows test. Raw output is unchanged.
- `development/fixture-development.log`: **55 PASS / 2 FAIL** during development. One fixture mixed local and raw admission conversation IDs (`unsealed_batch`); it was corrected to use another authenticated synthetic channel. Another assertion incorrectly counted all reply/effect ledger rows as zero despite legitimate traffic; it now counts the competing CREATE separately. No application safeguard was weakened to satisfy either fixture. These logs are not final-source acceptance evidence.

`source-integrity.json` records 140 code/test/tool paths and verifies unchanged SQL, migrations, archive, dispatch, finalization, recovery, legacy, cloud-proof and historical evidence paths. `manifest.json` covers the new evidence payloads with SHA-256 and Git blob IDs. Raw logs are not whitespace-normalized. Published evidence is read back independently before final reporting. No private profile dumps, keys or owner data are published.

## Review status

Claude's earlier [GO for local acceptance](https://github.com/vanasperena-ux/nukmiris/pull/27#issuecomment-6925363476) applies to `77ea22b`, not automatically to this new source. [Focused correction handoff](REVIEW-HANDOFF.md). Owner/native Windows acceptance of this correction remains pending; Linux success is not Windows acceptance. The owner-reported native reproduction is distinguished from Codex's local test execution.

No owner-profile upgrade/reset or protected Ana changes. No SQL policy, allocation, service snapshot, custody or unknown-outcome changes; no unrelated Claude R1–R4 or N2–N5 work. No live Meta/Google, cloud, deployment or merges. Keep PR #27 Draft and stop for owner review.

Final measured results on `47f485b691c62dc8968ad2aec7cf6f05aaf7df93`: **749 complete core PASS / 0 FAIL / 0 SKIP; 49 complete runtime PASS / 0 FAIL / 2 native-only Windows SKIP; RC-1 browser 1 PASS; SE-1 browser 1 PASS; typecheck/scope PASS**. Linux Node 24.19.0 / PostgreSQL 17.11. The 18 new core, 59 RC-1 core and 3 RC-1 TCP cases are overlapping subsets.
