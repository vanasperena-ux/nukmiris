# Actual WP1 candidate — independent Claude CP1/initial CP2 handoff

The owner approved WP1 on 2026-11-01. This handoff now accompanies **actual code,
DDL, grants, process tests and stored evidence**, rather than the WP0 proposal
alone. No independent Claude review has yet run; no Claude tool/CLI is available
in this environment. Do not treat Codex's test results as independent acceptance.

Read [the approved charter](08-WP1-BOUNDED-IMPLEMENTATION-CHARTER.md),
[current status/limitations](10-WP1-IMPLEMENTATION-STATUS.md),
[the source package](../../vnext/README.md), and
[full checkpoint evidence](../../vnext/evidence/checkpoint-1/README.md).
The source manifest identifies every tested implementation/test/script/lockfile
hash; the evidence commit names the exact source commit. Use the implementation
PR diff against `planning/greenfield-wp0-2026-10-31` (WP0 `e305bab…`).

## Review targets

| Concern / earlier source | Actual files / evidence |
|---|---|
| Q7 / SC1 / E10 admission archive-before-execution | `application/admit-input.ts`; 001 schema stage/seal functions; ingress tests and F03 boundary traces |
| Q2 / SC5 / E03 nontransferable attempt and one-use continuation | `application/dispatch-once.ts`; `core.arm`/`enter_submission`; dispatch and real process tests |
| Q8 / SC8 / E12 persistent permission head and final lock | 001 suppress/grant functions; 002 final admission; permission tests and actual waited-row case |
| G06 business status execution gate | 001 `set_status`; 002 `arm`/`enter_submission`; permission/scheduler tests |
| Q3 / SC4 / E02 composite identities, event guard and union protection | 001/002 migrations; real two-session booking contention; database tests |
| Q9/Q10 / SC3/11 / E07 origin, full ownership and actual grants | `roles.sql`; FK/role/pool/forged-context tests; database-inventory evidence |
| Q4/Q5 / SC7/9 / E04 output order and receipt facts | `core.accept_receipt`/`expire_unsent`; F20/22 traces; no generic attendance UX implemented |
| Q6/Q13 / SC13/14 / E06/11 inert recovery closure | `application/restore-inert.ts`; `core.restore_snapshot`; restore tests/snapshots and original-identity cases |
| F13 residual physical late submission | Process test and `F13-RESIDUAL-LATE-SUBMISSION` evidence; explicit unresolved OPS01 gate |
| Scope, fake adapter confinement | `scripts/check-scope.mjs`; no Google/Meta SDK, application start command or backend changes |

Paths in the first column's code references are under `vnext/src/`; tests are
under `vnext/test/`. Original Q/SC/E language and 37 product approvals remain
pinned through WP0 document 01. No persona/G06 decision is reopened.

## Copyable challenge

> Independently review the actual WP1 diff and evidence. Look for a concrete
> counterexample, not agreement with the design summary. Do not implement, merge,
> deploy, contact users or call real providers. WP1 is synthetic only; WP2 is not
> authorized. Separate implementation bugs from intentionally deferred commercial
> and deployed guarantees.
>
> Check each SQL write/commit and archive-write boundary. Can unsealed STAGED work
> ever execute or acknowledge? Can lost responses or repacked/conflicting batches
> allocate a second identity? Does missing prefix/tail/head/witness/key retain a
> hold? Is the sealer trust boundary explicit rather than falsely authenticated by
> SQL? Can an invalid seal be substituted for a different plan/attempt/result?
>
> Challenge two dispatch loops and two processes before/after ARM, known or unknown
> commit, before socket, after remote acceptance and before finalization. Is there
> any route to a second automatic invocation, reusable permit or changed envelope?
> Do not accept the F13 residual counterexample as proof of a physical cutoff.
>
> Inspect unknown-sender upsert/withdrawal against final send admission, shared lock
> order and READ COMMITTED visibility after waiting. Can a stale grant, null JSON
> revision, epoch or restored record revive authority? Does suspension block queued
> mutation/message admission without suppressing legitimate permission withdrawal
> or changing the reminder-versus-customer-request scope?
>
> Execute the actual target-PG constraints/roles and same-event mutator races. Check
> composite business/customer/calendar/resource/event binding, nonempty finite
> half-open ranges, source/target union, failed transaction rollback and late result
> ownership. Can a shared Calendar allow two distinct resources? Can JSON null or
> missing version values bypass SQL three-valued conditions? Test PUBLIC function
> execute, definer search paths, SET ROLE/context and pooled connection reset.
>
> Verify result/receipt ordering and exact attempt correlation, unknown output head
> retention, result persistence failure, and idempotent local finalization. Can a
> receipt become a customer command? Can a copied/foreign tuple or wrong proof
> free a protected appointment? Does fixture reset ever erase the state inside a
> crash/recovery case? Distinguish the 1,000 SQL schedules from HTTP/process tests.
>
> Check inert recovery: original missing identities must remain review evidence,
> not be reconstructed as new effects. Suppression and dispatch-disabled heads must
> survive snapshot replay even with incomplete evidence. Identify exactly what
> remains unproven about real archive custody, HA, authentication, old-instance
> containment and native Windows behavior. Do not demand WP2/provider/UI features
> as a hidden expansion of this charter.

## Required disposition

Return stable `CR-WP1-###` findings with severity, exact file/line and source
requirement, minimal reproducible trace, expected versus observed durable state,
proposed correction and verifying test. Label static deduction, actual local test,
provider guarantee (if any) and remaining uncertainty separately. Include the
tested source commit/manifest and command/environment.

Give **GO FOR NEXT CHARTER REVIEW**, **GO WITH SPECIFIED REVISIONS**, or **NO-GO**.
That recommendation does not authorize WP2 or any live action. Codex must record
accepted/corrected/disputed/disabled disposition with evidence; owner approval
for the next package is separate. CP1/initial CP2 remains pending until this
independent review and critical/high findings disposition exist.
