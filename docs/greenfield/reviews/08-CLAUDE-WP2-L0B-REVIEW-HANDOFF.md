# Independent Claude review — WP2-L0b

Review **source `6a4c3aa1eaea98e2155e9192f573cff1e8bc5c07`**, tree
`6068beb0b77ceb478830fc8e6a9457b7072e7154`, parent
`de9a9a995a9d6ada4b398806db29d94abfe87364`.
The following evidence commit changes only this handoff and
`vnext/evidence/wp2-l0b/`; verify that split and the published source hashes.

This is a separate Draft PR stacked on PR #9, not a merge of previous drafts.
Your [L0a closure](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6646622771)
authorized bounded local synthetic use; the owner then authorized L0b code.
**L0b remains OPEN until your independent acceptance.**

Read [implementation/requirement-to-test matrix](../19-WP2-L0B-IMPLEMENTATION.md),
[readable evidence and results](../../../vnext/evidence/wp2-l0b/README.md),
and [owned remaining gates](../18-WP2-L0A-B1-B2-AND-FOLLOWUPS.md).
This is executable library/SQL code with fake-provider workflows, not a finished
Windows booking application. Ordinary reductions are explicitly LOCAL_ONLY; no
customer reply, booking name/date validation or availability UX is claimed.

Please independently challenge:

1. **W2-CL01–04:** one sealed classification at original identity allocation,
   immutable rule/version/event/tenant/channel/subject binding; strict SQL shape
   validation without a second normalizer. Exact/repacked retry, tamper, accented
   withdrawal, controls, mixed tenants, activation COMMIT loss, ordinary/human/Menu
   and NAME/DATE context. Old frozen reductions cannot overwrite newer context.
2. **W2-RP01–04:** conversation head before plan allocation and all SQL reservation
   writes; direct SQL bypass attempts, concurrent lower/later sessions, earlier
   STAGED/ELIGIBLE-unreduced, pending confirmation and UNKNOWN. Later same/different
   slots stay held. Menu never clears uncertainty. Exact read-only proof and terminal
   output advance normally; create/confirm/cancel/confirm releases the slot.
3. **N1/N4/A1/N5:** bounded five-read policy remains five under wrapper composition;
   append invoked once, failed custody withholds ACK, STOP is already durable,
   dispatch exhaustion makes zero HTTP calls. Canonical tenant IDs and recursive
   rejection of unsupported binding keys in archive and SQL; strict inbound schemas.
   Authenticated routes select fixed tenant facades; missing/wrong facade cannot
   fall back; mixed raw bytes are accessible only through the ingress capability.
   These are fixture capability boundaries, not production compromised-process isolation.
4. **O1/O3:** SQL catches known conflict/lock timeout in a reservation subtransaction
   and commits an immutable rejection marker outside it. A failed subsequent custody
   step leaves a held, non-retryable original plan; ordinary reconciliation records
   its terminal result. Unknown outcomes are not terminalized by inference. Migration
   refuses existing input/attempt state and preserves previous migration files.
5. **A2/A3:** older tenant-policy metadata is refused, retained and never silently
   upgraded/repaired. The production operator quarantine workflow is still gated.
   Never-answering read/advance/repair-finish and late responses release the mutex
   with pending/repair held; expired queued factories never run; original IDs recover.
   Deadline is not remote cancellation. Remote/L2 runtime verification remains required.
6. **Regressions and residuals:** accepted tenant/RLS/history, receipt, suspension,
   C1/C4 output/recovery evidence, real process crash and inert restore tests remain.
   B2/X1 **still reproduces**: witness CAS/size/epoch is not independent chain/index
   extension verification. F13 physical late-submission residual **still reproduces**.
   Neither passing counterexample resolves its production vulnerability. N2/N3,
   native Windows/N6, 009/011/production-017, 013/016 and OPS01 remain OPEN.

Reproduce from the exact source with Node 24, npm 11 and pinned PostgreSQL 17.11
(Docker digest in evidence). On the verified Linux harness:

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

The general concurrency selector runs PostgreSQL/process/L0b cases; the explicit
archive command also runs the archive concurrency file. Full/fault include both.
Generated SQL snapshots, archive databases, forensic copies, keys and provider
ledgers remain local/ignored. Published plain logs and environment/summary/hash
files are sufficient to identify the run; reruns generate fresh random fixture IDs.
No new million-record benchmark or native Windows test is claimed.

Publish the exact source and environment, tests you actually executed versus
evidence reviewed, per-requirement verdict, new findings and explicit local-scope
GO/NO-GO. If satisfied, close **L0b only for bounded local synthetic use** and identify
the remaining Windows L0 implementation prerequisite toward L1/L2's first interactive
booking. Keep this PR and existing PRs Draft; no merge, providers, GCP or production
gate closure. One service per appointment and accepted direct slot/name UX remain.
