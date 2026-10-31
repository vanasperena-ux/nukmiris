# NukMiris — Codex Greenfield Rebuild Handoff
**Prepared:** 2026-10-31  
**Status:** OWNER-READY **PLANNING / WP0 CHARTER PROMPT**, not blanket authorization to write application code or merge/deploy.  
**Target:** vNext greenfield modular-monolith foundation; **P0 = exact accepted v0.8.1 parity plus proved safety**, followed *later* by separately gated commercial MVP increments and a pilot.
**Project repository:** `vanasperena-ux/nukmiris`.

> **Paste the “Codex master prompt” section into Codex.** The repository files are the full specification; the master prompt must never substitute for actually reading them. Record factual conflicts rather than inventing an approved resolution.

---

# Codex master prompt

You are the lead software architect and implementation planner for **NukMiris**, a WhatsApp-first appointment management SaaS for small businesses, initially LATAM, using Meta WhatsApp and Google Calendar. The product owner has completed 178 numbered product decisions plus a 37-scenario persona experience review. **All 37 are approved as design intent.** The application currently operating as a trusted baseline is **v0.8.1**. The owner has selected a greenfield rebuild **as a direction**, not authorized an uncontrolled rewrite, production switchover, customer outreach or an entire commercial MVP in one pass.

## 0. Mission and immediate scope

**Your assignment now is WP0 — read, reconcile, challenge and prepare a bounded implementation charter for the new application, then STOP for explicit owner approval before effect-capable code.**

1. Study the **actual current repository** and specified branches. Inspect the full source and tests where needed; do not take summaries as proof.
2. Prepare a **traceable, staged greenfield rebuild plan** with a proposed architecture, safety protocols, end-to-end parity matrix, technical experiments, acceptance criteria and effort/operating-cost options.
3. Identify real contradictions and open evidence needs, distinguish them from settled owner product choices, and offer a recommended, conservative resolution **without silently changing a requirement**.
4. Propose the **smallest executable WP1 critical safety slice** that would test the new core's most significant architectural risks; show precise file/schema/test scope and a checkpoint for independent Claude review.
5. Deliver planning artifacts and a draft PR, request the owner's **WP1 go/no-go**. **Do not implement WP1 or later packages until owner expressly authorizes that package.**

Do not rename an unfinished prototype “production-ready.” No new commercial workflow is considered implemented by virtue of owner-approved design. Preserve existing baseline operations and protections.

## 1. Mandatory sources and precedence

Read these, in order:

### A — Binding, latest owner product intent (on `planning/persona-journeys-review-2026-10`)
1. `docs/product-review/01-decision-reconciliation.md` — thematic reconciliation of owner decisions (not a source-complete 178-row transcript).
2. `docs/product-review/02-persona-journeys-and-capabilities.md` — **37/37 owner-approved** customer, owner, staff, admin, commercial and pilot scenarios and their chronological review log. Later signed-off updates control earlier review drafts.
3. `docs/product-review/03-step-2a-closure-and-critical-gaps.md` — formal Step 2A closure, amendments and outstanding verification.
4. `docs/product-review/04-step-2b-high-impact-gap-review.md` — Step 2B, including **approved G06 Option A** (suspension pauses all automation, retains appointments, no retroactive sends).

**Important:** The 178 original interview answers are NOT proved present verbatim in `01`. Do not manufacture missing wording or pretend you have audited all 178. Create a reconciliation/coverage worksheet that identifies which original decision evidence you can verify in Git/history and which decisions require additional source material. If original interview evidence is not accessible, label **SOURCE NOT AVAILABLE**, keep the approved 37 scenarios as binding, and request only the missing evidence; do not block inert WP0 documentation unnecessarily.

### B — Protected behavior and implementation oracle (on `main`)
5. `README.md`, `docs/releases/v0.8.1.md`, `backend/BASELINE.md`, `backend/UX_CHECKPOINT.md`, `backend/BOOKING_UX.md`, `backend/README.md`, `docs/ROADMAP.md`.
6. `backend/META_COMPLIANCE_REPORT.md`, `backend/REMINDERS.md`, `backend/REMINDER_TEMPLATES.md`; existing code/tests and example fixtures.
7. The accepted **v0.8.1** baseline/tag, not a random development snapshot. README/BASELINE report **1,089** earlier accepted tests; that is historical evidence and must not be called a fresh execution.

### C — Prior independent architecture challenge (on `architecture/v0.8.1-greenfield-challenge`; **do not merge this branch blindly**)
8. `docs/architecture-challenge/01-Requirements-Baseline.md` (frozen parity requirements).
9. `docs/architecture-challenge/09-Owner-Product-Decisions.md` (historical owner product choices; **later 37-scenario approvals supersede conflicting earlier future decisions**).
10. `docs/architecture-challenge/10-Final-Architecture-Review.md` — prior final recommendation and corrected, **not-yet-proved** safety concerns.
11. `docs/architecture-challenge/11-Greenfield-Requirements-and-Scope.md` — separation of parity, safety foundation and deferred workflows; its older future-product assumptions are superseded where owner has since approved something else.
12. `docs/architecture-challenge/12-Implementation-Readiness-and-Verification-Plan.md` — WP0–WP7 packages, validation experiments, stop/go checkpoints and review process.

Suggested fetch/read method from a local Git checkout: `git fetch origin main planning/persona-journeys-review-2026-10 architecture/v0.8.1-greenfield-challenge`, then `git show origin/BRANCH:path`; confirm each ref exists. Work on a **new isolated, planning-only branch**; do not write to `main`, the active POC branch, or the existing Draft PR #2 without explicit instructions. Refer to existing Draft PR #2 rather than rewriting its approval history.

### Precedence rule
1. **Latest explicit owner approval** controls *product target behavior* (especially the 37 approved journeys, C01/C09/C12/O03/O04/O12 and suspension G06).
2. **Actual accepted v0.8.1 source and validated baseline docs** control *P0 parity*, unless a **separate P0 behavior change** is expressly approved.
3. Prior architecture documents supply **candidate designs and proof obligations**, not automatic authorization to deploy a technology or to override newer owner decisions.
4. Verified provider docs/API behavior controls feasibility; mark any provider claim **UNVERIFIED** until supported.
5. When two sources conflict, record `source A | source B | affected stage | proposed resolution | owner approval required?`. Never erase a conflict.

## 2. Explicit release scope and non-goals

**P0 — Greenfield parity with hardened, tested foundations**
- Preserve *actual v0.8.1* current WhatsApp customer UX, registration, command priority, Spanish menu text, intent/date understanding, timezone/slot rendering and 20-character choice IDs, `menu`, `cita`, `reagendar`, `cancelar`, existing human-support handoff, current message/cancel selectors, and business/calendar/customer scope protections.
- Preserve **two slot options → more options → date selection** as applicable. Read the exact current state machine; do not hallucinate an extra confirmation screen in P0.
- **Critical distinction:** accepted v0.8.1 books immediately upon selecting an offered slot for a recognized customer; a new customer supplies name after time selection. No extra normal booking-confirmation click; rescheduling commits on selecting a new slot; cancellation commits on selecting the target. The later approved C01 scenario refers to the target commercial product and uses “confirms”; this must **not** silently add a new P0 screen. If C01 wording implies a different future click path, flag it explicitly and propose parity-preserving treatment.
- Preserve one default internal staff/resource mapped to the original single-provider behavior; do not introduce customer employee-selection prompts at P0.
- Preserve Google Calendar availability, management, verified mutation behavior, saved restart recovery, attendee/appointment details, normalized dates/Spanish UX and existing reminder timing/status in their **actual implemented modes**.
- Reminders in P0 must remain **off or dry-run by default**; no assumption that template approvals or live permission imply verified production delivery. Carry current permissions/withdrawal safety and strict actual sender/WABA checks.
- Add explicit commercial-ready *structural* identities for business, channel, calendar, resource, customer, appointment origin, participant, permission, operation/attempt, audit and recovery where justified. These structures **do not activate commercial features**.
- No live Meta sends, calendar mutations against production, migrations, new WABA onboarding, cloud deployment or cutover without fresh owner approval.
- No migration of historical POC data is currently needed, but don't delete POC records, secrets or calendar entries.

**Commercial MVP (subsequent separately approved capability increments; design for it now, do not implement its complete UI during P0)**
- Single service per appointment; standard duration and buffer; solo-first operation; optional staff qualifications and employee-specific capacity; returning customer's preferred last completed same-service employee and alternatives; business/location-specific calendars.
- Google Calendar **primary** for owner-added/edited/copied manual appointments; NukMiris dashboard booking secondary. Safe candidate association; ambiguous copied details must never cause wrong-customer messages or implied consent.
- WhatsApp Business App/Cloud API coexistence, ordinary human chat routing and one-time migration introduction **only for flagged imported customers**, when supported and authorized.
- Per-business explicit reminder consent, `permisos`, `da mi permiso` alias, optional in-person auditable consent recorded in NukMiris; **phone in calendar is not consent**.
- Customer waiting list, owner controls/Needs Attention, staff roles, customer records, multi-location, reporting/exports, limited support/knowledge base, billing/trial, privacy/data management, optional survey with self-reported attendance.
- **G06 approved Option A:** after actual account suspension, halt all NukMiris automated bookings, proactive notifications and reminders. Preserve bookings/calendar/data/export rights; warn owner ahead of time; resume **only eligible future** work after verified reactivation, never catch up missed reminders or blindly retry uncertain sends. This must be enforced at dispatch/execution, not merely queue creation.
- **C12** no-show vs auto-completed vs customer-reported attendance are distinct; `No asistí` doesn't silently cancel a past appointment.
- No automatically authorized survey/template sending; test message categorization/permissions and only enable with verified provider eligibility.

**Outside P0 / explicit exclusions**
- No complete owner dashboard, commercial payment provider, multi-location UI, manual event import/adoption pipeline, live human chat coexistence, generic AI assistant, production customer outreach or greenfield replacement of the working POC in the first bounded slice.
- No automatic Google same-ID write retry where outcome uncertain; no eager uncertain WhatsApp resend; no timeout-based uncertain release.
- No speculative worldwide availability, claim of exactly-once external effects, zero-risk failover or guarantees unsupported by experiments.
- No arbitrary cloud-vendor choice, retention period, data residency, RPO/RTO, service objective, budget, payer arrangement or GDPR/Mexican privacy assertion represented as owner-approved. Propose evidence-backed options instead.
- The owner's Windows PowerShell uses `npm.cmd`; Linux/cloud can use `npm`. Existing backend expects Node 24.x; verify before suggesting new runtime.

## 3. Architecture and safety contracts to develop and PROVE

Use the prior recommended **modular monolith with one explicit transactional core** as starting hypothesis. Challenge it only with repository-specific evidence, not a fresh unbounded A/B/C debate. Prefer a lean, cost-conscious managed PostgreSQL design where justified, but do **not** present any database/provider as owner-selected. Provide a cost/recovery/ops comparison with realistic managed alternatives.

Specify and demonstrate:

1. **Authenticated ingress:** exact raw-byte Meta signature verification, verified receiving-number/WABA mapping, dedup scoped to business/provider/channel/message ID and body conflict rejection. ACK and execution require correctly ordered durable independent recovery evidence; an SQL admission without an archive seal must never execute.
2. **Single authority and guarded effects:** fully specified operation state machine and versioned immutable attempt identity; once an outbound send/calendar mutation is armed, no other worker may arm the same effect while the original might still dispatch. A DB lease is not a fence for an HTTP request. Model stopped/frozen processes and stale dispatchers.
3. **Google Calendar mutation:** trusted full business/calendar/event/customer/operation identity; one protected mutation per appointment; safe interval/resource reservations and version checks; on uncertainty hold and verify **read-only**. Never reissue the same write merely because Google response is lost. Distinguish business calendar ownership from employee capacity.
4. **Permission lock and withdrawal:** durable permission/suppression head for known *and unknown* senders; serializable or equivalent lock/revision discipline sharing final send admission with STOP/withdrawal. Consent revocation takes precedence and cannot be undone by restore or stale dispatcher.
5. **WhatsApp outbound:** durable ordering and idempotent local intent; actual external sends cannot be claimed exactly once without proof. Distinguish request accepted by Meta from delivered/read; protect follow-up eligibility and quoted reply/schedule targeting; late, reordered and duplicate receipts must be safe.
6. **Backup/restore/recovery:** restore inert by default, never regenerate identities/effects from incomplete evidence; establish archive integrity and truncation detection, offsite key custody and privileged recovery workflow. Test missing prefix/tail, lost acknowledgements, unsealed records and duplicate batches.
7. **Tenant isolation/security:** tenant-scoped DB grants, resource ownership, externally verified sender mapping, restricted admin/operator roles, audit, encrypted secrets, least privilege, MFA, malicious/forged inbound and break-glass scenarios.
8. **Isolation during coexistence:** new candidate must not share effect-capable Meta/Google credentials, phone numbers, active webhook registrations, mutable calendars, DB or dispatch authority with the running POC by accident. Synthetic first, dedicated safe test resources later with explicit owner consent.
9. **Time and booking correctness:** local-zone DST, date parsing, horizons, services/buffers, existing resource occupancy, race-sensitive booking final availability, stale buttons and duplicate inbound; no overlapping customer bookings or uncontrolled manual overwrites.
10. **Controlled suspension:** the G06 gate suppresses all automation at *execution/dispatch* even if queued before suspension; recovery re-evaluates future-only eligibility, permissions, business status, stale attempts and changed appointments.
11. **Current vs future profiles:** distinguish `parity` and eventual `assistant-add-on` without claiming they produce identical UX. Foundation recognizes human/automated participants, but native chat coexistence remains disabled until Meta/live proof.
12. **Default resource → staff:** stable business-scoped internal resource identity, migration-safe employee IDs, capacity per employee and event-aware shared Google Calendar semantics. Unknown manual attribution must not silently free capacity.
13. **Event origin:** separate app-created managed events from owner-entered/copy candidate events; never infer ownership, consent or customer identity from copied event text, guessed IDs or telephone normalization alone.

Use concrete state-transition tables, schema constraints and transactional pseudocode. Include an exhaustive crash/retry/interleaving matrix and map every invariant to a deterministic or integration test. “We will add tests” is not evidence.

## 4. Required planning artifacts under `docs/greenfield/`

Produce **documentation only** on a new branch. Use stable names and links:
- `00-EXECUTIVE-READINESS.md`: go/no-go conclusion for starting WP1, exact remaining blockers, owner decisions and recommended next stage.
- `01-SOURCE-AND-SCOPE-MATRIX.md`: all sources/commit refs, **P0 parity vs commercial MVP differences**, explicit supersessions and missing evidence. Identify the immediate booking/extra-confirmation UX discrepancy specifically.
- `02-REQUIREMENTS-TRACEABILITY.md`: scenario-by-scenario 37 rows plus evidence from each original owner Decision 1–178 **where verifiable**; mark unavailable decisions, never invent. Include code/test candidate IDs and confidence/source categories.
- `03-SAFETY-PROTOCOLS-AND-THREAT-MODEL.md`: durable ingress, journal, armed attempts, fencing, consent locking, recovery, isolation and explicit stop conditions.
- `04-DATA-MODEL-AND-INTERFACES.md`: proposed entities, keys, constraints, provider adapters, staff/resource/customer/origin foundations, audit and versioning.
- `05-P0-PARITY-CONTRACT-AND-TEST-PLAN.md`: exact observed customer messages/screens/transitions, fixtures, command precedence, timezones, API mocks, unit/integration/fault-injection/PC/manual tests; protect current v0.8.1.
- `06-TECHNICAL-GAPS-AND-EXPERIMENTS.md`: G02–G05/G07–G10, experiment owner, evidence/result/blocked status; no fictional pass results; prioritize uncertainty, archives, consent and dispatcher safety.
- `07-IMPLEMENTATION-PACKAGES-AND-COSTS.md`: granular WP1–WP6 plus deferred commercial MVP increments, dependencies, staffing, managed-cost alternatives and proposed quantitative readiness thresholds (**proposed, not owner-approved**).
- `08-WP1-BOUNDED-IMPLEMENTATION-CHARTER.md`: specific first safety-slice file/DDL/test scope, exact exclusions, measurable exit gates, rollback and independent Claude review checklist.
- `09-INDEPENDENT-REVIEW-HANDOFF.md`: impartial Claude challenge prompt, trace to unresolved Q/SC/E protocols and owner decisions, artifact map, requested evidence and acceptance criteria.

Do not issue a new greenfield implementation PR as if ready to merge. Use a **draft planning PR**. Do not alter, merge, retarget or close the approved review Draft PR #2.

## 5. Test and acceptance discipline

Provide a traceable test plan with:
- **v0.8.1 behavioral oracle**: compare old and new conversation transcripts for P0, including selected-slot immediate booking, name registration timing, menu, intent, Spanish dates, appointment selection, reschedule, cancel, human support and current reminder modes.
- **Unit/state-machine tests**: timezones and DST, permissions, state transition boundaries, stale/repeated command buttons, message classifications.
- **Real database integration tests**: transaction isolation, unique constraints, business isolation, resource capacity, competing arrivals, rollback/restart and state revision.
- **Fault injection**: crash before archive, after DB but before seal, during armed HTTP, response lost, frozen worker after cancellation/STOP, expired Meta window, Google conflicting ETag, duplicate webhooks, database restore gaps, key rotation, old dispatcher recovering late.
- **Provider contract testing**: explicit synthetic→sandbox→controlled-live gate, per-WABA approved template status and sender verification, Meta message status/echoes, Google Calendar event sync/ETag/pagination; no invented guarantees.
- **Security**: forged signature, cross-business ID/candidate match, privileges/grants, MFA/operator access, data leak, PII redaction, malformed/corrupted event.
- **Owner PC smoke test**: Windows `npm.cmd` instructions; same booking/reschedule/cancel/reminder dry-run behavior as accepted baseline, with evidence to distinguish cloud CI from owner device checks.
- **Quality gates**: any failed mandatory safety invariant blocks promotion regardless of aggregate test count. Propose quantitative latency, RPO/RTO, operational cost and reliability targets and ask owner to accept them at the proper stage, not now.

Every test must show `requirement ID → test ID → evidence location → pass/fail/not run → reviewer`; do not claim passed tests until actually executed.

## 6. Codex and independent Claude review cycle

**You (Codex) own proposals and implementation; Claude is an independent skeptical reviewer, not a rubber stamp.** At each checkpoint:
1. State exact intended scope, relevant approved decision IDs, changed files, protocol states, and tests.
2. Provide actual test commands, results, logs, threat assumptions and limitations.
3. Give Claude the **diff + protocol/spec + failure matrix + test evidence**; ask Claude to find safety holes, missing behavior, commercial scope creep and optimistic claims.
4. Classify findings by severity/blocker; remediate and rerun tests; attach reviewer disposition.
5. Seek owner approval before advancing to the next effect-capable package. Do not commit directly to main or touch live credentials.

At minimum use the earlier proposed Checkpoints 1–6 (from architecture document 12). **Checkpoint 1** must prove the foundation's admission/archive/effect protocol with a bounded synthetic path **before** the project expands into full booking UI.

## 7. Required response to the owner

Return, concisely but with complete links:
1. The recommended architecture and whether you consider **WP1 ready for owner approval**, with evidence.
2. A table of P0 functionality to protect vs new commercial capabilities to defer.
3. The **10 highest-risk failure modes** ranked by severity, tied to exact source files/protocol/test.
4. Missing source material, provider verifications and true unresolved decisions, if any.
5. A table of proposed work packages, effort ranges, dependencies, cost drivers and owner/Claude gates.
6. Links to all nine `docs/greenfield/` planning artifacts and the new **draft planning PR**.
7. One explicit request: **approve or revise WP1 charter**. Do not imply authorization from review completion.

**Stop after WP0.** Do not write executable greenfield application code, deploy, manipulate live accounts or send WhatsApp messages. The owner will authorize the first bounded implementation slice after reviewing your charter and the independent challenge.

---

# Owner note — gate to actual coding

The 37/37 functional design approval closes Step 2A. G06 subscription suspension policy is also approved. The older architecture challenge recommends greenfield but marks key safety mechanisms not yet proven and says implementation requires an explicit charter/scope gate. This prompt intentionally authorizes **planning and readiness artifacts, not the implementation itself**. After reviewing the WP1 charter, the owner can issue a **separate, tightly bounded** implementation authorization. The commercial MVP remains further stage-gated.
