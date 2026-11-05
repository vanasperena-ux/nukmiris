# WP2-L0b reproducible implementation evidence

**Exact tested source:** [`6a4c3aa1eaea98e2155e9192f573cff1e8bc5c07`](https://github.com/vanasperena-ux/nukmiris/commit/6a4c3aa1eaea98e2155e9192f573cff1e8bc5c07).
Tree: `6068beb0b77ceb478830fc8e6a9457b7072e7154`.
Parent: accepted L0a evidence head `de9a9a995a9d6ada4b398806db29d94abfe87364`.
L0a source remains `ff45a8e9b41fa9be99e773ff053c6cd6a1ea38b7`, with
[Claude's independent local-scope closure](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6646622771).

These results are **Codex-executed**, not independent L0b acceptance. L0b remains
OPEN. The evidence follow-up changes only this directory and review handoff 08;
all tested code, tests, migrations, dependency pins and scripts are unchanged.
[Source SHA-256 manifest](source-sha256.txt), [artifact hashes](artifact-sha256.txt),
[machine-readable summary](summary.json), [scope/preservation proof](scope-preservation.json).

| Command from `vnext/` | Result | Readable evidence |
|---|---|---|
| `npm run typecheck` / `npm run check:scope` / `git diff --check` | PASS | [static.log](static.log) |
| `npm test` | **207/207 PASS**, zero skips | [full.log](full.log), [full environment](full-environment.json) |
| `npm run test:fault` | **197/197 PASS**, zero skips | [fault.log](fault.log), [fault environment](fault-environment.json) |
| `npm run test:concurrency` | **68/68 PASS**, zero skips | [concurrency.log](concurrency.log), [environment](concurrency-environment.json) |
| `npm run test:archive:concurrency` | **20/20 PASS**, zero skips | [archive-concurrency.log](archive-concurrency.log) |
| `npm run test:l0b` | **52/52 PASS**, zero skips | [focused.log](focused.log), [environment](focused-environment.json) |

Suites overlap; do not sum these counts as unique cases. Full includes all 155
accepted L0a tests plus 52 L0b acceptance cases. Fault retains 145 prior cases plus
52 new cases. The general concurrency selector covers PostgreSQL/process/L0b;
the explicit archive command also selects `archive-concurrency.test.ts`.
Both are included in full/fault. No test is skipped as a substitute for a failure.

Executed with **Node v24.19.0**, npm **11.9.0**, SQLite **3.53.3**, PostgreSQL
**17.11 (Debian 17.11-1.pgdg12+2)**, on Linux. PG image:
`postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`.
Uniquely named disposable DB containers use `--network none`, no published ports,
no persistent volume and mounted Unix sockets. Fake providers listen on loopback.
Actual restricted fixture roles execute application functions. Fixture superuser
alone installs migrations/data and the private deterministic SQL clock.

## Acceptance evidence

[Implementation and full requirement-to-test matrix](../../../docs/greenfield/19-WP2-L0B-IMPLEMENTATION.md)
maps W2-CL01–04, W2-RP01–04, N1/N4/A1/N5, A2/A3 and O1/O3 to named tests.
New tests cover sealed original classification and tamper/repacked retry,
ordinary/human/Menu/name/date contexts, mixed-tenant STOP and raw custody,
later-first reservation through application/direct SQL, two PG sessions, STAGED
and unreduced crash cuts, UNKNOWN and terminal output ordering, cancellation,
real lock timeout/output collision, committed rejection before custody failure,
bounded read/write caller behavior and witness/queue deadlines with original-key
recovery. Existing RLS, history, suspension, receipt, C1/C4, process crash, inert
restore and 1,000 seeded SQL schedules remain. Large keyed-read regression rebuilds
10,000 records; no new million-record performance benchmark is claimed.

**B2/X1 still REPRODUCES** in the full/fault logs: writer keys + witness CAS can
sign a larger rewritten history without the witness signing key. CAS/monotonic
size/epoch does not independently verify append-only chain or key-index extension.
Independent verification of **both** remains mandatory under production 009/017.
**F13 still REPRODUCES**: a process paused after local admission can physically
invoke after suspension. OPS01 remains a production blocker. Passing residual
tests demonstrate the documented vulnerabilities, not their resolution.

## Reproduce and review

Checkout the exact source above with Node 24/npm 11/Docker, then:

```sh
cd vnext
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:fault
npm run test:concurrency
npm run test:archive:concurrency
npm run test:l0b
```

This run installed pinned dependencies using an offline npm cache; no install
scripts ran. New DBs and tenant-policy-2 archives are created for every fixture.
Migration 004 is fresh-fixture-only; it must not be applied to existing working data.
Generated SQL snapshots, archives, forensic files, private keys and provider ledgers
remain local/ignored and are **not published**. The plain logs and summaries here
contain no opaque database/state archives. Reruns create different random fixture
IDs and host-specific timings. UTC run identifiers are retained in logs/environment.

N2/N3 production repair, A2 operator quarantine, A3 remote/L2 runtime acceptance,
N6 linear repair/roughly 3× disk/native Windows performance, 009/011/production-017,
001/F13, 013/016 and OPS01 remain OPEN. Nothing enables Meta, Google, GCP, merge,
deployment, cutover or production custody. v0.8.1 and existing data are untouched.

[Independent Claude handoff](../../../docs/greenfield/reviews/08-CLAUDE-WP2-L0B-REVIEW-HANDOFF.md)
requests exact-source adversarial review and explicit bounded local L0b verdict.
After acceptance, the first implementation task is the isolated Windows TCP/child
lifecycle/bootstrap runtime, then L1 availability/transcript proof and L2's first
interactive booking using fake calendar/message providers. No application start
command, native Windows acceptance or finished interactive booking UI is claimed.
