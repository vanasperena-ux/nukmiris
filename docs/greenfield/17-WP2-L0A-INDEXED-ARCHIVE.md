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

The checkpoint witness signs canonical state with Ed25519: archive ID/root/size/tip,
epoch, NORMAL/REPAIR mode and repair-decision digest. The archive receives its
public verification key and a read/CAS writer capability. It never receives the
signing private key or the operator's fence capability. An observed checkpoint
cannot regress in epoch/size or change history at the same size. Reopen accepts
an optional **externally retained** minimum checkpoint. Rolling back archive and
witness together without such an anchor remains outside this proof.

Tenant facades enforce configured grants, distinct keyed identities, business
bindings and scoped results. Facades are capabilities of the trusted service, not
production user authentication. Full audit checks the global encrypted log before
returning the facade's tenant records. Restores stay globally inert. A scoped
facade refuses mixed-business raw-batch custody, after all authenticated immediate
withdrawals have been attempted durably; it never stores B's raw bytes in A's view.
The old shared-service mixed-tenant admission regression remains. Broader inbound
routing/custody must be reviewed in L0b before expanding admission.

## Transactions, crash cuts and repair

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
never stolen: repair fails busy, keeps the fence, and requires terminating/fencing
the writer and a new operator attempt. Each attempt retains a coherent SQLite
backup plus its signed checkpoint under a unique epoch name; it never overwrites
the forensic copy. These files are local state, **not public review evidence**.

Repair authenticates/decrypts every record and retained key, verifies every chain
link, uniqueness and the entire witnessed prefix, and reconstructs the AVL map in
a staging table. An extra pending tail is adoptable only if its authenticated
records extend that exact trusted base; consistency of a longer local chain alone
is insufficient. Rollback, missing records, changed heads, bad keys or missing
custody stay held. Every original sequence/body/owner/attempt identity is preserved.
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
