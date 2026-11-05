# Independent review — L1 availability and transcript reference

Review source **afa1b74efa8f8edab5d9c4fc115e2ca60daf1f7c**, tree
6073fda1fc610f2bc496c7df932edf9e010a2906, parent C1 evidence c24b7e4.
Evidence follow-up adds only this handoff and vnext/evidence/wp2-l1/.
Verify split, source/artifact hashes and the unchanged legacy pure oracle source.

[Implementation](../22-L1-AVAILABILITY-AND-TRANSCRIPT-ORACLE.md) and
[results/reproduction](../../../vnext/evidence/wp2-l1/README.md).
Node24.19/PG17.11:287 full,277 fault,148 concurrency PASS, zero skips.
Each includes80 acceptance cases (28 L1 +52 C1/O2/O4), plus30 baseline differential
comparisons within the differential test. Frozen install/typecheck/confinement pass.

Challenge complete/scoped pagination, changed snapshots, partial/failed/timed-out
reads, conflicting/foreign events, UNKNOWN/conservative shared calendar semantics,
hours/employee availability/qualifications/absence, one-service duration/buffers,
half-open overlaps, timezone/DST and30+15/365 search. No failed read means free.
Final slot selection must re-read its date; availability is not a reservation.

Challenge frozen two suggested slots, more two, date pages/time pages, only-shown
tenant/view/TTL actions, known direct selection, new-customer name-after-slot
reference event and human ownership until Menu. The reference emits BOOK_REQUEST,
not a success/send/effect. Actual validated names/natural-language dates, durable
conversation/actions/replies and browser/dispatcher composition are L2, not claimed.

The acceptance selector carries all C1 crash/freeze/entry/expiry/race tests and
O3 actual PG contention/50ms/3000ms timeout samples. Review the distinction between
resource conflicts, PLAN_INVALID and terminal LOCK_TIMEOUT. Check that a rejected
input cannot be retried and a new choice can progress. Latencies are end-to-end,
not isolated lock waits or Windows SLOs. L2 must tell the customer to choose again.

From vnext run npm ci --ignore-scripts, typecheck, check:scope, test:l1,
demo:transcript, npm test, test:fault, test:concurrency. Report exact environment,
what you execute versus review, findings and explicit bounded L1 verdict.
C1 independent acceptance must precede L2 interactive booking; do not self-close it
by reviewing only the reference transcript. Windows runtime is separately reviewed;
native Windows acceptance is NOT RUN here.

O5 sealed-reducer trust and O6 human-priority semantics remain. X1/F13,009/011/017,
N2/N3,A2/A3,013/016,OPS01 and Windows/N6/provider/cloud gates stay open.
No merge, Meta/Google, GCP or v0.8.1 changes. Keep existing and new PRs Draft.

