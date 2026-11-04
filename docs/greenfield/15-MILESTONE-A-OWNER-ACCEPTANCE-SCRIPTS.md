# Milestone A — proposed Juanita and Bernard owner walkthroughs

2026-11-03. **Every app walkthrough below is NOT RUN / implementation pending.**
The WP1 SQL harness exists; the browser app described here does not. This is the
first local acceptance path for [Issue #7](https://github.com/vanasperena-ux/nukmiris/issues/7),
to be implemented only after independent WP1 closure under the
[bounded charter](13-MILESTONE-A-DELIVERY-AND-WP2-CHARTER.md).

## Controlled fixtures and evidence

Only synthetic people, channels and calendars. Set the synthetic demo clock to Monday **2030-01-07**, 09:00
America/Mexico_City (**2030-01-07T15:00:00Z**), for the weekday slot examples.
Only the privileged fake-demo bootstrap may set its test clock; runtime roles
cannot alter database time and real providers remain unavailable.
No real customer message, phone, Google Calendar or inherited v0.8.1 state.

Juanita's Nail Salon: accepted example settings (weekday 10:00–19:00, 60-minute
starts/duration, zero buffer, lunch 13:00–14:00), one implicit resource. Known demo
customer and separate unregistered demo subject. The weekday starts are
10, 11, 12, 14, 15, 16, 17, 18 before any busy intervals. Preserve business-local
civil dates; fixtures must explicitly record received instants/window/deadline.

Bernard's Grooming Salon: a second isolated synthetic business/calendar/resource
with the **same explicit sample hours initially**, so P0 behavior can be compared.
Those hours are a test fixture, not a claim about Bernard's actual business.
Use the same synthetic sender value at both salons to test separate customer scope.
No staff/service picker in either P0 flow. A later team-mode walkthrough is separate.

At each step record full outbound payload/transcript, selected opaque action,
operation/event/attempt IDs, fake calendar and message-ledger call counts, relevant
SQL state, screenshot and defect ID. Inspecting a list in the simulator is not
proof of a provider effect; verify the durable ledger. Compare with the accepted
[parity oracle](05-P0-PARITY-CONTRACT-AND-TEST-PLAN.md), not a newly rewritten script.

## Juanita first demonstration

| Case | Owner action in local simulator | Expected result / observable evidence | Current result |
|---|---|---|---|
| A01 — known customer | Select Juanita + known subject; send `menu`, then `cita`; select offered slot | Exact accepted greeting/menu; two slots first; no service/staff/extra confirmation. Slot selection makes one verified fake Calendar CREATE; one confirmation intent, original event identity saved. | NOT RUN |
| A02 — new customer | Start new subject, send `cita`, choose slot, enter invalid name `12`, then `Alberto Pérez` | No name prompt before slot; invalid input changes neither customer nor calendar. Valid name commits after fresh recheck, exact booking confirmation; no extra registration “Gracias” screen. | NOT RUN |
| A03 — navigation | Request Más opciones, choose date/list/typed `7/1/2030`, page daily times | Two + two + date route retained. All valid weekday times accessible; lunch/past/horizon checks; browsing/name prompt do not reserve calendar or promise a hold. | NOT RUN |
| A04 — changed slot / unavailable calendar | Offer a free slot; inject a fake external busy block before selection. Repeat with failed/partial calendar response | Fresh check refuses booking into busy time and presents accepted alternatives. Failed/partial response is an error/hold, never “free” or a false empty appointment list. | NOT RUN |
| A05 — move | With one upcoming appointment send `reagendar`, select replacement; repeat after seeding two owned appointments | One-event path directly shows replacement availability; multiple path first asks exact owned target. Selection moves the same event once, retains original on failure/UNKNOWN; no added confirmation click. | NOT RUN |
| A06 — cancel | Send `cancelar`; choose target; repeat same action | Always explicit owned target; target selection cancels once. A verified CANCELLED appointment can produce its cancellation confirmation without passing a reminder-only ACTIVE gate; duplicate action does not mutate/send twice. | NOT RUN |
| A07 — stale/foreign/duplicate | Reuse old choice after Menu, alter business/customer/action ID, submit same signed input twice | Denial/expired guidance or original durable result as appropriate; no foreign read/effect, no hidden-index authority, no duplicate provider invocation. | NOT RUN |
| A08 — unknown create/change/send | Fake provider accepts then loses response; restart candidate; query original status | Exact accepted uncertainty wording; original IDs/owner and protections retained, output order held, no false success or automatic second call. Read-only exact fake proof may resolve locally; timer does not free slot. | NOT RUN |
| A09 — lookup outage / restart result | Inject list failure, restart after a known result, request original status | Error is not “no appointments”; known result is replayed from original operation while current calendar truth is labelled separately; no new create/change. | NOT RUN |
| A10 — human/Menu | Choose Hablar con alguien, send original text and an action, then `menu` | Original text stored in correct scoped handoff, scheduling suppressed in human mode. Menu returns accepted menu without abandoning UNKNOWN/confirmed operations. No claim of real staff delivery. | NOT RUN |
| A11 — STOP | Send `STOP` with reminder head unknown, then request ordinary booking | Scoped durable reminder revoke, accepted acknowledgement outside human mode; existing appointments unchanged. Customer-initiated booking remains allowed. No consent question/promised proactive reminder in P0 off mode. | NOT RUN |
| A12 — G06 | Prepare a booking/message, suspend salon before final admission, try processing; restore an earlier snapshot | Suspension blocks calendar mutation and automated messages. Restore SUSPENDED/dispatch false/new epoch; no old grant/work revival, no replay. F13 post-gate freeze remains a disclosed local counterexample, not a physical cutoff pass. | NOT RUN |

First owner-ready demo is A01–A04 with durable evidence. L3/L4 then add A05–A14.
This is staged visibility, not full P0 acceptance after four cases.

## Bernard cross-business demonstration

**A13 (NOT RUN):** keep Juanita's existing fixture bookings, switch to Bernard with
the same synthetic sender, and repeat A01/A05/A06/A11. The overview shows only
Bernard's own bookings; new calendar effects target only Bernard's explicit
calendar/default resource. A copied Juanita action is denied. STOP at Juanita does
not revoke Bernard's reminder head. Suspend Juanita: Bernard's independently
admitted fake work remains usable. A signed mixed-salon fixture containing Juanita
STOP plus a failing Bernard partition must retain Juanita's revoke and withhold
ACK until every partition is durable. Record both scopes and zero cross-tenant calls.

**A14 (NOT RUN):** on the owner's Windows laptop, run the start/stop/restart/
backup/inert-restore/reset lifecycle in [the Windows contract](14-WINDOWS-LOCAL-RUNTIME-AND-ACCEPTANCE.md).
Retain both salon identities, original confirmed/UNKNOWN operations and held ranges
through restart. Reset affects only an explicitly selected disposable test instance;
accepted v0.8.1 installation/data remain untouched.

## Subsequent functionality: separate acceptance increments

| Later local walkthrough | Expected contract | Gate / current result |
|---|---|---|
| Reminder parity and explicit consent | Off/preview has no proactive sends or attendance writes. Fake scheduled ticks test all four offsets/late limits/parent receipt/STOP races. Commercial unknown-only opt-in comes after verified booking and silence preserves booking. | LA1, CP4; NOT RUN; real templates/eligibility unverified |
| Solo to team / catalog | Owner edits services with shared duration/buffer; solo default resource retained. Enabling optional staff adds qualifications/hours without losing existing appointments or forcing team setup in solo mode. | LA2, J.O03/C06/C11; NOT RUN |
| Absence / closure | Fresh resource/business blocks remove affected times, preserve unrelated staff availability and original uncertain protections; no automatic cancellation or silent reassignment. | LA2, J.O14; NOT RUN |
| Owner operations / Needs Attention | Only actionable uncertain/disconnected/identity/deletion cases appear, with scoped audit and safe read-only resolution. Ordinary no-phone manual events remain blockers without unwanted contact. | LA3, J.O04–09/O11/A01–03; NOT RUN |
| Staff access | Restricted own schedule/explicit booking permission, secure invite/revoke, retained default identity; foreign tenant/customer data denied. | LA3, J.S01–03; NOT RUN |
| Setup UX | Owner sees explicit synthetic channel/calendar/config state, validates hours and errors without editing secrets; real-account connection visibly unavailable until separately authorized. | LA3, J.O01/O03; NOT RUN |
| One service per appointment | Each service remains a separate booking in P0 and later service/catalog/staff increments under decision 147; multi-service appointments are not planned. | Owner confirmed 2026-11-03; implementation acceptance NOT RUN |

The complete 37-scenario matrix still tracks import, waitlist, locations, billing,
privacy/export/reporting and other approved work. These do not become implemented
by being named in this checklist; each required local increment needs its own
reviewed delivery/evidence. Real-provider cases must stay LIVE UNVERIFIED.

## Acceptance and defects

For every case store candidate SHA, scenario/P0 requirement IDs, input/clock/config
hash, expected and actual text/effects, raw-log path, pass/fail/NOT RUN, independent
review reference and owner result. A difference becomes a GitHub defect with a
minimal replay, preserved original state and a correction/retest link. Never “fix”
a failure by resetting an interrupted case, editing the golden copy or silently
normalizing an added screen/effect.

Local acceptance requires all cases in the agreed milestone scope passing on the
actual owner device, relevant review findings closed/disposed, and remaining
provider-specific limits plainly recorded. This checklist records no owner approval,
production readiness, merge, live send or cutover authorization.
