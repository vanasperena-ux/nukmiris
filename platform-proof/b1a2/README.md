# B1a-2 — source preparation, never cloud authorization

This increment implements the owner's [charter](OWNER-CHARTER.md), stacked on PR #21 publication `ac38ede7777e5493a458995b021a103e55a0059e`. It changes only `platform-proof/`. Accepted application `b4d0be0cb98c7f2b69be318e18b93f4de102c511`, its 127-file source manifest, legacy trees and all historical INC1/B1a evidence remain unchanged.

The authoritative independent findings are [Claude's complete review](https://github.com/vanasperena-ux/nukmiris/pull/21#issuecomment-6868306319) and [support](https://github.com/vanasperena-ux/nukmiris/pull/21#issuecomment-6868306568). Verbatim review snapshots are in `reviews/`. Their original environments and results remain independent historical evidence, not results of this increment.

**Candidate for independent source review only. Actual Google Cloud safety is NOT PROVEN.** No credentials, live API calls, account discovery, deployment, cloud resources, spend, real providers or owner data are required by these tests. An immutable `LIVE_CLOUD_EXECUTION=false` check precedes future cloud credential, metadata and subprocess paths. Terraform also has contradictory authorization validation/preconditions: passing `true` is invalid; passing `false` cannot satisfy the apply gate. CLI flags and environment variables cannot authorize either path.

## Implementation map

| Finding | Source | Local verification |
| --- | --- | --- |
| D-1 | `src/evidence-source.mjs`, `runtime/time-model.mjs`, `src/classify.mjs` | Authenticated 10s/150s/10min initiations are VIOLATION, ahead of unrelated missing metrics; horizons, drift, overlapping intervals, conflicting/missing/copied clocks hold |
| D-2 | `runtime/retirement.mjs`, `runtime/observer.mjs`, `runtime/canaries.mjs` | Complete active+idle 60s samples, visibility latency, physical deadline, >=20 pre-fence parked native processes, delayed wakes and independent ledger reach EVIDENCE_READY; incomplete/stale/conflicting evidence holds |
| D-3 | `ops/plan.mjs`, `ops/teardown-permissions.mjs` | Every generated fence command and inventory cleanup permission maps to a principal/scope; removal of kill/traffic/delete/actAs authority blocks |
| P-1 | `schema.sql`, `runtime/startup.mjs`, `runtime/assembly.mjs`, restricted existing proof gateway/store | Real local PostgreSQL admission → independent immutable custody → worker → COMMIT-bound gateway → mTLS fake; SQL hold, restart, bad mounts/identity/epoch/revision/expiry/image/database stay inert |
| P-2 | `runtime/cloud-api.mjs`, `transport.mjs`, `identity.mjs`, `observer.mjs`, `canaries.mjs`, `transit.mjs` | Google-shaped localhost API fixtures, opaque immutable receipts, raw preservation, signed envelopes, actual mTLS clock/ledger, native independent SIGSTOP/SIGCONT control; no old gateway trace as primary activity source |
| P-3 | `ops/controller.mjs`, `prepared-adapter.mjs`, `teardown.mjs`, `cli.mjs` | Durable INTENT/RESULT, exact-command digests, interrupted outcome read-back, no automatic replay, seven-step prerequisites, explicit promotion/abort/emergency and complete inventory simulation |
| P-4 | `runtime/fake-provider.mjs`, `fake-client.mjs`, `network-policy.mjs`, `build/` | Standalone TLS1.3/mTLS fake, source and epoch binding, fsynced effects, controlled observer export, pinned packaged source; native container inert-health/gate check; modeled revocation versus established sockets |
| P-5 | `runtime/billing.mjs`, `calculate-costs.py` | USD versus MXN fixed-point conversion, freshness/units, alert-only versus hold, reset/delay/pause/restart/suspension/expiry; holds survive restricted SQL reads |
| P-6 | `generate-infra.mjs`, `terraform/`, `inventory.json` | 30 placement-only removals; same-project sealer, separate custody; native Terraform validate, full inventory/dependency and IAM static checks |
| P-7 | `runtime/inputs.mjs`, `owner-inputs.template.json` | Exact projects/numbers/identities/names/ranges/epochs/window/operators/budget/images; invalid real-account template fails; synthetic inputs are never provisioning inputs |

## Startup and effect boundaries

`assembly.mjs` assembles gateway, ingress, sealer, worker, independent observer and fake from explicit mounts and dependencies. The future mounted cloud branch verifies metadata-flavored signed identity against pinned issuer/audience/email/subject, creates TLS-verified private SQL pools, obtains service invocation identity separately from the internal caller key, and uses the scoped custody API. It is blocked at entry in this source.

Cross-process startup uses purpose-bound signed identity attestations, independently retrieved from Cloud Logging and checked against actual role image/SA/revision API receipts. `K_REVISION` (services) and `CLOUD_RUN_REVISION` (worker pools) must match the approved deployment. Startup attestations cannot authorize a provider effect. The initial inert gateway revision is explicitly removed before enabling the prepared old revision. Cloud Run liveness/readiness probes use health; application dispatch readiness and every effect remain separately SQL-gated.

Secret payloads and keys are not Terraform resources or image contents. Runtime bundles are pinned numeric Secret Manager versions: manifest, profile, restricted-role DB configuration, caller key and gateway mTLS bundle. No `latest`. Manifest paths are bounded regular files; symlinks and missing mounts hold. Roles cannot select an administrative SQL login. Runtime readiness is checked before gateway entry and on worker/ingress/sealer operations; SQL rechecks dispatch under the transaction lock. Session expiry shortens the effect deadline. A cached verified workload identity expiring also makes the process inert; it cannot extend a session or reset a SQL hold. A longer supervised run must explicitly refresh/restart valid identity before expiry; restart never promotes dispatch.

New SQL is only disposable proof SQL. An explicit `SyntheticInitialization` verifies four opaque startup capabilities and independent fake/custody preflight before a fresh BOOTSTRAP promotion. An expired or protected hold cannot use this route. `AuthorityHeartbeat` renews an already-valid SQL lease only; the provisional five-second lease is a local test policy pending O-4 review, and its expiry clamps the gateway permit deadline. Failed billing journaling cannot prevent a SQL hold, and SQL failure cannot prevent the independent emergency-kill request. `worker_plan_b1a2` accepts an independently committed/sealed original binding; `enter_b1a2` requires that sealed admission before the accepted COMMIT continuation. Original operation/attempt IDs persist. ARMED work may be retried at the gateway gate; ENTERED/UNKNOWN work is not rearmed or assigned a replacement identity. An uncertain custody PUT holds the exact immutable slot until read-only resolution; a new sealer reads the original committed seal after restart.

## Clock, evidence and limitations

The V2 model expands conservative uncertainty per timestamp, including measured RTT/offset, precision, declared drift and resynchronization allowance. Nominal 60s calibration intervals and the hard extrapolation horizon are separate. A historical conclusive violation remains a violation even if unrelated metrics are missing. Contradictory related clock bounds prevent a fabricated conclusion. A stale source cannot authorize retirement.

The observer collects actual protocol-shaped API responses, independent fake mTLS ledger/clock data and raw hashes. Provider acceptance is not client initiation. Activity requires an authenticated fake TLS flow bound to independent NAT evidence and a bounded transit policy. The local measured transit policy is **not a universal Internet transit guarantee**; actual-cloud network transit acceptance is a blocking review/measurement gate. A Google HTTP Date is only a calibration sample; the relationship to internal metric timestamps needs an explicit conservative allowance. This model does not claim Google supplies a proven oscillator/network bound.

Metric sample and first-observer-read times are different. Missing active/idle labels, points, incomplete pagination and unknown flow associations hold. In this bounded experiment collectors reject paginated/incomplete exports rather than silently accepting a partial page. The source does not infer death from missing heartbeat, 404 alone, request timeout, zero traffic, or missing canary request. Deletion receipts, complete zero series and independent canaries/ledger all remain required. Physical deadline is not extended by publication latency.

Native canaries are parked at an instrumented pre-connect point and observed via independent `/proc` PID start identity, SIGSTOP and a separate waker. These are not arbitrary asynchronous instruction suspensions; existing B1a suites separately exercise asynchronous schedules. Canaries are prepared before the declared retirement and wake afterward. Cloud control/log adapters preserve nonce/session/revision binding; their actual Cloud Run wake efficacy, freeze/termination semantics and non-Byzantine control provenance still require supervised cloud evidence. No local test establishes those platform properties.

## Reproduction

Use Linux, Node 24 and the exact PostgreSQL 17.11 digest from `test/helpers.mjs`. Run Docker fixtures serially. Keep at least 1.5GB free beyond cached images; on VFS, do not keep temporary Node build layers while initializing PostgreSQL. Never prune unrelated Docker resources.

From `platform-proof/`:

```sh
npm ci --ignore-scripts
npm test
npm run test:fault
npm run test:concurrency
node --test --test-concurrency=1 test/b1a2-*.test.mjs
node b1a2/check.mjs
node b1a2/generate-infra.mjs
python3 b1a2/calculate-costs.py
node b1a2/ops/cli.mjs fixture-plan
node b1a2/ops/cli.mjs owner-template
node b1a2/ops/cli.mjs simulate-crash
```

The separately identified `b1a2/evidence/publication.json` records exact tested source/tree, suite commands, logs and checksum manifests. Evidence publication commits do not change that tested implementation. Native container and Terraform commands are recorded there too. Historical raw evidence is not regenerated.

## Remaining authorization gates

O-1 runtime-project sealer and O-6 disposable one-day retention are approved **for B1a only**. O-2 organization/standalone review; O-3 named supervisor/kill/cleanup/billing/backup/custodian; O-4 physical bound and independent canary schedule; O-5 exact projects/resources/images/currency/FX/budget/window; O-7 optional restore drill remain open.

A favorable source review is not permission to remove guards, issue credentials, query an account or provision. Actual cloud IAM, internal ingress/private SQL, firewall enforcement/established flows, physical old-instance death, clock/transit bounds, metric/canary observations, Free Trial/spend-cap eligibility and full teardown billing must be proven separately. B1b restores seven-day recovery and production custody gates. B2/real Meta token fencing, explicit name confirmation and approved WhatsApp identities remain blocking. No commercial onboarding is implemented.
