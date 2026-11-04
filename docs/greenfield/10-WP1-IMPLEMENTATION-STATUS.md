> Latest: Claude completed the independent remediation review on 2026-11-03 with
> **GO WITH CONDITIONS C1–C4** ([review](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6619904951)).
> C1/NEW-1 output validation and C4/recovery-case protection are implemented at
> `991ca8141ffef3471a955c450e9f789dd8aef1a7` with 98/98 full and 88/88 fault passes;
> [follow-up dispositions](reviews/04-CODEX-WP1-C1-C4-REMEDIATION.md).
> C2/C3 preserve activation gates and define future WP2 requirements.
> **CP1/initial CP2 remain OPEN pending independent C1 verification and formal closure.**
> No WP2 implementation, provider access, GCP or merge is authorized by this status.

> 2026-11-01 update: Claude completed independent CP1/initial CP2 review with
> **GO WITH SPECIFIED REVISIONS**. Bounded remediation and all 17 dispositions are
> in [review 02](reviews/02-CODEX-WP1-REMEDIATION-AND-DISPOSITIONS.md), with new
> versioned evidence. **CP1/CP2 remain OPEN pending independent re-review.** The
> historical implementation/evidence report below is retained; its pending-initial-
> review and mixed-tenant statements are superseded by review 02. No WP2 authorization.

# WP1 implementation candidate — owner approval and checkpoint status

2026-11-01, America/Mexico_City. The owner explicitly approved the bounded charter:
**“WP1 charter approved.”** This authorizes the synthetic slice in 08; it does not
authorize WP2, merge, deployment, real provider access or replacement of v0.8.1.
The earlier WP0 documents remain dated planning evidence; this record supersedes
their authorization/status wording only. Approved product decisions remain intact.

## Candidate result

Implemented in the isolated `vnext/` package. **Ready for independent CP1/initial
CP2 review; the WP1 review gate is not yet closed.** There is no connected Claude
tool or `claude` CLI in this environment, and PR #3 has no independent review
report. Codex's implementation and test work are not represented as independent
Claude review. The actual diff/evidence handoff is [11](11-WP1-CLAUDE-REVIEW-HANDOFF.md).

The accepted `backend/`, its tests/dependencies/configuration, static website,
working data and providers are unchanged. New application code and fixtures are
confined to `vnext/`; only this status, charter annotation and review documentation
change under `docs/greenfield/`. Existing Draft PRs #2 and #3 stay unmodified and
unmerged. The implementation uses a new draft branch based on the approved WP0
commit `e305bab763eacfdc25774c37d98a9de69c5a8da7`.

## Implemented proof path

- Exact-byte signature verification and receiving WABA/number mapping, original
  identities in a durable fake archive, atomic SQL STAGED batch, independently
  verified commit seal, then eligibility/acknowledgement. Conflicting duplicates
  reject; restarts retain original IDs. Only the literal synthetic test command
  can prepare operations. Mixed-tenant batches are rejected in this slice.
- Real PostgreSQL composite ownership constraints, one appointment mutator,
  finite half-open resource protection and source/target union; distinct
  resources may share a Calendar. Application paths use restricted roles and
  fixed-search-path definer functions; no runtime table-write grants.
- Immutable attempt/envelope, independent original owner/ARM evidence, one known
  committed submission transition and one process-local invocation continuation.
  No lease takeover, permit lookup/reissue, SDK retry or new attempt generation.
- Stable unknown/known-sender reminder permission heads, revocation priority and
  last-step admission locking; G06 status gate for both mutation and messaging.
  Reminder opt-out does not cancel bookings or disable customer-initiated actions.
- Fake-provider HTTP acceptance/lost response, read-only reconciliation, sealed
  result and atomic appointment/protection/schedule-revision/output finalization;
  receipt-before-response, monotonic delivery facts and an unknown-output barrier.
- Coherent snapshot and destructive fixture-DB loss, original post-snapshot IDs
  held as recovery cases, suppression-first inert restore and no dispatch resume.
  Broken prefix/tail/head/witness/key/version stays held, not regenerated.

File additions beyond the illustrative charter allowlist are limited to scoped
fixture setup/cleanup, repeatable run/scope scripts, seed scheduler and documentation.
They support the same proof; no product workflow was added.

## Actual verification

Node **24.19.0**, npm **11.9.0**, PostgreSQL **17.11**, image digest
`sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`.
PostgreSQL runs with `--network none`, a mounted local Unix socket, `fsync=on`
and `synchronous_commit=on`; fake providers bind only host loopback. No paid
database, cloud service or real provider account was provisioned.

| Check | Actual result |
|---|---|
| Frozen install `npm ci --ignore-scripts` | Passed, lockfile retained; no install scripts |
| `npm run typecheck` | Passed, strict TypeScript |
| `npm run check:scope` | Passed: no source HTTP/provider/env/filesystem/child-process client; no app start command |
| `npm test` | **64 passed**, 0 failed/cancelled/skipped; **19.297 seconds** |
| `npm run test:fault` | **54 passed**, 0 failed/cancelled/skipped; **12.921 seconds** |
| Seeded SQL exploration | **1,000 recorded seeds**, >900 distinct schedules; real restricted-role PG gate transactions |
| Separate process tests | Real SIGSTOP/SIGKILL and durable loopback HTTP invocation counts |
| Independent Claude review | **NOT RUN / pending**, not waived by passing tests |
| Real providers / production HA / owner Windows PC | **NOT RUN**, outside WP1 authorization |

Full logs, immutable source-file hashes, database role/function inventory, state
traces and compressed pre-cleanup SQL snapshots are under
[checkpoint evidence](../../vnext/evidence/checkpoint-1/README.md). The earlier
v0.8.1 fresh 1,089-pass result remains separate; it was not substituted for any
vNext assertion or rerun as evidence of changed backend code.

The 1,000 seeded cases explore SQL admission/withdrawal/suspension order, not
1,000 real provider deliveries or a formal proof over arbitrary processes. Each
independent case resets its fixture; crash/recovery cases retain their state.
No latency/SLO/load/availability claim follows from test-run duration.

## Honest limitations and stop/go

**F13 reproduced the known counterexample:** a process frozen after its final
admission can physically invoke after suspension once resumed. Another owner
cannot submit that attempt. A database lease is not an HTTP fence. OPS01 deployed
egress/credential/old-primary containment remains a blocker before real activation.

The archive is a local crashable stand-in on the same machine, not an independently
durable vendor service. Fixed key-version retention/missing-key handling is tested;
full rotation/KMS/offsite custody is not. A jointly rolled-back trusted head and
witness cannot be declared current merely because their old chain is consistent.
No production failover, no-loss replication or exactly-once delivery is claimed.

Recovery deliberately does **not** rebuild operational work from post-snapshot
facts. It restores the snapshot inertly, retains original missing identities as
review cases, suppresses permission heads and leaves every dispatch head false.
No resumption path exists in this slice. This proves fail-closed closure, not a
complete operational recovery service or write-resumption RTO.

The SQL uses prototype fixed function grants/role scopes for synthetic identities;
individual MFA, production operator lifecycle, KMS, legal retention and authentication
are later gates. Shared service roles granted both fixture tenants retain that
blast radius. Local PG trust and test-only fault injection are not deployable
production defaults. Native Windows/POSIX-signal compatibility is unverified.

Stop here for CP1/initial CP2. Critical/high review findings must be disposed with
code/test evidence or the affected capability disabled. **No WP2 work has begun.**
