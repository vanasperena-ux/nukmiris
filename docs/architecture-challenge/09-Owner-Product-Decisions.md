# 09 — Owner product decisions and open items

**Recorded:** 2026-10-27  
**Status:** Owner-approved product direction for the architecture challenge; **not authorization to change application code or expand v0.8.1 parity scope**.  
**Reference:** Codex 01/07/08 and Claude F-series questions.

## Confirmed owner decisions

| Reference | Decision | Architecture implication |
| --- | --- | --- |
| F-01 — capacity | A business may have multiple employees serving customers concurrently, but **one appointment per employee per time slot**. A one-person business permits one appointment per slot. Juanita's salon could have three employees on one shared Google Calendar. | Model employee/resource identity and schedule capacity explicitly. The earlier proposed Calendar-wide non-overlap exclusion rule is too restrictive for the future multi-employee model. Employee-specific colors/tags and employee name in the event title are desired presentation conventions, pending detailed design. |
| F-04 — Calendar ownership | **One Google Calendar is associated with one NukMiris business**, not shared across independent NukMiris tenants. | Distinguish business Calendar ownership from concurrent employee/resource capacity inside that Calendar. |
| U-EXTERNAL — manual conflicts | **Flag external/manual double-booking conflicts for the owner; never automatically cancel an appointment.** | Detect and surface conflicts, with staff resolution. No automatic cancellation or false promise of exclusivity across external Calendar writers. |
| F-11 — human support, current scope | **Keep current recorded human handoff for the present v0.8.1 parity exercise; improve later.** | Do not silently expand v0.8.1 parity. Future product goal: ordinary owner/customer WhatsApp chat should continue naturally, with appointment scheduling acting as an optional assistant, not taking over all interactions. Evaluate the availability and limitations of WhatsApp Business App + Cloud API coexistence. |
| U-GENERIC — reminder replies | **Accept a generic confirmation only when its appointment can be identified unambiguously.** | An old, possibly delivered reminder must not cause a generic “Sí” to confirm a different or moved appointment. Ask for a specific button/quote when ambiguous. |
| F-05 — uncertain WhatsApp messages | **Architects should propose a customer-safe ordering and uncertainty policy.** | No approval for an arbitrary five-minute timeout that releases later messages. Require explicit failure traces and tradeoffs. |
| F-02 — WhatsApp ownership | **Business connects an authorized WhatsApp Business account/number to NukMiris.** | Validate Meta Embedded Signup, coexistence, account permissions and credential model. Tech Provider status does not alone determine payer of Meta messaging charges. |
| Subscription pricing | **The business pays NukMiris a subscription including an agreed message allowance. NukMiris intends to cover Meta message charges and earn a margin; larger packages cover higher usage.** | Validate Meta's actual billing responsibility/line-of-credit/partner payment options and measure chargeable messages before promising included quantities. Billing implementation is future scope. |
| F-16 — operators | **Use authorized NukMiris operators with scoped, audited permissions.** | Define operator authentication/grants and least-privilege workflows before commercial launch. |
| F-12 — privacy | **A concrete privacy, retention and residency proposal is needed later.** | Do not invent an approved jurisdiction, retention duration or compliance claim. |
| F-06 — customer identity | **Use the WhatsApp/customer phone identity, scoped by business. Manually added appointments must also be eligible for reminders when correctly linked to a customer WhatsApp number.** | Separate verified inbound WhatsApp identity from manually entered contact numbers; define normalization/validation, customer association, opt-in evidence, Calendar event conventions, reconciliation and consent before sending. |
| Scalability | **Design with commercial growth in mind; architects recommend the topology and performance/recovery targets.** | Claude's numerical T-1–T-7 figures remain proposals, not owner-approved SLOs or budgets. |

## Scope distinction

The accepted **v0.8.1 functional parity** remains the baseline for a rebuild unless the owner approves a changed scope. Multi-employee scheduling, colors/employee display, native-chat coexistence improvements, and reminders for manually created Calendar appointments are **new or expanded product requirements** relative to that baseline. Architects must account for them in future-proof design and call out their impact, but must not silently claim they already work in v0.8.1.

## Open questions to resolve before implementing affected features

1. **Employee scheduling:** How employees are created/identified; whether customers choose an employee or accept any available employee; employee-specific hours, breaks, vacations, durations, assignment changes and capacity. Whether owner or NukMiris manages colors and title conventions.
2. **Normal WhatsApp chat coexistence:** Which Meta Business App + API coexistence capability is available for each owner; what messages are visible in the App; how the assistant differentiates appointment intent from friend/customer chat; explicit manual/automatic handoff, suppression and reentry; whether auto-replying to all incoming messages is desirable. Owner's aim is to preserve ordinary chats and use scheduling as an add-on.
3. **Manual appointments:** Minimum Calendar event format and owner workflow; exact matching to phone/wa_id; opt-in/permission evidence, duplicate contacts and identity errors; whether owner creates events directly in Calendar or via NukMiris; reminder enrollment and how edits/cancellations are detected.
4. **Meta commercial model:** WABA ownership, Tech Provider status, Embedded Signup/coexistence eligibility, whether/how NukMiris can assume provider billing, rate changes, usage measurement and package allowances. No automatic assertion that Tech Provider status alone charges NukMiris.
5. **Operational safety:** Define response to uncertain messages, incident owner, alert paths, replay/cutover; experimentally validate Google/Meta provider contracts, worker fencing, restore completeness, and tenant security.
6. **Privacy and service targets:** LATAM privacy policy, data residency/retention, legal rights, agreed pilot volume, response-time/reliability/recovery objectives, on-call staffing and budget.
7. **Timeline/scope:** Decide whether future features above enter the first greenfield release or are separately planned after strict v0.8.1 parity.

## Change control

This is a requirements/owner-decision record only. No deployment, implementation, live Meta/Google change, approved feature expansion or modification of the original Codex/Claude reports is implied.
