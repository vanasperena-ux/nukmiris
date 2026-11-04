# WP1 bounded implementation charter — proposed for explicit owner approval

Status update — **owner approved this WP1 charter on 2026-11-01**: “WP1 charter approved.” Synthetic implementation is authorized within this exact bound. The original planning text below is preserved; its former not-started status is superseded by [the implementation record](10-WP1-IMPLEMENTATION-STATUS.md). WP2, merge, deployment, provider activation and the commercial MVP remain unauthorized. Independent Claude CP1/initial CP2 review is pending.

## Objective, bound and success demonstration

Demonstrate that a fresh transactional core can preserve one original authenticated input, admission seal, scoped appointment/resource intent, nontransferable attempt, consent/status revision, result and uncertainty through competing workers, crashes and inert restore. Answer the prior unresolved SC5/8/13 and the **local** part of SC14 before expanding into booking UX. Deployed physical late-send/failover containment remains WP5 proof; do not mark it solved by this harness.

Recommended authorization: **WP1 only, 3–5 engineer-weeks**, one experienced engineer with independent review at CP1/initial CP2. Checkpoint after the first engineer-week on schema/locking/admission feasibility; if the estimated bound or safety claim cannot be met, stop and return evidence/revised charter. Owner may set a different effort bound in approval. No paid production service is necessary or included.

Smallest vertical path, test-harness entry only:

1. Seed two synthetic businesses, one default resource/customer/channel/calendar each; use a third fixture resource only to test shared-Calendar future structure. These are test identities, not onboarding features.
2. Authenticate raw signed synthetic input → archive PREPARE → SQL STAGED → independent COMMIT_SEAL → SQL ELIGIBLE. Inject failures at each cut and deny all unsealed execution.
3. Test-only command prepares one fixed synthetic appointment operation; acquire appointment guard and interval protection, persist immutable attempt/identity envelope. No intent/date/name/service/customer conversation UI.
4. Sole dispatcher admits after permission/status/version/deadline locks, consumes one-use permit, invokes **fake** provider once. The fake durable provider ledger accepts but intentionally loses its response. Kill/freeze the process, start a contender, and prove no second automatic invocation. Read-only fake reconciliation can resolve the exact operation.
5. Seal result and atomically finalize synthetic observation/schedule revision plus one ordered output intent. Submit through fake message adapter with receipt-before-response and lost-response variants. No real Meta/Google clients exist.
6. Record STOP for a previously unknown sender and suspend one business during preflight. Prove before-gate suppression, no cross-tenant suppression and future-only reactivation. These are core gate tests, not consent/billing product workflows.
7. Snapshot then accept suppression/possible-arm evidence; destroy **only fixture SQL**, restore from fixture archive/keys inertly. Missing head/tail/key/identity retains holds; no replayed effect or newly allocated ID. Capture the paused-after-final-gate late-submit counterexample and required deployment-containment follow-up.

## Precise candidate file and schema scope

All future changes confined to a new `vnext/` tree plus documentation/evidence. The current backend/static files/config/lockfile/schema/tests/data remain unchanged. The list below is a proposed allowlist; additions must be justified against the same bounded proof in review, not used to add workflows.

| Proposed path(s) | Exact responsibility |
|---|---|
| `vnext/package.json`, `package-lock.json`, `tsconfig.json`, `README.md` | Node 24.x/strict TS, built-in test runner, minimal PG client; compile/test commands and synthetic-only setup. No Google/Meta SDK or application start command. |
| `vnext/src/domain/protocol.ts`, `ports.ts` | Typed state transitions, immutable envelope/context/revision/token interfaces; pure rules |
| `vnext/src/infrastructure/postgres/migrations/001-foundation.sql`, `002-execution.sql`, `roles.sql` | Minimal scoped identities, heads, staged/sealed admission, operation/attempt/output/receipt/guard/protection/audit/evidence refs; non-null/composite FKs/range/uniqueness/grants |
| `vnext/src/infrastructure/postgres/unit-of-work.ts` | Real transaction boundaries, lock order, affected-row/CAS checks, scoped grants; no effect calls |
| `vnext/src/infrastructure/meta-signature.ts` | Exact raw-byte verifier only; no provider HTTP calls |
| `vnext/src/application/admit-input.ts`, `prepare-operation.ts` | A1–A5 admission, original identity allocation once, fake-command operation plan |
| `vnext/src/application/dispatch-once.ts`, `record-result.ts` | Nontransferable arm/final gate/one-use token, sealed evidence result and idempotent finalizer |
| `vnext/src/application/restore-inert.ts` | Original identity reconstruction, suppression-first holds, no auto resume |
| `vnext/test/support/{postgres-fixture,fake-archive,fake-provider,scheduler,worker-process}.ts` | Disposable two-session/process setup, durable fake ledger, exact fault/signal barriers and seeded schedule driver |
| `vnext/test/{ingress,database,dispatch,permission,restore,process}.test.ts` | F/DB/SEC tests below; zero live networking except fixture loopback/DB |
| `vnext/evidence/<commit>/...`, `docs/greenfield/...` | Reproducible logs/rows/effect counts, source hashes, threat limits, review dispositions |

Minimal schema: business execution head, channel/calendar/resource/customer identity; conversation/output head; permission head/evidence for known/unknown subject; input batch/STAGED/ELIGIBLE seal; operation, immutable attempt envelope, mutation guard, finite interval protections; original event identity/schedule revision; output/receipt; recovery/audit references. Fixture identity/adoption origin APP_CREATED only. No service/staff-profile/location UI, import pipeline, complete reminder tables/scheduler, payment/auth integration, support UI or customer CRUD. A default location field/reference may be retained if required by scoped keys; full future tables wait for their feature charter.

WP1 fresh schema may be destroyed/recreated only **between independent fixture cases**. A crash/recovery case preserves SQL/archives/provider state until the deliberate destructive-loss step, then replays original evidence into an inert destination. No migration of POC data and no reads of its secrets/working DB. PostgreSQL local binary or disposable container setup may be installed only under the approved synthetic tool scope; if containers are used, runtime Docker proxy/CA instructions apply. Versions and lockfiles must be recorded. Development dependencies cannot activate providers.

## Required safety evidence and exit gates

| Gate | Measurable evidence | Stop/go rule |
|---|---|---|
| C1 Admission/archives | F01–09; DB01; SEC01/02/04; every A1–A5 write and lost-response cut; duplicate/conflicting whole batch | No ACK or claim of executable work before independent seal; original keys/sequence preserved |
| C2 Constraints/tenant | DB02–05 and SEC03 under actual PG roles/two connections, same-event kinds including attendance/cancel, finite union range and two-resource test | No dual mutator, cross-business FK/read/effect or dropped protection |
| C3 Dispatch/consent/status | F10–23/25/29 and F27 synthetic eligibility-gate subset, DB06–08, two real worker processes; at least 1,000 recorded seeded interleavings | One possible automatic invocation per admitted attempt; before-gate STOP/suspension wins; no timer rearm; full four-kind reminder timing waits for WP4 |
| C4 Recovery/evidence | F08/09/16–19/24–29; local REC01 subset; original identity/possible-arm restored with no receipt | Inert restore/unknown completeness holds, no revived grant/invented ID/second call |
| C5 Scope/build | Typecheck + applicable synthetic suite, import/client confinement, external-call-denying fake adapters, diff audit | Only candidate `vnext/` and review docs; zero real account/POC writes; baseline remains unchanged |
| C6 Review | Exact source diff, DDL/grants, commands/raw logs/environment, hashes, failed-then-fixed cases, persisted rows/archive heads/provider call counts; CP1 and initial CP2 Claude review | All critical/high correctness issues resolved or capability disabled; owner explicitly approves next package |

Test commands are to be created and verified **during authorized WP1**, not represented as currently runnable: from isolated `vnext/`, `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`, and a named `npm run test:fault` for process/DB cases. Windows equivalents use `npm.cmd`. Include local PostgreSQL fixture setup/teardown and a single reproducible harness command in README. No future test can pass merely because a simulator returns the expected assumed contract: assert durable provider ledger invocation count, DB rows, head chain and illegal-state rejection. Report OS signal limitations separately on Windows.

Late physical submission after pre-socket freeze is an explicit **unresolved deployed guarantee**. Passing C3 establishes single invocation and gate ordering, not universal no-late-send. A test that reproduces this counterexample must remain in evidence and OPS01 backlog; production promotion is blocked until containment is demonstrated. Honest fail-closed inability to recover safely is an acceptable WP1 outcome, accompanied by held scope and operator report. A second possible invocation, false success or grant revival is not acceptable.

## Exclusions, rollback and next gate

No complete booking UI/state machine, service catalogue, employee picker, manual event ingestion, native coexistence, consent UI, billing, survey, dashboard, real network provider adapter, real provider credentials, cloud deployment, migration, cutover, baseline cleanup, merge or live sends. No same-ID reinsert, ETag-bump recovery, unsafe generic reply, uncertainty timeout release or hidden SDK retry.

Rollback: stop harness workers, retain failure evidence, remove only disposable fixture resources and candidate worktree after inspection. Baseline requires no rollback because it was never modified. Preserve candidate journals and fake provider ledger before cleanup; do not make a failed test pass by resetting interrupted state. No provider token exists to revoke in this slice.

After CP1/initial CP2, publish actual evidence and updated effort/risk estimate. Stop. WP2 needs a new charter and explicit owner authorization. No provider account test is implied by WP1 approval.

## Exact approval requested

**“Approve WP1 as specified in `docs/greenfield/08-WP1-BOUNDED-IMPLEMENTATION-CHARTER.md`: synthetic-only implementation in an isolated `vnext/` tree and disposable PostgreSQL/fake stores, within the proposed 3–5 engineer-week bound, with CP1/initial CP2 independent Claude review and stop/go evidence. Preserve v0.8.1. No real provider access, deployment, merge, cutover or later package is authorized.”**

Owner may revise the scope/bound instead. WP0 review completion, Draft PR status or approval of product journeys does not substitute for this express authorization. This explicit gate comes from the master handoff §0/§4/§6 and the owner's current instruction to stop before WP1; it is not a new approval flow invented by this plan.
