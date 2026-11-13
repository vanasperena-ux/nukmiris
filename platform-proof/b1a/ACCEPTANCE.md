# B1a requirements, local evidence and unresolved gates

**Source/local scope only.** Results and tested SHA are in `evidence/README.md`.
"Local" below never means a Google platform pass. Claude has not yet reviewed
this increment. Historical INC1 evidence and its A1 correction are untouched.

## Mandatory Claude INC1 conditions

Exact finding: [PR20 comment6838315312 §5](https://github.com/vanasperena-ux/nukmiris/pull/20#issuecomment-6838315312),
[probes P1–P4](https://github.com/vanasperena-ux/nukmiris/pull/20#issuecomment-6838315843).

| Condition | Implemented / acceptance test | Local scope / remaining cloud proof |
|---|---|---|
| B-1 / F1 / P2,P3 | `test/b1a-interruption.test.mjs`: 54 explicit cells×20=1080; separate control/provider fields; afterCommit×REVOKE effect counterexample; 400 asynchronous no-hook stops,130 direct kills, replay/expiry/UNKNOWN; existing1000 campaign retained | Actual Linux signals/PG/TLS. Raw seed/delay/identity/matrix/ledger checked by new verifier. Not exhaustive instruction coverage or cloud CPU evidence |
| B-2 / F2,F7 / P4 | `src/classify.mjs`, `src/evidence-source.mjs`; tests classifier/clock/native-proof/session: conclusive authenticated initiation wins before incomplete metrics; fresh zero/deletion/clock required; fabricated sourceVerified/copies/tampering rejected | Ed25519 fixture origins and native process trace proven locally. Actual Google observation collection, independently pinned administration and cloud clock samples NOT PROVEN |
| B-3 / F4 | `helpers.stop` and cleanup issue direct SIGKILL, never SIGCONT; stopped native identity/exit signal checked | Local exit only; platform deletion/zero/canary are separate signed contracts |
| B-4 / F5,F6 / P1 | `commit-proxy.mjs`, `b1a-gateway`: COMMIT-before-server → callerUNKNOWN/durableARMED/no invocation; explicit original-ID replay once. ACK-lost → durableUNKNOWN/no resend. ROLLBACK tag grants no continuation | Durable state, not caller response, is authority. No pooled/reusable permit |
| B-5 / F6 | Exact positive-proof scope/attempt/op/digest/epoch/revision; BAD_EPOCH/BAD_REVISION causeUNKNOWN; verified SQL CA+DNS, native wrongCA/wrongHost rejection; opaque private-SQL profile; mTLS certificate mapping | Fixture SQL TLS and fake identity tested; actual SQL PSC/CAS CA/CloudRun identity and managed roles still need cloud proof. No RLS relaxation |
| B-6 / F3 | Stable service/new revision-SA-tag each epoch; `ops/controller.mjs` prints seven exact bound steps; SQL session hold/advance/CAS and predecessor binding; new epoch rollback | Dry-run commands and policy tested, **never executed**. Actual propagation/termination/reporting delay/threshold must be measured |
| B-7 / F3 | New119-resource guarded candidate: per-epoch fake allow + priority100 old deny, restrictedVIP/DNS, alltraffic, private worker/sealer, NAT ALLlogs, independent kill IAM, SQL17Enterprise, caps, budget/spendcap/expiry/inventory/teardown | Terraform native validate + static assertions only. Account/org/region/API/IAM/PSC/tier compatibility and actual cost control remain untested |
| B-8 / F8 | `fixture-diagnostics.mjs`, diagnostics tests: intentional failed PG startup, state/reason/exit/OOM/logs/readiness/owned IDs captured before removal; startup≤60sec; redaction and exact-volume cleanup | Original earlier failure's cause is still unconfirmed. No broad Docker cleanup |

B1a's full/fault runs include the original INC1 campaign, concurrency, transport,
permission, counterexample, canary, fixture and planning suites. Counts overlap.
Independent Claude's original 54-cell adapted Node22/PG16 evidence remains separate
from the newly published native Node24/PG17 evidence; it is not relabeled ours.

## PR18 / INC1 / ADR gate reconciliation

Status vocabulary: **I** implemented source; **L** validated local fixture;
**CLOUD** actual cloud test required; **OWNER** explicit decision/authorization;
**B1b/B2/COMM** deferred implementation boundary. No CLOUD cell is passed here.

| Requirement / trace | I / L | CLOUD / OWNER / later |
|---|---|---|
| B-G01 scope/pins/approval; RL9 | isolated source, preserved app/history; check and evidence manifests | Independent source acceptance and separate exact resource authorization OWNER |
| B-G02/MB03 one-use original identity, COMMIT, no retry; RL2/DR12; B-T03/04/09 | gateway closure, proof bindings, full campaign, concurrency and COMMIT fault tests | Gateway/application permission/channel/recovery revision integration B1b; REAL/OPS01 before B2 |
| B-G03/MB01 managed SQL/RLS; RL1/RL3 | minimal proof roles only, verified TLS, real aggregate login cap4; role escalation denial | PG17Enterprise actual tier/extensions/PSC/CAS CA/max_connections; managed bootstrap privileges/IAM session_user mapping CLOUD; full application RLS/restore roles B1b, no cloudsqlsuperuser workaround |
| B-G04/05 custody009/011/017; RL8; B-T11 | fixture fsynced chain/checkpoint and authenticated envelope tamper tests | Production independent record-chain AND index extension, fork/non-membership/CAS/repair/quarantine/remote-witness deadlines B1b and custody gates; local signatures do not close them |
| B-G06/MB06 DR01/02/07/10/12; RL6; B-T04/05/06 | direct kill/native traces, real delayed-waker canaries, signed retirement contract, exact revision controller | Actual deletion+zero after measured reporting delay, independent≥20 delayed-wake trials, open-socket/partial-write, old tags, concurrent releases, old-primary return, p50/p99/max D CLOUD; threshold and G06 disposition OWNER |
| B-G07 DR05/08; RL1; B-T01/02 | alltraffic/defaultdeny/unique tags/restrictedDNS/NAT/secret/KMS/IAM source checks; gateway mTLS fake target | Actual forbidden routes IPv4/IPv6/DNS/alternate/established sockets, no-VPC/private-ranges-only rejection CLOUD. Organization choice OWNER; standalone is weaker, requires review; real Calendar credential denial B2 |
| B-G08/09; RL4/DR09; B-T08 | separate synthetic ingress/sealer SQL functions, committed batch read/fsync/eligibility, timeout/failure noACK | Real private cross-project PSC/ALB/OIDC/secret-mount/GCS adapters and cold/recycle latency CLOUD + pre-execution source review. Full Meta raw-wire/tenant admission and separate result boundary B1b/B2 |
| B-G10/MB07; RL5; B-T07/14 | min/max1 worker source, instanceCPU gateway; deadlines/expiry/restart/overlap tests, role aggregate caps | Worker lifecycle/backpressure/pool0/due-lag alarms, actual requestCPU-after-timeout wake and quota/overshoot/load/starvation CLOUD. Durable app due-work B1b; no requestCPU background assumption |
| B-G11; RL8; B-T12 | inert bootstrap, held originalIDs and no rearm; inventory/export retention contract | Actual independent export/PITR/SQL+archive+key-loss/old-primary inert restore B1b; no safe-write RTO claim |
| B-G12; RL2/DR03/06; B-T10 | fake lost/delayed responses, partial write, at most1 connection/request, bound proof | Fake Calendar duplicate-ID/ETag and partial frame application integration B1b; genuine provider/Meta token A/B fence B2; no OAuth-grant fence; Calendar collision detection never guaranteed |
| B-G13/14; RL2; B-T13 | accepted app/register untouched | Explicit new-customer name confirmation before real WhatsApp B2; approved identities only; EmbeddedSignup/business-owned WABA/credential lifecycle/MB08 COMM, not implemented |
| B-G15; RL9; B-T15 | gross20USD proposal,10/15/18/20alerts; pure cap template; six-hour SQL expiry/sticky holds and watchdog decision; all119 resources covered by teardown inventory | Actual eligibility/currency/FX/quota/cap pause/reset, billing lag/residuals/invoice/absence CLOUD; named supervisor/kill/custody/cleanup/billing/backup humans and≤6h OWNER; no cap claims |
| B-G16 privacy/data region/operator policy; RL8 | synthetic IDs only, no owner data/secret exports; declared candidate us-central1 | Region/retention/legal/ARCO/operator MFA and custody human-root limits OWNER before applicable real data; real production B2/COMM |

## Pre-execution source gates / deployability limits

The source is **not deploy-and-run**. All IaC apply paths remain impossible.
The container bootstrap is deliberately inert and no image was built/pushed.
Before a future experiment can send any synthetic effect, independently review:

1. Exact unique project IDs/numbers, approved image/base/OS digests and region APIs,
   tested CLI versions, live adapter orchestration and secret mount schemas.
2. Cloud Run IAM/OIDC worker→gateway and ingress→private-sealer path, CAS-CA SQL PSC
   identity, narrow bootstrap privileges and separately administered observation
   collectors/public trust pins. No fixture signature may impersonate Google facts.
3. Network admission/audit enforcement, independent kill/controller permissions,
   truthful metrics semantics/reporting delay and clock measurement lifecycle.
4. Actual six-hour staffed independent supervisor/cleanup execution, clock-loss
   response, spend-cap eligibility and residual-billing inventory. SQL expiry only
   blocks new entry: it does not delete infrastructure or stop all charges.
5. Explicit proposed network/retention inventory deltas in DECISIONS.md. No
   historical ADR amendment, guard removal, B1b or real activation is implied.

If independent review requires these adapters completed in a follow-up source-only
increment before resource approval, that remains a source gate, not a reason to
provision early or promote with partial evidence. The current handoff asks for
B1a **source acceptance**, with these limitations visible.
