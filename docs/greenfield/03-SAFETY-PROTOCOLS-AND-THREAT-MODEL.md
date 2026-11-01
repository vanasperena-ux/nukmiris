# Safety protocols and threat model

Proposed, unimplemented protocols. Deterministic traces are specifications, not passed experiments. Every future test is NOT RUN; Codex owns implementation evidence and Claude disposition is pending. Refer to 06 for E/Q/SC gates and 08 for the bounded first proof.

## Invariants and trust envelope

| ID | Invariant | Deterministic/integration test family | Prior challenge |
|---|---|---|---|
| INV01 | No authenticated supported input is acknowledged or executed without SQL admission and independently durable evidence seal. | F01–F09, DB01 | SC1/2, Q7 |
| INV02 | One scoped input/action, original offer and operation identity survive repeats/recovery. Conflicting content is rejected. | F02/06/09/28, P-W01/02 | SC2/3, Q6/9 |
| INV03 | One unresolved mutator per appointment; protected source/target/resource/customer occupancy cannot be released by a timer or stale result. | DB02–DB05, F10/18/19 | SC4, Q3 |
| INV04 | At most one possible automatic HTTP invocation for an armed attempt; ownership is nontransferable while original may dispatch. | F11–F17, F29, DB06 | SC5/14, Q2/13 |
| INV05 | Unknown external outcome stays held; absence/timeout/409 is not proof of non-effect. Reconcile reads only. | F14–F19, P-C04/07/08 | SC6, Q1 |
| INV06 | Finalization, current schedule/reminder metadata and output intents agree atomically. | F16/18/19, DB05 | SC2/4, V081.I08 |
| INV07 | Ordered output intents do not overtake uncertain heads; accepted, delivered and read remain distinct. | F20–F22, P-I05/09 | SC7, Q4/5 |
| INV08 | Unknown and known sender suppression share a persistent head with final send admission; stale grants/restore cannot undo withdrawal. | F07/12/23–F26, DB07 | SC8/13, Q8 |
| INV09 | Deadline, appointment, consent, status, template, channel and identity revisions are revalidated at final admission. | F12/13/23/27, P-R01–12 | SC9/10/15, Q12 |
| INV10 | Receiving WABA/number establishes business; full customer/calendar/event/origin/operation tuple authorizes effects. | SEC01–SEC06, F30 | SC3/11/12, Q9/10 |
| INV11 | Inert restore never invents an ID/grant/employee draw/effect; incomplete recovery evidence holds affected scope, or all scopes if unknown. | F08/09/24–F29, REC01 | SC13/14, Q6/7/13 |
| INV12 | Old environment/primary has no dispatch authority before replacement begins. SQL leases, cache expiry and KMS denial alone are insufficient. | F11/13/29, OPS01 | SC12/14, Q2/13 |
| INV13 | G06 closes every automated booking/mutation/send admission, including old jobs; reactivation only admits eligible future work. | F12/27, DB08 | G06, SC9 |
| INV14 | Untrusted copied/manual fields never establish ownership, consent or verified recipient; unknown attribution never frees capacity. | MVP-O04/05/07/08/09, SEC04 | SC3/15, FS1/2 |
| INV15 | Customer/owner/app participants cannot impersonate one another. Parity and add-on profiles are explicitly distinct. | MVP-C09/10, SEC05 | FS3, G08 |
| INV16 | Auditable privileged actions, independent custody and least privilege survive recovery/key rotation. | SEC06, REC01, OPS01 | SC11/12/16/17 |
| INV17 | Civil dates, exact instants, buffers and original identities survive DST/restart; no fabricated attendance or booking success. | P-W08/09, P-I10, MVP-C12/O10 | SC10, G07 |

Threats: malicious/forged inbound and guessed IDs; customer A using B's event; wrong tenant mapping; replayed/corrupted batches; database/archival partial failure and ambiguous commit response; paused/duplicated processes, SDK retries and stale code; receipt reordering; operator error/abuse; lost keys; copied Calendar PII/IDs; manual concurrent Google edits. Assume provider authentication/cryptography and durable storage meet independently verified contracts; do not claim protection against a compromised provider or simultaneous compromise of every independent custody domain. Shared application runtime compromise can span its authorized tenants: RLS is bug defense, not independent tenant authentication. Narrow grants and separate dispatcher credentials reduce this blast radius; CP5 requires explicit deployment security review.

## A. Authenticated durable ingress and independent journal

1. Accept bounded bytes (current 1 MiB limit is the parity reference); verify HMAC-SHA256 over the exact bytes with constant-time comparison before processing any parsed event. GET challenge follows configured token; it does not authorize POST. Bound JSON shape/depth/batch size, reject unsupported signed malformed messages rather than defaulting a tenant.
2. Verify signed `entry.id` WABA/account and `metadata.phone_number_id` against an active, externally validated mapping revision. Message `from` is a provider subject within that channel; caller business IDs, display names and phone normalization cannot select a tenant. Unsupported message types have an explicit durable ignored disposition, no effects.
3. Canonicalize each **complete original event** with account/channel/type; hash content including quote/timestamp, retain raw-byte digest and parser version. Stable input key is `(business,provider,channel,providerMessageId)`. Raw-body whitespace/batch regrouping may differ without changing that event. Same key and different event digest is a conflict, never replacement. Receipts have their own stable correlation/dedup key and append-only evidence.
4. Allocate batch/input/operation-capable provenance IDs once. Prepare per-business encrypted evidence envelopes and a restricted batch manifest with ordered event digests/counts/raw hash; avoid leaking the raw multitenant batch to tenant readers. Independent archive has a separate account/failure domain and key custody from PostgreSQL/backups. WP1 uses a local deterministic stand-in only.

### Normal protocol (one defined order)

| Step | Independent store | SQL | May ACK / execute? |
|---|---|---|---|
| A0 | No record | No row | Neither |
| A1 | Conditional immutable PREPARE at stable batch key, digest+identity ledger; append sequence via CAS head | None | Neither |
| A2 | PREPARE known durable | Atomic stage whole supported batch, stable conversation sequence, STAGED inputs; no eligible work | Neither |
| A3 | Append COMMIT_SEAL referencing A2 commit identity, PREPARE digest, count, mapping/version; CAS head acknowledged or read back exactly | Still STAGED | Neither |
| A4 | Seal and prefix/head validated | Transaction sets ELIGIBLE with seal ID/hash for complete matching batch | After successful commit, ACK and workers may execute |
| A5 | Seal retained independently | ACK may be lost; dedup returns original admission after checking seal | Original work only |

Use conditional puts with identical-digest idempotence and authoritative direct reads after lost replies; listing is not a completeness proof. Store append ordinal, predecessor hash, immutable object digest, format/key version and durable monotonic head/checkpoint. Head update is a linearizable compare-and-swap; an object uploaded without head inclusion is an orphan, never authority. No assumption that a normal object store supplies an append transaction: adapter must implement/test this protocol or fail closed.

Database-first appearance is a negative case: a STAGED/unsealed row cannot be claimed. This design does not offer an alternate DB-first execution path. SQL A2 commit response loss is resolved by exact admission ID lookup; never allocate new identities. Archive A3 response loss is resolved by exact head/chain evidence; otherwise no A4. SQL A4 response loss returns retryable non-200; recovery/redelivery checks exact seal and matching row, not a new operation. A sealed archive with missing SQL can reconstruct **original admission data inertly**; it cannot regenerate effects from a reducer using today's context.

An invalid conflicting event aborts normal batch activation; no partial success ACK. Retry of the full batch uses the same keys. Suppress-only withdrawal is deliberately asymmetric: signed exact baseline withdrawal can immediately upsert/lock its SQL permission head and set suppression even if archive is unavailable or another batch item is rejected. It cannot grant, dispatch or cancel a booking. No success ACK until that withdrawal's independent evidence is sealed. Loss of this unacknowledged suppression before sealing is not claimed recoverable; recovery holds on unknown completeness. Grants/configuration/operator commands require seal before they can enable effects.

### Archive completeness and custody

Recover by authoritative current head/checkpoint, not highest object discovered in a listing. Validate first sequence, predecessor/root, every sequence/count/hash and expected head. Missing prefix/interior/tail, rewritten duplicate, unavailable key/format or unverifiable latest head means incomplete evidence. If the head itself might be rolled back/lost, completeness is UNKNOWN: no write resumption even if visible objects form a valid chain. Signed monotonic checkpoints in independently controlled recovery custody help detect rollback; they cannot certify activity after the last known checkpoint if the authoritative head is gone. Declare that uncertainty and hold globally when affected scopes cannot be determined. No daily hash or “zero lost STOP” marketing claim substitutes for this evidence.

## B. Operation/attempt automaton

Operation states: `PLANNED`, `PREPARED`, `ARMED`, `SUBMISSION_ENTERED`, `UNKNOWN`, `VERIFIED_APPLIED`, `VERIFIED_NO_EFFECT`, `ABANDONED`. State is not appointment truth. Guards/protections are acquired transactionally at PREPARED and retained through ARMED/SUBMISSION_ENTERED/UNKNOWN. Abandonment only before any potentially effective admission, with original owner's containment if a claim exists.

| From → to | Required authority/evidence | Protection / retry consequence |
|---|---|---|
| PLANNED → PREPARED | Current action/customer/mapping; atomic guard+resource union; immutable plan/attempt ID | No network; independent identity/payload evidence required next |
| PREPARED → ARMED | Independent may-submit intent seal exists; SQL exact matching envelope/version; owner incarnation claimed once | No transfer on lease expiry; another process cannot arm this effect |
| ARMED → SUBMISSION_ENTERED | Final gates under shared lock order, immutable attempt; exactly one CAS changes state and returns an ephemeral one-use token after known commit | If commit outcome unknown, caller receives no usable token; hold. Never reissue token by rereading row. |
| SUBMISSION_ENTERED → provider invocation | Sole owner synchronously consumes process-local token before invoking single-call transport | Token cannot be recreated after restart; no second loop obtains it. Possible freeze at this boundary remains in-flight risk. |
| SUBMISSION_ENTERED → UNKNOWN | Timeout, unreadable result, crash, result-persistence failure, owner unknown | Still retains original owner/attempt and guard; UNKNOWN is not a new dispatchable state |
| SUBMISSION_ENTERED/UNKNOWN → VERIFIED_APPLIED | Exact provider response/read proof, independently sealed; idempotent finalizer | Atomic local result/reminder/output/protection transfer; no new external call |
| SUBMISSION_ENTERED/UNKNOWN → VERIFIED_NO_EFFECT | Documented operation-specific proof plus original dispatcher incapable of future submission | Local release only; WP1 never automatically allocates another generation |
| PLANNED/PREPARED → ABANDONED | Definitely unsubmitted, no usable permit, current owner contained when necessary | Release current guard only; retain audit/evidence |
| ARMED → held before submission | New STOP/suspension/version/expiry denies final gate | Do not claim safe abandonment until owner can no longer use any permit; no successor send |

Independent may-submit evidence precedes SQL admission. Archive-only possible-arm evidence is conservative on restore: treat as possibly admitted even if SQL was never updated. Result evidence similarly seals before local finalization. False uncertainty costs availability; it does not authorize duplicate effects.

At-most-once local invocation depends on enforced client confinement, single-use token semantics and a sole owner implementation. SQL unique IDs cannot deduplicate requests a rogue/compromised client makes directly. No provider exactly-once claim is made. SDK automatic retries, redirects that replay POST and application middleware retries must be disabled/verified. Do not use a timeout or process-death observation as proof the provider did not accept an earlier request.

## C. Permission, suspension and final execution gate

Target isolation: READ COMMITTED with explicit stable row locks; SERIALIZABLE alternatives must rerun the whole admission transaction on serialization failure. Do not reuse a snapshot acquired before waiting. Fixed order for shared transactions: business execution head (FOR SHARE; status mutation FOR UPDATE), channel/mapping head, purpose/sender permission head (FOR UPDATE), conversation/output head, appointment mutation guard, sorted resource/customer heads, operation/attempt. Withdrawal needs only business then permission head and never waits on normal conversation processing. No network/template/Google reads occur while holding these short locks.

```text
preflight outside transaction: current Google observation, template/WABA checks, payload
BEGIN READ COMMITTED
  lock current business head; require active + dispatch enabled + correct recovery epoch
  lock current mapping head; require externally verified account/channel/calendar revision
  INSERT permission_head(business,purpose,subject,unknown/suppressed)
      ON CONFLICT DO NOTHING
  SELECT permission_head ... FOR UPDATE             # real row even before registration
  lock stream and relevant appointment/resource/operation heads in fixed order
  require current identity/purpose permission and no suppression
  require current schedule/action/status/policy/credential versions match preflight
  require due <= now <= deadline, now < appointment start,
      TTL + transport budget fits before start, service window valid where applicable
  require earlier output head resolved/definitely unsent-expired
  require independent admission+attempt seals and exact immutable payload digest
  CAS ARMED -> SUBMISSION_ENTERED for this sole owner
COMMIT known-success -> return unique one-use process token; otherwise HOLD
```

Withdrawals lock/upsert that same head; append evidence and increment revision/suppress before acknowledging (archive sealing still required). Older grant import, duplicate stale Accept, snapshot restore or unsealed grant cannot clear suppression. A fresh explicit grant must refer to the current identity/question and supersede the observed suppression revision with attributable evidence. Occurrence time is recorded, but untrusted message timestamps cannot resurrect a grant. Tie favors withdrawal; future consent UI must issue a new question after the effective withdrawal.

If STOP commits before final SUBMISSION_ENTERED, admission fails. If admission precedes STOP, it is in flight and cannot be recalled. The same ordering applies to G06 suspension and appointment changes. A process frozen immediately after the last gate but before the socket call can physically send later: DB locks/leases, token-cache expiry or another local check do **not** prove a strict physical cutoff. WP1 must demonstrate no second submission and retain a named residual late-submit counterexample. CP5 must demonstrate egress/process containment and define its enforceable bound before production activation. No blanket guarantee of “nothing ever arrives after STOP/suspension” is claimed. This is a technical proof gap, not a proposal to reopen G06.

Actual G06: block **all automated appointment execution** and proactive sends/reminders using the same business head, not merely schedule creation. Withdrawal/read/export/reconciliation remain available; no automated suspension reply is sent unless separately authorized. Warn owner before suspension while active/authorized. Reactivation increments status revision only after verified payment/status; recompute future due times, revalidate consent/current appointments/templates/cap, skip expired or uncertain attempts, never catch up. Human native chat remains outside NukMiris automation.

## D. Calendar and Meta evidence rules

Calendar full tuple: business + credential grant + mapping revision + exact calendar/event + trusted local create/adoption identity + customer + resource/assignment + operation + expected ETag/schedule. Private properties corroborate this tuple; copied properties alone authorize nothing. Create ID is allocated once and independently recorded; a 404 or same-ID 409 never permits reinsert on uncertainty. PATCH/DELETE use verified If-Match and retries disabled. 412 is a known precondition rejection only under verified adapter contract; do not fall back to unconditional read-compare-write. For uncertain create/move require matching original identity/marker and exact requested instants. For uncertain cancel, an exact recorded owned event's authoritative tombstone/404/410 can prove current absence after the original submitter is contained; an unavailable/list-omitted event cannot. No ETag-bump recovery. Retain source+target through uncertain move, and do not claim interval exclusion across independent manual Google writers.

Meta: per-conversation submission sequence/ordinal is stable; shared output-head lock arbitrates current scheduled/proactive vs ordinary intents, without claiming device arrival ordering. One unknown possible send blocks successors in its required stream, with incident visibility; a separate STOP path still suppresses promptly. Unsent expired prompts can be retired; uncertain sends cannot expire into “unsent.” A definitely rejected poison head may be explicitly closed by audited operator evidence and current window rules; no automatic bypass. Correlate signed receipts by business/WABA/number/recipient/attempt opaque echo/exact message ID; recipient+time proximity is insufficient. Store orphan callbacks inertly and link when exact identity becomes available. Delivered/read are monotonic evidence even if HTTP timeout or failed callback arrives later. Follow-up requires delivered/read for the exact current logical schedule; accepted-only/uncertain-only cannot qualify. Same-schedule request and follow-up are one logical target; old conflicting schedules remain ambiguous for generic “Sí”.

## E. Restore and coexistence procedure

Restore target defaults `dispatch_enabled=false`, no effect credentials, no scheduler. Verify snapshot integrity/schema/version/keys and archive completeness. Replay original identities/evidence into an inert projection; suppression first and append-only. Never rerun the effectful reducer to recreate unknown outputs, resource draws, adoptions or grants. Compare snapshot/ledger for every attempted operation and pre-snapshot ARMED work, not just due jobs after snapshot. Retain holds for due-before-snapshot jobs still within grace and all uncertain sends without receipt.

Privileged recovery case requires individual MFA, scoped grant/reason, independent audit and separate safe-read/safe-write milestones. Fence old application/primary at actual egress and verify provider credential revocation where needed; KMS denial does not invalidate plaintext cached tokens. Until old execution is contained, no new dispatcher starts, even if all restored SQL looks consistent. Any missing identity/key/head broadens holds to the smallest **provably complete** scope; unknown affected tenants means global hold. Safe reads continue. Managed failover without no-loss admission and old-primary containment uses this same disaster protocol; WP1/initial candidate chooses fail-stop, no automatic failover claim.

Candidate and POC use separate DBs, credentials/grants, receiving numbers/webhooks, calendars and dispatch authority. WP1 has only fake adapters and synthetic resources; no effect secrets, OAuth files or production bindings. Later real test resources need explicit owner authorization. No environment fallback to the POC. Code rollback preserves candidate journals/seals and pauses incompatible schema/format versions; restoring an older DB is not rollback of Google/Meta effects.

## F. Crash/retry/interleaving matrix

Each row must run with persisted fixture state retained across process restart; matrix covers every boundary in A1–A5 and the attempt automaton. Run success, thrown failure, lost response and forced-kill variants wherever a write is involved. Reviewers may add counterexamples; this is exhaustive over the **specified protocol boundaries**, not every possible provider/OS fault. Evidence targets `evidence/<commit>/<test-id>.json` include rows, immutable archive heads, provider call count, scheduler trace, seed and reviewer; currently NOT RUN, reviewer pending.

| Test | Cut / interleaving | Required outcome / executable acceptance |
|---|---|---|
| F01 | Before/after signature, invalid bytes/channel/WABA | No tenant admission/ACK/effect from forged input; valid challenge isolated. |
| F02 | Duplicate message in same/different batch; changed body/quote/timestamp | One stable admitted identity; digest conflict rejects; no replacement. |
| F03 | A1 object absent/PUT reply lost/conditional conflict | No SQL eligible work; exact lookup resolves identical record only. |
| F04 | A2 SQL rollback/commit reply lost | No ACK/effect; original archive identity reconstructs stage, no new IDs. |
| F05 | A3 seal append/CAS failure/reply lost | STAGED stays ineligible until exact durable head inclusion proved. |
| F06 | A4 before/after commit; A5 ACK lost | At most original input; retry returns matching sealed admission; no duplicate handler effect. |
| F07 | STOP staged, archive unavailable, conflicting peer item | Suppression immediately denies future admission; no positive success ACK before seal. |
| F08 | Prefix/interior/tail missing, head rollback/unavailable, duplicate batch | Restore inert; any broken/unknown completeness blocks affected/global write resume. |
| F09 | PREPARE/COMMIT_SEAL exists but SQL lost | Original IDs restored inertly; no operation regenerated from current availability. |
| F10 | Two same-resource bookings; same-event move/cancel/attendance; self-overlap | One mutator; non-overlapping different resource allowed; losers retain original truth. |
| F11 | Freeze before/after ARMED; second owner/loop; lease expires | No transferable permit, no second potential submission; frozen owner retains possible-dispatch classification. |
| F12 | STOP/suspension before final gate; reverse order; during slow preflight | Gate-first linearization recorded; before-gate suppression causes zero call; prior admitted effect retained as in flight. |
| F13 | Freeze after final gate before socket; advance clock/revoke/suspend | No second sender; late-send residual reproduced and reported, not mislabeled strict cutoff proof. Deployment fence test must deny old invocation before live promotion. |
| F14 | Provider accepts then response lost/malformed; delay response after restart | UNKNOWN held, one invocation; exact read/callback can finalize. |
| F15 | DNS/socket timeout/429/5xx/409/412/definite rejection | Classify per proven contract; uncertain does not rearm; WP1 no new generation at all. |
| F16 | Response received; independent result append fails/reply lost | Hold; no success/release, idempotent same result append/finalization, no repeat call. |
| F17 | Independent possible-arm seal exists; SQL arm/entry lost | Recovery treats possible submission as unknown, not prepared work for another owner. |
| F18 | Finalization transaction fails midway (schedule/output/guard/protection) | Whole SQL rollback; original protections/guard survive; original evidence finalizes once. |
| F19 | Late reconciliation/finalizer after newer operation | Version/CAS guards prevent overwrite, resurrection and successor-guard release. |
| F20 | Receipt before HTTP result; duplicate/reorder/failure after delivered | Monotonic exact proof; no downgrade, duplicate send or foreign correlation. |
| F21 | Missing echo/receipt/message ID; guessed correlation | Orphan/UNKNOWN retained; no recipient/time heuristic or resend. |
| F22 | Unknown output head >5min/>deadline; unsent expired head | Unknown stays barrier; only definitely unsent expires; STOP still processed. |
| F23 | Unknown sender head absent; concurrent STOP vs head create/send | Real upsert/row lock serializes; no zero-row lock loophole or stale snapshot grant. |
| F24 | Snapshot before grant/withdrawal, destroy SQL after ACK | Independently sealed suppression recovered; no stale grant revival. |
| F25 | Old grant import/stale Accept/same-time tie/future timestamp | Withdrawal wins; current new explicit evidence required for regrant. |
| F26 | Key rotation/deletion/missing version; evidence corrupt/decrypt error | No regenerated ID/consent; safe scoped/global holds, readable suppression policy preserved. |
| F27 | Reminder due exactly boundaries; moved/cancelled/suspended/reactivated | Eligible future only; expired/uncertain work never caught up; ordinary human flow untouched. |
| F28 | Lost original offer/resource draw/effect ordinal/format version | Never invent provenance from deterministic hash or current reducer; hold. |
| F29 | DB failover loses arm; old host resumes; rollback code old format | Independent possible-effect evidence holds; no new owner until externally contained; no auto HA claim. |
| F30 | Copied/manual event/forged private properties/cross-tenant tuple | No customer leak/send/mutation/adoption; keep unmanaged occupancy. |

Global stop: any failed INV01–17, executable bypass client, unsealed dispatch, reusable token, unsafe grant restoration, unknown recovery completeness with effects enabled, wrong-tenant authority, hidden SDK retry, or critical independent-review finding blocks promotion regardless of aggregate test count.
