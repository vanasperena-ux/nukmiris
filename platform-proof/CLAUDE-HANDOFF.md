# Independent Claude review — INC1 only

Please independently review the **exact tested source SHA/tree in
[evidence/publication.json](evidence/publication.json)**, plus the additive evidence
commit linked from the Draft PR. No independent acceptance is claimed. Owner has
authorized local implementation/testing only and chosen GCP; do not reopen the
provider decision or infer provisioning approval. Stop after review.

Read the owner's INC1 charter, [DECISIONS](DECISIONS.md), [ARCHITECTURE](ARCHITECTURE.md),
[acceptance map](ACCEPTANCE.md), complete code/tests, plan-only inventory/Terraform,
cost script/results, operational tools and raw evidence. Source authority:
[PR18 §3/§7/§9, MB-01–12/C-1–14](https://github.com/vanasperena-ux/nukmiris/pull/18#issuecomment-6756171002),
[PR19 review](https://github.com/vanasperena-ux/nukmiris/pull/19#issuecomment-6757066205),
ADR Revision3/9redlines/DR-01–12 pins in ARCHITECTURE. Accepted executable
b4d0be0cb98c7f2b69be318e18b93f4de102c511/tree03d08322… is unchanged.

## Challenge these points

1. MB-03: COMMIT occurs in gateway, one-use continuation only after positive
   COMMIT acknowledgement; no transferable ticket. Review actual PostgreSQL wire
   proxy loss, concurrent replay, crash/restart and scoped/immutable identity tests.
   An ENTERED row is held uncertainty, never resumable permission. Does any path
   reconnect to the provider or allocate an alternate operation after ambiguity?
2. Fresh raw TLS connection/one HTTP request/no retry/redirect/pooling; fragment
   boundaries; deadline strictly before inbound; binding-matched positive proof.
   The check/syscall gap, suspended timers, pre-fence bytes and accepted delayed
   effects remain explicit. SQL retirement must not be called physical fencing.
3. Inspect all1,000 actual stop/continue schedules and classifications, PID start
   checks and independent delayed-waker processes. Verify invocation count≤1 even
   after replay. NOT_PROVEN for SQL-only/no platform evidence is deliberate and
   must not be upgraded to cloud PASS. Assess the20 live-silence canaries and20
   killed-canary delayed wakes separately. Only local process exit is observed.
4. Check provider ledger/checkpoints against tampering, missing/partial records
   and malicious rehashing. Shared local root/supervisor and correlation headers
   are not independent production custody or authenticated cloud instance identity.
   Cloud B1a needs a real oracle; B1b needs chain AND index extension verification.
5. Challenge the classifier's interval/clock assumptions and all stale/missing/
   incomplete metrics cases. Unit Cloud inputs are fixtures only. Verify delayed
   provider application does not turn a pre-exit request into a post-exit write.
6. Validate IaC pins/guard, budget13≤15 assumption, no retained/finalSQLbackups,
   max1 services, epoch overlap, privateSQL, identities, network skeleton and open
   cross-project sealer/IAM/DNS/fake-host completion gates. Native validate is not
   deployability. Spend caps are planned separately; provider8.11.0 budgets are
   alerts-only, never hard caps. No cloud credentials/API/account were used.
7. Recompute additive≤6h/max1/G1/EnterprisePlus/residual costs, preserve old numbers,
   question allowances/SKU sensitivity. No credit/spend cap/account proof inferred.
8. Confirm diff only platform-proof;127 accepted source hashes/protected subtree
   OIDs, no app/deps/migration/runtime/profile changes, no cloud/providers/merge.

## Reproduce

Linux Node24 +local Docker/OpenSSL/Python; README has pinned public PG image.
From platform-proof: `npm ci --ignore-scripts`, `npm run check`, `npm test`,
`npm run test:fault`, `npm run test:concurrency` (overlapping suites).
Use `INC1_EVIDENCE_DIR="$PWD/.runs/review" npm test` for new raw evidence;
`node scripts/verify-evidence.mjs evidence/runs` verifies published ledgers offline.
Terraform1.17.2: init-backend=false +validate only, never plan/apply/destroy.
No cloud probe execution. Native Windows is not an INC1 acceptance claim.

Exact commands, full logs, source/tree, environment, campaign/canary count,
classification distributions and development failures are in evidence. Check final
zero-failure/no-skip reports rather than treating earlier exploratory passes as
final. Evidence added after the source pin must not change tested implementation.

## Requested verdict / remaining gates

Return GO FOR LOCAL INC1 ACCEPTANCE / GO WITH CONDITIONS / NO-GO, tied to exact
SHA and explicit scope; list blocking defects, evidence gaps and corrections.
This request does not ask you to authorize cloud implementation/provisioning.

Even a local GO leaves MB-01/B1b SQL roles/RLS, B1a platform kill/zero-instance
oracle, egress/IAM/tag propagation, cold sealer ACK, witness/custody009/011/017,
actual SQL capacity, budget-stop/monthly-resume, G06 threshold/owner disposition,
organization choice, named kill/cleanup/billing/supervisor+backup humans and exact
inventory/session/retention approvals open. C-3–14 and REAL/COMM/OPS01 remain.
No Meta/Calendar integration, tenant token fence, name-confirmation, real identity
allowlists or commercial onboarding gate is closed by this proof.

Next proposal **requires separate authorization** after independent review:
complete/review B1a's cloud-specific harness and oracle/IAM/network/expiry source,
then seek a separate resource-specific≤6h synthetic provisioning decision. Do not
start automatically or treat Free Trial credit as authority; all teardown byDec17.
