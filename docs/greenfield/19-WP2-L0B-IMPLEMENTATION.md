# WP2-L0b implementation and acceptance boundary

Milestone A, Issue #7. WP1 and L0a are independently accepted **only for bounded
local synthetic use**. Authorizing source:
[Claude L0a closure](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6646622771).
The owner explicitly authorized L0b code. This increment is implemented; **independent
L0b acceptance is pending**. No existing Draft PR was merged or v0.8.1 file changed.

Exact tested source and reproducible results are recorded in
[the evidence package](../../vnext/evidence/wp2-l0b/README.md), with a separate
[Claude handoff](reviews/08-CLAUDE-WP2-L0B-REVIEW-HANDOFF.md).

## Implemented behavior

The authenticated parser produces `L0B-CLASS-1` once for each original INPUT. It
seals version, kind, operation selector, tenant, channel, subject, input identity
and event digest. SQL validates the exact sealed shape and reads that decision;
it does not normalize message text a second time. Exact and repacked retries reuse
the first INPUT/classification. Unsupported versions/tampering hold without new IDs.

Withdrawal and receipt controls receive durable control reductions at activation.
Withdrawal additionally requires the matching durable revoke, namespaced by channel
and provider ID. All validated immediate withdrawals execute before archive work,
even when another tenant's facade or raw custody is unavailable. Replayed batches
do not resurrect permission. Receipt correlation and provider/result rules remain.

Ordinary input is reduced under a conversation lock into NAVIGATION, HUMAN_HANDOFF,
CONTEXT_INPUT, NO_EFFECT or PLAN_CONFLICT, with a sealed original context revision.
Menu returns to BOT/NONE; human mode owns ordinary text until Menu. NAME/DATE input
retains the original value for the later booking reducer, even when it equals the
synthetic command literal. There is **no name/date validation, availability engine
or customer-facing reply implementation yet**. These local decisions have explicit
`LOCAL_ONLY` output disposition; they do not invent sent messages. A normal
`drainOrdinary` call completes non-mutating successors after a predecessor resolves.
Admission invokes it for touched conversations; the later runtime must schedule it
after finalization/recovery as well. Its 100-input page bound requires repeat work
for larger backlogs. No operator HOLD is used for ordinary progress.

Only the exact synthetic command in BOT/NONE can request an operation. Preparation
checks the conversation head before plan allocation and again inside SQL before
appointment, operation, guard, protection or attempt writes. Earlier STAGED,
unreduced ordinary, pending-confirmation or UNKNOWN work remains a barrier. Two PG
sessions cannot let the later request reserve first. Menu/human priority may update
local context while older work is held, but never releases its protection.
Envelopes bind the context revision; later context changes conservatively deny
old dispatch. A frozen reduction recovered after a newer context does not overwrite
that context. Physical provider cutoff remains unproved (F13/OPS01).

SQL uniqueness, exclusion, context-change and lock-timeout conflicts roll back the
reservation subtransaction and commit an immutable rejection marker in the outer
transaction. A sealed PLAN_CONFLICT completes it. If custody fails after the marker,
ordinary reduction reconciliation finishes the same input; the rejected plan is
never retried with new identities. Unknown COMMIT/entered outcomes retain holds.
A narrowly scoped cancellation confirmation is allowed only for its verified CANCEL
parent and current schedule revision; reminders still require ACTIVE appointments.
The synthetic create → confirm → cancel → confirm path releases its slot normally.

## Required inbound safeguards

**N1:** distinct typed busy/pending/deadline/held errors. Read-only facade calls get
at most five attempts with 25/50/100/200ms backoff within 1,000ms total, including
queue wait. Composing wrappers cannot multiply this limit. Integrity failures and
repair fences are not retried or converted into absence. Appends get one invocation;
reconciliation always uses the original key/intent. Failed admission withholds ACK;
dispatch read exhaustion returns HELD with zero HTTP calls. SQL admission rechecks
the actual operation deadline. A caller deadline cannot preempt synchronous local
CPU/filesystem work; cold audits/linear repair still have N6's held-window limits.

**N4/A1:** canonical tenant IDs are lower-case ASCII slugs, maximum 64 characters.
Only exact `businessId` is supported; case/underscore aliases and tenantId variants
are rejected recursively in archive allocation/decode and SQL registration. Signed
text/receipt schemas reject unsupported keys before writes. JSON strings are opaque
text, never trusted tenant-routing metadata. Fixed server route configuration has
no duplicate WABA/number binding.

**N5:** authenticated WABA/number → configured business → matching tenant facade.
There is no first/default facade fallback. `ingress-custody` has a separate raw
capability; tenant records contain references/digests, not mixed raw bytes.
Missing/foreign bindings fail closed. Fixture process/role/key custody remains a
procedural trust root, **not production isolation from compromised runtime**.

**A2 / 011:** metadata tenant-policy version 2 is mandatory. Open/read/repair reject
older archives without rewriting their records. Tests recreate local synthetic
state and never reuse pre-N4 archives. Rejection is not an implemented production
quarantine service: operator-controlled retention, independent revalidation and
signed repair remain required before any real migration/reuse.

**A3:** queue and witness read/advance/repair-finish calls have deadlines (default
1,000ms; configured integer 1–10,000ms). An expired queued write never invokes its
factory. A never-answering/late witness cannot keep the mutex forever or confirm
after timeout; committed pending data/repair epoch stays held. Repair recovers the
original owner, never a replacement. Deadline does not cancel a remote side effect.
Remote witnesses and L2 multi-worker operation still require independent transport,
late-completion, scheduling and recovery acceptance with realistic local timings.

**O3:** migration 004 runs after existing migrations/roles in a fresh disposable
fixture. It refuses existing input/attempt state before changing constraints.
Migrations 001–003 and roles.sql are byte-preserved. There is no live upgrade or
automatic reclassification; older snapshots remain inert if classification is absent.

## Requirement-to-acceptance matrix

All paths below are relative to `vnext/test/`. Full/fault/concurrency commands and
exact results are in the evidence package; this matrix states the claim each test
supports, not independent acceptance or production assurance.

| Requirement | Automated acceptance evidence | Required observation |
|---|---|---|
| W2-CL01 | `l0b-classification.test.ts`: accented/NFD/punctuation STOP cases | One class drives durable withdrawal and SQL head handling; no false grant or poisoned next command. |
| W2-CL02 | Same file: ordinary chat, NAME/DATE, human, Menu; `l0b-ordering.test.ts`: reduction rollback/new context | Terminal local outcome, no fabricated appointment, original value/context retained, no stale overwrite. |
| W2-CL03 | Classification exact/repacked retries and six tamper cases; activation COMMIT loss | Original class/IDs/sequence survive; altered version/type/rule/kind/digest/subject denied. |
| W2-CL04 | Mixed tenants and missing binding/outage | All authenticated STOPs durable before archive; no ACK until partitions finish; no tenant/raw leak. |
| W2-RP01 | `l0b-ordering.test.ts`: later-first application + direct SQL | Later input creates zero reservation/protection/attempt rows. |
| W2-RP02 | Concurrent workers, STAGED crash cut, ELIGIBLE-unreduced crash cut | Lower sequence wins; original activation/drain progresses without operator discard. |
| W2-RP03 | UNKNOWN same/different slots + Menu + read-only proof + confirmation | Original guards/ranges retained; no later reservation or resend; exact proof and terminal output advance. |
| W2-RP04 | Ordinary drain after resolved predecessor; create/cancel confirmations | Normal non-mutating progress and cancellation release; pending/UNKNOWN output remains a barrier. |
| N1 | `l0b-archive-policy.test.ts` read limits/composition/deadline; admission + dispatch integration; existing archive process tests | Five reads maximum, one write invocation, no error-as-absence/ACK/HTTP; original identities recover. |
| N4/A1 | Recursive alias/canonical-ID cases; strict inbound schema; SQL forged-digest registration | Unsupported binding keys cannot be trusted through any tested boundary. |
| N5 | Mixed tenant, wrong/missing facade/raw, same provider ID on two channels | Authenticated route owns tenant selection; distinct revokes; no fallback/raw disclosure. |
| A2 | Old policy open/audit/repair denial | Original rows untouched; fresh archive required; production quarantine remains gated. |
| A3 | Never-answering read/advance/finish, late response, expired queued allocation | Deadline releases ownership; pending epoch/data held; original key/owner recovered. |
| O1 | Output collision, real 50ms SQL lock timeout, marker-before-custody failure | Reservation rollback plus immutable rejection; terminal reconciliation without plan replay. |
| O3 | Migration rerun over existing input | Refusal with identical before/after snapshot. |
| Regression | Existing database, ingress, dispatch, permission, recovery, process, archive and C1/C4 suites | RLS, tenant history, uncertainty, receipt, suspension and protected output identity remain enforced. |
| Residuals | X1 and F13 security-boundary tests | Both still reproduce; no claim of production history-extension protection or physical cutoff. |

## Remaining gates and immediate implementation sequence

L0b stays OPEN until Claude independently verifies code, adversarial schedules and
evidence. N2 partial forensic publication and N3 pre-existing stale-writer commits
remain production repair gate 011 prerequisites. N6 linear rebuild/held window,
roughly 3× disk plus headroom, native Windows RAM/storage/WAL/process behavior and
owner-device acceptance remain OPEN. The historical L0a million-record benchmark
is not a new L0b performance claim or a Windows SLO. Large-index regressions still
run in the full suite; no new million-record benchmark is claimed here.

B2/X1 is unchanged: CAS and monotonic size/epoch **do not independently verify
append-only history extension**. Before non-fixture custody, independent verification
of **both record-chain and key-index extension** is mandatory (009/production-017).
Keep all preserved 001/F13, 009, 011, 013/016 and OPS01 activation requirements in
[document 16](16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md).
No Meta/Google integration, GCP, credentials, merge, deployment or cutover is enabled.

After L0b acceptance, the first code task is the remaining Windows L0 runtime:
isolated TCP PostgreSQL fixture connection, portable child start/stop/crash handling,
fresh local bootstrap/start/stop/reset/backup commands and a native Windows smoke
on the owner's laptop, away from accepted v0.8.1 data. Then implement L1's fake
availability/completeness/hours/buffers/time-zone model and transcript oracle, and
L2's minimal local interactive booking flow using the accepted slot/name UX.
Known/new customer, direct slot commit and **one service per appointment** remain
the approved direction; move/cancel follow the first booking demonstration.
These are implementation tasks under the existing charter, not another planning-only
approval loop. Provider/custody/OPS01 gates remain separate and closed.
