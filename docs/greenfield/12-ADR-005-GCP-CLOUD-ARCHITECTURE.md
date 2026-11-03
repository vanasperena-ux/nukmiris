# ADR-005 — NukMiris vNext Google Cloud reference architecture

**Status:** PROPOSED — REVISION 2 FOR CLAUDE DELTA REVIEW; not approved for provisioning or production
**Revision:** 2026-11-03; responds to Claude independent review `03-CLAUDE-ADR-005-INDEPENDENT-REVIEW.md` (RL-1–RL-9). Original reviewed text remains in PR #6 history at commit `55f6fae`.  
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
| Independent sealer | **Cloud Run service with minimum 1 warm instance**, own service account and SQL role; request-billed | No scheduled job or scale-to-zero in the synchronous webhook ACK path; no provider/internet route | Must verify exact committed batch/evidence, not caller digest; measure admission latency and cold-start failure modes. |
| Archive and witness | GCS Standard objects, conditional writes/versioning + separate freshness witness mechanism | Separate project/admin/deletion role; production operator cannot erase journal and keys | A consistent stale hash chain is **not** proof of completeness. |
| Encryption / secrets | Cloud KMS and Secret Manager | Separate key custody, version retention, scoped rotation and break-glass | Customer provider tokens never embedded in source, image or logs. |
| Observability | Cloud Logging/Monitoring; independent audit export | PII redaction, restricted audit lookup and cross-project export | Alert on actual failures/holds, not only CPU or uptime. |
| CI/CD | GitHub Actions with Workload Identity Federation + Artifact Registry | Pinned action/image digests, environment-level manual approval | No untrusted PR production creds, automatic production release or unattended rollback. |

Cloud Run Worker Pools are not request-driven automatic workers; manually scaled always-on operation and shutdown behavior need explicit validation. If unavailable or unsuitable, test a Cloud Run service with instance-based billing/minimum one instance, or documented scheduled execution that passes overlap/timing requirements; do **not** rely on request-CPU after webhook ACK.

## 4. Security and provider effect safety

### 4.1 F13 / OPS01: hard unresolved gate

A worker submits only a **single-use** authorization envelope binding original attempt ID, tenant, operation and payload digest, provider purpose, current permission/status and mapping revisions, recovery epoch, deployment identity and short expiry. The independently credentialed gateway checks persisted current authority and consumes that original attempt once, denying if control evidence is unavailable.

**This is necessary but not sufficient.** A gateway can pause after its final check; a socket can remain open; cached credentials or alternate egress can bypass a revoked ticket. GCP proposed controls: Direct VPC `all-traffic` egress of runtime roles, deny-by-default provider/internet route policies, gateway-only approved egress, per-release identities, independent kill control, old-instance termination, connection/socket inspection and fake-provider ledger. **A Google VPC firewall rule change affects new connections, not established ones.** The gateway must open a **fresh TCP/TLS connection for each original provider attempt, after its final persisted-authority check**; disable connection pooling, keep-alive, HTTP/2 session reuse and automatic client/SDK retries for effect requests. A fence is not complete until the old gateway revision is deleted and its instances are verified terminated via per-instance epoch/revision heartbeats and instance-count metrics. An L3/L4 firewall is not an HTTPS hostname allowlist; validate DNS, IPv6, alternate paths and existing connections. Never assert a zero-late-send bound based only on leases, SIGTERM, routing, token revocation, or traffic-to-zero. **F13 two-part testable claim:** (i) after a fence F is complete at time T (old revision deleted and instances confirmed terminated), no *new* provider connection may originate from earlier epochs; (ii) a request whose connection opened before T may reach the provider later, or may already have been accepted and subsequently delivered. Its residual time D is bounded by enforced request deadline plus network tail when running; a frozen process with an existing connection instead relies on measured fence-to-termination latency. **Neither bound is currently demonstrated**: Phase 3a must measure D with adversarial pauses and ledger timestamps; the owner must explicitly disposition any remaining G06 risk before real-provider staging. Connection SYN/arrival logs from fake providers are evidence, not a claim about actual Meta/Google delivery.

**Required adversarial proof:** pause/thaw worker *and gateway* after last check and before socket submission; suspend/revoke during in-flight traffic; revive old revision/primary and cached connection after takeover; attempt direct provider route from ingress and workers; simulate control-plane outage and provider acceptance/lost response. All fixtures must preserve original identities and UNKNOWN outcomes and record exact fake-provider invocation counts. If proof fails, stop the unsafe capability and keep production activation blocked. A request accepted by a provider before cutoff may still complete afterward; distinguish physical submission timing from delivery timing.

**Network and credential boundaries:** Direct VPC `all-traffic` is mandatory for every runtime revision. Enforce `run.allowedVPCEgress=all-traffic`, plus deployment admission and audit checks that reject a revision without a VPC attachment or with `private-ranges-only`; whether org policy alone rejects missing VPC must be experimentally verified. Cloud Run without VPC egress can otherwise bypass VPC firewall rules entirely. Private Google Access can allow any VPC-attached identity to reach Google API endpoints, including Calendar, without NAT. Non-gateway protection therefore relies on KMS-enveloped per-tenant OAuth tokens stored in PostgreSQL and **only the gateway service account** holding decrypt permission, not a claim that Google API network reachability is absent. Deny-all firewall policy for the *old* epoch tag must also cover Google API VIP paths, and the gateway must verify its process/epoch identity and current database authority; existing sockets still require instance termination.

### 4.2 Tenancy, permissions, operators

- PostgreSQL composite tenant constraints, restricted roles, schema-qualified/fixed-search-path security-definer functions where needed; current per-business permission and execution heads are persisted, not in-memory caches.
- Prove cross-tenant ID spoofing and mixed-tenant STOP suppression tests. Runtime role with access to multiple tenants must still be treated as an explicit blast-radius risk.
- Suspension wins over proactive work and cannot be undone by inert restore; reactivation does not catch up old/unknown work. Opt-out is immediate and never silently re-created.
- Production operator individual identities, MFA, scoped/time-bound administrative grants, audit trail, and separate roles for deployment, evidence/key custody, and incident approval.

### 4.3 Credentials, Meta and Google

- Meta portfolio/app/WABA/phone, payer/template and Tech Provider or coexistence rules must be independently verified using owner-specific test assets. Avoid temporary “Try it out” tokens for continuous production.
- Google Calendar uses each business's authorized OAuth scopes and verified Calendar rights. **Never revoke a tenant's OAuth grant to fence an old deployment**: revocation withdraws that business's consent and breaks successor access. Use KMS-envelope encryption per tenant in SQL; decrypt privilege belongs only to the gateway, with plaintext access tokens cached in gateway memory for **at most five minutes** (not a substitute for termination). Use **deterministic event IDs** derived from immutable original attempt identities for create operations and **`If-Match` ETag preconditions** for moves/cancels. Treat `409` duplicate/`412` precondition failure as observed outcomes requiring reconciliation, not commands to retry. Deletion/reinsertion semantics and concrete request-library support must be validated before provider activation.
- Meta production deployment design uses **two separately revocable system-user credentials A/B**, alternating by deployment epoch; retire old credential N only after coordinating successor identity and explicit cutover authority. Measure revocation-to-refusal latency with separately authorized staging assets; never assume instantaneous revocation or Meta-side idempotency. No Meta credential is needed for either synthetic proof stage.
- The submission gateway may access narrowly scoped Meta/Google credentials; ingress, worker, CI PR jobs and restoration runtime may not. Secret Manager is for a small bounded set of **platform** secrets (fewer than ten versions assumed for pilot costing); individual tenant OAuth tokens belong in encrypted SQL records, never one Secret Manager version per tenant. Each application role has its own service account/SQL role, a bounded connection pool and explicit max-instance quota. No restore project has token-decryption permission by default. Never replicate production OAuth grants into synthetic staging.

## 5. Admission, processing, UX and availability contracts

1. Ingress authenticates Meta request, checks mapped receiving number/WABA and verifies original raw bytes.
2. PREPARE source evidence is recorded; SQL batch is STAGED transactionally.
3. Independent sealer verifies committed membership and content, records trusted seal/freshness head and marks eligible.
4. Acknowledge only if durable verified admission exists. Error or hold otherwise; do not meet SLO by falsely ACKing.
5. Persistent due work and ordered outbox use only original operation/attempt IDs; no in-memory timer is source of truth.
6. The sole effect gateway checks final current authority; receipt loss becomes UNKNOWN and blocks unsafe automatic re-send. Read-only reconciliation only if provider identity/correlation supports it.
7. Existing Google Calendar events block computed availability as previously approved; ambiguous manual events stay unmanaged and go to Needs Attention, not auto-canceled.
8. Respect WP0 reminder semantics: original four-template schedule, approved **15-minute due-work allowance**, no catch-up after expiry, suspension or reactivation; report eligible/skipped/held counts. All effect clients have retry count **zero** and hard request deadlines; timeout/lost response => UNKNOWN, held without automatic replay. Worker pool must report heartbeats so accidental scale-to-zero is detected.
9. Calendar time handling preserves UTC instant, business IANA zone and civil-time intent, including DST folds/gaps.

Pilot measurement assumptions (unapproved SLOs): 25 businesses, 250 appointments/day, 100k monthly webhook requests and 100k gateway requests; test burst 20 authenticated events/second for 60 seconds and 100 due jobs/minute. Targets to validate—not safety substitutes—are 99.5% authenticated ingress availability, sealed ingress p95 <=2s/p99 <=5s, 99% eligible healthy-provider reminder submissions <=60s and always within approved window. Any scale/latency expansion needs capacity evidence.

## 6. Recovery and continuity

- Start with **single-zone fail-stop** Cloud SQL Enterprise. Configure and test **7-day PITR** as a proposed baseline. Cloud SQL automated backups and PITR are **not** considered an independent recovery copy; assume they can be lost when the instance is deleted. The separately administered, scheduled **GCS custody export** is the independent backup source, with integrity/witness evidence; test restoration from that export alone. Restrict `cloudsql.instances.delete` and backup deletion to break-glass identities. Verify WAL/PITR billing from actual test invoices. Define explicit recovery regions and data-retention approval before any real records.
- Restore into a **new isolated database** with every gateway/dispatcher disabled, no provider credentials/egress or KMS decrypt grants, and a **new execution epoch before any gateway connects**. Restore suppression and permission heads first, then verify archive prefix/head/witness/key completeness and original IDs.
- Preserve unknown/may-have-submitted attempts; do not regenerate identities or replay old outbox. Missing or stale evidence holds affected scopes or all scopes when isolation cannot be established.
- Safe read-only recovery <=4 hours is a *test proposal*. Safe-write resumption has **no promised RTO** until independently reviewed evidence demonstrates old deployment containment, archive completeness and permission consistency.
- HA/automatic failover is out of the initial pilot. A higher-availability topology changes safety and price and requires a new design and proof.
- **Custody threat model:** a separate GCP project/folder and different restricted admin principal, preferably hardware-key protected, defend against compromised production runtime, CI or deployer identities. They do **not** independently defend against the same ultimate human/root account controlling both projects. Production identity gets only append/create rights; witness head updates require the independent sealer's scoped CAS authority. Versioned object generations and `ifGenerationMatch` protect head writes, but do not prove missing post-checkpoint admissions never existed. Start with no irreversible retention lock. Payload evidence uses opaque IDs and per-tenant (or where legally required per-subject) envelope encryption with destruction-capable keys. Define crypto-shredding, backup/key retention alignment, legal holds, and ARCO erasure handling before locking records or processing customer data.

## 7. Region, privacy, retention and legal gate

**Candidate region:** `us-central1`; separate US recovery location only after confirmation of archive-region and key-custody policy. Hosting in the US does not follow automatically from LATAM market focus. Establish the contracting entities, each business's role as controller/responsible party versus NukMiris as processor/encargado where applicable, the privacy notice, consent and international transfer/remisión structure, provider/data-processing terms, subprocessors, incident notification, deletion/export, retention and customer residency obligations. Mexican private-sector law was reissued on **2025-03-20**; use the applicable LFPDPPP and obtain qualified legal advice before production cross-border processing. Additional LATAM countries require separate jurisdiction-by-jurisdiction review, not a blanket conclusion that US hosting is acceptable. For legal validation only, assess the business as potential **responsable**, NukMiris as **encargado**, and GCP/Meta as potential subprocessors/sub-encargados, including remisión contracts, ARCO deletion/cancellation, cross-border records and Meta's independent data paths. Neither Mexico hosting nor US hosting by itself establishes end-to-end residency or legal compliance. Encryption/key-destruction design must be checked against valid deletion rights before enabling storage retention lock.

**Retention proposals for cost modeling only:** 7-day PITR; 90 days for independent operational evidence; separate, shorter PII log retention, configurable customer history/export/deletion, legal-hold exception handling and versioned key retention matching verified recovery needs. Retention needs owner/legal approval and should not cause safety evidence necessary to resolve UNKNOWN attempts to disappear while obligations remain open.

## 8. Cost model and guardrails (rev 2; RL-9 / A5-14 / A5-19 / A5-20)

The November 1 **original** Codex model was $174.65/month, or $218.31 with 25% contingency, for one pilot environment plus custody. Claude's November 2 **revised sensitivity** changes minimum-one-instance sealer, applies conditional billing-account free-tier assumptions, limits Secret Manager versions and gateway-only NAT. It is **not a vendor quote**, and billing-account-wide free-tier availability is unverified. Reprice before authorizing spend.

| Component (USD/month) | Updated illustrative pilot |
|---|---:|
| HTTPS ingress and gateway | 24.09 |
| Always-ready sealer, min 1 | ~9.50 |
| Continuous worker pool, net of assumed free tier | ~27.60 |
| Cloud SQL single-zone compute, SSD and backup allowance | 55.11 |
| Independent archive + KMS | ~7.66 (not independently price-verified by Claude) |
| Platform secrets, bounded versions | ~0.30 |
| Logging/telemetry allowance | ~3.00 |
| Build/image storage | ~1.10 |
| Gateway-only NAT/network egress | ~8.00 (metering/instance accounting unverified) |
| Transfer reserve | ~2.00 |
| **Estimated subtotal (rounded)** | **~138** |
| **With 25% contingency** | **~173** |

Permanent duplicate staging adds approximately another environment and likely exceeds the $250 target; **ephemeral staging is preferred**. HA database, worker instance-based fallback, traffic protections and restore drills are unpriced or separate sensitivities; billable provider messages, legal/security/on-call labor, tax, domain and multi-region production are excluded. Cost alerting can add fees from 2027. The initial $250 is a planning target, **not an authorized spend or hard cap**. Capacity, regional availability, free-tier status and DB connection headroom must be verified through the proof invoice and load tests.

A separate **Phase 3a** synthetic platform-only experiment is proposed for **at most 72 hours**, with Claude's indicative resource estimate ~$8–12 (not a quote) and a **proposed $50 authorization cap** instead of the earlier $75. A complete resource/SKU inventory, billing account, cleanup person and owner approval are required before any resources are created. Cost alerts at $10/$25/$40; the operator must review billing daily. At approved budget limits the operator makes dispatch inert before scaling services to their minimum and preserving audit evidence. **GCP alerts do not forcibly stop charges**; delayed billing, fixed fees and retained resources can overshoot any cap. Restrict permitted resources, instance maxima and log volume, and delete all proof projects at end.

## 9. Environment and CI/CD design

- **Local development:** isolated synthetic fixtures; preserve accepted v0.8.1 on the user's PC.
- **Cloud proof:** separate GCP project/billing labels, disposable synthetic-only DB/archive/KMS, fake Meta/Google endpoints, entirely distinct identities. Default no effect permissions.
- **Staging:** later, separate project/database/secrets and explicit controlled test credentials; fake endpoints by default. Not automatically promoted.
- **Production:** distinct project/roles/key custody, MFA and protected release approval; must satisfy all WP, commercial, privacy and operational gates.
- GitHub Actions: pin dependencies and Actions SHA; `npm ci --ignore-scripts`, typecheck, scope and fault tests, SQL role/tenancy checks, secret scanning, build SBOM/image digest, immutable Artifact Registry image; WIF for trusted deploy, no persistent JSON cloud key and no PR secrets.
- Migration: separate short-lived DB role, one runner, preflight compatibility and restore evidence, non-destructive rollout first. Each process role uses a distinct SA mapped to restricted SQL permissions; sum of maximum instances times per-instance DB pools must fit `max_connections` with recovery/migration reserve.
- **Fixed gateway release/fence protocol:** (1) deploy epoch N+1 gateway **untagged, `--no-traffic`, inert** using its distinct network/identity tag and Meta A/B credential; (2) atomically advance the execution epoch in independently verified SQL authority, denying new N tickets; (3) independent kill-role holder applies deny-all for N's network tag (including Google API VIP), revokes old Meta N credential when applicable and **deletes** revision N; (4) confirm **all** N instance heartbeats cease and instance-count metric reaches zero, and reconcile fake-ledger observations; (5) classify all unresolved in-flight operations UNKNOWN and preserve original attempt IDs; (6) explicitly authorize and enable N+1 dispatch. If any fence confirmation is absent, keep N+1 inert. Rollback uses the same protocol and never resumes old outbound work automatically. Cloud Run traffic at 0% or removal of a tag alone is *not* proof that an old revision cannot be invoked.
- The **kill authority** is a narrowly scoped independent IAM principal/custom role outside GitHub CI deployer permission, with revision deletion and specific firewall-management rights, time-bounded MFA/break-glass procedure and auditable actions. Exact holder must be named before test authorization.

## 10. Observable failure handling and responsible owners

Minimum alerts: **worker heartbeat absence / unexpected zero worker instances**, signed ingress errors and seal/ACK lag; STAGED/seal delay; missing witness/key; worker due lag; blocked output/UNKNOWN count and age; permission/suspension mismatches; cross-tenant violations; **gateway connect-attempt and connect-failure counters per deployment epoch, correlated with fake-provider ledger records (source IP / epoch headers), and per-instance epoch/revision heartbeat disappearance**; provider/auth/template failures; Cloud SQL saturation/PITR/backup age; archive capacity; cost trend. Logs redact phone/name/message/event body/token and provide opaque correlation IDs with restricted audit lookup. Critical audit material belongs outside the production deletion boundary.

**Named responsibilities remain outstanding:** primary operator, backup/on-call, separate recovery/key custodian, security reviewer, billing owner, incident escalation and supported hours. No launch readiness without staffing and an exercised runbook.

## Synthetic experiment split (RL-9 / A5-09)

**Phase 3a — platform containment only, no WP1 dependency:** a small purpose-built gateway+worker+sealer+epoch harness, separately controlled network/custody fixture, fake-provider endpoint with durable connection/arrival ledger, pauser and independent kill script. Test non-gateway denial, Google API path/credential denial, no-VPC bypass rejection, keep-alive counterexample, fresh-connection enforcement, ≥1,000 randomized pause/thaw runs, ≥20 fence-to-termination timing trials, old-tag URL, denied authority outages, control-plane outage tabletop, and authenticated independent seal/ACK. Record connection SYN and arrival times, p50/p99/max measured tail D, per-instance heartbeats, zero forbidden fake provider invocations in cases where the safety contract forbids them. **Failure stops the experiment.** Do not claim this validates WP1 logic or real-provider semantics.

**Phase 3b — application synthetic integration after WP1 CP1/CP2 fixes and independent re-review:** verify original attempt ownership, immutable epoch-bound tickets, explicit zero-retry provider adapters, deterministic fake Google event IDs/ETags, lost responses → UNKNOWN, load/DB-connection budgets, cross-tenant/STOP and reminder time windows, and inert restore from the independent custody export with missing-tail/key scenarios. Both phases have **no real provider credentials, calls or customer data**. Real Google deleted-event ID semantics and Meta credential revocation latency require separately authorized provider staging, not these synthetic phases.

**Proposed 3a resource inventory (NOT AUTHORIZED, pricing and feasibility pending):** dedicated `nm-proof3a-run` project: disposable Cloud SQL PG 17 shared-core 10GB for only epoch/ticket fixtures; Cloud Run ingress/sealer and gateway (1vCPU/0.5GiB, min1/max2; gateway revisions for overlap test); one 1vCPU/1GiB worker pool; Direct VPC IPv4 subnet + gateway-only Cloud NAT; firewall and org-policy enforcement; Artifact Registry (under 2GiB). `nm-proof3a-custody`: versioned unlocked evidence bucket plus test KMS key, independent admin. `nm-proof3a-fakeprov`: smallest priced test fake-provider endpoint/VM with static IP and pinned test TLS, durable ledger. Only synthetic signing keys; no real Meta/Google access. At most 72h, proposed $50 ceiling; operator and exact SKU forecast required. Preserve logs/results then delete all proof projects and independently check final charges.

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


## Revision 2 changelog and outstanding decisions (2026-11-03)

| Claude redline | Findings | ADR rev 2 change |
|---|---|---|
| RL-1 | A5-01 | Fresh provider connection per original attempt, old revision/instance termination as fence completion |
| RL-2 | A5-04 | Two-part F13 containment statement, residual D measurement, G06 owner disposition |
| RL-3 | A5-03 | Warm Cloud Run sealer service, never a scheduled ACK-path job |
| RL-4 | A5-05/06 | Google deterministic IDs/If-Match/no grant revocation, Meta A/B epoch credentials |
| RL-5 | A5-07/12 | Private Google Access and KMS custody; enforce all-traffic VPC and reject no-VPC revision |
| RL-6 | A5-08 | Ordered deploy/fence/rollback protocol and independent kill authority |
| RL-7 | A5-02/17 | Observable gateway connects, ledger correlation and worker/instance heartbeats |
| RL-8 | A5-10/11 | Independent GCS export, per-tenant crypto-shredding design, single-owner threat limit |
| RL-9 | A5-09/14 | Phase 3a/3b split, revised cost estimates, proposed $50/72h proof gate |

**Owner choices STILL OPEN (none silently approved):** target old-instance fence-to-termination threshold (Claude proposed <=60s; actual D must be measured separately), named independent kill-role holder, named custody/key administrator, primary/backup operator and billing owner, ephemeral versus permanent staging, acceptable retention/privacy/legal outcome, and exact Phase 3a SKU inventory/billing cap/cleanup owner. **No resource creation or code changes are authorized.** This ADR remains proposed pending Claude's rev-2 delta review, Codex's repository compatibility assessment and owner approval of the bounded proof.
