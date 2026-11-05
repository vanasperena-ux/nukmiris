# L0a independent review corrections and follow-up gates

Source: [Claude review](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6622229074)
and [X1–X9 reproduction material](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6622229262).
The original verdict was **GO WITH CONDITIONS**. Claude subsequently
[independently accepted B1/B2 and N4 and formally closed L0a for bounded local synthetic use](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6646622771).
The owner authorized L0b implementation. Current L0b dispositions are below and in
[document 19](19-WP2-L0B-IMPLEMENTATION.md); L0b independent acceptance remains pending.
The accepted WP1 closure and all production/provider/Windows restrictions remain.

| Finding | Owner / independent acceptance | Disposition and measurable acceptance |
|---|---|---|
| B1 | Codex L0a implementer / Claude | One bounded FIFO async mutex owns each instance connection through append, lookup/verify, records and repair, including awaits/confirmation. Sixteen distinct-key calls all succeed; sixteen same-key calls allocate once; reads/verification/audit wait across all write cuts and repair; failed work releases ownership; overload and cross-connection BUSY/LOCKED are typed. Existing SIGKILL/recovery cases pass. Independently accepted for local synthetic use. |
| B2 | Codex trust-boundary documentation/tests; future custody-verifier implementer / Claude | Explicit honest-writer/key assumption; retain X1 as a reproduced residual. Witness is CAS/size/epoch monotonicity, not chain/index extension validation. Independent verification of **both** extension properties is mandatory before any non-fixture custody (009/017). Documentation/test correction implemented; the production vulnerability is **NOT FIXED**. |
| N1 | Codex L0b admission/dispatch implementer / Claude before inbound expansion | Implemented in L0b, independent acceptance pending: typed availability states, five bounded read-only attempts, whole-call deadline, one append invocation, no incomplete ACK, durable STOP and original-key recovery. Composed wrappers preserve the five-read limit. Dispatch exhaustion returns HELD without HTTP. Active/crashed pending and cross-process witness/sample races remain tested. No automatic repair or provider resend. |
| N2 | Codex production storage/recovery implementer / Claude at gate 011 | OPEN production prerequisite. Temp-name backup, fsync, atomic completion publication/rename and forensic-file digest bound to signed repair evidence. Kill backup, fsync/publication and repair itself; partial copies never appear as trusted completed forensics, and repair twice preserves originals. Current final-name backup can remain partial beside a valid checkpoint; neither is a completion proof. |
| N3 | Codex recovery-protocol implementer / Claude at gate 011 | Honest-path behavior explicitly documented and regression-tested now: a pre-existing transaction can commit after the witness fence, fail witness CAS and be adopted by repair under its original owner. Production acceptance must classify such tails and document the data/CAS fencing boundary, with kills and stale writers at each cut, no identity replacement, guard release or dispatch authority. Gate remains OPEN. |
| N4 / A1 | Codex archive/ingress implementer / Claude before inbound expansion | L0a recursive exact-key protection independently accepted; L0b adds canonical lower-case ASCII tenant slugs and rejects alternative binding keys recursively in archive and SQL. Validated inbound schemas reject unsupported fields. Opaque strings stay opaque. Tenant-policy version 2 rejects older metadata (A2). New regressions await L0b acceptance. |
| N5 | Codex L0b ingress/custody implementer / Claude before inbound expansion | Implemented in L0b, independent acceptance pending: authenticated route → fixed tenant capability, no fallback; separately scoped raw custody excluded from tenant views. Mixed-tenant STOP/failing-partition, missing/wrong facade, outage and replay tests preserve immediate revokes/original IDs and withhold ACK until custody is complete. Fixture same-process/key custody is still not production independence. |
| N6 | Codex Windows/runtime implementer; owner native-device acceptance / Claude review | OPEN operational gate. Preserve linear rebuild/held-window and disk limitations; measure native Windows storage, WAL/lock/child lifecycle, peak RAM, backup/staging/WAL disk and recovery duration. Baseline: Codex 1,000,097 records / 340.167s / ~400MiB peak; Claude 1,000,001 / 256.518s / ~212MiB (PG workflows skipped). Budget roughly 3× archive disk plus headroom. Linux process death and these host observations are not Windows/power-loss guarantees or SLOs. |

## N1 bounded caller policy required in L0b

The archive **never retries internally**. `ArchiveBusyError` (`ARCHIVE_BUSY`) means
the 64-operation instance bound, active-close protection, or SQLite BUSY/LOCKED.
`ArchivePendingError` (`ARCHIVE_PENDING_CONFIRMATION`) can mean a normal in-flight
write **or a crashed writer**. `ArchiveHeldError` (`ARCHIVE_HELD`) reports a repair
fence/checkpoint mismatch. Other integrity/witness/disk errors must not be converted
to availability success or authenticated absence. A mismatch may also involve a
stale witness sample: independently revalidate state; do not assume a crash.

For availability polling, permit at most **five read-only attempts**, with waits
of **25/50/100/200ms**, constrained by the earlier request/operation deadline.
On exhaustion, return a durable pending/held result for operator/status handling;
never start repair, steal a lock or infer absence from elapsed time. This is a
specified caller bound, not proof that 375ms distinguishes a crash from latency.
Review the policy with real local-runtime timings before enabling L2/multiple workers.

Do not blindly retry an append: an error can follow data/witness commit. Once
custody is independently healthy, use the **same original key/intent** and reconcile
its original result; conflict is terminal, never a new identity/owner. No provider
retry or recovered dispatch permit follows from any archive status/error. Enforce
SQL final gates/deadlines and preserve UNKNOWN guards. Ordinary admission ACK waits
for complete custody; every already authenticated immediate STOP stays durable even
when custody/other partitions fail. Tests must force both active and crashed pending
writers, not depend on wall-clock timing to establish ownership.

## N5 implementation binding required in L0b

The ingress service must resolve facades from server-authenticated WABA/receiving-
number routes and fixed per-business configuration. Cross-business raw envelopes
belong in separately restricted ingress custody; each tenant partition gets its
own encrypted normalized seals plus a digest/reference to that protected original,
not a readable copy of all tenants' bytes. Missing binding is an explicit custody
failure, never the first/default facade. This is a required design/implementation
contract. L0a did not build it; L0b now implements and tests it together with sealed
classification. Its independent review must accept the new safeguards before
broader inbound expansion. No real provider adapter is built.

## Closure follow-ups A2/A3 and O1/O3

A2 remains under production repair gate 011: quarantine and independently revalidate
older incompatible archives; never silently reuse pre-N4 synthetic state. L0b
rejects older metadata before backup/repair and uses freshly created fixtures.
The production operator workflow remains OPEN.

A3 local deadlines are implemented for queue wait and witness read/advance/repair
finish. Never-answering and late responses release the instance mutex while pending
data/repair stays held; repair retains the original identity. A deadline is not a
remote cancellation or custody proof. Before any remote witness or L2 multi-worker
deployment, independently verify the actual transport budget, late completion and
original-key reconciliation. Remote operation and L2 runtime acceptance remain OPEN.

O1 is implemented as an atomic SQL conflict marker plus sealed terminal reduction;
failure between marker and reduction holds until ordinary reduction reconciliation,
never retries the rejected plan. O3 rejects migration over existing input/attempt
state; actual live migration/revalidation remains gated. Both await L0b review.

After Claude accepts B1/B2, begin L0b code under the approved charter: sealed
versioned classification/terminal reductions (W2-CL01–04), then reservation ordering
before any reservation/attempt rows (W2-RP01–04), preserving O1/O3 and the above
pre-expansion gates. Complete remaining Windows L0 prerequisites toward L1/L2's
first visible booking workflow. No additional documentation-only milestone is
required. One service per appointment and accepted direct slot commit remain.
