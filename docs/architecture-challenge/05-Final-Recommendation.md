# 05 — Final architectural recommendation

Status: architecture exercise complete; **proposal for owner and independent-architect review, not implementation approval**. Reference: owner-accepted v0.8.1 at `95decc812c228f25171ecfe647200447c83e2e45`.

## Executive summary

**Recommend selective rearchitecture, delivered in verified stages, while retaining v0.8.1 as the accepted working baseline.** Keep its customer experience and reliability rules. Strengthen commercial security, unattended operation, diagnosis and disaster recovery first. Separate conversation rules from provider execution, then decide how much persistence and worker infrastructure actually needs replacement.

If starting with no implementation, the proposed design is a TypeScript/Node modular monolith with managed PostgreSQL and durable database work queues. That is a credible destination under the stated managed-hosting assumptions. It is not evidence that rewriting the tested application immediately would produce a safer system. PostgreSQL, TypeScript and a different HTTP framework each bring costs and new failure cases to verify.

The strongest existing engineering is the handling of uncertain external results: if Google or Meta may have accepted an action, NukMiris preserves its identity and avoids blindly repeating it. That complexity is valuable. The greatest commercial gaps concern who can administer each business, how credentials are protected, how failures become visible, and how service safely resumes after machine or database loss. These cannot be solved by shortening files or adding a dashboard.

No commercial workload, service level, recovery target, budget, hosting region or retention policy has been agreed. Choose those before committing to an infrastructure tier or promising unattended reliability. Real Meta template approval/delivery and Google attendance behavior also remain separate verification gates; the accepted PC checkpoint does not certify them.

## Reading and evidence

| Document | Purpose |
| --- | --- |
| [01 — Requirements baseline](01-Requirements-Baseline.md) | Technology-neutral behavior, states, uncertainties and 49 source/test-traceable requirement IDs. |
| [02 — Greenfield architecture](02-Greenfield-Architecture.md) | Independent design, diagrams, authority/transaction boundaries, data model, interfaces and verification strategy. |
| [03 — Architecture decisions](03-Architecture-Decisions.md) | Twelve ADRs with alternatives, costs, risks and revisit conditions. |
| [04 — Comparative assessment](04-Comparative-Assessment.md) | Source-grounded comparison across all fifteen requested dimensions, with Keep/Improve/Replace/Investigate decisions. |
| This recommendation | Risk-adjusted selection and a conditional implementation/verification path. |

Phase 1 reconstructed requirements from the accepted source/tests/documentation. Phase 2 was authored separately using that completed specification, without inspecting the existing implementation or following its module organization. ADRs record that design; the detailed comparison followed completion of the independent design. Internal adversarial checks challenged dispatch ownership, scope, reminder targeting and restored-snapshot gaps. They do **not** replace the owner's planned independent second-architect review.

Facts about current code and historical test results are cited in 01/04. Architectural mechanisms in 02/03 are unimplemented proposals. The [accepted release record](https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/docs/releases/v0.8.1.md#L13-L23) records 1,089 passing cloud tests and the owner's separately reported PC verification. This challenge did not rerun application tests, contact providers, inspect private databases or certify production readiness.

## 1. What would be different if built again?

Start with explicit conversation and operation state models, typed outcomes and narrow provider ports. Make business scope mandatory in data relationships and execution boundaries. Persist accepted inputs, immutable external attempts, reply groups and reminder occurrences under clearly reviewed transactions. Treat Google appointment truth, local execution history, attendance and message delivery as separate concepts from the beginning.

Build supervised operation, attributable operator access, secrets, redacted telemetry and quarantined restore procedures alongside the first complete booking slice. Use a modular monolith and one transactional store initially. Avoid a broker, workflow engine and microservices until measured needs justify their additional recovery boundaries. The technology recommendation and credible alternatives are in ADRs 001–003 and 010–012.

## 2. What should be kept from v0.8.1?

Keep the accepted Spanish menu, two-plus-two/date availability flow, bounded natural dates, immediate selected booking/move/cancel, scoped customer identity, name-entry behavior and human-mode priority. Keep the selected business Calendar, timezone rules, compact labels and customer event details. Keep the four reminder kinds, accepted copy/buttons, permission requirements, late allowance, conservative targeting and off/dry-run/live separation.

Preserve the durable journals, stable operation identity, fresh checks, retained conflict protection, conditional changes, unknown-outcome recovery, ordered saved replies and atomic reminder finalization. Retain the deterministic provider/clock examples, actual process-restart scenarios and operator diagnostics as requirement evidence. Port their meaning if internals change; historical formats and POC data need no compatibility layer.

## 3. What are the biggest existing weaknesses?

For the proposed commercial context, the main weaknesses are:

- Administrative trust and provider credentials remain based on the local/shared POC operating model, without demonstrated independently owned business authorization, secret lifecycle and offboarding.
- A personal PC and local backups share power, connectivity and device failure risks. A valid restored database can still be unsafe to resume because providers accepted actions after the snapshot.
- Known delivery failure can leave a customer waiting without an actionable alert. Scoped tools exist, but continuous telemetry, readiness/degradation reporting and incident ownership are incomplete.
- One serial provider drainer can delay unrelated customers. No measured capacity or latency target establishes when that becomes unacceptable.
- Conversation orchestration, presentation and storage/context concerns remain intertwined; application checks bear much of tenant enforcement. These increase change-review effort, without proving an existing leakage incident.

These are evidence-based gaps and risks, not a claim that the accepted flows are broken. Detailed limitations, qualifications and source references appear in 04.

## 4. Which improvements are critical before commercial launch?

| Launch gate | Required evidence before relying on it |
| --- | --- |
| Scoped operational security | Authorized per-business commands, controlled provider grants/secrets, rotation/offboarding, audited risky actions and negative isolation tests. Agree access/retention/residency obligations. |
| Safe commercial configuration | Verified receiving channel, durable acceptance, explicit Calendar and compatible capabilities; no accidental non-durable production bypass or automatic reminder activation. |
| Unattended service and recovery | Supervised always-on hosting, protected backups outside the machine failure domain, separate credential recovery, agreed RPO/RTO and a restore drill that blocks unsafe replay across external effects. |
| Actionable diagnosis | Detect failed channel access, blocked/uncertain work, overdue/skipped reminders and backup failure; assign alert ownership and demonstrate scoped incident handling. Preserve ordering while deciding terminal-failure recovery. |
| Provider and reminder readiness | Verified current contracts and actual business/WABA assets, recorded permission, approved Utility templates/safe TTL and separately authorized live delivery/button/attendance checks. Keep sending disabled until explicitly activated. |
| Demonstrated correctness | Acceptance, tenant, concurrency, crash, delayed-receipt, paused-worker and restoration scenarios pass on the chosen topology. Agree the response to manual Calendar conflicts. |

A particular database, framework or number of replicas is not itself a launch gate. The deployment must demonstrate these outcomes at the targets the owner accepts. A deliberately constrained supervised single-host service may be viable; its failure/recovery exposure must be explicit rather than silently treated as managed high availability.

## 5. Which refinements are optional?

Fastify replacement, comprehensive TypeScript conversion, PostgreSQL/RLS adoption and independent worker roles are useful candidates whose timing depends on the topology, team and measured bottlenecks. Some can become necessary if recovery or multi-host requirements demand them. They are not universally urgent simply because they appear in a clean-sheet design.

Microservices, Redis, a broker, a workflow engine, Kubernetes, multi-region deployment and a generic plugin platform lack current justification. Catalog, dashboard, billing, owner onboarding portal and extra channels remain outside this exercise. Improving presentation/module boundaries should follow concrete maintenance value, not a line-count target.

## 6. Which existing complexities are justified?

Operation journals and immutable identity distinguish repetition from a new booking. Ownership and protection stop a stale callback or worker releasing newer work. Continuations and saved output separate appointment execution from reply delivery. Transactional reminder hooks prevent a confirmed booking and its reminders disagreeing after recovery. Permission evidence, schedule generations, delivery receipts and quote targeting prevent unauthorized or stale reminders.

These mechanisms protect real failure cases. They should become easier to inspect and test, not disappear. Provider uncertainty sometimes requires operator review and reduced availability; no ordinary queue retry or expiring lease supplies external exactly-once execution. TTL limits undelivered-message lifetime, not the visibility of an old message or the meaning of a later reply.

## 7. Rebuild, selective rearchitecture or incremental improvement?

**Select selective rearchitecture, executed incrementally.** Retain tested domain behavior and safety semantics while replacing the bounded commercial trust, deployment and recovery mechanisms identified in 04. Improve application boundaries around them. Prove a persistence/worker vertical slice before deciding whether to replace the current durable core with PostgreSQL.

If PostgreSQL is selected, reimplement its transaction/claim/constraint boundaries deliberately rather than mechanically translating SQL. Use a fresh isolated environment as allowed by the challenge; no POC-record migration or pre-v0.8.1 compatibility is required. That freedom reduces implementation cost, but does not remove the need to verify every current-version crash and repeat scenario.

## 8. Why this choice?

A full rebuild has no demonstrated correctness advantage today and would recreate substantial provider-boundary knowledge. Continuing only small local edits would leave commercial security/recovery responsibilities insufficiently addressed. Selective rearchitecture targets those weaknesses while retaining evidence that already exists.

The greenfield proposal supplies a destination and comparison point, not a mandatory package of replacements. A managed database has meaningful advantages if topology/recovery requirements need them; a framework swap offers much less value unless it improves the team's boundary implementation. Prioritize avoided incidents and maintainable invariants over architectural uniformity.

## 9. What evidence would change the recommendation?

Favor broader replacement if a representative prototype demonstrates full parity and materially lower change/support cost, if the current transaction boundaries cannot meet agreed requirements safely, or if measured contention/recovery targets require multi-host coordination that would be harder to retrofit. Independent security/architecture findings could also change the balance.

Favor narrower improvements if supervised single-host operation meets agreed recovery/capacity targets, scoped security and observability can be added safely, and proposed database/framework conversion costs more without measurable benefit. Actual team proficiency, region-specific total cost and provider contract findings may change technology choices.

The next architect should specifically challenge: whether PostgreSQL/RLS earns its cost; whether the sole-dispatcher design is enforceable under paused processes; whether restoration handles missing operation identities; whether permission withdrawal wins before dispatch admission; whether historical reminder ambiguity is retained safely; and whether the proposed verification is feasible for the operating team.

## 10. What would implementation and verification look like?

This is a possible later work plan, requiring separate approval. Each stage ends with reviewable evidence and a stop/go decision.

| Stage | Work and exit evidence |
| --- | --- |
| A. Agree operating contract | Resolve workload/support ownership, targets, budget, jurisdiction/retention and open `U-*` decisions. Select explicit launch scope and provider sandbox resources. Approve the requirements/ADR changes resulting from independent review. |
| B. Secure and observe the accepted core | Establish commercial configuration, scoped operator/secret controls, permanent-failure visibility, redacted correlation and offsite recovery controls. Reuse accepted execution semantics; verify isolation and operator exercises. |
| C. Prove the hardest slice | In an isolated environment, implement one proposed boundary from signed input through booking, lost provider response, restart, read-only reconciliation, atomic reminders and saved output. Exercise paused dispatchers and a snapshot predating the effect. Compare implementation effort, operational cost and failures with the retained design before selecting persistence/topology. |
| D. Complete selected boundaries | Extract conversation rules, management, reminder targeting and adapters in complete slices. Preserve the 49 requirement outcomes and all capability/mode behavior. If persistence changes, prove real database constraints, pooled scope, claims and conditional finalization rather than relying only on mocks. |
| E. Harden deployment and contracts | Test supervised restarts, credential rotation, provider degradation/quotas, backup/secret restoration, quarantine and incident runbooks. Establish capacity and recovery measurements. Perform separately authorized sandbox/live-provider checks; simulation results alone cannot approve templates or certify delivery. |
| F. Owner pilot and controlled cutover | Owner repeats ordinary WhatsApp booking, new-customer, date, move/cancel, human and restart checks. Then verify permitted reminders/attendance and failure operations. Require explicit activation and one known dispatcher authority per shared provider resource. |

For planning only, allow approximately **8–14 engineer-weeks** for a focused selective program with an experienced full-time engineer, available independent review and no new customer features. A broader persistence/multi-host replacement can add substantial work; re-estimate after Stage C before promising dates. This is a rough effort envelope, not a quote, deadline or approved budget. Meta approval, owner availability, legal decisions and cloud provisioning have separate elapsed time. Stage A/B may be worthwhile without authorizing all later stages.

Verification must combine pure/state-machine tests, real selected-database integration tests, controlled provider simulators, concurrency/fault injection, same-database process restarts, contract checks, capacity/restore drills and owner acceptance. Include two businesses sharing a sender, invalid scopes, replaced views, out-of-order receipts, all reminder boundaries, late old confirmations, withdrawal during checks and missing post-snapshot effects. The existing count of 1,089 is not a target. On the owner's Windows PC, instructions must use **`npm.cmd`**.

Use a separate checkout/environment and fresh database for a later candidate; preserve this baseline and its actual POC data/events. Compare pure outcomes and simulated executions; do not run two live mutation dispatchers against the same resource. Start with reminders off. Before a shared-resource cutover, quiesce baseline admissions/dispatch, inventory its outstanding accepted operations/messages/reminders, and resolve them or keep affected scopes held under an attributable recovery plan before candidate ownership. A fresh candidate database and no historical POC migration do not authorize silently abandoning outstanding external effects. During cutover/rollback, also preserve the candidate's current-version accepted work and attempt evidence. A code rollback is not permission to restore an old database, erase uncertainty or replay effects. If a snapshot gap cannot be reconstructed, hold affected scopes until an attributable recovery decision; there may be no automatic lossless recovery.

## Completion boundary

All five requested documents are delivered on an isolated documentation branch. The exercise reconstructs behavior, proposes an independent design, records decisions, compares it objectively and gives a conditional implementation strategy. Only documentation was added; application code, version, dependencies, configuration, schemas, databases, provider assets/events/messages and `main` were not changed. Static document checks are separate from application test execution. No implementation or production activation is authorized or performed. Stop here for owner and independent-architect review.
