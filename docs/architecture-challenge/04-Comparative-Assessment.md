# 04 — Comparative assessment against accepted v0.8.1

Status: Phase 4, performed after completion of the independent [greenfield design](02-Greenfield-Architecture.md). The comparison uses the [requirements baseline](01-Requirements-Baseline.md), accepted source and tests, and documented operational limits. It authorizes no implementation, provider operation or data change.

## 1. Basis and interpretation

The reference is owner-accepted v0.8.1, tag commit `95decc812c228f25171ecfe647200447c83e2e45`. Main at review start, `c439586ca512297c589ddd3bc2ae783b37358b37`, has the same executable code, tests and configuration. All application evidence links below are pinned to the tag. Actual private databases, credentials and infrastructure were not inspected; tests and provider calls were not run for this assessment.

The [release record][release] reports **1,089 passing tests**, zero failures/cancellations/skips, on Linux x64/Node 24.19.0, plus the owner's separately reported passing PC suite/checklist. That is meaningful historical validation. It is neither a new run nor production certification, a throughput benchmark, independent observation of every PC failure case, or proof of live reminder approval/delivery.

The alternative is a proposal: strict TypeScript/Node LTS, Fastify, a modular monolith with separate process roles, managed PostgreSQL, composite constraints/RLS, database-backed jobs, and commercial operating controls. It has no implemented parity, measured performance or validated recovery behavior. Existing complexity receives credit when it protects a requirement; proposed complexity needs an identifiable benefit. File length, module count and diagram appearance are not quality measures.

Each assessed difference has exactly one disposition:

| Label | Meaning |
| --- | --- |
| **Keep** | Keep the existing design decision or safety rule, including an equivalent implementation if another component changes. |
| **Improve** | Improve the existing capability or boundary; replacing the whole application is unnecessary to obtain the value. |
| **Replace** | Replace the specified mechanism with the proposed approach for the stated commercial operating context. This is a bounded replacement, not approval for a complete rebuild. |
| **Investigate** | Additional evidence or an owner decision is required before selecting a change. |

“Before commercial launch” refers to the proposed unattended, independently owned business service. It does not imply that the accepted POC violated its narrower operating assumptions. No commercial scale, budget, availability/latency objective, RPO/RTO or retention target has been supplied.

This coverage map connects all 49 baseline requirement IDs to the comparison; the baseline retains their detailed acceptance criteria and source/test traceability. A grouping is not a claim that every requirement changes.

| Baseline requirement IDs | Main assessment sections |
| --- | --- |
| S01; O01, O04 | 2.1 capabilities; 2.4 reliability; 2.10 operations |
| W01–W02; I01, I11 | 2.3 security; 2.6 tenant isolation |
| W03–W09; I03 | 2.1 parity; 2.2 correctness; 2.7–2.9 organization, testing and maintenance |
| C01–C09; I02, I06–I08, I10 | 2.2 correctness; 2.5 recovery; 2.8 testing; 2.11–2.12 performance/scalability |
| R01–R12 | 2.1 parity; 2.2 correctness; 2.4 reliability; 2.8 testing |
| I04–I05, I09, I12–I13 | 2.4–2.5 delivery/recovery; 2.8 testing |
| O02–O03; Q01 | 2.5 recovery; 2.10 operations; 2.13–2.15 effort, cost and extensibility |

## 2. Assessment across the fifteen requested dimensions

### 2.1 Functional completeness

**Keep — accepted product scope and customer journeys.** The current system implements immediate booking after a selected time/name, bounded Spanish dates/intents, customer-scoped lookup and management, human handoff records, and conditional reminders/attendance. The proposal preserves these outcomes; it adds no justified customer-facing parity advantage. Existing [booking journey tests][booking-ux] and [reminder modes][reminder-modes] are stronger evidence than a proposed interface. Keeping their acceptance meaning avoids accidental extra confirmation screens, automatic permission grants or a fictional staff reply service. Cost: preserve detailed acceptance examples rather than assuming a generic scheduling flow is equivalent.

**Improve — an explicit commercial capability profile.** Support is the runtime default; durable delivery and management are optional; reminders default off and have strict prerequisites ([configuration gates][gates]). These are real modes, not unconditional booking/reminder defects. Commercial activation should require verified receiving-channel routing and durable handling, while retaining intentionally disabled capabilities and dry-run. Value: a deployment cannot accidentally claim durability it has not enabled. Cost: configuration validation and deployment checks; no rewrite or new dashboard is needed.

### 2.2 Correctness

**Keep — operation identity, current checks and atomic finalization.** Booking already rechecks availability and recorded conflicting reservations, disables automatic SDK write retry, verifies returned ownership/times and reconciles the original identity after ambiguity ([booking execution][booking-execution]). Booking/change terminal transactions conditionally update their own operation, invoke reminder hooks and release only matching protection ([booking finalizer][booking-finalizer], [change finalizer][change-finalizer]). The proposal must reproduce this, not replace it with an ordinary job retry. Value: prevents duplicate appointments, false success and lost reminder metadata. Cost: journals and failure branches remain necessary.

**Improve — explicit typed transitions and runtime contracts.** A persisted reducer, discriminated outcomes and validated adapter inputs could make illegal conversation/effect combinations easier to detect than the current dispatcher and JSON sessions ([session storage][sessions], [dispatch priority][dispatch]). TypeScript helps maintainers; it cannot validate provider JSON or prove a transaction boundary. Extract in reviewable slices while retaining protected-entry/Menu/human priority. Cost: conversion and boundary work, plus risk of changing accepted behavior during extraction.

**Investigate — unresolved semantic and provider guarantees.** DST folds, historical-operation replay wording and the business response to independent Calendar conflicts need decisions. Source already distinguishes confirmed-operation replay from fresh reads ([replay/reconciliation][booking-reconcile]); [documented external races][limits] remain possible under both designs. Proposed interval constraints protect cooperating app operations, not arbitrary Google writers. No database choice can remove that external consistency limit.

### 2.3 Security

**Keep — verified ingress and consent protections.** Exact-byte webhook authentication precedes work; persistence failure remains retryable ([webhook ingress][ingress]). Booking OAuth uses loopback, state and PKCE and preserves working authorization on failure ([OAuth helper][oauth]). Retain these properties under Fastify or any framework. Their value is demonstrated; framework replacement supplies no additional authentication guarantee.

**Replace — shared local commercial trust with attributable operator and credential boundaries.** The accepted checkpoint explicitly uses shared test credentials and has no independent-owner authorization/offboarding ([known limits][limits]). For a commercial service, adopt the proposal's scoped operator identity/grants, audit trail, encrypted provider-secret storage, rotation and controlled offboarding. This replaces reliance on possession of local files/terminal access as the administrative trust boundary. Value: limits cross-owner access and makes recovery decisions attributable. Cost: identity/key-service integration, recovery procedures and support burden. This is backend operational security, not a request to build the excluded owner portal.

**Investigate — privacy and legal operating policy.** Redacted diagnostics coexist with deliberate local PII reports ([restart inspection][inspection], [reminder report][reminder-report]); retention is not generally automatic. Agree jurisdiction, access, deletion and recovery/audit retention before claiming compliance. More tables or encrypted storage alone do not establish that policy.

### 2.4 Reliability

**Keep — durable acceptance, ordered output and uncertainty.** The current reliable path stores authenticated input before acknowledgment, persists output groups, preserves unknown sends and accepts only scoped matching receipts ([durable delivery][delivery], [receipt/restart assertions][delivery-tests]). Reminder recovery likewise turns interrupted sends into uncertainty ([reminder recovery][reminder-recovery-source]). Ordinary replies expire at the service-window/session boundary rather than blocking forever ([reply expiry][reply-expiry]). These are current-version requirements; fresh-start assumptions do not remove them. Cost: uncertain work can legitimately require review instead of automatic completion.

**Keep — reminder safety and policy depth.** Current enrollment/changes are transactional and schedule-specific; four elapsed-time occurrences, late/TTL bounds, genuine permission, fresh Utility-template checks, delivered/read-dependent follow-up and exact dispatched-request targeting are substantive existing protections ([reminder enrollment][reminder-enrollment], [dispatch gates][reminder-dispatch], [targeting/attendance][reminder-targeting]). Manual changes invalidate, regenerate or hold work for review; nonresponse never cancels the appointment. The proposal needs equivalent behavior. Value: prevents misleading or unauthorized proactive messages and stale attendance changes. Cost: schedule generations, permission evidence, receipts and review states remain necessary even in a cleaner module structure.

**Improve — permanent-failure visibility and conversation recovery policy.** `claimOutput` treats failed/uncertain predecessors as ordering barriers, while the drainer receives a returned failed send without necessarily throwing ([output/drainer][output-worker]). A Meta 401 can therefore leave that conversation waiting for scoped operator intervention; token access has a separate [read-only check command][connection-cli] but is not checked by [startup][startup]. Surface the affected channel/business and provide a reviewed recovery path while preserving order. Cost: alerts, error classification and explicit policy for a terminal failed reply; automatically skipping the barrier would change semantics.

**Investigate — safe rejection contracts.** The transport maps structured 429/5xx/transient errors to retryable pending ([send classification][send]). Validate against pinned provider contracts that each retry category establishes no possible accepted effect. This is an evidence question, not an asserted unconditional bug. The proposal's “safe retry” wording needs the same proof and must disable hidden adapter retries.

### 2.5 Failure recovery

**Keep — read-only reconciliation and conservative ownership.** A missing insert is not proof of nonexecution; cancellation absence has different meaning ([booking reconciliation][booking-reconcile], [change reconciliation][change-reconcile]). Current ownership rejects live or foreign-host replacement instead of stealing by timeout ([owner protection][owner]). Preserve the same sole-dispatcher rule for Calendar, ordinary replies and reminders in a multiworker design. Database leases fence local commits; they cannot prevent a paused old process from later contacting Google/Meta. Cost: some incidents remain deliberately blocked.

**Replace — the local-only commercial backup/recovery regime.** Current backups verify integrity, preserve journals, prune only after a verified replacement and restore to an unused destination ([backup implementation][backup]). These are valuable safeguards. Local snapshots nevertheless share device risk, exclude credentials and can predate external effects ([limits][limits]). Adopt offsite encrypted backups, defined recovery targets, separate secret recovery and isolated restore drills. A restored snapshot must remain dispatch-quarantined while the snapshot gap and old dispatchers are assessed; apparently unattempted work may have executed after the snapshot. Managed PostgreSQL/PITR supports this approach but does not supply the application recovery procedure. Cost: storage/service charges, drills and potentially unrecoverable gaps beyond the agreed RPO.

### 2.6 Tenant isolation

**Keep — authenticated business authority and ownership checks.** Receiving-number routing has no fallback tenant; customer/session/support access is business-scoped ([routing/storage][routing]). Calendar writes and management reread recorded business/customer/event ownership ([booking finalizer/ownership][booking-finalizer], [change execution][change-execution]). Replacing those checks with a tenant ID supplied by a caller would weaken the design. Value: protects the same phone's separate business relationships.

**Improve — database enforcement of cross-scope relationships.** The synthetic fixture's support/customer reference is not composite ([fixture][fixture]); the documented limitation acknowledges application-level scoping. This is evidence about a fixture and documented model, not inspection of the owner's deployed database or proof of observed leakage. Add matching business/customer constraints to the chosen schema and negative transaction tests. Composite constraints are possible in SQLite too; PostgreSQL is not required merely to close this gap. Cost: schema review and reference cleanup in any implementation.

**Investigate — RLS as a second boundary.** PostgreSQL RLS can reduce reliance on every query author remembering scope, but only with a non-owner role, transaction-local context, safe pooling and narrow maintenance exceptions. Prove these using the actual deployment/driver. Cost: policy/query complexity and privileged background-path auditing; a policy that is bypassed or retains another tenant's context creates new risk.

### 2.7 Code organization

**Keep — one coherent application and explicit reliability seams.** Current scheduling, booking, management, delivery and reminders already have separate modules and injected collaborators ([composition][composition]). The proposal's modular monolith retains this sensible avoidance of distributed transactions between services. Existing transactional reminder callbacks are justified seams, not incidental coupling to remove for a cleaner diagram.

**Improve — transport, conversation and composition separation.** The main entry point also contains storage wrappers, presentation, routing and conversation orchestration ([scoped storage][routing], [dispatcher][dispatch]). Extract an explicit application layer and pure conversation rules so that state priority and external effects can be reviewed separately. Value: smaller reasoning surfaces and clearer dependency direction. Cost: preserving continuation/snapshot/finalizer semantics across moves. Judge the resulting dependencies and failure behavior, never the number of removed lines.

### 2.8 Testability

**Keep — deterministic providers, clocks and real process restart scenarios.** Existing tests preserve data while killing/restarting processes, verify stored reply delivery without repeating Calendar work, and recover uncertain reminder/attendance effects ([process recovery][process-tests], [reminder process tests][reminder-process-tests]). These are substantial assets. A new isolated database per test is acceptable; deleting the database between crash and recovery steps is not. No test-count target is warranted.

**Improve — model, database-policy and contract coverage.** Pure transition tests and generated stale/concurrent actions can complement existing example tests. A PostgreSQL implementation requires tests against real constraints/RLS/claims, including paused workers, pooled tenant context, restore gaps and withdrawal during slow checks. Current tests already assert several of these boundary meanings ([receipt tests][delivery-tests], [atomic CLI recovery][reconcile-tests]); port their requirements, not obsolete internals. Cost: a database test environment and maintained simulators. Gated sandbox/provider contracts remain separate from production certification.

### 2.9 Maintainability

**Improve — explicit state/outcome types and one reviewed finalization path.** Strict TypeScript and runtime schemas can document legal payloads and make refactors safer. Existing normal/CLI reminder finalization is already shared and tested ([finalization tests][reconcile-tests]); keep that agreement while making it easier to see. Value: fewer implicit contracts in JSON/callback wiring. Cost: type tooling and engineering discipline; broad assertions or generic exception handling can erase the supposed benefit.

**Investigate — framework replacement and team fit.** Current Node 24, Express 5, Luxon and provider clients are explicit supported choices ([package][package]). Node/JavaScript is not inherently incompatible with the requirements. Fastify is credible, but no observed defect requires replacing Express; signature/raw-byte correctness must be reverified either way. Team experience and a representative reducer/adapter prototype should decide whether TypeScript/framework conversion earns its cost. A wholesale rewrite also recreates undocumented boundary knowledge that current regressions capture.

### 2.10 Operational complexity

**Replace — personal-PC runtime as the unattended commercial deployment.** Current startup owns workers and timers inside the local process ([startup][startup]); documented limits require the PC online. Use supervised always-on hosting, TLS, protected secrets and a tested deployment/recovery procedure for the proposed commercial context. Value: removes sleep/power/user-session dependence. Cost: hosting, patching, on-call and deployment ownership. A managed container is a proposal, not an already delivered capability.

**Improve — observable, scoped operations.** Existing connection/status/retry/inspection commands are useful and should become authenticated audited equivalents. Add structured correlation, queue/uncertainty/reminder lag metrics, actionable alerts and separate liveness/readiness/provider-degradation reporting. Current HTTP routes and startup logs do not establish these capabilities ([ingress][ingress], [startup][startup]). Cost: telemetry retention, redaction and alert tuning. PostgreSQL jobs avoid Redis's extra recovery boundary but still require indexes, vacuum/bloat monitoring, polling budgets and schema upgrades.

### 2.11 Performance

**Improve — remove avoidable global provider waits while retaining local order.** The queue can logically admit unrelated customers, as [tests show][ordering-tests], but the actual drainer awaits one send/handler at a time ([worker][output-worker]). Bounded parallel work across independent conversations/Calendars could prevent one slow call delaying everyone. Cost: a more demanding ownership/concurrency proof and provider rate limits; per-conversation replies and Calendar mutations must remain ordered. This is a targeted improvement, not evidence that every current deployment is slow.

**Investigate — search-window and storage trade-offs.** Current disjoint 30/15-day search reaches the 365-day bound and carries busy periods across boundaries ([search][search]); a fully booked year can require up to 24 sequential ranges. The proposed 31-day windows reduce base queries but can return more data per query. Benchmark near/far availability, pagination, quotas, cache age and local contention before selection. PostgreSQL introduces network/query overhead; no available benchmark proves lower latency than local SQLite.

### 2.12 Scalability

**Keep — constrained single-host SQLite as a valid small deployment option.** Reliable startup enables WAL, FULL synchronization and busy timeout, with exclusive process ownership ([startup][startup], [owner][owner]). Within that declared topology, transactions and journals are real safety mechanisms. SQLite is not intrinsically unsafe, and no commercial volume requirement has yet invalidated it. Its operational constraints must remain explicit.

**Investigate — replace persistence/claims with PostgreSQL when topology warrants it.** Managed recovery, concurrent workers and horizontal ingress make PostgreSQL attractive. Range guards and resource keys can coordinate app work across hosts, provided uncertain attempts retain protection. Value rises if failover, independent deployment or measured contention requires it; low-volume single-host service may not justify the additional service. Cost: operational/query burden and a new implementation of critical transactions. More workers cannot speed a protected Calendar write or remove Google/Meta quotas and independent-writer races.

### 2.13 Development effort

**Improve — deliver a sequence of independently verifiable boundaries.** Commercial configuration, scoped failure visibility, operator/secret controls and restore procedures can be improved around existing reliable execution before deciding whether to replace its persistence core. A representative vertical slice should prove booking → lost response → restart → reconciliation → reminder metadata/output agreement. Value: makes the largest unknowns reviewable early. Cost: temporary adapter seams and disciplined acceptance tracing.

**Investigate — total replacement cost and release risk.** No historical POC data, old schemas or old button formats need migration in a later fresh separate database. That materially lowers replacement cost. It does not remove functional reconstruction, provider authorization, runtime cutover, rollback, testing or maintenance effort. Never run old and new dispatchers against the same operational ownership without a designed transition. Estimate a tested replacement and selective approach using the same acceptance scope; no credible calendar-duration estimate follows from file count or language choice.

### 2.14 Hosting cost

**Keep — avoid extra distributed infrastructure without measured need.** The proposal correctly starts without Redis, a broker, workflow engine or microservices. The current single application/SQLite has a low infrastructure invoice; its operator labor and outage exposure are still costs. Neither simplicity claim establishes commercial suitability by itself.

**Investigate — region-specific total cost at agreed recovery/capacity targets.** Compare supervised compute, database/standby, backups, secrets, telemetry, provider usage and operator support. Managed PostgreSQL raises fixed charges but may reduce backup/failover labor; self-hosting reverses that trade-off. Obtain quotes after residency, retention, workload and recovery objectives exist. Always-on hosting can be required while a particular managed database tier remains optional. No cost saving or invented SLO is credited to either design without evidence.

### 2.15 Future extensibility

**Improve — stable ports and explicit business/configuration identities.** Clear Calendar/Meta/clock/transaction boundaries and versioned configuration can isolate provider changes and new requirements. Existing injected collaborators and separate scheduling policy already provide useful starting points ([composition][composition], [search policy][search]). Value: easier changes with bounded regression exposure. Cost: keep interfaces close to current use cases; a generic plugin platform would add unsupported abstractions.

**Keep — defer excluded product functionality.** Services catalog, owner dashboard, billing, self-service onboarding and extra channels are not functional advantages of this proposal. Do not implement placeholder services, speculative entities or distributed components to claim extensibility. Necessary operator security does not imply an owner portal. Expand only against accepted requirements, preserving Calendar authority and the separation between appointment, operation, delivery and attendance state.

## 3. Decision implications and evidence that would change the assessment

The existing reliability core is an asset, while commercial identity, operations and recovery controls need substantial work. The proposal offers credible ways to supply them, with higher fixed costs and significant implementation risk. A full greenfield build has not earned a correctness advantage merely by choosing TypeScript, PostgreSQL, RLS or a reducer. Conversely, POC acceptance and a strong regression suite do not establish commercial readiness.

The next decision should compare concrete delivery paths using identical acceptance gates: scoped security/permission tests; safe provider classifications; stale-worker/duplicate/crash scenarios; quarantined restore across external effects; operator exercises; and measured provider/database workload. Evidence favoring broader replacement would include unacceptable single-host recovery exposure, demonstrated contention, or a parity prototype showing lower maintenance effort with all safety cases intact. Evidence favoring continued targeted changes would include acceptable hosting/recovery targets on a supervised single-host design and low-risk improvements that close the commercial gaps without rebuilding execution.

Approval of an architecture is separate from authorization to implement it. This assessment changes documentation only and leaves that selection to the final recommendation and owner review.

[release]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/docs/releases/v0.8.1.md#L1-L23
[limits]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/KNOWN_LIMITATIONS.md#L25-L45
[gates]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/whatsapp-webhook.js#L41-L98
[booking-ux]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/test/booking-webhook.test.cjs#L179-L234
[reminder-modes]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/test/reminder-setup.test.cjs#L99-L128
[booking-execution]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/booking.js#L147-L218
[booking-finalizer]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/booking.js#L53-L91
[change-finalizer]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/appointment-management.js#L189-L206
[booking-reconcile]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/booking.js#L93-L104
[change-reconcile]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/appointment-management.js#L208-L225
[change-execution]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/appointment-management.js#L245-L289
[sessions]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/whatsapp-webhook.js#L136-L169
[dispatch]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/whatsapp-webhook.js#L1133-L1305
[ingress]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/whatsapp-webhook.js#L1416-L1474
[oauth]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/booking-oauth.js#L9-L59
[inspection]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/scripts/inspect-restart.cjs#L40-L103
[reminder-report]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/scripts/reminders.js#L79-L92
[delivery]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/reliable-delivery.js#L113-L240
[delivery-tests]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/test/reliability.test.cjs#L123-L161
[reminder-recovery-source]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/appointment-reminders.js#L175-L203
[reply-expiry]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/reliable-delivery.js#L218-L257
[output-worker]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/reliable-delivery.js#L248-L347
[connection-cli]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/scripts/connections.js#L21-L53
[startup]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/whatsapp-webhook.js#L1480-L1557
[send]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/reliable-delivery.js#L294-L309
[owner]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/reliable-delivery.js#L71-L91
[backup]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/database-backups.js#L7-L84
[routing]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/whatsapp-webhook.js#L100-L205
[fixture]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/test/fixtures/schema.sql#L1-L86
[composition]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/whatsapp-webhook.js#L100-L128
[process-tests]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/test/recovery-webhook.test.cjs#L263-L320
[reminder-process-tests]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/test/reminder-recovery.test.cjs#L85-L112
[reconcile-tests]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/test/reconciliation-reminders.test.cjs#L66-L116
[package]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/package.json#L1-L47
[ordering-tests]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/test/reliability.test.cjs#L109-L121
[search]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/availability-search.js#L5-L75
[reminder-enrollment]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/appointment-reminders.js#L53-L111
[reminder-dispatch]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/appointment-reminders.js#L204-L253
[reminder-targeting]: https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/appointment-reminders.js#L278-L415
