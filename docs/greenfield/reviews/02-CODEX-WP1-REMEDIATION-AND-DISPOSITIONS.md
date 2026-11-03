# WP1 remediation and dispositions for independent re-review

Execution record: 2026-11-01; publication follow-up: 2026-11-03,
America/Mexico_City. Bounded remediation of Claude's **GO WITH
SPECIFIED REVISIONS** on Draft PR #4. **CP1 and initial CP2 remain OPEN pending
independent Claude verification.** No WP2, merge, deployment, real accounts or
provider access is authorized or implemented. Approved product decisions and
accepted v0.8.1 code/data remain unchanged.

Tested remediation source: `857bb825ac01ca67f303adbe71ef486c276c8923`. Review starting point:
`e0b470d8f28bd380c9d6bfdeab0b9aad5e5ab507`. The original Claude
[review](01-CLAUDE-WP1-CP1-CP2-REVIEW.md), [SQL scripts](01-CLAUDE-WP1-CP1-CP2-REPRO-SCRIPTS.md)
and all of `vnext/evidence/checkpoint-1/` are preserved byte for byte.
New evidence: [checkpoint-1-remediation-1](../../../vnext/evidence/checkpoint-1-remediation-1/README.md).
“Corrected and verified” below means Codex verification of this synthetic scope;
it does not substitute for independent acceptance.

## Disposition of every finding

All IDs below have prefix **CR-WP1-**. None is disputed.

| ID | Disposition | Correction or explicit remaining gate |
|---|---|---|
| 001 | Capability disabled pending safe implementation | Real submission/production disabled. F13 counterexample retained. OPS01 proposal and nine mandatory verification cases below; no physical cutoff claim. |
| 002 | Corrected and verified | SQL freezes exact batch items; recomputes membership digest/count; checks every stored link/input against the seal. Changed replay rejected; exact replay writes nothing. R002. |
| 003 | Corrected and verified | NULL arguments reject; finite caller sample must be within 5 s of DB authority; final eligibility uses DB time after locks. R003, privileged-argument matrix, existing F27. |
| 004 | Corrected and verified | Output preparation binds row-derived purpose/context/payload; final consent keys on locked output purpose. False CUSTOMER_REQUEST and JSON NULL denied. R004/R006. |
| 005 | Corrected and verified | Synthetic signed batches partition into authenticated-route tenant records; all immediate STOPs precede archive calls; each partition commits independently, ACK requires all. Exact raw bytes/signature retained once with partition references. R005 and outage case. Real Meta normalization still gated by 016. |
| 006 | Corrected and verified | SQL validates complete envelope against input/business/channel/calendar/permission and plan; exact operation payload includes times/resource/event/customer/buffer/identities, with recomputed digests. Output payload/context bound to authoritative row. R006/R004. |
| 007 | Corrected and verified | Conversation lock and head predicate block every lower STAGED/unresolved command, including UNKNOWN operations and outputs not yet created. Terminal output or explicit sealed never-executed disposition required. R007, F22, R007-RACE. |
| 008 | Corrected and verified | Restore forces every business SUSPENDED, increments status revision and recovery epoch, keeps dispatch false. Suspension application path writes independent SUSPEND evidence after immediate SQL stop; missing tail cannot reactivate. R008 and original REC01 failures. |
| 009 | Accepted with explicit later implementation gate | Synthetic integrity subpart corrected: SQL recomputes body SHA-256; wrong digest denied; dispatcher/sealer crossed capabilities denied. This is **not cryptographic authentication** of archive custody or a deployment identity. Production requires independent sealer process/credential, archive-authentication mechanism and isolated custody; see below. |
| 010 | Corrected and verified | Sealed operator abandonment permits only PREPARED/ARMED under gate-compatible locks. Retains tombstone/audit, releases guard/target protection, cancels never-created local reservation or restores exact source protection for MOVE. SUBMISSION_ENTERED/UNKNOWN cannot be abandoned. R010 variants, rollback and race tests. |
| 011 | Accepted with explicit later implementation gate | Local archive remains fail-closed on lock/head/witness ambiguity. No unverified repair or timed lock stealing added. Repair protocol and crash-cut tests below must pass before a real archive is selected. |
| 012 | Corrected and verified | NULL/nonfinite grant times reject; DB authority and skew bound deny forged future “now”; grant time/revocation ordering remains enforced. R003/R012 and argument matrix. |
| 013 | Capability disabled pending safe implementation | Real transport disabled until enforced overall budget/abort, stalled-upstream test, UNKNOWN/no-retry behavior and OPS01 verification pass. Fixture's 3 s idle timeout is not the envelope's 2 s overall deadline. |
| 014 | Corrected and verified | status_event stores status value; replay with same id/digest and different value raises status_conflict. R014. |
| 015 | Corrected and verified | Eight evidence tables reject payload UPDATE/DELETE through append-only triggers; input/output retain deliberate state transitions. Actual table-owner attempts with valid RLS scope denied, not just runtime ACL denial. R015. Superuser/DDL compromise remains outside this claim. |
| 016 | Capability disabled pending safe implementation | Only synthetic receipt shape enabled. Real Meta statuses/callback correlation requires current documented contract plus sandbox fixtures and signed correlation tests before WP2 webhook work. Acceptance and delivery semantics specified below. |
| 017 | Accepted with explicit later implementation gate | Fixture full-chain decryption/cap retained. Indexed, independently witnessed archive design and scale/recovery benchmarks required before WP2 archive-dependent expansion. No production performance claim. |

## Exact correction and evidence map

The full and fault raw logs name each case; locally retained, unpublished
`remediation-traces.json.gz` contains its SQL rows/results. Snapshot archives preserve every fixture before cleanup. Compressed SQL/state
archives remain local after automatic approval review rejected public uploads;
the new evidence README links its status/hash and published all-member inventory.
Compressed SQL snapshots/state traces are retained locally, unpublished; readable
full/fault logs, manifests, baseline counterexamples and content inventory are published.
`before-reproductions.jsonl` contains actual counterexamples on the **unchanged**
reviewed SQL, PostgreSQL 17.11. Its accompanying adapter script runs the review's
SQL sequences using original TypeScript builders and actual restricted roles.
This is an adaptation, not a claim to run the shell snippets verbatim: the pasted
`t2` needs pre-existing `rv1` data, its paths/socket are environment-specific, and
`t6b` is referenced but not included. The original scripts are unchanged.

| ID | Changed files (under vnext/) | Before → after evidence / remaining limit |
|---|---|---|
| 002 | migrations/001-foundation.sql, 003-dispositions.sql; application/admit-input.ts; test/remediation.test.ts | Before extra input ELIGIBLE; R002 rejects restaging, wrong/NULL count/hash, missing/extra links and malformed item fields. Exact duplicate/repacked inputs retain original IDs in F02/F03. Batch-row lock serializes activation/link changes. |
| 003 | migrations/001,002; roles.sql; test/remediation.test.ts; test/support/postgres-fixture.ts | Before expired=false then NULL=true; R003 denies NULL/infinite/skewed/expired times without entering. All exposed mutating function arguments receive NULL attacks plus typed malformed cases; stored state stays unchanged. Fixture-only DB clock is installed by postgres; runtime cannot alter/read it or replace its function. Default source authority is clock_timestamp(). |
| 004 | migrations/001,002; test/remediation.test.ts | Before STOP+false CUSTOMER_REQUEST admitted; R004 denies each mismatched/NULL field at preparation, and correct REMINDER remains denied by final consent. |
| 005 | application/admit-input.ts; test/remediation.test.ts | R005 shows A's STOP/input durable while B's route revision fails; no ACK until repaired B seals. Archive outage still leaves both STOP heads durable. Raw bytes are stored as base64 with signature, root hash and tenant partition references. This is fixture authentication by verified ingress/archive, subject to 009 custody limits. |
| 006 | migrations/001,002; application/prepare-operation.ts; domain/protocol.ts; test/remediation.test.ts | Before payload={kind:CREATE} unrelated to protected times admitted; R006 denies all payload, digest, identity, interval/context and JSON NULL disagreements before reservations. SQL/TS canonical digest test covers nested Unicode, escapes, arrays, safe integers and rejected unsupported numbers. |
| 007 | migrations/002,003; test/concurrent.test.ts, remediation.test.ts; existing dispatch/database/permission tests | Before later operation admitted while earlier unresolved. R007 tests STAGED/PREPARED/entered/UNKNOWN predecessors; F22 now holds the later operation before its output can exist. R007-RACE rechecks eligibility after waiting on an operator hold. Unknown predecessor has no timeout-release path. |
| 008 | roles.sql; application/set-business-status.ts; test/restore.test.ts, remediation.test.ts; support/helpers.ts | Before ACTIVE snapshot restores ACTIVE after suspension. R008 restores SUSPENDED with and without evidence tail. Source does not enable dispatch or implement resume. Independent SUSPEND evidence is after fail-closed SQL, so archive outage cannot undo suspension. |
| 009 subpart | migrations/001; domain/protocol.ts; test/remediation.test.ts | Invented digest accepted before; forged digest rejected now. Opposite-role calls and clock modifications denied. Hash consistency is not proof of who sealed it. |
| 010 | migrations/002,003; roles.sql; test/remediation.test.ts, concurrent.test.ts | R010 verifies PREPARED and ARMED stale work releases slot/head only after sealed decision, a new operation can reserve, MOVE source identity/buffer/protection retained, UNKNOWN/entered rejected, commit-cut rollback atomic, repeat idempotent, race loses to admitted submission. No dead-owner assertion releases uncertainty. |
| 012 | migrations/001; test/remediation.test.ts | Before future grant accepted with NULL now; R012 rejects NULL/infinite/forged-current clocks; no grant event created. Existing F25 preserves tied/duplicate withdrawal precedence. |
| 014 | migrations/001; test/remediation.test.ts | Conflicting replay formerly reported success; now status_conflict with SUSPENDED unchanged. |
| 015 | migrations/003; test/remediation.test.ts | Owner UPDATE/DELETE attacks against input, output_intent, permission_event, status_event, receipt, audit, operation and seal denied; snapshot unchanged. State fields remain writable only through granted core functions at runtime. |

Paths `migrations/*` above are under `src/infrastructure/postgres/`.
The new source files are limited to the same authorized synthetic safety proof.
These are fresh disposable schemas, **not migrations of existing application data**.
The earlier synthetic snapshots remain historical evidence; cross-version restore
compatibility is not promised by their old format number.

The original tests were preserved with three intentional adaptations: failed
preparations/paused-business admissions now need sealed input dispositions before
a later command proceeds; stale never-entered attempts need sealed abandonment;
F22 asserts the stronger barrier at the later operation. Fixture scheduler resets
explicitly bypass only the append-only event triggers between independent cases,
under postgres, then re-enable them. No interrupted crash case resets state.

## Transaction, wait and operator rules

Business → channel/calendar → permission → conversation → appointment → attempt
is the dispatch lock order. Preparation, result finalization, input holds and
abandonment acquire the conversation before appointment work. Re-read input state
after waiting for that lock. Abandonment locks relevant resource rows in stable
order, and the attempt state/CAS decides between abandonment and submission.
Finalizer also takes the conversation lock before appointment/output insertion to
avoid an inverse FK lock order. No function holds a SQL lock across provider I/O.

Fixture runtime roles default to 3 s lock timeout and 10 s statement/idle-transaction
timeouts. Lock errors rollback; no new automatic retry/rearm is introduced. Timeout
values are fixture safety bounds, not production sizing. The 256 seeded overlapping
schedules exercise three live PostgreSQL clients and record audit linearization;
the original 1,000 serially selected interleavings remain separate evidence.

Operator paths: seal HOLD_INPUT only when no operation exists, permanently exclude
that input from execution, retain its original identity and audit the decision.
Seal ABANDON only for never-entered PREPARED/ARMED attempts; original owners and
attempts remain immutable. Once submission may have occurred, retain the guard,
range and conversation head; obtain an exact read-only provider proof or escalate
as a recovery case. No general uncertainty release exists. Individual production
operator authentication and recovery tooling remain later gates.

## OPS01 / F13 proposal and verifiable activation gate (001, 013)

**No WP1 gateway code or real credential was added.** Keep the original F13 JSON
and newly reproduced counterexample. DB decision serialization cannot retract a
known-commit continuation or an HTTP request; holding a lock over I/O cannot solve
that and can prevent suspension from completing.

Proposed deployment boundary: only a dedicated submission gateway holds scoped
provider credentials and provider egress. Workers cannot connect to provider hosts
or obtain those secrets. A one-use ticket binds attempt/payload/business revision/
epoch and a gateway-clock expiry. Gateway consumption is unique on attemptId;
restart/unknown consumption never reissues authority. Immediately before sending,
the gateway rechecks current status/revision/epoch/dispatch and its tenant kill
flag. Enforce an overall transport deadline including pool/DNS/connect/write/read,
not an idle timeout. Abort/connection loss records UNKNOWN with no automatic retry.
Suspension commits then requests gateway fence/kill acknowledgement; old instances
are network-isolated before any successor, and credential revocation is separately
measured rather than assumed instantaneous.

A pause between the gateway's last check and physical write still exists. Ticket
expiry plus rechecking narrows opportunities but does not prove zero late bytes.
A measured maximum over random runs is not a universal bound. **G06 has not been
weakened.** Real activation remains blocked until an independently reviewed fence
contract either meets the approved semantics or identifies a specific residual for
an explicit owner decision. No such exception is requested or inferred here.

Mandatory independent OPS01 evidence before any real call:

1. Worker identity has no provider secrets and direct provider egress is denied.
2. Worker frozen beyond ticket expiry, then suspended/thawed: zero provider calls.
3. Replayed/second-worker/consumed ticket: zero additional calls, including lost DB commit response.
4. Suspension at every ticket/recheck/write cut; ≥10,000 recorded randomized runs with provider-observed time versus suspension commit; publish actual lag and stated limits.
5. Gateway frozen after recheck: reproduce the residual or prove abandonment at enforced deadline; never label a late send as a physical cutoff pass.
6. Old-instance network fencing, then thaw: zero provider calls from the old identity.
7. Later authorized sandbox-only credential revocation latency for each provider; publish worst observed refusal lag and uncertainty.
8. DB unreachable at gateway: deny without provider invocation.
9. Stalled upstream: enforce overall budget, record UNKNOWN, retain holds, never retry; receipt/result races preserve facts.

## Archive, credentials and receipt implementation gates

**009:** digest recomputation binds content; anyone authorized as the fixture sealer
can still mint a self-consistent record. The test worker intentionally holds several
fixture role pools. Before production, use separate processes and non-interchangeable
credentials for ingress/sealer/dispatch/result/operator/recovery, authenticate archive
receipts (e.g. signed canonical checkpoint verified by an isolated trusted verifier),
keep signing/MAC keys out of dispatch/worker/DB-client reach, and retain independently
witnessed monotonic heads/keys. A DB-only HMAC with the same process/key custody is
not independence. Attack tests: recompute a forged body digest, replay a valid old
checkpoint, cross tenant/scope, compromise dispatcher credential, and roll back one
custody domain. Each must deny unauthorized registration/effect; document the trusted
administrator boundary. None of these production controls has been run here.

**011:** before selecting a real archive, implement a fenced repair operation:
stop/fence all appenders, retain forensic copies, verify every object/key/version/
chain link against independently trusted custody, classify object-only/head-only/
witness-only cuts, and adopt a longer head only when its committed custody is
proved. A consistent longer local chain alone is insufficient. Record a signed,
append-only repair decision, update heads through the archive's atomic/CAS primitive,
then admit again without reallocating IDs. Broken/missing custody stays held with
an operator report. No age-based append.lock stealing. Kill at every object/head/
witness/lock release cut, repair twice, crash repair itself, replay old custody,
and verify continuation with zero unsealed effects. **NOT RUN; production blocked.**

**016:** the synthetic input messages/attemptId shape is not Meta's statuses wire
contract. Before WP2 webhook work, pin official API version/documentation, verify
opaque callback data survives the relevant statuses, and persist exact original
attempt/callback/tenant/channel/recipient/wamid bindings. Receipt-before-response,
missing callback, wrong tenant/channel/recipient/id, duplicate and contradictory
statuses must remain non-retrying facts. In current synthetic SQL, ACCEPTED and
VERIFIED_APPLIED mean provider acceptance is known, not successful customer delivery.
A late sent after failed may establish acceptance while meta_status stays failed;
delivered/read supersede failed. Preserve all raw receipt facts. Validate these
semantics independently before implementing real correlation. Orphans never grant
permission to resend.

**017:** before WP2 archive-dependent expansion, select an indexed immutable record
store with keyed reads, authenticated inclusion/checkpoint proofs and monotonic
witnesses. Verify ordinary lookups do not decrypt all prior records, restore catches
missing/rolled-back tails, and keys/old versions remain readable under rotation.
Benchmark increasing histories (1k/10k/100k/1M records), memory and per-admission/
dispatch latency under concurrency, crash and repair; publish distributions and a
capacity policy. Fixture's 100k cap/full scan is not the production design.

## Verification outcome and stop

Final commands/results and exact source/evidence hashes are in the new evidence
README and raw logs. Strict TS and source confinement pass; full/fault suites run
on the pinned PostgreSQL **17.11** image. **88/88 full and 78/78 fault tests pass**, with zero failures/cancellations/skips.
The 173-case argument matrix covers all 17 exposed mutating functions.
All outputs are synthetic. No production/accepted app database or secrets were read,
no root backend/static/config/dependency files changed, and no providers were called.

Recommend **final independent Claude verification of this diff and evidence**.
Eleven findings are corrected within the synthetic boundary; six remain explicit
capability/implementation gates. The independent reviewer must confirm the fixes
and dispositions before CP1/CP2 can close. Stop here. WP2 requires a separately
approved charter; this remediation does not request or grant it.
