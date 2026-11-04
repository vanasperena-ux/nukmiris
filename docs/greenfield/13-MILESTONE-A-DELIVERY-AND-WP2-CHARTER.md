# Issue #7 — Milestone A status and proposed bounded WP2 local slice

2026-11-03, America/Mexico_City. Owner direction: [Issue #7](https://github.com/vanasperena-ux/nukmiris/issues/7).
**Deliver and accept vNext locally before GCP work.** This is a proposed charter
and delivery record, not a completed application or an independent review.

## Current verified position

Checked GitHub at **2026-11-04 00:38 UTC / 2026-11-03 18:38 Mexico City**:

| Item | Exact evidence | Status |
|---|---|---|
| Accepted v0.8.1 oracle | `95decc812c228f25171ecfe647200447c83e2e45` | Preserved; no working data/secrets read or changed |
| Approved product source | `1f4682ccba02fe5d89ce9d671c0114d6f9a0d6e1`; 37 approved journeys | Binding; [WP0 parity contract](05-P0-PARITY-CONTRACT-AND-TEST-PLAN.md) separates P0 from commercial additions |
| Original independent Claude WP1 review | [review 01](reviews/01-CLAUDE-WP1-CP1-CP2-REVIEW.md), source `108adb62604b9963bd3468ab8b43c36b69fcef6e` | GO WITH SPECIFIED REVISIONS; Claude SQL reproduction was PG 16.15, not 17.11; Node suites not independently rerun |
| Remediated executable core | `857bb825ac01ca67f303adbe71ef486c276c8923` | Codex verification: 88 full / 78 fault, zero fail/cancel/skip, PG 17.11; not a complete app |
| Current PR #4 head | `1ca19248f0f26b47a7ed8013d79e75d387f508b3` | Draft; docs/evidence commit, identical tested source |
| Independent remediation verification | PR review, conversation and inline-comment lists empty; no later independent WP1 report in branch | **CP1/initial CP2 OPEN**; [Claude request posted](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6619286347) |
| Cloud ADR | PR #6, `83907db61daa929fa91ed9301c75b92eaa5f5436` | Documentation/review only; its Claude review is not WP1 verification; cloud implementation deferred |
| Owner Windows application acceptance | No vNext app start script/UI; current fault harness requires Linux sockets/signals | NOT RUN; [Windows delivery contract](14-WINDOWS-LOCAL-RUNTIME-AND-ACCEPTANCE.md) |

Eleven findings are **Codex-corrected, independently unconfirmed**:
002, 003, 004, 005, 006, 007, 008, 010, 012, 014, 015. Remaining explicit gates:
001 F13/OPS01, 009 independent seal custody/roles, 011 archive repair, 013 transport
budget, 016 real receipt correlation, 017 archive lookup/capacity. See the
[complete dispositions](reviews/02-CODEX-WP1-REMEDIATION-AND-DISPOSITIONS.md).
A finding is not accepted by Claude merely because Codex lists it as corrected.

No callable Claude tool, installed `claude` CLI, configured Anthropic credential
or identified GitHub Claude reviewer account exists in this session. The posted
request names the exact diff and requested evidence; it does **not** invoke Claude.
Do not substitute another Codex run, the GCP ADR review, or an owner milestone
instruction for that independent review.

The compressed SQL/state evidence remains local under the previously recorded
automatic approval restriction. Readable logs, source hashes and all-member
snapshot inventory are public. Reviewers must reproduce unavailable evidence or
receive the specifically authorized bundle; do not claim it was publicly inspected.
This issue does not itself approve publishing the withheld archives.

## Immediate WP1 closure task

1. Claude reviews `e0b470d…857bb82`, using evidence/docs head `1ca1924`, follows
   [the exact handoff](reviews/03-CLAUDE-WP1-REMEDIATION-VERIFICATION-HANDOFF.md),
   and records all 17 dispositions with actual commands/environment and limitations.
2. Require independent results for the seven primary SQL corrections
   002/003/004/006/007/008/012, plus safe abandonment/isolation/restore and any new
   findings. Reproduce on pinned PG 17.11; unavailable executions stay NOT RUN.
3. Record explicit CP1/initial CP2 recommendation and which remaining gates block
   which WP2 components. No unaddressed critical/high correctness finding may cross
   the entry gate; disable the affected capability or correct/re-review it.
4. Record the independently accepted findings and owner-readable decision in
   Issue #7 and PR #4, pinned to the reviewed commit. Keep drafts unmerged.

**Current stop:** the independent remediation verification is absent. Planning,
readiness work and posting the review request are completeable now. Broader WP2
application implementation waits for this gate, as Issue #7 explicitly requires.

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
