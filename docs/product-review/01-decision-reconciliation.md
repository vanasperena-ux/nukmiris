# NukMiris — Product decision reconciliation register (draft)
**Date:** 2026-10-30  
**Status:** Draft for owner validation. Requirements only; no product implementation or deployment authorized.  
**Inputs:** Owner interview Decisions 1–178, clarifications through October 30, 2026; v0.8.1 README / existing architecture-challenge Decision 09. The interview is the authority for later amendments.  
**Limitation:** This document is a consolidated *thematic* register, not a verbatim transcript of every numbered decision. Before engineering signoff, reconcile every individual decision against the original conversation and verify evidence/test mapping.

## Governing precedence and stage boundaries
1. **P0:** greenfield rebuild of accepted v0.8.1 behavior with reliability, isolation and safe recovery foundations. Future-facing infrastructure does not activate new customer UX.
2. **Commercial MVP:** business onboarding, staff/resource scheduling, dashboard, customer imports, consent, multi-location, billing, administration, reporting, and native-chat coexistence as approved below.
3. **External pilot:** only after commercial MVP readiness and explicit go/no-go.
4. **Future:** AI support agent (deferred explicitly), richer CRM, marketing enhancements.
5. Later explicit owner revisions override earlier choices; do not reinterpret decisions through technical convenience.
6. Every feature requires requirement → scenario → acceptance test → implementation evidence → independent review linkage.

## Accepted decisions by capability (decision references)
| Capability | Relevant decisions | Current effective requirement | Stage |
|---|---|---|---|
| Architecture / reviews | 1, 3–18, 94–115 | Greenfield parity first; durable ingress/egress, no blind retries, consent locking, auditable changes, tested recovery, tenant isolation, staged owner approvals, independent Claude challenge | P0 |
| Employee resources | 2, 21–29, 57, 134–139, 142–146 | Default one employee at P0; commercial qualified employees with working hours in NukMiris, exception blocks in Google, random allocation if no preference, employee preference inferred from last **completed** same-service booking; customer approval for reassignment | MVP |
| Single service booking | 30 **revised by 147**, 133, 139 | Exactly one service per appointment; shared per-service duration/buffer across employees, no individual extension (170) | MVP |
| Slot UX | 31–32, 63–64, 136–141 | Preserve v0.8.1 two-options-and-more behavior; adjustable interval, booking horizon and new-booking notice; reschedule/cancel allowed until start, subject to availability | P0 parity + MVP rules |
| WhatsApp menu and human support | 41–46, 127, 140, 148–150, 158 | Preserve known booking/reschedule/cancel menu paths; `permisos` added; normal chat should coexist and be handed off, not consumed indiscriminately; future AI support postponed | P0 parity + MVP coexistence |
| Reminder and consent | 19–20, 36–38, 75–77, 100, 155–161 | Business controls 1w/1d+follow-up/2h; customer explicit per-business reminder permissions, `permisos` command; no messages to unconsented customers; reactivation only on express acceptance; existing upcoming appointments receive still-eligible reminders | P0 foundation + MVP |
| Manual booking | 20, 53–54, 91–93, 151–157, 163, 172–174, 177 | Owner/staff can create/change/cancel through Google Calendar or NukMiris calendar; dashboard bookings require WhatsApp number; Google events without phone remain unmanaged availability blockers; intentional manual overlaps allowed | MVP |
| Calendar deletion | **92**, **175 withdrawn** | Deleted managed Google event stays protected until owner confirms cancel or restore; don't infer cancellation from unavailable API or missing event | MVP |
| Manual overlaps | **27/90 revised by 172/176** | Google manual overlaps accepted without conflict incident; dashboard authorized bookers warned/confirm; customer WhatsApp bookings remain conflict-free. True sync uncertainty still quarantined | MVP |
| Staff access | 55–57, 128–132, 176 | Owner/Manager/Receptionist/Employee; booking permission controls manual overrides; Google calendar access plus restricted app views for employees; secure invitations/auth | MVP |
| Business and locations | 58–60, 131, 133–138 | One business may have locations, calendars, staff, services, working-hours configuration; business-wide closure/holidays through Google Calendar | MVP |
| Customer booking policies | 61–74 | Self-book only; no deposits, recurring automation, automatic no-show penalties; multiple future appointments subject to limit; no customer overlap; optional waiting list with explicit accepted offers | MVP |
| Customer lifecycle | 162–166, 177–178 | Basic customer profiles only (name/WhatsApp/permission/upcoming appointments), search name/number; exact normalized phone matching in business; no internal notes; verified number-change via customer-initiated chat + staff identity check and approval | MVP |
| Customer import | **178 refined, owner agreed** | Onboarding scan: 3/6/12 months lookback (6 default) plus upcoming; parse name/phone patterns; preview/review ambiguous identity; imported customer reminder permission unknown absent proof; first eligible inbound chat introduces automation and offers opt-in once without blocking explicit commands | MVP |
| Daily operation | 151–154, 167–171 | Combined staff calendar + mobile daily view, status filters; desktop drag/drop, mobile editing; staff mark No-show from quick action; auto-complete at end; no individual duration extension; service correction with notification where authorized | MVP |
| Change notifications | 91, 171, 173–174 | Verified consequential service/time/date changes notify authorized customer; Google changes briefly coalesced (~60s candidate); employee reassignment requires customer acceptance | MVP |
| Reporting / review | 34–35, 75–81, 117–119 | Operational metrics, exports, satisfaction/review capability, explicit pilot metrics, tenant/customer privacy and deletion | MVP |
| Pricing / subscription | 47–52, 82 | Monthly allowance+overage, spend cap, trial 30 days without card, grace 7 days, controlled suspension and exit/export | MVP |
| Support / administration | 83–89, 120–129 | Human support inbox, KB, detailed internal operations dashboard, audited admin access with MFA; no AI support questions now | MVP |
| Safety operations | 85–110 | Failed connections pause affected automation; explicit incident alerts; safe restore/reconciliation and rollout gates | P0 + MVP |

## Superseded, withdrawn or narrowed decisions
| Reference | Outcome |
|---|---|
| 30 → 147 | Multiple services in one appointment **withdrawn**. Each service is a separate booking. |
| 27/90 → 172/176 | Intentional manual calendar conflicts are allowed; do not auto-create a double-booking incident simply for an authorized overlap. Other uncertain changes still protected. |
| 92 vs 175 | **175 withdrawn**. 92 remains authoritative for deletions of managed Google Calendar events. |
| 139 | Employee-specific service-duration overrides not included; standard per-service duration/buffer. |
| 142–146 | Employee choice behavior refined for first versus returning customers, including departure/unqualified employee fallback. |
| 151 | Both NukMiris dashboard and Google Calendar are accepted for staff booking/editing/cancellation. |
| 166 | No appointment notes or permanent customer notes in commercial MVP. |
| 170 | No individual appointment end-time extension in NukMiris. |
| 177 | Google Calendar event without phone is valid blocker/unmanaged; **dashboard** manual appointment requires number. |
| 178 | Original bulk CSV/Excel import question shifted to approved **Google Calendar history import + first-contact onboarding**. Spreadsheet import remains undecided/deferred; do not assume enabled. |

## Outstanding evidence / do not silently assume
- Exact Meta WhatsApp Business App / Cloud API coexistence eligibility and inbound echo behavior for each onboarded business.
- Historical chat contents do **not** automatically prove valid reminder opt-in. Evidence of consent and business scope must be verified.
- The introductory WhatsApp greeting is not a blanket permission to take over ordinary human conversations; route real user commands immediately.
- The imported profile's phone match is a candidate until source and customer relationship are confirmed. Do not personalize ambiguous identities.
- Distinguish `appointment exists`, `customer confirmed attendance`, `automatically completed`, and `No-show`; no unverified actual attendance claim.
- Permission to send appointment updates is distinct from permission to send reminders; no unconsented proactive permission-solicitation template.
- Need exact payment-provider, launch-country tax/payment methods, onboarding milestones, and quantified launch acceptance targets.
- Manual overrides must retain accurate availability protection for later customer bookings.
- Baseline v0.8.1 feature behavior should be compared against actual UX checkpoint and tests, not inferred solely from this register.

## Review workflow
Owner marks each journey Approved / Change requested / Not applicable; Codex traces to requirements and tests; Claude verifies conflict resolution and implementation evidence. The register itself is **not** approval to change baseline code.
