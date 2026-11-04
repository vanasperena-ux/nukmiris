# WP1 conditions C1–C4 — remediation for independent re-verification

2026-11-03, America/Mexico_City. Continues [Issue #7](https://github.com/vanasperena-ux/nukmiris/issues/7).
[Claude's review](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6619904951)
independently verified the prior remediation with limits and recommended **GO WITH
CONDITIONS**. His SQL evidence was PG 16.15/Node 22; he did not independently run
the Node 24/PG 17.11 full/fault suites or inspect unpublished state archives.

**Tested follow-up source: `991ca8141ffef3471a955c450e9f789dd8aef1a7`.**
Source tree: `711b2f1b442a74c29fccd79fb7efb0e5bfca34e4`.
Diff: `1ca1924..991ca81`. Later evidence/docs commits leave tested source unchanged.
[Versioned evidence](../../../vnext/evidence/checkpoint-1-conditions-c1-c4/README.md)
and [Claude handoff](05-CLAUDE-WP1-C1-REVERIFICATION-HANDOFF.md).

**CP1/initial CP2 remain OPEN until C1 is independently verified and the WP1 gate
is formally closed.** Codex results are not that decision. PR #4 stays Draft;
no merge, WP2 application work, v0.8.1 changes, real providers or GCP.

## Condition dispositions

| Condition / finding | Change | Current acceptance status |
|---|---|---|
| C1 / NEW-1 | Validate purpose/identity before reservation; reserve future output ID across immutable plans; preflight actual final INSERT | Implemented; Codex full/fault PASS; **independent C1 verification pending** |
| C2 / remaining gates | [WP2 requirements](../16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md) keep 001/013/016 disabled and carry 009/011/017 plus all nine OPS01 cases verbatim | Recorded; no capability activated; charter cross-reference updated separately in Draft PR #8 |
| C3 / NEW-2 | Reservation-head priority and W2-RP01–04 counterexample acceptance requirements | Design recorded; NOT IMPLEMENTED / NOT RUN in WP2 |
| C3 / NEW-3 | One sealed admission classification, explicit ordinary-input terminal reduction, no second SQL normalizer; W2-CL01–04 | Design recorded; NOT IMPLEMENTED / NOT RUN in WP2 |
| C4 / NEW-4 | Append-only recovery_case payload DML; precise owner state/DDL boundary; ownership NOLOGIN/migration-only | Implemented; actual valid-RLS owner probes and inert-restore regressions pass locally |

## C1 — prevent deterministic post-provider finalization failure

Files: `vnext/src/infrastructure/postgres/migrations/002-execution.sql`,
`vnext/test/review-conditions.test.ts`, focused runner/script support.

Before creating an appointment, mutation guard, resource protection or attempt,
prepare_operation rejects non-string/unknown outputPurpose, nil/malformed outputId,
an ID used by a finalized output or another pending/abandoned plan, and an ID equal
to that operation or attempt. Comparison is on UUID values, so uppercase spellings
cannot bypass identity checks. Required-key/JSON NULL/digest/context guards remain.
Invalid ordinary cases raise plan_output_denied; earlier shape guards may deny first.

The unique operation_output_identity index reserves `(business_id, outputId::uuid)`
in the immutable operation row. An existence check alone cannot serialize two
transactions that both see an unused ID. The index enforces one winner before any
final output exists. Abandonment releases capacity, never original identity. Exact
repeat of the original sealed plan still returns its original operation before
collision checks, including after finalization; no extra invocation is allocated.

The internal insert_operation_output helper is the same INSERT used by preparation
and apply_result. Preparation projects the eventual schedule revision, performs the
INSERT in a subtransaction, then deliberately rolls it back using only its private
success sentinel. Real type/NOT NULL/CHECK/UNIQUE/composite-FK errors escape and roll
back the whole preparation. No output row remains visible/durable; only verified
provider proof finalizes one. Runtime roles and PUBLIC cannot call the helper.
Current output constraints are immediate; this does not promise availability under
arbitrary later DDL or compromise of a migration identity.

### Every final output field: validation source

| Output field(s) | Pre-provider validation |
|---|---|
| business_id, parent_operation_id, input_id, appointment_id | Scope/sealed plan, eligible input, persisted scoped operation/appointment and actual composite FKs |
| id | UUID/type/nil/self-alias checks; existing output/plan check; immutable-plan unique index; actual output PK |
| conversation_id, sequence, ordinal, recipient | Authoritative input; input constraints; constant ordinal 0; sealed envelope context; actual output FK/uniqueness/NOT NULL |
| payload, payload_digest | Required non-NULL fields, recomputed canonical digest and actual output schema |
| schedule_revision | Locked appointment with the same kind-dependent increment as finalization; actual type/overflow/NOT NULL checks |
| purpose | Exact CUSTOMER_REQUEST/REMINDER enum before reservation; actual table CHECK |
| due_at, deadline_at | Finite/ordered envelope context and actual table CHECK/casts |
| state | Fixed PENDING, exercised by shared INSERT |

Tests cover 23 invalid purpose/identity variants, finalized/pending/abandoned IDs,
semantic uppercase aliases, exact replay, both valid purposes and successful
finalization, other plan-sourced output fields, an added fixture-only output CHECK,
and two genuinely overlapping transactions. The loser actually waits on the unique
index while the winner is uncommitted; one reservation/attempt survives and no
output exists before proof. Negative cases assert zero new committed reservation
rows. Existing finalizer rollback/duplicate/UNKNOWN tests remain green.

## C4 — precise owner boundary and recovery evidence

003-dispositions.sql adds recovery_case to the append-only payload set (nine tables).
INSERT remains possible for restore/evidence retention; UPDATE/DELETE of original
evidence or reason is refused. Restore uses INSERT/ON CONFLICT DO NOTHING and remains
tested; original evidence is never rewritten.

The claim is **payload DML protection while triggers are enabled**. wp1_owner owns
the core tables and is not an untrusted runtime identity. With valid RLS scope it
can still change permitted input/attempt state fields and disable its own triggers
or perform DDL **without superuser**. NOLOGIN does not remove those powers from a
migration principal allowed to assume ownership. The bootstrap explicitly keeps
ownership NOLOGIN and gives runtime roles no owner membership. Production migration
credentials must stay separate; authenticated custody/role isolation under 009 is
still an unresolved activation gate.

Tests show owner recovery_case UPDATE/DELETE denied with valid RLS; runtime direct
DML/SET ROLE and shared-helper EXECUTE denied. A separate probe deliberately shows
owner state changes and trigger-disable DDL, then rolls back. Those owner actions
are not represented as forbidden. README, SQL comments and prior Codex owner wording
are corrected. Original Claude review/scripts and old evidence remain unchanged.

## Verification and remaining limits

Node **24.19.0**, npm **11.9.0**, pinned PostgreSQL **17.11** image
`sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`:

- Full suite **98/98 PASS**; fault suite **88/88 PASS**, separate fresh cluster;
  zero failed/cancelled/skipped.
- Strict TypeScript and source confinement PASS.
- Existing 1,000 SQL schedules, 256 overlapping schedules, process crash/freeze
  tests and F13 counterexample remain included; no guarantee was weakened.
- Pre-fix condition probes on unchanged reviewed migrations: six failures/four
  controls passed. Internal-helper ACL assertions were added afterward; defect
  probes are unchanged. This is not an independent reviewer execution.

Linux synthetic fixtures only. Native Windows/WSL, real providers/gateway,
production custody/repair/scale and cloud activation are NOT RUN. Readable logs,
minimal condition results, schema metadata and hashes are published. SQL/state
archives remain local; prior upload restrictions are not bypassed or retried.

Once independently accepted, the first concrete WP2 implementation is L0a indexed
authenticated fixture-archive lookup/capacity/repair proof under 017, followed by
sealed classification and head-aware reservation before booking UI. [Requirements
16](../16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md) define acceptance. No such
code begins until C1 verification and formal WP1 closure are recorded in GitHub.
