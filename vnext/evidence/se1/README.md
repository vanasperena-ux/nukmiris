# SE-1 reproducible local evidence

Tested implementation: **`540fc4af57a29eba380c0f53df0bf3ad12093ad7`**, tree `0dd4f535ad45bce6c0e818a470efd558069c71a9`. Accepted application base: `b4d0be0cb98c7f2b69be318e18b93f4de102c511`. Follow-up publication changes only documentation/evidence; no application changes or infrastructure ancestry. Draft [PR #25](https://github.com/vanasperena-ux/nukmiris/pull/25), [Issue #7](https://github.com/vanasperena-ux/nukmiris/issues/7).

Measured Linux, Node 24.22.3, npm 11.19.1, PostgreSQL 17.11; runtime connections use TCP/UTC. Browser: Chromium 154.0.8037.57 through real CDP interaction. **Native Windows SE-1 execution: NOT RUN. Owner functional acceptance: PENDING. Independent SE-1 review: NOT RUN.** Earlier native 46/46 acceptance belongs to the original baseline, not this feature.

|Suite|Pass|Fail|Skip|
|---|---:|---:|---:|
|services-browser|1|0|0|
|services|18|0|0|
|full|685|0|0|
|runtime|45|0|2|
|capacity|4|0|0|
|browser|1|0|0|
|final-browser|1|0|0|
|capacity-browser|1|0|0|

Supplementary completed runs at `b82426f038d1e91679190ea8f24f5d9021f49126` are preserved in `prior-b82426f/`: full 685 / fault 675 / concurrency 546, runtime 45 PASS / 2 SKIP, capacity and browser checks PASS. Only two owner UI/browser-test files changed afterward. The main table is a fresh run at the final source above; full mode executes every fault/concurrent test file. Earlier subset runs are not relabeled as reruns at the final source.

Typecheck and effect/import scope check: PASS. Suites overlap; do not add counts as independent scenarios. The two runtime skips are the native Windows ACL and metadata-fsync assertions, which require a Windows host. Linux results do not substitute for them.

Reproduce from a NEW isolated checkout at the tested source:

```powershell
git checkout --detach 540fc4af57a29eba380c0f53df0bf3ad12093ad7
Set-Location vnext
npm.cmd ci --ignore-scripts
npm.cmd run test:services
npm.cmd test
npm.cmd run test:fault
npm.cmd run test:concurrency
npm.cmd run test:runtime
npm.cmd run test:capacity
$Browser = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
npm.cmd run test:browser -- "$Browser"
npm.cmd run test:final-browser -- "$Browser"
npm.cmd run test:capacity:browser -- "$Browser"
npm.cmd run test:services:browser -- "$Browser"
npm.cmd run typecheck
npm.cmd run check:scope
```

Adjust $Browser to your installed Edge executable if needed; Linux evidence used installed Chromium. Git, Node 24 and Docker Desktop Linux containers are required. Do not run against the existing owner profile. [Step-by-step owner walkthrough](../../../docs/greenfield/31-SE1-SERVICES-EMPLOYEES-LOCAL.md) describes fresh ports/profile, Juanita, Bernard, solo behavior, service selection, employees, appointment visibility, restart and private backup. Run suites serially to limit Docker disk use.

## Acceptance coverage and limits

The 18 focused tests in `test/se1-services.test.ts` verify exactly one configured service; qualification; active/inactive items; weekly hours; standard duration/buffer; immutable history; solo default-resource auto-qualification; service pagination/restart; stale offer invalidation before allocation; edit-before-preparation atomic rejection; role/tenant denial; idempotent save/replay; concurrent edits; new-customer name after slot; no active services; SQL hours validation; append-only history; random eligibility; no reroll on retries/crash; concurrent remaining capacity; and date-before-service/menu-page handling. Some tests cover several related assertions.

`local/services.test.mjs` uses authenticated real loopback HTTP and TCP PostgreSQL: customer/owner grant separation, forged grants, foreign Origin, unauthorized business, alternate tenant fields, foreign calendar/qualification, create/edit/replay/conflict, booking once, historical price 0.29 without float rounding, crash/restart and coherent inert restore of catalog plus archived/ledger-backed booking. `local/services-browser.mjs` drives actual Spanish forms, creates a qualified employee, selects one service and books directly, checks the appointment, switches tenants and blocks edits during loading, and checks 390px mobile width. [Screenshot](owner-mobile.png) is from this Linux browser test.

The SE-1 protection test pauses at `SUBMISSION_ENTERED` and verifies owner edits plus restart do not mutate its protected state. Its historical test title also mentions UNKNOWN; it is not a separate UNKNOWN-specific catalog-edit schedule. Existing full/fault tests cover uncertain/UNKNOWN outcomes and recovery; this increment is not a new production recovery proof.

Random choice uses cryptographic `randomInt` over unique qualified/available resources. A deterministic injected allocator exercises the candidate boundary in tests; the durable independent intent is reused on retry/restart. A few browser samples do not statistically prove randomness. No preference selector, service bundles, employee-specific durations, payments or onboarding were added.

## Evidence integrity and development failures

`commands.json` records actual argv, UTC times, duration and exit status at the pinned source. `source-integrity.json` records SHA256 for the 24 changed source/doc files and their exact tree; hashes were checked before each final suite and after testing. `manifest.json` records SHA256, byte count and Git blob ID for the evidence files (excluding itself). Public Git readback verification is recorded in the PR publication comment.

`development/` preserves initial failures without relabeling them as passes: new SQL mutation NULL error-text mismatch (corrected to the existing`null_argument` contract); a premature date-test expectation (corrected to begin the booking flow before selecting a service); numeric SQL duration display; a TypeScript closure-narrowing error; the reproducible cross-form stale revision overwrite and a browser click that needed to wait for initial business loading; and local restore failures caused by root disk exhaustion. Unmodified Docker diagnostics show`No space left on device`. Public tool/dependency cache copies were moved to tmpfs with their old paths retained as symlinks; no source/owner data was deleted and no global Docker pruning occurred. After space was available, restore and final suites passed. These development logs are not evidence generated by the final commit.

A pre-final full run began at `a1535a0be75e4834405bda16d5af7f15616cb081` and reported 685 passes. UI/test files changed during that development run; its orchestrator stopped on its source-hash guard. It is not clean pinned-source evidence. The table above is a fresh complete run at `540fc4af57a29eba380c0f53df0bf3ad12093ad7`. No earlier result has been rewritten as a final-source result.

All test data is isolated/synthetic. No private profile, credential, custody key, SQL dump or real customer data is published. Existing owner data, Ana's unresolved case, legacy v0.8.1, PR #16 and PC-1 remain unchanged. No merge, provider activation, cloud/registry action or spending occurred. Production custody/provider/OPS01 gates remain.

Raw log whitespace is retained verbatim. Code/document diff checks exclude these historical stdout files.
