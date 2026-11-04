# vNext synthetic safety core — WP1 and WP2-L0a

Owner authorized on 2026-11-01. This package has **no application start command,
Google/Meta SDK, real credentials, booking UI or provider deployment**. It is an
isolated proof of the approved [WP1 charter](../docs/greenfield/08-WP1-BOUNDED-IMPLEMENTATION-CHARTER.md).
The accepted v0.8.1 application remains unchanged. Claude formally accepted WP1 for
bounded synthetic use ([acceptance](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6620571487)).
WP2-L0a adds an indexed authenticated local fixture archive; independent L0a review
is pending. See [implementation and exact next gate](../docs/greenfield/17-WP2-L0A-INDEXED-ARCHIVE.md).

Use Node 24.x, npm 11, Docker and the local managed daemon. From this directory:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:fault
npm run test:conditions
npm run test:archive
npm run test:archive:capacity
```

On a workspace that cannot write npm's default cache, add
`--cache /workspace/work/wp1-npm-cache` to `npm ci`. No install script runs.
The lockfile pins the PG client, TypeScript and types; no global upgrade is needed.

The runner creates **only** its uniquely named `nukmiris-wp1-*` PostgreSQL container,
pinned to digest `sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`
(tested PostgreSQL 17.11). The database container has `--network none`, no published
ports and no persistent volume; PG clients use its mounted Unix socket. Migrations,
roles, `btree_gist` and `pgcrypto` run only in disposable `nukmiris_wp1_*` databases. A fixture
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
Windows runtime/bootstrap/child-lifecycle verification remains the next L0 prerequisite
under Milestone A; a native Windows owner smoke is still required.

## Enforced path

Signed bounded bytes → verified receiving WABA/number → independent original
identity + batch preparation → SQL STAGED → independent commit seal → ELIGIBLE.
Only the literal **synthetic fixed command** can prepare an operation. This is a
test selector, not a new WhatsApp booking flow. Signed mixed-business batches are partitioned into durable tenant records linked
to one exact-byte raw archive record. All validated STOPs commit before archive
work; ACK waits for every partition. Only synthetic text/receipt shapes are enabled.

Operation preparation takes a scoped appointment guard and finite resource
protection. Source+target ranges merge during a move. Appointment/customer/calendar
relationships are composite FKs; isolated employees can share one Calendar.
Immutable original envelope, original IDs and an independent ARM record precede
single-owner SQL admission. Only a known successful commit continuation can invoke
the fake provider. Re-reading state cannot reissue a permit. No automatic retry
generation, uncertain release, lease takeover or ETag-bump mechanism exists.

Final admission locks current business/channel/calendar/permission/conversation
and appointment state. Every earlier command must be resolved with terminal outputs
or explicitly disposed before later execution. Sealed input holds and abandonment
of never-entered attempts supply an audited operator exit; entered/UNKNOWN work
retains its protection until read-only proof. STOP for an unknown sender creates the real shared head;
older grants cannot undo it. G06 suspension blocks both calendar and message
admission, including queued work. Ordinary customer-request operations do not
require reminder permission. A status/identity revision change conservatively
holds old work; this slice does not implement a commercial reactivation scheduler.

Provider proof seals before atomic appointment/protection/schedule-revision/output
finalization. Receipt evidence can precede the HTTP result, is exactly correlated,
and cannot downgrade delivered/read. Unknown output heads do not expire into
unsent. Restore is an inert projection: original post-snapshot identities remain
review cases, permissions stay suppressed, businesses restore SUSPENDED with bumped
status revision/epoch, every dispatch head stays false, and
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

The prior WP1 review history is retained in the numbered review documents.
Claude formally closed CP1/initial CP2 for bounded synthetic use; production gates
remain open. L0a requires its own independent review.

The SQL recomputes canonical SHA-256 body/payload digests (UTF-8 key ordering;
safe integral JSON numbers only). A digest establishes integrity, not authenticity.
The fixture sealer remains a procedural trust root; independent credentials,
processes and custody are required before production. The source clock uses
`clock_timestamp()`; fixture postgres alone installs a deterministic private DB
clock. Runtime roles cannot read/change that clock or replace its function.
The caller time must be finite and within 5 seconds; admission uses DB time again
after all locks. No runtime clock override exists. SQL functions reject NULL
arguments, and role defaults bound statement/lock/idle-transaction waits.

## Accepted WP1 remediation

Claude accepted C1–C4 at the exact source/evidence pins linked above.
No existing Draft PR is merged.

Preparation now rejects invalid output purpose/identity before reservation and
reserves each future output ID through an immutable-operation unique index. It
preflights the shared final output INSERT in a rolled-back subtransaction, validating
the real current table constraints without exposing an output before provider proof.
`npm run test:conditions` exercises C1 and C4, including a real unique-index wait.

Nine payload/evidence tables, including `recovery_case`, reject protected payload
UPDATE/DELETE while triggers are enabled. This is **payload DML protection**, not
protection from the database owner. The owner can change allowed state fields and
perform DDL/disable triggers without superuser. Keep `wp1_owner` NOLOGIN,
migration-only, and unassumable by runtime roles; production credential isolation
and authenticated custody remain gates. Tests demonstrate both the protection
and this limit.

[WP2 requirements and unchanged activation gates](../docs/greenfield/16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md)
record NEW-2 reservation priority and NEW-3 sealed admission-time classification.
These remain L0b requirements; L0a does not implement booking/classification or
provider authorization. The original file archive described above remains a regression
oracle. The new adapter, signed witness port, authenticated presence/absence index,
fenced repair, capacity policy and test commands are described in document 17.
Normal dispatch now uses keyed lookup; cold inert restore retains full completeness
audit. No production custody or native Windows result is claimed.


## L0a GO WITH CONDITIONS — B1/B2 correction

[Claude's independent review](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6622229074)
requires re-verification before L0a closure/L0b entry. Archive calls on one instance
now share a bounded FIFO async mutex; cross-instance SQLite contention is typed,
and pending confirmation is distinct from an explicit repair fence. Nested tenant
bindings are checked recursively. Run `npm run test:archive:concurrency`.

The fixture witness checks CAS/monotonic size/epoch, **not append-only history
extension**. Honest writer code/keys remain a trust root: writer keys plus the CAS
capability can obtain signatures over a larger rewritten chain/index. The retained
X1 regression reproduces this production vulnerability; it is **not fixed** by
documentation. Independent verification of **both** chain and index extension is
a mandatory 009/production-017 gate before any non-fixture custody.
[Owned N1–N6 acceptance gates](../docs/greenfield/18-WP2-L0A-B1-B2-AND-FOLLOWUPS.md)
include bounded caller availability handling and multi-tenant admission binding
before inbound expansion, partial forensic publication/stale-writer repair limits,
and unchanged Windows/capacity limitations. No provider gate is relaxed.
