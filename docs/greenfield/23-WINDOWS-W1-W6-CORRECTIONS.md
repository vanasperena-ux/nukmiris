# Windows runtime W1–W6 corrections

Implementation responds to [Claude's full PR12 review](https://github.com/vanasperena-ux/nukmiris/pull/12#issuecomment-6658674741).
C1 is independently accepted for L2 start (PR11); L1 is independently accepted for
bounded synthetic use (PR13). R1 and L1-C1–C6 remain required before L2 acceptance.
This increment fixes runtime readiness only. All PRs remain Draft/unmerged.

| Finding | Implemented behavior / verification |
|---|---|
| W1 | icacls grant uses `*S-...:(OI)(CI)F`. Read-back runs icacls and locale-independent Get-Acl/SID JSON. Exactly one Allow/FullControl current-user ACE is required, with protected directory inheritance. State files and an inherited child probe are verified on Windows. Both local/AzureAD numeric SID forms are supported. Failed protection/pull removes only the empty directory created by that attempt; existing content is preserved. |
| W2 | Explicit pinned-digest pull before Docker resource creation,600000ms timeout, then RepoDigests verification. CLI displays the first-download budget. Errors expose bounded redacted stderr and actionable Desktop/pipe/port/registry/timeout guidance, never execFile argv or raw exception causes. No alternate tag, TLS bypass or daemon restart. |
| W3 | Each candidate has a dedicated loopback command guard, held by the OS for the command lifetime. Metadata records pid/instance/startedAt/owner/port. A crash/reboot releases OS ownership; stale metadata is replaced only after acquiring that same guard. Live commands/occupied ports fail typed BUSY without stealing/killing. Empty/corrupt legacy files are retained with an explicit recovery command. No time-based lease or PID-reuse assumption. |
| W4 | Both TCP connection configuration and UnitOfWork set ssl:false; inherited PGSSLMODE=require/verify-full cannot alter the explicit loopback-only policy. UTC and generated SCRAM credentials remain mandatory. |
| W5 | Native execFile and fork options force windowsHide:true, including Docker, whoami/icacls/PowerShell and the detached health child. |
| W6 | Smoke and runtime JSON report measured server_version, not a literal17.11. Platform/native execution status is derived from the executing host. Expected image/version checks remain separate. |

The command guard protects only local CLI execution. It is **not** archive custody,
provider fencing, an attempt lease, or permission to replace a dispatcher identity.
An interrupted reset/backup may still require inspecting its retained diagnostics;
reclaiming CLI ownership does not assert that an interrupted operation completed.
New profiles persist the guard port. Old profiles use a deterministic upgrade port;
if another program occupies it, the command refuses rather than choosing a fallback.

## Run and recovery

Use a fresh checkout separate from v0.8.1, Node24/npm11 and Docker Desktop running
Linux containers. In vnext PowerShell:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run typecheck
npm.cmd run check:scope
npm.cmd run test:runtime
npm.cmd run demo:prepare
npm.cmd run demo:start
npm.cmd run demo:smoke
npm.cmd run demo:backup
npm.cmd run demo:stop
```

Prepare performs the pinned image pull automatically. No separate manual pull is
required. Docker/registry failures give a sanitized diagnostic; fix Desktop, port
or registry connectivity before retrying. Never disable TLS verification or point
the candidate at a remote daemon/accepted application. A failed new attempt removes
only its own resources and empty root; it never recursively deletes unknown files.
If prepare was forcibly interrupted before state.json exists, retain the candidate
folder as diagnostics and use a new separate candidate folder; do not reuse or
remove unknown working data.

Current-protocol stale command files recover automatically. For an old empty or
unrecognized `.command.lock`, first stop candidate CLI commands from older code
(no unrelated Node processes). Then use the exact instance ID from prepare/health:

```powershell
npm.cmd run demo:unlock -- --confirm <instance-id>
```

This requires explicit local operator intent and retains the legacy file under a
new diagnostic name. It refuses an active command guard and does not touch any
archive lock, database, worker or provider state. Wrong confirmation refuses action.

## Evidence limits and review

The runtime suite includes actual child-death/recovery and concurrent ownership,
reboot/PID-reuse residue, legacy recovery, ACL command/verification negative cases,
failed provisioning cleanup, digest/timeout/error redaction, explicit SSL and hidden
process options. Real TCP/SCRAM/UTC, CLI lifecycle, backup/reset and booking smoke
remain covered. All fixture data, secrets, databases and backups stay local/ignored.

On Linux, the native Windows ACL test is explicitly SKIPPED, not counted as a pass.
Command-contract mocks establish arguments/validation logic only. Native Windows
acceptance remains NOT RUN until the owner executes this exact source and returns
the console log, final measured win32/EXECUTED JSON, private-directory icacls output
and Docker context information for Claude review. Do not publish private state files.

Exact source/logs/hashes are in vnext/evidence/wp2-runtime-w1-w6/. A new independent
Claude re-verification is required for W1–W3 readiness. Original PR12 source/evidence
remain immutable history. W7 local-administrator trust, inert-only backup scope,
Windows/N6 performance/storage, X1/F13/OPS01,009/011/017,N2/N3,A2/A3 and013/016 gates
are unchanged. No real Meta/Google, GCP, deployment, cutover or v0.8.1 change.
