# 07 — Architecture decision matrix, Round 2

## Provisional position

**Option B: selective rearchitecture remains my provisional recommendation, with a genuinely fresh-core prototype as an equal competitor.** Confidence is moderate, not final. There is no reason to preserve POC schemas, module organization or obsolete formats. The reason to retain anything is demonstrated behavior and manageable proof effort, not sunk cost. If the equal-scope experiment shows that replacing persistence, conversation, delivery and execution together is safer and more coherent than incremental seams, recommend Option C instead.

Claude's clean-sheet recommendation deserves more weight than my original estimate allowed: no production-data migration and no historical compatibility materially lower its risk/cost. Neither proposal currently proves the external concurrency and recovery guarantees that matter most. A rewrite cannot be justified by PostgreSQL/Fastify/TypeScript alone; selective changes cannot be justified by an existing passing-test count alone.

References C1–C5 mean the five untouched Claude PDFs, identified in [06's source key](06-Codex-Peer-Review-of-Claude.md#source-key). Findings and examples in [06](06-Codex-Peer-Review-of-Claude.md) are part of this decision record. The baseline is accepted `95decc812c228f25171ecfe647200447c83e2e45`, not the later reminder testing candidate.

## 1. Weighted scorecard and evidence discipline

The requested weights sum to 100%. **No numerical performance or quality ranking is defensible yet.** Existing implementation evidence and unimplemented design coverage are different kinds of evidence. Assigning a combined proposal 4/5 because it incorporates more documented controls would reward an unbuilt design precisely as the brief prohibits. The table supplies qualitative assessments, remaining proof and exact weights; it intentionally has no fabricated weighted winner.

| Criterion / weight | Existing v0.8.1 | Original Codex proposal | Claude proposal | Potential combined proposal |
| --- | --- | --- | --- | --- |
| Reliability/correctness **25%** | Implemented stable identities, retained uncertainty, transactional reminder hooks; tests cover specified failures. Single-host/manual-writer limits remain. **Evidence-backed within covered cases**, not formal proof. | Conservative no-rearm policy and known-active guards; dispatcher ownership and guard DDL not implemented. **Sound intent, incomplete proof.** | Explicit saga/SQL/marker; same-ID retry, expiring lease and timer-based ordering claims need correction. **Detailed but safety claims exceed proof.** | Retain protected uncertainty; use concrete exclusion plus single-event mutation admission and nontransferable submissions; keep historical targeting. **Candidate corrections, unimplemented.** |
| Security/isolation **20%** | Authenticated raw ingress and scoped ownership are implemented; shared POC authorization and schema defense limits remain. **Narrow operational context.** | Explicit scope, composite FKs, RLS and operator roles; arbitrary context-setting/runtime compromise needs clearer treatment. **Unproven defense layers.** | Adds credential AAD and privilege roles; nm_biz-only predicate and RLS claims too broad. **Strong specification with material gaps.** | Full ownership tuple, trusted scope creation, tested privileged functions and per-grant credential lifecycle. **Threat model still needs verification.** |
| Maintainability/code quality **20%** | Separated helpers and injected collaborators, but dispatcher/storage/presentation concerns overlap. Current review effort is observed qualitatively, not measured. | Typed modular boundaries and reducer; no implemented change-cost data. **Plausible.** | Concrete layer enforcement, schema validation/copy catalog; more tooling and custom queue code to maintain. **Plausible.** | Adopt explicit boundaries and only justified tooling; compare change exercises, team skills and ongoing obligations. **Hypothesis.** |
| Testability/recovery **15%** | Historical 1,089 tests/owner PC report include actual process restarts and isolated restores; offsite/failover/archive-gap recovery not certified. | Controlled clocks/provider faults and broad quarantine proposed; evidence recovery may block indefinitely. **Not demonstrated.** | Named crash points, property/isolation tests, archive replay/drills; known lost-evidence gaps undermine recovery guarantees. **Not demonstrated.** | Shared requirement-tagged fault suite plus pre-export loss, stale-worker and missing-attempt restore scenarios. **Proof plan only.** |
| Scalability/extensibility **10%** | Deliberately one DB/runtime owner; serial provider drainer and quotas limit throughput. No agreed load target. | Separate roles/PG claims with modest-workload assumption; no measurements. | Explicit T-1 and HA topology, but 10× headroom unmeasured and leases insufficient alone. | Approve workload first; measure queue fairness, provider calls and hot-Calendar constraints. Neither replicas nor RLS prove scale. |
| Operational readiness **10%** | Useful local status/reconcile/backup tools; PC uptime, local trust and backup failure domain remain launch gaps. | Names controls/runbooks but leaves targets and implementation open. | Better concrete sentinels, provider-standing, command journal/canary; staffing, cost and gap-safe RTO unproven. | Assign owners, budget drills, split read-only recovery from safe write resumption, then demonstrate. **Unimplemented.** |

Evidence anchors: baseline 01 RTM and original 04; `backend/BASELINE.md:3–17`; `booking.js:65–104`; `appointment-management.js:48–108`; `reliable-delivery.js:79–111,218–309`; `reminder-recovery.test.cjs:85–112`. Proposal anchors: Codex 02 §§5–11 / ADRs 003–012; Claude C2 §§4–17 / C3 ADRs 004,006,008–019 / C4 scenarios 3–10. No new application or provider tests were run this round.

### How future scoring would work

After owner-defined acceptance gates and equal-scope implementations exist, use an anchored 0–4 scale for **demonstrated outcome**, per criterion: 0 fails a mandatory gate; 1 major unresolved gaps; 2 limited demonstrated scope with declared restrictions; 3 agreed pilot targets demonstrated; 4 agreed commercial targets and recovery/security exercises independently demonstrated. A mandatory safety/isolation failure disqualifies release regardless of weighted total. Record each score's test/measurement/operating evidence, assessor and limits. Compute `sum(weight * score / 4)` only for comparable scope. A prototype's coverage score must not be compared with a production-readiness score. No current proposal has earned such a total.

## 2. Rebuild versus rearchitecture, equal scope

| Dimension | A — retain and improve | B — selective rearchitecture | C — new implementation |
| --- | --- | --- | --- |
| Correctness/reliability | Preserve known paths; commercial guarantees still require new controls. | Preserve verified semantics while replacing high-risk boundaries; avoid two active authorities. | Design atomic boundaries together; all working failure knowledge must be reconstructed/proven. |
| Regression risk | Small changes limit surface, but interaction debt accumulates. | Boundary conversions can break continuation/finalization; temporary seams add risk. | Broad initial parity risk; fresh isolation avoids corrupting the working POC. No historical replay obligation. |
| Security | Add secrets/operator/isolation controls around existing trust model. | Replace trust/context/credential boundary deliberately; keep ownership checks. | Composite keys/roles built in, but privileged mistakes and provider access are still new risks. |
| Maintainability | Good if measured complexity remains tractable; weak if every change crosses dispatcher/SQL concerns. | Good if coherent boundaries emerge and transitional code is removed. | Potentially strongest coherence; unproven until maintainers perform real changes. |
| Architectural coherence | Incremental consistency, no promise of a uniform model. | Needs explicit target and completion points; otherwise permanent hybrid. | One consistent transaction/model language; risk of speculative abstraction. |
| Testing | Existing regression examples plus new commercial fault/security cases. | Requirement-based tests survive; adapter-specific tests change; same-database recovery mandatory. | Reuse scenario meaning/fixtures where sound, not all legacy internals. Real DB/contract/crash/security/restore tests still required. |
| Effort | Lowest initial changes, possibly larger accumulated hardening effort. | Moderate to high; cost rises if all core layers need replacement. | Higher initial parity work, lower migration cost than a production rewrite. |
| Operations | May satisfy bounded supervised single-host pilot; must prove recovery/support. | Can stage new hosting, secrets and DB topology with clear authority transfer. | Can adopt target managed operations from first slice; must budget all services/runbooks. |
| Long-term change cost | Unknown; measure representative changes and incident diagnosis. | Potentially favorable if seams replace the actual sources of change risk. | Potentially favorable if simpler for the actual team; modern stack is not proof. |
| Future commercial capabilities | May force repeated reshaping; excluded features must not enter parity scope. | Allows reusable tested boundaries without speculative feature implementations. | Cleaner starting model for later work, but no catalog/dashboard/billing is authorized now. |

**No-data-migration consequence:** C does not need to preserve POC records, old schemas, old actions, or pre-v0.8.1 state compatibility. B also need not build those compatibility layers in its new components. Both still need current-version restart durability, provider authorization, environment ownership, existing operational effect inventory and safe cutover. Never use a fresh fixture between crash and recovery to erase difficult evidence. Historical data migration is absent; external side-effect coordination is not.

**Reassessing estimates:** my original 8–14 engineer-weeks and Claude's 7–10 engineer-months plus spikes were judgments with unequal scope. Neither is suitable as the owner's budget. Estimate from the same requirements and failure/operations gates, state personnel assumptions, include contract/simulator/restore/security work, and count maintenance/on-call cost. Do not choose A/B merely because their initial diff is smaller.

### Decision rule after a bounded comparison

Implement nothing during Round 2. In a later explicitly approved experiment, build the same narrow vertical slice under B and C approaches: signed acceptance → new-customer selection/name → protected booking → lost response/restart → read-only reconciliation → atomic reminders/output → exact attendance → snapshot-gap quarantine. Compare illegal outcomes, amount of trustworthy evidence, complexity of a change, operator actions, maintenance skill and measured cost. Use synthetic providers initially; separately authorize provider spikes.

Favor **C** if the fresh slice is materially easier to reason about and test, the team can fund full parity/operations, and B would replace essentially all state/transaction boundaries anyway. Favor **B** if credible seams preserve useful proven code while satisfying the same safety gates with less transitional risk. Favor **A** only if agreed pilot targets and security/recovery can be met without architectural debt obstructing routine changes. No option gets an allowance to weaken a hard invariant to meet a deadline.

## 3. Combined decisions to carry forward

| Decision | Proposed disposition / evidence required |
| --- | --- |
| Shape and tools | Keep shared modular-monolith/Node/TS/PG direction as a candidate. Fastify/Zod/Kysely are maintainability choices; validate raw bytes and team proficiency. No broker/microservices without measured reason. |
| Input and conversations | Adopt Claude's per-conversation commit counter and named reducer/crash states. Namespace dedup identity by authenticated channel/business; preserve exact source content and current-version continuation. |
| Calendar identity | Keep preallocated valid event IDs, full ownership tuple and mutation markers. Conservative read-only recovery remains default; no settle-window resubmission without sufficient provider evidence. |
| Reservations | Carry Claude's concrete SQL and Codex's union alternative into target-DB tests. Add same-event single unresolved mutator, immutable FKs and retained known-active coverage. |
| Dispatch | Local fence checks plus nontransferable armed attempts; prove old dispatcher cannot newly submit. Unknown requests keep protection even after lease/instance death. |
| Messaging | Adopt append-only scoped receipts and orphan review. Preserve uncertain ordering barrier and old visible-message ambiguity unless owner changes behavior explicitly. |
| Reminders | Keep four accepted bodies/kinds, strict-future enrollment, existing mode boundaries, current TTL caps and delivered follow-up. Recheck permission after slow checks and serialize admission with accepted withdrawal. |
| Credentials/isolation | Adopt explicit AAD, key/grant versions and provider-standing register. RLS supports checks; authenticated context/per-business operator grants remain mandatory. |
| Recovery | Combine broad quarantine with gap-detectable ingress/operator/operation/attempt evidence. Do not replay effect-capable messages before original identities and suppression are recovered or affected scopes held. |
| Operations | Adopt sentinel catalog, redacted correlation, read-only handoff queue and explicit incident ownership. Treat canary accounts, HA replicas and immutable storage as cost/retention responsibilities. |

## 4. Unresolved owner decisions

1. Calendar resource/capacity and exclusive business mapping; policy for external manual conflicts.
2. WABA/grant ownership, account standing, billing responsibility and operator authorization—not a request to implement billing.
3. Whether uncertain outputs may ever stop blocking later replies, and what customer-visible trade-off is acceptable. No silent five-minute default.
4. Exact command/name collision, stale input, historical outcome wording, DST-fold and future timezone-change policies.
5. Current versus historical unquoted confirmation context; never automatically equate one current appointment with intended target.
6. Consent/withdrawal evidence, privacy/retention/residency including external Calendar data and immutable archives.
7. Workload/bursts, budget, staffing/support hours, ingress versus transaction-success objectives, read-only and safe-write RPO/RTO. T-series remain proposals.

## 5. Recommended validation experiments, not executed

| Experiment | Failure injection / pass condition |
| --- | --- |
| E1 Calendar identity and mutation contract (S-1/S-2) | Separately authorized sandbox: concurrent same-ID insert, lost response/delayed visibility, ID reuse after delete, late insert after cancel, changed ETags. Always verify full owned identity; uncertain remains held when proof is insufficient. Seek documented guarantees; successful samples alone cannot prove universal deduplication. No unconditional read-compare-write fallback. |
| E2 PostgreSQL reservation/admission (S-10) | Disposable target-version database: execute 06's SQL, two-session competing inserts/rollback, self-overlap, two same-event moves, cancel/attendance races, null/bounds/buffer cases and stale finalizers. Assert both DB constraints and operation-level invariants. No installs or DB writes were performed this round. |
| E3 Paused dispatcher and HA durability | Pause before marker, after marker/before socket, after remote commit, before local finish. Expire claims, restart/fail over with a possibly lost acknowledged marker, resume old process. No automatic second possible submission and no released uncertainty protection. |
| E4 Meta evidence and order (S-6/S-7) | Simulator initially: callback before HTTP result, missing echo/ID, duplicate/reordered/failed receipts, two sends to same recipient, delayed old message. Unknown correlation stays unresolved; five-minute expiry cannot silently advance order. Later sandbox only by separate authorization. |
| E5 Reminder races | Accept STOP during slow template/Calendar reads; cancel/move after claim; template TTL reset/status change; delayed parent receipt; stale unquoted confirmation after move. Preserve exact target/consent/mode/TTL boundaries. Decide any late-parent-wait policy change first. |
| E6 Destructive-loss restore proof | Later disposable environment only: snapshot, accept STOP/operator revoke, dispatch no-receipt send and Calendar change, destroy DB before archive export. Replay must not invent event/attempt IDs or reactivate permission. Demonstrate missing-evidence scope quarantine and split read-only restoration from safe write resumption. |
| E7 Tenant privilege proof | Actual runtime/ingress/pool/SECURITY DEFINER/migration roles: attempt arbitrary SET tenant context, PUBLIC function calls, cross-business batches, FK substitution and credential AAD swap. Differentiate bug defense from fully compromised runtime. |
| E8 Search/sync/phone contracts (S-3/S-4/S-9/S-11) | Overlapping merged busy events during a move; all-day/transparent events; metadata removed; deleted tombstones; pagination/cursor rewind; Mexico/Argentina raw identity vs display; tzdata upgrade. No false free availability or retargeted identity. |
| E9 Capacity, operations, economics (S-5/S-8/S-12) | Approve workload model; measure burst and hot-tenant fairness, quotas, provider-standing failure handling, archive lag, restore/failover time and complete monthly service/support cost. Replace claimed 10× headroom with observations. |

The proposed future experiments are not permission to contact live Meta/Google or mutate any database now. Any surviving inability to prove an effect absent remains uncertainty, not test failure to be “fixed” by automatic retry.

## Round boundary

Round 2 narrows the disagreements and strengthens the combined candidate. It does not approve a final architecture or a rebuild. Preserve both independent submissions, answer [the questions for Claude](08-Questions-for-Claude.md), agree owner policies and experiments, then revisit the implementation strategy. No application, original report, PDF, dependency, schema, configuration, data or provider asset was changed for this review.
