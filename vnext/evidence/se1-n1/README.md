# SE-1 N1 correction evidence

Tested source **`95b122771b0958c0bc9bda07db1dab14f35aeb67`**, tree `f065fdf25e43cd6a91e0b7f4cd85553d7b6594a8`, parent `daf84507fc72c5015d329e0e6e2eb54ac7a27d21`. Only eight N1 implementation/test files changed. Original migration 010, frontend, scheduling/allocation code, original accepted source `540fc4a` and `vnext/evidence/se1/` are unchanged. Root cause and deployment procedure: [N1 guide](../../../docs/greenfield/32-SE1-N1-SOLO-QUALIFICATION.md).

Linux, Node 24.22.3 / npm 11.19.1 / PostgreSQL 17.11; pinned image and core environment are in `logs/*.environment.json`. Runtime uses TCP/UTC. Native Windows N1: **NOT EXECUTED**. Focused independent re-review: **PENDING**. Original owner acceptance is separate from this correction.

|Suite|Pass|Fail|Skip|
|---|---:|---:|---:|
|focused|23|0|0|
|upgrade|2|0|0|
|full|690|0|0|
|runtime|46|0|2|
|browser|1|0|0|

Typecheck and effect/import scope: PASS. Counts overlap. Full includes all fault/concurrent test files. Runtime skips are the two native Windows ACL/fsync checks. Browser is actual Chromium CDP, not a mocked page.

`test/se1-services.test.ts` adds five N1 regressions: fresh create-only behavior; explicit removal followed by exact creation-request replay and price/name/description/duration/buffer/deactivate/reactivate edits; zero-qualified availability; multiple records with one inactive; sole non-default resource; inactive sole default resource; and an actual original-010 reproducer followed by 011 that preserves the old qualification until explicitly removed. Related assertions are grouped in five tests; the other 18 original SE-1 tests still run, including tenant/role isolation, booking retries/crash, no reroll and protected operations.

`local/services-n1.test.mjs` uses a disposable fresh TCP profile, generates an ACTIVE booking and an UNKNOWN operation, restores only the accepted 010 function, then exercises the published upgrade CLI. All **43 core tables** compare equal before/after upgrade. Function OID/owner/ACL remain equal. SQL rollback, a repeated CLI no-op, repeated 011 application, explicit restart and unchanged protected booking/ledger identities are asserted. Old-schema startup is refused. The existing services runtime test separately retains tenant API checks, history, restart and coherent inert restore.

Reproduce on Linux with Node 24/Docker: `npm ci --ignore-scripts`, `npm run test:services`, `npm run test:services:runtime`, `npm test`, `npm run test:runtime`, `npm run test:services:browser -- chromium`, `npm run typecheck`, `npm run check:scope`. Exact argv/times/exit codes are in `commands.json`. On native Windows use the guide's portable TCP command; do not run the Linux core harness natively.

`source-integrity.json` captures the eight changed files; checksums were checked before every suite and after the run. `manifest.json` covers all evidence files except itself by SHA-256/size/Git blob. Public Git readback verification is recorded in the PR handoff comment. No profile, SQL dump, credential or custody key is published. Raw stdout is preserved, including whitespace. `development/test-cleanup-failure.log` retains an initial failure caused by a test SQL client closing after fixture destruction; cleanup was corrected before the pinned final run. It is not relabeled as a final result.

N2–N5 remain open and unchanged. No owner profile/Ana changes, data cleanup, inferred history rewrites, real providers, cloud/registry action, spending, merge or PC-1 reopening occurred. [Original review](https://github.com/vanasperena-ux/nukmiris/pull/25#issuecomment-6906440798) and original accepted evidence remain intact.
