# NukMiris vNext WP1: independent review of CP1 and initial CP2

**Reviewer:** Claude (independent; Sonnet 5.5). **Date:** 2026-11-01.
**Tested source:** `108adb62604b9963bd3468ab8b43c36b69fcef6e`; evidence commit `d184f32`; PR #4, branch `implementation/wp1-synthetic-safety-slice`.

**Recommendation: GO WITH SPECIFIED REVISIONS, covering Checkpoint 1 and initial Checkpoint 2 of WP1 only.** No production, provider or WP2 authorization follows.

This is an independent review report. It changes no application code, tests, evidence or Codex implementation.

## 1. Executive summary

The WP1 core is a sound foundation. Its main safety properties held when attacked: one possible invocation per admitted attempt, tenant isolation under restricted roles, direct-write denial, and fail-closed handling of foreign owners and proofs. The SQL gate functions, however, trust data and parameters that the caller supplies, and four of those gaps are reproducible High defects. I found no Critical defect: every defect I reproduced needs a faulty or compromised reducer, sealer or ingress process, not an external customer.

- **CR-WP1-002:** a sealed batch can be extended after sealing, so an input that was never archived or sealed becomes ELIGIBLE.
- **CR-WP1-003:** `enter_submission` accepts a NULL timestamp and skips the due, deadline, appointment-start and 24-hour-window checks.
- **CR-WP1-004:** the reminder-consent check keys off the sealed envelope's own `purpose` field, not the output row. A REMINDER output labelled CUSTOMER_REQUEST is admitted for a customer who sent STOP.
- **CR-WP1-005 (forward-looking, blocks WP2):** a webhook batch that mixes tenants is rejected wholesale before any STOP is recorded. That couples tenants and can drop a withdrawal.
- **CR-WP1-001 (F13):** Codex disclosed this honestly. I confirm the SQL gate ordering, and specify below what a deployed fence must do and how to test it.

The Medium findings concern ordering gaps, restore losing a suspension, an unauthenticated seal boundary, orphaned guards after suspension, and archive lockout. All are fixable inside the WP1 shape. Codex's passing counts (64 and 54) were not reproduced here (see section 2).

## 2. Evidence inspected, and limitations of my review

**Inspected in full** (branch `implementation/wp1-synthetic-safety-slice`):

- the review handoff (doc 11) and the checkpoint-1 evidence README
- the WP1 charter (08), the status record (10) and `vnext/README.md`
- every `src/` file: `001-foundation.sql` (228 lines), `002-execution.sql` (331), `roles.sql`, and all of `application/`, `domain/` and `infrastructure/`
- the test support code, `fake-archive.ts`, `process.test.ts`, and the names and counts in both raw logs
- the F13 evidence JSON

**Integrity checked.** All 34 SHA-256 values in `tested-source-manifest.json` match the checked-out files at `108adb6`. The `src/` and `test/` trees are identical between `108adb6` and the evidence commit `d184f32`. The logs record 64/64 and 54/54 passing.

**What I ran.** Codex's exact migrations and `roles.sql` applied cleanly to PostgreSQL 16.15 under `fsync=on`, not the pinned PG 17.11 image. I then drove every SQL function under the restricted roles (`wp1_ingress`, `wp1_sealer`, `wp1_reducer`, `wp1_dispatch`, `wp1_result`, `wp1_operator`, `wp1_recovery`, `wp1_tenant_*`). I built sealed plans, ARM seals, results and output plans by hand, and ran a two-session race between the gate and a suspension. Reproduction scripts are in the NukMiris Claude Project as `claude/wp1-review-repro-scripts.md`.

**Limitations (what I could not run).**
- I did not reproduce Codex's 64 + 54 Node tests, the 1,000 seeded schedules, or the process tests (SIGSTOP/SIGKILL). The sandbox has no Docker and has Node 22 instead of 24. The egress proxy returned HTTP 403 for the npm registry, so I could not install `pg` or TypeScript, and I did not try to get around that policy.
- Everything labelled *verified* is a SQL-level reproduction on PG 16.15, not 17.11.
- Anything labelled *static* is deduced from reading code and was not executed.
- The repository code was not modified, nothing was merged or deployed, and no provider was contacted.

**Evidence labels.** *Verified* = reproduced by me on Codex's SQL. *Static* = code reading only. *Codex-reported* = taken from Codex's logs, not reproduced. *Assumption* = untested.

## 3. Strengths confirmed

These held under my own attacks (verified unless noted):

- **One-use admission.** After `arm` succeeds, a second `enter_submission` returns false. A foreign owner returns false. A second `arm` for a different owner is refused (`unsealed_arm`). `attempt.owner_id` is immutable once set (trigger, `002:83-85`).
- **No direct writes.** `wp1_dispatch` and `wp1_tenant_a` get `permission denied` on `UPDATE`/`INSERT`. `SET ROLE wp1_definer` is denied. `PUBLIC` has `EXECUTE` on zero `core` functions.
- **Tenant isolation at the SQL role layer.** With scope set to B, the tenant-A role sees 0 rows. A role scoped to A cannot call `stage_batch`, `mark_unknown` or `apply_result` for B. Composite FKs carry `business_id`, and the protection exclusion constraint includes `business_id`. I found no cross-tenant read, write or effect path.
- **Gate versus suspension ordering.** In two real sessions the gate transaction held `FOR SHARE` on the business row, and `set_status` blocked about 1.3 s until the gate committed. A gate call after the suspension returned false. This matches Codex's F12/F13 account.
- **Fail-closed proofs.** A result whose `remoteId` does not match the event is refused (`stale_finalizer`). A tampered seal body is refused (`seal_conflict`).
- **Restore is inert.** After restore, `dispatch_enabled=false`, `recovery_epoch` is bumped, all permission heads are suppressed with a bumped revision, and armed or entered attempts become UNKNOWN.
- **Documentation honesty.** F13 is disclosed as unresolved rather than relabelled as passing. The docs state the sealer and archive limits.
- **Test intent (Codex-reported, not re-run).** Process-level SIGSTOP and SIGKILL cases, lost-commit variants, and a real row-lock wait for STOP are covered by the named tests.

## 4. F13 assessment (CR-WP1-001, High, blocks real provider calls)

Codex's framing is correct. The counterexample is real, and I do not accept it as a physical cutoff.

### 4.1 What the synthetic implementation guarantees

- **Serialization of the decision (verified).** `enter_submission` (`002:195-237`) takes `FOR SHARE` on the business row. `set_status` (`001:215`) takes `FOR UPDATE`. In my two-session run the suspension waited about 1.3 s for an in-flight gate and a later gate returned false. Every gate decision is therefore either wholly before or wholly after a suspension.
- **At most one invocation per admitted attempt (verified at SQL, Codex-reported at process level).** The state CAS `ARMED` to `SUBMISSION_ENTERED` succeeds once, per owner. The permit is a closure boolean (`dispatch-once.ts:33-38`) that is never persisted, so a restart cannot recreate it.
- **Revision invalidation (static).** Any business revision or recovery-epoch change makes every pre-change envelope permanently inadmissible (`002:212`, `002:180`).

That is all it guarantees: a decision point, not a physical event.

### 4.2 What database locking alone cannot guarantee

The lock is released at COMMIT, before the HTTP request exists. The interval from COMMIT to the first byte at the provider is unbounded: process pause, VM snapshot or thaw, GC, a stalled connection pool or DNS, TCP retransmission, or a proxy queue. Holding the lock across the HTTP call does not fix this either:

- A paused holder makes suspension block indefinitely, so the control that exists to stop a tenant cannot act.
- A dead holder releases the lock while bytes may already be on the wire.
- It also contradicts the known-commit continuation design.

The provider, not the database, is where the effect happens, and neither Meta (no idempotency or fencing token) nor Google (ETag only guards the event) offers a cutoff keyed to our business state.

### 4.3 What deployed controls could address (credible design)

Move the physical send out of the worker into a small **submission gateway** that is the only holder of provider credentials, and make the worker's authority a short-lived ticket.

- **Credentials.** Workers hold no Meta or Google secret. The egress firewall allows provider hosts only from the gateway identity. Tested by an attempted direct connection from a worker identity.
- **Ticket.** After `enter_submission` commits, the worker requests a ticket bound to `{attemptId, payloadDigest, businessRevision, recoveryEpoch, notAfter}`. `notAfter` is at most `budgetSeconds` on the gateway's own clock, never the worker's.
- **Gateway recheck at send time.** The gateway re-reads the business row (`status`, `revision`, `recovery_epoch`, `dispatch_enabled`) in a short transaction, consumes a one-row `ticket_use` record (unique on `attemptId`), and sends within a hard timeout. A worker that thaws late presents an expired or already-consumed ticket. A suspended business is refused.
- **Suspension procedure.** `set_status('SUSPENDED')` commits, then flips a per-tenant gateway kill flag and revokes or rotates the tenant's provider credential. Fence a suspected-dead old instance by network isolation or termination before any successor runs.
- **Hard transport deadline.** The envelope's `budgetSeconds` must become an enforced timeout (CR-WP1-013), otherwise the 2 s arithmetic in `enter_submission` is fiction.

This converts the unbounded window into the gateway's own verify-to-send window, a few milliseconds in one small process. It does not remove the window.

### 4.4 Residual risk after those controls

- A request already accepted by the gateway when suspension commits will still go out. Bound: gateway verify-to-write time plus provider acceptance latency, measured, not assumed.
- Gateway pause between recheck and write. Mitigated by a short ticket lifetime and a single-purpose process, not eliminated.
- Credential revocation latency at Meta and Google is **unknown** (assumption). It must be measured in sandbox accounts before it is relied on.
- Anything already delivered to a customer cannot be recalled.
- If the gateway cannot reach PostgreSQL it must refuse, trading availability for safety.

The owner should decide explicitly whether a bounded late send to a suspended tenant is acceptable. If it is not, no design here can promise it.

### 4.5 Tests that must pass before any real Meta or Google call

1. **Direct egress denial.** From each worker identity, a TCP connect to every provider hostname fails, and no provider secret is present in worker environment, memory dump or logs.
2. **Expired ticket.** Freeze the worker (SIGSTOP or VM pause) after ticket issue for longer than `notAfter`, suspend, thaw. The gateway refuses and the provider-ledger count is 0.
3. **Consumed ticket.** A replayed ticket, or a ticket from a second worker for the same attempt, is refused (unique `ticket_use`).
4. **Suspension at every gateway step.** Inject a suspension before ticket issue, between issue and recheck, and after recheck before write. Record provider-observed time against suspension-commit time for each. Over at least 10,000 randomized runs, publish the maximum observed lag and require it to be within the stated bound.
5. **Gateway freeze after recheck.** Pause the gateway process after recheck, suspend, resume. Document the outcome as the residual and show the lag stays within the bound, or that the request is abandoned by the deadline.
6. **Old-instance fencing.** Isolate the old instance at the network layer, thaw it, and show 0 provider requests from it.
7. **Credential revocation (sandbox accounts only).** Measure revoke-to-first-refused-request latency for Meta and Google, and record the worst case.
8. **Gateway cannot reach PostgreSQL.** The gateway refuses and no provider request is made.
9. **Timeout enforcement.** A stalled upstream is aborted at `budgetSeconds`, marked UNKNOWN, and never retried.

## 5. Findings index

"Blocks" names the earliest gate the finding must be closed before.

| ID | Severity | Finding | Evidence | Blocks |
| --- | --- | --- | --- | --- |
| CR-WP1-001 | High | F13: an admitted request can leave after suspension | Verified gate order; physical window disclosed | Real provider calls, production |
| CR-WP1-002 | High | A sealed batch can be extended; an unsealed input becomes ELIGIBLE | Verified | CP1 |
| CR-WP1-003 | High | NULL timestamp skips the due, deadline, start and window checks | Verified | CP1 |
| CR-WP1-004 | High | Reminder consent check trusts the envelope's own `purpose` | Verified | CP1, CP2 |
| CR-WP1-005 | High | A mixed-tenant webhook batch is rejected before STOP is recorded | Static | WP2, production |
| CR-WP1-006 | Medium | Envelope payload and ids are not bound to the sealed plan | Verified | CP2 |
| CR-WP1-007 | Medium | Per-conversation ordering is not enforced across unresolved earlier work | Verified | CP2 |
| CR-WP1-008 | Medium | Restore turns a suspended business back to ACTIVE | Verified | WP2, production resume |
| CR-WP1-009 | Medium | Seal registration accepts any digest; seal roles share one process | Verified, static | CP2 documentation, production |
| CR-WP1-010 | Medium | No safe way to abandon an orphaned PREPARED or ARMED attempt | Verified (PREPARED), static (ARMED) | WP2 |
| CR-WP1-011 | Medium | One crash can lock the archive with no repair path | Static, test log | Production |
| CR-WP1-012 | Medium | NULL `now_time` accepts a future-dated grant | Verified | CP2 |
| CR-WP1-013 | Medium | `budgetSeconds` is never enforced as a transport deadline | Static | Real provider calls |
| CR-WP1-014 | Low | `set_status` replay ignores the status value | Verified | None |
| CR-WP1-015 | Low | Immutability triggers cover 3 of 22 tables | Static | None |
| CR-WP1-016 | Low | Receipt correlation relies on a field Meta may not return | Assumption | WP2 |
| CR-WP1-017 | Low | Every archive call decrypts the whole chain | Static | WP2 |

No Critical finding. Findings 002 to 004 are reachable only through a faulty or compromised reducer, sealer or ingress caller, not by an external customer. They still break the SQL-level claims that the gate is the last line of defence.

## 6. High findings

F13 (CR-WP1-001) is covered in section 4.

### CR-WP1-002: a sealed batch can be extended (High, blocks CP1), verified

- **Where:** `001-foundation.sql:126-151` (`stage_batch`) and `:153-164` (`activate_batch`).
- **Invariant:** INV01/02, "unsealed STAGED work can never execute" (handoff, Q7/SC1).
- **Scenario:**
  1. Stage input p1 in batch `batch1` with digest D1. Seal `BATCH_COMMIT` (body has only `batchId` and `batchDigest`) and activate. p1 is ELIGIBLE.
  2. Call `stage_batch` again with the same `batch_id` and the same D1, but with an extra item p-EXTRA that was never archived. The batch conflict test (`:134`) compares only the digest string. p-EXTRA is inserted STAGED and added to `batch_input` (`:149`).
  3. Call `activate_batch` with the original seal. It checks only batch id and digest (`:157-159`), then flips every member of the batch to ELIGIBLE (`:162-163`).
- **Observed:** `p-EXTRA|ELIGIBLE`. ELIGIBLE is the only input state that `prepare_operation` requires (`002:104`); I did not run a further operation on it. **Expected:** staging into a non-STAGED batch is refused, and the seal must bind the exact membership.
- **Fix:** (a) `stage_batch` refuses when the batch is already ELIGIBLE or sealed. (b) The seal body carries `count` and a membership digest; SQL recomputes both over `batch_input` and refuses on mismatch. (c) `activate_batch` is idempotent only for an already-ELIGIBLE batch and never re-flips new members. TypeScript already writes `count` into the seal (`admit-input.ts:57`); SQL ignores it.
- **Test:** the sequence above must fail at step 2. Add a case where a sealed batch has one member removed or added directly in SQL, and show activation refuses.

### CR-WP1-003: NULL timestamp skips the final time checks (High, blocks CP1), verified

- **Where:** `002-execution.sql:229-231` (the condition), signature at `:195`; caller `dispatch-once.ts:28-29`.
- **Invariant:** INV09, G06 and F27 "due, deadline, budget, appointment start, 24-hour window".
- **Scenario:** with an armed attempt whose deadline is 09:15, `enter_submission(..., '2030-01-01T12:00:00Z')` returns `false`. The identical call with `NULL` returns `true` and the attempt becomes `SUBMISSION_ENTERED`.
- **Why:** the function is not `STRICT`. With a NULL argument every comparison in the `OR` chain is NULL, and plpgsql treats `IF NULL` as false. For `REMINDER` the final clause is `FALSE AND NULL`, also not true. Codex tested JSON nulls (DB06) but not NULL parameters.
- **Related:** the time used is whatever the caller passes. A skewed or wrong worker clock moves every check. The database already has the authoritative clock.
- **Fix:** read `clock_timestamp()` inside the function, and if a caller-supplied time is kept, require it non-NULL and within a small skew of the database clock. Declare these functions to reject NULL arguments, and write each guard as `IF NOT (cond) THEN deny` so that NULL means deny. Apply the same review to every `IF a<>b OR ...` chain that reads JSON (`:209-212`, `:215`, `prepare_operation :113-125`).
- **Test:** a table-driven test that passes NULL, `infinity` and out-of-range values for every parameter of every gate function and expects false or an error. Include one past-deadline case that must stay false.

### CR-WP1-004: reminder consent trusts the envelope's `purpose` (High, blocks CP1 and CP2), verified

- **Where:** `002:215` reads `e->>'purpose'`. `prepare_output` (`:165-166`) checks recipient and payload digest but never compares `e->>'purpose'` to `output_intent.purpose`.
- **Invariant:** INV08, "persistent permission head and final lock"; a STOP must win over a reminder.
- **Scenario:** an output row has purpose `REMINDER`. The customer sends STOP (head `suppressed=t`, revision 1). A sealed `OUTPUT_PLAN` whose envelope says `CUSTOMER_REQUEST` is accepted by `prepare_output`, armed, and `enter_submission` returns `true`. With the envelope saying `REMINDER` it correctly returns `false`.
- **Why it matters:** the last consent check relies on a field produced by the previous, trusted-by-convention stage. The TypeScript builder copies the row's purpose correctly (`prepare-operation.ts:74`), so this is a defence-in-depth hole, but consent is the invariant that matters most.
- **Fix:** in `enter_submission` read `o.purpose` from the locked output row and use that, not the envelope. In `prepare_output` require the envelope's `purpose`, `conversationId`, `dueAt`, `deadlineAt`, `channelId`, `calendarId` and `permissionRevision` to equal the row-derived values.
- **Test:** one case per mismatched field that must be refused at `prepare_output`, plus the STOP scenario above as a regression test.

### CR-WP1-005: a mixed-tenant webhook batch loses STOP (High, blocks WP2 and production), static

- **Where:** `admit-input.ts:34` throws `single_business_batch_required` before the withdrawal loop at `:38-42`.
- **Invariant:** cross-tenant isolation, and revocation priority.
- **Scenario:** one signed webhook POST contains entries for two businesses, A and B, and a customer of A sends STOP. The whole request is rejected, nothing is suppressed, and the provider will retry the identical payload. Business B is blocked by A's traffic and vice versa. If the provider eventually drops the payload, the STOP is lost.
- **Status:** the docs disclose "mixed-tenant batches rejected in this slice" but not the STOP and cross-tenant consequence. I could not run this; the conclusion is from code. Whether Meta batches multiple WABAs in one POST is an assumption to confirm against current Meta documentation before WP2.
- **Fix:** split a verified payload per business before any write, process each independently, and run the withdrawal path for every message first. Acknowledge only when every part is durable.
- **Test:** a two-business payload containing a STOP for A must record A's suppression, admit B's message, and return acknowledged only after both are sealed. Also a payload where B's part fails must not undo A's suppression.

## 7. Medium findings

### CR-WP1-006: envelope not bound to the sealed plan (blocks CP2), verified

- **Where:** `002-execution.sql:149-150` inserts `p->'envelope'` as the attempt. Only the CHECK constraints at `:60-70` validate it, and they test shape, not agreement with the plan.
- **Scenario:** my plan reserved `10:00` to `11:00` on a resource. Its envelope `payload` was `{"kind":"CREATE"}` with no times, event or resource. The plan was accepted, armed and admitted. What would be sent to Google therefore need not match the protected range.
- **Why not just trust the sealer:** the sealer is a fixture-level trust root (CR-WP1-009) and SQL is the declared last gate.
- **Fix:** have SQL require that `envelope.calendarId`, `recipient`, `channelId`, `conversationId` and the envelope payload's `startAt`, `endAt`, `resourceId`, `eventId` equal the plan and the locked input, and recompute `payloadDigest` over the payload.
- **Test:** one mismatched-field case per property; each must be refused at `prepare_operation`.

### CR-WP1-007: ordering across unresolved earlier work (blocks CP2), verified, two variants

- **Where:** `002:104` (`prepare_operation` requires only `ELIGIBLE`) and `:220-221` (ordering looks only at output rows that already exist).
- **Invariant:** Q4/Q5, SC7 per-conversation output order. The accepted v0.8.1 processed each customer in order.
- **Variant A:** input 1 stays `STAGED` (never sealed). Input 2 is `ELIGIBLE`. An operation for input 2 is prepared, armed and admitted while sequence 1 has not been sealed.
- **Variant B:** the operation for sequence 1 is `SUBMISSION_ENTERED` with an unknown outcome. Sequence 2's operation completes and its customer message is admitted (`enter_submission` returned `true`). Sequence 1's output row does not exist yet, so nothing blocks it. It will be created later and sent after sequence 2's.
- **Fix:** a conversation head. An operation or output for sequence N is admitted only when every lower sequence in the conversation is terminal (outputs ACCEPTED or EXPIRED, operations resolved or recorded as a reviewed hold), or an explicit documented exception for independent appointments.
- **Test:** both variants must return false. Add a case where sequence 1's operation is UNKNOWN and confirm sequence 2 is held.

### CR-WP1-008: restore loses a post-snapshot suspension (blocks WP2 and any resume path), verified

- **Where:** `roles.sql:16-45` (`restore_snapshot`) and `001:224-225` (`set_status` writes only SQL; no archive record). `restore-inert.ts:11-14` passes only archive records.
- **Scenario:** snapshot at revision 1 (ACTIVE). Suspend the business afterwards. Restore the snapshot into an empty database with an empty evidence list. Result: `status=ACTIVE, revision=1, recovery_epoch=2, dispatch_enabled=false`. The suspension is gone, while a STOP, by contrast, survives through archive evidence.
- **Mitigating:** `dispatch_enabled=false` and the epoch bump keep it inert today. But the moment a resume step is written, a previously suspended tenant looks ACTIVE.
- **Fix:** archive a sealed `SUSPEND` record at suspension time, and have restore set every business to `SUSPENDED` until a sealed `REACTIVATE` for the restored revision is supplied.
- **Test:** the scenario above must restore as SUSPENDED.

### CR-WP1-009: the seal boundary is procedural (blocks CP2 documentation and production), verified and static

- **Where:** `001:115-124` (`register_seal`); `worker-process.ts:17-21,36-37`; `dispatch-once.ts:6-16`.
- **Verified:** I registered seals with invented digests such as `ddd...d`, `000...0` and a body of `{"anything":1}`. All were accepted. SQL checks that `digest`, `key` and `kind` agree with their own copies and never recomputes a hash of the body.
- **Static:** the test worker holds `sealer`, `dispatch` and `result` pools in one process, and `armAttempt` takes both a dispatcher and a sealer. The "independent" ARM record is independent in the archive, not in privilege.
- **Effect:** anyone who can run `register_seal` can mint a plan, ARM or RESULT seal. Codex states this boundary openly; the finding is that SQL adds no authentication beyond string equality, so the "independent seal" is only as strong as the one process that writes it.
- **Fix:** SQL recomputes the body digest, or verifies an HMAC with a key available only to the definer role. Deployment gives the sealer its own process and credential, not reachable from the dispatcher.
- **Test:** a forged seal with a wrong digest is refused; a dispatcher credential cannot call `register_seal`.

### CR-WP1-010: orphaned attempts have no safe exit (blocks WP2), PREPARED verified, ARMED static

- **Where:** `002:138-148` creates the guard and protection at prepare time; the only code that releases them is `apply_result` (`:276-284`). `mark_unknown` handles only `SUBMISSION_ENTERED` (`:243`). Owner reassignment is blocked by the trigger (`:83-85`).
- **PREPARED, verified:** prepare an operation, suspend (revision 1 to 2), reactivate with a sealed `REACTIVATE` (to 3). The attempt can no longer be armed (`arm` returns false), yet the guard, the protection and the `PLANNED` appointment remain. Nothing in the schema releases them, so the time slot is held permanently.
- **ARMED, static:** if the owner dies after `arm`, no other owner can proceed and no function moves `ARMED` to `UNKNOWN` (only `restore_snapshot` does, `roles.sql:29`).
- **Note:** Codex's F11 test asserts this stuck state as a pass. Fail-closed is acceptable for WP1, but an operator-visible, sealed disposition path is needed before WP2.
- **Fix:** add a sealed `abandon` for attempts that provably never reached `SUBMISSION_ENTERED` (stale revision or epoch, or dead owner), releasing guard, protection and appointment. For `SUBMISSION_ENTERED` the existing UNKNOWN path applies.
- **Test:** the scenario above ends with the slot free and a new operation accepted; an abandon of a `SUBMISSION_ENTERED` attempt is refused.

### CR-WP1-011: one crash can lock the archive (blocks production), static plus test log

- **Where:** `fake-archive.ts:45` (lock never stolen), `:51-52` (head must equal witness), `:88-90` (head written, then witness, as separate renames). `ingress.test.ts:60` asserts the locked-out state after `archive.afterHead`.
- **Scenario:** SIGKILL between the head and witness renames leaves `head != witness`. Every later `records()` throws `archive_head_unknown`, so every admission, seal and dispatch fails until a person intervenes. A crash while holding `append.lock` does the same.
- **Note:** this is a stand-in archive and Codex says so. The finding is that no repair procedure is specified or tested, and STOP is the only path that still works.
- **Fix:** define and test a repair step (verify chain, adopt the longer consistent head, record the decision) before any real archive is chosen.
- **Test:** kill at each archive cut, then run the repair, then admit successfully.

### CR-WP1-012: NULL `now_time` accepts a future-dated grant (blocks CP2), verified

- **Where:** `001:203`.
- **Scenario:** a sealed grant dated `2031-06-01` with `now_time = 2030-01-01` is refused (`stale_grant`). The same grant with `now_time = NULL` is accepted: head revision 1, `suppressed=f`.
- **Fix and test:** the same remedy as CR-WP1-003. Use the database clock, reject NULL, and add the NULL cases to the grant tests.

### CR-WP1-013: `budgetSeconds` is not a deadline (blocks real provider calls), static

- **Where:** `002:229-230` assumes a transport of at most `budgetSeconds`; `dispatch-once.ts:35-43` sets no timeout or abort on `submitOnce`.
- **Effect:** a stalled call can complete after appointment start or after suspension. This is the second half of F13.
- **Fix and test:** enforce an abort at `budgetSeconds` in the real adapter; on abort mark UNKNOWN and never retry. Test with a stalled fake upstream.

## 8. Low findings

- **CR-WP1-014, `set_status` replay ignores the status value** (verified; `001:216-219`). Replaying a SUSPENDED event id with `status_value='ACTIVE'` returns the old revision and reports success while the business stays SUSPENDED. Store the status in `status_event` and compare it. Test: replay with a different value is refused.
- **CR-WP1-015, immutability triggers cover three tables** (static; `002:90-92`). Only `operation`, `attempt` and `seal` are protected. `input`, `output_intent`, `permission_event`, `status_event`, `receipt` and `audit` rely on the definer functions being the only writers. Add append-only triggers and a test that a direct `UPDATE` by the owner role is refused.
- **CR-WP1-016, receipt correlation assumption** (assumption; `admit-input.ts:29`, `002:302-306`). A receipt is matched by an `attemptId` carried inside the inbound event. The synthetic shape places receipts under `messages`; Meta reports delivery under `statuses` and, as far as I know, returns only what we attach as opaque callback data. Confirm the real correlation field before WP2. Related: a late `sent` after a `failed` marks the attempt `VERIFIED_APPLIED` while `meta_status` stays `failed` (`002:309-315`). Define which fact wins.
- **CR-WP1-017, archive cost** (static; `fake-archive.ts:48-66`, `dispatch-once.ts:24`). Every `verify`, `ensure` and dispatch decrypts the whole chain, and the chain is capped at 100,000 records (`:51`). Admission cost grows linearly with history. Fine for a fixture; not a design to carry forward.

Two smaller observations: `calendar.external_id` is globally unique (`001:24`), so a tenant's calendar id can collide with another's (a probing and denial-of-service surface only if tenants can create calendars; today only the owner role can). And `expire_unsent` and `enter_submission` accept a caller-supplied time (covered by CR-WP1-003).

## 9. Missing tests

The existing suite exercises the TypeScript-driven path well. It does not attack the SQL functions with inputs the TypeScript never sends. Add:

1. **Parameter fuzz on every definer function.** NULL, `infinity`, `-infinity`, empty string, wrong business, and a zero or nil UUID, for every argument. Expect a denial or an error, never a state change (CR-003, CR-012).
2. **Seal binding.** For each seal kind, a seal valid in key and digest but disagreeing with the row on membership, count, purpose, conversation, channel, calendar, payload or times (CR-002, CR-004, CR-006).
3. **Out-of-order conversation.** Variants A and B from CR-007, plus an UNKNOWN earlier operation.
4. **Suspend-then-restore.** Snapshot, suspend, restore; the business must restore SUSPENDED (CR-008).
5. **Orphan disposition.** Reactivate with a PREPARED attempt, kill an owner after ARM, then show the slot and the head are released only through a sealed, audited path (CR-010).
6. **Mixed-tenant payload** with a STOP for one tenant (CR-005).
7. **Archive repair.** Kill at each archive cut, then repair and continue (CR-011).
8. **Direct-DML denial by the table owner**, to prove append-only behaviour (CR-015).
9. **Role separation.** The dispatcher credential cannot call `register_seal`, and the sealer credential cannot call `enter_submission`.
10. **F13 gateway tests 1 to 9** (section 4.5), before any real provider call.
11. **Reproduction on the pinned target.** Re-run the 64 + 54 suite on PostgreSQL 17.11, and run the SQL tests above on 17.11 as well.

## 10. Remediation instructions for Codex

Do these in order. Each step ends with its verifying test merged into the same change, and a rerun of the full suite.

1. **Close the SQL gates (CR-003, CR-012).** Use the database clock for every time comparison. Make each guard fail closed on NULL. Add the parameter-fuzz test.
2. **Bind the seals to the rows (CR-002, CR-004, CR-006).** Batch membership and count; output purpose, conversation, channel, calendar and times; operation envelope payload against the plan. Reject staging into a sealed batch.
3. **Order within a conversation (CR-007).** Add a conversation head so later work waits for earlier work.
4. **Restore and suspension (CR-008).** Archive a `SUSPEND` record, and restore every business as SUSPENDED.
5. **Orphans (CR-010).** Specify and test a sealed abandon path, or explicitly disable the capability and record it as a WP2 prerequisite.
6. **Seal authentication (CR-009).** Recompute or verify the seal in SQL, and separate the sealer credential and process from the dispatcher.
7. **Documentation.** Record CR-005, CR-011, CR-013 and CR-016 as WP2 or production gates with the tests listed. Correct "verified" wording where it overstates what SQL checks.
8. **Re-run on the pinned PG 17.11 image** and publish the new raw logs and source manifest. Provide a dispositions table: accepted, corrected, disputed or disabled, with the evidence for each.
9. **F13 (CR-001).** Do not change WP1 code for this. Produce the gateway design and the nine tests as an OPS01 deliverable before WP5, and keep the existing residual-counterexample test in evidence.

Out of scope for this charter, and not demanded here: real archive custody, HA, KMS, individual operator authentication, native Windows behaviour, and any WP2 provider or UI feature.

## 11. What blocks what

| Gate | Findings that must be closed or dispositioned |
| --- | --- |
| WP1 CP1 | CR-WP1-002, 003, 004 |
| WP1 initial CP2 | CR-WP1-004, 006, 007, 012; CR-WP1-009 documented |
| WP2 development | CR-WP1-005, 008, 010, 016, 017 |
| Real Meta or Google calls | CR-WP1-001 (OPS01 gateway and its nine tests), 013 |
| Production activation | All of the above, plus CR-WP1-009 (seal authentication) and CR-WP1-011 (archive repair) |

CR-WP1-014 and 015 block nothing.

## 12. Recommendation

**GO WITH SPECIFIED REVISIONS**, covering Checkpoint 1 and initial Checkpoint 2 of WP1 only.

The design is the right shape and its core properties held against my attacks, so NO-GO is not warranted. CP1 and CP2 stay open until Codex corrects CR-WP1-002, 003 and 004 (High) and CR-WP1-006, 007, 008 and 012 (Medium, CP2), with the tests above passing on PostgreSQL 17.11, and disposes of every other finding in the index. Claude should then re-review those changes. Findings 001, 005, 009 to 011, 013, 016 and 017 are recorded as gates for WP5, WP2 or production and do not hold CP1.

This recommendation does not authorize WP2, a merge, a deployment, or any real Meta or Google call. Real provider calls additionally require the OPS01 gateway, the nine F13 tests, and the owner's explicit acceptance of the bounded late-send residual.
