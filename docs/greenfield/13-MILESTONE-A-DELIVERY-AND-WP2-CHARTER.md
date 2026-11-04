# Issue #7 — Milestone A status and proposed bounded WP2 local slice

2026-11-03, America/Mexico_City. Owner direction: [Issue #7](https://github.com/vanasperena-ux/nukmiris/issues/7).
**Deliver and accept vNext locally before GCP work.** This is a proposed charter
and delivery record, not a completed application or an independent review.

## Current WP1 position after Claude's conditions review

[Independent review](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6619904951):
**GO WITH CONDITIONS C1–C4**, on source `857bb825ac01ca67f303adbe71ef486c276c8923`.
Claude executed PG16.15/Node22 SQL probes and a canonical differential, but could not
run the Node24/PG17.11 full/fault suites. Those limits remain explicit.

| Item | Exact current evidence | Status |
|---|---|---|
| Accepted v0.8.1 | `95decc812c228f25171ecfe647200447c83e2e45` | Preserved; parity oracle; no working data/secrets touched |
| Product scope | `1f4682ccba02fe5d89ce9d671c0114d6f9a0d6e1`; 37 journeys and owner-confirmed one service per appointment | Binding; P0 stays separate from commercial increments |
| C1/C4 follow-up source | `991ca8141ffef3471a955c450e9f789dd8aef1a7` | Codex full 98/98, fault 88/88, Node24.19/PG17.11; not independently accepted yet |
| PR #4 evidence/docs head | `84ff73d36cc6defc493a30a4f07445e4818ce1c8` | Draft; tested source unchanged by evidence commit |
| Independent C1 re-verification | [Exact-commit request](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6620401835) | **PENDING; CP1/initial CP2 OPEN until formal closure** |
| C2/C3 | [Preserved gates and NEW-2/NEW-3 requirements](https://github.com/vanasperena-ux/nukmiris/blob/991ca8141ffef3471a955c450e9f789dd8aef1a7/docs/greenfield/16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md) | Design recorded; no WP2 code implemented |
| Windows app / owner acceptance | [Runtime contract](14-WINDOWS-LOCAL-RUNTIME-AND-ACCEPTANCE.md) | NOT RUN; no complete local app yet |
| GCP ADR PR #6 | Documentation/review only | Deferred; no provisioning or costs |

Claude accepted the earlier 17 dispositions with documented limits and NEW-1–4.
The new C1 output guard/index/preflight and C4 recovery-case protection are locally
verified, not independently accepted. See [follow-up report](https://github.com/vanasperena-ux/nukmiris/blob/84ff73d36cc6defc493a30a4f07445e4818ce1c8/docs/greenfield/reviews/04-CODEX-WP1-C1-C4-REMEDIATION.md).
001/013/016 remain disabled; 009/011/017 and OPS01 remain required. A migration/table
owner can change lifecycle state and disable its triggers without superuser;
append-only payload DML protection is not protection from owner compromise.

No Claude tool/CLI is available here; the completed review occurred independently
outside this session. A posted re-verification request is not a completed review.
Compressed SQL/state evidence remains unpublished under the prior restriction;
readable logs, hashes, schema metadata and case summaries are public. No archive
upload authority is inferred from this milestone.

## Immediate WP1 closure task

1. Independently verify C1 on `991ca81` using [handoff 05](https://github.com/vanasperena-ux/nukmiris/blob/84ff73d36cc6defc493a30a4f07445e4818ce1c8/docs/greenfield/reviews/05-CLAUDE-WP1-C1-REVERIFICATION-HANDOFF.md):
   corrected A4 plus malformed/colliding IDs/purposes, actual output-constraint
   preflight, real unique-index contention and unchanged idempotent replay.
2. Record actual environment/results/limits and an explicit C1 accepted/rejected
   disposition. Verify C4 owner/payload boundary and C2/C3 carried requirements.
3. Require a formal CP1/initial CP2 closure statement for the bounded synthetic
   scope before any WP2 code. No unaddressed critical/high correctness issue may
   cross that entry gate; preserve all remaining provider/custody/repair gates.
4. Publish the independent decision in PR #4 and Issue #7. Keep drafts unmerged.

**Current stop:** C1 independent verification and formal WP1 closure are pending.
The first task after acceptance is L0a's indexed authenticated fixture-archive
lookup/capacity/repair proof under 017, then L0b sealed input classification and
head-aware reservation priority. No such implementation has begun.

## Proposed WP2-L charter: first locally usable parity path

WP2-L is a local delivery slice spanning the calendar/domain portion of original
WP2 and the minimum conversation/UI portion of original WP3. It does not silently
rename those full packages complete. Issue #7 sets the local direction; implementation
entry remains conditional on WP1 closure and a recorded review of this bounded scope.

**Outcome:** the owner opens a localhost simulator on Windows, selects Juanita or
Bernard, and completes known/new-customer booking, move and cancel through the
accepted Spanish WhatsApp conversation. A durable fake calendar and fake message
ledger show what occurred. No real WhatsApp or Google connection is required.
The screen is permanently labelled **Synthetic local demo — no messages sent**.

**Bound:** default resource per business; configurable existing P0 duration/buffer/
hours; one implicit booking service; customer-specific upcoming appointments;
current Menu/human/STOP priorities; exact current booking/date/name/management
copy and action semantics. No service picker, employee picker or extra confirmation
click in P0. New customer chooses a slot, then supplies a valid name; known customer
selection executes immediately after fresh checks. Move selection and cancel-target
selection also execute without a new confirmation screen.

| Small PR | Deliverable | Acceptance required before next increment |
|---|---|---|
| L0 — proof and runtime boundary | Resolve the archive-dependent 017 design/capacity gate; define bounded fixture custody/repair limits accepted by reviewer. Portable local TCP PostgreSQL fixture, Windows child lifecycle, fresh local state/secret bootstrap; preserve Linux fault harness. | Explicit finding dispositions, no archive gate silently deferred; Windows socket/signal substitute tests, isolated DB/ports/credentials and inert restore demonstrated |
| L1 — domain and transcript oracle | Event-aware fake calendar port: pagination/completeness, hours/breaks/duration/buffer, 30+15-day search to 365 days, direct date and timezone; frozen accepted transcript fixtures | Failed/partial read never means free; exact two + two + date UX; no live SDK or actual account |
| L2 — first visible booking | Durable conversation/action state, name validation, sealed ordinary message intents, known and new customer booking; minimal loopback browser simulator and fake calendar viewer | Demo cases A01–A04 in [owner scripts](15-MILESTONE-A-OWNER-ACCEPTANCE-SCRIPTS.md); one mutation on selection, no extra screen; scoped receipt/response uncertainty |
| L3 — management and recovery | Owned overview, one/multiple move, selected cancel, stale/foreign actions, persisted original result/status, read-only fake reconciliation and Needs Attention hold view | A05–A09; source event identity retained on move; uncertain work never automatically resubmitted/released; cancel confirmation can safely dispatch |
| L4 — Windows package and independent review | Exact npm.cmd start/stop/reset/backup/smoke scripts, config UI minimum for demo business settings, no-secret templates, failure matrix and independent Claude review | Native Windows owner smoke, isolated restart/backup/inert restore, regression suites and P0 transcript comparisons, review findings disposed; no cloud result substitutes for PC result |

First demonstration target: **L2**, after L0/L1 gates, not after every commercial
feature. Planning estimate: L0/L1 **1–2 engineer-weeks**, first visible booking
**1–2 additional weeks**, management/Windows/review **2–4 additional weeks**;
**4–8 engineer-weeks total** with overlap, low confidence. Independent review,
owner-device availability and corrections add elapsed time. These are effort
ranges, not an agreed budget or launch date; re-estimate after L0/L1 evidence.

### Mandatory NEW-2/NEW-3 requirements before booking implementation

The submission barrier alone cannot establish reservation priority. A later input
must not reserve the earlier customer's slot: under conversation locking, hold
later preparation with zero reservations until the earliest unresolved ordinary
command is eligible. Normal progress cannot require operator HOLD of the first
request. UNKNOWN protections remain held; no timeout-release or retry is introduced.

Admission produces one sealed, versioned classification of withdrawal/receipt/
ordinary input, bound to original event digest and scoped identity. SQL reads that
classification rather than lower(trim(body)); accents/NFD/punctuation must agree
with the canonical TS normalizer. Context-dependent name/date/intent handling stays
in the reducer. Ordinary text/navigation/human handoff receives a durable terminal
reduction when appropriate and must not poison the mutation head. Menu/status paths
cannot silently resolve uncertainty or permit a resend.

W2-RP01–04 and W2-CL01–04 in [requirements 16](https://github.com/vanasperena-ux/nukmiris/blob/991ca8141ffef3471a955c450e9f789dd8aef1a7/docs/greenfield/16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md)
are required acceptance tests, currently NOT RUN. This is design, not WP2 code.

### Architecture obligations before adding conversation effects

The WP1 core is deliberately narrower than a usable app. Address these explicitly:

- `prepare_operation` currently accepts only `synthetic fixed command` and uses
  fixture identities. Add a reviewed deterministic reducer and sealed intents,
  not an unrestricted text-to-calendar escape hatch.
- Current output rows require an appointment/parent operation; browsing/name/Menu
  prompts often have neither. Add a typed, scoped navigation-output context with
  independent immutable plan/ordering/deadline validation. Do not invent dummy
  appointments or send prompts outside the sole dispatcher.
- Current final output gate requires ACTIVE appointment and before-start timing.
  A verified cancellation sets CANCELLED. Define operation-specific confirmation
  authorization so cancellation receipts work while reminders still require ACTIVE
  current schedule. Keep subscription, identity, consent-purpose and expiry checks.
- Preserve database-authoritative final time checks, exact canonical payload/seal
  binding and every NULL regression when adding real conversation payload shapes.
- Keep original attempt IDs/owners on unknown outcomes, including ordinary prompts.
  Fake provider read-only proof can resolve; elapsed time is not proof of no effect.
- Keep tenant-scoped identities and action capabilities. A browser-selected salon
  is a simulator context, never production authentication. No cross-tenant fallback.
- Allow loopback HTTP/config/filesystem only in a reviewed local composition boundary;
  preserve source confinement for domain/reducer/dispatch code. No real provider SDK
  or production credential fallback. Reject attempts to enable live mode.
- CR-017 requires proof before archive-dependent expansion, not a promise to fix
  performance after the demo. Ordinary authenticated keyed reads, append/checkpoint
  verification, crash repair/capacity tests must preserve the fail-closed contract.

### WP2-L required acceptance matrix (all candidate cases NOT RUN)

| Cases | Observable result | Requirement source |
|---|---|---|
| A01–A04 | Known/new name-after-slot, two-more/date navigation; correct copy and exact single create; no premature success | V081.W03/W07/W08/W09/C01–05; P-W03/P-W07/P-W08/P-C04; J.C01 P0 portion |
| A05–A06 | Own chronological overview, direct one-event move/multiple target choice, same event moved, selected target canceled once | V081.W04/C06–09; J.C02/C03/C04 P0 portions |
| A07 | Stale/foreign/duplicate choice denied or replays original result, zero extra invocation | V081.I01–03; WP1 F11/F14/F17 |
| A08–A09 | Unknown holds and restart preserve identity/protection; lookup outage is not empty/free | V081.C03/I04 onward; WP1 F16–29 |
| A10–A12 | Menu/human/STOP priority, consent separation and G06 suspension; no real/proactive sends | V081.W05/R09/R11; DB07/DB08; J.C10/B01 safety portions |
| A13 | Same synthetic sender at two salons sees only that salon's appointments, actions and permission | V081.W02/I01, SEC03 |
| A14 | Windows install/start/stop/restart/backup/restore/reset only candidate resources | V081.S01 and owner-device smoke; REC01 local subset |

Freeze baseline inputs/clock/zone/provider responses and full outbound payloads.
Normalize only opaque generated IDs through a consistent scoped mapping and irrelevant
diagnostic timestamps; never normalize extra clicks, wrong recipient/time, missing
appointments or extra provider invocations. Preserve the 49-row P0 matrix and
37-journey matrix; partial local coverage does not close all rows. Provider-only
requirements remain LIVE UNVERIFIED even when fake-path tests pass.

## Remaining local increments after WP2-L

| Increment | Local demonstration | Original scenarios / boundary |
|---|---|---|
| LA1 — reminder parity/consent | Four offsets 168/24/22/2 hours, off/preview/fake modes, attendance replies; then approved explicit consent UI | WP4; J.C07/C08/O12; no-response never cancels; no real template approval inferred |
| LA2 — service/staff/settings | Owner catalog, standard per-service duration/buffer, optional staff qualifications/hours, default-resource migration, absences/closures and customer-approved reassignment | M2; J.O03/O14/C06/C11; no forced setup for solo owner; each substantial PR reviewed |
| LA3 — owner operations/support | Daily scoped view/Needs Attention, supported manual-event association, role-restricted staff/customer workflows, owner setup UX | M3/M5/M6 local portions; J.O04–09/O11/S01–03/A02; fake integrations visibly identified |
| LA4 — local acceptance | All launch-required approved local scenarios, independent review, Juanita/Bernard walkthroughs and defect closure | J.P01; separate full 49-row/37-journey coverage record; provider-dependent rows stay unverified |

This table changes delivery order toward local acceptance; it does not approve a
complete commercial scaffold inside P0. Billing/import/reports/location/waitlist
and other approved scenarios remain mapped in [the existing 37-journey matrix](02-REQUIREMENTS-TRACEABILITY.md).
Owner local acceptance must identify which are required before Milestone A is called
complete; they cannot disappear from scope because they are absent from the first demo.

**Owner clarification — resolved (2026-11-03):** “Preserve one service per
appointment.” Issue #7's multi-service wording does not amend approved decision
**30→147**. Each service remains a separate booking in P0 **and later service,
catalog and staff increments**. Multi-service appointments are not planned.
[Recorded owner clarification](https://github.com/vanasperena-ux/nukmiris/issues/7#issuecomment-6619615645).
The original [decision register](https://github.com/vanasperena-ux/nukmiris/blob/1f4682ccba02fe5d89ce9d671c0114d6f9a0d6e1/docs/product-review/01-decision-reconciliation.md)
remains binding; no related schema/workflow exception is authorized.

## Live Meta/Google test accounts: separate gate

| Blocker | Concrete evidence required before live use |
|---|---|
| WP1 independent closure | Exact remediated commit independently reviewed; relevant findings accepted/fixed |
| F13/OPS01 + transport | Gateway-only credentials/egress, original-instance fencing, single-use ticket proof, overall transport deadline and all nine OPS01 tests; documented residual remains an owner decision if approved semantics cannot be met |
| Provider contracts | Versioned actual Meta statuses/callback/recipient/wamid correlation; no duplicate/retry SDK behavior; Google event-ID/ETag/read-completeness and uncertainty cases verified |
| Seal/archive/recovery | Independent roles/process credentials and authenticated custody; crash repair, key retention, rollback detection, indexed capacity; inert restore and safe explicit resume |
| Business/account/purpose | Dedicated test WABA/number/calendar and recipient scope; current permissions/templates/service window/TTL; no actual customer data; synthetic configuration is not onboarding evidence |
| Owner-specific authorization | Named accounts/recipients, permitted effects, cleanup and test limit explicitly authorized; Issue #7 does not supply that permission |

GCP deployment/provisioning/costs remain deferred under Issue #7. Local completion
neither proves cloud containment nor authorizes cutover, merge or live sends.

## C2 — verbatim activation prerequisites

001/F13, 013 real transport and 016 real provider/receipt integration stay disabled.
The following 009/011/017 gates and OPS01 nine cases are carried verbatim from
requirements 16 and the prior disposition report. They are requirements, not
authorization to run live tests or to provision GCP.

Mandatory independent OPS01 evidence before any real call:

1. Worker identity has no provider secrets and direct provider egress is denied.
2. Worker frozen beyond ticket expiry, then suspended/thawed: zero provider calls.
3. Replayed/second-worker/consumed ticket: zero additional calls, including lost DB commit response.
4. Suspension at every ticket/recheck/write cut; ≥10,000 recorded randomized runs with provider-observed time versus suspension commit; publish actual lag and stated limits.
5. Gateway frozen after recheck: reproduce the residual or prove abandonment at enforced deadline; never label a late send as a physical cutoff pass.
6. Old-instance network fencing, then thaw: zero provider calls from the old identity.
7. Later authorized sandbox-only credential revocation latency for each provider; publish worst observed refusal lag and uncertainty.
8. DB unreachable at gateway: deny without provider invocation.
9. Stalled upstream: enforce overall budget, record UNKNOWN, retain holds, never retry; receipt/result races preserve facts.


**009:** digest recomputation binds content; anyone authorized as the fixture sealer
can still mint a self-consistent record. The test worker intentionally holds several
fixture role pools. Before production, use separate processes and non-interchangeable
credentials for ingress/sealer/dispatch/result/operator/recovery, authenticate archive
receipts (e.g. signed canonical checkpoint verified by an isolated trusted verifier),
keep signing/MAC keys out of dispatch/worker/DB-client reach, and retain independently
witnessed monotonic heads/keys. A DB-only HMAC with the same process/key custody is
not independence. Attack tests: recompute a forged body digest, replay a valid old
checkpoint, cross tenant/scope, compromise dispatcher credential, and roll back one
custody domain. Each must deny unauthorized registration/effect; document the trusted
administrator boundary. None of these production controls has been run here.

**011:** before selecting a real archive, implement a fenced repair operation:
stop/fence all appenders, retain forensic copies, verify every object/key/version/
chain link against independently trusted custody, classify object-only/head-only/
witness-only cuts, and adopt a longer head only when its committed custody is
proved. A consistent longer local chain alone is insufficient. Record a signed,
append-only repair decision, update heads through the archive's atomic/CAS primitive,
then admit again without reallocating IDs. Broken/missing custody stays held with
an operator report. No age-based append.lock stealing. Kill at every object/head/
witness/lock release cut, repair twice, crash repair itself, replay old custody,
and verify continuation with zero unsealed effects. **NOT RUN; production blocked.**

**017:** before WP2 archive-dependent expansion, select an indexed immutable record
store with keyed reads, authenticated inclusion/checkpoint proofs and monotonic
witnesses. Verify ordinary lookups do not decrypt all prior records, restore catches
missing/rolled-back tails, and keys/old versions remain readable under rotation.
Benchmark increasing histories (1k/10k/100k/1M records), memory and per-admission/
dispatch latency under concurrency, crash and repair; publish distributions and a
capacity policy. Fixture's 100k cap/full scan is not the production design.
