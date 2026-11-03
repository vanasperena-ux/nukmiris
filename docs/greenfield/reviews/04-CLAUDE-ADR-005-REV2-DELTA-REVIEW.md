# Claude delta review: ADR-005 Revision 2

**Reviewer:** Claude, independent assurance
**Date:** 2026-11-03 (America/Mexico_City)
**Mode:** paper review only. No resources, provider access, code changes, merges or spending authorization.

| Item | Value |
|---|---|
| Subject | `docs/greenfield/12-ADR-005-GCP-CLOUD-ARCHITECTURE.md`, Revision 2 |
| Commit reviewed | `865c33deb131b1312b14a9da34587be2a7a6e890` (branch `review/claude-gcp-adr005-2026-11-01`, draft PR #6) |
| File SHA-256 at that commit | `f8486984e88f13aeab8a095d96f161e949f7d80e978721891c7a9812e87b1d50` |
| Baseline | Claude review `03-CLAUDE-ADR-005-INDEPENDENT-REVIEW.md`, redlines RL-1 to RL-9 and findings A5-01 to A5-21, against ADR revision 1 at `55f6fae` |

**Notation.** `R2:L88` means line 88 of the file at `865c33d`. Every safety property remains **NOT VERIFIED**: this is a document review, and no experiment has run.

---

## 1. Verdict

**GO WITH REVISIONS for synthetic test planning only.**

- **Phase 3a may proceed to detailed test-harness design now, independently of WP1** (§5).
- Before that design is approved for owner authorization, four corrections must land, either as a short ADR rev 3 or inside the harness design document:
  - **DR-01:** heartbeat absence is not proof of termination.
  - **DR-02:** the fence sequence deletes a revision that GCP will not allow to be deleted.
  - **DR-03:** Google does not guarantee duplicate-ID detection.
  - **DR-04:** request-billed CPU throttling is a real pause/thaw source.
- **NO-GO** remains in force for provisioning, spending, real providers, Phase 3b (until WP1 re-review) and WP2.

All nine redlines are present. Revision 2 is a substantial and faithful response. Most corrections below come from documentation I checked for this delta review. Two of them correct my own earlier advice (DR-03, and part of DR-01).

---

## 2. Redline verification (RL-1 to RL-9)

| Redline | Where in rev 2 | Result | Notes |
|---|---|---|---|
| RL-1: fresh connection per attempt; fence = revision deleted and instances terminated | `R2:L88` | **Addressed, with a defect** | Fresh connection after the final check, no pooling, keep-alive, HTTP/2 reuse or retries: correct. Defect: termination is "verified via per-instance epoch/revision heartbeats and instance-count metrics". A frozen process also stops heartbeating, so heartbeat absence cannot prove termination (**DR-01**). |
| RL-2: two-part claim; measure D; owner G06 disposition | `R2:L88`, `L194`, `L240` | **Addressed** | Wording is accurate, including "neither bound is currently demonstrated" and that fake-ledger evidence says nothing about real Meta/Google delivery. Refinement in DR-12. |
| RL-3: sealer as a warm service, never a job, no internet | `R2:L74` | **Addressed** | Note DR-09: min-1 instances can still be recycled. |
| RL-4: Google never fenced by revocation; deterministic IDs; `If-Match`; Meta A/B | `R2:L104-105` | **Addressed, with defects** | Google's documentation states collision detection at creation is *not guaranteed* (**DR-03**). Event IDs should derive from the operation, not the attempt (DR-03). The Meta wording "when applicable" / "only after coordinating" weakens the fence (DR-06). |
| RL-5: Private Google Access + KMS custody; enforce `all-traffic`; reject no-VPC revisions | `R2:L92` | **Addressed** | Correct and appropriately hedged ("must be experimentally verified"). Org-policy feasibility depends on having an organization node (DR-05). The diagram text at `R2:L48` still says the worker has no Google "route" (DR-08). |
| RL-6: fixed deploy/fence/rollback sequence; independent kill authority | `R2:L168-169` | **Addressed, with a blocking defect** | Step (3) deletes revision N while N still serves 100% of traffic and step (1) put N+1 at `--no-traffic`. GCP refuses that deletion (**DR-02**). Kill-authority definition is good. |
| RL-7: observable signals replace the "denied egress" alert | `R2:L173` | **Addressed** | Heartbeats are fine as an *alert*; they must not be the termination *proof* (DR-01). |
| RL-8: custody export as the independent copy; crypto-shred; single-owner threat model | `R2:L124-129`, `L133` | **Addressed** | Good. "Folder" requires an organization resource (DR-05). Unique export object names are needed under create-only rights (DR-11). |
| RL-9: 3a/3b split; revised cost; $50/72h | `R2:L137-158`, `L177-183`, `L185-195` | **Addressed** | The split is clean, and 3a is explicitly free of the WP1 prerequisite. Costs are correctly labelled unverified where applicable. DR-04 may add about $40/month. |

**Changelog check:** the rev 2 changelog (`R2:L226-240`) maps each RL to the correct A5 findings and lists open owner choices without approving any. No silent product-scope changes found: M2/M5, G06, the 37 journeys and the reminder semantics (`R2:L117`) are intact.

---

## 3. New and remaining findings

Gate key: **H** = before the 3a harness design is approved for authorization; **E** = during 3a execution (measure); **P** = before real-provider staging; **X** = before production.

| ID | Sev | Evidence | Problem | Correction | Gate |
|---|---|---|---|---|---|
| **DR-01** | **HIGH** | `R2:L88`, `R2:L168` step (4): termination "verified via per-instance … heartbeats and instance-count metrics" | Heartbeats stop in two different cases: the instance is dead, or the process is **frozen**, which is exactly the F13 adversary. Instance-count metrics are sampled with delay and are not documented as a per-instance termination record. As written, a frozen but live gateway holding an open provider connection can satisfy the "fence complete" condition. | Define fence completion from **platform-side** evidence: revision resource deleted, *and* no instances for the revision in platform metrics after the documented metric delay, *and* (if available) per-instance container-termination entries in Cloud Run system logs. Heartbeat absence is necessary, not sufficient. In 3a, prove the definition with a **dead-man canary** (§4.2). Separately, Cloud Run documents a 10-second SIGTERM → SIGKILL window at shutdown ([container contract](https://docs.cloud.google.com/run/docs/container-contract)). What revision deletion does to *running* or *in-flight* instances is **not documented** ([manage revisions](https://docs.cloud.google.com/run/docs/managing/revisions)) and must be measured. | H (definition), E |
| **DR-02** | **HIGH** | `R2:L168` steps (1) and (3); [manage revisions](https://docs.cloud.google.com/run/docs/managing/revisions): "You cannot delete a revision if: it is able to receive traffic", and the latest revision cannot be deleted either | Step (1) deploys N+1 with `--no-traffic`, so N still holds 100% of traffic at step (3). The delete fails. A tagged revision is also "able to receive traffic". | Insert between (2) and (3): **(2b)** shift 100% of traffic to N+1 (still inert: it refuses dispatch until step 6, and step 2 already denies N tickets) and **remove every tag pointing at N**. Then delete N. Whether removing traffic is immediately enforced for in-flight requests to N is undocumented; measure it. Full corrected text in §4.3. | H |
| **DR-03** | **HIGH** (corrects my A5-05) | `R2:L104`; Calendar `Event.id` documentation: IDs use base32hex characters (`a-v`, `0-9`), are 5–1024 characters, must be unique per calendar, and Google states **"we cannot guarantee that ID collisions will be detected at event creation time"** ([Event.id](https://pub.dev/documentation/googleapis/latest/calendar_v3/Event/id.html), mirroring the Calendar API reference) | A late duplicate create with a deterministic ID *may* be rejected with `409`, but this is not guaranteed. Treating the ID as a duplicate fence would overclaim. Deriving the ID from the *attempt* ID would also produce a new ID for any later, separately authorized attempt on the same logical operation. | (a) Present deterministic IDs as **duplicate reduction and post-hoc reconciliation aid**, not a guarantee; the fence remains termination plus network. (b) Derive the ID from the **immutable operation identity** (stable across attempts), encoded in base32hex within the length limits. (c) `If-Match`/`412` for moves and cancels stays as specified. (d) Add a fake-Google mode in 3b that sometimes *accepts* a duplicate ID, so reconciliation is tested against the documented weak guarantee. | H (wording), 3b, P |
| **DR-04** | **HIGH** | Cost table `R2:L143` (gateway request-billed); [container contract](https://docs.cloud.google.com/run/docs/container-contract): under request-based billing "CPU is allocated when instances are processing requests" | With request-based billing, a gateway handler that outlives its inbound request (Cloud Run request timeout, client disconnect) is CPU-throttled, and can effectively **resume later** when that instance next receives a request. That is a production pause/thaw source, not just a test artifact. Cloud Run's request timeout closes the *inbound* request but does not abort the handler's *outbound* socket. | (a) The gateway's internal hard deadline aborts the provider socket and must be **strictly shorter** than the Cloud Run request timeout. The handler never outlives its request. (b) Add a 3a test that forces the inbound request to end before the handler, and observes whether a late provider arrival occurs on the next request to that instance. (c) If the test shows late arrivals, use **instance-based billing for the gateway only**: at 1 vCPU / 0.5 GiB and the verified rates ($0.000018/vCPU-s, $0.000002/GiB-s; [Cloud Run pricing](https://cloud.google.com/run/pricing)), that is about $49.90/month versus about $9.90 for idle min-1 request-billed, so **about +$40/month**. Revised pilot ≈ $178, or about $223 with contingency; still under $250. | H (test), E |
| **DR-05** | **MEDIUM** | `R2:L92` (org policy), `R2:L129` ("project/folder"); [resource hierarchy](https://docs.cloud.google.com/resource-manager/docs/overview): "An organization resource is required to use folders", and Workspace or Cloud Identity "is a prerequisite to have access to the organization resource" | If the GCP account is a personal Google account, there are no folders. Whether `run.allowedVPCEgress` can be enforced on a project with no organization is **NOT VERIFIED**. | Owner decision before 3a authorization: (a) create an organization (Cloud Identity Free or Workspace) and place the three proof projects under it; or (b) proceed without an organization: custody becomes a separate *project* only, and egress enforcement relies on the CI admission check plus an audit-log alert. Test T-01c then records "policy unavailable", not "pass". Option (a) is recommended: it is also needed for production IAM hygiene. | H (decision) |
| **DR-06** | **MEDIUM** | `R2:L105` ("retire old credential N only after coordinating successor identity"); `R2:L168` step (3) ("when applicable") | The Meta credential layer can be skipped by wording. In production it is the only fence that works **without the GCP control plane** (route 15 in review 03). | In the production fence, revoking N's Meta token is **mandatory**. It may be deferred only if platform-side termination evidence (DR-01) is complete, and the deferral must be recorded. "A/B" means two system users with a **fresh token per epoch**; whether revoking one token leaves the other system user's token unaffected is **NOT VERIFIED**. No Meta step applies to 3a or 3b. | P |
| **DR-07** | **MEDIUM** | `R2:L88` ("per-release identities"), `R2:L168` ("distinct network/identity tag") | It is unclear whether network tags are unique per epoch or alternate A/B. Reusing a tag would force removing N's deny rule before N is proven gone. IAM removal from an old per-epoch service account is a useful extra layer, but propagation is not instantaneous. | Use a **unique network tag per epoch** (for example `gw-e000042`). Delete a deny rule only after DR-01 evidence. If per-epoch service accounts are used, remove the old SA's KMS-decrypt and secret-access roles in step (3), and **measure** IAM propagation in 3a. No timing is assumed. | H, E |
| DR-08 | LOW | `R2:L48`: the worker has "no Meta/Google credential or route" | Contradicts `R2:L92`: a Google API network route exists through Private Google Access. | Reword to "no provider credential and no internet route; the Google API network path exists through Private Google Access and is credential-gated". | H |
| DR-09 | LOW | [container contract](https://docs.cloud.google.com/run/docs/container-contract): "an idle instance can be shut down at any time", including instances kept by minimum-instance settings | A min-1 sealer reduces cold starts but does not eliminate them. | Keep the T-08 cold-start measurement. The ACK path must return a retryable failure (never a false ACK) during a sealer cold start. | E |
| DR-10 | LOW | `R2:L168` ("Rollback uses the same protocol") | Ambiguous whether rollback could mean re-routing to a retained old revision. | State that rollback = **redeploy the prior image digest as a new epoch revision** through steps (1)–(6). Never re-route to an earlier revision. | H |
| DR-11 | LOW | `R2:L129` (create-only rights on custody) | Overwriting an existing object needs delete permission. Scheduled exports with fixed names fail, or tempt someone into granting delete. | Use unique, time-stamped export object names. Retention and cleanup are handled only by the custody admin. | 3b |
| DR-12 | LOW | `R2:L88` (D bound) | The two D cases should be split by whether the request bytes reached the kernel before the freeze. Bytes already written can still be sent by TCP while the process is frozen, until the instance is destroyed. | Classify each T-04 arrival as **pre-fence write** (bounded by the TCP tail or fence-to-termination, whichever comes first) or **post-fence write** (must be 0 after fence completion). | E |

---

## 4. Focus areas requested

### 4.1 Old-gateway termination guarantees

**What rev 2 can claim, once 3a passes and the DR fixes are in:** after a fence verified by *platform-side* evidence, no instance of epoch < N exists, so no process of epoch < N can open or write to any connection.

**What it cannot claim:**
- that bytes written before the freeze were not delivered;
- anything about provider acceptance or delivery;
- any timing while the GCP control plane is unavailable (then only the SQL epoch denial and, in production, Meta token revocation apply).

**What is still unknown and must be measured in 3a:**
- whether revision deletion terminates running and in-flight instances, and how fast;
- whether a SIGSTOPped process is killed by the platform (expected via SIGKILL; **NOT VERIFIED**);
- metric and log delay;
- firewall rule propagation;
- IAM propagation.

Rev 2 correctly says no bound is demonstrated yet (`R2:L88`).

### 4.2 Fresh-connection requirement

The requirement is **sound and correctly placed** (connection opened *after* the final authority check). Remaining implementation risks and test oracles for the harness:

1. **Client-library reality.** Node's built-in `fetch` (undici) pools connections by default, and Google's Node client libraries layer their own retry behaviour. The gateway should use a dedicated per-attempt client: for example `https.request` with `agent: false` (or an undici `Agent` destroyed after one request), with retries explicitly 0 and a hard abort timer.
   - **Oracle:** the fake provider records **exactly one TCP SYN and one TLS handshake per attempt ID**, and never two requests on one connection.
2. **Window that remains.** final check → connect → *freeze* → fence → resume → write. The firewall cannot stop this write, because the connection was already established. Only termination can. This is exactly why DR-01 matters.
3. **Dead-man canary (proves DR-01).** In the gateway container, the harness runs:
   - (a) a sender process that opens a connection to the fake provider, then is SIGSTOPped;
   - (b) a sibling timer process, also SIGSTOPped, that would SIGCONT the sender after X seconds;
   - (c) a third process, not stopped, that keeps heartbeating, then stops heartbeating on command.

   After the fence is declared complete by the platform-side definition, *any* canary arrival at the ledger means the declaration was false. Pass criterion: **0 canary arrivals after declared fence completion, across ≥ 20 trials**. Report the time from the revision-delete request to the last possible arrival.
4. **DNS and TLS.** Each attempt resolves DNS through the platform resolver. A TLS session resumption ticket is acceptable, because a new TCP connection is still required. Record both.

### 4.3 Proposed deployment and fence sequence (corrected text for rev 3, `R2:L168`)

1. Deploy epoch N+1 gateway **untagged, `--no-traffic`, inert**, with a **unique per-epoch network tag** and identity (and, in production, its Meta credential).
2. Atomically advance the execution epoch in SQL. The gateway refuses tickets with epoch < N+1, and N+1 refuses dispatch until step 6.
3. **(new)** Move **100% of traffic to N+1** and **remove all tags pointing to N**. Record the timestamp.
4. The kill-role holder applies **deny-all egress for N's tag** (including Google API VIPs) and **deletes revision N**. In production, they also revoke N's Meta token (mandatory unless DR-06 deferral is recorded) and remove the old SA's KMS-decrypt and secret-access roles if per-epoch SAs are used.
5. Fence completion requires **platform-side evidence** that the revision is gone and no N instances remain, after the documented metric delay. Heartbeat absence is necessary but not sufficient. Reconcile the fake ledger: 0 post-fence writes from N.
6. Classify unresolved in-flight attempts as UNKNOWN, preserving their original IDs.
7. Explicitly authorize and enable N+1 dispatch.

If any confirmation is missing, N+1 stays inert. Rollback = redeploy the prior image digest as epoch N+2 through the same steps. Remove N's deny rule only after step 5.

---

## 5. Can Phase 3a proceed to detailed harness design independently of WP1?

**Yes.** Rev 2 is internally consistent on this point (`R2:L179`, `L190-192`). The 3a questions (network, revision, termination, IAM and connection behaviour on GCP) do not depend on WP1 SQL correctness. 3a results must not be presented as WP1 or real-provider evidence; rev 2 already says this.

Conditions on the *design* (none of them needs WP1):

1. Fold in DR-01 to DR-04 and DR-07; include DR-08 and DR-10 wording.
2. The harness uses its **own minimal epoch/ticket fixture**. If it borrows WP1 SQL for convenience, that code is fixture only and earns no WP1 credit.
3. The test matrix includes:
   - T-01, T-01b and T-01c from review 03;
   - the keep-alive counterexample;
   - the one-SYN-per-attempt oracle;
   - ≥ 1,000 randomized pause/thaw runs, classified as pre- or post-fence writes (DR-12);
   - the dead-man canary, ≥ 20 trials (DR-01);
   - traffic-shift-then-delete timing (DR-02);
   - the request-throttle late-resume test (DR-04);
   - firewall and IAM propagation timing (DR-07);
   - the tag-URL test;
   - authority-outage refusal;
   - a control-plane-outage tabletop;
   - sealer cold start (DR-09).
4. Owner prerequisites for *authorization* (not for design): the DR-05 organization decision; named kill-role holder, cleanup owner and billing owner; fence-to-termination threshold (proposed ≤ 60 s, now to be compared against the DR-01 platform-side definition); final SKU inventory and the $50/72 h cap.

---

## 6. Next steps

- **ChatGPT:** ADR rev 3 limited to DR-01 to DR-04, DR-06 to DR-08 and DR-10 (use the §4.3 text), with a changelog. No other changes are needed.
- **Codex:**
  - Phase 3a harness design document, docs only: process layout, dead-man canary, fake-provider ledger schema (SYN, TLS, request and arrival timestamps; epoch, revision and source IP), fence script, exact SKU inventory, teardown checklist.
  - Repository compatibility notes for the per-attempt HTTP client and for deriving operation-based base32hex Google IDs.
  - WP1 remediation continues separately.
- **Claude:** check rev 3 and review the 3a harness design before it goes to the owner for authorization.
- **Owner:** DR-05 organization decision; named kill, cleanup and billing owners; the threshold. No provisioning, spending or provider access until the separate 3a authorization.

### Sources

- [Cloud Run: manage revisions](https://docs.cloud.google.com/run/docs/managing/revisions) (deletion restrictions)
- [Cloud Run container runtime contract](https://docs.cloud.google.com/run/docs/container-contract) (SIGTERM/SIGKILL, idle shutdown, CPU allocation)
- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [GCP resource hierarchy](https://docs.cloud.google.com/resource-manager/docs/overview) (folders require an organization)
- [Calendar `Event.id` rules](https://pub.dev/documentation/googleapis/latest/calendar_v3/Event/id.html) (mirror of the API reference text)
- [VPC firewall rules](https://docs.cloud.google.com/vpc/docs/firewalls)
- [Cloud Run Direct VPC](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc)
