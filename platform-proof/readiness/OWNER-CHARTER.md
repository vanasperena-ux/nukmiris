# NukMiris — B1a Pre-Provisioning Readiness: G-1, G-2 and G-3

## Owner authorization

The owner authorizes a narrowly scoped, **source-only and local synthetic testing increment** to address the outstanding G-1, G-2 and G-3 readiness gates identified by Claude.

The owner has made the following decisions:

- O-1: B1a sealer resides in the runtime project, with independent custody assets retained.
- O-2: Organization-based Google Cloud architecture selected; policy-administration permissions remain to be confirmed.
- O-3: One sole human operator will supervise, authorize shutdown, monitor spending and verify cleanup. The single-person risk remains explicit. Technical kill and cleanup identities must retain separate permissions.
- O-4: Provisional physical termination target of 60 seconds, with reporting latency measured separately.
- O-5: Planning allocation of US$30 equivalent in MXN for an eventual supervised session of no more than six hours. **No spending authorized yet.**
- O-6: One-day backup/PITR retention for disposable B1a synthetic resources only.
- O-7: Database restore drill deferred to B1b.

None of these decisions authorizes actual infrastructure changes.

## 1. Required repository references

Repository: `vanasperena-ux/nukmiris`

Accepted executable application:

`b4d0be0cb98c7f2b69be318e18b93f4de102c511`

B1a-2 accepted tested implementation:

`ade1c3be3b66f81aa05a26e06fa6c8e707d0526c`

B1a-2 evidence publication:

`1e720fce1102dcf7867df567fabaf3b50eebf668`

Independent Claude source-acceptance review:

https://github.com/vanasperena-ux/nukmiris/pull/22#issuecomment-6883846918

Supporting evidence:

https://github.com/vanasperena-ux/nukmiris/pull/22#issuecomment-6883846130

Read:

- ADR-005 Revision 3, RL-1 through RL-9 and DR-01 through DR-12.
- Draft PRs #18–#22 and applicable review decisions.
- The B1a-2 charter, infrastructure inventory, source/tests, evidence, operational runbooks and remaining gate matrix.
- Claude's H-3 finding and transit-bound observation.
- All existing source-only restrictions and deployment safety guards.

Do not reinterpret B1a-2 source acceptance as Google Cloud readiness or deployment permission.

## 2. Branch and isolation rules

Create a dedicated G-1/G-2/G-3 readiness branch, stacked on the accepted evidence-publication head of Draft PR #22.

Create a new Draft PR.

Keep changes within `platform-proof/`.

Do not modify:

- Accepted application source and tests.
- Application migrations.
- Legacy v0.8.1 backend.
- Existing owner profiles, data or calendars.
- Historical architecture and review records.
- Original raw evidence and checksums.

New evidence must be source-pinned and separate from previous records.

Do not merge any PR.

## 3. G-1 — Container image reproducibility

The existing tested image refers to the older B1a-2 source, before the final C-1/C-2 corrections.

Prepare a new locally reproducible container image built from the accepted source and only the approved synthetic application components.

### Required work

1. Rebuild the image from the exact accepted B1a-2 implementation and any narrowly necessary source-only packaging changes.
2. Pin all base-image dependencies by immutable digest.
3. Produce a deterministic build recipe and source manifest.
4. Record local image/config/layer digests and build-environment details.
5. Run local startup and inert-state smoke tests.
6. Test missing identities, invalid epoch, expired session, missing secrets and revoked authorization.
7. Verify synthetic fake-provider mTLS behavior, ledger export and cleanup.
8. Verify the image contains no customer data, production credentials or private keys.
9. Independently reassemble or reproduce the image using the documented build inputs.

### Important restrictions

Do not push images to Google Artifact Registry.

Do not provision registries or cloud resources.

Do not retry or bypass the previously blocked binary archive uploads.

If a new binary publication encounters the same approval problem, stop that publication activity and report the blocker.

The output of G-1 must be a **reproducible, locally verified image candidate**.

The future registry digest must remain a separate approval gate because registry publication can change artifact identity.

## 4. G-2 — Cloud network transit-bound preparation

Claude confirmed that the current retirement proof requires a locally measured transit bound.

A real cloud experiment cannot rely on that local-only measurement.

Implement a source-level mechanism and validation protocol for establishing a conservative, independently verifiable cloud transit bound.

### Required design

The measurement mechanism must:

- Use a defined independent observation source.
- Bind measurements to the exact test session, gateway epoch, revision and fake-provider identity.
- Include authenticated timestamps and clock uncertainty.
- Distinguish connection initiation, TLS establishment, request write and provider arrival.
- Account conservatively for buffering, delayed network delivery, suspended processes and pre-fence connections.
- Avoid treating a finite sample of network latency as proof of a universal upper bound.
- Reject stale, unsigned, inconsistent or misattributed measurements.
- Define what evidence would justify any finite transit bound and what remains a platform assumption requiring cloud validation.
- Keep dispatch/promotion held when the bound is absent, exceeded or not independently trustworthy.

Do not weaken retirement requirements simply to make the experiment pass.

### Required tests

Use local synthetic scenarios for:

1. A valid authenticated transit-bound measurement.
2. Missing and forged evidence.
3. Unexpectedly long network delay.
4. A process frozen while holding a connection.
5. An old-epoch request initiated before the fence but arriving late.
6. A new write after the fence on an existing connection.
7. Provider evidence whose identity does not match the approved session.
8. Uncertain clock ordering.
9. Late canary wake.
10. Transit evidence that is insufficient to certify retirement.

Clearly distinguish locally validated algorithms from actual Google Cloud network guarantees.

If a reliable finite cloud-wide bound cannot be justified before experimentation, propose a fail-closed experiment protocol that can still collect useful evidence without claiming complete containment.

## 5. G-3 — Operational readiness and identity binding

Complete a focused source-level review and correction of the live adapters and operational controls prepared in B1a-2.

### H-3: Retired epoch/revision identity mismatch

Claude found that a provider identity map can silently ignore traffic when the epoch matches but the revision is missing or different.

Fix this before any cloud execution.

An authenticated record containing a retired epoch with a missing, conflicting or unexpected revision must not silently disappear from the retirement evidence set.

Use fail-closed handling:

- Conclusive verified unauthorized traffic → VIOLATION.
- Authenticated but ambiguously attributed activity → HOLD.
- Invalid or unauthenticated evidence → HOLD.

Never classify ambiguous traffic as irrelevant merely because the revision mapping is incomplete.

Add regression tests for correct, missing, conflicting and forged identities.

### Live adapters

Review source-level implementations for:

- Cloud Run revision and deletion receipts.
- Cloud Monitoring instance counts, including active and idle labels.
- Logging and NAT evidence.
- Clock calibration and time correlation.
- Fake-provider ledger retrieval.
- Canary scheduling and observation.
- Independent custody acknowledgment.
- Cloud SQL connection identity and authorization.
- Session expiration and emergency dispatch hold.

Use local fixtures and simulated APIs only.

No Google Cloud account discovery or live calls.

### Operational authority

Verify that the single human operator can use separately scoped deployment, kill and cleanup identities without silently depending on one another.

Review:

- The exact seven-step shutdown sequence.
- Independent emergency network fencing.
- Revision deletion authority.
- Cleanup and residual-resource verification.
- Billing-budget cleanup that requires manual owner action.
- Failure and loss of access to the deployment identity.
- Session expiration when the operator is unavailable.
- Fail-closed behavior after interrupted cleanup.

Ensure the eventual provisioning runbook includes an independently verifiable teardown receipt for every resource.

### Account-receipt preparation

Prepare an offline checklist and validation schema for future read-only account verification, including:

- Organization ID and organization-policy requirements.
- Required roles and bindings.
- Runtime and custody project identifiers.
- Billing-account currency.
- Required APIs, quotas and eligible resource configurations.
- Actual region and SKU availability.
- Synthetic image digest.
- Exact authorized session window.
- Named operator and explicit acceptance of single-person risk.
- Emergency shutdown and complete cleanup responsibilities.

Do not invent account values.

Do not retrieve credentials or call Google Cloud APIs.

No runtime resource may be considered ready while mandatory owner/account fields are missing.

## 6. Cost and operating-envelope update

Update the offline cost model to reflect the accepted owner planning decisions.

Use:

- Planned allocation: US$30 equivalent in MXN.
- Proposed maximum session duration: six hours.
- Physical termination target: 60 seconds, provisional.
- Single supervised operator.
- No database restore drill.
- One-day B1a-only backup/PITR retention.

Separate:

1. Base estimated cost.
2. Contingency.
3. Estimated tax and FX effects.
4. Residual cost risk.
5. Delayed billing.
6. Potential cost of failed or repeated experiments.

Do not use an assumed live MXN exchange rate as an approved billing value.

Prepare owner-input placeholders for actual FX rate and billing currency verification.

Budget alerts must never be described as hard cost caps.

## 7. Acceptance testing

Run targeted G-1/G-2/G-3 tests and the existing relevant regression suites.

Use local Linux, Node 24 and PostgreSQL 17 where available.

Include:

- Original one-use permission and COMMIT safety tests.
- No automatic resend after UNKNOWN.
- Late old-epoch initiation and violation classification.
- Authenticated ledger completeness.
- H-3 identity-mismatch cases.
- Transit-bound uncertainty and frozen-process cases.
- Realistic metric latency and canary schedules.
- Shutdown/kill authority mapping.
- Inert container startup.
- Image reproducibility and synthetic-key scanning.
- Complete teardown inventory.
- Offline cost and currency validation.
- Terraform formatting and static validation.
- Preservation of accepted source and historical evidence.

Every test result must identify the exact tested source.

Use NOT EXECUTED for tests that cannot run.

Never describe local simulated evidence as successful Google Cloud testing.

## 8. Independent Claude review

Publish a self-contained review handoff that includes:

- New Draft PR link and exact source/tree hashes.
- G-1 image build/identity evidence.
- G-2 transit-bound design and limitations.
- G-3 operational/adapter review and H-3 tests.
- Updated cost model.
- Source and historical-evidence integrity checks.
- Complete local test results.
- Remaining account and owner inputs.
- Explicit cloud-only proof requirements.
- Remaining source blockers, if any.

Request one verdict:

- GO FOR G-1/G-2/G-3 SOURCE ACCEPTANCE
- GO WITH CONDITIONS
- NO-GO

The independent review must evaluate whether the resulting source is suitable to support a later resource-specific provisioning proposal.

A positive verdict does not authorize provisioning.

## 9. Hard prohibitions

No Google Cloud provisioning or account access.

No credentials, billing modifications or spending.

No image registry push.

No real Meta or Google Calendar calls.

No PR merges.

No application or owner-data changes.

No retries or workarounds for blocked evidence uploads.

No automatic continuation to cloud execution.

Keep the impossible infrastructure apply guard and live-execution disablement in place.

## 10. Stop and report

Stop after source implementation, local synthetic testing, Draft PR publication and independent Claude handoff preparation.

Report:

1. Draft PR URL.
2. Exact tested implementation commit.
3. G-1/G-2/G-3 completion matrix.
4. Test results.
5. Image reproducibility results.
6. Transit-bound conclusions and limitations.
7. H-3 and operational authority corrections.
8. Updated six-hour cost estimate.
9. Outstanding cloud-only proofs and account inputs.
10. Explicit confirmation that no cloud resources, credentials, provider calls, spending or merges were involved.

**Begin the owner-authorized source-only G-1/G-2/G-3 readiness work now.**