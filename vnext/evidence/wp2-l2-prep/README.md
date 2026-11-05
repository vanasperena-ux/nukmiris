# L2 safety composition — executed evidence

Exact tested source **6c1595ad478f261db75b2956c60c82e0a6f0f642**;
tree **c748795dc4b98bfafa994bc858eb9ea1fd9b5ab5**.
The follow-up commit adds only this evidence directory and Claude handoff13.

| Command from vnext | Passed | Failed | Skipped | Evidence |
|---|---:|---:|---:|---|
| npm run test:l2prep | 101 | 0 | 0 | [acceptance.log](acceptance.log) |
| npm test | 308 | 0 | 0 | [full.log](full.log) |
| npm run test:fault | 298 | 0 | 0 | [fault.log](fault.log) |
| npm run test:concurrency | 169 | 0 | 0 | [concurrency.log](concurrency.log) |
| npm run test:runtime | 28 | 0 | 1 | [runtime.log](runtime.log) |
| npm run typecheck / npm run check:scope | PASS | 0 | — | [typecheck.log](typecheck.log), [scope.log](scope.log) |

Suites overlap; do not add their totals. Node **24.19.0**, npm **11.9.0**,
measured PostgreSQL **17.11 (Debian 17.11-1.pgdg12+2)**, Linux. Full/fault/
concurrency/focused suites use the pinned image's isolated Unix-socket fixture;
runtime separately exercises TCP/SCRAM/UTC and CLI lifecycle. See measured
[runtime JSON](measured-runtime.json), [summary](summary.json), environment JSONs,
[source hashes](source-sha256.txt) and [artifact hashes](artifact-sha256.txt).

Twenty-one new acceptance cases exercise automatic DEADLINE_EXPIRED recovery,
actual dispatcher death before arm/entry, the periodic worker with no new inbound,
before/after-COMMIT cuts, both entry/expiry race orders, original-key reconciliation,
MOVE history restoration, custody failure and protected entered/UNKNOWN states.
Composition tests cover buffer propagation to SQL, existing local protections
without double buffering, same-time implicit employee reassignment, per-view TTL,
unknown resource blocking/signals, tenant bindings and list/button limits.
The selector also carries the accepted 80 C1/L1 cases. The independently accepted
L1 source was incorporated into the corrected runtime branch without merging PR13;
[source provenance](source-provenance.json) records that distinction.

O3 is measured again in the full run: six workers / three slots, three prepared,
three terminal resource conflicts, zero lock timeouts; p50 **124.41ms**, p95
**225.47ms**. Forced 50ms and 3000ms lock timeouts observed **89.02ms** and
**3036.04ms**, terminalized the original input and allowed a new choice. These are
Linux synthetic observations, not Windows performance claims. See the three
L1-O3 JSON files here; no test fixture snapshots or private custody data are uploaded.

Fresh checkout of the exact source, Node24/npm11 and Docker Linux containers:

```sh
cd vnext
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm run test:l2prep
npm test
npm run test:fault
npm run test:concurrency
npm run test:runtime
```

On Windows use npm.cmd. **Native Windows execution is NOT RUN** here; the single
native ACL test is explicitly skipped. The Windows-targeted runtime is corrected
in PR12, with independent re-verification and owner-device acceptance still open.
Command mocks do not close those gates. This increment does not implement the
interactive UI or activate the persistent profile/RecoveryWorker. The next code
task is durable conversation/actions and typed ordered replies, then the minimal
loopback booking chat/fake-calendar interface. R2 must surface ACTIVE bookings
after safely expired confirmations. See [implemented contracts/next tasks](../../../docs/greenfield/24-L2-SAFETY-COMPOSITION-READINESS.md)
and [independent handoff13](../../../docs/greenfield/reviews/13-CLAUDE-L2-SAFETY-COMPOSITION.md).

All production custody, repair, witness, provider, uncertainty and OPS01 gates
remain. No merge, v0.8.1 change, real Meta/Google, GCP, deployment or cutover.
