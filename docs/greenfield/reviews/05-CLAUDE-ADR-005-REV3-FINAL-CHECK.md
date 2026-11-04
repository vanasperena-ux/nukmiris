# Claude final check: ADR-005 Revision 3

**Date:** 2026-11-03 (America/Mexico_City)
**Scope:** short delta check of Revision 3 against `04-CLAUDE-ADR-005-REV2-DELTA-REVIEW.md` (DR-01 to DR-12). It is not a new architecture assessment. It is a paper review only: no resources, code, spending, provider access or merges.

| Item | Value |
|---|---|
| Commit reviewed | `ad705c8` (draft PR #6, branch `review/claude-gcp-adr005-2026-11-01`) |
| File | `docs/greenfield/12-ADR-005-GCP-CLOUD-ARCHITECTURE.md` |
| SHA-256 | `c3bfc7acb209ccd5fe946063f94f03ea06fc518c2f75d8b20277d5ce83e8babc` |
| Diff basis | `865c33d..ad705c8` (ADR file only; the other file in the diff is review 04) |

Line references below (`R3:Lnn`) point to the file at `ad705c8`.

## Verdict

**GO for Phase 3a test design.**

The test-harness design can start now, independently of WP1. The five editorial items below are non-blocking. They can be fixed in passing or carried into the harness design document.

This verdict does not cover:
- provisioning, spending or Phase 3a execution, which still need the owner's separate authorization of the exact inventory, $50/72 h cap and named kill, cleanup and billing owners;
- real-provider staging;
- Phase 3b, which waits for the WP1 CP1/CP2 re-review;
- WP2.

All safety properties remain **NOT VERIFIED** until Phase 3a runs.

## Focus checks

| # | Focus | Result | Evidence |
|---|---|---|---|
| 1 | Old instances confirmed terminated from platform evidence, not heartbeats | **Confirmed** | `R3:L88`: a fence is complete only with "platform-side revision deletion and zero-instance metrics after reporting delay", supported by termination logs where available. "Heartbeat absence does **not** prove termination". A frozen dead-man canary is required. Release step (5) at `R3:L168` repeats this. |
| 2 | Corrected sequence: shift traffic, remove old access, then delete | **Confirmed** | `R3:L168` step (3): 100% of traffic moves to inert N+1 and **all** tags pointing to N are removed, with routing and in-flight lag measured. Step (4): deny-all on N's tag, then delete revision N. This matches GCP's rule that a revision able to receive traffic cannot be deleted. |
| 3 | Calendar IDs no longer treated as guaranteed duplicate prevention | **Confirmed** | `R3:L104`: "duplicate-reduction and reconciliation aid, NEVER a fence"; collision detection "not guaranteed". IDs derive from the logical operation, stable across attempts, in base32hex within the allowed length. Phase 3b simulates Google accepting a duplicate (`R3:L181`). |
| 4 | Protection against delayed execution from CPU throttling | **Confirmed** | `R3:L88`: the outbound hard deadline must be strictly shorter than the inbound request timeout. A late-resume test is required, with the gateway switched alone to instance-based billing (about +$40/month) if it cannot be made safe. Included in the 3a scope (`R3:L179`). |
| 5a | Unique network tags per epoch | **Confirmed** | `R3:L168` step (1) (`gw-e000042` example). The old deny rule is kept until termination is verified. |
| 5b | Meta credentials | **Confirmed** | `R3:L105`: revoking the old token is mandatory in production fencing, with any exception recorded and allowed only after verified platform termination. Fresh token per epoch on separate A/B system users; non-interference and revocation latency to be verified in staging. No Meta credential is used in 3a or 3b. |
| 5c | Rollback | **Confirmed** | `R3:L168`: rollback is "redeploying a prior image digest as a new epoch N+2, never rerouting to old revisions". |
| 5d | Google Cloud organization | **Confirmed** | `R3:L129`: folders require an organization; without one, separate projects still work, but org-policy enforcement must be tested and gaps documented. Cloud Identity Free or Workspace is preferred; the owner has not yet decided. |
| — | DR-08/09/11/12 | **Confirmed** | Diagram wording (`R3:L48`); unique export names (`R3:L129`); pre- and post-fence write classification (`R3:L179`); sealer cold-start rule in the change register (`R3:L251`). |

## Non-blocking editorial items

| ID | Location | Item |
|---|---|---|
| E-1 | `R3:L240` | Stale text: "pending Claude's rev-2 delta review" should read rev 3 / this check. |
| E-2 | `R3:L104` | "Use **deterministic event IDs**" appears twice in one bullet. Merge into one sentence. |
| E-3 | `R3:L129`, `R3:L179`, `R3:L181` | Sentence fragments with a double space and lowercase continuation ("…  a separate GCP project", "…  a small purpose-built", "…  verify original"). Cosmetic. |
| E-4 | `R3:L156` (§8) | The conditional gateway instance-billing sensitivity (about +$40/month, about $223 with contingency) appears only in the change register (`R3:L248`). Add one line to §8. |
| E-5 | `R3:L179`; DR-09 | Two items are only in the change register: the sealer's "retryable error, never false ACK" rule, and IAM propagation timing for removing an old epoch's service-account access (DR-07). Include both explicitly in the 3a test matrix. They can go in the harness design document rather than the ADR. |

## Next steps

- **Codex:** write the Phase 3a harness design document (docs only). It should cover:
  - process layout and the dead-man canary;
  - the fake-provider ledger schema (SYN, TLS, request and arrival timestamps; epoch, revision and source IP);
  - one-connection-per-attempt verification;
  - the throttle late-resume test;
  - the traffic-shift, tag-removal and delete timing;
  - firewall and IAM propagation timing;
  - pre- and post-fence classification;
  - exact SKU inventory and a teardown checklist;
  - E-5.
- **ChatGPT:** fix E-1 to E-4 when convenient. No new revision is required for test design to proceed.
- **Claude:** review the harness design before it goes to the owner.
- **Owner:**
  - organization decision (Cloud Identity Free or Workspace, versus no organization);
  - named kill-role holder, cleanup owner and billing owner;
  - fence-to-termination threshold (proposed ≤ 60 s);
  - later, a separate Phase 3a authorization.
