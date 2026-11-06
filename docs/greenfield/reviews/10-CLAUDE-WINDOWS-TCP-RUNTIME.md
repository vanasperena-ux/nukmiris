# Independent review — Windows-targeted TCP/runtime

Review exact source **e04099da54d3e881897a57fbe235ef54aaf56f5a**, tree
99097a3eaea600aa68b5bf2cd33442d2011f5a61, parent f0fc737 (prior runtime evidence), C1 base c24b7e4.
The follow-up adds only this handoff and vnext/evidence/wp2-runtime/. Check split
and source/artifact hashes. Separate Draft PR stacked on C1; no existing PR merged.

[Implementation/Windows commands](../21-WINDOWS-TCP-LOCAL-RUNTIME.md) and
[evidence](../../../vnext/evidence/wp2-runtime/README.md).
Executed: 10 local TCP/CLI,259 full,249 fault,120 concurrency PASS, zero skips,
Node24.19/PG17.11. **Linux only; native Windows remains NOT RUN**.

Challenge local fixture isolation: explicit local Docker socket/named pipe, generated
SCRAM passwords, loopback-only fixed ports, random prefixed resource/DB identities,
label checks before destruction, no unknown/default DB fallback, private state/
Windows SID ACL commands, occupied paths/ports, no credential leakage in error logs.
Verify UTC at server/database/client (E1), including a Mexico City role default.

Challenge portable child start/IPC stop/crash, detached token-bound stop/restart,
stale identity/occupied port behavior, retained DB identity and no raw-PID takeover.
Run all published prepare/start/smoke/backup/stop/reset CLI commands. Wrong reset
confirmation must leave data intact; correct reset backs up first and affects only
its verified resources. Backup verification restores to a fresh inert target and
refuses corruption. This backup is inert-fixture-only; it does not claim L2 custody/
ledger backup or operational restore. Extend that before L2 persistence.

The actual core booking smoke uses a separate ephemeral TCP DB, indexed archive/
same-host fixture witness, synthetic literal input and loopback fake provider. C1
supersedes never-entered work; one booking+confirmation yields exactly two calls.
Persistent demo DB remains suspended/dispatch-disabled; health has no booking route.

From vnext run npm ci --ignore-scripts, npm run typecheck, npm run check:scope,
npm run test:runtime, npm test, npm run test:fault, npm run test:concurrency.
Record exact environment, executed versus reviewed evidence and Windows limitations.
Native owner smoke must be executed on Windows, not inferred from this Linux run.

C1 independent acceptance remains required before L2 interactive booking. All
production custody/repair/provider/OPS01/Windows gates, X1/F13, O5/O6 remain.
No merge, Meta/Google, GCP or v0.8.1 changes. Keep this and existing PRs Draft.


Explicit generated credentials are required before TCP connection. Missing/invalid
private-state credentials and unknown roles are rejected without pg environment
fallback; these regressions are included in the local suite.
