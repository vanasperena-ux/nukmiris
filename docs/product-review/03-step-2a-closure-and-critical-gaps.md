# NukMiris — Step 2A Persona Journey Closure and Critical-Gap Register
**Prepared:** 2026-10-31  
**Status:** PROVISIONAL CLOSURE — one owner review outstanding (C01). Does not authorize implementation or pilot.  
**Source of truth:** [Scenario inventory and review log](02-persona-journeys-and-capabilities.md), [thematic decision reconciliation](01-decision-reconciliation.md), v0.8.1 baseline in main, owner approvals through 2026-10-31.

## Scenario inventory audit
| Persona | Scenario IDs | Approved | Pending |
|---|---|---:|---:|
| Customer | C01–C12 | 11 | 1 (C01) |
| Business owner | O01–O16 | 16 | 0 |
| Staff | S01–S03 | 3 | 0 |
| Platform administrator | A01–A03 | 3 | 0 |
| Commercial | B01–B02 | 2 | 0 |
| Pilot | P01 | 1 | 0 |
| **Total** | **37 unique IDs** | **36** | **1** |

**Approved IDs:** C02–C12; O01–O16; S01–S03; A01–A03; B01–B02; P01.  
**Pending:** C01. The owner's original revision was recorded, implemented in the scenario *draft* and **not yet signed off**. The owner must approve the amended steps below:
1. Existing service-selection and two-slot booking flow preserved. For a **new** customer, ask the customer's name **after** they select the desired date/time, **before final booking confirmation**.
2. On a verified successful booking, deliver the booking confirmation first. Only when business-scoped reminder permission is **unknown**, offer a separate explicit optional opt-in/decline request. Existing granted/declined permission is respected; silence doesn't cancel booking and doesn't authorize reminders.
3. Only verified positive permission can enable eligible future reminders. Failed/uncertain calendar writes and failed/uncertain messages never trigger false success claims or blind retries.

**Approval boundary:** Persona journey acceptance is a product-owner design approval, not proof of code parity, platform feasibility, Meta authorization, privacy compliance, system robustness, billability, or pilot readiness.

## Effective amendments confirmed during Step 2A
| Scenario | Effective requirement |
|---|---|
| C09 | One-time onboarding introduction only for reliably matched **flagged imported customers**, distinct from permission status; explicit customer commands handled immediately and normal human chat not hijacked |
| C12 | Optional, permission-gated, provider-approved post-visit attendance/feedback question; “Sí, quiero calificar” yields customer-reported attendance and a rating opportunity, “No asistí” yields customer-reported nonattendance and review of any inconsistency, silence leaves attendance unverified |
| O03 | Solo-first default, employee management optional, implicit single resource. Team mode enabled without losing existing appointments |
| O04 | Google Calendar **primary** for manual booking/copying/editing; NukMiris dashboard **secondary**. Normalize internally when reliable; copied events, identity and service association must not be silently trusted; original Google event text unchanged by default |
| O12 | Verifiable existing permission, customer-initiated `permisos`, or audited verbal permission recorded by Juanita in NukMiris. Phone number in calendar alone is not consent |
| O08 | Deletion of managed Google event requires protected owner confirmation. Decision 92 controls; 175 remains withdrawn |
| O09 | Google Calendar manual overlaps allowed without auto incident; dashboard warns and allows authorized override; customer WhatsApp bookings stay conflict-free |

## Open high-impact critical gaps — proposed Step 2B validation
A **gap** is a missing design/implementation proof, or a genuine unresolved dependency, *not* a reason to reopen approved persona behavior.

| ID | Area | Concrete risk / unanswered verification | Recommended Step 2B disposition |
|---|---|---|---|
| G01 | C01 signoff | Single remaining unapproved customer journey | Owner approve/revise amended C01; then mark 37/37 |
| G02 | Google Calendar manual event association | Google Calendar-first copied event may contain stale phone/service/employee; ambiguous customer identity and service duration; uncertain whether safe event-to-managed promotion can be automatic | Require precise parse contract, confidence rules, copy-detection tests, onboarding correction UX and safe fallback to unmanaged |
| G03 | Consent and Meta templates | In-person evidence method vs reminder permission, message types for manual booking, imported introductions and post-visit feedback; Meta template classification/approval and business number coexistence | Verify WhatsApp Business coexistence eligibility and exact opt-in scope; confirm templates/categories or provide no-send fallback |
| G04 | Calendar/WhatsApp reliability | Lost webhook, ambiguous send result, duplicate copied calendar event, stale dispatcher, failure during reschedule/deletion, tenant isolation | Codex implement verifiable durability/reconciliation/idempotence and independent Claude failure-mode challenge |
| G05 | Staff/resource mapping | Solo-to-team migration and one-business-calendar/multiple-employees semantics; busy block and closure routing | Define internal resource IDs and safe Google event/resource mapping; run concurrency and migration tests |
| G06 | Commercial suspension and exit | Payment failure, spending cap and service termination must not corrupt bookings, leak data or send unauthorized reminders | Specify explicit suspended-mode behavior, data export/retention and billing-provider evidence |
| G07 | Customer feedback legality/measurement | “Automatically Completed” is not verified attendance; customer response only self-reported evidence; proactive survey may require different message permission/template | Preserve explicit attendance provenance; suppress survey unless authorized and approved by provider |
| G08 | Native human chat and onboarding | C10 and C09 require inbound message routing that does not interrupt normal WhatsApp Business human conversation | End-to-end coexistence tests with live eligible number; commands win, imported intro only when flagged |
| G09 | Objective release gates | No numeric acceptance thresholds nor signed pilot go/no-go evidence in scenario approval alone | Agree small objective P0/MVP reliability/security/UX gates, track results, Claude review, then explicit owner launch authorization |
| G10 | Source-level traceability | Decision register is thematic, not line-by-line verified all 178 original numbered choices; some legacy detailed examples are superseded by newer owner approvals | Codex compile exhaustive decision→scenario→acceptance-test matrix, log supersessions and evidence; Claude independently verify |

**Priority interpretation:** G01 is a product-owner signoff blocker. G02/G03/G04/G05/G08 are important design/feasibility/engineering blockers. G06/G07/G09/G10 are commercial/release-readiness verification areas. Do not pretend these are all new product-choice questions.

## Recommended next actions
1. Obtain explicit owner reapproval of C01. Update the scenario table and review log after confirmation.
2. Confirm Step 2A closure with 37/37 approvals, while retaining the gap register.
3. In **Step 2B**, only raise decisions that materially alter approved product behavior; otherwise direct Codex to investigate and propose verified solutions, with Claude independent review.
4. After Step 2B, prepare the staged P0 parity→commercial MVP→pilot roadmap, with requirements/test/traceability and owner gates.
5. Keep Draft PR #2 unmerged until review artifacts are ready and owner explicitly authorizes merge.
