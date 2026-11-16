# NukMiris — Release Roadmap

**Planning version:** 1.1 (2026-11-16)
**Status:** OWNER-APPROVED RELEASE ALLOCATION; **NOT IMPLEMENTATION AUTHORIZATION**
**Master register:** [NUKMIRIS_FEATURE_REGISTER.md](NUKMIRIS_FEATURE_REGISTER.md) v1.9
**Source decisions:** Owner release validations (2026-11-16), including R1 PWA, calendar import, and start-time setting NM-067.

## Release governance

- **Release IDs:** R0 → R1 → R2 → R3 → R4 → R5. Finish and receive explicit owner acceptance of a release before starting implementation of the next. Requirements analysis/design preparation may be done in advance, but coding/provisioning/live-provider use requires separate authorization.
- **Feature status is independent of assigned release.** Existing `DONE (reported)` refers to legacy history; rebuilt vNext parity must be re-verified.
- **No target dates or duration estimates** without an evidence-based size and delivery estimate. Current Codex/Claude work, existing draft PRs and guarded integrations must be assessed at each gate.
- **No automatic merge, GCP provisioning, real WhatsApp sending, live Google Calendar access, account creation, or payments** from this document.
- **Pilot is not paid public launch.** Real business paid self-service onboarding and subscription billing are R5 requirements.

## R0 — Complete and accept vNext core booking

**Outcome:** Locally accepted (Windows, synthetic providers) booking, rescheduling/cancellation, correct customer-facing conversation flow, and bounded recovery and safety.

**Feature targets:** NM-006, NM-007, NM-010, NM-024, NM-025, NM-029, NM-031, NM-032, NM-033, NM-036, NM-037, NM-038, NM-040, NM-041, NM-042, NM-043, NM-045, **NM-068**; plus parity verification of NM-001–005, NM-008, NM-009, NM-011, NM-013.

**Delivery dependencies:** Current bounded RC-1 local reschedule/cancel work (GitHub Issue #26) and Milestone A (Issue #7); do not misstate prior synthetic tests as real provider proof.

**Owner-requested Spanish copy corrections (NM-068):** Review and, upon separate implementation authorization, apply CX-001, CX-002, CX-004, CX-008, CX-012–015, CX-021, CX-022, CX-024, CX-039 and CX-040 from [CUSTOMER_FACING_TEXT_REVIEW.md](CUSTOMER_FACING_TEXT_REVIEW.md). Preserve approved scenario routing, human handoff and error safety. **Open copy checks:** CX-008 is sourced from a no-active-services condition but the requested replacement describes no available times; CX-021/CX-022/CX-024 contain small spelling/formatting ambiguities to resolve before implementation. The feature is not built; its placement in R0 is planning only.

**Acceptance gate:** Owner walks through known/new booking, 0/1/multiple appointments, immediate cancel/reschedule (only before appointment start), employee and customer overlap protection, menu/human support, replayed/stale actions, restart, service buffers, and no false confirmations. Native Windows test evidence and independent reviews as required.

## R1 — Services and installable mobile-first owner PWA

**Outcome:** Owners can perform daily operations primarily on smartphones. Responsive web app also usable on desktop; supported phones can install it as a Progressive Web App. Offline and push features are not automatically part of R1.

**Feature targets:** NM-016, NM-022, NM-028, NM-035 (owner appointment detail), NM-047, NM-055, NM-056, NM-057 (synthetic import), NM-058, NM-059, NM-060, NM-061, NM-067.

**Capabilities:**
- Services: name, fixed price and fixed duration; buffers, employee qualifications and business hours.
- Owner sign-in and role-scoped access (Owner/Manager/Receptionist/Employee as applicable).
- Mobile employee setup, working hours, absences/days off, and business-wide closures.
- Manual appointment and customer creation/search; manual no-contact block applies to all employees.
- Customer continuity: previous employee for same service; prioritize their next available appointment; random qualified, available assignment if no same-service history.
- **NM-067: “Intervalos de inicio de citas.”** Owner selects `Horarios fijos` (fixed grid, e.g., top of hour) or `Horarios flexibles` (earliest valid start after previous appointment + buffer, e.g., 11:45). Fixed-grid choices (15/30/60 minutes, etc.) to settle during detailed design. All modes respect business/employee availability, buffers, minimum lead time, booking conflicts and time zones.
- **Structured 365-day Calendar contacts (NM-057):** *synthetic/mock data only during R1*, with owner import preview. For calendar entries with a name but no WhatsApp phone number, ask owner to complete the number before importing a contact. For ambiguous names/numbers, request review, never guess. Customer confirms existing imported name once on first WhatsApp interaction; customer-provided fuller/corrected name replaces primary displayed name, retaining original owner-supplied value in history. Do not rewrite Calendar source events or send messages from import.
- Business-wide owner controls to configure automation; cancellations/rescheduling allowed for customers only if appointment start time is strictly future.

**Acceptance gate:** Complete mobile-first owner walkthrough using an installed PWA and browser; enter services, staff, hours and leave, find/create a customer, manually book or block time, configure start rules, inspect appointment details and preview synthetic Calendar customer import without technical staff intervention. Preserve existing appointments and protected/UNKNOWN actions.

## R2 — Customer preferences and automatic waiting list

**Outcome:** Customer management and consent/preferences are usable, and waiting list runs fully automatically in synthetic tests.

**Feature targets:** NM-014, NM-046, NM-054, NM-062.

**Capabilities:** Owner-configurable welcome, customer history/preferences, independent toggles for automated bookings, conversational bot and reminders, and non-blocking human handoff. No banned-customer/block-list feature (NM-012 superseded). On a cancellation/opening, notify **all eligible interested waitlist customers** and book exactly the first valid confirmed response; later replies cannot double-book. Ensure offer expiry and idempotence, tenant scoping, consent eligibility and fair customer messaging.

**Acceptance gate:** Owner can manage individual automation, waiting-list entry/cancel and a multi-customer race; one and only one confirmed new appointment wins, with non-winning customer feedback. R2 uses synthetic messaging and must not send live WhatsApp notifications.

## R3 — Live integrations, cloud and controlled pilot

**Outcome:** Real WhatsApp and Google Calendar supported safely in a limited pilot, on approved managed hosting; public informational pilot website available.

**Feature targets:** NM-015, NM-017–021, NM-023, NM-026, NM-027, NM-030, NM-034, NM-039, NM-035 (live event mapping), NM-057 (live authorized Calendar contact import), NM-063.

**Dependencies / gates:**
- Explicit GCP spend/region authorization, approved architecture/security/recovery, safe migration and deployment gates; no production cutover from this plan.
- Meta WhatsApp credentials/template readiness per sending business, opt-in consent, safe outbound ordering and reminder delivery evidence. Calendar availability/create/move/delete with idempotence and uncertain outcomes, plus protective reconciliations.
- Business WhatsApp Business app + Cloud API **coexistence feasibility is unresolved**; verify eligibility, routing and ability for owner/staff to reply through WhatsApp Business app before treating that as delivered. Provide an owner-approved fallback if infeasible.
- Owner authorized real Google Calendar history scan; structured 365-day contacts, owner phone completion for missing numbers, preview, customer confirmation and audit. No unsolicited import broadcast.
- Cloud monitoring and safe manual incident recovery, rollback and no unsafe duplicate provider actions.
- Public pilot website: product information, mobile contact/pilot interest and appropriate legal/privacy material.

**Acceptance gate:** Authorized live end-to-end pilot including booking, cancellation/reschedule, assigned employees, Calendar synchronization, consented reminders, handling protected uncertain results and human exceptions; restore/rollback drills and observed support. Explicit owner pilot acceptance.

## R4 — Customer growth and advanced imports

**Outcome:** Owners understand customer value, recover inactive relationships and communicate with eligible customers.

**Feature targets:** NM-048, NM-049, NM-050, NM-051.

**Capabilities:** Owner phone-contact imports (subject to platform permission), CSV/Excel import, normalized-number dedupe and confirmed names; owner announcements for operational closures and opt-in promotional messages; customer metrics, estimated booked value (not paid revenue), loyalty and missed-visit analysis.

**Acceptance gate:** Preview/deduplicate imports, reconcile names safely, show accurate KPIs, send only policy/consent-eligible broadcasts with controls and audit.

## R5 — Paid commercial readiness

**Outcome:** Self-service business registration, pricing and billing for businesses paying NukMiris before first paid public launch.

**Feature targets:** NM-064, NM-065, NM-066.

**Capabilities:** Guided business signup, business subscription pricing, free trial/allowance, overages/cap/grace controls, billing and receipts, commercial customer support. Price points, billing provider, terms and billing policies require separate approval.

**Acceptance gate:** A business owner can register, connect authorized services, choose a plan, see usage/billing, and pay NukMiris for subscription. Does **not** include customer-to-salon checkout.

## No active release / disposition

- **NM-012:** SUPERSEDED; owner rejected blocking customer numbers. Use automation settings NM-046 instead.
- **NM-044:** FUTURE; natural-language human escalation, not currently prioritized.
- **NM-052:** FUTURE; human-reviewed photo/custom quote process. No AI quotation required.
- **NM-053:** DEFERRED; customers paying salons in NukMiris is out of scope for now.

## Cross-release controls

- R1 and R2 may have synthetic prototype adapters even though R3 enables real provider accounts; production integration must not be implied by prototype acceptance.
- R0 must not be marked complete solely from previous legacy `DONE (reported)` entries or old draft PR tests.
- Owner decisions recorded in Feature Register v1.7 remain binding, including no customer overlaps, owner lead time, reschedule/cancel eligibility cutoff at scheduled start, and employee continuity.
- Preserve stable NM IDs and log future changes to release targets with rationale; update source register and roadmap together.
- Every release transition requires owner confirmation; no implementation begins from this planning document alone.
