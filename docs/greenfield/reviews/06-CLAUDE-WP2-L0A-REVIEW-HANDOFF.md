# Independent Claude review — WP2-L0a

**Historical baseline handoff:** Claude completed this review with
[GO WITH CONDITIONS](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6622229074).
The following instructions/pins describe that baseline. B1/B2 re-verification is
now tracked in [handoff 07](07-CLAUDE-WP2-L0A-B1-B2-REVERIFICATION.md);
L0a remains open until the corrections are independently accepted.

Please independently review code increment L0a under Issue #7. Do not merge any
Draft PR, start L0b, enable providers or provision GCP as part of this review.

**Source to review/run:** `edbb0d226b000761b8e0173470f6e3cae69b25c9`
(`a3ce3bf687761655e5df5b3e9191414208fd4b7e` tree).
Parent is WP1 evidence head `84ff73d36cc6defc493a30a4f07445e4818ce1c8`.
The follow-up evidence commit changes only this handoff and `vnext/evidence/wp2-l0a/`.
Check this directly; verify [source hashes](../../../vnext/evidence/wp2-l0a/source-sha256.txt).

WP1 is independently accepted for bounded synthetic use in
[Claude's formal closure](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6620571487).
That acceptance is not an approval of this increment. No connected Claude review
was run by Codex; **L0a independent acceptance is OPEN**.

Read [implemented protocol/capacity policy/limits](../17-WP2-L0A-INDEXED-ARCHIVE.md),
[results and reproduction](../../../vnext/evidence/wp2-l0a/README.md), then the
three archive adapter files, port/call-site changes and archive tests. Scope is
finding 017's local synthetic prerequisite; production 009/011/017 stay open.

From the exact source checkout, use Node 24.x (record exact version), npm 11 and
the pinned PostgreSQL 17.11 image. The full/fault harness uses Linux Unix sockets
and POSIX signals; a native Windows result must not be inferred.

```sh
cd vnext
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm run test:archive
npm test
npm run test:fault
npm run test:archive:capacity
```

Review these failure boundaries adversarially, beyond simply rerunning our tests:

| Boundary | Required independent judgment |
|---|---|
| Keyed lookup | Both inclusion and absence are authenticated against the signed root. Deleted SQL rows/index edges must throw, never authorize reallocation. No ordinary full-chain scan/decryption. |
| Identity and tenants | Original ARM owner/attempt/body/hash/sequence persist across duplicates, six competing processes, repair and cold restore. Foreign facade/key/body cannot retrieve/register another tenant's seal. Mixed raw batches cannot leak through a scoped facade; validated STOPs remain durable. |
| Append cuts | SQLite transaction atomicity before commit, durable pending hold after commit, exact witness CAS, confirmation/ACK last. No automatic retry, stale-lock steal or dispatch authority from a durable row. |
| Repair | Separate signed epoch fences stale continuations; live SQL lock cannot be stolen. Coherent pre-repair forensic copy, authenticated prefix, staging rebuild, authenticated append-only repair decisions and witness completion. Pending tail adoption requires trusted prefix plus retained authentication keys; bad/missing/rolled-back custody holds. |
| Recovery cuts | Four real SIGKILL append cuts; injected repair cuts before/after data commit and after witness completion; a second explicit repair. Inspect limits of process-crash evidence versus host/filesystem power loss. |
| Capacity | API-generated 1k/10k/100k/1M corpus, hit/miss distributions, bounded node/decryption work and memory; actual guarded PG admission and two competing dispatchers at 1M; real killed appender and full 1M repair. Hard capacity hold before allocation, no pruning. |
| Dispatch/regression | UNKNOWN keeps guards, no successor owner/replay, missing ARM produces zero fake calls, suspension before gate produces zero calls. Inert restore cannot enable dispatch or infer absence from a broken archive. All prior WP1 conditions remain. |
| Trust boundary | Public verification key and writer capability exclude witness private key/operator fence. Fixture signer/storage are same-host; shared trusted-service credentials and DB/file-owner limitations remain explicit. Paired rollback without external floor is not solved. |

Publish findings against the exact source SHA, commands/versions actually run,
any unavailable checks, and a GO/NO-GO limited to **local synthetic** expansion.
If GO, explicitly decide whether finding 017's local prerequisite is satisfied and
L0b can begin. Do not relabel production custody, Windows, real-archive repair or
OPS01 as accepted based on these fixtures.

The next code task after accepted L0a is sealed/versioned admission classification
and terminal ordinary-input reductions, followed within L0b by conversation-head
reservation priority before any reservation rows. Run W2-CL01–04/W2-RP01–04 from
[requirements 16](../16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md). Carry O1
terminal plan-conflict handling and O3 in-flight constraint/revalidation rules from
the WP1 closure. No booking/UI expansion before NEW-2/NEW-3 review. Windows-safe
TCP/child lifecycle/bootstrap completes the remaining L0 prerequisite toward the
first L2 booking demo. One service remains one appointment.
