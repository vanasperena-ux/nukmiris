# Revised source-only B1a cost model

2026-11-13, grossUSD, us-central1 candidate, no credit/free tier/tax/FX deduction.
Run `npm run b1a:costs` for itemized JSON. No billing/account/API access occurred.
Historical PR18/INC1 calculators and published results are byte-for-byte unchanged.

New private path adds a conservative **USD1.50 per six-hour session**: three
minimum internalALB proxies0.45, three PSC endpoint allowance0.18, processing0.10,
seven private DNS zones/queries0.20, compatibility margin0.57. Official minimum
internalALB rate is3×0.025/hour even idle; PSC/SQL exact SKUs need revalidation.
These allowances are estimates, not vendor quotes or measured invoices.

| Candidate | Gross6h | With25% contingency | Proposed USD20 allocation |
|---|---:|---:|---|
| f1 baseline |14.58|18.22|Within estimate only|
| f1 high load |15.51|19.38|Within estimate, little headroom|
| g1 sensitivity (not selected) |15.65|19.57|Separate review/tier change|
| EnterprisePlus misconfiguration |16.96|21.20|BLOCKED; never automatic upgrade|

Rounding comes from full-precision Decimal totals, not adding rounded rows.
Original allowances include fake VM/disk/IP3, build/images1.5, logs/metrics1.5,
transfer2, restore drill2, archive/KMS0.7 and secrets0.1. Small fixed allowances
remain for short sessions; worker/gateway/ingress/sealer/SQL/NAT have hourly lines.
Two gateway revisions are costed warm throughout; requestCPU variant is separately
allowed in the model. No additional persistent controller/observer cloud VM is
included: named independent operator processes host supervision. If that changes,
add exact inventory and reprice; do not borrow a runtime identity for independence.

USD20 is still a **proposed allocation**, not a hard cap or permission to spend.
Gross alerts10/15/18/20USD equivalent are50/75/90/100%. The owner's trial credit is
reported in MXN; account currency/FX/eligibility/quota/preexisting monthly usage
must be verified only under future authorization. Do not set20MXN by mistake.
CloudRun service/project spend cap may be unavailable, delayed and incomplete;
SQL/NAT/LB/VM/storage/keys/inflight spend continue. It cannot enforce USD20 total.
Use elapsed≤6h shutdown, named independent cleanup/backup people and bounded
workload/logs/resources; any quote exceeding allocation needs an owner decision.
No CUDs/reservations/Marketplace/domain/persistent staging/billing upgrade.

Forgotten minimumALB adds1.80USD/day, threePSC allowance0.72/day, seven DNS zones
about1.40/month beforequeries; original IP0.24/day and f1compute0.252/day remain.
Disabled secret/KMS version0.06 **per month**, not per day. Backups/WAL/snapshots,
restore instances, versions, logs, images and IPs may persist after compute stops.
No ongoing-cost-free claim until inventory absence and settled billing evidence.
Review before~2026-12-08, teardown by2026-12-17; missing the trial window is safer
than compressing independent review. None of these costs has been incurred here.
