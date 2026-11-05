# L0a independent review corrections and follow-up gates

Source: [Claude review](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6622229074)
and [X1–X9 reproduction material](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6622229262).
Verdict **GO WITH CONDITIONS**, not formal L0a acceptance. B1/B2 corrections must
be independently verified by Claude. L0a remains OPEN; L0b has not begun.
The accepted WP1 closure and all production/provider/Windows restrictions remain.

| Finding | Owner / independent acceptance | Disposition and measurable acceptance |
|---|---|---|
| B1 | Codex L0a implementer / Claude | One bounded FIFO async mutex owns each instance connection through append, lookup/verify, records and repair, including awaits/confirmation. Sixteen distinct-key calls all succeed; sixteen same-key calls allocate once; reads/verification/audit wait across all write cuts and repair; failed work releases ownership; overload and cross-connection BUSY/LOCKED are typed. Existing SIGKILL/recovery cases must still pass. Implemented; independent verification OPEN. |
| B2 | Codex trust-boundary documentation/tests; future custody-verifier implementer / Claude | Explicit honest-writer/key assumption; retain X1 as a reproduced residual. Witness is CAS/size/epoch monotonicity, not chain/index extension validation. Independent verification of **both** extension properties is mandatory before any non-fixture custody (009/017). Documentation/test correction implemented; the production vulnerability is **NOT FIXED**. |
| N1 | Codex L0b admission/dispatch implementer / Claude before inbound expansion | Pending, contention and repair/integrity conditions are distinct typed availability states; B1 provides the first part. Implement and test the bounded caller policy below for inbound/dispatch, including cross-process witness/sample races, no ACK on incomplete custody, durable STOP, retained original IDs and zero uncertain resends. Caller wiring remains OPEN; no normal operation retries were added in L0a. Multi-process reads still flap while another writer is pending. |
| N2 | Codex production storage/recovery implementer / Claude at gate 011 | OPEN production prerequisite. Temp-name backup, fsync, atomic completion publication/rename and forensic-file digest bound to signed repair evidence. Kill backup, fsync/publication and repair itself; partial copies never appear as trusted completed forensics, and repair twice preserves originals. Current final-name backup can remain partial beside a valid checkpoint; neither is a completion proof. |
| N3 | Codex recovery-protocol implementer / Claude at gate 011 | Honest-path behavior explicitly documented and regression-tested now: a pre-existing transaction can commit after the witness fence, fail witness CAS and be adopted by repair under its original owner. Production acceptance must classify such tails and document the data/CAS fencing boundary, with kills and stale writers at each cut, no identity replacement, guard release or dispatch authority. Gate remains OPEN. |
| N4 | Codex archive implementer / Claude before inbound expansion | Recursive check of every nested object/array `businessId`, including envelopes, allocation and decrypted record validation. Foreign/null bindings rejected before sealing; same-tenant nested bodies survive read and repair. Implemented with regressions; independent acceptance OPEN. Opaque raw bytes require N5, not recursive string parsing. |
| N5 | Codex L0b ingress/custody implementer / Claude before inbound expansion | OPEN entry prerequisite. Bind authenticated route → tenant → configured archive facade, with no user-selected/default fallback. Define protected raw-batch custody separately from tenant partition views; tenant A cannot read B's bytes. Signed mixed-tenant batch with STOP/failing partition must retain every immediate withdrawal, archive each partition through its own authorized binding, preserve original input/permission IDs and ACK only after all required custody succeeds. Missing/foreign archive bindings, replay and archive outage fail closed. Existing single-facade refusal/PG STOP regression is retained, not advertised as this completed routing design. |
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
contract; no new ingress resolver, shared raw-custody adapter or provider is built
in this L0a correction. Implement/review this together with sealed classification
before expanding inbound. The existing fail-closed mixed-batch refusal remains.

After Claude accepts B1/B2, begin L0b code under the approved charter: sealed
versioned classification/terminal reductions (W2-CL01–04), then reservation ordering
before any reservation/attempt rows (W2-RP01–04), preserving O1/O3 and the above
pre-expansion gates. Complete remaining Windows L0 prerequisites toward L1/L2's
first visible booking workflow. No additional documentation-only milestone is
required. One service per appointment and accepted direct slot commit remain.
