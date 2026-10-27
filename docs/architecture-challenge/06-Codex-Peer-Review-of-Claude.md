# 06 — Codex peer review of Claude, Round 2

## Executive assessment

The two independently developed proposals converge strongly on a TypeScript modular monolith, PostgreSQL, a pure conversation model, durable operational records, Google as appointment authority, and evidence-based recovery. That convergence is useful, but shared assumptions are not proof. Claude adds valuable operational specificity; several stronger safety claims do not follow from the mechanisms described.

The five most consequential findings are:

1. **External submission is not fenced by a PostgreSQL lease.** A worker can pause after its submission marker, lose its lease, and still call Google or Meta. Local fence checks protect SQL commits, not remote effects. C2 §§4.2–4.3, 8.4, 11.3; C4 scenarios 4–5 need a sole-dispatcher protocol, not only expiring claims.
2. **Same-ID Calendar insertion is a useful identity mechanism, not an established exactly-once retry contract.** Google's generated SDK explicitly warns that collisions may not be detected at creation. C1 F-03/S-1 and C2 §9.2 cannot yet justify automatic resubmission after a guessed settle window.
3. **Two convenience policies weaken accepted safety behavior.** A five-minute uncertain-message barrier timeout changes ordering; considering only current reminder candidates can interpret a delayed response to an old appointment as confirmation of its replacement. C1 F-05/U-GENERIC and C2 §§10.1, 11.4 require correction or explicit owner-approved behavior changes.
4. **Restore quarantine is sound, but the archive does not establish complete recovery.** Best-effort ingress export and an operator-command journal do not necessarily preserve outgoing attempt identities, lost withdrawals, or the gap's completeness. C2 §16 and C4 scenario 10 cannot yet demonstrate zero duplicate reminders or zero lost STOPs after arbitrary database loss.
5. **The reservation constraint is plausible and useful, but incomplete as a whole concurrency proof.** The same-appointment exception is intentional and supported in principle by `btree_gist` not-equal semantics. It also admits concurrent operations with the same appointment key. Identity constraints, operation serialization, protected uncertainty and failover guarantees remain necessary.

No winner is declared. These are design-level findings, not observed production incidents. [07](07-Architecture-Decision-Matrix.md) reassesses implementation strategy; [08](08-Questions-for-Claude.md) asks for the missing proofs.

## Evidence, independence and limits

Reviewed all five original PDFs from architecture branch commit `065bdc7`: C1 11 pages, C2 42, C3 9, C4 12, C5 8; **82 pages total**. `pdftotext -layout` extracted every page without replacement characters. Tables and printed Mermaid/ER/sequence listings were read from the originals' extracted text. The raster runtime diagram on C2 p5 was separately rendered and visually inspected; its web/worker/database/archive/KMS/telemetry boundaries inform this review. `pdfimages -list` identified that as the only embedded raster figure. No substantive extraction limitation was encountered; typeset code is a design sketch, not executable proof.

Original Codex 01–05 and Claude PDFs are unchanged. Current source inspection uses accepted commit `95decc812c228f25171ecfe647200447c83e2e45`; this branch's runtime matches it. The separate approved-reminder feature branch, its 1,147 tests and later owner-reported template approvals are **not** substituted for this review's baseline. The accepted baseline has historical evidence of 1,089 tests and owner PC acceptance, not a fresh execution in this round.

No dependencies installed, tests or SQL executed, databases/configuration changed, or live provider APIs contacted. Public Google documentation and PostgreSQL documentation retrieval were attempted and blocked by proxy 403. Existing installed official generated Google SDK material was available, as described below. SQL examples are static proof cases only. No sub-agent review is represented as independent evidence for this round.

## A. Requirements interpretation

### F-series assessment

| Claude item / pages in C1 | Assessment against baseline | Disposition |
| --- | --- | --- |
| F-01 capacity, p3 | Non-overlap of cooperating appointments already follows C01/I06. Capacity-one is a reasonable parity reading; staff/capacity-N is excluded future scope. Exclusive business ownership of a Calendar is a separate policy, not implied by capacity. | Confirm resource semantics; do not add staff allocation. |
| F-02 channel ownership, p3 | Correct unresolved commercial question. Authenticated phone-number mapping is required; who owns WABA/tokens and pays charges is not decided. Per-business authorization does not require one physically distinct token for every business if a properly scoped partner grant is used. | Commercial assumption, not current implementation requirement. |
| F-03 retries, pp3–4 | Correctly identifies a decisive provider dependency, but proposes relaxing a current invariant before proving the dependency. Client IDs already exist in v0.8.1; their existence is not the missing capability. | Reject unconditional retry guarantee; S-1 must establish stronger semantics. |
| F-04 metadata/mapping, p4 | Private event identity is required, but `nm_biz` alone does not authorize this customer/operation. One active business per Calendar matches current configuration policy but is not the only possible greenfield model. | Require full ownership tuple and mapping revision; label exclusivity policy. |
| F-05 uncertain ordering, p4 | I13 refers to definitely unsent expired prompts. It does not authorize letting later replies overtake an uncertain earlier send after five minutes. | Proposed product change, not a clarification. |
| F-06 identity, p4 | Strong and correct: preserve provider sender identity separately from country-specific outbound/display formatting. | Adopt explicit identity/display distinction. |
| F-07 independent streams, p4 | Reminders and ordinary replies have distinct eligibility and sequencing. Interleaving must not erase protected-entry/human priorities or retarget attendance. | Reasonable explicit operating assumption; test races. |
| F-08 late result, p5 | No proactive free-form result after service-window expiry is sound. Delivering the recorded result on a future inbound needs priority/wording decisions, not a new template by implication. | Accept safety; approve presentation policy separately. |
| F-09 no name-entry hold, p5 | Correct parity: selection remains vulnerable until execution recheck; a hold would be a new behavior. | Keep. |
| F-10 configuration revisions, p5 | Good mechanism for O04. Must define changes that invalidate offers versus allow read-only recovery; cannot reinterpret an armed request under new mapping. | Adopt explicit compatibility rules. |
| F-11 handoff, p5 | Correct operational weakness. Recording a handoff is not staff notification or a staffed response service. Read-only queue/age metrics are commercial recommendations. | Adopt operational accountability without adding dashboard/staff messaging. |
| F-12 privacy, p5 | Correct unresolved policy. Export/deletion tools and immutable archives need legal/retention design; they are not already approved parity features. Calendar copies of PII remain external obligations. | Commercial readiness work; avoid claimed legal compliance. |
| F-13 provider standing, pp5–6 | Valuable launch checklist: OAuth publication/token lifetimes, Meta standing, quotas and template ownership. None should be asserted universally without account/app-type-specific evidence. | Adopt verification register. |
| F-14 template changes, p6 | Useful notifications plus fresh checks; notification coverage/latency cannot replace current pre-send approval checks. | Improvement, subject to provider contracts. |
| F-15 timezone, p6 | Gaps/folds and future timezone-rule changes deserve explicit policy. Excluding folds is a proposal, not owner-approved behavior. Updating tzdata alone cannot choose whether an existing appointment keeps instant or wall time. | Keep unresolved policy and test both authorities. |
| F-16 operators, p6 | Correct gap. One–three operators, three roles and second approval are assumptions. Reason/audit/MFA have clear value; on-call coverage is still unpriced. | Adopt threat model; size staffing separately. |
| F-17 copy, p6 | Versioned exact-copy fixtures improve maintenance; do not introduce new customer messages unnoticed. | Accept mechanism. |

C1 p1 calls multi-instance correctness mandatory. The baseline requires safe current-version restart and cooperating execution; it does not mandate horizontal deployment. Supporting multiple hosts is a proposed topology with additional proof duties. Likewise, “one transactional store” and opaque persisted tokens are sound choices, not the only ways to meet the outcome-level specification. A signed/encoded token checked against current server authority is not inherently noncompliant.

### U-series reconciliation

- **U-NAME/U-COMMAND:** C1 pp6–7/C2 §6.4 allow only Menu to override name entry. Baseline 01 recognizes other exact navigation commands. This needs owner approval, not silent parity credit. C4 p8 also routes expired name text through Main while C2 describes ExpiredView; resolve what that message may trigger.
- **U-DST:** both proposals conservatively omit repeated wall times pending approval; terminology differs little.
- **U-EXTERNAL:** both acknowledge independent Google writers and hold conflicts for review. The claimed post-write audit must also detect another app event whose local evidence was lost, not only non-NukMiris events.
- **U-REPLAY:** historical outcome versus current Google truth is correctly separated. Adding a fresh lookup to replay changes latency/failure presentation, not original execution identity.
- **U-ACTIVATION:** both retain intent-creation eligibility; store timestamps without backfilling old appointments.
- **U-GENERIC:** C1 p7 discards cancelled/moved/past requests as targeting candidates. They may still be what the customer is answering. Counterexample: request A delivered late after appointment moves to B; one current B request exists; unquoted “Sí” meant A. Reject generic targeting or require exact current context while any conflicting visible history remains. This is a confirmed design gap against R12, not a preferred UX style.
- **U-RETRY:** explicit scoped operator retry with duplication warning is parity; it does not make the original unknown send definitely failed.
- **U-OPS:** targets, region, privacy, support and account ownership remain decisions.

### T-series and S-series

C1 §6 pp8–9 clearly labels T-1–T-7 as proposals, which is good. Keep that qualification when C5 p2 asserts 10× PostgreSQL headroom or duplicate-proof operation. T-1's 500 businesses/5,000 appointments/100,000 daily events and 10× load require a shaped burst/tenant/skew model. T-2's 99.5% ingress target is distinct from successful customer outcomes. T-3's four/eight-second percentiles need provider-budget and cold-cache measurements. T-4's five-minute RPO/two-hour restore/15-minute failover lacks an archive-gap safety budget. T-5 needs denominators distinguishing policy-blocked, unavailable-provider and actually eligible occurrences; “zero duplicate submissions” is an invariant to challenge, not a measured SLA. T-6 escalation within 15 minutes is not resolution. T-7's 30-day raw retention needs legal approval and a longer minimal identity/recovery-evidence policy.

C1 S-1–S-12 (pp9–10) are a strong dependency register. S-1 should cover distributed collisions, delayed create after delete and tombstones. **S-2's fallback to read-compare-write is weaker than an ETag precondition:** a manual edit can race it; stop mutations rather than silently downgrade required safety. S-3 must test removed metadata/deleted tombstone discoverability and pagination. S-4 needs exact all-day/transparent/declined semantics. S-5 and S-9 must distinguish identity, authorization and display by country/account type. S-6 cannot safely correlate a lost-response send by recipient/time window alone when no provider ID or attempt echo exists. S-7 must cover scoped event keys, status advances and replay horizons. S-8 must preserve template TTL plus transport-before-start checks, not adjust accepted intervals without approval. S-10 needs concurrent mutation and privileged-role tests, not just valid DDL. S-11 needs saved-event timezone upgrades. S-12 must test durable commits and external submissions surviving failover, not only restore speed. Proposed experiments are detailed in 07; none was executed here.

## B. Technical architecture and ADR review

Verdicts compare documented design adequacy, not implemented superiority. C3 lists **21 ADRs**, all reviewed. “Equivalent” does not confer production proof on either proposal.

| Claude ADR / C2 sections | Advantages | Weakness / comparison / verdict / decisive evidence |
| --- | --- | --- |
| 001 modular monolith; §§3–4 | Shared transactions; separate ingress and execution roles | **Equivalent** to Codex §3. Enforce role boundaries and deploy compatibility, not only import lint. |
| 002 TS/Node/Fastify/Zod/Kysely; §2 | Concrete validation/query tooling; ecosystem continuity | **Equivalent/unproven**. Express already authenticates raw bytes correctly; Fastify is not automatically safer. Team proficiency and a signed-ingress slice decide. |
| 003 PostgreSQL HA; §§12,14 | Constraints, operational recovery, manageable infrastructure | **Equivalent** destination. HA and 10× capacity are unmeasured; object archive/KMS/secrets also hold state despite “only stateful dependency.” Inventory all recovery stores. |
| 004 leases/DB queues; §4.3 | Transactional claims, per-conversation sequencing | **Worse as specified for armed effects**, not inherently worse technology. Codex §6 explicitly forbids timer-based rearming. Demonstrate paused dispatcher at marker/socket boundary. |
| 005 reducer/offers; §6 | Pure transitions and explicit offered authority | **Equivalent**. Diagram/customer FK must allow pre-registration conversation and withdrawal; single-use actions still replay original durable outcome. |
| 006 Calendar IDs/ETags; §7 | Exact identity, conditional changes, property discovery | **Equivalent mechanisms; weaker retry claim**. Full ownership tuple and verified provider contract required. |
| 007 availability; §7.3 | Lazy windows, advisory-only cache, uncached execution | **Equivalent**. “Twelve calls” means base windows, not all reads/pages. Free/busy cannot identify and subtract only the moving event when merged with another busy event; use complete event-aware recheck. |
| 008 exclusion; §8.2 | Useful database conflict backstop; self-overlap allowed | **Potentially better SQL specificity**, not complete proof; see cases below. Codex's union/transfer alternative is also unimplemented. |
| 009 outcomes; §9 | Explicit definite/uncertain distinction | **Equivalent intent; not proven** for settle-window retry/release. Absence after ten minutes is not proof. |
| 010 attempts/receipts; §10 | Append-only evidence and orphan reconciliation are explicit | **Better evidence detail**, but uncertain ordering timeout changes I05. Missing echo fallback must remain unresolved unless exact correlation exists. |
| 011 reminders; §11 | Durable occurrence identity, preflight, deterministic offsets | **Equivalent core**, with material omissions: permission barrier, TTL/transport fit, retained old-message ambiguity. Waiting for late delivery until expiry differs from current permanent skip at first processing; approve explicitly. |
| 012 isolation; §12.2 | Composite FKs, forced RLS, distinct roles | **Equivalent layers**, excessive “cannot forget scope” claim: custom tenant setting is not authenticated authority. Prove privileged functions and context construction. |
| 013 envelope keys; §13.3 | AAD binds business/provider/credential; versioned rotation | **Better specificity** than generic encrypted-secret recommendation. Runtime compromise with broad KMS permission still spans tenants; test offboarding/cache invalidation. |
| 014 sync; §7.5 | Polling plus direct send-time checks | **Equivalent strategy**, uncertain metadata-filter/tombstone completeness. Keep direct known-event reconciliation independent of polling. |
| 015 operator API; §13.2 | Scoped authenticated commands, reasons, audited reveal | **Equivalent** security intent. MFA and explicit business argument alone are not per-business authorization. Avoid second booking confirmation accidentally imposed on customers. |
| 016 containers/HA; §14 | Concrete topology and deployment discipline | **Unproven sizing**. Four minimum instances and HA may be justified by approved targets, not assumed small cost. Drain expiration must never authorize stale external requests. |
| 017 telemetry/sentinels; §15 | Invariant queries, queue-age metrics, canary ownership | **Better operational specificity**, worth adopting. Sentinels detect damage; hourly checks do not prevent it. Quarantined uncertain work must not be mis-alerted as automatically retryable. |
| 018 restore/archive; §16 | Independent archive and command journal expose lost evidence | **Better failure inventory; incomplete guarantees**. See D below. |
| 019 tests; §17 | Named crash points, generated isolation, drift checks | **Equivalent rigor with more operational detail**. Sandbox observation supports contracts, not universal exactly-once proof. |
| 020 civil time; §§7.3,11 | Instant offsets and explicit fold policy | **Equivalent** pending owner acceptance. Library tzdata updates cannot resolve future-event policy by themselves. |
| 021 deterministic recognition; §6.6 | Matches bounded Spanish grammar and privacy scope | **Equivalent**; a future LLM remains excluded. |

Specific reminder omissions matter even when the overview says “preflight”: a STOP accepted while a worker awaits Google/template reads needs a durable suppression barrier observed at final admission. Readiness must fail closed on actual status/contract/TTL immediately before sending; notification caches are hints. Verify the original 900/300-second caps and transport budget still fit before appointment start. No new consent interaction or placeholder service is authorized.

## C. Adversarial concurrency and provider findings

### C1. Google client IDs: supported identity, insufficient retry proof

Existing installed **official `googleapis` 188.0.0 generated Calendar declaration**, `backend/node_modules/googleapis/build/src/apis/calendar/v3.d.ts:704–709`, states that callers can supply IDs (base32hex characters, length 5–1024, unique per Calendar), followed by:

> “Due to the globally distributed nature of the system, we cannot guarantee that ID collisions will be detected at event creation time.”

The local declaration SHA-256 is `c5f41173e9e6f03bcb7978ee68375095c3476b48d34d89d74ef2ac8b750000e3`. This is existing vendor source, not a newly installed dependency or live experiment. The primary [events.insert reference](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) was inaccessible (proxy 403); the quotation corroborates a documented limitation but does not establish every current API behavior.

C2 pp17–22/C4 pp3–4 treat a same-ID insert after absence/settle time as idempotent. That needs more than a random-ID collision mitigation recommendation. An asynchronous first insert can remain invisible; a tombstone may change recreation semantics; a late original insert may arrive after cancellation. A 409 is not success: verify business/customer/event/creating operation/time. A 404 is not proof the first request cannot complete. Do not report that Google actually duplicates these requests: no such experiment was run. The established baseline already preallocates event IDs and deliberately reconciles uncertain creation read-only (`booking.js:93–104,170–217`). Adopt that conservative fallback until a sufficient contract is established; finite successful tests cannot prove the absence of all delayed collisions.

### C2. Reservation exclusion: what it proves and what it does not

For two rows, an exclusion violation requires **all** listed comparisons true. Same Calendar + overlapping ranges + different appointment keys conflicts; same appointment key makes `<>` false, so it is allowed. This is the intentional self-overlap exception. `btree_gist` not-equal is a known extension capability, not a PostgreSQL logical impossibility. The [official extension reference](https://www.postgresql.org/docs/current/btree-gist.html) was inaccessible here; actual target-version DDL and races remain unexecuted S-10 activities.

**Illustrative SQL; not executed and not a schema change:**

```sql
-- Run only in a future disposable proof environment with btree_gist available.
CREATE TEMP TABLE reservation_proof (
  calendar_id text NOT NULL,
  appointment_key text NOT NULL,
  operation_id text NOT NULL,
  during tstzrange NOT NULL CHECK (
    NOT isempty(during) AND NOT lower_inf(during) AND NOT upper_inf(during)
    AND lower_inc(during) AND NOT upper_inc(during)),
  state text NOT NULL CHECK (state IN ('held','committed','released')),
  EXCLUDE USING gist (calendar_id WITH =, during WITH &&,
                      appointment_key WITH <>)
    WHERE (state IN ('held','committed'))
);
BEGIN;
INSERT INTO reservation_proof VALUES
 ('cal-a','appointment-a','book-a','[2026-11-04 10:00Z,2026-11-04 11:00Z)','held');
SAVEPOINT competing;
-- Expected exclusion violation 23P01: different appointment, overlapping time.
INSERT INTO reservation_proof VALUES
 ('cal-a','appointment-b','book-b','[2026-11-04 10:30Z,2026-11-04 11:30Z)','held');
ROLLBACK TO competing;
-- Expected success: same appointment, different operation, overlapping time.
-- Also shows why the constraint alone does not serialize two moves of A.
INSERT INTO reservation_proof VALUES
 ('cal-a','appointment-a','move-a-1','[2026-11-04 10:30Z,2026-11-04 11:30Z)','held');
INSERT INTO reservation_proof VALUES
 ('cal-a','appointment-a','move-a-2','[2026-11-04 10:45Z,2026-11-04 11:45Z)','held');
ROLLBACK;
```

| Static case / future two-session test | Expected constraint behavior / additional duty |
| --- | --- |
| Different appointments, identical/partial overlap | Conflicts; concurrent inserter waits on competing transaction then succeeds or errors according to commit/rollback. Verify exact target PostgreSQL behavior. |
| Same appointment, old/new self-overlap | Allowed as intended. Require immutable appointment key linked by FK to the same authorized event. Caller-supplied/shared keys would evade arbitration. |
| Two simultaneous moves/cancel/attendance for one appointment | Constraint permits same-key reservations and says nothing about non-range mutations. Lock appointment mutation state; admit at most one unresolved mutator; compare event ETag and operation identity. |
| Zero-buffer adjacent appointments | Half-open ranges touch and are allowed. With buffer, protect the complete required spacing using current business policy. |
| Null/empty/unbounded ranges or null keys | NULL comparison and empty overlap can evade exclusion; enforce NOT NULL and validated finite nonempty half-open intervals. |
| Expired offered hold | A definite unsubmitted hold can be released under owned revision checks. Do not encode volatile `now()` expiry in the partial constraint predicate. |
| Uncertain provider write | Keep protection despite elapsed lease/hold time. “Protection stays until settle window has passed” (C2 p20) is insufficient without proof it can safely release. |
| Rollback / failover | Rollback loses tentative rows, not a provider request already issued. Require acknowledged admission/attempt durability across failover; possible lost commits require quarantine, not ordinary retry. |

Stronger combined approach: retain this constraint **or** one normalized union of source/target protection per appointment, plus a unique active mutation admission per actual Calendar/event, immutable scoped FKs, operation/attempt ownership and retained committed reservations against lagging Google reads. A partial unique active-operation index can enforce one claimed/in-flight/uncertain mutation per event; transactional row locking handles transition into that set. It must include attendance/cancel paths. Local exclusion never fences remote calls or manual Google writers. Codex's union design also needs executable proof, not special treatment.

### C3. Paused worker counterexample

1. A claims operation fence 7, verifies availability and commits submission marker.
2. A pauses before opening the socket. Its lease expires.
3. B claims fence 8. The old event is absent; after a settle window B retries insertion, changes schedule, or permits another operation.
4. A resumes and calls Google using its previously valid payload. Its SQL completion fails the fence check, but Google has already received the request.

For Meta, a second dispatcher can create a second customer message if claiming does not distinguish unarmed work from possibly dispatched attempts. C2 §11.3 says expired submitting becomes uncertain, a good rule, but C4 p5's “lease and fence plus unique occurrence prevent a second attempt” must explicitly enforce that transition and prohibit rearming. A marker can prove no attempt was admitted only if stale workers must successfully acquire a current marker before every possible submission; after it exists, only the original dispatcher may submit. Neither a database check immediately before HTTP nor process death cancels an already-issued request.

Required correction: fences for local commits, nontransferable armed submission permission, proof old dispatchers cannot newly submit before retry, and unresolved protection for outstanding provider requests. For DB failover that may lose an acknowledged marker, stop all dispatchers and reconcile the possible gap. RPO is a safety concern as well as a data-loss number.

## D. Messaging, disaster recovery and tenant security

### D1. Delivery uncertainty and ordered customer experience

C2 §§10.2–10.3/C4 p6 give a good append-only receipt design. Retain facts independently: failed versus delivered/read, returned API ID versus callback proof, provider time versus receipt time. Callback before HTTP return must win; missing/mismatched metadata remains an orphan. Recipient/time-window matching alone cannot distinguish two current attempts without exact provider/attempt identity. A signature authenticates the payload; it does not authorize attaching it to any tenant.

The F-05 five-minute barrier is an explicit availability-versus-ordering trade. A delayed first message can arrive after a second, including a success/result/prompt relationship; TTL cannot retract delivered or still-possible messages. Expiration of definitely unsent output is different from expiring evidence uncertainty. Baseline I05 preserves the barrier. Keep it pending an explicit changed policy with concrete customer scenarios. Poison-event skipping after three failures (C2 §5.4) similarly changes accepted processing guarantees; classify what can be skipped, preserve submitted-operation continuations and require reviewed decisions.

### D2. Restore/archive: identify the exact missing durability boundary

C2 §§16.1–16.4 and C4 scenario 10 correctly add quarantine and an operator-command journal. Those are valuable. However:

- Acceptance commits before best-effort archive export. A STOP or operator change can be durably acknowledged then absent from both the restored DB and archive. “Zero lost withdrawals” requires a complete independent recovery record or continued suppression while the gap is unresolved.
- Writing DB plus object journal is itself a dual-write problem. Specify archive admission/acknowledgment, durable export outbox, immutable identity/sequence, checksums/manifests, gap detection, and what survives loss of that outbox. An asynchronous outbox alone cannot recover records lost with its primary before export.
- Raw inbound bodies do not contain a platform-generated operation/event/attempt ID allocated later. Replaying them with fresh randomness can allocate another operation/event ID. Same-ID provider behavior does not protect a newly allocated ID. Recover the original identity ledger before replay can admit effects.
- Outgoing attempts and possibly submitted reminders after the snapshot may have no callback at all. Marking **known** gap attempts uncertain cannot enumerate missing attempts. Hold all potentially affected business/Calendar/send scopes, whole service if those scopes are unknown.
- C2 p39 calls duplicate ordinary replies “annoying but not harmful.” They can contain confirmations or stale actionable choices; this is an unapproved relaxation of delivery safety. The 24-hour window bounds eligibility, not harmlessness.
- Stop old instances and prevent new ones dispatching before restore isolation. Quarantine must cover Calendar writes as well as outgoing sends/scheduler; C2 p38 only names outbound/scheduler switches explicitly. Multiple restored instances need one external dispatch authority.
- Probe credential versions against external revocation state; never revive an offboarded grant or drop later suppression/configuration changes. KMS restore and token probes cannot prove that a lost operator revocation never occurred.
- WORM raw payloads may contain PII, consent text and historical actions. Retention lock, subject erasure, residency, key access and disaster-recovery need a jointly approved policy. Store minimal evidence rather than assuming immutable raw storage is always lawful.

T-4 recovery time is unproven: gap reconstruction can require indefinite review. Distinguish time to restore/read service from time to resume safe writes. A drill must deliberately destroy the primary before archive export and include no-receipt sends and lost operator changes; a happy-path archive replay proves much less.

### D3. Tenant isolation is defense in depth, not authentication by SQL setting

C2 pp29–32 has strong layered structure. The following remain proof obligations:

1. RLS compares rows with `app.business_id`, but a runtime role able to set that custom setting can generally select another tenant context. Its value must derive from authenticated channel/operator authority. RLS catches accidental unscoped queries; it is not alone protection against a fully compromised shared runtime. C3 ADR-012's broad claim needs narrowing.
2. `FORCE RLS` does not constrain superusers/BYPASSRLS; SECURITY DEFINER runs with owner authority. Restrict function ownership/EXECUTE, fixed search paths and arguments; test PUBLIC grants, migration/break-glass access and pool reuse.
3. Ingress accepts multitenant batches. A raw batch may contain messages for multiple channels; storing it under one tenant can expose another's body. Store platform raw evidence under tightly restricted authority and normalized tenant-specific rows separately; do not expose whole batches through tenant reports.
4. C2 §7.2 defines event ownership chiefly by `nm_biz`. Same-business customer A must not manage B by guessing the event ID. Require Calendar + business + customer + event + known operation identity at each effect. Baseline `appointment-management.js:48–92` already checks the fuller tuple. Metadata is modifiable by authorized external Calendar clients, not cryptographic proof against malicious owner edits.
5. Worker/global claims returning only IDs is sound if their functions authenticate and constrain state; global work discovery must not become a privileged arbitrary query channel. Check tenant FK columns, including receipts/attempts and active Calendar reservations.
6. Use AAD binding from C3 ADR-013, but audit KMS grants and decrypted-token cache lifetime. Offboarding must stop admissions, inventory uncertainty and evict cached credentials. Meta app-secret rotation and OAuth refresh-token lifecycle need distinct protocols, not an assumption that all tokens survive secret rotation.

## E. Critique of the original Codex proposal

The same scrutiny yields meaningful weaknesses in my original 02–05:

1. **Recovery was a conservative rule, not an executable completeness protocol.** Holding unknown scopes is safe but could stop a business indefinitely. Claude's operator-command journal exposes specific missing evidence classes. Adopt an independent, gap-detectable evidence design and measurable read-only versus write-resumption recovery objectives.
2. **Dispatcher termination was underspecified.** “Supervision establishes termination” does not explain multiple workers in one container, half-open requests, partitioned hosts, or a database failover losing admission evidence. Define one dispatcher generation and nontransferable attempt ownership operationally; test the complete lifecycle.
3. **Tenant-context establishment was too trusting.** My non-owner/RLS/pool safeguards did not sufficiently distinguish forgotten predicates from a runtime that can choose arbitrary tenant settings. Add explicit privilege/threat boundaries and generated misuse tests for bootstrap/maintenance functions.
4. **Guard representation was still a sketch.** The proposed exclusion/union/transfer design lacks actual DDL for self-overlap, one active mutation and finalization under competing updates. Claude's explicit SQL is better for review. Adopt concrete target-version proofs without pretending that SQL alone solves external effects.
5. **Operational diagnosis lacked Claude's invariant-sentinel catalog and commit-order counter.** Add evidence queries, per-conversation commit serialization, reviewed unresolved-work commands, and redacted canary ownership. Alerts and sentinels need false-positive policy, not only a shopping list of metrics.
6. **Credential protection was generic.** Adopt Claude's explicit business/provider/credential AAD, key-version recovery, token-cache eviction and provider-standing checklist. Shared worker access remains a blast radius to model.
7. **Strategy and estimates were insufficiently comparable.** My 8–14 engineer-week selective estimate and Claude's 7–10 engineer-month greenfield estimate are unmeasured and describe different scopes. No historical migration burden weakens the argument for retaining implementation. Re-estimate identical outcomes, including operational hardening and verification, after an equal-scope slice.
8. **Long-lived protections can harm availability and fairness.** I favored safety without quantifying blocked-Calendar/operator workload. Measure it and define escalation, read-only service and owner risk decisions while keeping unknown effects protected.

I would adopt Claude's evidence-oriented operational details, not its unproven same-ID retry, five-minute ordering relaxation or narrowed generic-reply history. Differences between “ports/hexagonal,” “operational projection/cache” and “database jobs/workers” are mostly vocabulary. Both designs still lack verified provider contracts, deployment-specific RLS/claims proofs, complete lost-evidence restore tests and an approved operating/privacy budget.

## F. Confirmed design weaknesses versus unverified risks

**Confirmed from the documents:** U-GENERIC omits visible historical ambiguity; F-05 changes the baseline ordering guarantee; expired-name handling conflicts across C2/C4; a lease cannot prevent an already-capable stale worker's HTTP request; the exclusion constraint permits same-key operations; best-effort archives leave an acknowledged-evidence gap; `nm_biz` alone is insufficient customer authority. These do not prove implemented failures because no implementation exists.

**Unverified provider/deployment risks:** exact Google duplicate/tombstone/read semantics, conditional mutation behavior, filtered tombstones and polling completeness, Meta error/callback contracts, production token lifetimes, target GiST operator classes/HA durability, recovery timings and capacity/cost. Neither design may claim those proven by a mock or diagram.

**Strong contributions to retain:** append-only receipts/orphan review; explicit operator-command recovery; named invariant sentinels; commit-ordered conversation sequence; envelope credential AAD; provider-standing experiments; candid staffing/maintenance costs; no speculative product features. They improve a combined proposal without authorizing implementation.



### Accepted implementation evidence

These immutable links substantiate the current behavior discussed above; they do not prove the proposed replacement:

- [Booking finalization and read-only uncertain reconciliation](https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/booking.js#L65-L104).
- [Scoped customer/event ownership and current lookup](https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/appointment-management.js#L48-L108).
- [Live/foreign owner protection and receipt correlation](https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/reliable-delivery.js#L79-L111), [ordered output and expiry](https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/reliable-delivery.js#L218-L275).
- [Current and historical reminder targeting](https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/lib/appointment-reminders.js#L278-L313).
- [Actual process-restart reminder cases](https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/test/reminder-recovery.test.cjs#L85-L112).
- [Baseline provenance and verification limits](https://github.com/vanasperena-ux/nukmiris/blob/95decc812c228f25171ecfe647200447c83e2e45/backend/BASELINE.md#L3-L17).

## Source key

- **C1**: [NukMiris v0.8.1 Greenfield Challenge — 1 of 5 Independent Requirements Assessmen](NukMiris%20v0.8.1%20Greenfield%20Challenge%20%E2%80%94%201%20of%205%20Independent%20Requirements%20Assessmen.pdf). Page references are printed PDF page numbers.
- **C2**: [NukMiris v0.8.1 Greenfield Challenge — 2 of 5 Greenfield Architecture Proposal](NukMiris%20v0.8.1%20Greenfield%20Challenge%20%E2%80%94%202%20of%205%20Greenfield%20Architecture%20Proposal.pdf). Page references are printed PDF page numbers.
- **C3**: [NukMiris v0.8.1 Greenfield Challenge — 3 of 5 Architecture Decision Records](NukMiris%20v0.8.1%20Greenfield%20Challenge%20%E2%80%94%203%20of%205%20Architecture%20Decision%20Records.pdf). Page references are printed PDF page numbers.
- **C4**: [NukMiris v0.8.1 Greenfield Challenge — 4 of 5 Reliability and Security Challenge](NukMiris%20v0.8.1%20Greenfield%20Challenge%20%E2%80%94%204%20of%205%20Reliability%20and%20Security%20Challenge.pdf). Page references are printed PDF page numbers.
- **C5**: [NukMiris v0.8.1 Greenfield Challenge — 5 of 5 Final Recommendation](NukMiris%20v0.8.1%20Greenfield%20Challenge%20%E2%80%94%205%20of%205%20Final%20Recommendation.pdf). Page references are printed PDF page numbers.
