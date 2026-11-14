# NukMiris — B1a-2: Cloud Execution Readiness Preparation

## OWNER AUTHORIZATION — CODE AND LOCAL SYNTHETIC TESTING ONLY

The owner explicitly authorizes implementation of **B1a-2**, including:

- Claude findings D-1, D-2 and D-3.
- All pre-provisioning source tasks P-1 through P-7.
- The simplified B1a sealer placement in the runtime project.
- One-day backup/PITR retention for the disposable B1a synthetic environment only.
- Local development, automated tests, fault injection, documentation and publication of a new Draft PR.

**The owner does NOT authorize:**

- Google Cloud provisioning or deployment.
- Spending money or changing billing.
- Using or accessing Google Cloud account credentials.
- Any live Google Cloud API calls, including read-only account discovery.
- Real Meta or Google Calendar calls.
- Accessing or modifying owner/customer data.
- Merging pull requests.
- Activating any externally reachable infrastructure.
- Beginning B1b, B2 or commercial onboarding.

This authorization is restricted to source-only preparation and hermetic/local synthetic testing.

## 1. Repository and required reading

Repository: `vanasperena-ux/nukmiris`

### Accepted application

Draft PR #16.

Accepted executable commit:

`b4d0be0cb98c7f2b69be318e18b93f4de102c511`

The accepted application and its protected worktrees must remain byte-identical.

### Architecture

Read and preserve:

- ADR-005 Revision 3.
- Nine mandatory safety redlines RL-1 through RL-9.
- Corrections DR-01 through DR-12.
- Draft PR #18 architecture reconciliation and cloud implementation plan.
- Draft PR #19 provider comparison and independent Claude review.
- Draft PR #20 INC1 implementation, acceptance evidence and A-1 correction.
- Draft PR #21 B1a implementation and its complete evidence package.

### B1a source baseline

Tested implementation:

`38ad02abbb0b7353f6768ff67f74542a4df0dedb`

Published evidence head:

`ac38ede7777e5493a458995b021a103e55a0059e`

### Independent Claude review — authoritative findings

Main review:

https://github.com/vanasperena-ux/nukmiris/pull/21#issuecomment-6868306319

Supporting evidence:

https://github.com/vanasperena-ux/nukmiris/pull/21#issuecomment-6868306568

Read the entire review, especially:

- D-1 through D-3: acceptance-blocking defects.
- P-1 through P-7: required source completion before provisioning.
- O-1 through O-7: owner decisions.
- Findings regarding clock drift, evidence latency, kill authority, private networking, fake-provider deployment and billing currency.

The Claude review is the authoritative defect and gate register for this increment.

## 2. Objective and implementation boundaries

Complete the source code and local validation needed for a later, separately authorized, supervised Google Cloud B1a synthetic experiment.

The implementation should be sufficiently complete that a subsequent cloud session can test infrastructure behavior rather than discover missing startup wiring, identities, evidence collection or command execution logic.

However, source completeness does not mean that cloud safety is proven.

Create a dedicated B1a-2 branch and Draft PR, stacked on the complete PR #21 publication head.

Implement changes only within `platform-proof/` and its B1a-related subdirectories.

Preserve historical INC1/B1a evidence, source pins, logs and review records. Record new evidence separately.

Do not modify the accepted application, legacy backend, application migrations, owner profiles, real integrations or original ADR files.

## 3. D-1 — Correct late-event evidence classification

### Problem

The current classifier depends on a single clock measurement valid for at most 60 seconds.

Claude demonstrated that an authenticated old-epoch send occurring 150 seconds or 10 minutes after shutdown can incorrectly be classified as NOT_PROVEN rather than VIOLATION.

That is unacceptable for the frozen-instance dead-man scenario.

### Required implementation

Replace the single-window assumption with an explicit, defensible time-correlation model.

Use either:

- Multiple independently authenticated clock measurements bracketing relevant observations; or
- Bounded extrapolation of clock uncertainty using measured offset, drift, precision, elapsed time and an explicit resynchronization allowance.

For example, use the conceptual bound:

`u(t) = u0 + drift × |t - measuredAt| + resyncAllowance`

Implement the actual model with validated units, authenticated measurement provenance and conservative interval arithmetic.

A conclusive post-fence event must remain classifiable even if it occurs minutes after the original shutdown.

A conclusive violation must take precedence over missing unrelated monitoring evidence.

If clock uncertainty genuinely prevents a conclusion, return NOT_PROVEN with the specific reason.

Never manufacture precision or accept caller-supplied assertions of observation authenticity.

### Required tests

At minimum:

- Old-epoch initiation 10 seconds after the fence.
- Initiation 150 seconds after the fence.
- Initiation 10 minutes after the fence.
- A much later event where uncertainty legitimately becomes too large.
- Multiple clock measurements with consistent offsets.
- Conflicting authenticated clock measurements.
- Missing or expired measurement evidence.
- Large but bounded drift.
- Authenticated and unauthenticated event sources.
- Events whose uncertainty intervals overlap the fence boundary.

The first three cases must produce VIOLATION when authenticated timestamps and uncertainty bounds establish post-fence initiation.

## 4. D-2 — Make retirement evidence compatible with real metric latency

### Problem

Cloud Run instance-count metrics are sampled approximately every 60 seconds and may not become visible for up to approximately 120 seconds.

The current retirement decision requires too much evidence to fit inside one 60-second clock window.

Consequently, a legitimate retirement may never reach EVIDENCE_READY.

### Required implementation

Use the corrected clock model from D-1.

Separate:

1. Actual termination deadline.
2. Platform metric sampling interval.
3. Platform metric publication latency.
4. Required fresh zero-instance observation interval.
5. Independent canary wake and observation intervals.
6. Ledger verification and evidence completion.

Do not treat delayed reporting as permission to exceed the physical termination threshold.

Ensure the zero-instance rule considers every applicable instance-state label, including active and idle instances.

Missing state series, missing sampling intervals or delayed metrics cannot count as zero.

### Required tests

Create realistic synthetic retirement timelines covering:

- 60-second metric sampling.
- Up to 120-second publication latency.
- At least 20 independently scheduled delayed-wake canary observations.
- Valid evidence reaching EVIDENCE_READY.
- A frozen old instance waking after several minutes.
- Incomplete metric series.
- Missing or delayed platform deletion receipts.
- Late provider effects initiated before the fence.
- New unauthorized old-epoch initiation after the fence.
- Contradictory or stale signed evidence.

Both successful and rejected retirement scenarios must be independently reproducible.

Preserve the proposed physical termination target as a provisional value, not a final owner-approved threshold.

## 5. D-3 — Correct independent kill authority

### Problem

Claude found that the kill service identity lacks permissions required by the currently generated shutdown and teardown commands.

The independent kill process must not silently depend on a privileged deployment identity.

### Required implementation

Create an explicit command-to-principal-to-permission matrix.

For every generated command, identify:

- Executing identity.
- Exact Google Cloud permissions.
- Scope of the required IAM binding.
- Preconditions.
- Expected result.
- Evidence required for success.
- Fail-closed behavior if permission is absent.

Address Cloud Run traffic updates, revision deletion, service deletion, worker-pool deletion and firewall changes.

Determine whether `iam.serviceAccounts.actAs` is required for each operation rather than granting it broadly.

Separate normal deployment duties, independent emergency kill authority and cleanup duties.

Prefer least-privilege permissions and narrowly scoped roles.

The independently authorized kill path must be capable of performing its mandatory emergency operations without silently assuming access to the deployer.

### Required tests

Static permission coverage tests must verify that every generated command is assigned to an appropriately scoped identity.

Test missing permissions and ensure the controller reports a blocking error instead of continuing.

Do not use owner credentials or live IAM queries.

## 6. O-1 — Simplify sealer placement for B1a

**Owner decision: APPROVED.**

Move the B1a synthetic sealer back to the runtime project, consistent with ADR-005 Phase 3a.

The sealer must retain:

- Its own service identity.
- Its own restricted database permissions.
- The seal-before-ACK safety contract.
- Independent archive/custody writes through appropriately scoped IAM.
- Fail-closed behavior on unavailable or incomplete custody.

The separate custody project must continue holding the independently administered evidence/archive assets, encryption keys and relevant observation authority.

### Remove unnecessary B1a resources

Eliminate infrastructure that exists solely because the sealer was placed in the custody project, including where applicable:

- Cross-project internal HTTPS Application Load Balancer.
- Sealer-only PSC publication/consumer resources.
- Unnecessary second Cloud SQL PSC endpoint.
- Custody-project application-serving network resources.
- Unnecessary DNS zones, firewall rules, service identities and certificates.

Do not remove resources required for genuinely independent evidence custody.

Update the full resource inventory, teardown plan, Terraform definitions, network diagrams, IAM matrices and cost model.

Do not automatically carry the simplified sealer placement into B1b.

Production-grade custody and sealer isolation remain subject to separate architecture review.

## 7. P-1 — Complete live container startup wiring

Implement the source-level container entrypoints and bootstrap logic for the proposed B1a synthetic services.

Include:

- Runtime startup.
- Gateway startup.
- Synthetic ingress.
- Sealer.
- Worker or worker-pool process.
- Independent observer components, as needed.
- Fake-provider integration.

Implement the approved synthetic-profile preparation flow, including secure secret references and the explicit transition from inert startup to authorized synthetic dispatch.

Use pinned build artifacts or image-digest references in the planned deployment configuration.

A service must remain inert unless its identity, epoch, session scope, expiry and SQL dispatch authorization are all valid.

No default permissive startup.

Do not package real Meta or Google Calendar credentials.

### Tests

Test startup with:

- Missing configuration.
- Missing or invalid synthetic identity.
- Wrong epoch.
- Expired session.
- Missing secret mount.
- Invalid database state.
- Stale deployment revision.
- Revoked authorization.
- Successful synthetic initialization.

Every invalid state must remain inert.

## 8. P-2 — Complete observation, clock and canary adapters

Implement the source adapters required to obtain actual platform evidence in a future authorized cloud test.

Include adapters and typed evidence contracts for:

- Cloud Run revision state.
- Revision deletion receipts.
- Cloud Monitoring instance counts.
- Cloud Logging observations.
- Network/NAT evidence.
- Independent fake-provider ledger.
- Clock synchronization/calibration.
- Canary scheduling and results.
- Independent observer key custody.

Provide offline local fixtures or fakes for every cloud-dependent operation.

Do not contact Google Cloud during this increment.

### Evidence requirements

- Sum relevant active/idle instance-state counts.
- Missing series must not be interpreted as zero.
- Distinguish platform observation time from metric publication time.
- Use authenticated evidence envelopes.
- Derive activity from independent evidence sources rather than relying on an old gateway's own trace.
- Include conservative network transit and clock uncertainty.
- Detect forged, replayed, copied and stale evidence.
- Preserve provenance and raw evidence.
- Never infer instance death merely from missing heartbeats.

Implement the realistic-latency retirement scenario described in D-2.

## 9. P-3 — Complete controlled operational scripts

Implement the source-level controller, observer and teardown orchestration needed for a later authorized experiment.

Generate commands bound to exact planned resources and identities.

Support:

- Preflight checks.
- Session initialization.
- Inert deployment.
- Epoch advance.
- Traffic movement.
- Old-epoch network fencing.
- Independent revision termination.
- Metric/canary/ledger verification.
- Explicit promotion or abort.
- Emergency stop.
- Full teardown.
- Residual resource verification.

Maintain the approved seven-step deployment/fencing order.

### Safety requirements

Keep all operations in dry-run or local simulation mode.

No live execution.

Any future execution capability must require a separately reviewed activation change and explicit owner authorization.

Ensure no command can execute merely because a test or CI job supplies an unexpected flag.

Test command-to-permission mapping, command ordering, resource identity, failed preconditions, interruption recovery and non-execution guarantees.

## 10. P-4 — Prepare the deployable synthetic fake provider

Complete the source and infrastructure configuration for the independent fake HTTPS provider.

Include:

- Pinned operating-system/container image or immutable artifact reference.
- Synthetic provider server included in the build.
- Correct TLS/mTLS identity and key handling.
- Controlled inbound path from the authorized gateway.
- External-effect ledger creation.
- Protected evidence export or operator retrieval.
- Required restricted Google API or tightly scoped operator access path.
- Explicit ingress/egress firewall rules.
- Host identity and lifetime.
- Complete teardown coverage.

No private key material may be embedded in Terraform state or checked into Git.

Use locally generated disposable credentials for testing.

Actual cloud credential issuance and key custody require later authorization.

### Tests

Verify that:

- Authorized synthetic gateway connections are accepted.
- Unauthorized sources are rejected.
- A revoked old epoch cannot establish a permitted connection under the modeled policy.
- Evidence can be exported through the approved simulated route.
- No unintended public exposure is required.
- The fake provider is removed from the planned resource inventory during teardown.

Clearly label all network-policy results as local validation rather than actual Google Cloud enforcement.

## 11. P-5 — Correct billing currency and budget controls

The owner's Google Cloud trial billing account is understood to be denominated in MXN, but its actual configuration must not be queried during this increment.

Do not assume a USD budget can be submitted directly to an MXN billing account.

Implement a currency-aware planning and configuration workflow.

### Requirements

- Represent proposed spending in USD and the billing-account currency separately.
- Require an explicitly supplied account currency.
- Require an owner-approved FX rate or conversion basis.
- Preserve the proposed approximately US$20 gross session allocation as planning guidance, not authorization.
- Generate the appropriate local-currency budget configuration only after owner-supplied values are available.
- Fail validation on missing currency, unsupported amount, stale conversion or inconsistent units.
- Distinguish billing alerts, actual spending limits and elapsed-time shutdown controls.
- Never describe budget alerts as guaranteed spending caps.
- Include taxes, FX uncertainty, delayed billing and retained resource costs in sensitivity analysis.

### Additional spend control preparation

Prepare a documented procedure for verifying spend-cap eligibility before provisioning.

Implement local simulations of:

- Session expiration.
- Budget threshold events.
- Budget reset.
- Billing delay.
- Capacity pause.
- Worker restart after suspension.
- Recovery following account or resource suspension.

External dispatch must remain held when safety authority is unavailable or the approved session has expired.

Do not use live billing APIs.

## 12. P-6 — Reconcile infrastructure following sealer simplification

Because O-1 is approved, simplify the B1a candidate inventory.

Update all dependent files:

- Terraform.
- Inventory manifests.
- Networking and IAM rules.
- Operator commands.
- Evidence collection.
- Startup configuration.
- Teardown scripts.
- Architecture notes.
- Cost calculations.
- Source acceptance tests.

Recheck that the architecture still provides independent custody administration and the required evidence controls.

Document the exact resource count reduction and any remaining cross-project communications.

Do not claim the simplification eliminates the need for future production-grade custody work.

## 13. P-7 — Prepare exact-resource and session inputs

The owner has not yet authorized specific GCP project IDs, account identifiers, resource names or a session window.

Do not invent real account values or use existing credentials to discover them.

Implement validated, offline configuration templates requiring these values before a future provisioning decision.

Include:

- Runtime project ID and project number.
- Custody project ID and number.
- Organization-mode decision.
- Region.
- Allowed APIs and quotas.
- Service identities.
- Revision/epoch identifiers.
- Network ranges and resource names.
- Authorized session start/end.
- Session expiration.
- Kill and cleanup principals.
- Billing currency and budget amount.
- Resource lifetime/teardown inventory.

Use clearly marked synthetic fixture identifiers for local testing.

All real-account values remain unapproved until the owner supplies and authorizes them.

Cloud provisioning must remain impossible with placeholder values.

## 14. Approved backup retention — B1a ONLY

**Owner decision O-6: APPROVED.**

For the disposable synthetic B1a experiment, prepare:

- One-day PITR/backup retention where supported.
- No final or retained backups after authorized teardown.
- Clear retention and deletion checks.
- No real business or customer records.
- Evidence preservation limited to approved synthetic artifacts.

Production and pilot recovery requirements remain unchanged.

B1b must restore the previously approved seven-day recovery configuration and independently validate restore behavior.

Do not treat B1a synthetic retention as a production architecture decision.

## 15. Decisions not yet made

The following are not authorized or finalized:

- **O-2:** GCP organization versus standalone project.
- **O-3:** Named supervisor, kill, cleanup, billing and backup operators.
- **O-4:** Final physical termination threshold and canary timing schedule.
- **O-5:** Exact local-currency allocation, authorized resource inventory and session window.
- **O-7:** Optional full restore drill during B1a.

Maintain configurable, fail-closed placeholders and present recommendations for later owner approval.

Do not silently make or implement permanent owner decisions.

A provisional ≤60-second physical termination target may be retained in test planning, but it is not final approval. Metric reporting delays must be handled separately.

## 16. Required local testing

Run both existing tests and new B1a-2 tests.

Prioritize the same proven Linux environment:

- Node.js 24.
- PostgreSQL 17.
- Actual Linux signal injection.
- Local Docker fixtures where required.
- Native Terraform formatting and validation where available.

At minimum, test:

1. D-1 late-event classification at 150 seconds, 10 minutes and longer bounded intervals.
2. D-2 realistic 60-second metric sampling plus 120-second reporting delay and 20-canary schedules.
3. D-3 command-to-IAM-permission coverage.
4. Full 54-cell interruption matrix and asynchronous kill scenarios.
5. Both COMMIT-loss branches and unexpected ROLLBACK completion.
6. One-use permission and no uncertain resend.
7. Startup and bootstrap fail-closed conditions.
8. Signed evidence, clock calibration and observer adapters.
9. Fake-provider installation and evidence retrieval in local simulation.
10. Local network/identity policy model.
11. Budget-currency and session-expiry behavior.
12. Terraform configuration and source-only non-application guard.
13. Complete synthetic teardown and residual-resource inventory.
14. Preservation of accepted application and existing historical evidence.

Retain original evidence and produce a separately identifiable B1a-2 evidence package.

If a test cannot run, state NOT EXECUTED.

Never present local fixtures as proof that Google Cloud networking, termination or billing actually works.

## 17. Security and source-integrity checks

Preserve:

- The accepted executable source/tree identity.
- Original INC1 and B1a tested-source hashes.
- Historical reviews and raw evidence.
- Protected owner profiles and legacy backend.
- All application-level booking safeguards.
- The original unresolved Meta business-token fencing requirement.
- Mandatory customer-name confirmation before any real WhatsApp testing.

No changes to production applications or real credentials.

Secrets used in local tests must be generated synthetically and disposed of safely.

CI must remain unable to provision cloud resources.

Run secret scans, source-integrity checks and a complete changed-file review.

## 18. Independent review handoff

Create a complete Claude review package containing:

1. New Draft PR and exact tested source commit/tree.
2. Base commit and source-diff report.
3. D-1/D-2/D-3 closure evidence.
4. P-1 through P-7 completion matrix.
5. Updated B1a resource inventory.
6. Sealer simplification and architecture delta.
7. Cloud-specific adapter readiness matrix.
8. Local test commands and outputs.
9. Reproducible evidence and checksum manifest.
10. Terraform and IAM static-validation results.
11. Realistic-latency end-to-end retirement simulation.
12. Currency-aware cost calculations and remaining assumptions.
13. Fail-closed checks for missing owner/account inputs.
14. Remaining owner decisions.
15. Actual Google Cloud safety requirements still NOT PROVEN.
16. Remaining B1b/B2/commercial gates.
17. Any deviations from ADR-005 requiring separate review.

Request one independent Claude verdict:

- GO FOR B1a-2 SOURCE ACCEPTANCE
- GO WITH CONDITIONS
- NO-GO

Do not treat a favorable source verdict as permission to provision Google Cloud.

## 19. Stop conditions

Stop when:

- B1a-2 source implementation is complete.
- Local synthetic tests are executed.
- Evidence is published.
- A new Draft PR is created.
- Claude's independent review handoff is prepared.

Do not merge PRs.

Do not execute cloud provisioning, deployment, billing or real-provider operations.

Do not begin B1b or B2.

Do not automatically remove the infrastructure apply guard.

## 20. Final owner report

Report:

1. Draft PR link.
2. Exact implementation and evidence-publication commits.
3. D-1 through D-3 closure summary.
4. P-1 through P-7 implementation status.
5. Test counts and failures.
6. Updated resource count and six-hour cost estimate.
7. Remaining code gaps and deployment blockers.
8. Exact owner decisions still required.
9. Confirmation of unchanged accepted application and owner data.
10. Confirmation of zero GCP provisioning, spending, credential access, Meta calls, Calendar calls and merges.
11. Claude review handoff link.

If any mandatory requirement cannot be met, document the blocker instead of weakening the safety contract.

**Begin the owner-authorized B1a-2 source-only implementation now.**