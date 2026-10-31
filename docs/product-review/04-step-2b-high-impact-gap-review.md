# NukMiris — Step 2B High-Impact Gap Review
**Started:** 2026-10-31  
**Precondition:** Step 2A closed at **37/37 approved** (see [closure report](03-step-2a-closure-and-critical-gaps.md)).  
**Status:** IN REVIEW. Design verification only. **No application changes or launch authorization.**

## Review principle
Treat the approved persona journeys as binding product decisions. Ask the owner only for genuinely unresolved **product policy** with material consequences; assign technical feasibility, provider compliance, parsing and failure-mode testing to Codex, then independently challenge evidence with Claude. No gratuitous restart of 178-decision interviews.

## Triage and next owner gates
| Gap | Type | Owner decision needed now? | Next action |
|---|---|---|---|
| G01 C01 | Closed | No | Owner signed off revised C01 2026-10-31 |
| G02 Google manual/copy event association | Engineering design + validation | **No**, until evidenced alternatives require behavior change | Codex: propose deterministic parse/mapping conventions, confidence criteria, copied-event handling, customer validation, unmanaged fallback and correction UX preserving Google-first experience |
| G03 Consent, approved templates, business app coexistence | Provider and legal evidence | **No** until capabilities conflict with approved workflows | Codex: collect Meta policy / onboarding & template evidence and define permission-scope matrix; Claude independent review |
| G04 Durability and uncertain outcomes | Architecture safety tests | No | Codex: error/retry/event version scenarios, transaction/idempotency design and negative testing; Claude review |
| G05 Solo/team resource mapping | Engineering model | No | Codex: calendar mapping, stable employee/resource IDs, solo→team transition test plan |
| G06 Payment suspension and already-booked reminders | **Resolved — Option A approved 2026-10-31** | **No** | Pause booking automation, proactive notifications and reminders after suspension; preserve existing data, do not replay missed sends; implement and test suspension/recovery gate |
| G07 Feedback attendance and Meta survey message | Provider/semantics | No | Test template classifications and consent scope, preserve customer self-report and unverified auto-completion |
| G08 Ordinary human chat coexistence | Provider feasibility | No | Live eligible-number routing and no-hijacking tests |
| G09 Quantified release gates | Release quality thresholds | Eventually | Codex propose metrics and demonstrable tests; owner confirms go/no-go only with evidence |
| G10 178-decision traceability | Requirements completeness | No | Codex complete 178-row decision trace, supersessions, test IDs, Claude check |

## Step 2B-01 — Payment suspension policy (G06)
**Already approved:** 30-day no-card trial, monthly subscription with included usage + overage, spending cap, 7-day payment grace, service suspension afterward, safe export/exit. The approved scenario does **not** determine whether previously scheduled customer reminders continue *after* suspension.

**Safeguards independent of the option:** Existing appointments and Google Calendar entries are not deleted; no customer consent is inferred or restored; billing/service recovery is auditable; spending caps remain enforceable; reopening service cannot blindly resend reminders that have passed or have uncertain send status.

**Historical alternatives reviewed; superseded by explicit Option A approval on 2026-10-31:**
- **A — Full automation pause (recommended safety/cost default):** Following actual suspension, stop new automated bookings, proactive notifications and reminders, while preserving calendars, bookings and account export/read access. On successful reactivation, resume only still-eligible future operations, without catch-up sends.
- **B — Limited critical-reminder continuation:** Following suspension, stop new bookings but keep previously authorized reminders for existing appointments within a hard provider-cost limit. Requires allowance/cap and priority rules; service is only partially suspended.
- **C — Alternative owner-defined behavior** requiring precise billing and customer communication rules.

**Grace-period distinction:** This question concerns behavior **after** the approved grace period ends. Any preference about restricting use **during** the 7-day grace window should be specified separately if material.

**Owner decision (2026-10-31): OPTION A APPROVED.** When subscription becomes suspended after the agreed grace period, pause all NukMiris automation: no new automated bookings, no proactive customer notifications and no scheduled reminders. Preserve all existing appointments, original Google Calendar events, customer records, consent, history and permitted account read/export access. On verified reactivation, resume only still-eligible future jobs; no retroactive/catch-up reminders or blind retransmission of uncertain messages. Warn owner before suspension that reminders and automated appointment handling will stop. Existing data are not erased and consent is not reset. **Implementation should enforce the policy at actual dispatch and booking execution, not just job scheduling, including stale queued jobs, webhook races and tenant scope.**

## Unresolved provider evidence vs new owner choices
Technical claims such as Meta App/Cloud coexistence and approved survey templates must be verified against provider documentation or live testing at implementation; the review does not establish feasibility or invent rules. When necessary return proof and concrete alternative implementation to owner, not speculative requirements.

## Next phase
**G06 closed by owner selection on 2026-10-31.** Remaining G02–G05 and G07–G10 are engineering, provider-evidence, quality-gate or traceability work; do not reopen product choices without a concrete discovered conflict. Codex should produce verifiable design/test evidence and Claude independently review. Owner authorization for merge, implementation and pilot is separate.

## Decision log — Step 2B G06 (2026-10-31)
| Gap | Owner approval | Binding product acceptance |
|---|---|---|
| G06 | **Approved Option A — Full automation pause** | After actual suspension, no automated customer bookings, notifications or reminders; keep all existing bookings, calendars and data; warn owner in advance; verified restoration only, future eligible actions only; **never** send catch-up reminders or automatically resend uncertain sends. |

### Technical acceptance checks to demonstrate (not additional policy questions)
- Delayed queued messages due after suspension are blocked at dispatch; no outbound send, including race/retry and stale worker scenarios.
- Inbound booking requests during suspension do not create/modify Google Calendar appointments through NukMiris; avoid falsely promising booked results. Ordinary WhatsApp human communications are not taken over or automatically blocked by NukMiris.
- Owner warnings issued while account is still active and appropriately authorized; subscription status and timing are consistent and auditable.
- After payment recovery, scheduler considers only reminders whose legitimate send time remains in the future and meets all consent, appointment status, template and business controls; no replay of expired or uncertain sends.
- Google Calendar entries, customer identities and export rights survive suspension; tenant isolation and role access still enforced.
- Spending caps and approved 7-day grace rules are upheld. The exact provider/billing implementation must be proven during engineering review.
