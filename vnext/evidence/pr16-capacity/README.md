# Controlled four-customer / two-employee capacity — evidence

**Exact tested source:** `7f35b2f0f1fc251ac90fdb9c0796782dc20d60c2`; tree `c0e67ef3a854db71a5bb93061ebf7c9953dc77a7`;
parent `b9b5e2d8ffbfdaf13c7a1022a316c81c5fd71d3c`. Source changes only local fixture/viewer/tests, package scripts
and register statuses. src/, all SQL/roles, legacy, name validator, archive and
dispatcher remain byte-identical to the parent. Subsequent follow-up adds only
this evidence folder, Windows guide28, handoff19, immutable v1.4 reference copy
and register results.

Current authoritative **Feature Register v1.4**, commit
**10d5181720a04492cb837ac8abc869c78de81359**, blob **6783f7194b7acbd458e5c53d51fd60647c0cc14d**.
Read completely, including owner Steps8/9/12B. Exact reference copied under
[references](../../../docs/greenfield/references/FEATURE_REGISTER_v1.4_10d5181.md).
Earlier v1.3/d1399b90 historical prefix retained in implementation register;
current-reference and status addenda follow. Documentation branch is unchanged
by Codex and remains unmerged.
Scope: [owner6725118485](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6725118485).

## Actual executed results

Linux **Node24.19.0/npm11.9.0/measured pinned PostgreSQL17.11**.
One build at the exact pin, then direct Node harnesses equivalent to npm scripts.
Core/local pipelines overlap in separate isolated fixtures. Timings/O3 are host
observations, not an idle-host benchmark or a Windows performance guarantee.

| Suite | PASS | FAIL | SKIP | Evidence |
|---|---:|---:|---:|---|
|full|554|0|0|[full.log](full.log)|
|fault|544|0|0|[fault.log](fault.log)|
|concurrency|415|0|0|[concurrency.log](concurrency.log)|
|focused|267|0|0|[focused.log](focused.log)|
|runtime|43|0|2|[runtime.log](runtime.log)|
|capacity|4|0|0|[capacity.log](capacity.log)|
|browser|1|0|0|[browser.log](browser.log)|
|capacity-browser|1|0|0|[capacity-browser.log](capacity-browser.log)|

Build/typecheck/scope pass. Suites overlap: do not sum them. Runtime has45 total
cases, including2 native Windows ACL/metadata-sync skips on Linux. New fixture
native Windows is NOT RUN by Codex; owner Test17C is **PENDING**. Previous owner
45/45 runtime/008+009/restart/Ana acceptance is [separate evidence](owner-native-prior.json),
not this fixture's native/browser acceptance. NM-040/042 remain READY FOR TEST.

[Summary](summary.json) · [actual runtime/browser measurements](measured-runtime.json)
· [provenance](source-provenance.json) · [source hashes](source-sha256.txt)
· [artifact hashes](artifact-sha256.txt) · [O3 raw measurements](o3-full-run.json).
No fixture state.json, SQL dump, archive, ledger, backup, key, private URL/token or
owner data is published. Only textual measurements/logs/hashes and raw synthetic
browser captures are copied. Each core suite has its own measured environment.

## Controlled proof and limits

- Four independently pre-identified customers, two equally qualified employees,
  one implicit service60min+15min buffer. Future09:00 opening slot, no absences or
  other blockers. Deterministic relative setup with actual DB clock, not a clock
  override; offer expiry remains15minutes. Owner must repeat before expiry.
- Customer4 first receives a real delivered action/reply/revision/expiry. Customers
  1 and2 then each directly book the same start on different employees. SQL has
  2 ACTIVE appointments,2 operations/intents/calendar rows,4 verified attempts/CORE
  ledger rows,2 persistent `[09:00,10:15)` protections,0 guards/pending attempts.
- Customer4 sends original action through the unchanged authenticated message
  handler. Its old button is still clickable before submission. No3rd booking,
  alternate substitution, duplicate, false success, intent, attempt or CORE effect.
  A normal choose-again reply is delivered. Exact request replay preserves input
  ID; new-ID stale replays/crash/restart preserve original offer metadata.
- Three near-simultaneous HTTP action admissions to two places yield exactly2
  bookings. Existing SQL concurrency/fault suites retain lower-level race proof;
  local app worker processes conversations in its existing ordered loop. This
  fixture does not claim production multi-worker/L2 custody readiness.
- Fresh Customer3 excludes09:00 and offers10:30/11:00, respecting buffer+grid.
  Another tenant cannot use A's action; own availability/booking and unrelated
  customer's later legitimate booking work without changing target capacity.
- Isolation/path/port guards and real CLI prepare/start/status/stop/reset execute
  with spaces/Unicode. Reset preserves verified backup/previous private custody,
  creates new instance/database and stays stopped. An owner-like filesystem
  sentinel is unchanged; no actual owner's Windows profile was accessed.

Read-only backend report uses repeatable-read tenant reducer/RLS; full live fixture
configuration, rows, ranges and saved action are available through capacity:status
and the authenticated browser. These SQL facts are separate from observation of
greying. Local owner remains trusted; this is not staff authorization/custody.

## Raw browser screenshots — Linux, not owner acceptance

1. [Original offer](01-original-offer.png): real Customer4 ID/revision/expiry.
2. [Full capacity](02-full-capacity.png): both09:00 confirmations, two employees,
   old Customer4 button still clickable.
3. [Stale rejection](03-stale-rejected.png): choose-again, all checks true,0 C4
   effects,2 total target appointments/2 protections/4 attempts.
4. [Fresh alternatives](04-fresh-alternatives.png): after crash/replay, Customer3
   gets10:30/11:00, no09:00.

IDs/dates/ports are from this disposable run; owner's setup generates new values.
Screenshots were captured directly by Chromium CDP, without editing.

## Reproduce

Fresh exact-source checkout, from vnext:

```text
npm ci --ignore-scripts
npm run build
node scripts/run-tests.mjs
node scripts/run-tests.mjs fault
node scripts/run-tests.mjs concurrency
node scripts/run-tests.mjs l2
node --test --test-concurrency=1 local/platform.test.mjs local/command-lock.test.mjs local/runtime.test.mjs local/interactive.test.mjs
node --test --test-concurrency=1 local/capacity.test.mjs
node local/browser-smoke.mjs
node local/capacity-browser.mjs chromium <private-screenshot-directory>
npm run typecheck
npm run check:scope
```

Browser requires Chromium/Edge executable; screenshot path is optional. Tests use
isolated generated fixtures and clean only those owned resources. For manual
Windows setup/run/stop/reset use [guide28](../../../docs/greenfield/28-CONTROLLED-CAPACITY-WINDOWS.md).
[Claude handoff19](../../../docs/greenfield/reviews/19-CLAUDE-CONTROLLED-CAPACITY-FIXTURE.md)
invites review of local boundary/report; production booking logic is unchanged.

## Remaining scope/gates

Owner browser Test17C and native fixture execution PENDING. **NM-045** support-entry
summary and residual **C1/NM-009/032** phrase/name problem remain the NEXT separate
correction scope, NOT implemented here. No summary/name code was changed or extra
confirmation introduced. Owner .local-demo, Ana UNKNOWN, accidental appointment
and all other state remain untouched. No new policy/overlap ban or ordering bypass.
PR16 Draft/unmerged; Milestone A/full parity remain open. All production record-
chain AND index-extension, archive/repair, uncertainty/provider/OPS01 gates remain.
No real Meta/Google, GCP, deployment or old-checkout activation.
