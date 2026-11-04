# WP2-L0a — indexed authenticated synthetic archive

This is the first code increment of the approved WP2 charter in Draft PR #8,
under [Issue #7](https://github.com/vanasperena-ux/nukmiris/issues/7).
[Claude's independent acceptance](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6620571487)
formally closed WP1 CP1/initial CP2 for its bounded synthetic scope. Accepted
source: `991ca8141ffef3471a955c450e9f789dd8aef1a7`; evidence-only head:
`84ff73d36cc6defc493a30a4f07445e4818ce1c8`. This increment branches from that
head without merging PR #4 or changing accepted v0.8.1.

## Implemented boundary

`IndexedArchive` is a portable-path, Node 24 `node:sqlite` adapter with no new
dependency. It implements the keyed `EvidenceStore.lookup` port used by normal
ARM dispatch and seal verification. The old full-chain fake remains as a regression
oracle. `records()` is deliberately a cold completeness audit for inert recovery.
No booking reducer, UI, real provider, cloud service or application start command
is added. The SQL migrations/roles and sole dispatch permit path are unchanged.

Records are immutable sequence/tenant/key identities, encrypted with AES-256-GCM.
AAD binds archive ID, tenant, hashed stable key, sequence, key version and prior
record hash. A separate HMAC-SHA256 key authenticates record metadata and ciphertext;
SHA-256 chains record hashes. Historical encryption key versions must be retained.
Missing keys hold reads/repair; rotation never rewrites old records.

An AVL map indexes `SHA256(canonical({tenant,key}))` to original record sequence
and hash. Each node commits its key, sequence, record hash, child references and
height with SHA-256 of the fixed positional JSON array
`['nukmiris-avl-v1', key, sequence, entry, left, right, height]`; a child reference
is `[key,hash,height]` or null. The checkpoint commits root, size and chain tip.
Reads verify every traversed edge and the selected record. Only a verified null
edge proves absence. Missing SQL rows, altered pointers, deleted records or damaged
ciphertext throw; none is interpreted as permission to allocate a replacement ID.
Normal reads are bounded to 64 nodes and one record decryption per hit.
Those checks authenticate the history the witness signed; they do not prove that
this history extends any earlier signed history against a writer-level attacker.

The checkpoint witness signs canonical state with Ed25519: archive ID/root/size/tip,
epoch, NORMAL/REPAIR mode and repair-decision digest. The archive receives its
public verification key and a read/CAS writer capability. It never receives the
signing private key or the operator's fence capability. An observed checkpoint
cannot regress in epoch/size or change history at the same size. Reopen accepts
an optional **externally retained** minimum checkpoint. Rolling back archive and
witness together without such an anchor remains outside this proof.

**B2 trust boundary: the fixture witness checks CAS and monotonic size/epoch; it
does not independently verify append-only history extension.** A writer holding
the archive HMAC/AES keys and its read/CAS capability can replace history with a
larger fork and obtain a valid signature without the witness private key or an
operator fence. Even a retained older minimum checkpoint, original-key lookup
and cold audit then accept the rewrite. History integrity depends on honest writer
code and keys. The retained `B2/X1` regression reproduces a changed original ARM
owner, authenticated absence of original history, passing audit and reallocation.
**This production vulnerability remains unresolved. Documentation and the mutex
do not fix it.** Independent extension verification of both the record chain and
the index is mandatory under production 009/017; see the additional gate below
[requirements 16](16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md).

Tenant facades enforce configured grants, distinct keyed identities, business
bindings and scoped results. Facades are capabilities of the trusted service, not
production user authentication. Full audit checks the global encrypted log before
returning the facade's tenant records. Restores stay globally inert. A scoped
facade recursively rejects every foreign/null `businessId` in nested objects and
arrays, including envelopes and allocated bodies (N4). Opaque raw bytes are not
recursively parsed by this check; admission binding remains a separate N5 gate. A scoped
facade refuses mixed-business raw-batch custody, after all authenticated immediate
withdrawals have been attempted durably; it never stores B's raw bytes in A's view.
The old shared-service mixed-tenant admission regression remains. Broader inbound
routing/custody must be reviewed in L0b before expanding admission.

## Transactions, crash cuts and repair

B1 serializes append/ensureBatch, lookup/verify, records and operator repair on a
single instance with one FIFO async mutex, held across all awaits and witness I/O
through confirmation. Its 64-operation bound includes the active operation;
overflow/active-close raises `ArchiveBusyError`, never a nested SQL transaction.
Independent instances/processes still coordinate through SQLite and witness CAS;
SQLite BUSY/LOCKED is mapped to the same typed contention class. No retry or lock
stealing is added. Failed work releases the mutex without rolling back another
caller's transaction. The operator instance repair method is not on tenant facades.

`ArchivePendingError` distinguishes pending confirmation from `ArchiveHeldError`
for a repair fence/checkpoint mismatch. Pending can mean **live or crashed**; it
does not establish which. Neither a typed busy error nor a timeout proves that a
write rolled back. Bounded caller handling remains mandatory before L0b inbound
expansion: [N1 policy and ownership](18-WP2-L0A-B1-B2-AND-FOLLOWUPS.md). Same-instance
reads wait for their own write/repair; another process still cannot serve a confirmed
root through an in-place pending index (availability limitation, not solved here).

1. Read/authenticate NORMAL witness; acquire a bounded SQLite write lock. Require
   the archive head to match that checkpoint with no pending append.
2. Resolve the key through the authenticated index. Run the original allocation
   factory only for authenticated absence and available capacity, inside the SQL
   transaction. Write records, index, candidate head and pending base atomically.
3. Commit data with WAL and `synchronous=FULL`; CAS the external witness from the
   exact prior checkpoint to the candidate head. Confirm pending state only after
   authenticating the result and rechecking the fence. Return seals last.

Before-data-commit process death rolls back. Death after data commit or witness
commit leaves an explicit hold. Concurrent writers encountering it fail closed;
there is no internal retry, timeout takeover or allocation through a pending head.
An ACK/result lost after confirmation can be resolved by original-key lookup.
`ensureBatch` has the same protocol and caps transactions at 1,000 inputs.

An operator first increments the independently witnessed repair epoch and sets
REPAIR mode. Old writer CAS continuations cannot advance. A live SQLite lock is
not a complete data-write fence: a pre-existing transaction may still commit after
the witness fence, have its CAS refused and leave an authenticated tail that repair
adopts with its original owner (N3). No dispatch permit follows from that adoption.
A live SQLite lock is
never stolen: repair fails busy, keeps the fence, and requires terminating/fencing
the writer and a new operator attempt. A completed attempt's SQLite backup is
coherent, but a killed backup can leave an incomplete final-name copy next to a
valid signed checkpoint (N2). Atomic temporary-file publication, fsync and a
forensic digest bound to the repair decision remain production-011 requirements;
no forensic-completion guarantee is claimed. Files are local state, **not public
review evidence**.

Repair authenticates/decrypts every record and retained key, verifies every chain
link, uniqueness and the entire witnessed prefix, and reconstructs the AVL map in
a staging table. An extra pending tail is adoptable only if its authenticated
records extend that exact trusted base; consistency of a longer local chain alone
is insufficient. Rollback, missing records, changed heads, bad keys or missing
custody stay held. Under honest writer code/keys, original sequence/body/owner/
attempt identities are preserved. This is not protection against the B2 writer fork.
No provider, SQL replay, guard release or dispatch-enable operation exists here.

Repair decisions form a separate HMAC-authenticated append-only chain whose final
digest is signed by the witness. Rebuild/decision/pending state commit atomically;
the fenced capability then signs completion and the archive confirms it. Tests
interrupt repair before/after its data commit and after witness completion, then
repair again under a fresh epoch. Ordinary triggers reject record/repair payload
UPDATE/DELETE. A database/file owner can disable triggers/change files; cryptographic
checks detect tested alterations against retained custody. This is not an owner-
proof database or protection against compromise of all keys/custody domains.

## Capacity and verification

The default hard limit is 1,100,000 records; a smaller explicit positive integer
limit can be configured. At capacity, new identities fail **before allocation**;
exact existing-key replay remains possible. No eviction, overwritten history or
automatic pruning exists. Increasing the supported bound/storage format requires
new measurements and review. Keep free space for WAL, a full rebuild and a forensic
copy; the capacity command can put forensic copies on the workspace filesystem.

From `vnext/`, with Node 24, npm 11 and the pinned PG17.11 Docker image:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm run test:archive
npm run test:archive:concurrency
npm test
npm run test:fault
npm run test:archive:capacity
```

The scale command appends the actual API corpus at 1k/10k/100k/1M, samples 100
hits and 100 misses after reopen at each size, then measures actual guarded PG
admission and two competing fake-provider dispatchers at 1M. It SIGKILLs an appender
with a committed tail, proves the hold, fully repairs the million-record archive,
and verifies original ARM identity plus older history. It reports latency samples/
distributions, node reads, encryption work, file bytes, RSS and repair duration.
No raw SQL preseed bypasses the archive protocol. Results are observations on the
reported host, not a production SLO. The capacity run needs several GB of temporary
disk and minutes of CPU/I/O; generated state remains ignored and local.

## Remaining gates and exact next increment

L0a requires independent Claude review of the pinned source and evidence before
claiming finding 017 satisfied for **local synthetic archive-dependent expansion**.
[Claude's GO WITH CONDITIONS](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6622229074)
requires independent verification of B1/B2 corrections before closure. The
[B1/B2 and N1–N6 register](18-WP2-L0A-B1-B2-AND-FOLLOWUPS.md) gives explicit owners,
acceptance criteria and entry gates. N1/N4/N5 must be addressed before inbound
expansion in L0b; L0a stays open until Claude accepts the corrections.
Production custody/credential gate 009, real-archive gate 011 and production 017
remain open. Same-host test witness/storage, POSIX process death and SQLite FULL
do not prove independent offsite durability, Windows filesystem/power-loss behavior
or real sealer authentication. F13/001, provider contracts 013/016 and every OPS01
activation case remain unchanged in [requirements 16](16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md).
No merge, deployment, live provider, credential activation or GCP provisioning.

After independent L0a acceptance, the first L0b implementation task is a **versioned,
sealed admission classification plus durable terminal ordinary-input reductions**,
with a migration and adversarial SQL/TypeScript normalizer tests W2-CL01–04. In
the same bounded L0b gate, enforce conversation-head reservation priority **before**
any protection/attempt rows (W2-RP01–04); a later input must reserve nothing while
the earlier unresolved ordinary head is ineligible. Fold Claude O1 (unique/lock
conflicts are terminal plan conflicts, not automatic same-plan retries) and O3
(no in-flight constraint tightening without reviewed revalidation) into those tests.
NEW-2/NEW-3 must be implemented and independently reviewed before booking/UI
expansion. Then complete L0's Windows TCP/child-lifecycle/bootstrap prerequisites,
L1 availability/transcript oracle and L2's first visible booking workflow. Preserve
one service per appointment, direct slot commit and all accepted P0 decisions.
