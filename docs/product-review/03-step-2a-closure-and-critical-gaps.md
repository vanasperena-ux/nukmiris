# NukMiris — Step 2A Persona Journey Closure and Critical-Gap Register
**Prepared:** 2026-10-31  
**Status:** STEP 2A CLOSED — all 37 persona scenarios owner-approved (2026-10-31). Does not authorize implementation or pilot.  
**Source of truth:** [Scenario inventory and review log](02-persona-journeys-and-capabilities.md), [thematic decision reconciliation](01-decision-reconciliation.md), v0.8.1 baseline in main, owner approvals through 2026-10-31.

## Scenario inventory audit
| Persona | Scenario IDs | Approved | Pending |
|---|---|---:|---:|
| Customer | C01–C12 | 12 | 0 |
| Business owner | O01–O16 | 16 | 0 |
| Staff | S01–S03 | 3 | 0 |
| Platform administrator | A01–A03 | 3 | 0 |
| Commercial | B01–B02 | 2 | 0 |
| Pilot | P01 | 1 | 0 |
| **Total** | **37 unique IDs** | **37** | **0** |

**Approved IDs:** C01–C12; O01–O16; S01–S03; A01–A03; B01–B02; P01.  
**C01 final owner signoff:** 2026-10-31, confirming these amended steps:
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
| G01 | C01 signoff | **Resolved 2026-10-31** — revised C01 approved | Closed; retain signed scenario and acceptance-test trace |
| G02 | Google Calendar manual event association | Google Calendar-first copied event may contain stale phone/service/employee; ambiguous customer identity and service duration; uncertain whether safe event-to-managed promotion can be automatic | Require precise parse contract, confidence rules, copy-detection tests, onboarding correction UX and safe fallback to unmanaged |
| G03 | Consent and Meta templates | In-person evidence method vs reminder permission, message types for manual booking, imported introductions and post-visit feedback; Meta template classification/approval and business number coexistence | Verify WhatsApp Business coexistence eligibility and exact opt-in scope; confirm templates/categories or provide no-send fallback |
| G04 | Calendar/WhatsApp reliability | Lost webhook, ambiguous send result, duplicate copied calendar event, stale dispatcher, failure during reschedule/deletion, tenant isolation | Codex implement verifiable durability/reconciliation/idempotence and independent Claude failure-mode challenge |
| G05 | Staff/resource mapping | Solo-to-team migration and one-business-calendar/multiple-employees semantics; busy block and closure routing | Define internal resource IDs and safe Google event/resource mapping; run concurrency and migration tests |
| G06 | Commercial suspension and exit | **Policy resolved 2026-10-31:** Option A, pause all automation on suspension, preserve bookings, no retroactive sends | Implementation verification remains: billing provider, owner warning, dispatcher gate, data export/retention and safe recovery |
| G07 | Customer feedback legality/measurement | “Automatically Completed” is not verified attendance; customer response only self-reported evidence; proactive survey may require different message permission/template | Preserve explicit attendance provenance; suppress survey unless authorized and approved by provider |
| G08 | Native human chat and onboarding | C10 and C09 require inbound message routing that does not interrupt normal WhatsApp Business human conversation | End-to-end coexistence tests with live eligible number; commands win, imported intro only when flagged |
| G09 | Objective release gates | No numeric acceptance thresholds nor signed pilot go/no-go evidence in scenario approval alone | Agree small objective P0/MVP reliability/security/UX gates, track results, Claude review, then explicit owner launch authorization |
| G10 | Source-level traceability | Decision register is thematic, not line-by-line verified all 178 original numbered choices; some legacy detailed examples are superseded by newer owner approvals | Codex compile exhaustive decision→scenario→acceptance-test matrix, log supersessions and evidence; Claude independently verify |

**Priority interpretation:** G01 is closed and is no longer a product-owner signoff blocker. G02/G03/G04/G05/G08 are important design/feasibility/engineering blockers. G06/G07/G09/G10 are commercial/release-readiness verification areas. Do not pretend these are all new product-choice questions.

## Recommended next actions
1. **Completed:** C01 approved, inventory updated, and Step 2A formally closed at **37/37**.
2. In **Step 2B**, only raise decisions that materially alter approved product behavior; otherwise direct Codex to investigate and propose verified solutions, with Claude independent review.
3. After Step 2B, prepare the staged P0 parity→commercial MVP→pilot roadmap, with requirements/test/traceability and owner gates.
4. Keep Draft PR #2 unmerged until review artifacts are ready and owner explicitly authorizes merge.

## Final owner closeout — 2026-10-31
**C01 explicitly approved** as described above. **37/37 scenarios approved; zero pending. Step 2A is CLOSED.** G01 is resolved; G02–G10 remain tracked as technical, compliance, commercial or verification gaps for Step 2B and subsequent engineering review. Approval does not imply implemented behavior or launch authorization.

## Step 2B policy disposition — G06 (2026-10-31)
Owner approved **Option A**: after actual service suspension, pause new automated bookings, proactive customer messaging and all reminders; preserve existing appointments and original Google Calendar records; resume only still-eligible future operations on verified reactivation, with no catch-up sends. Product decision closed; implementation and provider evidence remain pending in [Step 2B review](04-step-2b-high-impact-gap-review.md).
