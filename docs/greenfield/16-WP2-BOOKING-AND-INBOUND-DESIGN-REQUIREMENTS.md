# WP2 design requirements carried from Claude conditions C2/C3

2026-11-03, America/Mexico_City. Normative review:
[Claude WP1 remediation verification](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6619904951),
with [original reproducible probes](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6619905185).
**Design only. No WP2 code is implemented. C1 must be independently verified and
CP1/initial CP2 formally closed before WP2 begins.** A Codex green test run cannot
supply that independent decision. Preserve one service per appointment in P0 and
later increments under the owner's clarification in Issue #7.

## NEW-2 — reservation priority, not only submission ordering

WP1's submission barrier is safe but insufficient for normal booking liveness:
sequence 2 can reserve the requested range first, sequence 1 fails on overlap, and
sequence 2 then waits on sequence 1. Operator HOLD of the first request is not an
acceptable normal-flow solution that lets the later request win.

Required WP2 behavior:

- Under the conversation lock, identify the earliest unresolved eligible ordinary
  command before reserving its appointment/resource. A later command returns HELD
  with zero reservation/attempt rows; it cannot consume capacity ahead of that head.
- Earlier STAGED input, unreduced ordinary input, or unresolved/UNKNOWN operation
  remains a barrier. Preserve its original identity, ordering and protection;
  elapsed time never proves non-submission. Do not add retry/rearm or auto-HOLD.
- Admission-priority withdrawal is processed immediately and independently of this
  mutation order. Terminal non-mutating reductions are recorded explicitly so
  ordinary conversation does not require an operator to progress (NEW-3).
- Define and review lifecycle transitions under the same lock order used by prepare,
  finalization and safe abandonment; later work cannot race around the head.
- Any special Menu/status-response path must preserve approved UX without silently
  resolving/releasing older uncertainty. A status query is not a new booking or
  authority to retry the unknown operation.

Acceptance requirements (NOT RUN / WP2):

| ID | Adversarial schedule | Required result |
|---|---|---|
| W2-RP01 | Same customer/range; sequence 2 prepares before sequence 1 | Sequence 2 HELD, zero new reservations; sequence 1 can reserve. No operator discards the earlier request. |
| W2-RP02 | Two real workers contend at prepare/commit cuts; lower sequence STAGED or unreduced | Only current head can reserve; stable sequence/IDs and no deadlock/indefinite lock wait. |
| W2-RP03 | Earlier operation entered/UNKNOWN; later command offers same/different slot | Later mutation held; original guard/ranges survive. Explicit exact read-only proof or safe never-entered abandonment is required for advancement. |
| W2-RP04 | Earlier navigation/name/date/free-text reduction has no calendar effect | Durable typed reduction/ordered output disposition permits the next legitimate command, without fabricated appointments or automatic operator HOLD. |

## NEW-3 — sealed admission-time classification, one normalizer

Do not reproduce TS withdrawal rules in SQL with lower(trim(body)). The accepted
TS normalizer recognizes accents, NFD and punctuation: e.g.
`No me envíes recordatorios.` is a withdrawal. The SQL head currently treats it as
an unresolved ordinary command. Plain conversational text is also not a permanent
calendar-operation barrier in a usable application.

Required WP2 contract:

- One admission parser produces a versioned, typed classification (at minimum
  withdrawal, receipt and ordinary conversational input). Bind classification,
  parser/rule version, original event digest, business/channel/subject and original
  input ID into the INPUT/batch membership/seal. Exact retry reuses that decision.
- SQL validates the sealed classification's shape/scope and reads it; it must not
  maintain a second text normalizer or infer type from message delivery metadata.
  Keep payload immutability and no cross-business fallback. Digest integrity alone
  is still not production seal authenticity (009 remains gated).
- Keep context-dependent name/date/intent interpretation in the reviewed reducer;
  admission classification must not turn a multiword name or human-mode message
  into an unsolicited booking. Preserve Menu/withdrawal/human priorities from P0.
- Every ordinary input reaches a durable reduction outcome: scoped operation,
  ordered navigation/reply, human handoff or explicit no-effect terminal result.
  Tie that result to input/context revision. UNKNOWN output remains a barrier;
  unsupported free text must not be silently treated as either a booking or a
  forever-unresolved mutation.
- Rule-version changes cannot reinterpret an already admitted input or allocate a
  new identity to replay it. Conflict/tampering fails closed and is audited.

| ID | Fixture | Required result (NOT RUN / WP2) |
|---|---|---|
| W2-CL01 | STOP variants including accents, decomposed characters, punctuation and spaces | One sealed classification drives immediate revoke and head handling consistently; no later command poison or false permission grant. |
| W2-CL02 | Ordinary chat, name/date input, human-mode text and Menu | Original context/priority preserved, no accidental mutation, durable terminal reduction where appropriate. |
| W2-CL03 | Alter class/version/digest/tenant after original seal; exact retries and repacked batches | Tampering rejected; legitimate retry retains original IDs/class; no extra provider invocation. |
| W2-CL04 | Mixed tenants + withdrawal + failing partition/archive | Every validated revoke remains durable; ordinary ACK waits for all partitions; no cross-tenant head/permission leak. |

## First concrete task after independent WP1 acceptance

Start **WP2-L0a: indexed authenticated fixture-archive lookup and capacity/repair
proof**, before archive-dependent admission expansion under 017. Add a keyed-read
port and fake-store implementation with checkpoint/inclusion verification; test
head/tail/rollback/key/cut failures, original ARM identity, independent-result
limits and the 1k/10k/100k/1M capacity corpus. Keep production custody/credentials
unimplemented and disabled. Publish measured results and independent review.

Then WP2-L0b implements the sealed classification/reduction outcomes and
head-aware reservation guard above, with W2-RP/CL counterexamples as tests, before
building the first booking UI. The first visible path remains known/new customer
booking through accepted Spanish slot/name UX in the synthetic localhost simulator,
then move/cancel. Ordinary message output contexts and cancellation-confirmation
rules identified in the proposed charter must be reviewed, never bypassed.

This identifies the next implementation task; it does not start it or imply that
any existing gate is already closed.

## C2 — preserved disabled capabilities and gates

**001/F13, 013 real transport and 016 real receipt/provider integration remain
disabled. No real Meta/Google calls, provider credentials, GCP, merge or cutover.**
Keep tenant isolation, UNKNOWN holds, no automatic resend, immutable original IDs,
permission/status gates and inert restore. Native Windows acceptance is still
NOT RUN; Linux or fake-provider results do not substitute for it.

The following OPS01 cases and 009/011/017 gate text are carried **verbatim** from
[the prior disposition report](reviews/02-CODEX-WP1-REMEDIATION-AND-DISPOSITIONS.md).
The verbatim text is an activation requirement, not an authorization to run it.

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

**017:** before WP2 archive-dependent expansion, select an indexed immutable record
store with keyed reads, authenticated inclusion/checkpoint proofs and monotonic
witnesses. Verify ordinary lookups do not decrypt all prior records, restore catches
missing/rolled-back tails, and keys/old versions remain readable under rotation.
Benchmark increasing histories (1k/10k/100k/1M records), memory and per-admission/
dispatch latency under concurrency, crash and repair; publish distributions and a
capacity policy. Fixture's 100k cap/full scan is not the production design.
