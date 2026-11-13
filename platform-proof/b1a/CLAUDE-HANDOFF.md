# Independent Claude review — B1a source acceptance only

Request one verdict: **GO FOR B1a SOURCE ACCEPTANCE**, **GO WITH CONDITIONS**, or
**NO-GO**. No verdict here is cloud deployment/spending/real-provider approval.

Use the new Draft PR and exact source/tree pins in `evidence/publication.json`.
Base is corrected PR20 `2ca5cf215b68f187bfa48b42aaa041bbe93cf56d`; original INC1
implementation3204e73c823d7e552c0aacad74294617490465f6 remains immutable. Accepted
app b4d0be0cb98c7f2b69be318e18b93f4de102c511/tree03d08322e27d9d54485fa887b482743fe076556b
and127-file manifest must remain identical; diff confined to `platform-proof/`.

Read complete owner charter (PR body), PR20 review6838315312 and supporting
6838315843; ADR005Rev3/RL1–9/DR01–12 and Phase3a/3b records on PR6; PR18/19 gap/
cost/provider records; registerv1.4 pin in SOURCES.md. Then inspect source, tests,
raw evidence and candidate infrastructure directly, not just this summary.

Review [B1–8 / all gate matrix](ACCEPTANCE.md), [explicit deltas](DECISIONS.md),
[termination/operations contract](OPERATIONS.md), [exact candidate inventory](inventory.json),
[cost model](COSTS.md), [raw results/source hashes](evidence/README.md).
Reproduce the README commands from the exact source SHA, with Node24/PG17.11,
local Docker and Linux signals. Full/fault/concurrency counts overlap.

Focused adversarial checks:

1. Independently regenerate all54cells×20 and compare raw modes/ledger counts;
   retain afterCommit×REVOKE counterexample. Verify400 no-hook stops/130direct
   kills, PID start identities, original-ID replay and no UNKNOWN resend.
2. Both COMMIT losses plus unexpected ROLLBACK tag, durable vs caller state;
   native CA/hostname mismatch rejection and epoch/revision proof mismatch.
3. Authenticated post-fence initiation must be VIOLATION despite missing metrics;
   fabricated sourceVerified/copy/wrong session/key/stale/clock failures cannot
   yield containment. Inspect clock-bound derivation and native local trace.
4. Verify direct kill never resumes first; signed retirement requires deletion,
   fresh zero/reporting interval, independent canaries and complete fake ledger.
   Review session/scope/predecessor binding, CAS, budget reset/expiry and caps.
5. Review synthetic seal-beforeACK commit/read/digest/journal/eligibility and all
   cold/unavailable/timeout/false-success schedules; no production-custody claim.
6. Inspect all119 plan resources, duplicate-ID rejection, stable service/revision
   model, unique identity/tag, alltraffic/defaultdeny/fakeallow/old-deny, restricted
   DNS, privatePSC/ALB and SQLPSC paths, NAT translation logs and IAM. Confirm the
   impossible guard cannot apply and controller cannot execute printed commands.
7. Critique explicit privateALB/PSC/retention deltas, budget20USD/currency/spendcap
   assumptions and residual resource inventory. Native validate is not deployment
   compatibility or evidence of actual IAM/network/billing behavior.
8. Inspect deliberately inert container bootstrap and **pre-execution source
   gates** in ACCEPTANCE.md. Decide whether remaining live bootstrap/OIDC/Google
   observation/GCS/operational adapters require another source-only correction
   before resource authorization. No claim that these have been executed/proven.

Return blockers/conditions by local source acceptance vs pre-execution source
completion vs owner decision vs actual cloud proof. Explicitly distinguish local
Linux evidence, old Claude adapted Node22/PG16 evidence and **NOT EXECUTED** cloud
experiments. No credentials/cloud access requested for this review. Keep all
Draft PRs unmerged and protected data untouched. Do not advance B1b/B2/COMM.
