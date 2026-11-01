# WP1 synthetic transactional safety slice

Owner authorized on 2026-11-01. This package has **no application start command,
Google/Meta SDK, real credentials, booking UI or provider deployment**. It is an
isolated proof of the approved [WP1 charter](../docs/greenfield/08-WP1-BOUNDED-IMPLEMENTATION-CHARTER.md).
The accepted `backend/` remains unchanged. WP2 has not started.

Use Node 24.x, npm 11, Docker and the local managed daemon. From this directory:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:fault
```

On a workspace that cannot write npm's default cache, add
`--cache /workspace/work/wp1-npm-cache` to `npm ci`. No install script runs.
The lockfile pins the PG client, TypeScript and types; no global upgrade is needed.

The runner creates **only** its uniquely named `nukmiris-wp1-*` PostgreSQL container,
pinned to digest `sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`
(tested PostgreSQL 17.11). The database container has `--network none`, no published
ports and no persistent volume; PG clients use its mounted Unix socket. Migrations,
roles and `btree_gist` run only in disposable `nukmiris_wp1_*` databases. A fixture
superuser creates schema/data; actual restricted roles execute the tested paths.
Local socket trust is a **fixture setting**, not a production authentication model.

Fake HTTP providers bind only `127.0.0.1` and count every POST in a durable ledger;
their client makes one request with no retry/redirect handling. Provider servers
exist only under `test/support/`. Application source imports no HTTP client and
accepts no environment/database-URL fallback. The PG adapter rejects other database
names, roles and non-local fixture hosts. Do not aim it at any existing database.

Each run writes `evidence/runs/<run-id>/`: environment, boundary traces, the F13
counterexample, 1,000 seeded SQL schedules, and compressed consistent pre-cleanup
SQL snapshots with SHA-256 manifest. Fixture data and fake archive/provider files
also remain under `/tmp/nukmiris-wp1-*` for diagnosis. The runner stops only its own
container. No daemon restart, shared-container cleanup or live account action runs.
Checked-in review evidence is under [evidence/checkpoint-1](evidence/checkpoint-1/).

The test harness may reset fixture state **between independent cases**. A
crash/recovery test retains its SQL, archive and provider state until the specified
crash/destructive-loss cut. Worker cleanup precedes snapshot/DB teardown; no forced
DROP of live test connections hides an unfinished test. The 1,000 schedule cases
exercise real SQL admission/revocation/status functions; they do not themselves
invoke HTTP or model arbitrary OS schedules. Separate process tests cover real
SIGSTOP/SIGKILL and a durable HTTP ledger. The seed and action order are retained.

For Windows PowerShell, dependency/type/scope commands use `npm.cmd`:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run typecheck
npm.cmd run check:scope
```

The full disposable Unix-socket/POSIX-signal harness currently requires Linux
(including an appropriately configured WSL environment); native Windows execution
is **not verified**. Do not run the candidate over the owner's accepted PC install.
The later P0 Windows smoke remains WP6 work.

## Enforced path

Signed bounded bytes → verified receiving WABA/number → independent original
identity + batch preparation → SQL STAGED → independent commit seal → ELIGIBLE.
Only the literal **synthetic fixed command** can prepare an operation. This is a
test selector, not a new WhatsApp booking flow. Mixed-business batches and other
message kinds are explicitly rejected; commercial normalization is deferred.

Operation preparation takes a scoped appointment guard and finite resource
protection. Source+target ranges merge during a move. Appointment/customer/calendar
relationships are composite FKs; isolated employees can share one Calendar.
Immutable original envelope, original IDs and an independent ARM record precede
single-owner SQL admission. Only a known successful commit continuation can invoke
the fake provider. Re-reading state cannot reissue a permit. No automatic retry
generation, uncertain release, lease takeover or ETag-bump mechanism exists.

Final admission locks current business/channel/calendar/permission/conversation
and appointment state. STOP for an unknown sender creates the real shared head;
older grants cannot undo it. G06 suspension blocks both calendar and message
admission, including queued work. Ordinary customer-request operations do not
require reminder permission. A status/identity revision change conservatively
holds old work; this slice does not implement a commercial reactivation scheduler.

Provider proof seals before atomic appointment/protection/schedule-revision/output
finalization. Receipt evidence can precede the HTTP result, is exactly correlated,
and cannot downgrade delivered/read. Unknown output heads do not expire into
unsent. Restore is an inert projection: original post-snapshot identities remain
review cases, permissions stay suppressed, every dispatch head stays false, and
missing chains/heads/keys cannot generate effects. It is **not** full operational
restore/resumption or a production backup service.

## Unproven limits and review gate

The file archive is a crashable local stand-in with fsynced encrypted hash-chain
records, fixed key versions, separate head/witness files and no timed lock stealing.
It does not establish independent offsite durability, key custody or vendor CAS/HA
guarantees. Concurrent head/witness ambiguity fails closed. Simultaneous rollback
of all trusted custody domains cannot be detected by a self-consistent old chain.

The F13 process test intentionally demonstrates that a process paused **after**
its final local admission can physically submit after suspension. SQL leases and
token-cache timers do not fence HTTP. This is retained as a production blocker
(OPS01), not relabeled a passing physical-cutoff guarantee. The candidate proves
only the tested local single-invocation/gate-ordering properties.

RLS checks role grants and transaction-local scope, pool context resets, runtime
table writes are denied and definer functions have fixed search paths/PUBLIC
execution revoked. Shared service roles explicitly granted both synthetic
businesses still span both; this is not isolation from fully compromised shared
runtime or a production MFA/operator implementation.

Independent Claude CP1/initial CP2 review is **pending**. No connected Claude tool
or CLI was available; no self-review is presented as independent review. See the
[actual implementation review handoff](../docs/greenfield/11-WP1-CLAUDE-REVIEW-HANDOFF.md).
Stop at that checkpoint. No WP2, merge, deploy or real provider activation is included.
