# Milestone A — Windows runtime and command contract

2026-11-03. Supports [Issue #7](https://github.com/vanasperena-ux/nukmiris/issues/7)
and the [proposed WP2-L charter](13-MILESTONE-A-DELIVERY-AND-WP2-CHARTER.md).
**Native Windows vNext runtime/owner acceptance: NOT RUN.** The current package is
a synthetic test harness. The future command table below is an implementation
contract; those commands are not present in today's package.json.

## Dependencies and isolation

| Dependency | Current evidence / target |
|---|---|
| Git for Windows | Separate clone, e.g. `C:\NukMiris\vnext-local`; never pull over the accepted v0.8.1 installation |
| Node.js 24.x and npm 11.x | Current Linux evidence: Node 24.19.0 / npm 11.9.0. Use official Node 24 distribution; record actual Windows versions. Node 22/25 is outside current engines contract. WSL needs its own Linux Node installation. |
| PostgreSQL 17.11 | Pinned current Linux image below; btree_gist/pgcrypto. Windows target: Docker Desktop Linux containers + WSL2 backend, loopback-only TCP port 55432, new dedicated DB. No paid/cloud database. |
| Windows runtime | Windows 10/11 with supported Docker Desktop/WSL2 and virtualization. Record exact OS/build/WSL/Docker versions; these are requirements, not a compatibility result. |
| Browser | Local browser opens `http://127.0.0.1:3077` after the future demo runtime exists; no external assets, WhatsApp login, Google login or tunnel |
| Local secrets/state | Generated only for the disposable candidate, protected locally with Windows ACLs; never copied from v0.8.1, committed or included in public evidence |

Pinned image:
`postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`.
The current harness uses a no-network Linux container and Unix socket. A future
native TCP harness must be reviewed and tested; changing an environment variable
cannot make the current `/tmp`/Unix-socket/POSIX-signal harness Windows-compatible.
A native PostgreSQL installation is a later alternative only if its isolated
bootstrap/role/extension/cleanup and failure tests pass; do not silently switch to
an existing PC database when Docker is unavailable.

## Commands available today

Run these in **PowerShell** in a fresh directory. They do not start an application:

```powershell
node --version
npm.cmd --version
git --version
docker version
wsl.exe --status
wsl.exe --list --verbose

git clone --branch implementation/wp1-synthetic-safety-slice https://github.com/vanasperena-ux/nukmiris.git C:\NukMiris\vnext-wp1-review
Set-Location C:\NukMiris\vnext-wp1-review
git checkout --detach 1ca19248f0f26b47a7ed8013d79e75d387f508b3
Set-Location vnext
npm.cmd ci --ignore-scripts
npm.cmd run typecheck
npm.cmd run check:scope
npm.cmd run build
```

The npm commands exist at that exact commit. Their **Windows execution is not
verified here**. If the directory already exists, choose a new empty candidate
path; do not overwrite a working installation. Do not run the root/backend start,
OAuth, reminder or provider-connection scripts as part of this procedure.

Full `npm test` / `npm run test:fault` currently require Linux, Node 24, Docker at
`unix:///var/run/docker.sock`, `/tmp` Unix sockets, and real SIGSTOP/SIGKILL support.
Use a separate Linux checkout **inside WSL2's Linux filesystem**, not a working
POC directory. Docker Desktop integration and Node 24 must be available inside that
distribution. Example commands inside the WSL shell:

```sh
git clone --branch implementation/wp1-synthetic-safety-slice https://github.com/vanasperena-ux/nukmiris.git ~/nukmiris-wp1-review
cd ~/nukmiris-wp1-review
git checkout --detach 1ca19248f0f26b47a7ed8013d79e75d387f508b3
cd vnext
node --version
npm --version
docker --host=unix:///var/run/docker.sock version
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:fault
```

This sequence is grounded in current scripts, but **WSL execution is NOT RUN**.
Linux cloud success does not close WSL, native Windows or owner-device acceptance.
No need to rerun v0.8.1 tests on its working installation.

## Proposed WP2-L environment template (not loaded today)

[Example file](examples/wp2-local-demo.env.example) defines only local non-secret
settings and paths to future generated secrets. The `NUKMIRIS_*` variable names
are proposed, not currently recognized. The future bootstrap must create ignored
`.env.demo`/`.local-demo/` state under **vnext/**, protect secret files, and refuse
real-provider mode, non-loopback hosts, non-demo database names and production
credential discovery. No actual secret value is supplied in the template.

Default future DB: `nukmiris_vnext_demo`; local address `127.0.0.1:55432`.
Runtime roles are separately scoped; schema bootstrap uses a different local-only
credential. Scram authentication is required for TCP. A test-role login or the
WP1 trust socket profile must not become a deployment default. A role that can
seal is not automatically allowed to dispatch or administer other tenants.

## Proposed native PowerShell runtime commands — NOT IMPLEMENTED / NOT RUN

Implement and review these after WP1 closure. They are acceptance criteria, not
instructions to execute against today's checkout:

| Command to implement | Required behavior |
|---|---|
| `npm.cmd run demo:prepare` | Validate Node/ports/Docker/config, generate new local secrets, create only named demo DB/roles/state, apply migrations, seed labelled synthetic Juanita/Bernard fixtures. Refuse existing mismatched state instead of overwriting. |
| `npm.cmd run demo:start` | Bind 127.0.0.1:3077, start only this instance's workers, show synthetic/no-message badge and health. Fail on occupied port or incomplete config. No provider SDK/credentials/real network fallback. |
| `npm.cmd run demo:stop` | Gracefully stop only recorded candidate PIDs/container; retain DB/archive/ledger/holds. Never kill all node processes or stop unrelated Docker resources. Ctrl+C must preserve pending/UNKNOWN evidence too. |
| `npm.cmd run demo:smoke` | A01–A14 on local fake providers, payload/effect/audit assertions, output a candidate-SHA report and nonzero exit on failures. No secret fields in report. |
| `npm.cmd run test:parity` | Compare frozen accepted transcripts/effect meaning for the implemented P0 scope; report remaining 49-row coverage, not a fabricated 49/49 pass. |
| `npm.cmd run test:local:windows` | Native TCP DB/roles/constraints, Windows process-stop/restart, archive cuts, path/ACL/Unicode/space handling and shutdown tests. Keep Linux signal tests separately. |
| `npm.cmd run demo:backup -- --out .local-demo/backups/checkpoint` | Coherent SQL snapshot + original archive head/checkpoint/key-version references + fake-provider ledger; private keys excluded from ordinary logs; backup kept local and verified. |
| `npm.cmd run demo:restore -- --from .local-demo/backups/checkpoint --target nukmiris_vnext_restore_check --inert` | Fresh separate target only, SUSPENDED/dispatch false/new epoch, all permission heads suppressed, uncertainty held; zero provider replay; never restore over running source. |
| `npm.cmd run demo:reset -- --confirm nukmiris_vnext_demo` | Explicit disposable-demo-only target check and preserved diagnostic backup before clearing synthetic state. Refuse unknown/non-demo target and never touch accepted data/secrets. |

The portable test harness must use a separately generated ephemeral DB per case,
not the demo's persistent DB. Random IDs/fixtures from tests cannot silently replace
an owner walkthrough session. Paths with spaces, backslashes and Unicode names
must work. Every script must identify its exact target before mutation.

### Required lifecycle smoke on the owner's laptop

1. Record OS/Node/npm/Docker/WSL versions and candidate SHA; confirm a separate
   folder and new candidate data paths. Start with no OAuth/provider secrets.
2. Install frozen dependencies/build; start candidate; open local demo and complete
   [Juanita/Bernard cases](15-MILESTONE-A-OWNER-ACCEPTANCE-SCRIPTS.md). Record expected
   versus actual text, call counts and DB outcome.
3. Stop/start normally: confirmed appointment and original operation/result survive;
   no second create/send. Force-stop the candidate during fake acceptance/lost reply;
   restart: hold and exact read-only fake reconciliation, no automatic retry.
4. Backup, then restore to separate inert target; confirm original IDs, held ranges,
   SUSPENDED state and zero new calls. A missing key/tail must refuse safe resumption.
5. Reset only the explicitly named disposable candidate. The accepted application
   still opens with its original data; do not exercise real providers to prove this.

Owner acceptance record must include date, device/OS, immutable SHA, fixture/config
hash, command/log, screenshots/transcripts with real identities absent, case ID,
expected/actual effects, pass/fail and defect link. Mark “not tested” explicitly.
Passes in this Linux session cannot fill the owner's Windows result column.

## Live versus synthetic operation

No WhatsApp account, public webhook/tunnel, Google OAuth or template activation is
needed for Milestone A's first demo. Fake calendar/message outcomes prove local
behavior only. Use of actual Meta/Google test accounts remains separately gated by
[the live-account blocker table](13-MILESTONE-A-DELIVERY-AND-WP2-CHARTER.md#live-metagoogle-test-accounts-separate-gate).
GCP is deferred; installing a local Docker database does not provision cloud services.
