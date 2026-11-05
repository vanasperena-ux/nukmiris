# Claude review — L2 automatic recovery and booking composition

Review exact source **6c1595ad478f261db75b2956c60c82e0a6f0f642**, tree
**c748795dc4b98bfafa994bc858eb9ea1fd9b5ab5**. Parent is corrected runtime evidence
head **6691a554f1d8a2688b18f02528cf16a89350d9d0**. This evidence follow-up changes
only this handoff and vnext/evidence/wp2-l2-prep/. Verify that split and hashes.

Responds to R1 in [PR11](https://github.com/vanasperena-ux/nukmiris/pull/11#issuecomment-6658436709)
and L1-C1–C6 in [PR13](https://github.com/vanasperena-ux/nukmiris/pull/13#issuecomment-6658774399).
C1 and L1 are independently accepted; this is executable L2 preparation on a
separate Draft branch, not a claim that the interactive application is finished.
Accepted L1 source afa1b74 is selectively incorporated without merging a Draft PR.
PR12's W1–W6 correction is separately handed off in handoff12 and still awaits
independent re-verification/native Windows execution.

Please verify:

1. **R1:** machine-sealed DEADLINE_EXPIRED binds the original attempt, payload and
   exact deadline. SQL checks authoritative DB time after the same conversation/
   appointment/attempt/resource locks. Only never-entered PREPARED/ARMED work can
   terminate; entry/expiry cannot both succeed. CREATE releases safely, MOVE restores
   its applied source/history. No operator/provider/identity allocator is involved.
2. Ordinary inbound admission recovers expired predecessors and returns the final
   reduction. Periodic RecoveryWorker covers silent deadlines, bounded tenant-bound
   cursor pages, coalesced ticks and awaitable stop. Custody failure holds guards;
   before/after-COMMIT retries reconcile the original fixed seal key. Entered/UNKNOWN
   never become eligible because time passed. Migration006 is fresh-fixture-only;
   prior migrations/roles and legacy code remain byte-identical to the parent.
3. **L1-C1–C3:** explicit service buffer reaches reservation; scoped SQL protections
   are merged once (no double buffer); same-time selection reassigns any qualified
   free employee and reserves that employee's validated core UUID. Calendar/resource
   mappings and archive tenant are mandatory. Reads are observations; exclusion
   constraints remain the final authority. Require a fresh protected reader per
   logical search/recheck and HOLD on inconsistent/foreign/incomplete observations.
4. **L1-C4–C6:** each displayed view explicitly expires after15 minutes, prior
   revision tokens stay invalid; unknown resource intervals block all employees and
   signal the operator; five-choice date views use LIST, buttons never exceed3.
   Local payload validation is not real Meta016 acceptance. L2 must persist/check
   action revision/expiry under DB authority and project signals to Needs Attention.
5. No change to one service, two suggestions/more/date, direct slot selection and
   new-customer name-after-slot. R2 remains an explicit next-UI acceptance requirement:
   Menu/next reply shows the ACTIVE appointment if its confirmation safely expired.

Executed on Node24.19.0/npm11.9.0/PG17.11: **101 focused /308 full /298 fault /
169 concurrency PASS**, zero skips; runtime **28 PASS /1 native Windows ACL SKIP**.
Typecheck/confinement pass. Suites overlap. Reproduce commands, plain logs, measured
environment/O3 values and hashes are in [evidence](../../../vnext/evidence/wp2-l2-prep/README.md).
Actual dispatcher SIGKILL, scheduler, both race orders, deadline crash cuts and
tenant/custody negatives are automated. State which commands/environment you
independently executed and return corrected/rejected or conditional findings.

Keep this and existing PRs Draft/unmerged. This branch leaves the persistent health
runtime inert; durable actions/replies, sealed real synthetic booking-intent schema,
browser UI, coherent SQL/archive/key/ledger backup and owner Windows acceptance are
next. Preserve human-mode/O5/O6 semantics, conservative DST D1, native Windows/N6,
W7, X1/F13,009/011/production017,N2/N3,A2/A3,013/016 and OPS01 gates. In particular,
monotonic witness size/epoch still does not independently verify record-chain AND
index extension. No production guarantee, provider/GCP activation or v0.8.1 change.
