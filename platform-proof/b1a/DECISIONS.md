# B1a source decisions and preserved authority

Base: corrected PR20 head2ca5cf215b68f187bfa48b42aaa041bbe93cf56d.
Owner's complete B1a charter authorizes source/local synthetic tests only. INC1 is
accepted for local scope; GCP preference is settled. No cloud account/API,
credentials, provisioning, spending, real providers or merge is authorized.

## B-6: one stable gateway service, a unique revision per epoch

Select ADR-005 Revision3's revision model, not service-per-epoch: stable
`nmb1a-gateway` service; revision `nmb1a-gateway-e000001-r1` then
`nmb1a-gateway-e000002-r1`; unique epoch SA and network tag on each revision.
Stage N+1 untagged/no traffic/inert; advance persisted epoch; move100% traffic to
inert N+1 and remove every old tag; independent kill principal denies old-tag
ALL egress including restricted Google API VIPs and deletes old revision; verify
platform deletion AND complete fresh zero-instance observations after measured
reporting delay, reconcile signed fake-provider/canary traces; preserve UNKNOWN;
only then explicitly promote. Incomplete or contradictory evidence stays held.
Rollback builds the prior image as N+2 with fresh identity/tag, never revives N.

This follows the historical ADR and seven-step sequence. Historical ADR/reviews,
INC1 raw archives, A-1 addenda, logs and checksum manifest remain untouched.
The INC1 Terraform is retained as historical local-proof input; B1a's separately
named configuration is the candidate for future review, with its apply guard kept.

## Cross-project private sealer route

A VPC peering or a run.app DNS entry alone does not make cross-project traffic
internal. Preserve private sealer ingress using a published Private Service
Connect service through a custody-project internal HTTPS Application Load Balancer
and a runtime-project consumer endpoint. IAM also restricts invocation to ingress.
This avoids assuming organization/VPC-SC availability, and does not assert that
standalone controls equal organization enforcement. Extra TLS/certificate/LB/PSC
inventory and cost are explicit; all path/IAM/propagation behavior needs cloud tests.
No change to the sealer/gateway security boundaries or real-provider decisions.

## Evidence and clock trust

CLOUD classification accepts signature-verified observations rooted in separately
administered public-key pins, not caller-provided sourceVerified booleans. Signed
four-timestamp calibration identifies both clocks and yields an explicit measured
uncertainty bound. Local synthetic signatures prove only local fixture origin.
Authentic conclusive old-epoch initiation is a violation before completeness
checks; stale or missing data cannot support a non-violation claim. Remote trust,
platform API provenance, complete observations and actual time bounds must be
independently established during a separately authorized cloud experiment.

Sources: ADR Rev3 at ad705c8cf666ae4ec617e00cae37eaad7f3f4511;
Claude review https://github.com/vanasperena-ux/nukmiris/pull/20#issuecomment-6838315312
and supporting probes #issuecomment-6838315843. Current public-source checks and
any implementation-specific tradeoffs are recorded in the B1a source register.

## Implementation deltas requiring explicit review, not historical ADR edits

- Cloud SQL uses two PSC consumer endpoints (runtime and custody). This replaces
  the old fixture's PSA proposal so the independent sealer can read committed SQL
  from its own VPC; peering transitivity is not assumed. PostgreSQL17 Enterprise,
  CAS CA/DNS identity, PSC/shared-core tier compatibility remain unproven in GCP.
- Private cross-project sealer publication adds an internal HTTPS ALB, PSC and
  synthetic certificate. PR18's "no LB" minimal inventory is therefore **amended
  in this proposal**, not retrospectively approved. If this path is rejected,
  source must be revised/reviewed before any guard removal.
- Synthetic six-hour SQL retention is proposed at one backup/one-day PITR,
  with no final/retained backups after deletion. ADR's seven-day production/pilot
  recovery proposal is not changed; B1b recovery retention needs separate review.
- Source candidate uses instance-billed gateway, aggregate SQL role caps, min/max1
  ingress/sealer and one continuous worker; no automatic tier/region fallback.
  Cloud Run max-instance settings are operational bounds and can overshoot; role
  caps reject excess SQL connections. Native fixture proves the gateway cap;
  actual managed max_connections, memory and transient refusal still need tests.
- The six-hour USD20 allocation remains a **proposal**, not spending authority.
  Revised costs add USD1.50 for the private path and disallow Enterprise Plus.

These are explicit implementation/inventory proposals for Claude/owner review.
No safety redline is waived. Organization enforcement is not replaced by a claim
that standalone CI controls provide the same security.
