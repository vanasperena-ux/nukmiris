# Windows-targeted local TCP runtime — implemented fixture scope

This increment supplies runnable local commands, PostgreSQL17.11 over authenticated
loopback TCP, a portable health/control child, and an automated core booking smoke.
It does **not** expose L2 interactive booking. C1's independent acceptance remains
mandatory before that flow; Windows L0 and L1 were authorized immediately by
[Claude's L0b review](https://github.com/vanasperena-ux/nukmiris/pull/10#issuecomment-6649052579).

## Run in a fresh Windows checkout

Requirements: Windows10/11, Node24/npm11, Git, Docker Desktop in Linux-container
mode. Use a new folder away from v0.8.1; checkout the exact tested SHA in this PR's
`vnext/evidence/wp2-runtime/README.md`. From **vnext/** in PowerShell:

```powershell
node --version
npm.cmd --version
docker.exe version
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

Prepare builds, creates a fresh private `.local-demo/`, then generates dedicated
names/passwords/ports/DB/volume/network. Defaults: DB 127.0.0.1:55432,
health 127.0.0.1:3077. Alternative explicit ports:
`demo:prepare -- --db-port 55433`, `demo:start -- --port 3078`. A collision fails
without fallback. Never use an existing app directory/DB or copy v0.8.1 secrets.
No env/DATABASE_URL/provider credentials are loaded. No real-provider mode exists.

Start exposes only /health with SYNTHETIC_INERT, UTC and
interactiveBookingEnabled=false. It is a runtime health service, not the booking UI.
The persistent demo DB stays SUSPENDED/dispatch-disabled. Smoke creates a separate
ephemeral DB/archive and actual fake HTTP provider, checks C1 supersession, then
creates/confirms exactly one synthetic booking (two fake calls). It removes the
ephemeral DB/state and leaves the persistent demo unchanged.

Stop retains the original DB volume/private state. Start resumes the same instance/
endpoint. Reset requires its exact non-secret instance ID printed by prepare/health:

```powershell
npm.cmd run demo:reset -- --confirm <instance-id>
```

Reset first retains a private diagnostic backup, stops only that instance, checks
labels on all three Docker resources, removes only those resources and provisions
fresh identities in the same profile. Old state/backups stay private. Wrong/missing
confirmation or unknown/mismatched resource identity refuses mutation.

## Tested safety and E1

Server timezone=UTC, database TimeZone=UTC and each client options=-c timezone=UTC
are explicit. The test changes a role default to America/Mexico_City and verifies
both SQL zone and UTC timestamp output remain UTC. The pinned image is the accepted
PostgreSQL17.11 digest. TCP requires generated SCRAM passwords; owner/definer stay
NOLOGIN. Shared local role/process custody is not production administrator isolation.

Docker uses a dedicated bridge and publishes only 127.0.0.1. An internal-only
Docker bridge did not publish a host port on this daemon, so it is not used.
This is local port mapping, not host networking or a network-policy bypass.
Windows selects the local docker_engine named pipe; Linux selects the managed Unix
socket, clearing inherited remote Docker selectors. No daemon restart occurs.

State/secret files are ignored and owner-private (POSIX modes; Windows icacls SID
grant with inheritance removed). No password is printed even when execFile fails.
Portable children use IPC/cooperative shutdown and owned handles for crash; no
SIGSTOP/SIGCONT or raw-PID takeover is used in this suite. A detached health child
stops only through its loopback instance/token control. Unknown/unreachable ownership
stays held rather than killing an unrelated PID. POSIX fault tests remain separate;
Linux passing these tests is not native Windows acceptance.

Backup stops the health child, snapshots this **inert fixture DB only**, and keeps
the dump/hash manifest under private .local-demo/backups/. Verification restores
to a fresh separate DB, proves dispatch-disabled businesses and drops only that
target. Corruption is refused. No archive/provider working data exists in this
persistent fixture, so this is **not a coherent L2 application backup or operational
restore**. Before L2 persistence, extend backup/restore to original custody heads,
retained keys, fake ledgers and inert SQL recovery; keep production011 untouched.

Acceptance tests execute all published CLI commands, spaces/Unicode paths, SCRAM,
UTC override, occupied DB/service ports, wrong resource identity/token, graceful
stop, child crash/restart, indexed-custody core/C1 smoke, backup/inert verification,
corruption and reset. Exact source/results/hashes are in the evidence package.

**Native Windows owner smoke: NOT RUN here.** Run test:runtime and the commands
above on the laptop and record OS/Node/Docker/WSL versions, exact SHA and output.
Keep native performance/storage/power-loss/N6, C1 independent acceptance, L2
persistence/reply intents and production009/011/017, X1/F13/OPS01, A2/A3 and013/016
gates open. No merge, Meta/Google, GCP, deployment or v0.8.1 change.

