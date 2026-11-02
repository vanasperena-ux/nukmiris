# CLAUDE-ADR-005-INDEPENDENT-REVIEW — NukMiris vNext GCP reference architecture

**Reviewer:** Claude, independent architecture and security challenger
**Date:** 2026-11-02 (America/Mexico_City)
**Mode:** paper review only. No resources, provider calls, code changes, merges, v0.8.1/WP1 changes or WP2 authorization.

## Exact versions reviewed

| Document | Repository copy (verbatim) | SHA-256 |
|---|---|---|
| ADR-005, NukMiris vNext Google Cloud reference architecture (PROPOSED, 2026-11-01, 208 lines) | `docs/greenfield/12-ADR-005-GCP-CLOUD-ARCHITECTURE.md` | `dc691dceedc80b27e5443cc74c1997457d22da57ec974863309605ce81bf381d` |
| Independent review handoff (66 lines) | `docs/greenfield/12a-ADR-005-CLAUDE-REVIEW-HANDOFF.md` | `486f459d03956950ceec0e267c63c99d84777d5b16c0431a8ee141b4974cc679` |

The owner supplied both files on 2026-11-02. I committed them unchanged so this review points at a fixed text. Their status stays **PROPOSED / REVIEW REQUEST DRAFT**; committing them approves nothing. Citations below use the form `ADR:L87`, meaning line 87 of the file above.

**Other inputs:**
- Issue #5 and comments 6568448125 (Codex), 6568467086 (ChatGPT) and 6568546233 (owner).
- WP0 docs 02, 03, 06 and 07 at `e305bab`.
- WP1 docs 08, 10, `F13-RESIDUAL-LATE-SUBMISSION.json` and `01-CLAUDE-WP1-CP1-CP2-REVIEW.md` at `e0b470d`.
- My pre-ADR review, `02-CLAUDE-GCP-ADR005-ARCHITECTURE-REVIEW.md`, written from Issue #5 only. This document supersedes it wherever they differ.
- Official provider documentation, cited inline.

Nothing was tested. Every safety property is **NOT VERIFIED** until the Phase 3a/3b experiments run.

---

## 1. Executive recommendation

**GO WITH CONDITIONS — for proceeding to a *bounded synthetic proof design*.**
This is not a production GO, not a GO to provision, and not a GO for real providers.

ADR-005 is a careful, honest document. It:
- labels GCP a hypothesis, not proof (`ADR:L14`);
- keeps F13/OPS01 as a hard unresolved gate (`ADR:L83-89`);
- already warns that L3/L4 firewalls are not hostname allowlists and that existing connections must be validated (`ADR:L87`);
- refuses exactly-once, zero-loss and failover claims (`ADR:L16`);
- requires inert, permissions-first restore (`ADR:L120-122`);
- keeps M2/M5 and WP2 out of scope (`ADR:L16`, `L69`).

I would not change the stack.

The conditions exist because several of the ADR's "validate later" items have **already been answered by GCP's own documentation, and the answers change the design**:

1. GCP firewall changes affect **only new connections**. Established connections persist ([VPC firewall rules](https://docs.cloud.google.com/vpc/docs/firewalls)). The fence therefore needs a connection discipline and a verified instance-termination step.
2. Direct VPC egress has **no firewall-rule logging**, and Flow Logs omit the revision name ([Direct VPC](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc)). The alert on "attempted denied egress" (`ADR:L168`) cannot be built the way the ADR implies.
3. **Private Google Access** gives *every* VPC identity a network path to Google APIs, which includes Calendar. Google-side containment for non-gateway identities therefore rests on credential custody (KMS IAM), not on the network.
4. **Revoking a Google OAuth grant destroys the business's consent.** It cannot serve as a per-deployment fence. Google does offer provider-side preconditions (deterministic event IDs → `409 duplicate`; `If-Match` → `412 conditionNotMet`; [Calendar errors](https://developers.google.com/workspace/calendar/api/guides/errors)), and the ADR does not use them.
5. A sealer implemented as a **Cloud Run job** (`ADR:L73`) cannot sit in the seal-before-ACK path.

**Stop/go status** (handoff mandatory criteria):

| Gate | Status |
|---|---|
| Real-provider activation | **NO-GO.** F13/OPS01 is not demonstrated, and WP1 High findings CR-WP1-002, 003 and 004 are not remediated. |
| Proof provisioning | **NO-GO** until the owner authorizes an exact project, region, SKUs, duration, cap and teardown owner, after the proof plan (§6) has been independently reviewed. |
| Proof design | **GO**, once redlines RL-1 to RL-9 (§4) are applied to ADR-005. |

---

## 2. Findings register

**Severity:**
- **BLOCKER** prevents approval of the synthetic proof *design*.
- **HIGH** must be fixed at the gate named.
- **MEDIUM** and **LOW** are improvements or disclosures.

**Gates:** **D** = proof design approval; **S** = synthetic proof execution; **P** = real-provider staging; **X** = production.

| ID | Sev | Evidence | Failure scenario | Exact correction | Accountable | Verification test | Gate |
|---|---|---|---|---|---|---|---|
| A5-01 | BLOCKER | `ADR:L87` (existing connections listed as "validate"); [firewall docs](https://docs.cloud.google.com/vpc/docs/firewalls): changes apply "only on new connections. Existing connections persist" | A stale epoch-N gateway still holds a pooled keep-alive/HTTP2 connection to the provider after its allow rule is removed, and keeps sending | Add to §4.1: (a) the gateway opens **one new connection per provider attempt, after** its final authority check, with no pooling, keep-alive or HTTP/2 session reuse; (b) the fence is complete only when the old revision is **deleted and its instances verified terminated**; (c) state the containment claim in two parts (see A5-04) | ChatGPT (ADR); Codex (client design) | T-02, T-03, T-05 | D |
| A5-02 | BLOCKER | `ADR:L168` ("attempted denied egress" alert); [Direct VPC limitations](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc): firewall-rule logging unsupported, Flow Logs lack revision name, IPs ephemeral | The ADR promises an alert that has no log source. The proof would then report "no alerts" as if it were evidence of no attempts | Replace with: gateway-side connect-attempt and connect-failure counters per epoch; fake-provider ledger arrivals labelled by source IP/epoch header; heartbeats from every instance carrying epoch and revision. Firewall logs are not evidence on this path | ChatGPT | T-01, T-05 (ledger and heartbeat reconcile) | D |
| A5-03 | BLOCKER | `ADR:L73` (sealer as "Cloud Run service/job candidate"); `ADR:L109`, `L115` (seal-before-ACK, p95 ≤ 2 s); Direct VPC warns of "connection establishment delays of a minute or more on instance startup" | A job execution, or a min-0 sealer with a cold Direct VPC start, holds the webhook. Meta redelivers, the ACK SLO fails, and admission evidence is skewed | The sealer is a **Cloud Run service with min instances 1**, request-billed, in its own identity. No job or scheduled mode in the ACK path. Ingress and sealer have **no NAT/internet route** | ChatGPT | T-08 (cold start to first seal), burst test | D |
| A5-04 | HIGH | `ADR:L89` ("distinguish physical submission timing from delivery timing"); WP0 03 L102; F13 counterexample | Without a numeric, measurable claim, the owner cannot make the G06 disposition, and "passed" has no definition | Add the containment statement: **(i)** after fence F completes at T (old revision deleted, instances confirmed gone), no connection originates from epochs < N; **(ii)** a request whose connection opened before T may arrive later. Its bound is the gateway hard deadline plus network tail if the process runs, and fence-to-termination time if it is frozen. Measure D and record the owner's G06 decision on it. This does not reopen G06 (WP0 03 L102 already says no blanket physical guarantee is claimed) | ChatGPT; owner | T-04, T-05 | D (statement), P (measured) |
| A5-05 | HIGH | `ADR:L101` ("refresh/revocation lifecycle"); Google OAuth revocation semantics; [Calendar errors](https://developers.google.com/workspace/calendar/api/guides/errors) | Fencing by revoking a tenant grant loses that tenant's consent, so it is unusable. A late Google create or move from a stale gateway is applied silently | Add to §4.3: per-tenant Google grants are **never** a fence. Every create uses a **deterministic event ID** derived from the original attempt identity; every move or cancel sends **`If-Match`** with the ETag observed at preparation. `409`/`412` are recorded as evidence, never retried. Access tokens are cached ≤ 5 min in gateway memory only. Behaviour when re-inserting the ID of a deleted or cancelled event is **NOT VERIFIED** and is a staging test | ChatGPT; Codex | T-11; staging S-03 | D (design), P |
| A5-06 | HIGH | `ADR:L100`, `L72` | One Meta system-user token shared across epochs cannot be revoked to fence an old gateway without stopping the new one | **Two Meta system-user credentials (A/B), alternating per deployment epoch.** Fencing epoch N revokes N's token. Only the gateway identity can read either. Revocation-to-refusal latency is measured in staging (≥ 20 trials, worst case recorded). I found no idempotency or conditional-send mechanism in the WhatsApp Cloud API (**NOT VERIFIED**, not proven absent) | ChatGPT; owner (Meta assets) | Staging S-02 | P |
| A5-07 | HIGH | Direct VPC `all-traffic` routes Google API traffic via the VPC; Private Google Access serves Google APIs privately | A worker or ingress identity can reach `www.googleapis.com` (Calendar) without NAT. Network policy alone does not keep Calendar away from non-gateway identities | State in §4.1 that Google API containment for non-gateway identities rests on **credential custody**: per-tenant OAuth tokens are KMS-envelope-encrypted in PostgreSQL, and only the gateway SA holds `cloudkms.cryptoKeyVersions.useToDecrypt`. Per-epoch firewall **deny-all** (higher priority) on the old gateway tag covers the Google API VIP too | ChatGPT; Codex | T-01b, T-12 | D |
| A5-08 | HIGH | `ADR:L79`, `L164`; [worker-pool splits](https://docs.cloud.google.com/run/docs/managing/workerpool-instance-splits-rollbacks): "Instance allocation adjustments are not instantaneous"; service traffic tags | Old worker and gateway revisions overlap new ones. An old gateway revision stays invokable through a tag URL even at 0% traffic, because invoker IAM is per service | Add a **fixed deploy/fence sequence** to §9: (1) deploy the new gateway `--no-traffic`, untagged, with the epoch N+1 network tag and credential; (2) bump the epoch in SQL, so the gateway refuses tickets with epoch < current; (3) fence N with a deny-all rule on N's tag, revoke Meta credential N, **delete revision N**; (4) confirm N's heartbeats stop and the instance metric shows 0; (5) classify in-flight attempts UNKNOWN; (6) enable N+1 dispatch. Rollback uses the same sequence. The "independent kill authority" (`ADR:L72`) is a named custom IAM role, held outside the CI deployer, allowed to delete revisions and edit firewall rules | ChatGPT; owner (role holder) | T-06 | D |
| A5-09 | HIGH | `ADR:L174-178` (WP1 disposition precedes the synthetic proof); WP1 review §12 | Either the platform-containment proof waits on unrelated WP1 SQL fixes, or it runs on unremediated code and its application results are misread as safety evidence | Split the synthetic proof. **3a, platform containment**: a minimal harness (fake gateway, fake-provider ledger, pause/thaw driver, fence script), with no WP1 code; it may run once authorized. **3b, application proof**: after WP1 CP1/CP2 remediation and re-review. Run 3a first, because a 3a failure changes the architecture | ChatGPT; owner | §6 | D |
| A5-10 | HIGH | `ADR:L74`, `L119`, `L185`; [Bucket Lock](https://docs.cloud.google.com/storage/docs/bucket-lock) is irreversible; LFPDPPP 2025 keeps ARCO cancellation | (a) With one human admin, "separate administrator" defends against compromised CI/runtime/deployer identities, not against the owner's account. (b) A locked bucket holding raw PII cannot honour a valid cancellation | §6/§7: name the threat model explicitly. Use a separate custody **project/folder** (no separate organization needed) with a distinct admin principal, a hardware key, and no shared roles. Production identities get only `storage.objectCreator` on the custody bucket. Evidence carries opaque IDs and digests, plus payloads encrypted with **per-tenant (or per-subject) KMS keys**, so erasure means key destruction after the recovery window. Do not lock retention until this crypto-shred design is reviewed | ChatGPT; owner; counsel | Drill R-04 | P (design), X |
| A5-11 | HIGH | `ADR:L119-121`; Cloud SQL automated backups belong to the instance | An operator or deployer with `cloudsql.instances.delete` removes the instance together with its automated backups. The "independent" copy is then only the GCS export, if it exists | State that the **independent recovery copy is the scheduled export to the custody bucket**, not Cloud SQL automated backups. Whether automated backups survive instance deletion under current settings is **NOT VERIFIED**: verify, and assume they do not. Restrict `cloudsql.instances.delete` and `cloudsql.backupRuns.delete` to break-glass | ChatGPT; Codex | R-02 (restore from custody export only) | S |
| A5-12 | HIGH | Direct VPC egress settings `all-traffic` / `private-ranges-only` | A revision deployed with `private-ranges-only`, or with no VPC configured, reaches the internet over Cloud Run's default path and **bypasses every VPC firewall rule** | Enforce the org/project policy `run.allowedVPCEgress=all-traffic`. Verify that a revision **without** VPC config is rejected; if the policy does not reject it (**NOT VERIFIED**), add a CI admission check plus an audit-log alert on revision creation | ChatGPT; Codex | T-01c (deploy without VPC must fail) | S |
| A5-13 | MEDIUM | `ADR:L75`, `L143`; [Secret Manager pricing](https://cloud.google.com/secret-manager/pricing) about $0.06 per version-month | Per-tenant secrets scale cost and widen read access | Use Secret Manager only for fewer than 10 platform secrets. Per-tenant tokens are KMS-envelope-encrypted in SQL (see A5-07). This also makes restored databases inert by default (no decrypt IAM in restore projects). KMS denial does not invalidate plaintext already cached, hence the short cache | ChatGPT | T-12, R-03 | D |
| A5-14 | MEDIUM | `ADR:L133-153` | The cost table overweights NAT and Secret Manager and omits the sealer at min 1, permanent staging, and alerting charges from 2027 | Adopt the §5 cost revision and sensitivity table | ChatGPT | Billing export (A-09) | D |
| A5-15 | MEDIUM | `ADR:L70`, `L115` | Cloud Run autoscaling × per-instance pools can exhaust Cloud SQL connections during the 20 events/s burst | Set `max-instances` on every service and keep the sum of (max-instances × pool size) within `max_connections` minus a reserve. Set `max_connections` explicitly. IAM database authentication with one SA per process role mapped onto `roles.sql` | Codex | Burst test in 3b | S |
| A5-16 | MEDIUM | `ADR:L111`; my WP1 review CR-WP1-013 | SDK, HTTP-client or library retries silently repeat a send (for example a client library retrying a timed-out request) | Every provider client sets retries to zero explicitly, and this is unit-tested. Hard deadline enforced; timeout → UNKNOWN | Codex | T-13 | S |
| A5-17 | MEDIUM | `ADR:L110`, `L115` (reminders "always within approved window") | The ADR does not restate the approved reminder semantics: the 15-minute allowance, four-reminder schedule, no catch-up after expiry, suspension or reactivation (WP0 03 L104, F27) | Cite those semantics exactly in §5. A worker pool set to 0 instances by mistake stops reminders silently, so alert on due-lag **and** on worker heartbeat absence | ChatGPT | T-09; alert drill | S |
| A5-18 | MEDIUM | `ADR:L125-127` | Region/privacy: Meta processes WhatsApp content outside Mexico, so Mexican hosting cannot by itself create end-to-end residency. Worker-pool availability in `northamerica-south1` is NOT VERIFIED; Mexico pricing was not extractable | §7: the drivers are role mapping (business = responsable; NukMiris = encargado; GCP and possibly Meta = sub-encargados, **for counsel**), remisión contracts, privacy notice, ARCO and the transfer record. Hosting location is secondary. If Mexico is required, reprice and check availability first | Owner; counsel | — | P |
| A5-19 | MEDIUM | `ADR:L153` | A budget alert with no automated response is only a notification | Add the runbook: alert at 50/80/100% → page a person; at 100%, dispatch is set inert, services scale to their floor, and evidence is kept. `max-instances` bounds abuse cost on the public `run.app` endpoint | ChatGPT | A-01 | S |
| A5-20 | LOW | `ADR:L145` NAT $37.42 | NAT is priced at the 32-instance cap; with NAT on the gateway only, about $6–10 is expected ([NAT pricing](https://cloud.google.com/nat/pricing)). How Direct VPC instances are counted is NOT VERIFIED | Reprice from the proof's billing export | ChatGPT | A-09 | — |
| A5-21 | LOW | `ADR:L119` | PITR log storage billing is not stated on the Cloud SQL pricing page | Measure it in the proof's billing export | Codex | A-09 | — |

**Correction to my own earlier work:** WP1 review §4.3 proposed that suspension "revokes or rotates the tenant's provider credential". That holds for Meta only if credentials are per epoch (A5-06). For Google it is wrong: see A5-05. In review 02 (§4), I bounded the residual D by "deadline + network tail". A frozen gateway holding an already-open connection is bounded only by fence-to-termination time (A5-04).

---

## 3. Review matrix R01–R12

| Q | Result | Confidence | Summary |
|---|---|---|---|
| R01 Product/charter scope | **PASS** | High | M2/M5, WP2, real providers and billing are excluded (`ADR:L16`, `L69`, `L28`). The approved Google-overlap and Needs Attention behaviour is preserved (`ADR:L112`). The DST/IANA handling matches WP0 (`ADR:L113`). I found no conflict with the 37 journeys. |
| R02 F13/OPS01 | **CONDITION** | High that the gaps are real; containment itself **NOT VERIFIED** | The ADR correctly refuses to claim cutoff. The route table below shows which routes the network can enforce and which need identity, credential or provider controls. A5-01/02/04/07/08/12 must be redlined. |
| R03 Admission sealing | **CONDITION / NOT VERIFIED** | Medium | The ordering raw bytes → PREPARE → STAGED → independent seal → ELIGIBLE/ACK is right, and the ADR explicitly rejects caller digests (`ADR:L73`). Gaps: the sealer as a job (A5-03); the freshness witness mechanism is unspecified (`ADR:L74`). Proposal: a head object written with `ifGenerationMatch` by the sealer SA only, versioned with non-current retention, in the custody project. Per WP0 03 L55, it detects rollback but cannot prove completeness after the last checkpoint. WP1 CR-WP1-002 (sealed batch extension) and 009 (procedural seal boundary) are still open; cloud identities make the separation enforceable but do not fix the SQL. |
| R04 Database isolation | **CONDITION** | Medium | The role/FK model is sound in WP1 SQL. The ADR honestly treats a multi-tenant runtime as blast radius (`ADR:L94`). Needed: one SA per role with IAM database authentication, explicit connection budget (A5-15), and the migration role used only by a manually approved job. Cloud SQL is available in `us-central1`. |
| R05 Dispatch and reminders | **CONDITION** | Medium | Polling durable SQL due times avoids drift. Rollout overlap needs A5-08. Shutdown gives SIGTERM then kill; the window must be measured. Instance count 0 by misconfiguration needs a heartbeat alert (A5-17). Provider timeout → UNKNOWN with no resend (A5-16). Reminder semantics must be cited (A5-17). CR-WP1-003 (NULL time bypass) is open. |
| R06 Recovery | **CONDITION** | Medium | Inert, permissions-first restore and no safe-write RTO (`ADR:L120-122`) are right. Needed: independent copy = custody export (A5-11); KMS decrypt absent in the restore environment (A5-13); epoch bump on restore before any gateway attaches; missing-tail and missing-key drills; crypto-shred (A5-10). PITR log billing NOT VERIFIED (A5-21). CR-WP1-008 (restore loses post-snapshot suspension) is open. |
| R07 Provider identity | **CONDITION** | Medium | The posture is right (no "Try it out" tokens, per-business OAuth). Missing: per-epoch Meta credentials (A5-06), Google revocation semantics and preconditions (A5-05). Meta Tech Provider, payer, template and coexistence facts are **NOT VERIFIED**; they need owner test assets. The synthetic proof has no live accounts (`ADR:L160`). |
| R08 Privacy/regions | **CONDITION / NOT VERIFIED** | Medium | `ADR:L127` is careful and correct not to conclude anything. Add the role and remisión framing for counsel (A5-18). The 2025 LFPDPPP, its authority change and the processor obligations are summarised in [Hogan Lovells](https://www.hoganlovells.com/es/publications/mexicos-new-federal-data-protection-law-what-it-means-for-companies); not legal advice. Timezone semantics are independent of server location (`ADR:L113`). |
| R09 Cost | **CONDITION** | High for verified lines | Arithmetic reproduced: 24.09 + 32.79 + 55.11 + 0.67 + 7.66 + 6.30 + 7.50 + 1.10 + 37.42 + 2.00 = 174.64, which rounds to $174.65 as stated. Contingency $43.66 gives $218.31. Revised pilot is about $145–150 (§5). $250 holds for one environment, not with permanent twin staging or HA + LB/WAF. A ≤$75/72h proof is credible; I estimate $10–20 (§6). No hard cap exists; the ADR says so correctly (`ADR:L153`). |
| R10 CI/CD, monitoring, ops | **CONDITION** | Medium | WIF, pinned SHAs, `npm ci --ignore-scripts`, inert promotion and no auto-deploy (`ADR:L163-164`) are good. Needed: the kill-authority role (A5-08), egress policy enforcement (A5-12), a replacement for the denied-egress alert (A5-02), and named custodian/operators (`ADR:L170`). |
| R11 Alternatives | **PASS with simplifications** | High | Render is correctly kept conditional (`ADR:L14`). Its documented features give no per-service egress deny, and its deploys overlap old and new instances. Simplifications that keep every control: no separate GCP organization (project + distinct admin); NAT only for the gateway; no second worker, CREMA/KEDA or Scheduler for dispatch; no LB/Cloud Armor until needed; fewer than 10 Secret Manager secrets. The sealer and gateway stay as security boundaries, not optional services. |
| R12 Test authorization contract | **CONDITION** | High | No resources are provisioned at ADR stage (`ADR:L12`, `L176`). The proof contract lacks an exact inventory/SKU list, the 3a/3b split and quantified pass criteria. §6 supplies a proposal. |

### R02 detail: every late-submission route

| # | Route | Network-enforceable on GCP? | Control that actually closes it | Test |
|---|---|---|---|---|
| 1 | Worker paused after ticket issue, thawed later | No (not a network problem) | Ticket `notAfter` on the gateway clock; one-use `ticket_use`; epoch check | T-09 |
| 2 | Gateway paused after final check, **before connect** | Yes, with A5-01 discipline | Per-attempt connection opened after the check; deny-all on the old epoch tag | T-04 |
| 3 | Gateway paused after **connect**, before write | **No.** The established connection survives rule changes | **Instance termination** (delete revision, verify gone); Meta credential N revoked; Google `If-Match`/ID | T-04, T-05 |
| 4 | Pooled keep-alive/HTTP2 socket reused after fence | No | A5-01: no pooling | T-02, T-03 |
| 5 | Library/HTTP retries | No | Retries 0 in every client; tested | T-13 |
| 6 | Cached secrets in old gateway memory | Partly (via network) | Termination; Meta per-epoch revocation; Google token cache ≤ 5 min plus preconditions | T-05, S-02 |
| 7 | Secrets readable by non-gateway identities | n/a (IAM) | Secret Manager and KMS decrypt IAM on the gateway SA only | T-01, T-12 |
| 8 | Old revision reached through a traffic tag URL or instance split | No | Delete the revision; epoch refusal | T-06 |
| 9 | Revision deployed without VPC, or with `private-ranges-only` | Not by firewall: it bypasses the VPC | Org policy `run.allowedVPCEgress`; CI check; audit alert | T-01c |
| 10 | Private Google Access path to Calendar from any identity | Yes, through a deny on the Google API VIP for old tags; otherwise reachable | Credential custody (KMS); deny-all on the old epoch tag | T-01b |
| 11 | IPv6 egress | Avoidable | IPv4-only subnets; test | T-01 |
| 12 | DNS / DoH / alternate resolvers | DoH needs internet, which the firewall blocks for non-gateway identities | Firewall default deny | T-01 |
| 13 | Autoscaled extra gateway instances | n/a | Each ticket is consumed once; `max-instances` | T-10 |
| 14 | Restored DB with an old epoch or `dispatch_enabled` | n/a | Inert restore: no gateway attached, epoch bumped first, no KMS decrypt in the restore project | R-03 |
| 15 | GCP control plane unavailable at fence time (cannot delete revision or change rules) | No | Meta credential revocation (outside GCP); SQL epoch bump stops new tickets. Record the exposure window and hold | Tabletop TT-1 |
| 16 | Provider accepted before cutoff, delivers after | No | Cannot be recalled. Disclose. Never retry | T-12 |

---

## 4. ADR-005 redlines (proposed text changes; ChatGPT to apply)

- **RL-1 (§4.1, after L87):** "The gateway opens one new TCP/TLS connection per provider attempt, only after the final authority check; connection pooling, keep-alive and HTTP/2 session reuse are disabled for provider calls. Existing connections are not affected by firewall changes (GCP documented behaviour); a fence is complete only after the old revision is deleted and its instances are confirmed terminated by heartbeat absence and the instance-count metric."
- **RL-2 (§4.1, containment statement):** add the two-part claim from A5-04, and "D is measured in the synthetic proof and recorded with the owner's G06 disposition before provider staging."
- **RL-3 (§3 inventory, sealer row):** replace "service/job candidate" with "Cloud Run service, min instances 1, own SA and DB role; no job or scheduled execution in the ACK path; no internet route."
- **RL-4 (§4.3):** add A5-05 (Google: never a fence; deterministic IDs; `If-Match`; ≤ 5 min token cache) and A5-06 (Meta A/B per-epoch credentials; measured revocation).
- **RL-5 (§4.1):** add A5-07 (Private Google Access path; credential custody via KMS; deny-all on the old epoch tag including the Google API VIP) and A5-12 (enforce `run.allowedVPCEgress=all-traffic`; reject revisions without VPC).
- **RL-6 (§9):** insert the deploy/fence sequence from A5-08, and define the "independent kill authority" as a named IAM role outside the CI deployer.
- **RL-7 (§10, L168):** replace "attempted denied egress" with gateway connect/failure counters per epoch, fake-ledger reconciliation and instance heartbeats. Add a worker-heartbeat-absence alert.
- **RL-8 (§6 and §7):** custody export is the independent copy (A5-11); per-tenant KMS crypto-shred before any retention lock (A5-10); one-owner threat model stated plainly.
- **RL-9 (§11):** split the synthetic gate into **3a platform containment** (independent of WP1) and **3b application** (after WP1 re-review). Replace the cost table with §5 below.

---

## 5. Cost revision (rates checked 2026-11-01/02)

Verified rates:
- [Cloud Run](https://cloud.google.com/run/pricing): worker pool $0.000011244/vCPU-s and $0.000001235/GiB-s, with 384,204 vCPU-s and 728,744 GiB-s free; request-billed idle min-instance $0.0000025/vCPU-s and $0.0000025/GiB-s; $0.40 per million requests.
- [Cloud SQL](https://cloud.google.com/sql/pricing), Iowa: $0.0413/vCPU-h; $0.007/GiB-h; SSD about $0.17/GiB-month; backups about $0.08/GiB-month; `db-f1-micro` $0.0105/h; shared-core instances have no SLA.
- [Cloud NAT](https://cloud.google.com/nat/pricing): $0.0014 per instance-hour; $0.005 per IP-hour; $0.045/GiB.
- [Secret Manager](https://cloud.google.com/secret-manager/pricing): about $0.06 per version-month; 6 versions and 10,000 accesses free.
- [Observability](https://cloud.google.com/products/observability/pricing): logs $0.50/GiB after 50 GiB free per project; alerting $0.35 per metric reference from **1 Sep 2027**.

KMS, GCS and Artifact Registry are taken from Codex and are NOT VERIFIED (I could not reach those pages).

| Line (USD/month) | ADR | Revised | Reason |
|---|---:|---:|---|
| Ingress + gateway (min 1, request-billed) | 24.09 | 24.09 | — |
| Sealer | 0.67 | about 9.50 | A5-03: min 1 |
| Worker pool, 1 vCPU / 1 GiB | 32.79 | about 27.60 | Free tier applied (billing-account-wide) |
| Cloud SQL, 1 vCPU / 3.75 GiB + 20 GB SSD + 30 GiB backup | 55.11 | 55.11 | Verified |
| Archive + KMS | 7.66 | 7.66 | NOT VERIFIED |
| Secret Manager | 6.30 | about 0.30 | A5-13 |
| Logs and telemetry | 7.50 | about 3.00 | Free allotment |
| Build and images | 1.10 | 1.10 | — |
| NAT, network, egress | 37.42 | about 8.00 | A5-20 |
| Transfer reserve | 2.00 | 2.00 | — |
| **Subtotal** | **174.65** | **about 138** | |
| **+25% contingency** | **218.31** | **about 173** | |

**Sensitivity (before contingency):**

| Scenario | Monthly | Fits $250? |
|---|---:|---|
| Pilot as revised | about $138 | Yes |
| + permanent twin staging | about $276 | **No** (ephemeral staging recommended) |
| + Cloud SQL HA at the same shape (compute and SSD doubled) | +about $53 | Yes alone (about $191); tight with LB/WAF |
| + LB / Cloud Armor (NOT VERIFIED) | +$20–30 | Yes alone |
| + alerting from Sep 2027 (about 30 metric references) | +$10.50 | Yes |
| Instance-billed worker fallback | +about $20 | Yes |

**Excluded:** Meta conversation charges, labour/on-call, legal and privacy counsel, tax and FX, domains. **Budget alerts are not caps.**

---

## 6. Minimum viable synthetic proof runbook (proposal; not authorized)

### 6.1 Inventory (Phase 3a, at most 72 h, `us-central1`)

| Project | Resource | SKU / shape | 72 h estimate |
|---|---|---|---:|
| `nm-proof3a-run` | Cloud SQL PostgreSQL 17 (epoch/ticket tables only) | `db-f1-micro`, 10 GB SSD, PITR on | about $1.00 |
| | Cloud Run harness gateway (2 revisions over time) | 1 vCPU / 0.5 GiB, min 1, max 2, Direct VPC `all-traffic`, epoch tag | about $1.00 |
| | Cloud Run stub ingress and sealer | 1 vCPU / 0.5 GiB, min 1, max 2, no NAT | about $2.00 |
| | Worker pool | 1 instance, 1 vCPU / 1 GiB | about $0 (free tier) to $3.30 |
| | VPC + subnet (IPv4 only), firewall rules, Cloud NAT on the gateway subnet only | 1 NAT IP | about $0.70 |
| | Artifact Registry | < 2 GiB | < $0.50 |
| `nm-proof3a-custody` | GCS bucket (versioned, **no** retention lock), KMS keyring with 1 key | — | < $1.00 |
| `nm-proof3a-fakeprov` | Fake-provider host with static external IP, recording ledger; TLS cert pinned by harness | smallest VM (price NOT VERIFIED) + 1 static IP | about $1–2 |
| **Total** | | | **about $8–12** |

Suggested authorization cap **$50**, with alerts at $10, $25 and $40. Billing export to BigQuery is on (small extra cost).

### 6.2 Phase 3a tests (no WP1 code, no real credentials)

| Test | Procedure | Quantified pass criterion |
|---|---|---|
| T-01 | From ingress, sealer and worker SAs: TCP/HTTPS to the fake-provider IP and arbitrary public IPs, IPv6, DoH | 0 successful connections; no provider secret readable (IAM denial recorded) |
| T-01b | From the worker SA: HTTPS to `www.googleapis.com/calendar/...` | Network reachability **documented** (expected reachable); request rejected for lack of credential. Proves A5-07 |
| T-01c | Attempt to deploy a revision with no VPC and with `private-ranges-only` | Both rejected by policy or the CI check |
| T-02 | Gateway opens a keep-alive connection; the epoch-N allow rule is removed; the gateway writes on the same connection | Records the documented behaviour (expected: delivered). Shows why RL-1 exists |
| T-03 | Same as T-02 with the per-attempt client | Next attempt fails at connect; 0 ledger arrivals |
| T-04 | ≥ 1,000 randomized runs: pause the gateway sender (SIGSTOP) at check / after connect / mid-write; execute the fence; resume | 0 arrivals whose connection SYN timestamp is after fence completion. Publish p50/p99/max of D for arrivals with pre-fence connections |
| T-05 | Timing: rule removal → first refused connect; revision delete → last heartbeat and instance metric at 0 | Worst case over ≥ 20 trials reported. **The owner sets the acceptable fence-to-termination bound before execution** (proposal: ≤ 60 s) |
| T-06 | Deploy N+1 during sends; call N's tag URL after the fence; worker-pool revision overlap | 0 accepted tickets with epoch < current; old tag URL unreachable or refused |
| T-07 | Gateway loses SQL, KMS or custody bucket | Refuses; 0 ledger arrivals |
| T-08 | Cold start of stub ingress and sealer (scale-to-zero variant for this test only) | Cold-start-to-first-seal measured; no ACK without a seal |

### 6.3 Phase 3b (after WP1 CP1/CP2 re-review)

| Test | Pass criterion |
|---|---|
| T-09: worker freeze past `notAfter`; suspend; thaw | 0 arrivals |
| T-10: ticket replay; two workers on one attempt | At most 1 effect |
| T-11: fake Google duplicate ID and stale ETag | `409`/`412` recorded; no regression |
| T-12: accepted-then-lost response | UNKNOWN; stream blocked; no retry |
| T-13: retry suppression in every client | 1 request per attempt under timeout and 5xx |
| Burst: 20 events/s for 60 s plus 100 due jobs/min | Sealed-ingress p95/p99 reported; no connection exhaustion |
| Restore R-01 to R-04: PITR into a new instance; restore from custody export only; missing archive tail and missing key version; restore project without KMS decrypt | Inert (0 ledger arrivals); suppression/permission heads first; holds broadened correctly |
| Tenant hostility: cross-tenant IDs and mixed-tenant STOP | 0 cross-tenant effects |

Staging tests S-02 (Meta A/B revocation latency) and S-03 (Google deleted-ID re-insert behaviour) belong to **provider staging**, not to the synthetic proof.

### 6.4 Cleanup and evidence

1. Freeze dispatch.
2. Export the ledger, heartbeats, harness logs, billing export and test outputs to the repository, under `vnext/evidence/cloud-proof-3a/`, through a separate docs PR.
3. Delete all three projects. Confirm on the billing report 48 h later that no new charges are accruing, and attach it.
4. Anything that fails: stop, keep the evidence, do not tune the test to pass. Independent review of the artifacts follows.

---

## 7. Open owner choices

1. Apply redlines RL-1 to RL-9 (ChatGPT) and confirm the revised ADR version for a short delta check.
2. **Acceptable fence-to-termination bound** and, after measurement, **acceptable D** under G06 (A5-04).
3. Holder of the "kill authority" IAM role; recovery/key custodian; primary and backup operator; billing owner (`ADR:L170`).
4. Custody model: separate project + distinct admin principal (recommended) versus a separate organization or provider. Accept the single-owner residual explicitly.
5. Staging posture: ephemeral (recommended; keeps $250) or permanent.
6. Region for real data, after counsel. Mexico hosting does not remove the Meta path.
7. Retention and crypto-shred policy before any retention lock.
8. Phase 3a authorization: inventory §6.1, ≤ 72 h, cap (I suggest $50), teardown owner.
9. Meta assets for the A/B system users and staging; Google OAuth client ownership and verification path.

**Nothing in the $250 pilot or the ≤$75 proof is blocked by cost.** The blockers are safety design (A5-01 to A5-03) and authorization.

---

## 8. Next steps

- **ChatGPT:** produce ADR-005 rev 2 with RL-1 to RL-9 as a docs-only change to `docs/greenfield/12-ADR-005-GCP-CLOUD-ARCHITECTURE.md`; include a changelog mapping each redline to its finding ID.
- **Codex:** run the repository compatibility assessment against rev 2:
  - provider client without pooling, with zero retries;
  - epoch in ticket and envelope;
  - deterministic Google IDs and `If-Match`;
  - KMS-envelope token storage;
  - SA-to-role mapping onto `roles.sql`.

  Also draft the **Phase 3a harness design** (docs only). WP1 CP1/CP2 remediation continues under its own charter.
- **Claude:** run a delta check of rev 2 against this register, then review the 3a harness design.
- **Owner:** decisions 2–5 and 8 above. No provisioning until then.

### Sources

- [GCP VPC firewall rules](https://docs.cloud.google.com/vpc/docs/firewalls)
- [Cloud Run Direct VPC](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc)
- [Worker-pool instance splits](https://docs.cloud.google.com/run/docs/managing/workerpool-instance-splits-rollbacks)
- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Cloud SQL pricing](https://cloud.google.com/sql/pricing)
- [Cloud NAT pricing](https://cloud.google.com/nat/pricing)
- [Secret Manager pricing](https://cloud.google.com/secret-manager/pricing)
- [Observability pricing](https://cloud.google.com/products/observability/pricing)
- [GCS Bucket Lock](https://docs.cloud.google.com/storage/docs/bucket-lock)
- [Calendar API errors](https://developers.google.com/workspace/calendar/api/guides/errors)
- [Render pricing](https://render.com/pricing)
- [Hogan Lovells: Mexico's 2025 LFPDPPP](https://www.hoganlovells.com/es/publications/mexicos-new-federal-data-protection-law-what-it-means-for-companies)

*Not legal advice. Infrastructure location alone does not establish privacy compliance.*
