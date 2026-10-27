# 03 — Architecture decision records

Status: **recommended greenfield decisions, documentation only**. These records preserve the independent design in [02 — Greenfield Architecture](02-Greenfield-Architecture.md). Their inputs are the completed [01 — Requirements Baseline](01-Requirements-Baseline.md), the design and the challenge brief. No application source, current architecture, tests, provider accounts or operational data were inspected for these decisions. Comparison with the existing implementation belongs to Phase 4.

Baseline outcomes and invariants are requirements; technologies, module boundaries and operating procedures below are proposals. None has been implemented, benchmarked, failure-tested or certified against a live provider by this exercise. “Prevents” and “requires” describe the intended enforcement to verify in a later implementation. Provider behavior must be established through contracts and gated verification; a proposed adapter interface is not proof that a provider supports a guarantee. No ADR authorizes implementation, migration, deployment or provider changes.

## Decision map

Requirement IDs link through the [baseline traceability matrix](01-Requirements-Baseline.md#9-requirements-traceability-matrix); they identify required outcomes, not an obligation to reproduce its evidence mechanisms.

| ADR | Recommended decision | Requirements principally addressed | Independent design sections |
| --- | --- | --- | --- |
| 001 | Modular monolith with separate ingress and worker roles | S01, I08, O04, Q01 | [1](02-Greenfield-Architecture.md#1-decision-and-planning-assumptions), [3](02-Greenfield-Architecture.md#3-module-boundaries-and-dependency-direction) |
| 002 | Strict TypeScript, supported Node LTS and Fastify boundary | W01, W09, I07, I11, Q01 | [2](02-Greenfield-Architecture.md#2-technology-and-topology-choices), [11](02-Greenfield-Architecture.md#11-verification-and-implementation-shape) |
| 003 | Managed PostgreSQL and explicit reviewed SQL | I01–I08, I12, O03, Q01 | [2](02-Greenfield-Architecture.md#2-technology-and-topology-choices), [4](02-Greenfield-Architecture.md#4-data-and-authority), [6](02-Greenfield-Architecture.md#6-calendar-execution-and-concurrency) |
| 004 | Persisted versioned conversation reducer and offered actions | W03–W09, C04, C07–C08, I02–I03, I05 | [5](02-Greenfield-Architecture.md#5-conversations-and-customer-journeys) |
| 005 | Google truth plus protected app operations and conditional changes | C01–C09, I01, I06, I08, R07–R08 | [4](02-Greenfield-Architecture.md#4-data-and-authority), [6](02-Greenfield-Architecture.md#6-calendar-execution-and-concurrency) |
| 006 | Immutable attempts, explicit uncertainty and read-only reconciliation | I02, I06–I09, I12, O02 | [6](02-Greenfield-Architecture.md#6-calendar-execution-and-concurrency), [7](02-Greenfield-Architecture.md#7-durable-transport-and-ordering) |
| 007 | Durable inbox/outbox with ordered immutable reply groups | W01–W02, W09, I04–I05, I09, I13, O04 | [7](02-Greenfield-Architecture.md#7-durable-transport-and-ordering) |
| 008 | PostgreSQL reminder occurrences and bounded due-time execution | R01–R04, R07–R08, R11, I08, I10, I12 | [8](02-Greenfield-Architecture.md#8-reminders-permission-and-attendance) |
| 009 | Exact reminder targeting, permission evidence and template admission | R04–R12, W05, I01–I03, I07, I11 | [8](02-Greenfield-Architecture.md#8-reminders-permission-and-attendance), [12](02-Greenfield-Architecture.md#12-unresolved-decisions-carried-forward) |
| 010 | Scoped authorization, database defense and private operator access | W02, I01, I03, I11, O01–O04 | [9](02-Greenfield-Architecture.md#9-isolation-operator-access-and-secrets) |
| 011 | Explicit civil time and evidence-carrying external adapters | W01, W08–W09, C01–C03, I07, I09–I10, I13, R02–R03, R10 | [2](02-Greenfield-Architecture.md#2-technology-and-topology-choices), [6](02-Greenfield-Architecture.md#6-calendar-execution-and-concurrency), [11](02-Greenfield-Architecture.md#11-verification-and-implementation-shape) |
| 012 | Managed deployment, recoverable operations and demonstrated failure testing | I04–I13, O01–O04, Q01 | [10](02-Greenfield-Architecture.md#10-operations-recovery-and-commercial-deployment), [11](02-Greenfield-Architecture.md#11-verification-and-implementation-shape) |

## ADR-001 — Keep one application with explicit module boundaries

**Status:** Recommended; workload, team and hosting assumptions remain unconfirmed.

**Problem.** Appointment execution, conversation output and reminder changes must sometimes commit together, while HTTP acknowledgment must remain independent of slow providers. The system needs clear ownership without creating avoidable distributed recovery paths.

**Alternatives considered.** A single process with mixed handlers is initially simple but obscures effects and prevents independent supervision. Microservices with a broker permit separate deployment but require distributed state coordination, additional credentials, contracts and incident procedures. A modular monolith permits explicit local transactions and independent process roles with one release artifact.

**Recommended solution.** Use the modular monolith from design Sections 1 and 3: channel, conversation, scheduling, appointment execution, reminders/attendance, delivery and administration/security modules. Run HTTP ingress and workers as separate roles of one versioned artifact. Domain rules depend inward on value types and ports; application handlers own orchestration. Compose cross-module atomic work through a transaction-scoped unit of work rather than an asynchronous event bus that hides required atomicity.

**Rationale.** Requirements demand durable coordination, not independently deployed services. A shared transactional store keeps verified operation outcome, reminder changes, guard transitions and result replies coherent. Separating process roles prevents provider latency from holding webhook requests while retaining understandable end-to-end ownership.

**Reliability implications.** Database unavailability blocks durable acceptance and yields a retryable webhook error. Provider outages block the affected execution/delivery paths without necessarily blocking ingress. Module ownership forbids arbitrary cross-module table writes. Scaling workers still respects per-conversation order, per-Calendar serialization and provider budgets.

**Security implications.** Authenticated transport context is converted into scoped application input at the boundary. Private operator commands use distinct authorization. Process-role credentials can limit access, although modules within one runtime are not a hard security boundary against a compromised process.

**Maintenance implications.** One dependency graph, migration history and application release reduce coordination work. Enforce module interfaces and keep transport/framework objects out of rules. New modules require demonstrated requirements; no catalog, dashboard, billing or onboarding implementation is implied.

**Operational cost.** Initially requires ingress, worker capacity and PostgreSQL, without a separate broker, cache or workflow cluster. Separate roles add supervision and deployment configuration, but one image reduces packaging work. Modest initial workload and managed hosting are planning assumptions, not measured facts.

**Risks and disadvantages.** Shared database and release cadence couple modules. A badly bounded monolith can become an unrestricted shared-state application. Separate role processes do not provide service-level fault isolation or remove the database as a shared dependency.

**Revisit conditions.** Demonstrated independent scaling pressure, required hard isolation, multiple teams blocked by shared releases, or measured database contention may justify extraction. Extract only after identifying the resulting consistency/recovery contract and its operating owner; anticipated future features alone are insufficient.

## ADR-002 — Use strict TypeScript, Node LTS and a small HTTP boundary

**Status:** Recommended; maintainers' proficiency and supported versions need confirmation before implementation.

**Problem.** The application is dominated by asynchronous provider I/O, structured external payloads and state-dependent outcomes. It needs readable domain rules, runtime validation and maintainable integration tooling without tying those rules to an HTTP framework.

**Alternatives considered.** JavaScript avoids a compilation step but offers weaker assistance for operation/state distinctions. C#/.NET provides strong typing and mature operational tooling, especially for a C# team. Go offers compact deployment and strong concurrency tooling. Express can serve the HTTP boundary with explicit middleware conventions; a larger framework supplies more conventions at additional dependency and abstraction cost.

**Recommended solution.** Use strict TypeScript on a supported Node LTS, Fastify for HTTP, discriminated unions for operation/adapter outcomes and runtime schemas for every untrusted boundary. Keep request objects, decorators and framework lifecycle outside domain/application interfaces. Choose supported package versions during implementation, pin them reproducibly and maintain a defined upgrade process.

**Rationale.** The proposed stack has suitable Google/Meta HTTP tooling and one language across rules and adapters. Type distinctions improve clarity around verified, definitely rejected and uncertain outcomes. Fastify offers a compact schema-oriented boundary; framework throughput claims are not the basis of this decision. Team proficiency may outweigh these benefits.

**Reliability implications.** Type checking cannot establish that a response is valid or that a promise completed safely. Validate runtime data and explicitly supervise asynchronous work; unhandled failures must not lose accepted inputs. Verify exact raw webhook bytes before parsing changes their representation. Provider exceptions cannot default to definite rejection.

**Security implications.** Apply body limits and exact-byte signature handling before trusted state changes. Runtime validation controls shape, size and accepted values; it does not replace authorization. Dependency updates, least-privilege execution and secret redaction remain required regardless of language.

**Maintenance implications.** Narrow ports and value types allow framework replacement without rewriting workflows. Maintain runtime schemas with types to avoid drift. Keep the type layer understandable; elaborate generic abstractions are not required. The team owns Node/package lifecycle monitoring and async error conventions.

**Operational cost.** One toolchain and artifact simplify development and deployment. CI compilation, dependency review and periodic LTS upgrades consume engineering time. No hardware or hosting savings are claimed before workload measurement.

**Risks and disadvantages.** TypeScript types disappear at runtime. Promise misuse and excessive event-loop work can harm reliability. Framework/plugin upgrades may change raw-body behavior. A team substantially stronger in .NET or Go could maintain that alternative more safely.

**Revisit conditions.** Confirmed team expertise, dependency support gaps, measured runtime bottlenecks or organizational platform requirements could change the language/framework recommendation. Preserve the requirement-level outcomes and adapter contracts through any replacement; novelty is not a sufficient reason.

## ADR-003 — Use managed PostgreSQL for operational truth

**Status:** Recommended; provider, region, capacity and cost remain undecided.

**Problem.** Accepted input, operation identity, interval protection, reminders and ordered output need durable cross-record consistency across competing workers and restarts. Tenant relationships must be constrained as well as checked in application code.

**Alternatives considered.** SQLite is credible for an intentionally single-host, supervised installation with appropriate transactions and backups; it is not inherently incapable of durable workflows. Its host ownership, write coordination, failover and restore procedures would remain application/operator responsibilities. PostgreSQL adds managed durability features, row locking, range exclusions and scoped relational constraints. A document store complicates the required cross-record invariants; a broad ORM can obscure concurrency and constraint behavior. Redis alone is not the operational system of record proposed here.

**Recommended solution.** Use managed PostgreSQL, explicit SQL through a small typed query layer and reviewed migrations. Enforce scoped composite foreign keys, provider-identity uniqueness, stable operation/action identities and uniqueness of schedule/kind occurrences. Use actual provider Calendar resource identity for coordination, range exclusions for active interval guards and conditional row updates for revisions/generations. Keep network calls outside SQL transactions.

**Rationale.** The important benefit is expressing local safety properties with transactions and database constraints, plus established backup/PITR facilities. This matches separate ingress and worker roles without introducing another queue durability boundary. It does not move Google appointment authority into the database.

**Reliability implications.** Atomic commits cover accepted batches and, separately, final operation/projection/reminder/guard/reply changes. Conflict handling must translate constraint failures into safe outcomes rather than silently dropping work. Test the real database under rollback, stale reads, contention and restart. Backups/PITR do not make external effects transactional or remove the restore gap in ADR-012.

**Security implications.** Composite scope constraints support application authorization and the row-level security in ADR-010. Use encrypted connections, restricted runtime roles and protected backups. A database owner can bypass protections; do not run ordinary application work as that owner.

**Maintenance implications.** Reviewed explicit SQL makes transaction boundaries inspectable but requires SQL proficiency. Own indexes, migration compatibility, vacuum/storage growth and version upgrades. Separate mutable projections from immutable operational evidence so later cleanup cannot erase unresolved attempts.

**Operational cost.** Managed database compute, storage, WAL/backups and any standby impose fixed charges. They buy services that otherwise require operator labor. Obtain actual regional quotations after capacity, retention and RPO/RTO decisions; no numeric cost superiority over SQLite is established here.

**Risks and disadvantages.** PostgreSQL is a central availability dependency and introduces connection management, schema evolution and operational expertise. Range constraints protect modeled cooperating operations only. Incorrect range/buffer semantics or missing retained reservations can still admit conflicts.

**Revisit conditions.** A deliberately constrained offline/single-host product with an accepted recovery model and cost requirement may justify SQLite. Proven contention may justify partitioning or specialist infrastructure. Any alternative must demonstrate the same transactions, scoping, restart and external-uncertainty behavior before adoption.

## ADR-004 — Model conversation state and offered actions explicitly

**Status:** Recommended; exact command collisions and historical-replay wording remain owner decisions.

**Problem.** Free text, buttons, name entry, human handoff, delayed replies and Menu can overlap. An old choice must not acquire authority because an identifier parses, and replacing a view must not erase a submitted operation.

**Alternatives considered.** Nested handler conditions are easy to start but obscure transition priority. A generic workflow/state-machine framework supplies tooling but can add persistence semantics and complexity unrelated to this bounded conversation. A pure reducer with a persisted versioned state makes the required transitions and priorities explicit without requiring that framework.

**Recommended solution.** Persist semantic conversation state, revision, view expiry and scoped allowlisted actions; use a pure reducer to propose transitions, work and reply specifications. Serialize accepted input by conversation sequence and compare expected revision when committing asynchronous results. Tokens reference exact business/customer/channel/view/purpose/payload/expiry records and confer no authority by possession. A consumed execution action resolves its original durable operation on repeat.

**Rationale.** Explicit rules preserve immediate known-customer booking, name entry only after selection, no extra confirmation, the two-plus-two/date browsing flow and immediate selected move/cancel. A provisional conversation uses authenticated scoped sender identity with no registered-customer reference until valid name entry; persisting it must not fabricate a customer/name. Bind the registered customer and selected operation atomically after validation without asking for the supplied phone. Store original values separately from normalized comparisons. Preserve name validation: 3–120 normalized characters, a letter, no ASCII digit anywhere and no angle brackets; multiword names containing intent words remain data. Recognition alone never executes an appointment mutation.

**Reliability implications.** Menu abandons transient views and human ownership, while retaining confirmed/uncertain work. Default browse/name/clarification expiry is 15 minutes. Expiry enters an expired/recovery semantic context with guidance; it does not automatically route stale input through Main or register a customer. Global explicit navigation, withdrawal, human ownership and protected entry/pending context have documented priority. Slow old reads cannot reinstall replaced views. Reminder actions use current schedule/start validity instead of the browsing timer.

**Security implications.** Every action use checks current authenticated scope, purpose, offered membership, revision and effective capabilities. Foreign, guessed, superseded, hidden-index and expired choices cannot authorize customer registration or appointment effects. Human messages remain scoped records and do not become scheduling commands before Menu; withdrawal still applies.

**Maintenance implications.** Reducer tests and transition tables make UX changes reviewable. Keep conversation, operation, appointment and attendance lifecycles separate. Avoid persisting framework-internal objects or encoding identity into display labels. Exact command-collision behavior must remain visible rather than emerging from parser order.

**Operational cost.** Persists more view/action records than a transient in-memory menu and requires retention policies. It needs no separate conversation service. Generated transition tests cost engineering effort but make stale/concurrent behavior reproducible.

**Risks and disadvantages.** State-machine versioning adds schema and migration discipline. Incorrect priorities can mishandle real names or suppress valid requests. A successful historical operation replay must not imply fresh Google existence; customer wording for that distinction is still unresolved (`U-REPLAY`).

**Revisit conditions.** Revisit the implementation tool if state complexity makes a dedicated library measurably clearer. Revisit name/command or replay policies only with owner acceptance and updated acceptance criteria. Product expansion can add states but cannot silently change current scope, expiry or operation-preservation invariants.

## ADR-005 — Treat Google as appointment truth and serialize cooperating mutations

**Status:** Recommended; provider conditional-write contracts and external-conflict policy require verification/agreement.

**Problem.** A selected slot can become busy, multiple app operations can race on one Calendar and staff can edit events independently. Local operational metadata must coordinate work without pretending to replace actual Calendar truth.

**Alternatives considered.** Blind create/update followed by compensation risks duplicates or loss of the original reservation. Making a local appointment database authoritative changes the required Google-centered product. In-memory locks coordinate only one process. Database interval guards plus fresh provider checks and source-version conditions protect cooperating operations while acknowledging independent-writer races.

**Recommended solution.** Use fresh Google reads for lookup and execution, explicitly selected authorized Calendar mapping, stable event/operation metadata and local appointment projections marked with observation/synchronization state. Admit operations under a Calendar coordination gate and PostgreSQL interval protection. Retain known active app reservations after success as well as unresolved guards; otherwise a stale provider read could admit another app booking. For moves, conditionally transfer existing source protection and represent that operation's source/target coverage as a union to avoid conflicting with its own overlapping ranges. Retain source protection until replacement is proven and patch the same event with its observed version, preserving unrelated fields.

**Rationale.** A Calendar key represents the actual provider resource, including when more than one authorized mapping selects it. Shared coordination does not grant cross-business customer access. Fresh availability accounts for hours, breaks, duration, interval, post-buffer and all-day events. Search is finite through 365 business-local civil days, yields the first three available dates/all their starts and checks directly selected dates. Proposed 31-day windows require at most twelve base windows before pagination; this is not a bound on total HTTP calls.

**Reliability implications.** Incomplete, malformed, failed or budget-exhausted reads mean unavailable, never free/empty. Finalization atomically changes outcome, projection, schedule/attendance, reminders, protection and result reply. Conditional source writes require verified provider support; stop/review if the needed guarantee is absent. Move and attendance writes include the recorded operation/mutation marker in that same conditional event mutation, merging unrelated private metadata. Matching resulting time/title alone is not proof this operation made the change. Cancellation uses the selected owned identity once. Post-write observation and bounded synchronization detect external changes and place conflicts in review without silently deleting either reservation.

**Security implications.** Calendar authorization, ownership, customer and configuration revision are checked before reads/writes and finalization. No implicit `primary` fallback exists. Private application metadata assists reconciliation; it is not permission to manage an unrelated or foreign event.

**Maintenance implications.** A dedicated execution coordinator keeps mutation policy out of conversations/reminders. Range semantics must consistently represent spacing, touching boundaries and source/target ownership. Keep appointment observation, historical operation result and attendance provenance distinct.

**Operational cost.** Fresh reads, pagination and synchronization consume provider quota and worker time. Long-lived uncertainty can reserve intervals and require operator review. Establish actual rate/page/time budgets by measurement; do not weaken complete-read correctness to meet an invented latency target.

**Risks and disadvantages.** Local serialization cannot exclude manual/third-party inserts after the final check. An event ETag protects its source version, not Calendar-wide free/busy. Absolute external no-double-booking is therefore not promised. Provider inconsistencies can conservatively block availability. The commercial resolution policy for detected external overlap is undecided (`U-EXTERNAL`).

**Revisit conditions.** Revisit when verified provider capabilities change, observed quotas require another complete search strategy, or the owner demands exclusive Calendar writer control. A stronger booking guarantee requires a proven enforceable external authority model, not shorter lock leases or more frequent polling.

## ADR-006 — Preserve uncertainty instead of replaying possible effects

**Status:** Recommended safety policy; automatic liveness is deliberately limited by external evidence.

**Problem.** An HTTP timeout or crash after possible dispatch cannot distinguish rejection from successful Google/Meta acceptance. A worker may pause before sending and resume after a local claim expires. Neither a queue claim nor a SQL transaction fences an external provider.

**Alternatives considered.** At-least-once retry is simple but can duplicate sends or writes. Claiming exactly-once execution from local idempotency records overstates the external contract. Time-based guard release restores throughput while risking late effects. Immutable attempts, a sole submission owner and evidence-based reconciliation preserve uncertainty explicitly.

**Recommended solution.** Persist stable operation identity and an immutable attempt containing exact requested effect, external identity, expected version, configuration/generation and dispatch owner before any possible submission. Distinguish verified applied, definitely rejected and uncertain outcomes. For every Calendar mutation and every Meta ordinary reply/reminder send, once an attempt may dispatch another worker may reconcile it read-only but cannot inherit permission to submit merely because a lease expired. Use the same conditional finalizer for runtime and operator reconciliation. Disable implicit SDK, HTTP-client and proxy retries for writes/sends unless a particular response is proven safe under the recorded-attempt policy; one application invocation must not conceal repeated submissions.

**Rationale.** Durable identity handles repeated customer requests and lost replies without assuming provider idempotency. Google-valid event IDs derived from operation identity and recorded private metadata aid insert reconciliation; documented conditional changes protect source versions. These mechanisms do not establish a distributed transaction. Meta acceptance/delivery evidence remains separately correlated to the original outgoing attempt.

**Reliability implications.** Claim epochs fence local commits only. Before replacing a dispatcher generation, supervision must establish the previous dispatcher can no longer initiate a request. Its already issued request may still complete after termination, so uncertainty/protection remains. A bounded retry requires both proof of no effect and proof the prior dispatcher cannot later submit. Paused-worker tests must exercise the instant before the HTTP call. Insert absence alone is inconclusive; matching identity/ownership/exact times can prove insertion. A move requires original identity/change identity/target evidence. Cancellation absence proof must refer to the original owned identity and cannot release newer protection. Late callbacks compare operation, attempt and schedule generation.

**Security implications.** Reconciliation is scoped and read-only; operators cannot invent operations to force success. Separate inspection/reconciliation from deliberate uncertain-message retry authority. Record the latter's actor, reason and concrete duplication warning. It remains an explicit risky decision, not a declaration that the first send failed.

**Maintenance implications.** Adapters return evidence-carrying outcomes rather than booleans. Maintain an operation-specific proof/rejection classification and inspectable attempt history. Durable unknown states and dispatcher supervision need runbooks; do not hide them as generic retryable errors.

**Operational cost.** Uncertainty can block Calendar intervals and outgoing ordering until evidence or a reviewed decision becomes available. Review labor and slow recovery are real costs. Faster automatic retry is not a valid savings if it violates effect safety.

**Risks and disadvantages.** Exactly-once external execution and eventual automatic resolution are not guaranteed. A lost pre-dispatch worker can leave work held even if nothing happened. Killing a process does not cancel a provider request. Safety depends on enforcing exclusive submission ownership in code and operations, not only recording an owner field.

**Revisit conditions.** A verified provider deduplication/fencing contract with suitable identity/retention semantics may permit safer retries. New reconciliation evidence can improve liveness. Relaxing uncertainty requires an explicit product risk decision; elapsed time, TTL, process death or local lease expiry alone is insufficient.

## ADR-007 — Accept durably and send saved output in order

**Status:** Recommended; deliberate uncertain-message retry remains an explicit scoped operator action.

**Problem.** Webhooks repeat, provider message identities may be reused with altered content, result delivery can be interrupted and status events can arrive out of order. Rebuilding a reply by rerunning booking would repeat business effects. An ordinary reply can also outlive Meta's customer-service window while queued.

**Alternatives considered.** Inline processing before acknowledgment ties provider retries to long/uncertain effects. An in-memory queue loses accepted work on restart. A broker plus an operational database adds coordination boundaries. A transactional database inbox/outbox supports acceptance, order and saved results in the same durable system.

**Recommended solution.** Verify exact-byte signatures and authenticated receiving-channel context, then atomically persist supported inbound batches/statuses, original-content hashes and per-conversation sequence before acknowledging. Deduplicate identical customer-message identity/content; quarantine changed content rather than replacing it. Delivery statuses use a separate normalized identity including authorized message/recipient scope, status kind and provider event time/relevant content: sent/delivered/read legitimately share one provider message ID. Commit immutable complete reply groups with results. Deliver saved parts in order and persist each attempt before possible submission using ADR-006, including its sole-dispatcher rule for Meta.

**Rationale.** Transport acceptance, application processing, outgoing API acceptance and device delivery are distinct facts. Stable saved output allows restart without re-executing an appointment. Operation completion enters the conversation as a durable event, so a replaced transient view does not erase work or regenerate prior output.

**Reliability implications.** Storage failure returns a retryable error instead of a false acceptance. An uncertain head send blocks later sends until correlated proof or explicit authorized decision resolves the barrier. Strong receipt evidence is not downgraded by delayed/duplicate statuses; absence proves neither failure nor non-delivery. Retry only demonstrably safe transient failures with bounded attempts/deadlines and jitter. Unsent ordinary replies expire by the applicable 24-hour customer-service-window deadline; browsing/clarification prompts expire no later than their sessions. Persist triggering customer time, receipt time and calculated deadline separately, validating implausible timestamps under the provider contract. Expired unsent prompts remain inspectable history and cease blocking fresh work; expiration does not make an uncertain send safe to repeat or release its uncertainty barrier. Never rerun the Calendar mutation or invent an unapproved proactive fallback to recover output.

**Security implications.** Unknown channels have no default tenant. Receipt correlation matches business, authorized channel, recipient customer, recorded outgoing attempt and provider message identity; a signed webhook or matching provider ID alone is insufficient. Payload size limits, scoped content access and redacted rejection logs protect customer data. A template's existence is not permission to convert an expired reply into a proactive send.

**Maintenance implications.** Distinct input, reply group, attempt and receipt records make diagnosis explicit. Keep permanent failure, safe retry, uncertain outcome and expired eligibility separate. Define policy for advancing after a known permanent head outcome and advance past definitely unsent expired prompts without silently treating uncertain attempts as harmless; every decision remains visible.

**Operational cost.** Database storage, due polling and retained receipt history grow with message volume. Head-of-line blocks add support work and can delay unrelated later replies in that conversation. No separate broker is needed initially; retention must preserve unresolved attempts and targeting evidence.

**Risks and disadvantages.** Durable acceptance does not ensure a successful business action or device delivery. Strict order can reduce responsiveness during uncertainty. Meta may provide no conclusive reconciliation for an unknown send. Old ordinary replies may expire even when their underlying booking succeeded.

**Revisit conditions.** Measured queue contention or independently operated transport consumers may justify a broker, while preserving database acceptance/result atomicity. Verified provider reconciliation can improve unknown-send handling. A different ordering or expired-reply policy requires explicit acceptance and failure-scenario evidence, not an automatic retry switch.

## ADR-008 — Schedule reminders as durable occurrences in PostgreSQL

**Status:** Recommended; post-activation eligibility conservatively follows intent creation (`U-ACTIVATION`).

**Problem.** Restart must not lose timers, reset deadlines or resend attempted reminders. Appointment changes must invalidate old work atomically, and follow-up depends on delivery evidence for the applicable request.

**Alternatives considered.** In-process timers lose schedule/attempt context at restart. Cron scanning only Calendar cannot reconstruct dispatch history, permission or original activation intent. Redis queues add another durable boundary; a workflow engine offers timer/history tooling with extra operational and learning cost. PostgreSQL occurrences align scheduling with required local transactions.

**Recommended solution.** Persist unique `(current schedule, reminder kind)` occurrences and outcomes; use indexed due-time polling with `SKIP LOCKED` claims. Notifications may wake workers but are never the durable trigger. Enroll only verified managed bookings whose intent was created after explicit activation, without import/backfill. Finalization and eligible reminder changes commit together, including operator reconciliation. Rotate schedule identity after successful moves and invalidate old pending work/actions.

**Rationale.** There are four bounded occurrence kinds, not a general workflow platform requirement: start minus 168, 24, 22 and 2 elapsed hours. Enroll only strictly future instants; the follow-up also requires its request to have been enrolled. The same durable store can coordinate booking outcomes, schedule generations and delivery evidence without distributed queue transactions.

**Reliability implications.** Claims permit work selection, not permission to replay a possible send. Recheck Google, schedule/start, configuration, mode, permission, actual templates and targeting prerequisites before dispatch. Submit from due through fifteen minutes late, strictly before start; skip older pending work. Follow-up needs correlated delivered/read proof, not API acceptance. Final remains eligible after confirmation/nonresponse. Observation failure blocks sending. Manual unconfirmed movement regenerates future work; confirmed movement/lost ownership enters review; deletion stops it. An armed external attempt remains subject to ADR-006 even after schedule invalidation.

**Security implications.** Each job retains authenticated business/customer/channel and mapping identity; a due timestamp alone grants nothing. Off/dry-run/live are separate policies. Off performs no reminder enrollment, processing or sending, including already queued occurrences, and preserves history. Dry-run can observe/enroll/preview once but cannot proactively send, request approval or mutate Calendar attendance. Live never auto-enables prerequisites.

**Maintenance implications.** Inspectable typed occurrences avoid opaque timer state. Keep previewed, skipped, uncertain, accepted and delivery facts distinct. Maintain indexes and retention with actual workload measurements. A schedule-generation predicate must be checked in runtime and operator finalizers alike.

**Operational cost.** Polling adds database load; batch sizes, worker count and provider budgets require measurement. The design avoids another queue service but still requires database operations and lag/skip alerting. Long provider outages cause intentional skips rather than unlimited catch-up traffic.

**Risks and disadvantages.** PostgreSQL is both operational database and queue; contention can affect both. Due-time claim expiry cannot safely rearm external dispatch. Correct skipping means some reminders never send during downtime. Neither the late allowance nor provider TTL guarantees device arrival before start.

**Revisit conditions.** Measured sustained contention, richer timers/compensation workflows or a supportable managed workflow service may justify another scheduler. Its adoption must preserve atomic enrollment/invalidation, occurrence uniqueness, unknown-send protection and same-database restart tests. The activation interpretation changes only after owner decision.

## ADR-009 — Bind reminder responses exactly and gate proactive sends on evidence

**Status:** Recommended; historical generic-reply ambiguity remains intentionally conservative (`U-GENERIC`).

**Problem.** A customer may see several old reminders, withdraw permission during a slow provider check or reply after a schedule changes. Neither template approval nor the newest reminder establishes consent or the intended appointment.

**Alternatives considered.** Confirming the newest appointment from generic “Sí” is convenient but can target the wrong schedule. Expiring all ambiguity at provider TTL confuses delivery eligibility with message visibility. Inferring permission from booking or attendance is unsupported. Exact request binding plus permission/template evidence preserves the required behavior without adding a new customer flow.

**Recommended solution.** Bind specific action tokens and quoted provider IDs to an actually dispatched request, exact business/customer/event/current schedule and before-start validity. Invalid/stale/foreign quotes never fall back. Allow supported generic text only when targeting is unambiguous and conversation priority permits; historical accepted/uncertain visible requests remain possible ambiguity regardless of age/TTL. Ask for the existing specific button when proof is insufficient. Route attendance writes through the execution coordinator.

**Rationale.** Exact targeting separates customer intent from display order and current schedule identity. Confirmation appends the app-owned ` — Confirmada` segment once, preserving owner suffixes/event fields; uncertainty cannot produce success. Reminder rescheduling opens the existing flow for that appointment, suppresses follow-up, retains original reservation/final and restores prior attendance on abandonment while retaining response evidence.

**Reliability implications.** Dispatch requires genuine attributable permission evidence and actual approved Utility assets for the business's WABA/number, matching language/content/variables/actions and safe metadata TTL. Recheck after slow provider checks. Serialize permission changes with admission; an accepted withdrawal durably establishes a barrier checked before later proactive admissions, even while older work is checking providers. An inbox row alone is insufficient unless admission observes that barrier. Already admitted/accepted external sends may complete and cannot be recalled. Follow-up requires matching delivered/read evidence and no confirmation/change response; nonresponse never cancels a reservation. Confirmed manual changes enter review rather than silently rewriting provenance.

**Security implications.** Permission evidence records scoped identity, occurrence/recording times, source, exact wording, evidence reference and recorder. A grant requires an existing registered scoped customer and past/current evidence occurrence time. Older imported grants cannot override withdrawal; conflicting evidence reuse is rejected. Withdrawal works before registration and in human mode, without cancelling appointments. Pre-registration withdrawal binds authenticated scoped sender identity and continues suppressing a later registered relationship without fabricating a customer. Booking, notice, channel identity, attendance, activation and approval are not opt-in. Exact template contracts and no proactive free-form fallback prevent unauthorized substitution.

**Maintenance implications.** Centralize targeting and admission rules so webhook, worker and operator paths cannot differ. Retain title-segment provenance and visible-message ambiguity evidence. Live promise text appears only with effective permission and future pending work; dry-run does not certify approval. Initial `es_MX`, approved copy and separate 25-character template-button rules remain explicit contracts.

**Operational cost.** Permission/template readiness checks and historical targeting records consume quota, storage and review time. Missing evidence suppresses sends and can require business follow-up outside this product. Template fees and provider status changes are separate from infrastructure charges.

**Risks and disadvantages.** Conservative generic targeting can reject convenient legitimate replies. Evidence retention conflicts with deletion goals until a safe policy is agreed. Permission can change after a send is irreversibly admitted; template status can change after observation. TTL cannot retract messages or prove delivery time.

**Revisit conditions.** An owner-approved targeting policy with demonstrated safety may bound ambiguity; age alone is insufficient. Changes to Meta contracts, supported languages, permission policy or retention law require contract review and updated acceptance scenarios. New consent collection/customer interactions require separate scope authorization.

## ADR-010 — Enforce tenant scope in every path and constrain operator authority

**Status:** Recommended controls; operator identity provider, grants, region and retention policies are undecided (`U-OPS`).

**Problem.** The same sender can contact multiple businesses, background jobs bypass HTTP handlers and operators can access sensitive recovery actions. IDs, a CLI business argument or a credential file's existence are not authorization.

**Alternatives considered.** Application-only checks are flexible but easily omitted from new paths. Database-per-tenant improves isolation at greater provisioning/recovery cost. A shared database with composite scope constraints, application authorization and row-level security supplies layered protection suitable for the proposed initial topology. Long-lived shared admin credentials are operationally simple but weakly attributable.

**Recommended solution.** Resolve business from authenticated receiving-number/WABA context, never customer-supplied tenant selection. Carry explicit scope through records/ports, enforce composite relationships and apply PostgreSQL RLS with transaction-local tenant context and a non-owner runtime role. Bootstrap tenant discovery through a narrow read-only verified-channel lookup; discover cross-business due work through a restricted function returning only eligible work identity/business. Subsequent processing uses ordinary scoped transactions. Neither handlers nor worker bodies receive ambient owner/`BYPASSRLS` connections. Authenticate private operator commands with short-lived identity/MFA and authorized business grants. Separate read-only inspection, configuration, permission recording, reconciliation and deliberate risky retry privileges; audit each attributable action.

**Rationale.** Layered checks address accidental cross-tenant queries without pretending database policy replaces domain ownership. Shared Calendar coordination remains separate from customer authority. A private CLI meets current operator needs without adding a public dashboard or onboarding portal.

**Reliability implications.** Validate mapping/configuration revisions before saved work resumes. Changed routing/capability blocks incompatible work, rather than executing it under new scope. Restrict global maintenance roles explicitly and test their exceptional paths. Offboarding stops new admission/dispatch, suppresses reminders and inventories unresolved attempts before credential revocation; unknown effects cannot simply be discarded.

**Security implications.** Pooling must not retain tenant context; use transaction-local settings and verify bypass behavior. Narrow privileged discovery functions require fixed search paths, minimal grants and isolation tests. Encrypt provider refresh tokens with managed keys, restrict runtime decryption and exclude credentials from images, repositories, command history and telemetry. Verify actual provider rights and selected Calendar/channel. Validate OAuth state/PKCE where applicable; failed consent preserves working authorization. Revoke operator grants/cached credentials and separately test key recovery.

**Maintenance implications.** Centralize scope construction while keeping checks at every effect boundary. Review RLS and composite constraints with migrations, including background workers and global maintenance. Redacted diagnostics are default; customer-data inspection requires its own grant. Document rotation, access review and offboarding procedures.

**Operational cost.** Identity/MFA, secrets/key services and audit storage have service and administrative costs. Shared tenancy limits infrastructure multiplication; RLS adds development/testing work. Dedicated tenant infrastructure remains an option if commercial isolation requirements justify it.

**Risks and disadvantages.** RLS can be bypassed by privileged roles and cannot isolate against every fully compromised runtime. A shared database increases incident blast radius. Broken context pooling or broad maintenance grants can defeat intended safeguards. Retention/deletion must account for unresolved operations and still-visible reminder ambiguity; no legal policy is invented here.

**Revisit conditions.** Contractual isolation/residency requirements, confirmed threat model, audit findings or tenant scale may justify stronger physical separation. Revisit operator tooling when actual staff workflows are defined. Do not remove application checks merely because database policies exist, or expose a public admin surface without a separate decision.

## ADR-011 — Isolate provider contracts and make time semantics explicit

**Status:** Recommended; exact time library/version and DST-fold product policy remain undecided.

**Problem.** Business-local dates differ from elapsed reminder durations; DST/year boundaries and malformed provider responses can silently change meaning. External APIs evolve and transport exceptions do not encode whether an effect occurred.

**Alternatives considered.** Native ad hoc `Date` arithmetic and direct SDK calls inside handlers reduce initial indirection but mix rules with ambient time, wire shapes and failure behavior. A universal provider abstraction can hide essential Google/Meta semantics. Narrow requirement-specific ports, explicit value types and a maintained timezone-aware library preserve those semantics while making them testable.

**Recommended solution.** Use UTC instants for execution/deadlines and explicit IANA business timezone/civil dates for schedules, parsing and labels. Inject a clock. Select a maintained timezone-aware library or Temporal implementation with pinned/tested timezone data. Keep Calendar, messaging, transaction, clock and secret adapters outside the rules; return verified/definitely-rejected/uncertain evidence. Keep provider-specific conditional write, template, signature, receipt and pagination contracts visible in those ports.

**Rationale.** “168 elapsed hours before start” is not “the same local clock time seven days earlier.” Likewise a 365-day availability horizon counts business-local civil days, not working days or fixed milliseconds. Bounded Spanish grammar and compact display labels require explicit calendar semantics while full instants remain identifiers. Ports permit deterministic simulation without asserting providers are interchangeable.

**Reliability implications.** Reject nonexistent local times and invalid overflow. Proposed conservative DST-fold policy omits ambiguous repeated wall-clock starts until an explicit selectable-instant policy is approved (`U-DST`); do not silently choose an offset. Pin official contract versions for exact-byte signature, complete reads, Google IDs/conditional mutations and Meta payload/status/TTL behavior. Contract tests must establish support; an SDK method or mock alone cannot. Provider failures/incomplete pages remain unavailable checks or uncertainty, not empty/successful results.

**Security implications.** Runtime schemas validate external data before trusted use, and authenticated scopes are explicit port inputs. The messaging adapter must enforce ordinary service-window eligibility and actual template contracts without inventing a per-send TTL parameter. Avoid leaking phone/name/token values in adapter exceptions and fixtures.

**Maintenance implications.** Contract ownership and version upgrades are localized; domain tests use controlled instants and fake provider outcomes. Keep adapters narrow rather than building a general integration platform. Test timezone-data upgrades and schedule policy changes for effects on saved future work instead of silently rescheduling history.

**Operational cost.** Contract maintenance, provider-version monitoring and timezone regression checks require engineering time. Narrow adapters add modest code and dependency review. Better simulation reduces dependence on slow/live tests but does not eliminate separately gated sandbox verification before release.

**Risks and disadvantages.** A fake can faithfully reproduce an incorrect assumption. Library timezone data can differ from provider or host data. Excessively generic ports can erase uncertainty or provider-specific constraints. Conservative fold handling omits some potentially valid appointment instants pending product acceptance.

**Revisit conditions.** Supported native Temporal, library support changes, provider deprecations or verified contract behavior may change adapter/library choices. Owner approval may refine DST-fold selection. Preserve the distinction between instants, civil dates, historical outcomes and current provider observations through any replacement.

## ADR-012 — Deploy managed roles and quarantine restored snapshots until evidence permits resumption

**Status:** Recommended operating design; no commercial readiness, SLO, RPO/RTO or budget is established.

**Problem.** Correct local logic is insufficient if deployment loses accepted work, backups omit operational evidence or restoring old state causes duplicate external effects. Operators need actionable diagnosis and demonstrated recovery, including cases where the backup predates a Google write or Meta send.

**Alternatives considered.** A personal PC or one self-managed VM can reduce invoices but transfers uptime, patching, supervision and restore ownership to the operator. Ephemeral serverless timers/local disk cannot hold this durable work, though serverless ingress could use the same durable backend. Active-active regions or Kubernetes add cost and coordination without an established initial need. Managed always-on application roles and PostgreSQL supply a simpler initial operating base.

**Recommended solution.** Deploy one reviewed versioned image as independently supervised ingress/worker/private operator roles on managed Linux container/VM infrastructure, with managed PostgreSQL, TLS, secret management and encrypted backup storage. Use reviewed compatible migrations, configuration revisions, graceful admission/dispatch drain and rollback rules that preserve armed attempts. Develop on Windows with disposable PostgreSQL via Docker Desktop/WSL2 or an isolated development database, fake providers and an injected clock. No automated development flow targets live accounts.

**Rationale.** Always-on supervision and centralized operational state match unattended reminders and recovery. One artifact limits version combinations. Structured redacted telemetry and private recovery commands make blocked uncertainty inspectable rather than treating all errors as generic retryable failures. Instance/standby count must follow agreed recovery objectives, not a presumed SLA.

**Reliability implications.** Back up coherent operational state, including inbox/outbox, attempts, reminders, permission and audit evidence, with managed snapshots/WAL/PITR, encrypted offsite copies, integrity checks and isolated restore drills. Prune only after a newer viable copy is verified. Credentials/keys/configuration require separate tested recovery. A restored database starts **dispatch-quarantined**, isolated with sends/Calendar writes disabled and a new recovery generation; stop old dispatchers, recognizing already issued requests may still finish. The generation fences no external provider. Determine the snapshot-to-incident gap from WAL, surviving audit/log evidence and providers. Reconcile known original attempts read-only. A restored “not attempted” row may have been dispatched after the snapshot; it cannot be trusted as permission to send/write. Orphaned Calendar metadata is review evidence, not a manufactured original operation. Meta may provide no proof a missing send never happened. If missing identities, intervals or recipients prevent identifying effects, hold the entire potentially affected Calendar/business dispatch scope; if those scopes are unknown, retain whole-service quarantine. Known-record reconciliation alone cannot justify resumption. Reopening requires recovered evidence or an attributable owner-approved decision accepting the specific unresolved effects and resulting duplicate/conflict exposure. Restore cannot undo provider effects, and data beyond the chosen RPO is not promised recoverable.

**Security implications.** Recovery copies remain isolated and access-controlled; provider credentials must not accidentally activate a drill. Redact customer data by default, encrypt backups and audit evidence access. Distinguish tenant-scoped readiness/provider degradation from global health. No capability or reminder mode is implicitly enabled by restore/deploy; rotation and offboarding controls remain effective.

**Maintenance implications.** Maintain runbooks for unknown effects, blocked output, backup/restore, key recovery and incompatible configuration. Monitor accepted-input age, outbox head age, uncertainty, due lag/skips, review states, provider limits, database saturation and backup age, with owner-approved thresholds. Test requirements, not counts: pure rules, model transitions, actual PostgreSQL constraints/RLS/concurrency, deterministic provider simulators, contract checks and end-to-end acceptance. Crash before/after each local commit/network boundary, restart against the **same** database and exercise stale paused dispatchers. Restore tests explicitly include missing post-snapshot external effects and unresolved gaps. No tests are run or implemented by this document.

**Operational cost.** Budget compute + database/standby + backups/WAL + secrets/telemetry + provider usage + support labor. Replicas and standby improve recovery at higher fixed cost; self-hosting trades invoice savings for labor/on-call burden. Region, retention, capacity and actual vendor quotations are required before estimating totals. Multi-region redundancy is a separate decision.

**Risks and disadvantages.** A database restore can be internally valid while externally unsafe to resume. Unrecoverable gaps may cause prolonged holds and require accepting data loss or message duplication risk explicitly; no procedure can recreate missing evidence by assertion. One region/database remains a failure domain. Graceful shutdown is best effort; correctness still relies on durable attempts and supervision. Tests/sandbox checks do not certify live policy approval or prove all failures impossible.

**Revisit conditions.** Agreed volume/SLO/RPO/RTO/residency/support targets, measured incidents, restore-drill evidence or cost quotations may justify replicas, standby, different hosting or regional recovery. Commercial launch requires acceptance of unresolved product/security/operating decisions and demonstrated requirement/failure coverage. A cleaner design diagram or higher test count is not sufficient evidence.

## Assumptions and acceptance boundaries

The following remain open rather than being silently converted into approved requirements. They are carried from [baseline Section 8](01-Requirements-Baseline.md#8-explicit-unresolved-decisions-and-exclusions) and [design Section 12](02-Greenfield-Architecture.md#12-unresolved-decisions-carried-forward).

| Open item | Conservative proposal preserved here | Evidence/decision needed before relying on it |
| --- | --- | --- |
| Initial workload/operating model | Modest workload, one region, available operator, managed services acceptable; Windows development/Linux hosting. | Owner/team confirmation, measured capacity and provider budgets; no throughput/availability commitment yet. |
| U-NAME / U-COMMAND | Preserve current bounded name validation, reject any ASCII digit, retain original text and exact navigation priority. | Accept exact command-collision behavior; no surname/legal-identity requirement inferred. |
| U-DST | Reject gaps; omit repeated ambiguous local starts conservatively. | Owner-approved fold policy and deterministic timezone tests. |
| U-EXTERNAL | Serialize cooperating app operations, use verified source conditions, detect independent conflicts and hold for review. | Contract verification and commercial conflict-resolution agreement; no absolute external booking exclusion claimed. |
| U-REPLAY | Report original recorded operation outcome separately from fresh Google lookup. | Owner-approved customer wording/freshness expectations. |
| U-ACTIVATION | Eligibility follows intent creation after explicit activation, without backfill. | Owner clarification if final commit time is intended instead. |
| U-GENERIC | Preserve historical visible-request ambiguity; use existing exact buttons when uncertain. | Demonstrated safe alternative before adding any age cutoff. |
| U-RETRY | Only explicitly authorized/audited operator retry may accept uncertain-message duplication risk. | Scoped privilege/runbook and concrete warning; automatic retry remains forbidden for unknown effects. |
| U-OPS | No invented commercial SLO, capacity, RPO/RTO, budget, region, retention/deletion or staff-handling commitment. | Owner/legal/operations decisions, recovery drills, cost quotations and assigned incident ownership. |
| External contracts | Proposed Google identity/conditional-write evidence and Meta signatures/templates/status/service-window behavior must be verified. | Pinned contract review, deterministic tests and separately authorized sandbox checks; no live certification in this exercise. |

These decisions are reviewable proposals, not a recommendation to rebuild the existing application. Whether their engineering value justifies implementation must be assessed against the current baseline in Phases 4 and 5.
