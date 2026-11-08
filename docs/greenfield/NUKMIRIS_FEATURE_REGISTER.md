# NukMiris — Feature & Improvement Register

**Version:** 1.3  
**Established:** 2026-10-27  
**Product baseline:** v0.8.1; local vNext L2 owner walkthrough on Windows (tested source `3d8f82bb047e6ed937750b7ce6e81ecd23ab9f42`)  
**Purpose:** Living backlog for functional features, UX improvements, compliance, reliability, and maintenance. This is a planning source, **not** proof that implementation has been independently tested.

## Status rules

- **DONE (reported)**: Marked DONE in the original development notes; current-release regression verification remains separate.
- **OPEN**: Requested, under consideration, or not yet confirmed implemented.
- **IN PROGRESS / READY FOR TEST / VERIFIED / DEFERRED / CANCELLED**: Use as development progresses.
- **Priority:** P0 = security/compliance/serious production reliability; P1 = MVP release-readiness; P2 = normal enhancement; P3 = technical hygiene or later refinement. Priorities below are proposed, not agreed scope.
- **Feature IDs never change.** New features receive NM-029, NM-030, etc. Preserve audit history and implementation/version evidence.

## Summary

- **NM-001–NM-032:** original and previously agreed register items, retained with their original IDs. NM-029–NM-032 cover vNext date labels, uncertainty acknowledgments, multiple-appointment management parity and the three-option main menu.
- **NM-033–NM-044:** additions from the complete vNext L2 owner walkthrough, classified as regressions, improvements, decisions to resolve, or testing infrastructure. New entries are **OPEN** or **DEFERRED**, not treated as implemented.
- **Next Codex increment:** scope classification and acceptance gates are documented below; this is an implementation request, not evidence of implementation or permission to merge/deploy.
- **Functional evidence:** the owner completed a Windows browser walkthrough of Tests 1–26, with subdivisions. See the test-evidence matrix below. Passed browser behavior does not establish provider integration or backend safety in cases requiring deeper testing.
- **Build baseline:** 41/41 native Windows `test:runtime` tests passed at the corrected L2 SHA. Independent L2 Claude approval and production-provider tests remain separate gates.

## Full feature register

| ID | Status | Priority | Area | Feature / requirement | Acceptance criteria / decisions to resolve |
|---|---|---|---|---|---|
| NM-001 | DONE (reported) | — | WhatsApp menu | Rename “Hacer cita nueva” to “Agendar una cita”. | Menu shows the new label. |
| NM-002 | DONE (reported) | — | Human-support copy | Replace “Para regresar al menú automático, escribe Menu.” with “Para organizar tu cita o cancelar, escribe \"menu\".” | Customer-facing text matches approved copy. |
| NM-003 | DONE (reported) | — | Booking copy | Replace long first availability prompt with “Elige un horario que te funciona mejor:”. Do not repeat business name. | Short prompt displayed during initial availability options. |
| NM-004 | DONE (reported) | — | Booking copy | Replace long extended-availability prompt with “Te muestro mas opciones. Elige un horario que te funciona mejor:”. | Short prompt displayed on additional options. vNext owner observed missing accent in “mas”; change displayed copy to “Te muestro **más** opciones. Elige un horario que te funciona mejor:”. Retain legacy semantics and re-test. |
| NM-005 | DONE (reported) | — | WhatsApp menu | If customer has a future appointment, include customer name, business and existing date/time in menu greeting; show no appointment detail otherwise. | Conditional greeting, correct business/customer and localized appointment date/time. |
| NM-006 | DONE (reported) | — | Rescheduling | Selecting new date/time directly reschedules; do not show “Confirmar cambio” / “Conservar mi cita”. | Single action reschedules and confirms success; idempotent handling verified. |
| NM-007 | DONE (reported) | — | Cancellation | Selecting an appointment to cancel immediately cancels; do not show “Sí, cancelar” / “Conservar mi cita”. | Selected appointment cancelled once and customer informed. |
| NM-008 | DONE (reported) | — | Booking confirmation | Say “¡Te esperamos en <business name>!”; do not repeat business name after the appointment date/time. | Confirmation copy uses configured business name once in intended location. |
| NM-009 | DONE (reported) | — | Intent routing | “agendar” triggers same booking flow as “cita”. | Both keywords route equivalently. |
| NM-010 | DONE (reported) | — | Cancellation copy | Remove “Escribe \"menu\" para volver.” from selection prompt. | Copy change verified. |
| NM-011 | DONE (reported) | — | Date formatting | Available slot button text format “vie 2 abr 10:00” instead of “vie 02/04 10:00”, staying inside WhatsApp’s 20-character button-title limit. | Localized short date labels, unambiguous options, <=20 chars. |
| NM-012 | OPEN | P1 | Owner controls | Allow business owner to block a customer WhatsApp phone number in web app; respond that appointment scheduling is unavailable and ask customer to contact business by phone. | Block list per business; prevents booking/rescheduling as defined; localized configurable response; owner can unblock; privacy/audit handling defined. |
| NM-013 | DONE (reported) | — | Customer copy | Remove references to “NukMiris” from customer-facing “No upcoming appointments” message and similar conversation copy. | Brand-neutral customer-facing wording; no leaked platform branding. |
| NM-014 | OPEN | P1 | Onboarding / WhatsApp | For a first-time customer entering booking, show a brief business welcome, explanation of automated scheduling, available commands (“cita”, “reagendar”, “cancelar”, “menu”), address and opening hours, followed by available booking options. | Define when shown once vs repeatedly; business-configured address/hours; localization; no excessive message length. |
| NM-015 | OPEN | P0 | Meta reliability | Detect Meta WhatsApp authentication failures automatically and alert NukMiris administrator. | Detect token/permission/auth errors, alert with business/account and severity, suppress alert storms; monitoring includes recovery. |
| NM-016 | OPEN | P2 | Owner dashboard | Show simple customer appointment confirmation status without opening Google Calendar event. | Calendar/record and dashboard consistent; statuses such as Confirmed / Awaiting / Not applicable defined. |
| NM-017 | OPEN | P0 | Reminders | Validate each required Meta template is approved, active and available before sending reminders. | Per-template readiness checks, explicit failures, alerts or dashboard state; no silent failure. |
| NM-018 | OPEN | P1 | Reminders | Persist audit trail for every reminder: scheduled, sent, delivered, failed, skipped, with reason. | Timestamp, business, appointment, template, status, provider IDs/error details and retry behavior; delivery may require webhook receipt. |
| NM-019 | OPEN | P0 | Multi-business / Meta | Check template availability and approval against the actual WhatsApp Business Account (WABA) sending each business’s message. | Never assume approval under one WABA applies to another; tenant isolation and sending-number/account mapping. |
| NM-020 | OPEN | P0 | Consent | Define how customer messaging opt-in is collected at first interaction and/or booking completion. | Policy-compliant consent copy, timing, scope, source, timestamp, retention and opt-out mechanics; resolve whether appointment-specific messages are covered. |
| NM-021 | OPEN | P1 | Capacity research | Investigate the reported “250 customers/hour” WhatsApp/Meta limit and identify actual constraints. | Verify current official limits (messaging, throughput, recipients, quality and account tiers) for intended configuration; document practical impact and mitigation. Do not assume 250/hour is a verified limit. |
| NM-022 | OPEN | P2 | Scheduling rules | Configure minimum lead time per business before a new appointment can start (e.g., cannot book a slot starting in 15 minutes). | Per-business lead time; timezone, same-day options, daylight savings, updates and race conditions accounted for. |
| NM-023 | OPEN | P0 | Admin operations | Monitor WhatsApp / Meta / Google Calendar integrations, inbound/outbound message health and errors in an admin view. | Per-business connection state, last successful events, outage/alert thresholds and diagnosable error categories. |
| NM-024 | OPEN | P2 | CLI / monitoring | Treat CLI recovery outcome `status: uncertain` as unresolved even when process exits with code 0. | Operational checks evaluate structured outcome, not only exit code; uncertain triggers follow-up/escalation rather than success signal. |
| NM-025 | OPEN | P3 | Technical maintenance | Consolidate diagnostic/troubleshooting scripts under documented `backend/scripts/`. | Intentional scripts version-controlled, documented invocation and permissions, no accidental secrets or untracked scratch scripts. |
| NM-026 | OPEN | P0 | Compliance | Review and implement current Meta WhatsApp opt-in requirements. | Record review against https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in ; verify consent language, evidence, opt-out and template messages. Approval of templates is not itself proof of opt-in compliance. |
| NM-027 | OPEN | P0 | Error handling / handoff | When Google Calendar, WhatsApp or another critical dependency fails, provide customer-friendly messaging and enter human-support / Needs Attention workflow when a customer-reachable channel remains available. | Separate failures where WhatsApp cannot deliver any reply from Calendar failure where it can; queue case, notify owner/admin, avoid false booking confirmations, retry safely. |
| NM-028 | OPEN | P1 | Owner controls | Provide business-level on/off toggle for automated appointment scheduling in owner web app. | Disabled business does not offer or accept new automated bookings; decide effect on existing bookings, reminders, cancellations and human-support routing; persist per business. |
| NM-029 | OPEN | P1 | vNext WhatsApp interactive date/time formatting | Restore and consistently reuse the v0.8.1 short Spanish date/time label convention **`sáb 7 nov 09:00`** (no zero-padded day, abbreviated lowercase weekday and month, 24-hour `HH:mm`) across **all WhatsApp interactive messages**, including initial slot proposals, more options, date-specific time slots, rescheduling and cancellation selection where date/time appears. Date-only list rows follow the same convention without a time (`sáb 7 nov`). | One shared locale-aware formatter; dates use the business timezone; reply button labels remain within 20 characters and list row titles within 24; the correct interactive message type/option count is enforced; simulator mirrors the intended Meta reply-button/list presentation; regression tests include accented abbreviations, month/year boundaries and lengths. Legacy v0.8.1 behavior is the reference; vNext screenshots showed longer date-only list labels. Do not mark verified until tested on vNext and eventually real WhatsApp. |
| NM-030 | OPEN | P1 | Uncertain booking / customer communications | When a booking operation has an uncertain outcome (e.g. `UNKNOWN_OUTCOME_HELD`), investigate delivering a **safe, non-confirming customer acknowledgment** if the messaging channel remains available: “Estamos revisando tu solicitud. Aún no podemos confirmar tu cita. Por favor, espera nuestra respuesta.” | Preserve message ordering, entered/UNKNOWN protection and evidence-only reconciliation. Do not send an acknowledgment when an earlier uncertain outbound message blocks safe delivery, or when WhatsApp cannot send. Do not imply booking success, failure, cancellation or guaranteed follow-up. Record whether acknowledgment was queued, sent, blocked or impossible; surface pending operator action in Needs Attention. Test lost response, before-apply failure, channel outage, app restart and no duplicate sends. User-requested during vNext local Test 6B. |
| NM-031 | OPEN | P1 | Existing appointments / management parity | Restore **v0.8.1 menu behavior**: when `menu` is entered, show the customer’s existing upcoming appointments (if any), then present the **three main menu options** (`Agendar una cita`, `Reagendar / cancelar`, `Hablar con alguien`). **Only after** the customer selects rescheduling or cancellation, ask them to select the specific appointment to manage if multiple are present. Do not present appointment-management selection during the initial menu or ordinary `cita` booking. | Owner clarified legacy parity after vNext L2 testing; Carlos had multiple appointments but the current simulator only summarized the latest. Verify 0/1/2/many upcoming appointments, stable customer/tenant scopes, distinct appointment IDs, correct selection only within manage/cancel, WhatsApp limits and no accidental mutation. This supersedes the earlier interpretation of NM-031; cross-reference NM-032. |
| NM-032 | OPEN | P1 | Main menu / v0.8.1 parity | **Restore main-menu routing:** `menu` displays the three choices **Agendar una cita**, **Reagendar / cancelar**, **Hablar con alguien**. In contrast, `cita` starts booking directly. Accept equivalent case variants of `menu`; do not route it straight to slot offers. Keep `reagendar`, `cancelar` and `humano` shortcuts, respecting support mode and uncertain-outcome safety gates. | vNext L2 owner test: entering `menu` in Carlos's chat bypassed the main menu and directly displayed available booking times; legacy v0.8.1 has three-item main menu. Test known/new customers, existing multiple bookings, after human support, stale actions, and protected/UNKNOWN work. Reschedule/cancel completion may remain gated until implemented; never show functioning actions that silently book instead. |
| NM-033 | OPEN | P1 | Human support / v0.8.1 parity | **Do not send repeated automated replies** for ordinary customer messages once human-support mode is active. Preserve and hand off every message. Restore appropriate entry-only guidance from v0.8.1 (`Escribe tu mensaje. Escribe "menu" para volver al menú principal.`), subject to approved copy. | Tests 5A–5C and 21A–21B: `humano` activates human mode and `cita` is suppressed, but every subsequent human-chat message triggers the repeated `Atención humana activa.` plus existing appointment information. One acknowledgment at entry only; ordinary text stored/queued without bot reply; `menu` exits. Verify restart, duplicate message, privacy and safe escalation. |
| NM-034 | OPEN | P1 | Owner inbox / human handoff | Provide an authorized, business-scoped way for Juanita/other owners or designated staff to **see incoming human-support requests and customer messages, respond, and close/transfer the conversation**. Clarify whether customer-originated support requests appear in Needs Attention or a separate human inbox; ensure actionable notifications. | No owner-reply action was exposed in local L2 browser; tests 5/21 only verified routing. Test handoff end-to-end, both directions, ownership, read status, permissions, non-bot replies, conversation exit and audit. Does not imply any real WhatsApp integration exists yet. |
| NM-035 | OPEN | P1 | Calendar integration / CAL-01 | Ensure each appointment preserves and, for authorized staff, **displays customer name, WhatsApp number, service, assigned employee, start/end, duration, buffer, status and booking source** in an appointment detail view and eventually the actual Google Calendar event. Define title/description and whether buffer is blocked separately. | Test 11A: simulated event cards were not clickable and showed only date/time, employee, 60 minutes + 15-minute buffer. Verify storage and data mapping separately (not proven missing); click-to-view event details, correct tenant access, phone-number privacy, source, and identical provider reconciliation; do not assume local simulated event equals live Google Calendar behavior. |
| NM-036 | OPEN | P1 | WhatsApp fidelity / UX-02, UX-03 | Ensure the simulator and outgoing-message validation distinguish **reply buttons** (max 3; title max 20 characters) from **interactive lists** (max 10 selectable rows; row title max 24 characters); respect dynamic label lengths and other actual Meta limits. Represent date-list choices as a list, not four reply buttons. | Date selection screenshots showed three dates plus `Más fechas` as four identical browser buttons (possible real WhatsApp list); verify payload type, limits, UTF-8/accent handling, title/description handling, invalid payload rejection and representative WhatsApp integration. Cross-reference NM-011/NM-029; do not duplicate date-format rules. |
| NM-037 | OPEN | P2 | Date parsing / Spanish locale | Support common unambiguous full Spanish date expressions **inside an active date-selection flow**, e.g. `miércoles 11 de noviembre`, while keeping the current accepted `11 nov`, `13 nov`, `próximo lunes`. Outside booking, date-only text must not silently start booking. | Test 14: full `miércoles 11 de noviembre` rejected, shorter `11 nov` accepted; Tests 13, 15, 16 and 24 verified other accepted/rejected cases. Add explicit grammar and ambiguity policy, weekday/date mismatch validation, accent handling and timezone/year rollover. No natural-language AI interpretation implied. |
| NM-038 | OPEN — DECISION | P1 | Customer booking rules | Decide and enforce how to handle **overlapping appointments for the same customer across different employees**, and whether identical service/time duplicates are allowed. At minimum do not silently offer the same customer the exact already-booked slot as though it were a new appointment. Preserve distinct non-overlapping multi-appointments per NM-031. | Owner walkthrough: Ana was offered 10:30/11:00 while holding a 10:30 appointment; María was offered 13:30/14:00 while holding 14:00. An earlier 11:00 attempt returned a stale/timeout message, not proven customer-overlap rejection. Agree business policy and exception handling (e.g., concurrent group services) before implementation; test across employees and buffer rules. |
| NM-039 | OPEN | P1 | Recovery / Needs Attention operations | Supply an authorized operator workflow to **inspect the evidence and reconcile a protected `UNKNOWN_OUTCOME_HELD` operation**, with explicit safe decision paths, audit, and no blind retry or arbitrary clearing. Show business, affected appointment/customer (appropriately masked), status, evidence and next action. | Tests 6B, 7, 8, 9, 10: protected unresolved booking survives restart and blocks that conversation without cross-business/customer interference; existing local panel only shows a generic warning. Reconciliation and owner action were **not** tested; preserve issue as protected until authoritative evidence or approved manual procedure. Cross-reference NM-027 and NM-030. |
| NM-040 | OPEN | P2 | Test fixture / race safety | Add a **fourth independent synthetic customer** or deterministic race fixture so an old offer can be held while both employees are booked by other customers; keep Ana's protected state intact. | Test 17C unable to reproduce cleanly with three identities, since Ana was blocked and Carlos/Pedro already consumed the relevant offers. Fixture should allow controlled stale-click, deterministic clock/offer age, check both employee capacity and no third booking; no real providers. |
| NM-041 | OPEN | P1 | Test fixture / buffer safety | Provide a deterministic **future-date employee buffer fixture** with service duration and per-employee 15-minute margin, and assert correct assignment around exact boundaries. | Test 25 could not establish buffer enforcement: `6 nov` was same-day/no availability. For a 09:00–10:00 service + 15-minute buffer, reject 10:00 and allow 10:30 on the 30-minute grid for that employee, while allowing another free employee; avoid using historical/past slots. Assert worker/DB scheduling, not solely visual offers. |
| NM-042 | OPEN | P1 | WhatsApp stale action safety | Verify server-side **expired, superseded, replayed and out-of-order interactive selection rejection**, regardless of whether WhatsApp visually permits clicking an old button. Observe actual WhatsApp button behavior in a later controlled real-provider test. | Test 19: simulator disabled old actions visually; this is not proof the backend rejects forged/stale interactive IDs. Test through API/runtime in synthetic mode; verify no double booking and standardized expired-option response. Do not assume Meta can remotely disable sent buttons. |
| NM-043 | OPEN | P3 | Date-error text / UX copy | Optionally distinguish invalid date, unrecognized date, past date, and out-of-horizon date more clearly; keep an actionable route back to valid dates or existing buttons. | Test 24: `31 nov` and `29 feb 2027` were safely rejected but generic `No pude identificar bien la fecha` was used; past date and 365-day horizon already produced specific explanatory copy. Editorial improvement, not a current safety blocker. |
| NM-044 | DEFERRED | P2 | Intent routing / human support | Revisit **context-aware unknown-text escalation to human support**, including natural-language requests for Juanita, state-aware fallback and durable owner handoff; do **not** turn every unrecognized word into human mode automatically without policy. | Previously raised during v0.8.1 review and deliberately deferred until legacy/runtime testing completed. Distinct from NM-033 (active support behavior), NM-034 (owner inbox) and NM-027 (provider failures). Requires explicit owner scope decision before Codex implementation. |

## vNext L2 local owner testing — evidence & remaining gates (2026-11-05/06)

**Scope:** synthetic browser/chat/calendar on owner Windows laptop, corrected source `3d8f82bb047e6ed937750b7ce6e81ecd23ab9f42`; no real WhatsApp, Google Calendar or GCP. “PASS (visible)” means the observed UI outcome, not an independent backend proof. A code-level or live-provider follow-up may remain.

| Test | Observed result | Evidence / follow-up |
|---|---|---|
| Windows runtime | **PASS** | `test:runtime`: 41 pass, 0 fail, 0 skip; native ACL and metadata sync EXECUTED; interactive synthetic booking PASS. |
| 1–2 | **PASS (visible)** | Known/new customer slot booking, new-name collection after time selection, two employees and synthetic calendar; services/customer phone not visible in calendar (NM-035). |
| 3 | **PASS (visible)** | With Sofía and Lucía occupied at 09:00, first offered slot was 10:30. |
| 4A–4B | **PASS with UX note** | `Más opciones`, `Elegir fecha`, date-to-times; date list drawn as four buttons (NM-036), date-only labels not matching approved short format (NM-029). |
| 5A–5C | **PARTIAL / regression** | `humano` enters, `menu` leaves, but bot repeats `Atención humana activa.` after ordinary human chat; owner reply/inbox not demonstrated (NM-033/034). |
| 6A | **PASS (visible)** | Apply-then-lose-response simulation ended with one visible new confirmed event and no incident; internal reconciliation not independently proved by UI. |
| 6B | **PASS (visible) / UX gap** | Before-apply failure kept 12:00 unconfirmed and `UNKNOWN_OUTCOME_HELD`; no customer acknowledgment, NM-030. Initial 11:00 attempt returned a different rejection and did **not** establish the fault condition. |
| 7–8 | **PASS (visible)** | `UNKNOWN_OUTCOME_HELD` persisted across restart; `menu` while protected produced no unsafe response or booking. Operator reconciliation pending NM-039. |
| 9A–9C | **PASS (visible)** | Bernard distinct from Juanita, successful cross-business booking, Juanita's incident preserved. |
| 10A–10B | **PASS (visible)** | Second new customer booked while Ana held; no cross-customer blocking. |
| 11A | **GAP** | Clicking synthetic calendar event does nothing; NM-035. |
| 12A–12B | **GAP** | Customer with two appointments sees only latest in both `cita` and `menu`; owner clarified initial `menu` must show existing appointments then three choices; per-appointment selection only during reschedule/cancel (NM-031/032). |
| 13 | **PASS** | `próximo lunes` correctly interpreted when asked for date within booking; date-only text outside flow should not start booking. |
| 14A–14B | **PARTIAL** | `miércoles 11 de noviembre` rejected; `11 nov` accepted; NM-037. |
| 15–16 | **PASS** | Unknown `xyz123` rejected; flow recovered with `13 nov`. |
| 17A–17B | **PASS (visible)** | Multiple employee allocation and exclusion of full 09:00 slot on 13 Nov. |
| 17C | **PENDING** | Controlled stale offer consumed during setup; requires fourth test identity/fixture (NM-040). |
| 18A–18B | **PASS (visible)** | Numeric-only name `12345` rejected; later `María Fernández` accepted and booked with alternate employee. |
| 19 | **PARTIAL** | Simulator visually disables superseded buttons; API-side rejection and actual WhatsApp old-button behavior unverified (NM-042). |
| 20 | **PARTIAL / known menu regression** | `menu` changed active offer and preserved existing booking; displays slot suggestions rather than required main menu (NM-032). |
| 21A–21B | **PARTIAL** | `humano` superseded booking, `cita` within support did not resume automation; repeated bot message remains (NM-033), old-button backend handling NM-042. |
| 22 | **PASS (visible)** | Unfinished offer state survived restart, `Más opciones` worked, no unintended new booking. |
| 23 | **PASS (visible)** | `8 nov` no-availability path correctly offered another date; business closure versus capacity not independently verified. |
| 24A–24D | **PASS (visible)** | Invalid `31 nov`, past `1 nov 2026`, over-horizon `15 ene 2028`, invalid `29 feb 2027` all safely rejected. Copy improvement optional NM-043. |
| 25 | **INCONCLUSIVE** | Same-day 6 Nov had no available slots; need controlled buffer fixture NM-041. |
| 26 | **PASS (visible)** | Bernard provider-failure mode remained normal despite Juanita protected incident; setting/business UI isolation verified. |

**Additional observation from multiple tests:** customer could be offered overlapping existing appointments across different employees. This is a **policy/acceptance decision**, not yet established as an engine failure: NM-038.

**Unimplemented or outside current L2 scope (do not mislabel as L2 test failures):** full reschedule/cancel, service catalog and owner configuration, owner inbox, real Google Calendar event creation, live Meta messaging, reminders and onboarding. Preserve v0.8.1 parity requirements separately from synthetic L2 acceptance. Claude's independent review/approval remains to be checked independently.

## Next Codex increment — implementation scope decision (2026-11-06)

**Scope vocabulary:** **BUILD NEXT** = Codex should implement/test in the next focused local synthetic vNext correction increment; **DESIGN NEXT** = inspect current implementation and propose a bounded design/acceptance contract now, but do not ship unfinished/unsafe behavior; **VERIFY NEXT** = add independent synthetic regression evidence or fixture before claiming support; **DEFER** = do not implement this increment without new owner authorization. This is **scope planning**, not a status change from OPEN to IN PROGRESS or VERIFIED. All existing draft PRs remain unmerged; preserve separate legacy v0.8.1 and provider environments.

| ID(s) | Next increment scope | Requested Codex outcome / gate |
|---|---|---|
| NM-001, NM-003, NM-004, NM-005, NM-008, NM-009, NM-011, NM-013 | **VERIFY NEXT** (plus NM-004 editorial correction) | Compare v0.8.1 customer-facing copy, greeting/appointment details, direct `cita`/`agendar` shortcuts, short dates and absence of unexpected platform branding; restore exact agreed parity where absent; do not assume all old copy must appear in the simulator. |
| NM-029 | **BUILD NEXT** | Single business-timezone formatter (`sáb 7 nov 09:00`; date-only `sáb 7 nov`) for all interactive labels; format-limit tests. |
| NM-030 | **DESIGN NEXT**, conditional bounded implementation only after safety review | Define safe, nonconfirming acknowledgment gate for held/uncertain operations; do not bypass ordered outbound ledger, uncertainty holds or no-retry rules. Demonstrate blocked-vs-sent behavior in synthetic tests; if not provably safe, keep gated and report. |
| NM-031, NM-032 | **BUILD NEXT (menu + display)**; **DESIGN NEXT (manage flows)** | Restore three-item menu and all upcoming appointment summaries; don't ask which appointment until `Reagendar / cancelar` is selected and the manage flow is actually implemented. Do not make dormant actions silently start booking. Document separate reschedule/cancel parity stage. |
| NM-033 | **BUILD NEXT** | Entry-only human handoff response; ordinary text saved/routed with no repeated bot replies; `menu` exits; `cita` remains human text while support active. |
| NM-034 | **DESIGN NEXT** | Specify authorized business owner/staff inbox, reply path and human-handoff/Needs Attention routing. No fake owner reply capability; secure workflow can be built in subsequent explicitly gated increment. |
| NM-035 | **BUILD NEXT (synthetic event details)**; **DESIGN NEXT (real provider map)** | Verify and populate stored name, synthetic WhatsApp contact, service, employee, start/end, buffer, status, source; clickable authorized appointment detail panel; never invent missing service metadata. No real Google Calendar calls. |
| NM-036 | **BUILD NEXT** | Render actual reply-button vs list interaction distinction; enforce Meta counts and label bounds at message-construction boundary, not only browser presentation; type and boundary tests. |
| NM-037 | **BUILD NEXT** | Accept unambiguous Spanish date strings (incl. `miércoles 11 de noviembre`) in active date mode; reject mismatch/ambiguous dates and preserve short forms. No unsolicited booking from date-only idle input. |
| NM-038 | **DESIGN NEXT — OWNER DECISION REQUIRED** | Document proposed customer overlap/duplicate policy and exact observed cases; offer safeguards/policy options, but do not silently prohibit concurrent appointments or change permitted multiple-booking behavior without approval. |
| NM-039 | **DESIGN NEXT** | Safe evidence/custody workflow for `UNKNOWN_OUTCOME_HELD`, role restrictions, audit and human actions, respecting protected operations. No blind retry or arbitrary manual unblocking. |
| NM-040 | **BUILD NEXT** | Add fourth synthetic customer and/or deterministic stale-offer race fixture without changing existing persistent demo identities or clearing Ana's held case. |
| NM-041 | **VERIFY NEXT** | Automated future-date employee-buffer boundaries and optional browser fixture; 60+15 minutes on 30-minute grid, tenant/employee qualifications; no overlap. Fix only if evidence finds a bug. |
| NM-042 | **VERIFY NEXT** | Server-side stale, superseded, replayed and expired action tests, including manually submitted old action IDs after `menu`/`humano`/restart; no dependency on disabled browser controls. Real WhatsApp UI behavior deferred to provider-gated tests. |
| NM-043 | **BUILD NEXT (small UX correction)** | Explain impossible vs unrecognized date in Spanish, preserving prompt/action recovery. |
| NM-044 | **DEFER** | Previous owner decision to revisit natural-language human escalation later; not in this increment. |
| NM-006, NM-007, NM-010 | **DESIGN NEXT; later parity build** | Map existing reschedule/cancel UX and cancellation wording to vNext durable booking model, with independent safety and owner acceptance gates. Do not pretend to ship full management now. |
| NM-012, NM-014–NM-028 (except NM-027 cross-reference) | **DEFER from this focused correction increment** | Keep original priority/roadmap; no accidental production Meta, reminder, onboarding, admin, owner-settings or cloud work. NM-027 remains a safety dependency for NM-030/039, not authorization to integrate real providers. |

**Exit criteria for this increment:** local code and tests; exact tested SHA; preserved v0.8.1 parity decisions; no new unsafe retries/booking conflicts/tenant leaks; evidence identifying implemented vs designed vs deferred; Claude independent review handoff; owner native Windows runtime and browser regression. Codex should work in scoped PR(s) and must not merge, deploy, contact real providers, alter live data, or provision cloud.

## Suggested implementation batches (not approved roadmap)

**A — Release reliability and policy (P0):** NM-015, NM-017, NM-019, NM-020, NM-023, NM-026, NM-027. These address authentication, sending-account-specific template checks, explicit consent policy, monitoring and graceful failure.

**B — Owner controls and booking quality:** NM-012, NM-014, NM-016, NM-018, NM-022, NM-028. Focus on owner usability, reminders traceability, customer welcome, access controls and lead times.

**C — Research and technical maintenance:** NM-021, NM-024, NM-025. Confirm the actual Meta capacity constraints and improve maintainability and observability.

## Cross-cutting implementation notes

1. **Multi-tenancy:** Configuration, blocked phone numbers, templates, lead times and toggles must all be scoped to the business and associated Meta/Calendar credentials.
2. **Localization:** Customer messages should be Spanish-first for the current pilot, with business-configured texts/fields and room for future locales.
3. **Audit and privacy:** Avoid storing unnecessary customer PII in logs; redact tokens/phone numbers where operationally possible; enforce access controls.
4. **Reminder model:** Existing v0.8.x implementation may already include reminder mechanisms. NM-017–020 and NM-026 represent gaps to verify, not assertions that the entire reminder module is absent.
5. **Human handoff:** A related idea (context-aware unknown-input routing and natural-language escalation) was previously deferred until legacy review/testing completed. Add as a distinct item if formally accepted into the backlog; do not conflate with NM-027's dependency-failure handoff.
6. **No assumptions of completed testing:** Every DONE (reported) entry should eventually include version/commit, test date, test result, and regression coverage.

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | Created NM-001 through NM-028 from original 28-item notes; retained 12 author-reported DONE items; remaining 16 OPEN; proposed priorities and acceptance criteria. |
| 2026-11-05 | Added NM-029 (P1, OPEN) to restore the v0.8.1 short Spanish date/time format uniformly across vNext WhatsApp interactive messages, with Meta label limits and regression coverage. Cross-reference NM-011. |
| 2026-11-05 | Added NM-030 (P1, OPEN) for safe, non-confirming acknowledgments during protected/uncertain booking outcomes, subject to outbound ordering and provider availability. |
| 2026-11-05 | Added NM-031 (P1, OPEN) for showing and managing all future customer appointments, and NM-032 (P1, OPEN) for restoring the three-option `menu` behavior from v0.8.1. Evidence from vNext owner local testing. |
| 2026-11-05 | Clarified NM-031 at owner direction: `menu` displays upcoming appointments and the three options; selection of a specific appointment happens only after `Reagendar / cancelar` and the selected action. No appointment-management selector in initial menu or ordinary booking. |
| 2026-11-06 | Added next-increment BUILD / DESIGN / VERIFY / DEFER classification without changing implementation statuses; scoped menu and human support parity, data display, WhatsApp formatting, date parsing, and safety fixtures; explicitly kept policy/reconciliation/real-provider work gated. |
| 2026-11-06 | Audited the full vNext L2 local functional walkthrough and added NM-033–NM-044 for human support, owner handoff, calendar details, WhatsApp fidelity, date parsing, customer overlaps (decision), protected-operation reconciliation, test fixtures, stale actions, date copy and deferred natural-language human escalation; documented Tests 1–26 with evidence limits and status. |

## How to maintain this register

- When an idea is raised: assign the next ID and add a row with description and proposed acceptance criteria.
- When Codex implements it: add relevant PR/commit/version in a follow-up note and change status to **READY FOR TEST**, not straight to VERIFIED.
- When behavior has been checked in WhatsApp/dashboard: record evidence and promote to **VERIFIED**.
- If a scope decision changes: keep the ID and document what changed in the change log.
- Review unresolved P0s before launching to external paying businesses.
## L2 correction implementation addendum — review branch only

Authoritative input remains **v1.3 at commit
`d1399b90b9c0e3c56e5bdf0fe59f24d925a0d455`**, blob
`b26bca5af25ebd56d7c561cd325a0faed0bfa1ba`. Original rows and owner evidence above
are retained. This addendum is maintained on the implementation branch only;
`docs/feature-register-vnext-20261106` is neither changed nor merged.
See [scope, behavior, designs and safe upgrade](26-L2-FUNCTIONAL-CORRECTIONS.md).
Exact-source results and the independent handoff accompany the Draft PR.

| IDs | Implementation status for this increment | Remaining acceptance |
|---|---|---|
|001,003,004,005,008,009,011,013 |READY FOR TEST — relevant copy/greeting/date/confirmation parity restored/covered;004 accent corrected |Independent review, owner Windows/browser; real-provider copy later |
|029 |READY FOR TEST — shared short formatter and boundary coverage |Real WhatsApp and independent/owner acceptance remain separate |
|031,032 |READY FOR TEST — menu and all upcoming summaries; management explicitly unavailable |Move/cancel flows designed for next authorized stage |
|033 |READY FOR TEST — entry guidance, quiet durable messages, business queue, Menu exit/restart |No staff inbox/notification delivered;034 design pending implementation approval |
|034 |DESIGN PREPARED — role-scoped inbox, audit, ordered reply and notification contract |No owner-reply UI shipped |
|035 |READY FOR TEST — synthetic authorized details; real-provider mapping designed |Phone and service display name not stored; no fabricated metadata or live Calendar claim |
|036 |READY FOR TEST — TS/SQL construction constraints and distinct list rendering |Real Meta provider gate016 remains |
|037,043 |READY FOR TEST — full explicit grammar/mismatch checks and specific error copy |Owner locale/date regression |
|040 |READY FOR TEST — fourth deterministic subject and full-capacity race |Existing identities/Ana's held operation preserved |
|041,042 |READY FOR TEST — automated future-buffer/backend stale-ID evidence |Owner checks; later provider-gated WhatsApp UI observation |
|030 |DESIGNED / BLOCKED — current ordering prohibits safe extra acknowledgment |No acknowledgment bypass shipped; independent contract approval required |
|038 |OWNER DECISION REQUIRED — overlap/duplicate options documented |No new customer-overlap policy implemented |
|039 |DESIGN PREPARED — scoped evidence-only reconciliation workflow |No arbitrary clearing, manual success or blind retry |
|006,007,010 |DESIGN PREPARED — next management parity stage |No move/cancel completion claimed |
|044;012;014–028 |DEFERRED from this increment |027 remains a safety dependency, not provider authorization |

READY FOR TEST is an implementation claim, never VERIFIED or independent approval.
The owner's successful41/41 native runtime evidence belongs to baseline3d8f82b;
corrected-source native Windows acceptance remains pending. Milestone A remains open.

## PR16 independent-review correction addendum — C1–C6

[Claude's GO WITH CONDITIONS](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6700088878)
reviewed source6fa5c18 and independently exercised real baseline data preservation,
rollback and bounded behavior (Node22/PG16; not native Windows). The owner requires
corrections and new Claude acceptance before the Windows upgrade. The authoritative
input remains **v1.3 at d1399b90b9c0e3c56e5bdf0fe59f24d925a0d455**; its documentation
branch is not modified or merged. Earlier addenda are retained as history.

| IDs | Current implementation-branch status | Evidence / remaining gate |
|---|---|---|
|009/032 |READY FOR TEST — C1 conversational name safety and command precedence |Negative no-customer/no-booking cases, valid names, commands after expiry, crash/API/browser; new independent acceptance required |
|033/034 |READY FOR TEST — C2 authoritative support routing/Unicode queue correction |Sealed route metadata,7392-candidate property, legacy identities, backfill/rollback; inbox/replies remain design-only |
|005/031 |READY FOR TEST — C3 future-only ordinary summaries with historical delayed-confirmation facts |Past/delayed/C3 schedules; no history or UNKNOWN clearing |
|001/005/031/032 |READY FOR TEST — C4 approved overview, name re-prompt and useful menu instructions |Unchanged legacy overview differential; no deferred natural-language escalation |
|037/043 |READY FOR TEST — C5 short date-label input and clearer past weekday handling |Round-trip/date-line/year/mismatch/horizon/active-flow checks |
|030/034/035/038/039/044;006/007/010 |Existing design/owner-decision/deferred boundaries retained (C6) |No acknowledgments bypassing holds, staff inbox, new overlap policy or management activation; business-owner simulator authorization only |

See [correction contract and acceptance matrix](27-PR16-CLAUDE-C1-C5-CORRECTIONS.md).
Exact tested SHA, reproducible evidence and new focused Claude handoff accompany
PR16. **Owner Windows upgrade is ON HOLD until Claude accepts the revised source.**
READY FOR TEST is not VERIFIED; full parity, PR15 independent review, native owner
acceptance, Milestone A and all production gates remain open.

### Exact-source C1–C5 regression evidence (implementation branch only)

Tested source **`ba1729983f438f648c6fab2aff9b9fbf22941de0`**, tree
`c197eea0cf62678df90537e87e1c404e4926d5be`. Authoritative original input remains
**v1.3 at d1399b90b9c0e3c56e5bdf0fe59f24d925a0d455**; its branch is unchanged.
Actual Linux Node24.19.0/npm11.9.0/PG17.11 results: **554 full,544 fault,415
concurrency,267 focused,43 runtime and1 real-browser PASS;0 failures**. Runtime
has2 native-only skips; other suites0 skips. Build/typecheck/scope pass; suites
overlap. C2 Unicode property:7392 unique candidates/14784 admissions/0 mismatches
on independent INSERT and deferred UPDATE paths. [Logs, environments, hashes and
acceptance mapping](../../vnext/evidence/pr16-c1-c5/README.md) and
[focused Claude handoff18](reviews/18-CLAUDE-PR16-C1-C5-REVERIFICATION.md).

009/032,033/034,005/031 and037/043 remain **READY FOR TEST**, not VERIFIED.
The corrected source was not executed natively on Windows by Codex; owner's
baseline3d8f82b41/41 is separate evidence. **Owner upgrade stays HOLD until Claude
accepts this revised source**, followed by fresh native45-case runtime and browser
acceptance. C6/Ana, production restrictions and all design/deferred statuses remain.

## Controlled capacity fixture — NM-040 / NM-042 / owner Test17C

Scope is the [complete owner request6725118485](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6725118485).
The owner reports45/45 native Windows runtime PASS,008+009 upgrade, restart
persistence and the protected Ana case preserved. This supersedes the earlier
upgrade HOLD as owner-reported evidence, not a native run by Codex. The particular
four-customer full-capacity browser scenario remains inconclusive until this
isolated fixture is independently run by the owner.

| Item | Implementation-branch status | Acceptance boundary |
|---|---|---|
|NM-040 / Test17C |READY FOR TEST — dedicated disposable four-known-customer/two-qualified-employee browser fixture; future09:00 slot,60-minute service,15-minute buffer; separate marked directory,instance,database and ports |Exact-source backend/browser evidence and Windows walkthrough accompany PR16; owner browser acceptance PENDING |
|NM-042 / Test17C |READY FOR TEST — preserve actual Customer4 displayed action/reply/revision/expiry; explicit local-only stale selection uses unchanged POST /api/message handler; SQL-derived counts/ranges; replay/crash/restart/race and fresh-capacity control |No new booking validation or production logic; prior forged-action regressions retained. Browser greying alone is not evidence. |
|NM-045 — omit appointment summary upon human-support entry |OPEN — next separate owner-requested correction scope |Not implemented or authorized as part of this fixture. Existing support behavior preserved. |
|NM-009/032 residual C1 name collection |PARTIALLY MET / NOT VERIFIED — independent Claude corpus still accepts phrases such as `hablar con alguien` as names |Preserve owner data, including the accidental synthetic booking. Structural name/intent correction belongs to the next separate scope; no extra confirmation step introduced here. |

Authoritative original reference remains **Feature Register v1.3**, commit
**d1399b90b9c0e3c56e5bdf0fe59f24d925a0d455**. Original prefix and documentation
branch stay unchanged. The [independent re-verification6717146528](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6717146528)
accepts C2–C5 and data-safe upgrade with conditions, retaining residual C1 and its
environment limits. No code in src/, SQL migrations, legacy or the owner profile
is changed by the capacity fixture. No owner Test17C PASS, full parity or Milestone A
closure is claimed. All custody/uncertainty/provider/OPS01 and Draft/unmerged gates
remain. No real Meta/Google, GCP or old-checkout activation.
