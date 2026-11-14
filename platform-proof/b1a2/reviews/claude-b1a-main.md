## Claude independent review: B1a cloud-specific preparation (Draft PR #21)

| | |
|---|---|
| **Reviewed** | Tested source `38ad02abbb0b7353f6768ff67f74542a4df0dedb` (tree `9192e00e…`, confirmed) and evidence publication `ac38ede7777e5493a458995b021a103e55a0059e`. `2ca5cf2..38ad02a`: 50 files, all under `platform-proof/`. `38ad02a..ac38ede`: only `b1a/evidence/*` plus the handoff. A-1 (`133430a..2ca5cf2`) is documentation only. |
| **Against** | My INC1 review (B-1–B-8, F-1–F-8, P1–P4); PR #18/#19 records; ADR-005 Rev3 (`ad705c8`/`83907db`, RL-1–9, DR-01–12, Phase 3a inventory); owner charter; accepted app `b4d0be0`. |
| **Read** | All changed source (`src/*`, `b1a/runtime/*`, `b1a/ops/*`, `b1a/schema.sql`), the generator and all 119 Terraform resources, inventory, costs, every new test, the fixture/diagnostics helpers, and the evidence README, logs, failures and manifests. |
| **Executed by me** | See §2. |
| **Not executed** | Docker fixture, startup-fault and volume tests; exact Node 24.19 / PG 17.11; Terraform `init`/`validate` (no registry access); anything in a cloud. |
| **Evidence** | [Supporting-evidence comment](https://github.com/vanasperena-ux/nukmiris/pull/21#issuecomment-6868306568): integrity checks, adapter diff, independent verifier and outputs, P5 probe, external facts, IAM cross-check |

### 1. Verdict

**GO WITH CONDITIONS.**

**Accepted now as correct source.** These parts of INC1 + B1a can be recorded as accepted:
- the one-use permit, COMMIT-tag check, both lost-COMMIT branches, fresh mTLS transport and proof binding;
- the interruption campaigns;
- the session/dispatch SQL;
- the synthetic seal-before-ACK path;
- the direct-kill and diagnostics fixes;
- evidence integrity.

I found no regression in any INC1 safety guarantee.

**Not accepted until corrected (blocking).** The evidence-time model and the kill-authority wiring fail on two counts:
- **Clock window (D-1, D-2).** Every classification depends on one clock measurement valid for at most 60 seconds. That makes a conclusive *late* post-fence send unclassifiable as VIOLATION. For the same reason, the retirement contract cannot reliably be satisfied under Cloud Run's documented metric latency.
- **Kill authority (D-3).** The printed fence and teardown commands impersonate the kill identity, but that identity lacks the permissions those steps require.

All three defects fail closed: nothing can wrongly promote. But they would make a paid cloud session unable to reach its goal, and D-1 repeats the INC1 F-2 masking pattern in a new form.

**Another source-only increment is required before provisioning (answer to Q10: yes).** Its scope:
- fix D-1 to D-3;
- implement the live adapters this PR deliberately leaves out;
- ideally adopt the simpler ADR sealer placement (§5).

This is the smallest safe next step. Provisioning should not be considered on this source.

This review authorizes nothing: no merge, provisioning, credentials, spending or real-provider contact.

### 2. What I executed vs inspected

| # | Check | Result |
|---|---|---|
| E1 | Every `SHA256SUMS.json` entry | **71/71 match**; the only unlisted file is the manifest itself |
| E2 | Reassembled the split archives from 13 + 13 parts; compared with `archive-assembly.json` | **full and fault: byte length and sha256 match**; concurrency archive matches its listed hash |
| E3 | `tested-files-sha256.json` against `git show 38ad02a:<path>` | **50/50 match** |
| E4 | Protected tree OIDs at `b4d0be0` vs `ac38ede` | `vnext/src 06b9b834`, `vnext/test 3ae5480f`, `vnext/local 11c3161e`, `package.json`/`lock`, `backend 1db9755e`: **identical** |
| E5 | `b1a/check.mjs` and `scripts/check.mjs` in a detached worktree at `38ad02a`, scrubbed environment | PASS: 127-file manifest, 35 historical files verified, protected source unchanged, secret scan PASS, 0 cloud resources / provider calls |
| E6 | **Independent Python verifier** over all 50 published ledgers (25 + 21 + 4); no shared code with Codex | All hash chains and checkpoints valid; every result stamped `testedSource 38ad02a`; **max 1 REQUEST and 1 EFFECT per attempt in every case**; 0 mismatches between result and ledger counts |
| E7 | Codex `b1a/verify-evidence.mjs` over my extracted archives | PASS for full, fault and concurrency |
| E8 | Non-database suites from exact source (Node 22): classifier, clock, evidence, ops, planning, unit | **25/25 pass** |
| E9 | Database suites from exact source, with **one changed test helper** (local PG 16.15 cluster instead of Docker; diff published): gateway, identity, native-proof, session, permission, concurrency, fault, campaign, interruption | **32/32 pass.** My raw exports reverify (25 ledgers, `testedSource 38ad02a`). Cross-product: 54 × 20, same 340/660/40/40 distribution, 40 `afterCommit×REVOKE` effects. Asynchronous: 400 stops / 130 kills, 0 post-exit activity, 0 UNKNOWN resends, max 1 per attempt. Codex's verifier also accepts. Not run: `b1a-diagnostics` and `fixture.test` (Docker-only). |
| E10 | Claude probe **P5** (classifier at realistic timescales, using Codex's own signed-envelope fixture) | Confirms D-1 (§3) |
| E11 | Calculator + official LB pricing and Cloud Run metric documentation | §6 |

### 3. Concern-by-concern

**1 — B-1 to B-8 closure; no regression.**

| Finding | Status |
|---|---|
| B-1 campaigns | **Closed.** See item 2. |
| B-2 classifier | **Partially closed.** Authenticated, session-bound, signature-verified envelopes replace caller booleans. A fabricated `sourceVerified`, copied tokens, wrong sessions, wrong keys and stale envelopes are rejected. VIOLATION is checked before completeness. **But see D-1 and D-2.** |
| B-3 kill without resume | **Closed.** `stop()` sends a direct SIGKILL to the observed stopped PID; 130/130 asynchronous kills recorded `exitObserved`, `SIGKILL` and the matching PID start. |
| B-4 COMMIT handling | **Closed.** `completion.command !== "COMMIT"` → no continuation. Tested: BEFORE_SERVER (caller UNKNOWN, durable ARMED, explicit original-ID replay once), ACK_LOST (durable UNKNOWN, no resend), ROLLBACK_TAG. |
| B-5 proof binding and SQL TLS | **Closed.** Proof is bound to epoch and revision (BAD_EPOCH/BAD_REVISION → UNKNOWN, no resend). SQL TLS requires CA and DNS hostname (native wrong-CA and wrong-host rejection). Prepared targets are opaque `WeakMap` capabilities that cannot override `rejectUnauthorized`/`minVersion`/ALPN. |
| B-6 epoch model and controller | **Closed in model, not in IAM** (D-3). One stable service with a unique revision, SA and tag per epoch follows the ADR revision model. Promotion is a compare-and-swap. Rollback becomes N+2. |
| B-7 infrastructure | **Mostly closed.** Per-epoch fake allow (priority 1000), pre-created `disabled` old-epoch deny (priority 100, IPv4 + IPv6), default-deny in all three VPCs, NAT `ALL` logs, restricted-VIP DNS, independent kill identity, gross budget at 50/75/90/100% of 20. Gaps: D-3, P-4, P-5. |
| B-8 diagnostics | **Closed.** State, exit, OOM status and bounded PG logs are captured before removal. The original INC1 fixture failure remains unexplained. The new ENOSPC evidence is plausible context, not proof. |

**2 — Interruption campaigns: coverage is genuine.** Regenerated independently from the raw files (both full and fault runs):

| Campaign | What the raw data shows |
|---|---|
| Cross-product (1,080 schedules) | Exactly **54 cells × 20**. `controlMode` and `providerMode` are recorded separately. 1,080/1,080 stopped (`T`) and resumed with the same PID start. |
| Stale-sender case `afterCommit × REVOKE` | Retained as the counterexample: 20 APPLIED + 20 UNKNOWN, **1 effect each** after SQL retirement. |
| Asynchronous (400 un-hooked stops) | 130 direct kills and 270 continues. **0 old-process trace events after exit; 0 old-process REQUESTs after exit; 0 resends after UNKNOWN.** Killed-before-COMMIT ARMED rows replayed exactly once: 13 (full), 8 (fault). Stops genuinely land mid-flight (last trace event at stop: CONNECT_BEGIN 73/75, CONNECTED 58/58, WRITE_BEGIN 17/14, TLS_READY 1/2, WRITE_PART 5/0, …), with recorded `crypto.randomInt` delays. |

The original 1,000-schedule campaign is retained, and its `mode` aliasing is now labelled.

**3 — Classifier: correct direction, but the clock window masks late violations (D-1).**

I checked the following and found them correct:
- **Authentication:** Ed25519 pins with `role: INDEPENDENT_OBSERVER`, exact envelope schema, a ≤1 h envelope cap, `sourceVerified` forbidden in payloads, and `WeakMap` token provenance.
- **Clock derivation:** the four-timestamp offset interval plus precision and drift.
- **Ordering:** VIOLATION before completeness and freshness; incomplete or stale input produces NOT_PROVEN, never PRE_FENCE.
- **Retirement rules:** `retirementDecision` treats any canary nonce request as a VIOLATION.

However, `measuredClock` caps validity at 60 s, and `classifyCloud` needs both the fence time **and** every event inside that single window. Otherwise it returns `event_outside_clock_measurement` (NOT_PROVEN).

**P5:** authenticated envelopes, complete zero-instance metrics, 50 ppm drift, uncertainty 5 ms.

| Old-epoch connect | Verdict |
|---|---|
| 10 s after the fence | VIOLATION |
| **150 s after** | **NOT_PROVEN** |
| **10 min after** | **NOT_PROVEN** |

A frozen old instance waking minutes later is exactly the dead-man threat (DR-01). With drift bounded, uncertainty after 10 minutes is about 30 ms against a 600,000 ms margin, so the verdict is conclusive.

**4 — Permit, COMMIT, TLS and UNKNOWN: still correct.**
- `enter_b1a` holds the session row `FOR SHARE` and checks dispatch-enabled, expiry, scope, epoch and revision before the original `enter`, then clips the deadline to session expiry.
- Legacy `proof.enter` is revoked from the gateway. Only the controller can call `hold`, `advance`, `promote` (compare-and-swap) and `recover_retired`; `recover_retired` only moves ENTERED to UNKNOWN.
- Transport opens a fresh `tls.connect` with mTLS, makes no retry, and binds the remote address.
- The sealer path ACKs only when it re-reads ELIGIBLE with the same digest after the sealer has read the committed batch and fsynced its journal. Sealer timeout or failure returns 503, never a false ACK.

**5 — Infrastructure: plausible, with three defects or gaps.**

Plausible:
- Default-deny + all-traffic + per-epoch tags/SAs + a pre-created disabled deny is the right shape for RL-5/RL-6.
- `ignore_changes` on gateway template/traffic correctly hands later epochs to the controller.
- PSC is used correctly for Cloud SQL: Google confirms PSC is non-transitive and needs one endpoint per VPC.
- The impossible apply guard (now also requiring an organization decision and an unexpired session) and the non-credential provider token are retained.

Defects and gaps:
- **D-3 (kill authority).** The kill custom role has only `run.revisions.get/list/delete`, `compute.firewalls.get/update` and secret/KMS `get/setIamPolicy`, yet:
  - step 3 (`run services update-traffic … --clear-tags`) impersonates the kill SA and needs `run.services.update` (and possibly `iam.serviceAccounts.actAs`);
  - step 4's revision delete cannot succeed while the old revision still serves traffic or holds a tag;
  - teardown's `worker-pools delete` and `services delete` also impersonate the kill SA without `run.workerPools.delete`/`run.services.delete`.

  As written, either the independent kill fails or it silently depends on the deployer (RL-6). No test maps printed commands to the permissions they need.
- **P-4 (fake host).** Its network denies all egress, with no restricted-VIP path and no operator ingress (IAP/OS Login). So the granted `objectCreator` on the custody bucket is unusable, and nothing defines how the fake server is installed or its ledger retrieved. The image is the unpinned `debian-12` family (acknowledged).
- **P-5 (budget currency).** The budget's `units: "20"` uses `billing_currency`, but the owner's trial account is shown in MXN. A USD budget on an MXN account is rejected; setting MXN gives MX$20. The amount must be computed per currency.

**6 — Avoidable complexity.** ADR-005 Phase 3a places "Cloud Run **ingress/sealer** and gateway" in the run project. The custody project holds only the versioned bucket, test KMS key and independent admin.

B1a instead moves the sealer into the custody project. That forces an internal HTTPS ALB, PSC publication and consumer, a second Cloud SQL PSC endpoint, a custody VPC with its own DNS and firewalls, and a synthetic TLS private key passed through Terraform state.

My own INC1 list asked for "cross-project sealer invocation" rather than questioning that placement, which was inherited from the INC1 plan. I own that.

That path is **29 of 119 resources**, about $1.50 per session, a $1.80/day forgotten-ALB residual, and the largest set of untested propagation and IAM behaviors. The independence it buys (a compromised run-project deployer cannot redeploy the sealer) is real, but it is bounded in B1a by the single human root and is not what 3a measures.

**Recommendation (owner decision O-1):** for B1a, revert to the ADR placement:
- sealer in the run project with its own SA, SQL role and min-1;
- custody keeps bucket/KMS/observer keys and the sealer's CAS write via IAM;
- one SQL PSC endpoint.

Test the cross-project sealer in B1b under an explicit ADR delta. No redline is weakened. Other complexity, such as the seven DNS zones, mostly disappears with it.

**7 — Synthetic retention: acceptable for B1a only.** One retained backup, 1-day PITR, no final or retained backups after deletion, deletion protection off: all appropriate for a disposable 6 h synthetic database. ADR's 7-day pilot/production PITR and the custody/restore gates are explicitly untouched (DECISIONS.md). **Condition:** B1b must restore the ADR retention and demonstrate restore. Nothing in B1a counts toward production recovery evidence.

**8 — Cost: arithmetic correct and conservative; no material SKU missing for the listed inventory.**

Arithmetic:
- $14.0068 (INC1 high load) + $1.50 private path = **$15.51**; × 1.25 = **$19.38**. Reproduced.
- Variable compute and network is only about $5.6; the rest is fixed allowances.

Verified today on official pages:
- regional internal ALB **minimum 3 proxies × $0.025/h = $0.075/h even idle**, plus $0.008/GiB, with no separate forwarding-rule charge for this type. So $0.45 per 6 h and $1.80/day forgotten are correct.

Still unverified:
- PSC endpoint and data SKUs (the $0.03/h allowance is consistent with what I know of PSC rates, but I could not fetch the page);
- PSC + shared-core + CAS-CA compatibility for `db-f1-micro`.

Not in the estimate:
- **(a) A probable second session.** As coded, D-2 means the first session would most likely be unable to promote.
- **(b)** Tax/IVA and MXN SKU pricing.
- **(c)** Monitoring API reads by the observer (small).
- **(d) Currency:** the $20 alert cannot be configured as written (P-5).

The largest residual-cost risk is the always-billing ALB, which disappears under O-1.

**9 — Evidence and preservation: verified** (E1–E7).

**10 — Remaining adapters: yes, another source-only increment is required.** Provisioning on the current source would buy a session that cannot complete. D-2 makes promotion practically unreachable; the observer, canary, clock, fake-host and bootstrap adapters do not exist; and D-3/P-4/P-5 would fail at execution time.

### 4. Findings by category

**A. Defects blocking acceptance of the current source.** All are small and source-only.

| ID | Sev | Defect | Correction |
|---|---|---|---|
| D-1 | H | A single ≤60 s clock window masks conclusive late post-fence initiation as NOT_PROVEN (P5). B-2 is only partly closed. | Classify per timestamp. Either accept multiple authenticated CLOCK measurements bracketing the fence and each event, or extrapolate with a drift bound `u(t) = u₀ + drift·|t − measuredAt| + resync allowance` up to a stated cap. VIOLATION when `event − u(event) > fence + u(fence)`. Add tests at minute scales. |
| D-2 | H | `retirementDecision` needs fence → reporting delay → zero samples to `coverUntil` → ≥20 canary wakes after `coverUntil` → wake tail → ledger observation, all inside one ≤60 s window (`p.at ≥ measuredAt`, `now ≤ validUntil`). Cloud Run `container/instance_count` is "sampled every 60 seconds… not visible for up to 120 seconds". So a visible zero sample, ≥20 canary wakes and their tail cannot reliably all fit in the same 60 s window: **EVIDENCE_READY cannot be satisfied reliably under documented latency**. Fail-closed, but the session would most likely be unable to promote. | Same clock model as D-1. Add a test using the documented 60 s + 120 s latency and a realistic canary schedule that reaches EVIDENCE_READY (and every other result where appropriate). Make the zero-instance rule sum all `state` labels. |
| D-3 | M | The kill role cannot perform printed step 3 or the revision delete in step 4; teardown deletes also impersonate the kill SA without permission. | Grant the kill role exactly `run.services.get/update` (plus verified `actAs`, if required) and the needed delete permissions, or assign each command to the correct principal and document what the independent kill can do alone. Add a static test mapping each printed command to the permissions required by its impersonated principal. |

**B. Work required before actual cloud provisioning** (follow-up source-only increment, then review):
- **P-1** Live bootstrap: secret-mount → `prepareSyntheticProfile` wiring for each role; approved image digest; the readiness/inert transition explicitly controlled by SQL dispatch.
- **P-2** Observer adapters, per ADR evidence rules:
  - revision state and delete receipts, Logging, Monitoring (sum `active` + `idle`, treat missing series as missing);
  - the measurement protocol with a reachable time endpoint;
  - **ACTIVITY derived from independent sources** (fake ledger, NAT logs) with conservative transit bounds, not from the stale gateway's own trace;
  - canary scheduler;
  - observer key custody.
- **P-3** Controller/operator scripts with dry-run parity tests, and the D-3 IAM fix.
- **P-4** Fake host: pinned image with the server baked in, mTLS keys, a ledger export path (restricted VIP or operator pull via IAP), and an egress/ingress rule review.
- **P-5** Budget currency: the amount in the account currency at an owner-approved FX rate; the spend-cap procedure verified for that account.
- **P-6** If O-1 is chosen: remove the custody-sealer path and re-run validate, costs and inventory. If not: certificate/key lifecycle outside Terraform state, and PSC/ALB IAM tests.
- **P-7** Exact project IDs/numbers, region APIs, quotas, and `session_started_at` bound to the authorized window.

**C. Owner decisions:**
1. **O-1:** sealer placement (§3.6). I recommend the ADR run-project placement for B1a.
2. **O-2:** organization mode (`ORG_ENFORCED` vs reviewed standalone).
3. **O-3:** named supervisor, kill, cleanup, billing and backup humans.
4. **O-4:** fence-to-termination threshold and canary schedule, given the metric latency above.
5. **O-5:** allocation in account currency (≈US$20, gross) and the exact ≤6 h window before 2026-12-17, accepting that review slippage means skipping the trial window.
6. **O-6:** accept the synthetic retention for B1a only.
7. **O-7:** whether the optional restore drill stays in B1a.

**D. Safety properties only a real cloud experiment can show:**
- Cloud Run revision deletion → actual zero instances, and the real reporting delay;
- fence-to-termination p50/p99/max and the canary wake tail;
- firewall-deny effect on new vs established flows, and propagation time;
- all-traffic enforcement and no-VPC/private-ranges-only rejection (org vs standalone);
- `run.app` via restricted-VIP DNS for internal worker → gateway;
- NAT log completeness;
- PSC (and ALB, if kept) internal-ingress and IAM semantics;
- Cloud SQL PSC + CAS-CA hostname + shared-core + role caps + `max_connections`;
- request-billed CPU throttle and late resume;
- sealer cold start;
- Secret/KMS IAM revocation propagation vs cached credentials;
- clock offsets between operator, gateway and fake host;
- spend-cap pause and billing lag;
- actual cost and residuals.

**E. Deferred to B1b / B2 / commercial onboarding** (unchanged by this PR):
- **B1b:**
  - full application roles/RLS on Cloud SQL (MB-01, no `cloudsqlsuperuser` workaround);
  - custody 009/011/017 with record-chain **and** index extension;
  - 7-day PITR and inert restore;
  - application permit/channel/due-work integration;
  - the cross-project sealer (if O-1 is chosen).
- **B2:**
  - OPS01 nine cases with ≥10,000 schedules before real effects;
  - **mandatory customer-name confirmation**;
  - identity/asset allowlists;
  - Calendar ID/ETag;
  - Meta A/B tokens;
  - the real Calendar credential-denial test.
- **Commercial:**
  - MB-08 business-token fence ADR amendment;
  - Embedded Signup v4;
  - coexistence semantics;
  - privacy/LFPDPPP;
  - organization-level production controls.

### 5. Smallest safe next step

**A source-only "B1a-2" increment**, then an independent review. Nothing is provisioned. It contains:
- D-1 to D-3;
- P-1 to P-7, with P-6 simplified if O-1 is accepted;
- a realistic-latency end-to-end retirement test (synthetic envelopes at minute scales).

Only after that review should the owner consider a resource-specific ≤6 h authorization.

To keep the trial window, the B1a-2 review should land by about **2026-12-08**, with teardown complete by **2026-12-17**. If that slips, skip the window rather than compress the review or the session.

PR #16, #18, #19, #20 and #21 remain Draft and unmerged. Nothing was provisioned, merged, credentialed or sent.


---
_Generated by [Claude Code](https://claude.ai/code)_
