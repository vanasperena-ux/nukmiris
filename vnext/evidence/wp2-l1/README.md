# L1 availability/transcript evidence

Exact source **afa1b74efa8f8edab5d9c4fc115e2ca60daf1f7c**, tree
6073fda1fc610f2bc496c7df932edf9e010a2906, parent C1 evidence c24b7e4.
Evidence-only follow-up adds this directory and handoff11. Check [source hashes](source-sha256.txt)
(including the untouched v0.8.1 pure oracle) and [artifact hashes](artifact-sha256.txt).

| Command in vnext | Result | Evidence |
|---|---|---|
| npm test | 287/287, zero skips | [full.log](full.log), [environment](full-environment.json) |
| npm run test:fault | 277/277, zero skips | [fault.log](fault.log), [environment](fault-environment.json) |
| npm run test:concurrency | 148/148, zero skips | [concurrency.log](concurrency.log), [environment](concurrency-environment.json) |
| npm ci --ignore-scripts --offline / typecheck / check:scope | PASS | [install.log](install.log), [static.log](static.log) |
| npm run demo:transcript | PASS; read-only reference | [transcript.json](transcript.json), [log](transcript.log) |

Node24.19.0/npm11.9.0/PG17.11/Linux; exact Luxon3.7.2/types3.7.1 and npm integrity
lock. Full/fault/concurrency each contain80 acceptance cases:28 L1 plus52 C1/O2/O4.
The test:l1 command selects those80; suite counts overlap. Thirty differential
fixtures compare actual slot start/end against the accepted v0.8.1 engine across
five zones, DST dates, duration/buffer/break settings. Legacy source/data untouched.

[Implementation/scope](../../../docs/greenfield/22-L1-AVAILABILITY-AND-TRANSCRIPT-ORACLE.md)
covers hours, time zones, employee availability/qualification/absence, one service,
buffers/overlap, complete scoped calendar pages, stable snapshots, timeout/failure
holds,30+15/365 search, fresh selected-slot reads and deterministic two+two/date/
direct-selection reference UX. Native Windows execution is NOT RUN.

O3 full-run observations (end-to-end preparation including custody/reduction):
six contenders /three slots ->three PREPARED,three RESOURCE_CONFLICT,**zero lock
timeouts** at normal3s setting; p50 **253.41ms**, p95 **310.25ms**.
Forced50ms timeout -> **110.03ms** overall; forced3000ms -> **3050.67ms** overall.
Each terminal LOCK_TIMEOUT denies original-input retry; a new customer choice
progresses without an operator. These are host observations, not Windows/production
SLOs or estimated population failure rates. Raw readable summaries:
[contention](L1-O3-CONTENTION.json), [50ms](L1-O3-TIMEOUT-50.json),
[3000ms](L1-O3-TIMEOUT-3000.json). L2 must explain the terminal failure to the customer.

Fresh exact-source checkout, cd vnext, Node24/npm11/Docker:
npm ci --ignore-scripts; npm run typecheck; npm run check:scope; npm run test:l1;
npm run demo:transcript; npm test; npm run test:fault; npm run test:concurrency.
No install scripts or real provider integrations run. SQL/archive/private state
stays local/ignored; no opaque DB/state/key archives are published.

The transcript is a read-only reference model, not an interactive booking app:
zero calendar mutations/provider calls. Known selection emits BOOK_REQUEST directly;
new customer receives name prompt after selection, then a reference name-captured
event emits BOOK_REQUEST. Actual name/date parser, durable actions and replies,
reservation/dispatch composition and browser UI remain L2. C1 independent acceptance
is required before that flow. [Claude handoff11](../../../docs/greenfield/reviews/11-CLAUDE-L1-AVAILABILITY.md).

O5/O6, X1/F13/OPS01,009/011/production017,N2/N3,A2/A3,013/016 and Windows/N6 remain.
No merge, Meta/Google, GCP, deployment or v0.8.1 change. One service per appointment.

