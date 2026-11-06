# W10 — supported occupied-port test and separate W8 boundary proof

Exact tested source **3d8f82bb047e6ed937750b7ce6e81ecd23ab9f42**;
tree **94cf868b87ac48cce783d8c7a5667cedc79b7004**, parent2fcbd23.
The evidence follow-up adds only this directory and Claude handoff16.

## Owner's actual Windows execution of the earlier source

Source75491d9734def18471bf7b96f5004d7fd4988314, Node24.21.0, measured PG17.11,
Docker Desktop4.98.0: **38 PASS /2 FAIL /0 SKIP**. Native metadata sync and ACL
were EXECUTED and passed; interactiveLocal:PASS, two bookings, crash/restart and
coherent backup/inert restore passed. See [owner-native-report.json](owner-native-report.json).
W10 was one mismatched occupied-port expectation plus its enclosing test group.
The runtime correctly rejected the fixture's Windows ephemeral high port under W8.

## Correction and exact-source Codex execution

Only runtime.test.mjs changes: the collision fixture directly binds and holds a
supported low loopback listener throughout the assertion. It never probes/closes
and assumes availability. Test-setup bind retries are bounded; runtime still must
reject collision, retain the original DB, create no worker and use no fallback.
A separate proxy-backed test rejects49152/55432/65535 before DB/worker access.
All application/runtime code and W8 reserved-port safeguards remain unchanged.

Linux/Node **24.19.0**, npm **11.9.0**, measured PostgreSQL
**17.11 (Debian17.11-1.pgdg12+2)**:

| Command from vnext | PASS | FAIL | SKIP | Evidence |
|---|---:|---:|---:|---|
| npm run test:runtime | 39 | 0 | 2 native-only | [runtime.log](runtime.log) |
| npm test | 445 | 0 | 0 | [full.log](full.log) |
| npm run test:fault | 435 | 0 | 0 | [fault.log](fault.log) |
| npm run test:concurrency | 306 | 0 | 0 | [concurrency.log](concurrency.log) |
| typecheck / check:scope | PASS | 0 | — | [typecheck.log](typecheck.log), [scope.log](scope.log) |

Suites overlap. The two Linux skips are native ACL and actual Windows metadata-sync
tests; the owner's earlier Windows run executed both successfully. **The W10
corrected source has not been run natively by Codex or accepted by the owner.**
Full/fault/concurrency cover the retained application regressions, including its
158 focused L2 cases. Browser/standalone-focused commands were not re-run for this
test-only correction; their earlier evidence remains at source7549. No UI/runtime
behavior changed. See [source provenance](source-provenance.json), [source hashes](source-sha256.txt),
[summary](summary.json), [measured runtime](measured-runtime.json), environment JSONs
and [artifact hashes](artifact-sha256.txt). No private state/dumps/keys are published.

Fresh exact-source checkout, from vnext: npm ci --ignore-scripts, then the commands
in the table. Focused Windows re-test (use npm.cmd):

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run build
node --test --test-concurrency=1 local/runtime.test.mjs
npm.cmd run test:runtime
```

The file-only run includes the supported collision, high-port boundary and published
prepare/start/smoke/backup/stop/reset CLI with spaces/Unicode. The full runtime adds
interactive book/start/stop CLI, two bookings, actual crash/restart and coherent
backup/inert restore. Return exact SHA/console/measured versions, not private URLs,
state, worker logs, backups, keys or databases.

[Claude handoff16](../../../docs/greenfield/reviews/16-CLAUDE-W10-PORT-REGRESSION.md).
Keep Draft/unmerged. All production custody, archive/witness/repair, provider,
uncertainty and OPS01 gates remain. No legacy, real Meta/Google, GCP or production
activation. Milestone A remains open for independent and owner acceptance.
