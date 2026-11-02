# NukMiris vNext: independent review of the proposed GCP cloud architecture (ADR-005)

**Reviewer:** Claude (independent; acting as principal cloud, SaaS infrastructure and security/reliability reviewer)
**Date:** 2026-11-01 (America/Mexico_City). Pricing and documentation checked on this date.
**Scope:** paper review only. No resources provisioned, no code changed, no provider called, no PR merged, v0.8.1 and WP1 untouched.
**Repository state inspected:** `main` at `c439586`, WP0 branch `planning/greenfield-wp0-2026-10-31` (`e305bab`), WP1 branch `implementation/wp1-synthetic-safety-slice` (`e0b470d`), Issue #5 and its three comments.

---

## 0. Material I could not review

**ADR-005 (GCP Cloud Architecture Decision Record) and the "Independent Claude Review Handoff" were not available to me.**

- Neither file was attached to the review request. The only attachment was the task brief.
- Neither is committed on any branch. I searched every remote branch and the commit history for ADR-005. The owner's comment on Issue #5 ([6568546233](https://github.com/vanasperena-ux/nukmiris/issues/5#issuecomment-6568546233)) confirms they are "downloadable conversation artifacts, **not yet committed to GitHub**".

So I have **not** reviewed the ADR-005 text, and nothing below should be read as approval of it. I reviewed the architecture **as described in Issue #5**:

- Codex's reference topology, safety evaluations and itemized cost model ([6568448125](https://github.com/vanasperena-ux/nukmiris/issues/5#issuecomment-6568448125)).
- ChatGPT's strategic summary ([6568467086](https://github.com/vanasperena-ux/nukmiris/issues/5#issuecomment-6568467086)).
- The owner's summary of what the ADR-005 draft covers ([6568546233](https://github.com/vanasperena-ux/nukmiris/issues/5#issuecomment-6568546233)).
- WP0 docs 03, 06 and 07, the WP1 F13 counterexample (`vnext/evidence/checkpoint-1/F13-RESIDUAL-LATE-SUBMISSION.json`) and my own earlier WP1 review (`01-CLAUDE-WP1-CP1-CP2-REVIEW.md`).

**Request:** please commit ADR-005 and the handoff, documentation only (for example `docs/greenfield/12-ADR-005-GCP-REFERENCE-ARCHITECTURE.md` and `docs/greenfield/12a-ADR-005-CLAUDE-REVIEW-HANDOFF.md`), and ask for a delta review. Wherever ADR-005 already handles a point below, the delta review can close that finding quickly.

---

## 1. Executive verdict

| Question | Verdict |
|---|---|
| Architecture direction in Issue #5 (Cloud Run ingress, Cloud SQL PostgreSQL, one worker-pool instance, credential-holding submission gateway, independent sealer and custody, Secret Manager/KMS, redacted monitoring, modular monolith, no broker/Redis) | **GO WITH REVISIONS** |
| ADR-005 as a written decision record | **Not reviewable: document unavailable.** No verdict until it is committed. |
| Authorization to deploy anything, including the synthetic proof | **NO-GO now.** Nothing is authorized, and the blockers in §3.4 must close first. |
| GCP over Render | **GCP preferred**, but for a different reason than the issue thread gives (see §6). |

The direction is sound. It keeps the modular monolith and PostgreSQL core, concentrates provider effects in one small gateway, avoids a broker, and treats F13 as an open production gate instead of a solved problem. I would not approve a different stack.

The revisions matter because the **main containment mechanism the thread relies on is weaker than stated.** On GCP, a VPC firewall change "enforces this change only on new connections. Existing connections persist" ([VPC firewall rules](https://docs.cloud.google.com/vpc/docs/firewalls)). If the gateway reuses one long-lived HTTPS connection to Meta, a stale gateway keeps a working path after its egress rule is removed. Direct VPC egress also does not support firewall-rule logging, and VPC Flow Logs do not report the Cloud Run revision name ([Direct VPC](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc)). The "alert on denied egress" control in the thread therefore cannot be built as described. These problems are fixable, and §4 and §7 say how. Without the fixes, the synthetic proof would test the wrong thing.

---

## 2. Strengths and weaknesses

### Strengths

1. **The right core.** One PostgreSQL transactional core with SQL-held schedules, outbox, permission and status heads matches WP0 and the WP1 evidence. No Redis, broker or microservices. Codex and ChatGPT agree, and so do I.
2. **Effects concentrated in one place.** Only the submission gateway holds provider credentials and has an internet route. The worker can be stale without harm if the gateway checks current state. This shrinks the F13 problem from "every process" to "one small process".
3. **Durable work belongs in a worker pool, not request-billed HTTP.** Codex correctly rejects request-billed CPU after ACK as a worker. Cloud Run worker pools are priced at $0.000011244 per vCPU-second and $0.000001235 per GiB-second ([Cloud Run pricing](https://cloud.google.com/run/pricing)). One 1 vCPU / 1 GiB instance costs about $32.80 a month, or about $27.60 after the worker-pool free tier.
4. **Honest framing.** No exactly-once, zero-loss, HA or automatic-failover claims. Fail-stop is the stated initial posture, and F13 is held open on both hosts.
5. **Per-revision identity.** On GCP, network tags and service accounts are set per revision ([Direct VPC](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc)), so each deployment epoch can have its own network policy. Render documents no comparable control.

### Weaknesses

1. The firewall, the "egress fence", does not cut existing connections (Critical, §3.1 C-2).
2. Credential revocation is treated as a general fence. It cannot be one for Google Calendar without destroying each tenant's consent (High, H-1).
3. The design overlooks provider-side controls that would help a great deal: Google Calendar's client-chosen event IDs and `If-Match` ETags (High, H-1).
4. The sealer sits in the ACK path with minimum instances 0 and Direct VPC egress, so its cold starts can break Meta webhook latency (High, H-3).
5. "Independent custody" is assumed without a people model. With one owner holding every admin role, independence protects against compromised workloads and CI, not against compromise of the owner's account (High, H-5).
6. Immutable evidence conflicts with Mexican data-subject cancellation rights unless the design uses crypto-shredding (High, H-5).
7. The cost model is reasonable but mis-weighted. NAT and Secret Manager are overstated. Permanent staging, an optional LB/WAF and the alerting charges due in 2027 are missing (Medium, §5).

---

## 3. Findings

Severity: **Critical** blocks the next gate outright. **High** must be fixed at the stage named. **Medium** or **Low** are improvements or disclosures.
Gate tags: **[S]** before the synthetic cloud proof, **[P]** before real provider staging, **[X]** before production.

### 3.1 Critical

**C-1. ADR-005 and the review handoff are not in the repository. [S]**
- *Evidence:* §0. The owner's comment says they are uncommitted.
- *Impact:* the gate would be "approved" on a document no reviewer or Codex can see. Codex's planned repository-compatibility assessment has no input.
- *Remediation:* commit both documentation-only, with a changelog that reconciles them with this review, then run a delta review.

**C-2. The planned egress fence does not stop a stale gateway's existing connections, and denied egress cannot be observed the way the thread proposes. [S design, P proof]**
- *Evidence:* GCP VPC firewall rules are stateful. Rule changes apply "only on new connections. Existing connections persist, and their associated traffic remains unaffected." Tracking stays active while at least one packet passes every 10 minutes ([firewall docs](https://docs.cloud.google.com/vpc/docs/firewalls)). Direct VPC egress does not support firewall-rule logging, does not support Cloud NGFW Enterprise inspection, Flow Logs omit the revision name, and instance IPs are ephemeral ([Direct VPC](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc)). Firewall rules match IPs, not hostnames.
- *Impact:* "remove the old revision's provider route" can leave an HTTP/2 or keep-alive pooled connection to `graph.facebook.com` usable for many minutes. Node's default `fetch` (undici) pools connections. "Alert on denied egress" has no log source, and hostname-level allowlisting is unavailable on this path.
- *Remediation (design):*
  1. The gateway opens **one connection per provider attempt** (no keep-alive or pool; `Connection: close`, or an HTTP/2 session closed after one stream). Every send then needs a new connection, which is subject to the current firewall.
  2. **Per-epoch network tag** on the gateway revision. The egress allow rule (and Cloud NAT eligibility) is bound to the current epoch's tag only, and the rule set is deny-by-default.
  3. A fence action **deletes the old revision** and verifies its instances are gone. Moving traffic to 0% leaves tagged revision URLs invokable.
  4. Evidence of denial comes from the gateway's own audit, the fake-provider ledger and connect-failure counters, not from firewall logs.
- *Remediation (proof):* the adversarial tests T-1 to T-6 in §4.

### 3.2 High

**H-1. Credential revocation cannot fence Google, and the design skips Google-side idempotency and preconditions. [S design, P proof]**
- *Evidence:* every tenant authorizes NukMiris by per-business OAuth. Revoking the refresh token, which also revokes its access tokens, removes that tenant's consent, so it cannot be a per-deployment fence. Already-issued access tokens stay usable until they expire, typically one hour. My own WP1 review (§4.3) said "revokes or rotates the tenant's provider credential". **I correct that here: it holds for Meta (see H-2) and not for Google.** The Calendar API returns `409 duplicate` when a client-chosen ID "already exists" and `412 conditionNotMet` when the `If-Match` ETag is stale ([Calendar API errors](https://developers.google.com/workspace/calendar/api/guides/errors)).
- *Impact:* containment for Google calls is network-only. That is exactly the layer C-2 weakens.
- *Remediation:*
  - Every create uses a **deterministic event ID** derived from the original attempt identity, so a late or duplicate create becomes `409`, which counts as evidence.
  - Every move or cancel uses **`If-Match` with the ETag** observed at preparation, so a late write after a newer change fails with `412`.
  - The fake Google provider must model both behaviours in the synthetic proof.
  - In staging, verify what happens when a create reuses the ID of a cancelled or deleted event. The documentation does not say (**assumption, unverified**).
  - Keep Google access tokens only in gateway memory, with a short cache lifetime (for example 5 minutes or less).

**H-2. Meta has no fencing primitive the design can rely on. Use per-epoch Meta credentials. [P]**
- *Evidence:* I found no idempotency key or conditional-send mechanism in the WhatsApp Cloud API documentation I could reach. Codex reported Meta's developer site returning HTTP 429. Treat this as **unverified, not as proven absent**. How quickly a system-user token revocation takes effect is unknown (WP1 review §4.4).
- *Impact:* a late Meta send cannot be rejected by Meta. It can only be prevented before its bytes leave the VPC.
- *Remediation:*
  - Hold **two Meta system-user credentials (A and B) and alternate them by deployment epoch**. Fencing epoch N then means revoking credential N without touching N+1. Only the gateway can read them.
  - In staging, measure revoke-to-refusal latency, worst case over at least 20 trials.
  - Keep the app secret, the webhook verify token and the sending token distinct, as Codex said.
  - No SDK, proxy or platform-level retry of a send, ever.

**H-3. The sealer's cold starts and Direct VPC start-up delay sit in the webhook ACK path. [S]**
- *Evidence:* Codex prices the sealer at minimum instances 0. The Direct VPC documentation warns of "connection establishment delays of a minute or more on instance startup", and of cold starts of 30 seconds or more with Cloud NAT ([Direct VPC](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc)). WP0's proposed targets are sealed-ingress p95 ≤ 2 s and p99 ≤ 5 s.
- *Impact:* missed ACK targets and Meta redelivery bursts. These are safe given idempotency, but noisy, and they would invalidate the SLO evidence.
- *Remediation:*
  - Sealer and ingress run with **minimum instances 1**. This adds about $8–10 a month for a small request-billed service, based on the idle min-instance rates on the [Cloud Run pricing page](https://cloud.google.com/run/pricing).
  - Ingress, sealer and worker get **no internet route and no NAT**. They need only Cloud SQL private IP and Google APIs (Private Google Access for GCS and KMS; confirm in the proof).
  - Measure cold-start-to-first-seal in the synthetic proof (A-6 in §9).

**H-4. The stale-gateway time-of-check/time-of-use window is not bounded in a form the owner can accept or reject. [P]**
- *Evidence:* the F13 counterexample shows a business SUSPENDED with an attempt VERIFIED_APPLIED. WP0 doc 03 requires CP5 to "define its enforceable bound". The ticket design moves the window into the gateway but does not close it. TCP retransmission can also deliver bytes already written well after a process "decides" anything.
- *Remediation:* ADR-005 states the claim in measurable form:

  > After fence action F completes at time T, no **new** provider connection originates from any epoch < N. Bytes whose first packet left before T may arrive up to D seconds later, where D ≤ gateway hard deadline + measured network tail.

  Then measure D (T-4, T-5). The owner records whether D is acceptable under G06. This does not reopen G06: WP0 already says no blanket physical guarantee is claimed.

**H-5. "Independent custody" lacks a people and threat model, and immutable evidence conflicts with deletion rights. [P design, X proof]**
- *Evidence:* Codex costs "a separate GCP recovery organization". A separate organization needs a separate Cloud Identity or Workspace domain. Issue #5 names no operators, custodian or security reviewer. Separately, Mexico's new LFPDPPP (published in the DOF on 20 March 2025, in force 21 March 2025; INAI's functions moved to the Secretaría Anticorrupción y Buen Gobierno; obligations now also reach encargados, per [Hogan Lovells](https://www.hoganlovells.com/es/publications/mexicos-new-federal-data-protection-law-what-it-means-for-companies)) keeps ARCO rights, including cancellation.
- *Impact:*
  - With a single human administrator, "independent" custody protects against a compromised runtime, CI pipeline or deployer service account, **not against the owner's account being compromised**. The ADR must say so.
  - Bucket Lock retention is irreversible ([Bucket Lock](https://docs.cloud.google.com/storage/docs/bucket-lock)). Raw PII in locked evidence could not be erased on a valid cancellation request.
- *Remediation:*
  - Use a separate **project and folder** (not necessarily a separate organization) with its own admin principal: a distinct account, a hardware security key, and no roles shared with the deployer or runtime.
  - Deny `storage.objects.delete` to every production identity, and apply a locked retention policy only after a crypto-shred design exists.
  - Evidence objects hold **opaque IDs, digests and per-tenant (or per-subject) KMS-encrypted payloads**. Erasure means destroying the key version, after the recovery window allows it.
  - Name the custodian and the break-glass procedure before staging.

**H-6. Rollout semantics allow old and new authority to overlap. [S]**
- *Evidence:* worker-pool "instance allocation adjustments are not instantaneous", and during transitions work may go "to either a new revision or a previous revision" ([worker-pool splits](https://docs.cloud.google.com/run/docs/managing/workerpool-instance-splits-rollbacks)). Service revisions with traffic tags stay invokable at 0% traffic. Invoker IAM is granted per service, not per revision.
- *Impact:* an old gateway revision can be reached by any principal with invoker rights through its tag URL, and an old worker can keep polling during the transition.
- *Remediation:* write a fixed deploy sequence into ADR-005 and test it:
  1. Deploy the new gateway with `--no-traffic`, no tag, and the epoch N+1 tag and credential.
  2. Raise the epoch in SQL; the gateway rejects tickets whose epoch is below the current one.
  3. Fence epoch N: delete its egress rule, revoke its Meta credential, and **delete the old revision** (not just 0% traffic).
  4. Verify no epoch-N instances remain.
  5. Classify in-flight attempts as UNKNOWN.
  6. Only then enable dispatch for N+1.

  Rollback follows the same sequence. It never restores an older database.

**H-7. The synthetic cloud proof would run unremediated WP1 code. [S]**
- *Evidence:* CR-WP1-002, 003 and 004 (High) and CP2 Medium findings remain open. Codex found no remediation commits after the tested source.
- *Impact:* application-level results from the cloud proof would not represent the design and could be misread as safety evidence.
- *Remediation:* split the synthetic proof (§7, Phase 3a/3b). The **platform containment proof** needs only a minimal purpose-built harness: a fake gateway, a fake provider ledger and pause/thaw control. It can run as soon as authorized, independent of WP1. The **application proof** waits for WP1 remediation and re-review.

### 3.3 Medium and Low

| ID | Sev | Finding | Remediation | Gate |
|---|---|---|---|---|
| M-1 | Medium | Secret Manager is costed as 100 versions (pilot) and 1,000 (growth), which implies per-tenant secrets. That scales poorly (about $0.06 per version-month; [Secret Manager pricing](https://cloud.google.com/secret-manager/pricing)) and widens who can read what. | Store per-tenant OAuth tokens **envelope-encrypted in PostgreSQL** under a KMS key that only the gateway service account can decrypt. Keep fewer than 10 platform secrets in Secret Manager (inside the 6-version free tier plus a few dollars). Backups then hold ciphertext, and a restored environment is inert unless KMS decrypt is granted. KMS denial does not invalidate plaintext already cached, so cache lifetime stays short. | S design |
| M-2 | Medium | The cost model omits permanent staging, LB/Cloud Armor, alerting charges (from 1 Sep 2027: $0.35 per metric reference per alerting policy; [Observability pricing](https://cloud.google.com/products/observability/pricing)), Artifact Analysis scanning and restore-drill environments. | See §5. Keep staging ephemeral. | P |
| M-3 | Medium | GCP budget alerts do not cap spend. A public `run.app` webhook with no maximum-instance setting turns a flood of requests into an unbounded bill. | Set `max-instances` on every service, cap Cloud SQL connections, add a budget alert that pages a person, and add an automated "disable dispatch + scale to floor" runbook. A cost stop must keep evidence. | S |
| M-4 | Medium | Mapping the 10 WP1 database roles to cloud identities is unspecified. | One service account per process role, Cloud SQL IAM database authentication (no passwords), fixed `search_path`, and no shared service accounts across ingress, sealer, worker and gateway. The migration role is used only by a manually approved job. | S |
| M-5 | Medium | Region and privacy. `us-central1` is fine for the synthetic proof. For real data, Meta processes WhatsApp content outside Mexico anyway, so hosting in Mexico (`northamerica-south1`, Querétaro) **does not create end-to-end residency**. The legal drivers are the privacy notice, encargado contracts or DPAs, ARCO handling and records of remisiones and transferencias. Worker-pool availability in `northamerica-south1` is unverified. | Owner and counsel decision before any real personal data. If Mexican hosting is chosen, reprice (Mexico rates are not on the pages I could extract) and verify service availability. Other LATAM countries (e.g. Brazil's LGPD, Colombia) need their own checks before onboarding businesses there. | P |
| M-6 | Medium | CI/CD guardrails need platform enforcement, not only GitHub settings. | Workload Identity Federation with attribute conditions pinned to repository, ref and environment. Org policies: `iam.disableServiceAccountKeyCreation`, `run.allowedVPCEgress=all-traffic`, `gcp.resourceLocations`, and ingress restrictions on internal services. Deploy only immutable image digests through manually approved environments. | S (basic), X (full) |
| M-7 | Medium | Shared-core Cloud SQL (`db-f1-micro` about $7.67/month, `db-g1-small` about $25.55) "are not covered by the Cloud SQL SLA" ([Cloud SQL pricing](https://cloud.google.com/sql/pricing)). | Use shared-core for the synthetic proof only. Use dedicated 1 vCPU / 3.75 GiB (about $49.30) or larger for the pilot. | X |
| L-1 | Low | Codex's NAT line ($37.42) uses the 32-VM price cap. Cloud NAT charges $0.0014 per hour per instance using the gateway, plus $0.005 per hour per IP and $0.045 per GiB processed ([Cloud NAT pricing](https://cloud.google.com/nat/pricing)). | If only the gateway uses NAT (1–2 instances), expect about $6–10/month. How Cloud Run Direct VPC instances are counted for NAT billing is **not documented on the NAT page**: confirm in the proof's billing export. | — |
| L-2 | Low | Cloud Logging has a 50 GiB per project per month free allotment ([Observability pricing](https://cloud.google.com/products/observability/pricing)). | The pilot log line is about $0 if logs stay redacted and lean. Watch metric cardinality instead. | — |

### 3.4 Blocking-issue summary

**Before the synthetic proof (any phase 3 resource):**
- C-1: ADR-005 and the handoff committed and delta-reviewed.
- C-2: one connection per attempt, per-epoch tags, fence by revision deletion, written into the ADR.
- H-3: sealer and ingress at minimum instances 1; no NAT except for the gateway.
- H-6: deploy and fence sequence written into the ADR.
- H-7: proof split into 3a/3b.
- M-1: KMS envelope design. M-3: max-instances. M-4: identity map.
- Explicit owner authorization naming the resources, duration, cap and cleanup owner.

**Before real provider staging:**
- Phase 3a passed and independently reviewed.
- H-1: deterministic Google IDs and `If-Match`. H-2: dual Meta credentials and measured revocation latency.
- H-4: numeric bound D measured, and the owner's G06 disposition recorded.
- H-5: custody design, named custodian, crypto-shred design.
- M-5: privacy notice and processor terms for any real person's data.
- WP1 CP1/CP2 closed.

**Before production:**
- All of the above, plus CP5 recovery and old-runtime drills, a staffed on-call owner, the full CI/CD controls, dedicated Cloud SQL, and the remaining WP1 production gates (005, 009–011, 013).

---

## 4. F13 / OPS01 containment assessment

### What can be guaranteed, and how

| Layer | Mechanism | What it guarantees | What it does not |
|---|---|---|---|
| SQL | Status, revision and epoch checked inside `enter_submission`; one-use attempt | No second **admission** after STOP or suspension commits; no duplicate attempt | Anything already admitted (WP1 F13 counterexample) |
| Ticket | Short `notAfter` on the gateway clock; one-use `ticket_use`; epoch-bound | A thawed worker cannot get an old attempt sent | A gateway paused after its final recheck |
| Gateway recheck | Re-reads status, revision and epoch just before send | Narrows the window to verify-to-write time (milliseconds) | Freeze or GC pause after the recheck; bytes already written |
| Connection discipline | New TCP/TLS connection per attempt | Every send passes the **current** firewall and NAT state | An attempt whose connection opened before the fence |
| Network | Per-epoch tag allow rule plus Cloud NAT only for the gateway subnet or tag | Old epochs cannot open **new** connections once the rule is removed (verify propagation time) | Existing connections (documented); IPv6 or alternate routes not yet tested |
| Revision deletion | Old revision deleted; instances verified gone | No old process exists | The time between issuing the delete and the instances ending, which must be measured |
| Credentials | Meta A/B epoch tokens revoked; Google access tokens cached briefly | Bounds Meta exposure by revocation latency (unknown until measured) | Google cannot be revoked per epoch (H-1) |
| Provider preconditions | Google deterministic IDs and `If-Match` | Late Google creates and moves become `409`/`412`, not effects | Meta has no equivalent (unverified) |

**Honest statement for ADR-005:** after a completed fence, no new provider request originates from an older epoch, if T-1 to T-6 pass. Requests whose first byte left before the fence can still arrive, bounded by D, and anything already accepted cannot be recalled. Uncertain attempts stay UNKNOWN and are never retried automatically. **No exactly-once or zero-late-send claim.**

### Adversarial tests required

All tests use fake Meta and Google endpoints. These are synthetic HTTP servers reached **through the same NAT and firewall path a real provider would use**, for example on a separate project's external IP, recording arrival time, source IP, epoch header and attempt ID. Each test reports provider-ledger counts and timings. Run T-1 to T-8 in Phase 3a; T-9 to T-12 need the application (Phase 3b); T-13 needs sandbox provider accounts (Phase 4).

| # | Test | Pass criterion |
|---|---|---|
| T-1 | From ingress, sealer and worker identities, try TCP and HTTPS to the fake providers, to public IPs, over IPv6, via DNS-over-HTTPS hosts and through the metadata server | 0 connections; no provider secret in environment, filesystem, logs or a memory dump |
| T-2 | **Established-connection test:** the gateway opens a keep-alive connection, then the epoch-N allow rule is deleted, then the gateway sends on the existing connection | Shows the documented behaviour (expected: the send succeeds). Proves why C-2's one-connection rule exists. |
| T-3 | One-connection discipline: same as T-2 with the production gateway client | The send after the fence fails at connect; ledger shows 0 |
| T-4 | Pause the gateway (SIGSTOP on the sending child) after its final recheck, then fence epoch N, then resume. At least 1,000 runs at randomized pause points | 0 new connections after fence completion; max observed D published; any arrival after the fence comes only from a connection whose SYN preceded the fence |
| T-5 | Fence timing: time from deleting the rule to the first refused connect, and from deleting the revision to the last instance gone | Measured, with a worst case; feeds D |
| T-6 | Rollout overlap: deploy N+1 while N is mid-send; call N's tag URL after the fence | N's tag URL is unreachable or rejected; tickets carry epoch < current and are refused |
| T-7 | Gateway loses PostgreSQL, KMS or the sealer | Refuses; 0 ledger entries; attempt stays PREPARED or UNKNOWN as specified |
| T-8 | Cold start: scale to zero (test only), then first webhook | Time from cold start to seal measured against the ACK budget; no false ACK during the outage |
| T-9 | Worker freeze past `notAfter`, then suspend, then thaw | Gateway refuses; ledger 0 |
| T-10 | Replay a consumed ticket; two workers race the same attempt | One effect at most; second refused |
| T-11 | Fake Google: late create with the same ID; late move with a stale ETag | `409` or `412` recorded as evidence; no state regression |
| T-12 | Lost response: fake provider accepts, then drops the connection | Attempt UNKNOWN, stream blocked, no retry, reconciliation read only |
| T-13 | (Staging only) Meta token revocation and Google refresh-token revocation latency | Worst case over at least 20 trials recorded; Meta A/B swap never interrupts the current epoch |

---

## 5. Independent cost assessment

### Verified rates (checked 2026-11-01)

| Item | Rate | Source |
|---|---|---|
| Worker pool | $0.000011244/vCPU-s; $0.000001235/GiB-s; free 384,204 vCPU-s and 728,744 GiB-s per month | [Cloud Run pricing](https://cloud.google.com/run/pricing) |
| Request-billed service | Active CPU $0.000024/vCPU-s; idle min-instance $0.0000025/vCPU-s and $0.0000025/GiB-s; $0.40 per million requests | same |
| Instance-billed service | $0.000018/vCPU-s; $0.000002/GiB-s | same |
| Cloud SQL Enterprise, Iowa | $0.0413/vCPU-h; $0.007/GiB-h; SSD about $0.17/GiB-month; backups about $0.08/GiB-month; HA doubles compute and storage; `db-f1-micro` $0.0105/h; `db-g1-small` $0.035/h (no SLA) | [Cloud SQL pricing](https://cloud.google.com/sql/pricing) |
| Cloud NAT | $0.0014/h per instance (cap $0.044/h); $0.005/h per IP; $0.045/GiB | [Cloud NAT pricing](https://cloud.google.com/nat/pricing) |
| Secret Manager | about $0.06 per version-month (6 free); $0.03 per 10,000 accesses (10,000 free) | [Secret Manager pricing](https://cloud.google.com/secret-manager/pricing) |
| Logging and Monitoring | Logs $0.50/GiB, first 50 GiB per project free; alerting $0.35 per metric reference **from 1 Sep 2027** | [Observability pricing](https://cloud.google.com/products/observability/pricing) |
| Render | Pro workspace $25; 0.5 CPU instance $7; 1 CPU / 2 GB $25; PG 0.5c-1g $19; PG storage $0.30/GB; Pro PITR 7 days; 25 GB bandwidth then $0.15/GB | [Render pricing](https://render.com/pricing) |

I could not reach the official KMS, GCS or Artifact Registry pages in this session. For those lines I accept Codex's figures (small amounts) and mark them **unverified**.

### Revised pilot estimate (one production-shaped environment, single zone, us-central1)

Codex's assumptions apply: 25 businesses, about 100,000 webhook and 100,000 gateway requests a month, 730 hours.

| Line | Codex | This review | Note |
|---|---:|---:|---|
| Ingress + gateway, min 1, request-billed | 24.09 | 24 | Agree |
| Sealer | 0.67 | 9–10 | H-3: min 1 |
| Worker pool, 1 × 1 vCPU / 1 GiB | 32.79 | 27.60 | Free tier applied (billing-account-wide; assumes no other use) |
| Cloud SQL, 1 vCPU / 3.75 GiB | 49.31 | 49.31 | Verified |
| SSD 20 GB + backups 30 GiB | 5.80 | 5.80 | Verified |
| Archive and KMS (unverified pages) | 7.66 | 7.66 | Accept |
| Secret Manager | 6.30 | about 0.30 | M-1 envelope design |
| Logs and telemetry | 7.50 | about 3 | Free allotment; metric cardinality is the risk |
| Build and images | 1.10 | 1.10 | Accept |
| NAT, IP and internet egress | 37.42 | about 8 | L-1; confirm instance counting |
| Transfer reserve | 2.00 | 2.00 | Accept |
| **Subtotal** | **174.65** | **about 145–150** | |
| 25% contingency | 218.31 | about 185 | |

### Sensitivity (monthly, before contingency)

| Scenario | Estimate | Fits $250? |
|---|---:|---|
| Pilot as above | about $150 | Yes |
| Plus permanently running staging at the same shape | about $295 | **No.** Keep staging ephemeral, or shared-core with min 0 (about $40–60) |
| Plus Cloud SQL regional HA (1 vCPU / 3.75 GiB) | +$56 | Tight, about $205; and HA needs new containment proof |
| Plus external HTTPS LB and Cloud Armor for the webhook | +$20–30 (Codex excluded this; unverified here) | Yes, barely with HA |
| Plus alerting charges from Sep 2027, about 30 metric references | +$10.50 | Yes |
| Growth (250 businesses) per Codex | about $490 | No. Expected; growth should be funded by revenue |
| Synthetic proof, 72 h (shared-core SQL, 1 worker, 3 small services, NAT, fake-provider host) | **about $10–25** | Well inside the proposed $75 cap; the real risk is forgotten teardown |

**Conclusion:** the US$250/month planning target is **realistic for one production-shaped pilot environment plus custody**. It is not realistic for production plus a permanent twin staging environment, or for production with HA, LB and WAF all at once. It excludes Meta conversation charges, Google API quota (normally free at pilot volumes, to verify), labour, on-call, legal and privacy counsel, tax and FX. **Budget alerts are not caps** ([GCP budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets)).

---

## 6. GCP versus Render

**Recommendation: GCP.** The deciding factor is not that GCP has an egress firewall; C-2 shows that alone is insufficient. It is that GCP provides together:

1. Per-revision service accounts and network tags, enabling epoch-scoped identity.
2. IAM-gated KMS decryption, enabling inert restores and gateway-only token access.
3. Cloud SQL IAM database authentication, per process role.
4. Revision deletion and org-policy guardrails.
5. Custody (GCS with retention, KMS) under the same IAM model, with a separate project.

Render's documented features give no per-service outbound deny or old-instance containment contract ([Render private network](https://render.com/docs/private-network), [outbound IPs](https://render.com/docs/outbound-ip-addresses)). Its deploys deliberately overlap old and new instances ([Render deploys](https://render.com/docs/deploys)). A Render deployment would still need GCP (or similar) for custody and sealing. That cross-cloud design erases most of Render's roughly $40/month advantage and adds a cross-cloud PostgreSQL exposure.

Render would win only if the owner decided operational simplicity outweighs F13 containment for a supervised pilot. That would be a G06-level decision, which I do not recommend.

---

## 7. Recommended architecture changes and simplifications

**Changes**
1. One connection per provider attempt, per-epoch gateway network tag and credential, fence by revision deletion (C-2, H-6).
2. Deterministic Google event IDs plus `If-Match`; Meta A/B system-user credentials (H-1, H-2).
3. Sealer and ingress at minimum 1; no internet route for anything except the gateway (H-3).
4. A numeric containment bound D in the ADR (H-4).
5. Per-tenant tokens KMS-envelope-encrypted in PostgreSQL; KMS decrypt granted only to the gateway service account (M-1).
6. Evidence with opaque IDs and crypto-shred keys; Bucket Lock only after that design exists (H-5).
7. `max-instances` everywhere; one service account per role; IAM database authentication; org policies (M-3, M-4, M-6).

**Simplifications**
- **No separate GCP organization** at pilot stage. Use a separate custody project and folder with a separate admin principal, and state the single-owner residual.
- **No NAT** except for the gateway. No static egress IP unless a provider requires allowlisting (none known).
- **No second worker, no CREMA or KEDA autoscaler, no Cloud Scheduler or Jobs for dispatch.** One worker-pool instance polling PostgreSQL.
- **No LB or Cloud Armor** until abuse or a WAF need is observed; app-level limits plus `max-instances` first.
- Secret Manager for fewer than 10 platform secrets only.

**Revised phase plan**

| Phase | Change from the brief |
|---|---|
| 0 (new) | Commit ADR-005 and the handoff; dispose of the WP1 findings |
| 1. Architecture and documentation review | Delta review of the committed ADR-005 against this report |
| 2. Repository compatibility (Codex) | Include connection-pool discipline, epoch header, KMS envelope, deterministic Google IDs |
| **3a. Platform containment proof (new)** | Minimal harness only, independent of WP1 code: T-1 to T-8, cold starts, deploy and fence sequence, billing export. **Run this first: if it fails, the architecture changes.** |
| 3b. Synthetic application proof | After WP1 CP1/CP2 re-review: T-9 to T-12, seal and ACK, tenant roles, restart, inert restore |
| 4. Controlled provider staging | Credentials and revocation (T-13) **before** any message or calendar write; sandbox assets only |
| 5. Security and recovery drills | Unchanged; must include the epoch fence during restore |
| 6. Production approval | Unchanged |

---

## 8. Outstanding owner decisions

1. **Commit ADR-005 and the handoff** (C-1).
2. **Whether the measured late-arrival bound D is acceptable under G06** once measured (H-4). Today it is unknown.
3. **Custody model:** separate project plus a separate admin principal (recommended) or a separate organization or provider. Who is the custodian? Accept the single-owner residual explicitly.
4. **Region for real data:** `us-central1` or `northamerica-south1`, after privacy counsel. Mexican hosting does not create end-to-end residency, because Meta is in the path.
5. **Retention:** PITR days (1–7), evidence retention window, log retention, crypto-shred policy for ARCO cancellation.
6. **Staging posture:** ephemeral (recommended) or permanent. This decides whether $250 holds.
7. **Operators:** primary and backup operator, security reviewer, billing owner, support hours.
8. **Meta assets:** Business portfolio, app and system-user ownership (A/B credentials), payer. **Google:** OAuth client ownership, scopes, verification.
9. **Phase 3a authorization:** exact resource inventory, ≤72 h, cap (I suggest $50 rather than $75, given my estimate), teardown owner, a fresh isolated project deleted at the end.

---

## 9. Acceptance criteria for the first synthetic cloud experiment (Phase 3a, then 3b)

**Pre-conditions:** owner authorization naming project ID, region, resources, duration (72 h or less), cap and cleanup owner; ADR-005 committed with the C-2/H-3/H-6 changes; no real Meta or Google credentials or data anywhere; v0.8.1 and WP1 branches untouched.

| # | Criterion |
|---|---|
| A-1 | New, dedicated project with billing export on; budget alerts at 50/80/100% of the cap; `max-instances` on every service; org or project policies blocking service-account key creation |
| A-2 | Inventory matches the authorization exactly: Cloud SQL shared-core; worker pool ×1; ingress, sealer and gateway services; NAT only for the gateway tag; a fake-provider host in a **separate** project; a custody bucket and KMS key in a separate project |
| A-3 | Only generated synthetic keys and fixture tenants. Secret Manager holds no real credential. A secret scan of images and logs finds 0. |
| A-4 | T-1 to T-8 pass (3a). Results include ledger counts, the measured fence timings (T-5) and the D distribution (T-4). |
| A-5 | Deploy and fence sequence (H-6) executed twice, including one rollback. 0 sends from fenced epochs. |
| A-6 | Cold start to first seal measured; no ACK before a seal; dependency outages return a retryable failure. |
| A-7 | (3b, after WP1 re-review) T-9 to T-12 pass. Tenant-role hostile cross-tenant tests pass. Due work survives worker kill and restart without duplicates. Inert restore into a new instance has no KMS decrypt and no dispatch. |
| A-8 | Logs contain no phone numbers, names, payloads or tokens (sampled audit). |
| A-9 | Actual cost from the billing export reported against the estimate. |
| A-10 | **Teardown:** project shut down; billing export and evidence archived to the repo or custody first; confirmation that there are no remaining billable resources (the billing report 48 h later shows $0 accrual). |
| A-11 | Results independently reviewed. Any failure means stop, keep the evidence, and do not tune the test to pass. |

---

## 10. Final recommendation and next steps

**Verdict:** **GO WITH REVISIONS** on the GCP architecture direction. **ADR-005 not reviewed** (unavailable). **NO-GO** on any deployment until the blockers in §3.4 close and the owner authorizes Phase 3a. **Not yet ready for the next planning gate:** it becomes ready when ADR-005 is committed with the revisions and passes a delta review.

**For ChatGPT (ADR author):**
1. Commit ADR-005 and the handoff as documentation only.
2. Revise per C-2, H-1 to H-6 and M-1, M-3, M-4.
3. Add the containment statement with bound D (§4) and the deploy and fence sequence.
4. Replace the cost table with the §5 revision, including the sensitivity table, staging posture and the 2027 alerting change.
5. Add the 3a/3b phase split and the A-1 to A-11 criteria.
6. Request a Claude delta review.

**For Codex:**
1. Repository compatibility assessment against the revised ADR:
   - provider HTTP client without pooling or keep-alive;
   - epoch in ticket and envelope;
   - deterministic Google event IDs and `If-Match`;
   - KMS-envelope token storage;
   - one service account per role with IAM database authentication mapping onto `roles.sql`.
2. Draft the **Phase 3a harness design** (fake gateway, fake-provider ledger, pause/thaw driver, fence script) as documentation; no resources.
3. Separately, continue WP1 CP1/CP2 remediation (CR-WP1-002/003/004/006/007/008/012) under its existing charter, so Phase 3b can follow.

**Immediate next step:** commit ADR-005 and its handoff to the repository (docs only) so the delta review and Codex's compatibility assessment have a fixed text to work from. Nothing should be provisioned before that.

---

### Sources

- [Issue #5](https://github.com/vanasperena-ux/nukmiris/issues/5) and comments [6568448125](https://github.com/vanasperena-ux/nukmiris/issues/5#issuecomment-6568448125), [6568467086](https://github.com/vanasperena-ux/nukmiris/issues/5#issuecomment-6568467086), [6568546233](https://github.com/vanasperena-ux/nukmiris/issues/5#issuecomment-6568546233)
- [GCP VPC firewall rules](https://docs.cloud.google.com/vpc/docs/firewalls): stateful tracking; changes apply only to new connections
- [Cloud Run Direct VPC egress](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc): per-revision tags, limitations, start-up delays
- [Cloud Run worker-pool instance splits](https://docs.cloud.google.com/run/docs/managing/workerpool-instance-splits-rollbacks)
- [Cloud Run pricing](https://cloud.google.com/run/pricing); [Cloud SQL pricing](https://cloud.google.com/sql/pricing); [Cloud NAT pricing](https://cloud.google.com/nat/pricing); [Secret Manager pricing](https://cloud.google.com/secret-manager/pricing); [Observability pricing](https://cloud.google.com/products/observability/pricing)
- [GCS Bucket Lock](https://docs.cloud.google.com/storage/docs/bucket-lock)
- [Google Calendar API errors](https://developers.google.com/workspace/calendar/api/guides/errors) (`409 duplicate`, `412 conditionNotMet`)
- [Render pricing](https://render.com/pricing); [Render private network](https://render.com/docs/private-network); [Render outbound IPs](https://render.com/docs/outbound-ip-addresses); [Render deploys](https://render.com/docs/deploys)
- [Hogan Lovells on Mexico's 2025 LFPDPPP](https://www.hoganlovells.com/es/publications/mexicos-new-federal-data-protection-law-what-it-means-for-companies) (secondary source; statute at [diputados.gob.mx](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf))

*Not legal advice. Infrastructure location does not by itself establish privacy compliance.*
