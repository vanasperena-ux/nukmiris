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
| G06 Payment suspension and already-booked reminders | **Customer-facing product policy** | **Yes, targeted owner choice** | Decide behavior after 7-day grace/overage cap for existing bookings and reminders; keep calendar data safe |
| G07 Feedback attendance and Meta survey message | Provider/semantics | No | Test template classifications and consent scope, preserve customer self-report and unverified auto-completion |
| G08 Ordinary human chat coexistence | Provider feasibility | No | Live eligible-number routing and no-hijacking tests |
| G09 Quantified release gates | Release quality thresholds | Eventually | Codex propose metrics and demonstrable tests; owner confirms go/no-go only with evidence |
| G10 178-decision traceability | Requirements completeness | No | Codex complete 178-row decision trace, supersessions, test IDs, Claude check |

## Step 2B-01 — Payment suspension policy (G06)
**Already approved:** 30-day no-card trial, monthly subscription with included usage + overage, spending cap, 7-day payment grace, service suspension afterward, safe export/exit. The approved scenario does **not** determine whether previously scheduled customer reminders continue *after* suspension.

**Safeguards independent of the option:** Existing appointments and Google Calendar entries are not deleted; no customer consent is inferred or restored; billing/service recovery is auditable; spending caps remain enforceable; reopening service cannot blindly resend reminders that have passed or have uncertain send status.

**Options for owner review** (not yet approved):
- **A — Full automation pause (recommended safety/cost default):** Following actual suspension, stop new automated bookings, proactive notifications and reminders, while preserving calendars, bookings and account export/read access. On successful reactivation, resume only still-eligible future operations, without catch-up sends.
- **B — Limited critical-reminder continuation:** Following suspension, stop new bookings but keep previously authorized reminders for existing appointments within a hard provider-cost limit. Requires allowance/cap and priority rules; service is only partially suspended.
- **C — Alternative owner-defined behavior** requiring precise billing and customer communication rules.

**Grace-period distinction:** This question concerns behavior **after** the approved grace period ends. Any preference about restricting use **during** the 7-day grace window should be specified separately if material.

**Provisional recommendation:** Option A is simple and prevents post-suspension expenses; notify the owner clearly before suspension that customers will cease receiving automated reminders. Do not represent this as owner-approved until confirmed.

## Unresolved provider evidence vs new owner choices
Technical claims such as Meta App/Cloud coexistence and approved survey templates must be verified against provider documentation or live testing at implementation; the review does not establish feasibility or invent rules. When necessary return proof and concrete alternative implementation to owner, not speculative requirements.

## Next phase
When policy gap G06 is resolved, record its choice without altering other approvals. Codex/Claude should investigate engineering gaps in parallel during roadmap preparation, with explicit blockers and test evidence at each stage.
