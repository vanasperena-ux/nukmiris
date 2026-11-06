# Claude re-verification — W10 supported occupied-port fixture

Review exact source **3d8f82bb047e6ed937750b7ce6e81ecd23ab9f42**, tree
**94cf868b87ac48cce783d8c7a5667cedc79b7004**, parent2fcbd23. Only
vnext/local/runtime.test.mjs changes in that source. The evidence follow-up adds
only this handoff and vnext/evidence/wp2-l2-w10/. Verify the split and source hashes.

The owner actually ran PR15 source75491d9734def18471bf7b96f5004d7fd4988314 on
Windows/Node24.21.0/measured PG17.11/Docker Desktop4.98.0. Runtime: **38 PASS /
2 FAIL /0 SKIP**. Native ACL and metadata sync were EXECUTED and passed;
interactiveLocal:PASS, two synthetic bookings, crash/restart and coherent backup/
inert restore passed. This is owner-native evidence, not Codex Linux execution.

W10 is the occupied-port subtest plus its enclosing-group failure. Its listen(0)
selected a Windows ephemeral port above49151, so W8 correctly rejected it before
the child bind collision. The fixture expected local_child_failed incorrectly.

Please verify:

1. Fixture binds a random explicit supported port in20000–39999 directly, with
   exclusive IPv4 loopback ownership. It retries only failed setup binds and keeps
   the successful listener open through the entire collision assertion. There is
   no probe/close/rebind window and no assumption that a probed port stays free.
2. On the held port, start() must fail in the child bind path (EADDRINUSE or Windows
   EACCES), not W8 validation. The listener/port stay owned, no worker state appears,
   the original database stays unchanged/running, and the server closes in finally.
   Setup retries do not allow runtime fallback.
3. A separate test rejects49152,55432 and65535 with W8's exact error. Its proxy
   profile throws on any database/worker resource access, proving early rejection.
4. Runtime implementation, W8/W9, SQL, archive, identities, dispatcher, UI and legacy
   code are byte-identical to the prior source. Do not weaken W8 to fix a test.

Codex exact-source Linux execution: **39 runtime PASS /2 native-only SKIP;
445 full /435 fault /306 concurrency PASS**, zero failures. Typecheck/confinement
pass. Suites overlap. [Evidence and reproduction](../../../vnext/evidence/wp2-l2-w10/README.md).
Original app/browser evidence remains at7549; no application behavior changed.

Focused owner PowerShell re-test at this exact source, from vnext:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run build
node --test --test-concurrency=1 local/runtime.test.mjs
npm.cmd run test:runtime
```

The file-only command covers the corrected collision, separate high-port test and
published CLI lifecycle. Complete runtime also rechecks native ACL/metadata sync
and interactive booking/recovery. Return exact SHA, measured console/results and
native EXECUTED markers; do not upload state, keys, backups or databases.

State what you independently ran/reviewed and corrected/rejected conditions.
Corrected-source native acceptance remains pending; Linux/model tests do not close
it. Keep PR15 Draft/unmerged. Preserve all existing production custody/witness,
repair, provider, uncertainty and OPS01 gates. No v0.8.1, real Meta/Google, GCP,
deployment or production activation changes.
