# NukMiris vNext — WP0 executive readiness

Prepared 2026-10-31, America/Mexico_City. **WP0 planning complete for owner/independent review. WP1 has not started and is not authorized.** This draft changes only planning documents and verification records under `docs/greenfield/`; accepted v0.8.1 and its working data/providers remain unchanged. Existing Draft PR #2 stays open, draft and unmodified. No merge, deploy, live provider action or production change occurred.

## Recommendation and readiness

Proceed to review a **bounded synthetic WP1**, using a strict TypeScript/Node 24 modular monolith with one explicit PostgreSQL transactional core, independent recovery evidence, and a sole constrained dispatcher. Google remains event existence/time/version authority. Prefer managed PostgreSQL eventually, with **fail-stop recovery initially**; no vendor/version/region/HA tier is owner-selected. Single-use attempts, sealed admissions, persistent permission/status heads and inert recovery are test obligations, not proven capabilities.

The charter is ready for an owner approval decision because it is isolated, concrete, synthetic-only and targets the unresolved mechanisms. **The application is not ready for real effects or replacement.** Independent Claude WP0 challenge is prepared but not performed. The important proofs belong inside WP1 and later CP2/CP5; they are not prerequisites requiring an unbounded architecture debate before a fake-provider experiment.

Fresh verification of the unchanged oracle: **1,089 passed, 27 suites, zero failed/cancelled/skipped**, Node 24.19.0, 229.154 seconds. [Command, limitations and full log](evidence/2026-10-31-v081-baseline-verification.md). This fresh result is separate from the historical owner PC acceptance. It proves neither vNext implementation nor live provider behavior.

## Exact boundary

| Protect in P0 | Design for, defer implementation to commercial increments |
|---|---|
| Current Spanish menu, intent/date understanding, two slots → two more → date; business-zone titles | Service selection, preferred employee/alternatives, waitlist |
| Known customer books at selected slot; new customer supplies name after slot; move/cancel commit on selection, **no added confirmation click** | Post-confirmation unknown-only consent, `permisos`/alias and verbal-consent UI |
| One default internal resource/calendar, own appointments, full ownership, original event identity, current manual busy observations | Optional team scheduling, locations, Google-first manual/copy adoption, dashboard secondary |
| Recorded human handoff/Menu priority; current reminder off/dry-run/timing/permission/status behavior | Native chat coexistence, flagged-import introduction, onboarding/import, optional survey |
| Current-version restart/recovery/diagnostics plus independently proved safety foundation | Daily staff/owner/admin UI, billing/trial/caps/export/privacy, support/KB and pilot |

All 37 scenarios remain approved design intent. Later C09/O03/O04/O12/C12 and G06 supersede older architecture assumptions. G06 Option A is closed: actual suspension stops all automated booking/notifications/reminders, preserves bookings/data/export and resumes only eligible future work after verified restoration; no catch-up or uncertain resend. Foundation gates model this in synthetic tests; no billing product is built in WP1.

## Ten highest risks and required proof

| Rank | Risk | Protocol / acceptance test |
|---|---|---|
| 1 Critical | Restore loses original armed identity and duplicates effect | 03A/B/E; F08/09/17/28/29 |
| 2 Critical | Frozen old dispatcher and successor submit | 03B/C; F11–14, DB06, OPS01 |
| 3 Critical | Withdrawal/suspension races dispatch or restore revives grant | 03C; DB07/08, F12/13/23–27 |
| 4 Critical | SQL work executes without independent evidence seal | 03A; F03–09, DB01/E10 |
| 5 Critical | Copied/forged event sends to wrong customer | 04 trusted tuple/origin; SEC02/04/F30 |
| 6 Critical | Parallel mutator/stale finalizer drops source/target protection | 04 constraints; DB02–05/F10/18/19 |
| 7 Critical | Wrong-tenant runtime/operator/credential authority | 04 grants/context; SEC03/06/E07 |
| 8 High | Failover/rollback revives old dispatch/permission | 03E; REC01/F24–29/OPS01 |
| 9 High | Receipt/generic reply targets wrong schedule | 03D/05 R12; F20–22/P-R04/12 |
| 10 High | Shared-calendar/manual mapping frees occupied capacity | 04/06 G02/G05; DB03/04/E08 |

Exact accepted source anchors and experiment ownership are in [06](06-TECHNICAL-GAPS-AND-EXPERIMENTS.md). No new production defect is inferred from these future-architecture failure traces. Physical late submission by a process paused after its final admission cannot be fenced by a DB lease or token cache. WP1 must expose that limit; deployed containment remains a strict activation blocker, not an assumed guarantee.

## Evidence gaps and true decisions

Original Decisions 1–178 interview wording is **SOURCE NOT AVAILABLE** in examined Git trees/history. [02](02-REQUIREMENTS-TRACEABILITY.md) supplies 178 individual evidence-status rows, verified thematic/scenario attributions, all 37 scenario acceptance rows, and [05](05-P0-PARITY-CONTRACT-AND-TEST-PLAN.md) all 49 frozen parity outcomes. Needed additional source is the original numbered interview export; no scenario reapproval/interview restart is requested, and it does not block synthetic WP1.

Unverified provider facts: current Meta coexistence/account standing/echo correlation/template categories/TTL/payer arrangement; real Google copy/sync/conditional-mutation behaviors and managed archive/HA/egress guarantees. Preserve no-send/unmanaged/read-only/hold fallbacks. No original provider policy was newly certified by this run. Launch choices still needed later: provider/version/region/custody/retention/privacy, billing/tax/payer implementation, staffing/budget/workload and numeric service/recovery targets. No new functional product decision is required now beyond approving or revising WP1's scope/bound. No source conflict currently justifies reopening the 37 approvals or G06.

## Estimated packages and gates

| Package | Proposed effort | Dependency / exit |
|---|---:|---|
| WP1 synthetic foundation proof | **3–5 engineer-weeks** | Owner charter authorization; CP1 + initial CP2; mandatory safety tests |
| WP2 Calendar/resource engine | 4–7 | WP1 green; owner package approval/CP2; providers separately gated |
| WP3 parity conversations/transport | 3–5 | WP1/2; owner approval/CP3; exact comparator |
| WP4 reminders/attendance/permission | 3–5 | WP2/3; owner approval/CP4; live off |
| WP5 deployed recovery/security/ops | 5–9 | Explicit vendor/budget/custody approval; CP5 proof |
| WP6 full acceptance/cutover candidate | 3–5 | All prior gates, authorized provider/PC evidence, CP6; separate launch approval |

Initial parity/safety estimate **21–36 engineer-weeks** (retain earlier 20–40 uncertainty envelope), one experienced engineer plus independent review. Commercial M0–M8 increments are separately estimated at 32–58 engineer-weeks, low confidence, excluding provider/owner/legal waiting. [07](07-IMPLEMENTATION-PACKAGES-AND-COSTS.md) itemizes dependencies, cost drivers and proposed thresholds. Lean managed monthly infrastructure scenarios roughly $60–320; explicit HA cloud scenario roughly $200–650, excluding provider usage/tax/support. These are planning ranges, not current quotes or approved spend. WP1 needs only disposable local tooling.

## Deliverable index

1. [00 Executive readiness](00-EXECUTIVE-READINESS.md)
2. [01 Sources, scope and supersessions](01-SOURCE-AND-SCOPE-MATRIX.md)
3. [02 Requirements traceability: 37 scenarios + 178 evidence rows](02-REQUIREMENTS-TRACEABILITY.md)
4. [03 Safety protocols, threat model and failure matrix](03-SAFETY-PROTOCOLS-AND-THREAT-MODEL.md)
5. [04 Data model, constraints and interfaces](04-DATA-MODEL-AND-INTERFACES.md)
6. [05 P0 parity, exact UX and 49-outcome acceptance matrix](05-P0-PARITY-CONTRACT-AND-TEST-PLAN.md)
7. [06 Technical gaps, experiments and ranked risks](06-TECHNICAL-GAPS-AND-EXPERIMENTS.md)
8. [07 Implementation packages, costs and proposed targets](07-IMPLEMENTATION-PACKAGES-AND-COSTS.md)
9. [08 Bounded WP1 charter](08-WP1-BOUNDED-IMPLEMENTATION-CHARTER.md)
10. [09 Independent Claude review handoff](09-INDEPENDENT-REVIEW-HANDOFF.md)

## Exact next approval

**Approve or revise the [WP1 charter](08-WP1-BOUNDED-IMPLEMENTATION-CHARTER.md): synthetic-only implementation in a new isolated `vnext/` tree and disposable PostgreSQL/fake stores, proposed 3–5 engineer-week bound, CP1/initial CP2 independent Claude review, and stop before WP2.** Full copyable approval wording is in 08. No real provider access, merge, deployment, production migration, cutover or later package is included.

This stop is expressly required by the owner's current instruction and the master handoff §0/§4/§6. Completion of WP0 or review approval does not authorize WP1 automatically.
