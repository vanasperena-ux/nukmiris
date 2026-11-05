# C1 normal conversation progress — implementation

[Claude's independent L0b review](https://github.com/vanasperena-ux/nukmiris/pull/10#issuecomment-6649052579)
closed L0b for bounded synthetic use subject to C1. Windows L0 and L1 may proceed;
**C1 must be independently verified before L2 interactive booking**. This correction
implements C1 and observations O2/O4. It does not self-close that review gate.

## Machine-sealed supersession

The reducer holds the conversation lock, seals the original priority decision,
and seals one ABANDON record per never-entered attempt. Each record binds tenant,
attempt/payload, priority input, exact reduction digest and CONTEXT_SUPERSEDED reason.
SQL requires these records before committing the revision change and dispositions
together. The reducer cannot call the operator's generic abandonment function.
Its private SQL wrapper reuses that function only for earlier attempts in the same
conversation. Missing custody rolls everything back. Exact retry reuses original
decision/attempt/supersession keys; already-reduced or stale decisions cannot
supersede newer work.

PREPARED and ARMED booking attempts become ABANDONED: CREATE becomes CANCELLED;
MOVE/cancel/attendance restore the known source protection; original operations,
appointments, plans and audit history are retained. The head advances normally
without operator action. An applied booking's never-entered confirmation becomes
EXPIRED, with the booking/protection retained. New confirmation preparation takes
the conversation lock and refuses an expired output.

Submission entry takes that same conversation lock. If entry commits first,
supersession cannot touch SUBMISSION_ENTERED/UNKNOWN/VERIFIED_APPLIED. If priority
commits first, the attempt CAS cannot enter or arm again. A process-local permit
is still issued only in the successful entry COMMIT continuation. There is no
replacement attempt/owner, replay, provider retry or uncertainty release.

Normal deadline expiry now locks conversation → output → attempt and reads DB time
again. It can close PREPARED/ARMED or unattempted confirmation outputs only; entered
or UNKNOWN work remains held. Expiry and entry cannot both succeed. Existing audit
and original output/attempt identities persist. The runtime must schedule ordinary
drain and expiry; this correction adds the safe core mechanisms and acceptance tests.

## O2/O4 and preserved boundaries

O2: malformed output fields raise SQLSTATE P7504 and are recorded with explicit
PLAN_INVALID reason, surfaced as PlanInvalidError. Genuine occupied output IDs
use P7505/UNIQUE_CONFLICT; resource/customer conflicts retain RESOURCE_CONFLICT.
Both terminal rejection categories use the existing PLAN_CONFLICT reduction family,
with sealed planReason distinguishing invalid input from contention. No invalid
plan reserves an appointment or attempt. Original rejected plans remain non-retryable.

O4: TypeScript and SQL strip every non-ASCII-alphanumeric character when identifying
unsupported tenant-key aliases. Punctuated/space/case variants of businessId/tenantId
are rejected. Only exact canonical businessId is supported. Representative synthetic
provider field names (phone_number_id, display_phone_number, wa_id, recipient_id,
conversation/pricing/profile) remain valid; this is not a real Meta contract test.
Actual provider schema compatibility remains mandatory under 016 before integration.

O5 is unchanged: SQL trusts authenticated sealed reducer decisions, including old
context claims. A compromised reducer+sealer can drop a command without effects;
per-revision context-history hardening and independent custody remain future gates.
O6 is unchanged: human mode owns ordinary pending text until Menu; supersession
does not fabricate a bot booking while human mode is active. Returning via Menu
enables the next new booking. One service per appointment remains binding.

## Acceptance and restrictions

`npm run test:progress` covers both priority messages for booking and confirmation
at PREPARED/ARMED and real child crash/freeze-before-arm/before-entry cuts, no
operator progress, SQL rollback/COMMIT loss, machine custody failure, both entry
race orders, deadline expiry, MOVE source preservation, entered/UNKNOWN holds,
PLAN_INVALID versus genuine contention and provider-field alias boundaries.
Full/fault retain accepted WP1/L0a/L0b regressions.

Migration 005 is fresh-fixture-only and refuses existing input/attempt state.
001–004 and roles.sql are preserved. No v0.8.1 or working database is touched.
Exact tested source/results and independent handoff will be recorded in
`vnext/evidence/wp2-c1/`. Native Windows is not inferred from Linux signal tests.
X1, F13/OPS01, 009/011/production-017, N2/N3, A2/A3, 013/016, N6/Windows and all
real-provider/GCP/merge/deployment restrictions remain unchanged.
