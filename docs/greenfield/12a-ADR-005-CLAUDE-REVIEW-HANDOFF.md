# Independent review handoff — ADR-005 NukMiris GCP architecture

**Date:** 2026-11-01  
**Target reviewer:** Claude (independent architecture/security challenger)  
**Review subject:** `ADR-005-GCP-Cloud-Architecture.md`  
**Status:** REVIEW REQUEST DRAFT. Review has **not** been run or approved.

## Reviewer mission

Read the ADR, GitHub Issue #5 and Codex assessment, authoritative WP0/WP1 records, existing WP1 Claude CP1/initial CP2 findings and cited provider documentation. Act as a skeptical independent reviewer, not a design rubber stamp. Validate the plan while respecting the owner's explicit decisions: **GCP preferred, `us-central1` candidate, US$250/month pilot infrastructure planning limit (not spending authorization), synthetic-only next gated proof, no provisioning, no changes to v0.8.1 or WP1, no real Meta/Google credentials or calls**.

**Do not:** deploy, create cloud resources, access live provider credentials, send messages, change code, merge PRs, authorize WP2, silently alter G06 or accepted product journeys, or mark any untested safety claim as passed. No independent test means NOT VERIFIED.

## Required evidence inputs

1. ADR-005 attached/supplied in the same handoff; GitHub https://github.com/vanasperena-ux/nukmiris/issues/5 and Codex comment `6568448125`.
2. Pinned WP0 `07-IMPLEMENTATION-PACKAGES-AND-COSTS.md` and 37 journey requirement traceability.
3. Pinned WP1 `08-WP1-BOUNDED-IMPLEMENTATION-CHARTER.md`, `10-WP1-IMPLEMENTATION-STATUS.md`, F13 counterexample and Claude review `01-CLAUDE-WP1-CP1-CP2-REVIEW.md`.
4. Actual official Cloud Run pricing/worker pools/billing mode, Direct VPC networking, Cloud SQL PITR/pricing, GCP budgets, KMS/GCS, Meta/Calendar OAuth documents as relevant.
5. Mexican LFPDPPP as issued 20 March 2025, carefully distinguish controller transfer and processor remisión and identify facts counsel must review. Do not assert legal compliance.

## Review questions (answer each with PASS / CONDITION / FAIL / NOT VERIFIED)

**R01 Product/charter scope:** Does deployment topology respect 37 journeys, WP1-only synthetic limits, M2 owner services, M5 dashboard, and no premature WP2? Identify incompatible or speculative assumptions.

**R02 F13/OPS01:** Enumerate every route for a previously authorized worker/gateway to submit *after* revocation, including final-check pause/thaw, cached secrets, established sockets, HTTP retries, old revisions, SQL restoration, DNS/IPv6, alternative egress, autoscaling and control-plane failure. Identify whether Direct VPC policy is enforceable for each and design independent fake-ledger measurements. Do not equate denial of future admission with physical send cutoff.

**R03 Admission sealing:** Does raw-byte signature → PREPARE → STAGED → independently authenticated COMMIT_SEAL → ELIGIBLE/ACK actually preserve membership/content, trusted witness freshness and original identity across crash and archive loss? Is a self-declared digest mistaken for evidence?

**R04 Database isolation:** Verify transaction/role model and tenant FK constraints. Are shared app identities able to access two tenants? Does a separate SQL admin role and private connection make all claims realistic? Assess Cloud SQL connection limits and regional availability.

**R05 Dispatch and reminders:** Can a continuously running worker pool poll without scheduling drift? What occurs on idle, rollouts, overlapping revisions, shutdown, misconfigured minimum instances, provider timeouts and queue backlog? No delayed/uncertain resend. Confirm exact reminder-window semantics.

**R06 Recovery:** PITR scope and actual log/backup billing, trust boundaries for independent archive/key/witness, test of a missing tail, key version and SQL rollback, inert permissions-first recovery, zero duplicate fake sends. Distinguish safe-read RTO from unproven safe-write resumption.

**R07 Provider identity:** Meta token/WABA/Tech Provider and payer ownership, templates, callback/account correlation, Google OAuth business calendar access and revocation. Separate tests/facts from assumptions. Ensure live accounts absent in synthetic proof.

**R08 Privacy/regions:** US-central service availability, backup/key regions and cross-border processing/contract posture in Mexico. List legal and data-retention questions; note LATAM country differences. Test timezone and DST semantics separate from server location.

**R09 Cost:** Reproduce line-item 730-hour GCP pilot subtotal ~$174.65 and 25% contingency ~$218.31; challenge pricing currency/SKU, NAT topology, minimum pools/worker fallback, external sealer/key version assumptions, Cloud SQL backup/PITR and logs. Assess ability to stay within $250; validate a true ≤$75/72h synthetic proof with time-bounded inventory and no false hard-cap claim. Identify missing costs including staging/HA/ops/Meta.

**R10 CI/CD, monitoring and operations:** Least privilege, GitHub OIDC/WIF, review/pinned artifacts, migrations/inert promotion, manual rollback, PII suppression, independent operator/custodian, SLOs and incidents. No CI auto production deploy.

**R11 Alternatives:** Is Render properly retained as a conditional alternative? Would a simpler or cheaper GCP configuration preserve *all* safety controls? Are extra services accidentally implied or over-engineered? Distinguish necessary boundaries from speculative implementations.

**R12 Test authorization contract:** Is first proof bounded to fake adapters, synthetic identities and no business data, with explicit permitted services/regions/SKUs, teardown owner, rollback and evidence retention? Call out any violation of no resources provisioned in ADR stage.

## Requested output artifacts

1. `CLAUDE-ADR-005-INDEPENDENT-REVIEW.md` with executive recommendation **GO / GO WITH CONDITIONS / NO-GO for proceeding to a bounded synthetic proof design**, not production GO.
2. Findings register: ID, severity (BLOCKER/HIGH/MEDIUM/LOW), evidence citation (file/line or official URL), failure scenario, exact correction, accountable role, verification test and gate.
3. Review matrix R01–R12 with explicit confidence and `NOT VERIFIED` where evidence is absent.
4. Revised target architecture or specific ADR redlines if needed; no silent redefinition of accepted product flows.
5. Minimum viable *synthetic* proof runbook: fake-provider ledger, pause/thaw and revoked gateway experiment, negative route tests, immutable evidence and PITR/inert restore, region and SKU inventory, quantified pass/fail criteria, cleanup evidence.
6. Open owner choices and any cost/privacy issue blocking the proposed $250 pilot or $75 test.

## Mandatory stop/go criteria

- **Immediate NO-GO for real-provider activation** until F13/OPS01 containment is actually demonstrated and all relevant WP1 correctness findings are resolved or affected capability disabled.
- **NO-GO for proof provisioning** until owner explicitly authorizes exact GCP project, region/resources, maximum duration/cost and teardown authority after independent review of the written proof plan.
- A successful paper review **does not approve** provisioning, spending, live sends, migrations, production release, code merges or subsequent work packages.
- If any safety guarantee cannot be established, recommend a reduced fail-closed demonstration or design revision; do not lower the approved G06 contract to declare success.

## Suggested review response to GitHub

Post the independent review to **Issue #5** with links to committed review artifacts or attach the complete findings. Identify the exact ADR version/hash reviewed; do not simply state “looks good.” Implementation changes, if later authorized, belong to separate bounded PRs. The cloud planning issue stays open until ADR and authorization gates are settled.
