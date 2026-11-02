# ADR-005 — NukMiris vNext Google Cloud reference architecture

**Status:** PROPOSED FOR INDEPENDENT REVIEW — not approved for provisioning or production  
**Date:** 2026-11-01 (America/Mexico_City)  
**Decision owner:** NukMiris product owner  
**Architecture lead:** ChatGPT; repository compatibility reviewer: Codex; independent assurance reviewer: Claude  
**Tracking:** https://github.com/vanasperena-ux/nukmiris/issues/5  
**Basis:** Codex issue comment https://github.com/vanasperena-ux/nukmiris/issues/5#issuecomment-6568448125; approved WP0 and bounded WP1 records.

## 1. Decision and scope

**Proposed decision:** use **Google Cloud Platform** as the preferred infrastructure for *NukMiris vNext*, with `us-central1` as the **initial candidate compute region**, not a final customer-data residency decision. Design for a small **supervised, single-zone, fail-stop** pilot. Target **US$250/month infrastructure planning envelope** for one pilot runtime plus separately administered recovery evidence. Start with an explicitly authorized, time-boxed, **synthetic-only proof**, and do not provision anything as part of this ADR.

GCP is preferred over Render because the documented GCP IAM, service identities, Direct VPC and egress controls provide a more testable starting point for the critical old-runtime containment experiments. **This is an architectural hypothesis, not proof that GCP already meets the safety contract.** Retain Render as an alternate if the GCP proof or cost model fails; reopening vendor choice requires documented evidence.

**Out of scope:** deployment or provisioning; merging any draft PR; real Meta/Google calls or credentials; production cutover; changes to the accepted v0.8.1 local application; WP1 source modifications; the commercial owner service catalog (M2) and owner dashboard (M5); billing and onboarding implementation; any claim of exactly-once remote effects, automatic failover or zero data loss.

## 2. Decision drivers and constraints

1. Multi-tenant WhatsApp scheduling with per-business phone/WABA and Calendar mapping, multiple employees/locations in later increments; future mobile-friendly owner web interface.
2. Signed webhook, independently durable admission and seal-before-ACK; tenant isolation, consent/permission and persistent suspension gates (G06).
3. Durable PostgreSQL transactional core, source/target resource protections, original operation identities, worker/outbox and uncertain-effect states; **no automatic resend of UNKNOWN effects**.
4. Runtime-independent evidence, freshness witness and key custody; PITR plus **inert** recovery with permission/suspension precedence.
5. Physically contain stale deployment egress even after final authorization checks (**F13/OPS01 unresolved**).
6. Cost-conscious first pilot, explicit spend review, no silent scaling to costly HA or always-on services.
7. Separate synthetic dev / controlled staging / future production accounts, credentials, data, approval gates and operations.

The approved WP0 blueprint defines WP1–WP6 and deferred M0–M8 commercial increments. WP1 is synthetic-only and its independent CP1/initial CP2 findings need documented remediation/re-review. Cloud preparation can proceed as **paper design** in parallel; no real deployment is implied by ongoing WP1 work.

## 3. Logical architecture and trust boundaries

```
WhatsApp Cloud API --------------------> [PUBLIC HTTPS ingress: Cloud Run service]
                                           | verify raw-body signature, WABA mapping
Owner web browser --> [future dashboard/API] | no outbound provider token
                                           v
                              [Independent PREPARE/evidence write]
                                           v
                              [Cloud SQL: STAGED transaction]
                                           v
                          [Separate sealer / CAS / freshness witness]
                                           v
                       [Cloud SQL: verified ELIGIBLE; only then ACK]
                                           |
                                           v
                           [Cloud Run worker pool: due work/outbox]
                            | no Meta/Google credential or route
                            v
                   [Authenticated submission gateway (separate identity)]
                      | validates single-use ticket and current authority
                      | only runtime allowed approved provider egress
                 +----+------------------------------------+
                 v                                         v
          [Meta WhatsApp API]                      [Google Calendar API]
                 |                                         |
                 +------------> [sealed result / UNKNOWN state]

 Independent recovery security boundary: GCS evidence/export + witness + KMS
 under separate administrator/permissions; archive/key completeness required.
```

**Important implementation detail:** the diagram is logical, not a commitment that every box will be a separate paid instance. No generic microservice decomposition, Redis or message broker is justified without measured need. A separate sealer and submission gateway **are security boundaries**, not discretionary feature microservices. Exact connectivity and independence must be demonstrated in the design and test plan.

### Proposed service inventory

| Role | Candidate GCP service / placement | Identity and access policy | Key operational rule |
|---|---|---|---|
| Public webhook / API | Cloud Run HTTPS service, managed TLS | Public endpoint, but strictly authenticated Meta webhook and separate owner auth later; no provider secrets | Do not acknowledge unsafe/unsealed admission. Protect request bodies and rate limits. |
| Owner web UI (future M5) | Static frontend hosting or Cloud Run under reviewed auth; API shared with ingress only if isolation justified | Owner / manager / receptionist / employee RBAC; session/MFA and tenant-scoped checks | Infrastructure readiness does not implement owner UI. |
| Core database | Cloud SQL PostgreSQL (initial single zone), private connectivity | Distinct SQL roles/functions; composite tenant FKs and least-privilege application grants | Transactional core with explicit locks/CAS; no shared admin runtime. |
| Background worker | Cloud Run Worker Pool, provisionally one 1 vCPU/1 GiB worker | No external provider credential; no direct internet egress to Meta/Google | Poll durable SQL due work; verify pool availability and manual scaling in chosen region. |
| External-effects gateway | Distinct Cloud Run service/role and narrowly controlled egress | Only place allowed scoped provider secrets/routes; separate independent kill authority | Validate ticket, purpose, tenant, revision, attempt, payload, epoch and expiry; at most one attempt. |
| Independent sealer | Separately credentialed Cloud Run service/job candidate; architecture to validate | Cannot share gateway or deployment-admin privilege; signs/verifies exact committed batch/evidence | Must not trust caller-provided digest; seal/ACK proof mandatory. |
| Archive and witness | GCS Standard objects, conditional writes/versioning + separate freshness witness mechanism | Separate project/admin/deletion role; production operator cannot erase journal and keys | A consistent stale hash chain is **not** proof of completeness. |
| Encryption / secrets | Cloud KMS and Secret Manager | Separate key custody, version retention, scoped rotation and break-glass | Customer provider tokens never embedded in source, image or logs. |
| Observability | Cloud Logging/Monitoring; independent audit export | PII redaction, restricted audit lookup and cross-project export | Alert on actual failures/holds, not only CPU or uptime. |
| CI/CD | GitHub Actions with Workload Identity Federation + Artifact Registry | Pinned action/image digests, environment-level manual approval | No untrusted PR production creds, automatic production release or unattended rollback. |

Cloud Run Worker Pools are not request-driven automatic workers; manually scaled always-on operation and shutdown behavior need explicit validation. If unavailable or unsuitable, test a Cloud Run service with instance-based billing/minimum one instance, or documented scheduled execution that passes overlap/timing requirements; do **not** rely on request-CPU after webhook ACK.

## 4. Security and provider effect safety

### 4.1 F13 / OPS01: hard unresolved gate

A worker submits only a **single-use** authorization envelope binding original attempt ID, tenant, operation and payload digest, provider purpose, current permission/status and mapping revisions, recovery epoch, deployment identity and short expiry. The independently credentialed gateway checks persisted current authority and consumes that original attempt once, denying if control evidence is unavailable.

**This is necessary but not sufficient.** A gateway can pause after its final check; a socket can remain open; cached credentials or alternate egress can bypass a revoked ticket. GCP proposed controls: Direct VPC egress of ordinary roles, deny-by-default provider/internet route policies, gateway-only approved egress, per-release identities, independent kill control, old-instance revocation, connection/sockets inspection and fake-provider ledger. An L3/L4 firewall is not an HTTPS hostname allowlist; validate DNS, IPv6, alternate paths and existing connections. Never assert a zero-late-send bound based only on leases, SIGTERM, routing, token revocation, or traffic-to-zero.

**Required adversarial proof:** pause/thaw worker *and gateway* after last check and before socket submission; suspend/revoke during in-flight traffic; revive old revision/primary and cached connection after takeover; attempt direct provider route from ingress and workers; simulate control-plane outage and provider acceptance/lost response. All fixtures must preserve original identities and UNKNOWN outcomes and record exact fake-provider invocation counts. If proof fails, stop the unsafe capability and keep production activation blocked. A request accepted by a provider before cutoff may still complete afterward; distinguish physical submission timing from delivery timing.

### 4.2 Tenancy, permissions, operators

- PostgreSQL composite tenant constraints, restricted roles, schema-qualified/fixed-search-path security-definer functions where needed; current per-business permission and execution heads are persisted, not in-memory caches.
- Prove cross-tenant ID spoofing and mixed-tenant STOP suppression tests. Runtime role with access to multiple tenants must still be treated as an explicit blast-radius risk.
- Suspension wins over proactive work and cannot be undone by inert restore; reactivation does not catch up old/unknown work. Opt-out is immediate and never silently re-created.
- Production operator individual identities, MFA, scoped/time-bound administrative grants, audit trail, and separate roles for deployment, evidence/key custody, and incident approval.

### 4.3 Credentials, Meta and Google

- Meta portfolio/app/WABA/phone, payer/template and Tech Provider or coexistence rules must be independently verified using owner-specific test assets. Avoid temporary “Try it out” tokens for continuous production.
- Google Calendar must use each business's authorized OAuth/scopes with verified calendar rights and refresh/revocation lifecycle; cloud IAM does not authorize use of private customer calendars.
- The submission gateway may access narrowly scoped Meta/Google credentials; ingress, worker, CI PR jobs and restoration runtime may not. Never replicate production OAuth grants into synthetic staging.

## 5. Admission, processing, UX and availability contracts

1. Ingress authenticates Meta request, checks mapped receiving number/WABA and verifies original raw bytes.
2. PREPARE source evidence is recorded; SQL batch is STAGED transactionally.
3. Independent sealer verifies committed membership and content, records trusted seal/freshness head and marks eligible.
4. Acknowledge only if durable verified admission exists. Error or hold otherwise; do not meet SLO by falsely ACKing.
5. Persistent due work and ordered outbox use only original operation/attempt IDs; no in-memory timer is source of truth.
6. The sole effect gateway checks final current authority; receipt loss becomes UNKNOWN and blocks unsafe automatic re-send. Read-only reconciliation only if provider identity/correlation supports it.
7. Existing Google Calendar events block computed availability as previously approved; ambiguous manual events stay unmanaged and go to Needs Attention, not auto-canceled.
8. Calendar time handling preserves UTC instant, business IANA zone and civil-time intent, including DST folds/gaps.

Pilot measurement assumptions (unapproved SLOs): 25 businesses, 250 appointments/day, 100k monthly webhook requests and 100k gateway requests; test burst 20 authenticated events/second for 60 seconds and 100 due jobs/minute. Targets to validate—not safety substitutes—are 99.5% authenticated ingress availability, sealed ingress p95 <=2s/p99 <=5s, 99% eligible healthy-provider reminder submissions <=60s and always within approved window. Any scale/latency expansion needs capacity evidence.

## 6. Recovery and continuity

- Start with **single-zone fail-stop** Cloud SQL Enterprise. Configure and test **7-day PITR** as a proposed baseline; store encrypted evidence/export outside normal production deletion control, with separate witness and key administration. Define explicit recovery regions and data-retention approval before any real records.
- Restore into a **new isolated database** with every gateway/dispatcher disabled and all provider credentials/egress absent. Restore suppression and permission heads first, then verify archive prefix/head/witness/key completeness and original IDs.
- Preserve unknown/may-have-submitted attempts; do not regenerate identities or replay old outbox. Missing or stale evidence holds affected scopes or all scopes when isolation cannot be established.
- Safe read-only recovery <=4 hours is a *test proposal*. Safe-write resumption has **no promised RTO** until independently reviewed evidence demonstrates old deployment containment, archive completeness and permission consistency.
- HA/automatic failover is out of the initial pilot. A higher-availability topology changes safety and price and requires a new design and proof.

## 7. Region, privacy, retention and legal gate

**Candidate region:** `us-central1`; separate US recovery location only after confirmation of archive-region and key-custody policy. Hosting in the US does not follow automatically from LATAM market focus. Establish the contracting entities, each business's role as controller/responsible party versus NukMiris as processor/encargado where applicable, the privacy notice, consent and international transfer/remisión structure, provider/data-processing terms, subprocessors, incident notification, deletion/export, retention and customer residency obligations. Mexican private-sector law was reissued on **2025-03-20**; use the applicable LFPDPPP and obtain qualified legal advice before production cross-border processing. Additional LATAM countries require separate jurisdiction-by-jurisdiction review, not a blanket conclusion that US hosting is acceptable.

**Retention proposals for cost modeling only:** 7-day PITR; 90 days for independent operational evidence; separate, shorter PII log retention, configurable customer history/export/deletion, legal-hold exception handling and versioned key retention matching verified recovery needs. Retention needs owner/legal approval and should not cause safety evidence necessary to resolve UNKNOWN attempts to disappear while obligations remain open.

## 8. Cost model and guardrails

**Baseline from Codex's Nov 1 itemized estimate** (one US-based pilot runtime + independently administered recovery service, 730h/month, single zone; illustrative not quotes):

| Monthly category | USD pilot |
|---|---:|
| Cloud Run ingress + gateway | 24.09 |
| Continuous worker | 32.79 |
| Cloud SQL compute + SSD + backup allowance | 55.11 |
| Independent sealer | 0.67 |
| Independent archive + key operations | 7.66 |
| Secret Manager | 6.30 |
| Logs and telemetry | 7.50 |
| Build / images | 1.10 |
| NAT/network/egress | 37.42 |
| Regional/archive transfer reserve | 2.00 |
| **Subtotal** | **174.65** |
| **25% contingency** | **43.66** |
| **Planning total** | **218.31** |

Growth sensitivity: 250 businesses / 2,500 appointments/day at **$489.48 before / $611.85 after 25% contingency**. Not a measured capacity guarantee. Actual costs depend on verified SKU and region and may exceed $250 with always-on staging, instance-billed worker fallback (+~$20 pilot), sustained excess traffic, upgraded egress policy, recovery drill, extra stores, HA, logs, or new frontend compute.

**Excluded:** Meta billable messaging, customer/provider API costs, engineering/security/support/on-call, legal/privacy work, tax/FX, domain/WAF, extended staging, HA and multi-region production. Reconcile deployment bills daily during proof. Proposed planning thresholds: alert at 50/80/100% of an authorized amount; restrict resource-creation permissions, maximum instances and logs, and explicitly tear down experiments. GCP budget alerts **are not a hard spending cap**; do not promise guaranteed enforcement. A spend stop must make dispatch inert before changing resources; storage and recovery charges may continue.

**Owner choices recorded:** monthly target $250 for initial pilot infrastructure planning, **not** authorization to spend; US-central candidate; synthetic-only test as next *separately approved* gate. A temporary synthetic proof is proposed at **$75 maximum and 72 hours**, but resources/SKUs must be constrained and previewed so the bound is credible. The $75 proof cap is also *not yet authorized*.

## 9. Environment and CI/CD design

- **Local development:** isolated synthetic fixtures; preserve accepted v0.8.1 on the user's PC.
- **Cloud proof:** separate GCP project/billing labels, disposable synthetic-only DB/archive/KMS, fake Meta/Google endpoints, entirely distinct identities. Default no effect permissions.
- **Staging:** later, separate project/database/secrets and explicit controlled test credentials; fake endpoints by default. Not automatically promoted.
- **Production:** distinct project/roles/key custody, MFA and protected release approval; must satisfy all WP, commercial, privacy and operational gates.
- GitHub Actions: pin dependencies and Actions SHA; `npm ci --ignore-scripts`, typecheck, scope and fault tests, SQL role/tenancy checks, secret scanning, build SBOM/image digest, immutable Artifact Registry image; WIF for trusted deploy, no persistent JSON cloud key and no PR secrets.
- Migration: separate short-lived DB role, one runner, preflight compatibility and restore evidence, non-destructive rollout first. New gateway/worker revisions start **inert**; fence old authority, classify UNKNOWN, smoke-test with fake providers and authorize promotion. Rollback cannot mean restoring older DB and replaying pending sends.

## 10. Observable failure handling and responsible owners

Minimum alerts: signed ingress errors and seal/ACK lag; STAGED/seal delay; missing witness/key; worker due lag; blocked output/UNKNOWN count and age; permission/suspension mismatches; cross-tenant violations; attempted denied egress; provider/auth/template failures; Cloud SQL saturation/PITR/backup age; archive capacity; cost trend. Logs redact phone/name/message/event body/token and provide opaque correlation IDs with restricted audit lookup. Critical audit material belongs outside the production deletion boundary.

**Named responsibilities remain outstanding:** primary operator, backup/on-call, separate recovery/key custodian, security reviewer, billing owner, incident escalation and supported hours. No launch readiness without staffing and an exercised runbook.

## 11. Approval gates and implementation order

| Gate | Scope | Exit/stop condition |
|---|---|---|
| ADR review (now) | Paper architecture, current issue/repository traceability, IAM/egress/cost/risk | Claude independently reviews; owner resolves material choices. **No resources**. |
| WP1 finding disposition | Remediate/reproduce CP1/initial CP2 findings in separate authorized WP1 process | Critical/high correctness issues resolved or affected capability disabled; owner approval required for later work. |
| Synthetic GCP proof (future authorization) | One isolated project, fake providers, original attempt/ledger tests, denial/late-send/recovery drills | Exact inventory, region, 72h and $75 proposed budget, rollback/teardown owner. Failed security invariant → fail closed and preserve evidence. |
| Controlled provider staging (future separate authorization) | Dedicated test WABA/Calendar/OAuth, permission and receipt correlation | Real send/credentials and account access only after reviewed OPS01 controls and bounded owner sign-off. |
| Production launch (future separate authorization) | WP2–WP6/CP closure, M2/M5 and all launch-required commercial journeys, support/privacy/cost tests | Owner acceptance of actual release, legal/data residency, on-call, safety and spend. No automatic cutover. |

## 12. Outstanding decisions / questions for approval

1. Legal/contractual US hosting and key/archive recovery region for Mexico, then country-specific LATAM rollout.
2. Operator and independent recovery/key custodians; escalation and access/approval separation.
3. Final exact synthetic project inventory, daily teardown, SKUs, $75 bounded proof authorization and owner of billing.
4. Formal retention schedule: PITR, archive/evidence, redacted logs, customer export/deletion and holds.
5. GCP Direct VPC/egress topology proven against alternate routes, gateway late submission, established connections and old revisions; whether independent external egress controller is required.
6. Meta business portfolio/WABA ownership, Tech Provider/coexistence/onboarding, billing; Google OAuth scope verification and calendar ownership.
7. Stage-specific SLO and operations hours; 25-business pilot workload verification.
8. Final closure of independent Claude WP1 findings and all relevant F13/OPS01 evidence before provider activation.

## 13. Source/reference register

- GitHub issue #5 and Codex cloud-readiness comment (links in header).
- WP0: https://github.com/vanasperena-ux/nukmiris/blob/e305bab763eacfdc25774c37d98a9de69c5a8da7/docs/greenfield/07-IMPLEMENTATION-PACKAGES-AND-COSTS.md
- WP1 charter: https://github.com/vanasperena-ux/nukmiris/blob/e0b470d8f28bd380c9d6bfdeab0b9aad5e5ab507/docs/greenfield/08-WP1-BOUNDED-IMPLEMENTATION-CHARTER.md
- WP1 status: https://github.com/vanasperena-ux/nukmiris/blob/e0b470d8f28bd380c9d6bfdeab0b9aad5e5ab507/docs/greenfield/10-WP1-IMPLEMENTATION-STATUS.md
- Cloud Run worker pools: https://docs.cloud.google.com/run/docs/configuring/workerpools/manual-scaling
- Cloud Run Direct VPC: https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc
- Cloud Run pricing: https://cloud.google.com/run/pricing
- Cloud SQL PITR: https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/configure-pitr
- Cloud SQL pricing: https://cloud.google.com/sql/pricing
- GCP billing budgets: https://docs.cloud.google.com/billing/docs/how-to/budgets
- Cloud locations: https://cloud.google.com/about/locations
- Mexican private data law (20 March 2025): https://www.ordenjuridico.gob.mx/Documentos/Federal/html/wo125102.html

**Document boundary:** A reference architecture and evidence plan; no claim of present deployment, tested cloud guarantees, accepted legal determination or spending authorization.
