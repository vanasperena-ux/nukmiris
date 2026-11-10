# Milestone B stages, synthetic proof and shutdown plan

**Proposed, not executed.** Date:2026-11-09 America/Mexico_City. This document is
the successor to ADR review05's requested Phase3a harness design; it retains the
nine redlines and DR refinements. Exact implementation and commands must receive
their own review. No resource identifier below has been reserved or created.

## 1. Stage mapping and approval gates

| Stage | Scope | Entry / exit |
|---|---|---|
| Current planning | This reconciliation, gaps, topology/costs, Meta design and Claude handoff | Owner authorized documents. Claude independently reviews the published SHA; no implementation or resources |
| B1 implementation preparation | Separate small code/harness PRs, synthetic fixtures only | **New owner implementation charter approval** after Claude review; no permission to provision from that approval alone |
| **B1a = ADR Phase3a** | Minimal platform epoch/ticket harness, independent fake HTTPS ledger, independent sealer/custody fixture; no application prerequisite | Independent harness review + **separate resource-specific owner authorization**. Run platform controls first, retain failures. No real Meta/Calendar calls/credentials/data |
| **B1b = ADR Phase3b** | Accepted app's behavior through cloud adapters, fake providers, custody/recovery/tenant/load tests | WP1 bounded acceptance already exists; B1a must pass, cloud adapters/roles/custody need review, owner authorizes this exact application proof scope/resources |
| **B2** | Controlled real Meta test-number and dedicated owner-approved Calendar assets only | Separate authorization of exact identities/assets/scopes/cost; server-enforced inbound-subject/outbound-recipient and WABA/number/calendar allowlists; explicit name confirmation implemented/reviewed first; relevant F13/OPS01, custody, transport, receipt, consent and privacy gates closed for enabled scope |
| Later commercial onboarding | Business-owned Meta assets via Embedded Signup, subscriptions and broader customer activation | Separate implementation, Meta approvals and independent/owner review. Design in05 now; no Embedded Signup implementation here |

**B2 is not Phase3b. Both3a and3b remain synthetic.** Local acceptance does not
authorize B1 cloud deployment. A synthetic success does not approve B2 or commercial
activation. No auto-promotion/merge, paid-billing upgrade or trial-quota workaround.

## 2. Minimal candidate inventory and identities

Region: `us-central1` candidate for the synthetic experiment; real-data region is
not chosen. Three dedicated projects with approved unique suffixes: runtime,
custody, fake-provider. Proposed first supervised session **≤6 hours**, with any
broader experiment **≤72 elapsed hours total** if the owner authorizes it. Proposed
total allocation remains **US$50**, not a hard guaranteed ceiling; see04's workload
and capacity sensitivities. No permanent staging, HA, broker, LB/WAF or commitments.

| Resource | B1a shape / bound | Additional B1b / authority |
|---|---|---|
| Ingress | Cloud Run service1vCPU/0.5GiB, min1/max2, IAM restricted; generated signing keys | Separate cloud UI/ingress adapter; allowlisted reviewers/personas, no public test controls |
| Sealer/verifier | Separate service1vCPU/0.5GiB, min1/max2, separate custody identity/project authority | Real candidate chain+index-extension verification and authenticated commit membership; never a local same-key substitution |
| Gateway | Private Cloud Run1vCPU/0.5GiB; normally instance-billed for initial safe continuous CPU, explicit request-billed variant for throttle experiment; unique epoch identity/tag; reviewed max2 plus rollout-overshoot accounting | Original attempt/ticket integration; fake destinations only. New epoch remains inert until fence completion |
| Worker | One continuous worker-pool1vCPU/1GiB instance, no provider route/credentials | Durable application planning/expiry, no privileged global restore role; pool0 alarm. Instance-billed min1 service fallback must be separately repriced/reviewed |
| SQL | Explicit Enterprise PG17 single-zone `db-f1-micro`,10GiB SSD for **minimal epoch/ticket fixture only**, no SLA; private, UTC | Candidate application proof uses explicitly priced dedicated1vCPU/3.75GiB,20GiB SSD or reviewed load-tested alternative; record actual minor/extensions. Full role and IAM contract first |
| Result | Not needed for standalone platform fixture beyond sealed test outcomes | Private min0 request service, distinct result principal/SQL role; no provider-send authority |
| Custody | Separate-admin regional Standard bucket, unique immutable objects/CAS, software KMS test keys, no irreversible lock; bounded1GiB initial proof data | Cloud-candidate authenticated index/log/witness and forensic repair. No real tokens or PII |
| Fake provider | Independent small Linux VM + disk + external IP/TLS pin, durable append-only connection/request/arrival ledger; cost allowance subject to exact SKU | Lost response, delayed acceptance, duplicate Calendar-ID acceptance, ETag conflicts, partial reply-frame outcomes |
| Network | IPv4 VPC with /26-or-larger subnet sizing, dedicated gateway NAT subnet, one NAT IP, unique epoch firewall tags, Private Google Access only as required | NAT is selected by subnet/range, not by service-account or tag. Per-epoch firewall is separate. No default bypass/IPv6 route |
| Build/audit | Bounded Artifact Registry images, pinned digest, reviewed CI WIF, redacted logs/metrics, source/evidence export | Extra result/recovery/connector resources itemized; no application or customer credentials in PR jobs |
| Restore/control | Named manual inert restore and kill/billing/teardown principals | On-demand isolated restore job/DB; no default decrypt/egress. Separate reviewed hard-duration cleanup mechanism, not a provider-resend scheduler |

Current local pools are not a cloud connection budget. A starting **proposal** is
ingress2 connections×max2, sealer2×max2, worker role pools totalling≤8, gateway2×max2,
result2×max2 =24, plus at least10 reserved for migration/recovery/monitoring. Budget
old/new revision overlap and temporary platform overshoot separately. Read actual
`max_connections` and memory before acceptance; max instances alone is insufficient.
Do not create one unbounded pool set for every subscribing business.

## 3. Exact fence protocol and evidence oracle

1. Build/pin image, schema and policy manifests. New gateway N+1 is untagged,
   no-traffic, inert, with a **unique** epoch network tag/identity. Synthetic keys
   only. Do not deploy the provider-capable local server unchanged.
2. Atomically advance persistent execution epoch; N cannot obtain new authority.
   N+1 stays inert. Freeze work intake/promotion as required; preserve original IDs.
3. Shift100% traffic to inert N+1 and remove **all** direct traffic tags from N.
   Record API results and propagation. Traffic0 is not fence completion.
4. Independent kill principal denies old-tag egress including relevant API VIPs,
   removes old scoped secret/decrypt access, and deletes N. Actual production Meta
   token revocation remains mandatory under ADR rules; B1 uses synthetic keys only.
5. Declare completion only with successful platform revision deletion and
   zero-instance evidence after measured/documented reporting delay; corroborate
   termination system logs where available. Missing/stale metrics ≠ observed zero;
   heartbeat absence ≠ death. Reconcile independent ledger and dead-man canaries.
6. Preserve may-have-entered attempts as UNKNOWN; no alternate ID, ownership
   takeover, releasing protected ranges or automatic resend. A pre-fence accepted
   request may finish later. Record that fact without inventing success/failure.
7. Only a recorded explicit promotion enables N+1. Any missing proof holds it inert.
   Rollback deploys the prior image as epochN+2 through this sequence, never routes
   back to an old revision or rewinds a DB/outbox to retry.

Ledger records: server-observed connection ID, SYN/accept/TLS/request/arrival times,
attempt/operation/epoch/revision/instance labels, payload digest, response or loss,
and fence/permission commits. Correlate clocks and uncertainty; an epoch header or
NAT source IP alone is not authenticated instance identity. Use synthetic epoch
authentication and platform evidence, without claiming real providers support it.
Count distinct TCP connections/TLS handshakes, **not raw SYN retransmission packets**.
TLS resumption on a new connection is allowed. Measure p50/p99/max rather than
turning a finite observed maximum into a universal network-tail guarantee.

## 4. B1 acceptance matrix (planned, no results yet)

| ID / ADR link | Schedule / oracle | Pass / hold |
|---|---|---|
| B-T01 / T01,T01c | Ingress/sealer/worker direct fake-provider/public/alternate-route/IPv6 attempts; no-VPC and private-ranges-only deployment |0 successful forbidden routes or secret access; policy must reject bypass. If organization policy unavailable, disclose weaker enforcement and obtain reviewed owner disposition; no false PASS |
| B-T02 / T01b | Worker credential/KMS denial with synthetic grants and fake Calendar; inspect GCP API VIP network/configuration | Credential separation proven for configured infrastructure; **real Calendar API probe deferred to B2**, explicitly NOT VERIFIED in B1 |
| B-T03 / T02,T03 | Retain keep-alive counterexample, then actual fresh per-attempt client, automatic retries disabled in all layers | Expected unsafe pooled case reproduced as a counterexample; corrected client uses one connection and at most one request per original attempt; no blanket success from a failed positive control |
| B-T04 / T04,DR12 | ≥1,000 recorded randomized worker/gateway pause cuts before check/connect, after TLS, before/mid-write, timeout/disconnect |0 old connections originating after completed fence;0 old post-fence writes. Classify pre-fence bytes/acceptance separately and report lag/unknown cases, not as a zero-late-send guarantee |
| B-T05 / DR01,T05 | ≥20 frozen sender/open-socket dead-man trials, including independent delayed wake mechanism; heartbeats can be stopped separately |0 canary requests generated after declared completion. Distinguish pre-fence kernel-buffered bytes arriving later. Measure deletion→termination, metrics delay, firewall/IAM propagation; owner threshold set before execution, proposed≤60s is not accepted yet |
| B-T06 / DR02,T06 | Concurrent deploy, old tag URL, worker overlap, old image rollback as new epoch, old primary restart | Old ticket/refused route cannot regain authority; N+1 inert until proof, no identity reuse; missed deletion stops test |
| B-T07 / DR04 | Force request-billed handler to outlive inbound timeout/disconnect, freeze past absolute deadline, wake on later request | No late new effect; abort/deadline failure stays UNKNOWN/held. If unsafe, instance-billed gateway remains required and cost/architecture evidence updated; an event-loop timer alone is not a fence |
| B-T08 / T07,T08,DR09 | SQL/KMS/custody/witness outage and sealer recycle/cold start; all partial seal/ACK cuts | No ACK before independent durable verified custody; bounded retryable error or held outcome, original IDs retained. Warm min1 is not availability proof |
| B-T09 / T09,T10 | Worker expires/revokes, duplicate/second-worker ticket and lost consume-COMMIT response |0 additional fake invocations; no reconstructed permit or normal-flow operator intervention to guess outcome |
| B-T10 / T11,T12,T13 | Fake Google sometimes accepts same deterministic operation ID; stale ETag; lost positive response; fake Meta receipt/result races and partial frame sends | Preserve correlated facts/UNKNOWN/ordered holds, no automatic resend or forced duplicate deletion. No claim real idempotency proved |
| B-T11 /009/011/017 | Compromised writer keys, larger fork, old-key re-pointing, missing chain/index proof, stale head/witness, witness timeout/CAS uncertainty, crash repair/forensics | Separate verifier denies unauthorized extension before signing/effect; incomplete repair held; original identities preserved. Production gates not closed by a fixture signature |
| B-T12 / R01–04 | PITR and independent-export-alone restores, SQL/archive/key loss, stale suppression, old primary return | New destination inert/no provider/decrypt grants; positive completeness proof, suppression precedence and new epoch;0 fake effects. Missing evidence holds. No promised safe-write RTO |
| B-T13 / application | Known/new booking, two slots/more/date, all summary triggers, invalid/stale/replayed actions, human mode/restart, multi-employee buffers and qualified reassignment | Accepted bounded behavior preserved across cloud DB/network/worker restarts and concurrent customers; no owner profile imported or Test17C manual repeat |
| B-T14 / load/operations |20 authenticated events/s×60s,100 due work/min, archive growth, DB pool/CPU/starvation and tenant fairness | Publish distributions, held/skipped denominators, connections and queue age; no false ACK/effects. SLOs are proposals, not reasons to bypass safety |
| B-T15 / A01,A09,A10 | Hard experiment-time expiry, cost alert/cap pause, restart/month reset, all-resource teardown | Effects stay inert through cost stop/resume; all authorized resource-hour counts and residual storage/IP/key charges reconciled; independent review of cleanup/billing evidence |

Before any real call, retain all **nine OPS01 cases** in doc16, including its
≥10,000 randomized suspension schedules. The1,000 platform trials above do not
replace that requirement. No real Meta credential or Google Calendar request in B1.

## 5. Shutdown, rollback and abandonment

The kill/cleanup/billing owners and backup must be named before provisioning.
Stopping work safely and eliminating infrastructure costs are different tasks.

1. Disable promotion, dispatch/admission triggers and any recurring CI/scheduled
   restart. Persist inert status/epoch and disable the synthetic proof's authority.
2. Fence/delete old and active effect gateways, verify instance termination through
   the same protocol, stop worker pools and result writers, retain unknown facts.
   Cost alerts or a billing pause are not evidence that sockets/instances are gone.
3. Export only reviewed, redacted evidence, ledgers/timings/hashes, resource inventory
   and billing data to an approved destination **outside** the projects being deleted.
   No owner data, raw chat bodies, tokens, keys, private URLs or SQL dumps to GitHub.
4. Delete disposable SQL instances **and inventory retained backups/PITR/export or
   restore copies**; destroy only approved synthetic evidence after retention/export
   checks. Delete fake VM/disks/snapshots, Artifact Registry images/repos and build
   artifacts; remove logs/buckets/exports according to the approved evidence policy.
5. Release NAT and fake-provider external IPs and delete NAT/router/network resources.
   Direct VPC subnet detachment can take1–2h; verify no references/reservations remain.
   Keep old deny rules until instance termination has been established.
6. Revoke temporary principals/WIF bindings and disable triggers/APIs as authorized;
   schedule destruction of synthetic KMS versions and record any still-billable
   disabled/pending-destruction versions. Do not destroy accepted production keys
   or rely on deleting ciphertext rows for key erasure.
7. Delete/shut down the three experiment projects as the final containment layer;
   verify resource-level absence, pending deletion and retained resources explicitly.
   An empty dashboard, stopped VM/SQL or project-deletion request is not a $0 invoice.
8. Reconcile billing after≥48h **and again after reporting settles/final statement**.
   Distinguish delayed historical usage from new usage timestamps. Record unresolved
   charges with a named owner until closed; never declare zero accrual prematurely.

No CUDs, reservations, paid support contracts, domain purchases, Marketplace products,
permanent staging or paid-billing upgrade are part of the experiment. With those
excluded and resources actually removed, there is no intended continuing infrastructure
commitment. Retained evidence/storage/key charges, if any, must be separately named,
priced and approved. Free Trial expiration must never be the cleanup mechanism.

## 6. Exact owner decisions and next authorization

After Claude reviews this package, the owner decides: organization vs standalone
projects/enforcement limits; region; named kill/custody/cleanup/billing/backup roles;
experiment deadline and complete resource/SKU list; gross allocation/currency and
cost-stop thresholds; proposed fence threshold and later G06 disposition; retention/
erasure and human-root custody risk; bounded cloud synthetic name residual; and any
change to the earlier$250/month planning target. Real-data policies wait for B2/C
but must not be inferred from synthetic approval.

A valid later **provisioning approval** names the reviewed code/image and IaC plan,
project IDs/billing account/region, permitted services/shapes/maxima, synthetic-only
data and destinations, start/end and≤72h, gross allocation and overshoot response,
owners and teardown/evidence obligations. It expressly excludes B2, real providers,
billing upgrade, commercial onboarding and production. This document supplies no
such approval and contains no executed provisioning commands.
