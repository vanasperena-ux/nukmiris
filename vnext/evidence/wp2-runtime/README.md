# Windows-targeted TCP/runtime evidence

Exact tested source **21d9bca514ee79e545027e63576821664eabd80d**, tree
6ac5a2abb399ff0c30b254f22bd37df596bd6240, parent C1 evidence c24b7e4.
Evidence follow-up adds only this directory and handoff10; all tested files match
[source hashes](source-sha256.txt). [Artifact hashes](artifact-sha256.txt).

| Command from vnext | Result | Evidence |
|---|---|---|
| npm run test:runtime | 10/10, zero skips | [local.log](local.log) |
| npm test | 259/259, zero skips | [full.log](full.log), [environment](full-environment.json) |
| npm run test:fault | 249/249, zero skips | [fault.log](fault.log), [environment](fault-environment.json) |
| npm run test:concurrency | 120/120, zero skips | [concurrency.log](concurrency.log), [environment](concurrency-environment.json) |
| typecheck / check:scope | PASS | [static.log](static.log) |

Node24.19.0/npm11.9.0/PostgreSQL17.11, pinned image. **Execution host Linux;
native Windows NOT RUN**. Full/fault/concurrency retain the Linux Unix-socket/
POSIX suites; the separate runtime suite uses SCRAM/loopback TCP, portable child
handles/IPC and explicitly pinned UTC. Suites overlap.

[Windows commands and isolation](../../../docs/greenfield/21-WINDOWS-TCP-LOCAL-RUNTIME.md)
are implemented: demo:prepare/start/stop/reset/backup/smoke. The automated CLI case
executes each using spaces/Unicode paths. Local tests verify SCRAM, server/database/
connection UTC despite Mexico City role defaults, occupied ports, ownership/token
denial, stop/crash/restart, indexed-custody actual core/C1 booking smoke, backup
integrity/separate inert restore verification and reset with retained diagnostics.

To reproduce, fresh checkout of this exact source, cd vnext, Node24/npm11/Docker:
npm ci --ignore-scripts; run the table commands. On native Windows use npm.cmd and
Docker Desktop Linux containers. Run **npm.cmd run test:runtime** and the actual
commands in document21; record OS/Node/Docker/WSL and source SHA before claiming
native acceptance. State files/passwords/dumps/keys/ledgers remain private/ignored
and are not published. Only plain logs/summary/environment/hashes are included.

The persistent profile is SYNTHETIC_INERT; health only, no interactive booking UI.
Smoke creates a separate ephemeral DB/archive and exactly one confirmed synthetic
booking after C1 supersession, with two loopback fake calls, then removes it.
Backup is only the inert fixture DB; no persistent archive/provider data exists.
It is not an operational L2 application backup/resumption service.

[Independent handoff10](../../../docs/greenfield/reviews/10-CLAUDE-WINDOWS-TCP-RUNTIME.md).
C1 must be independently accepted before L2. Windows/N6, X1/F13/OPS01,009/011/
production017,N2/N3,A2/A3,013/016 and all real provider/cloud/merge gates remain.
v0.8.1 and migrations001–005/roles are unchanged by this increment.

