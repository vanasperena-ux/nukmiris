# NukMiris — B1a Cloud-Specific Preparation

## Owner authorization: Code and local synthetic tests ONLY

The owner has formally decided:

1. **Google Cloud is the preferred infrastructure provider** for NukMiris.
2. **INC1 is accepted for local synthetic scope**, following Claude's independent review and Codex's A-1 documentation correction.
3. **B1a cloud-specific preparation is now authorized**, limited to source code, infrastructure configuration, local synthetic tests, documentation and a new Draft GitHub PR.

No cloud provisioning, spending, real-provider operations, billing changes or merges are authorized.

This is a bounded engineering implementation increment, not permission to deploy infrastructure.

## 1. Mandatory source references

Repository: `vanasperena-ux/nukmiris`

### Accepted application

- Draft PR #16.
- Accepted executable: `b4d0be0cb98c7f2b69be318e18b93f4de102c511`.
- Preserve accepted source, tests, dependencies, migrations, runtime and owner profiles.

### Approved planning architecture

- ADR-005 Revision 3, including all nine safety redlines and DR-01 through DR-12.
- Draft PR #18: architecture reconciliation, implementation gaps, phased plan and cost model.
- Draft PR #19: Google Cloud versus Railway versus Render comparison.

### INC1 implementation

Draft PR #20:

https://github.com/vanasperena-ux/nukmiris/pull/20

Exact tested implementation:

`3204e73c823d7e552c0aacad74294617490465f6`

A-1 documentation correction:

`2ca5cf215b68f187bfa48b42aaa041bbe93cf56d`

### Independent Claude review

Read the entire INC1 review, especially findings F-1 through F-8 and conditions B-1 through B-8:

https://github.com/vanasperena-ux/nukmiris/pull/20#issuecomment-6838315312

Supporting evidence:

https://github.com/vanasperena-ux/nukmiris/pull/20#issuecomment-6838315843

Also read the INC1 architecture, acceptance matrix, evidence records, operational tooling and plan-only Terraform configuration.

**The Claude findings are mandatory implementation inputs, not suggestions.**

## 2. Objective

Prepare a complete, locally validated B1a synthetic cloud safety experiment that can subsequently be independently reviewed for a separate Google Cloud provisioning decision.

Focus on:

- Externally enforceable deployment-epoch fencing.
- Reliable old-instance termination evidence.
- Safe handling of frozen, resumed and killed processes.
- Accurate classification of late and unauthorized external operations.
- Google Cloud IAM, VPC, networking, Cloud Run and Cloud SQL compatibility for the synthetic experiment.
- Independent evidence gathering and verification.
- Reproducible operational runbooks.
- Predictable resource cleanup and cost controls.

Preserve the original external-effect safety invariants.

Do not implement the full commercial application or connect real providers.

## 3. Source isolation and branch management

Create a dedicated implementation branch and a new Draft PR, stacked on the exact corrected PR #20 head.

Keep new or changed source within `platform-proof/`, including its planned infrastructure, local tests and supporting documentation.

Do not modify:

- `vnext/src/`.
- Accepted application tests or dependencies.
- Application migrations and database roles.
- Existing booking-worker functionality.
- Owner profiles, calendars or application data.
- The v0.8.1 backend.
- Historical architecture/review evidence.

Preserve existing INC1 records and original raw evidence without rewriting them.

New test evidence must have its own identifiers, manifests and source pins.

## 4. B-1 — Correct and strengthen interruption testing

Claude found that INC1's original randomized campaign exercised only 18 of 27 cut-point × control-mode combinations.

Implement a corrected campaign that:

1. Exercises the entire supported cross-product explicitly, including the previously absent `afterCommit × REVOKE` stale-sender case.
2. Uses independently sampled combinations or a complete cross-product with an auditable coverage matrix.
3. Preserves both control mode and provider mode in the raw evidence as distinct fields.
4. Includes uninstrumented asynchronous process suspensions at unpredictable execution points.
5. Includes direct SIGKILL trials without first resuming the process.
6. Tests replay, expiry, COMMIT ambiguity and attempts to initiate effects after authority withdrawal.
7. Preserves durable UNKNOWN behavior and never automatically resends uncertain effects.

Include the adversarial cases from Claude's P2 and P3 review probes.

Retain the existing INC1 tests and run the complete combined suite.

Do not describe instrumented suspension points as arbitrary instruction-level interruptions.

## 5. B-2 — Correct the evidence classifier

Claude demonstrated a case where a definitively unauthorized post-fence connection was classified as NOT_PROVEN merely because some cloud evidence was missing.

This must be corrected.

### Required behavior

- Evaluate independently verified post-fence initiation evidence before testing whether all termination metrics are complete.
- Classify a conclusive unauthorized old-epoch effect attempt as VIOLATION, or an explicitly defined equivalent failure verdict.
- Never hide a definite violation inside NOT_PROVEN.
- Missing, stale, contradictory or incomplete evidence must not produce PASS.
- Preserve distinctions between pre-fence requests, delayed provider application and genuinely new post-fence initiation.
- Require explicit, measured time uncertainty and a defined clock source for CLOUD classifications.
- Do not use the local 2 ms clock tolerance as a default cloud assumption.
- Ensure `sourceVerified` can only be asserted from an authenticated, independently verified evidence source.

Add tests covering:

- Incomplete platform metrics plus a conclusive violation.
- Missing and stale samples.
- Clock uncertainty across hosts.
- Contradictory event ordering.
- Old-epoch traffic arriving after deployment retirement.
- Real local canary and kill traces.

Avoid claims of physical containment when the evidence does not support them.

## 6. B-3 — Correct process termination behavior

Fix the process-kill helper so SIGKILL does not require first issuing SIGCONT.

Verify that a stopped process cannot resume execution between the termination decision and the kill operation due to our test code.

Add regression tests.

Distinguish:

- Locally observed process termination.
- Cloud Run platform termination evidence.
- Missing platform evidence.
- Independent dead-man-canary evidence.

A dead process observed locally is not sufficient proof of Cloud Run termination semantics.

## 7. B-4 and B-5 — Strengthen gateway and database proof checks

### B-4: Database outcomes

Add the missing lost-COMMIT scenario where the COMMIT never reaches PostgreSQL.

Preserve the distinction between:

- The response returned to the caller.
- Durable database state.
- Whether an external effect is actually authorized.

Document that durable state is authoritative.

Verify the PostgreSQL command completion tag, rather than treating an unexpected completion such as ROLLBACK as successful COMMIT.

Keep the one-use permission inside the gateway process.

Do not add reusable bearer tickets or unsafe retry paths.

### B-5: Proof and transport

Require positive fake-provider proof to match:

- Scope.
- Attempt.
- Operation.
- Payload digest.
- Deployment epoch.
- Revision.

Prepare database TLS connections with proper CA verification for the planned Cloud SQL environment.

The local fixture may continue to use separately identified test-specific transport settings.

Do not weaken existing row-level security or expand runtime privileges.

## 8. B-6 — Resolve the deployment-epoch model

Claude identified a mismatch:

- Terraform models epochs as separate Cloud Run services.
- The shutdown sequence assumes revisions within a single service.

Select one consistent model, justified against ADR-005 Revision 3 and the approved seven-step shutdown sequence.

Do not silently modify any mandatory architecture decision.

Document:

1. The selected epoch model.
2. Why it supports the required safety properties.
3. How routing changes between epochs.
4. How old-epoch network permissions are withdrawn.
5. How old instances are blocked and deleted.
6. How platform termination is independently verified.
7. How a rollback creates a new epoch rather than reactivating an old one.
8. How incomplete termination evidence keeps external dispatch disabled.

### Operational controller

Replace the prose-only fence controller with a dry-run tool that prints concrete, correctly ordered commands bound to exact planned resource identifiers.

Map every command to the seven approved fence steps.

Include explicit preconditions, evidence checks, failure handling and abort behavior.

**Dry-run only. No command execution against Google Cloud.**

Any necessary ADR amendment must be proposed separately for review; do not silently alter the historical ADR.

## 9. B-7 — Complete plan-only Google Cloud configuration

Prepare the missing cloud-specific infrastructure components identified by Claude.

### Networking

- Gateway-to-fake-provider egress allow rule.
- Higher-priority old-epoch/tag egress denial.
- Default-deny outbound connectivity.
- All-traffic Direct VPC egress.
- Restricted Google API VIP access.
- Required DNS configuration.
- Worker-to-gateway internal invocation.
- Independent cross-project sealer communication.
- Correct NAT placement and translation logging.

Ensure the network design does not accidentally permit non-gateway workloads to reach external-effect destinations.

### Identity and security

- Narrowly scoped service identities.
- Independent shutdown/kill authority.
- Gateway-only authorization to access external-effect credentials.
- Separation of runtime, deployment and custody privileges.
- Required IAM bindings and organizational policy dependencies.
- Explicit behavior if the required Google Cloud organization policy is unavailable.

Keep the organization-versus-standalone-project choice open for the owner.

Do not assume compensating controls are equivalent to an enforced organization policy.

### Platform configuration

- Cloud Run service/revision/epoch identities.
- Cloud SQL PostgreSQL 17, explicitly `ENTERPRISE`.
- Explicit approved candidate database tier.
- Measured or conservatively bounded database connections.
- Required instance limits.
- Region and network tags.
- Environment-specific resource names.
- Independent evidence and custody components.
- Startup/readiness and shutdown constraints.
- No unauthorized resource persistence after teardown.

Do not change accepted business-data SQL schemas as part of this synthetic platform preparation.

### Cost controls

- Gross budget alerts aligned to the proposed first-session allocation.
- Clearly identified spend-cap configuration and eligibility limitations.
- Session elapsed-time termination mechanism.
- Maximum permitted planned session duration.
- Safeguards against unintentionally recreating resources.
- Explicit resource inventory and teardown validation.

**Budget alerts are not hard spending caps.**

Cloud Run spend caps are not comprehensive project-wide cost caps and must not be represented as such.

Keep any infrastructure apply guard in place. The output must remain non-provisionable without a future separately reviewed and owner-authorized change.

## 10. B-8 — Improve fixture diagnostics

Capture relevant container logs and state before removing a failed fixture.

Include:

- Container exit code and reason.
- Readiness diagnostics.
- Relevant PostgreSQL logs.
- OOM indication where available.
- Bounded startup timeout.
- Exact fixture/resource identifiers.

Maintain cleanup limited to resources explicitly owned by the test harness.

Never use broad Docker cleanup commands that could alter the owner's unrelated containers or volumes.

Document the earlier unresolved fixture failure without claiming its original cause has been conclusively established.

## 11. Complete the remaining B1a preparation gaps

In addition to B-1 through B-8, reconcile the implementation against all remaining B1a requirements in PR #18, the INC1 handoff and ADR-005.

Pay particular attention to:

- Real platform termination and zero-instance evidence contracts.
- Dead-man-canary architecture.
- Independent fake-provider evidence oracle.
- Epoch-specific identity and egress controls.
- Evidence authenticity and clock uncertainty.
- Sealer availability and safe acknowledgment behavior.
- Lost or delayed side effects.
- Safety under network, deployment and CPU-related failure.
- Required tests demonstrating that billing-control pauses or resumes leave dispatch inert.
- Resource inventory, cleanup and residual billing.
- The difference between source validation and actual cloud proof.

For every requirement, record:

- Implemented locally.
- Validated locally.
- Requires actual cloud testing.
- Requires owner decision.
- Deferred to B1b, B2 or commercial onboarding.

Do not mark a cloud-specific requirement as passed solely because the corresponding Terraform configuration validates.

## 12. Local acceptance testing

Run the existing INC1 test suites and all new B1a preparation tests.

Where applicable, use Linux with supported Node.js 24 and PostgreSQL 17.

Include:

- Complete cross-product and randomized adversarial campaigns.
- Asynchronous SIGSTOP/SIGCONT.
- Direct SIGKILL.
- Replay, concurrency and uncertain-COMMIT cases.
- Evidence-classifier regression tests.
- Fake-provider ledger and authenticity checks.
- Infrastructure static validation.
- Terraform formatting and validation.
- Dry-run controller verification.
- Resource inventory and teardown checks.
- Source-integrity and secrets checks.

Use synthetic identities, synthetic data, local-only services and runtime-generated test secrets.

Do not contact Google Cloud APIs, Meta APIs, Google Calendar or any external business provider.

If a required tool or test cannot run safely, report it as NOT EXECUTED rather than claiming a pass.

Do not manufacture cloud-platform evidence.

## 13. Independent Claude review package

Prepare a self-contained independent-review handoff.

Include:

1. New Draft PR link.
2. Exact source and tested tree hashes.
3. Base commit and source-integrity evidence.
4. B-1 through B-8 closure matrix.
5. Remaining B1a gate matrix.
6. Test commands, counts and complete outputs.
7. Reproducible source and raw evidence.
8. Terraform validation results and known deployability gaps.
9. Exact proposed cloud resource inventory, without deploying it.
10. Revised cost estimates and assumptions.
11. Proposed shutdown/termination evidence contract.
12. Open owner decisions.
13. Explicit list of cloud-only tests still NOT PROVEN.
14. Any deviations from ADR-005 requiring separate approval.

Ask Claude to return one verdict:

- GO FOR B1a SOURCE ACCEPTANCE
- GO WITH CONDITIONS
- NO-GO

This review must not be described as cloud deployment approval.

## 14. Hard prohibitions

No authorization is granted for:

- Creating, modifying or deleting actual Google Cloud resources.
- Executing Terraform plan/apply/destroy against the owner's cloud account.
- Using live Google Cloud credentials or billing information.
- Upgrading or linking billing accounts.
- Purchasing services or subscriptions.
- Sending or receiving real WhatsApp messages.
- Connecting Meta or Google Calendar.
- Deploying the application.
- Changing application booking behavior.
- Modifying owner profiles or existing local appointments.
- Merging any PR.
- Running production onboarding.
- Automatically proceeding to the next milestone.

Do not access real business or customer data.

Keep PRs #16, #18, #19 and #20 Draft and unmerged.

## 15. Stop condition and final report

Stop after:

1. Implementing the authorized B1a source-only preparation.
2. Running local synthetic tests.
3. Publishing a new Draft PR.
4. Publishing reproducible evidence.
5. Preparing the independent Claude review handoff.

Report:

- Draft PR URL.
- Exact tested source commit.
- Implemented B-1 through B-8 changes.
- Test results.
- Remaining safety or deployment gaps.
- Estimated first-session cloud resource cost.
- Confirmation that zero cloud resources were provisioned and no real-provider calls occurred.
- Confirmation that the accepted application and owner profiles were not changed.
- Recommended next step requiring separate authorization.

**Do not begin cloud provisioning or remove the infrastructure apply guard.**

The next stage, if independently approved, will be a separately authorized supervised synthetic Google Cloud B1a experiment, with an explicit resource inventory, responsible operators, spending allocation and shutdown deadline.

**Begin the authorized B1a preparation implementation now.**