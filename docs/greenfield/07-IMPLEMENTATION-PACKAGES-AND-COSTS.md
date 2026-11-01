# Implementation packages, effort and operating options

Recommendations, not authorized spend, dates, hosting selection or SLOs. One experienced full-time Node/SQL engineer plus available independent Claude review; operator/security/legal/provider support is additional. Engineer-weeks are effort, not elapsed calendar guarantees. Provider approvals and owner/device review can add unbounded elapsed wait. Use WP1 measured evidence to revise estimates before WP2; no automatic continuation.

## Parity/safety packages

| Package | Deliverables | Effort estimate | Dependency / cost driver | Owner and Claude gate |
|---|---|---:|---|---|
| WP0 (this PR) | Ten planning documents, full evidence-status/acceptance matrices, bounded charter and handoff | Completed planning deliverable; no implementation estimate charged here | Source access and review | Owner reviews charter; new draft planning PR remains unmerged |
| WP1 | Disposable PG schema/roles, signed synthetic admission/seal, permission/status heads, one-use attempt, fake-provider uncertainty/restart/inert restore | **3–5 engineer-weeks**, checkpoint after week 1 protocol/DDL attempt | Critical proof complexity; local disposable tooling only, no managed production service needed | Explicit owner approval of 08; Claude CP1 plus initial CP2, no WP2 before findings disposition |
| WP2 | Real calendar/resource domain, event-aware reads, create/move/cancel adapters, source/target protection and read-only reconciliation | 4–7 | WP1 green; SDK contract and availability/page budget; actual providers still separately gated | Owner package approval; Claude CP2 complete; dedicated provider tests need separate authorization |
| WP3 | Parity reducer/copy/intent/date/name/menu/human, signed durable transport/receipts, transcript comparator | 3–5 | WP1, WP2 for full booking; legacy-UX reconstruction | Owner approval; Claude CP3; no add-on/coexistence activation |
| WP4 | Four reminder schedules/templates/attendance, current permission rules, exact targeting and off/dry-run boundaries | 3–5 | WP2/3; scheduling/race cases and per-account checks | Owner approval; Claude CP4; live sending separate gate |
| WP5 | Independent deployed custody/keys, operator grants/MFA/audit, real restore and old-runtime containment, chosen topology/ops runbooks | 5–9 | Foundation designed WP1; actual archive/HA contracts and staffed incident handling | Owner approves provider/region/budget/custody before provisioning; Claude CP5; safe-write resume independently proved |
| WP6 | All 49 parity comparator outcomes, authorized provider tests, Windows smoke, measured operating cost/capacity, cutover candidate inventory | 3–5 | WP1–5, no critical review findings; owner device and account availability | Claude CP6 + owner explicit acceptance; **no merge/deployment/cutover implied** |

Total **21–36 engineer-weeks** bottom-up initial range, broadly within prior 20–40 envelope; retain 20–40 as uncertainty allowance until WP1 evidence. Do not quote this as a promised launch date or multiply coding speed by an AI factor. No data migration/old-schema compatibility included. Baseline stays operational throughout. If WP1 fails invariant proofs or exceeds its approved bound, stop with measured failure/cost and a revised charter.

CP1 schema/isolation/transactions; CP2 operations/provider uncertainty; CP3 conversations; CP4 reminders/consent; CP5 recovery/security/deployment; CP6 full acceptance. Each has source diff, commands/logs, row/effect-count traces, severity/disposition and owner advance decision. Reviews are not automatic approvals to merge.

## Deferred commercial increments (replace old broad WP7 with bounded charters)

Each estimate is a low-confidence planning range **after P0**, excludes external waiting and pilot operations; dependencies can overlap work, not authority. This is sequencing guidance, not authorization to implement a complete commercial scaffold during P0.

| Increment | Concrete product slice / covered scenarios | Effort | Dependencies / decisive gate |
|---|---|---:|---|
| M0 | Provider feasibility/onboarding contract proof; real coexistence/echo and WABA/Google ownership paths; no customer launch | 2–4 weeks | Can plan parallel with P0; actual test accounts separately approved. G03/G08 feasibility before product promise. |
| M1 | Explicit per-business `permisos`/alias/Accept/Decline, post-booking unknown-only consent, audited in-person evidence | 2–4 | WP4, purpose wording/provider eligibility; C01/C08/O12 race/security review |
| M2 | Single-service catalog, solo-first/team qualifications/hours/preference/assignment and customer-approved reassignment | 4–7 | WP2/3, stable resource foundation; C06/C11/O03/O14; default→team migration tests |
| M3 | Google-first fresh/copy manual events, safe association/review, updates/deletion/intentional overlap; dashboard secondary | 5–9 | M1/M2 and real E08 corpus; O04–09; no-contact fallback always available |
| M4 | 3/6/12 history import, preview/identity; flagged-import intro; native ordinary human chat routing | 3–6 | M0/M1/M3; C09/C10/O02, provider actual echo routing and no-hijacking evidence |
| M5 | Owner daily mobile/combined calendar, staff invites/roles, customer search/verified number change and locations | 5–8 | M2/M3, production authentication/access model; O11/O13/O15/S01–03 |
| M6 | Trial/subscription/caps/grace/suspension/exit, human support/KB and internal administration | 5–9 | Billing provider/tax/payer feasibility, purpose/owner warning, G06 actual dispatch gate; B01/02/A02/03 |
| M7 | Waitlist acceptance, reports/exports/deletion, optional attendance-feedback and provenance | 4–7 | M1–3, privacy/retention/purpose policy; C05/C12/O10/O16, no inferred attendance |
| M8 | Complete commercial/pilot readiness, support drills, measured metrics and owner go/no-go | 2–4 | All launch-required approved scenarios, provider/legal/security/PC evidence; P01 |

Commercial increments sum roughly **32–58 engineer-weeks** at this uncertainty level; not an approved budget or calendar commitment. M7 may be split into independently authorized waitlist, reporting/privacy and survey charters. M0 may reveal a provider constraint that requires a concrete owner product choice; do not preemptively reopen approved journeys.

## Lean infrastructure alternatives

2026-10-31 planning estimates in **USD/month**, no live price quotes obtained. These are order-of-magnitude budget scenarios for a small supervised pilot, excluding tax, Meta/Google charges, labor/support and extra test accounts. Region, actual retention/PITR, HA tier, throughput and vendor plans materially change them. No region/provider/instance count is owner-selected. Confirm current itemized quotes and contracts before provisioning.

| Candidate pattern | Indicative components | Indicative monthly envelope | Recovery/operations tradeoff |
|---|---|---:|---|
| Lean managed PG (e.g. Neon) + always-on app roles + separate object evidence/key service | PG $20–100; app ingress/worker/dispatcher $20–80; archive/keys/telemetry/backups $20–60 | **$60–240** | Lowest initial managed burden; compute suspension/connection limits/PITR/standby durability and independent custody must be verified. No automatic failover claim. |
| Integrated managed platform PG (e.g. Supabase or Render PG) + dedicated app roles + separate recovery custody | PG/base platform $25–150; app roles $25–100; evidence/keys/telemetry $20–70 | **$70–320** | Fewer service interfaces, but backups/HA may cost extra and a common account may not be an independent failure domain. Vendor UI auth does not replace application grants. |
| Managed cloud PG (e.g. AWS RDS) with explicit HA option + app/egress/KMS/object archive | Single-AZ small DB roughly $50–150; HA DB roughly $120–350; app/network $50–180; keys/evidence/telemetry $30–120 | **$130–450 single-AZ; $200–650 HA** | Better documented deployment controls possible; higher network/ops cost. Multi-AZ name alone does not prove no-loss armed admission or old-dispatcher fencing. |
| Single-host SQLite retained POC | Existing accepted installation | No new expense introduced by WP0 | Continue as protected oracle; independent copies/multihost isolation and offsite admissions are not demonstrated. Not the recommended vNext transactional core. |

Recommendation: use disposable local PostgreSQL for WP1; prefer a lean **managed PostgreSQL, fail-stop** production candidate unless actual targets justify HA cost. PostgreSQL offers transactions, composite FKs, exclusion constraints and role tests aligned with the model. The managed vendor/version is a later evidence-backed selection. Do not install a queue/broker, Redis, microservices or four minimum app instances without a measured need. Separate entry points may initially share a small deployment but only dispatcher holds provider effects; compute placement cannot erase independent archive/custody duties.

Charge model: `monthly fixed compute + DB/storage/PITR + evidence PUT/GET/CAS/retention + independent keys/secrets + redacted telemetry + provider billable messages + test/canary numbers + support/on-call`. Estimate provider messages by verified category/country/volume/window and actual payer arrangement; no invented Meta rate or Tech Provider invoice assignment. For budgeting, engineering labor is `weeks × 40 × agreed hourly rate`; that rate is not supplied. Blocked uncertain work costs operator time even when cloud invoices are small.

## Proposed quantitative thresholds (owner has not approved production targets)

| Stage | Proposal / measurement | Approval timing |
|---|---|---|
| WP1 safety | Zero invariant failures in all F01–F30 applicable synthetic boundary variants, DB01–08 and SEC01–04; >=1,000 seeded interleaving schedules across admission/STOP/dispatch; at least two real worker processes and two PG sessions. Keep reproduction seed and shrinking trace. | Part of bounded charter approval; no performance or provider claim |
| WP1 isolation | Zero real provider calls/credentials, zero writes outside candidate synthetic stores, every restore defaults inert; source import/client confinement check green | Required exit invariant |
| P0 comparator | 49/49 requirement cases and all required transcript variants/modes implemented and passed; zero unexpected extra success-flow screen/effect; 100% critical review findings resolved | Before CP6, owner PC acceptance separate |
| Pilot workload proposal | Start measurement with 25 businesses / 250 appointments daily, bursts of 20 authenticated events/sec for 60 sec, hot-tenant skew 50%, 100 due jobs in a minute; revise from actual expected pilot | Owner approves workload before capacity gate, not WP1 |
| Latency proposal | Normal sealed ingress p95 <=2s/p99 <=5s; ordinary successful booking response p95 <=8s excluding deliberate holds; report provider unavailable/error/held separately, never count false success | Validate with actual provider budgets and retry contract before launch |
| Reminder proposal | 99% of eligible healthy-provider submissions <=60s after due; never submit outside current 15-minute allowance; all skips/holds visible. This measures submission, not device delivery. | Owner accepts pilot target with evidence |
| Recovery proposal | Zero loss of **acknowledged recoverable evidence under the verified store failure model**; safe read-only recovery <=4h in a drill. No fixed write-resumption RTO until completeness/old-runtime containment established; holds may last longer | CP5 operating-contract approval |
| Availability/budget proposal | Supervised pilot 99.5% monthly authenticated ingress availability; report booking/reminder success separately. Start budget review at $100–300 infrastructure/month plus usage/support; not a spending authorization | Owner chooses profile/vendor/staffing before provisioning |

No failed safety invariant can be traded against latency, availability or lower cost. If evidence-store outage prevents sealing, return retryable failure and suppress effects; do not “meet SLO” by ACKing unsafe work. Monitor archive seal lag, STAGED age, blocked output/resource age, permission/status revision conflicts, unknown attempts, current template/account failures, reminder eligible/skipped denominators and manual candidate ambiguity. Alerts require named incident responsibility; a metric alone is not recovery readiness.

## Real outstanding choices, at the appropriate gate

Not needed to start synthetic WP1: original interview export; cloud/vendor/version/region/backup retention; actual privacy/legal deletion/residency classes; Meta payer/credit arrangement and billing/tax provider; production workload/budget/support hours and owner warning channel. These become required before their provisioning/commercial activation. DST fold/tzdata and historical-result wording retain source parity until a demonstrated future case requires a change. Operator uncertain-risk release stays disabled in the first slice; any deliberate risky resend later requires a separate scoped design/owner policy and cannot be represented as a safe retry.

No approved functional decision is reopened. If provider evidence contradicts an approved flow, return the exact documented restriction plus concrete alternatives and affected scenario, then seek only that decision.
