# Itemized Google Cloud cost model and Free Trial assessment

**Planning estimate, not a quote or spending authorization.** Rates checked
2026-11-09 America/Mexico_City. Candidate `us-central1`, USD, on-demand only,
730h/month. [Offline calculator](evidence/calculate-costs.py) and
[machine-readable results](evidence/cost-calculation.json) reproduce every subtotal.
No billing console, account credit, live SKU invoice or cloud resource was accessed.

## 1. Assessment and assumptions

ADR rev3's rounded rows sum to **$138.36**, consistent with its approximate$138
label. The old model depends on available free usage and unresolved network/storage
assumptions; it is not an accepted fixed price for this application. This new
model includes a separate result boundary, synthetic host, per-tenant key versions,
explicit active time and network sensitivity. It does not claim an unexplained
provider price rise or directly compare different topologies as identical quotes.

**Recommendation:** authorize no monthly commitment. First consider a supervised
≤6h synthetic platform session, with a reviewed total≤72h experiment. The modeled
72h allowance is **$32.83**, **$41.04 with25% contingency**. The proposed$50
allocation can plausibly cover that bounded workload, but **not arbitrary usage**:
a specified saturation scenario reaches **$69.01 including contingency**. Reduce
session length/volume or obtain a separately reviewed allocation if needed.

An always-running synthetic application environment costs approximately
**$168–199/month** in the request-billed gateway scenario, or **$208–239/month**
with an instance-billed gateway, before25% contingency, tax and exclusions. Instance
billing removes one throttling source; it does not replace the physical fence. The
latter becomes **$260–299**, exceeding the earlier$250 planning envelope. Do not
silently raise it or weaken a safety boundary to make the estimate fit.

Monthly workload assumption:25 synthetic businesses,100k requests per ingress,
sealer, gateway and result service; mean0.2 billable instance-seconds/request per
service. Ingress/sealer/gateway1vCPU/0.5GiB, warm min1; worker1vCPU/1GiB continuous.
Result service is private min0. These are forecast inputs, not measured capacity
or supported business counts. Sidecars, longer requests, replicas, revision
overlap and additional result webhooks change the bill.

## 2. Rates and itemized monthly forecast

| Rate input, USD | Value | Official primary source |
|---|---:|---|
| Request service activeCPU / idleCPU per vCPU-s; memory per GiB-s |0.000024 /0.0000025;0.0000025 |[Cloud Run](https://cloud.google.com/run/pricing) |
| Instance service CPU / memory per second |0.000018 /0.000002 |same |
| Worker pool CPU / memory per second |0.000011244 /0.000001235 |same |
| Requests per million |0.40 |same |
| Enterprise SQL vCPU-h / GiB-h |0.0413 /0.007 |[Cloud SQL](https://cloud.google.com/sql/pricing) |
| Regional SSD / used backups per GiB-month (rounded hourly equivalent) |0.17 /0.08 |same |
| Shared-core `db-f1-micro`, per hour |0.0105 |same; no SLA |
| Public NAT gateway / externalIP per hour; data/GiB |0.0014×metered instances up to32, capped0.044; IP0.005; data0.045 |[Cloud NAT](https://cloud.google.com/nat/pricing) |
| Standard regional GCS GiB-month; ClassA /ClassB per1k flat-namespace ops |~0.02;0.005 /0.0004 |[Storage](https://cloud.google.com/storage/pricing) |
| Software KMS active version-month; crypto per10k ops |0.06;0.03 |[KMS](https://cloud.google.com/kms/pricing) |
| Secret Manager active version-month; access per10k |~0.06;0.03 |[Secret Manager](https://cloud.google.com/secret-manager/pricing) |

Default-region tables were read, not non-USD account SKU prices. Changing region,
edition, storage class, key protection or namespace requires repricing. No CUD,
reservation or product-specific trial is assumed. Main forecast applies **no Free
Tier or introductory credit**; availability is billing-account-wide, not per project.
For illustration only, an entirely unused worker allowance could reduce its$32.79
to$27.57, saving$5.22; it is not allocated repeatedly across environments.

| Monthly line | Request gateway | Instance gateway | Assumption / limitation |
|---|---:|---:|---|
| Warm ingress + sealer |20.65 |20.65 |Two services, including modeled active time and requests |
| Gateway |10.33 |49.93 |Request mode only if throttle/deadline experiments pass |
| Worker |32.79 |32.79 |One continuous pool; service fallback separately priced |
| SQL + SSD + used backups |55.11 |55.11 |1vCPU/3.75GiB;20GiB SSD/30GiB backup; explicitly Enterprise single-zone |
| PITR/WAL uncertainty reserve |4.00 |4.00 |Allowance, not a verified incremental SKU; inspect actual configuration/billing |
| Archive + KMS |14.44 |14.44 |100GiB including version/soft-delete amplification;1m ClassA/3m ClassB;54 active software key versions and1m crypto operations |
| Platform secrets |0.90 |0.90 |10 active versions/100k accesses, gross before free usage; tenant credentials encrypted in SQL |
| Private min0 result service |0.55 |0.55 |100k×0.2s, no permanent idle instance |
| Logs/metrics allowance |5.00 |5.00 |Volume/cardinality/export/retention still need measured limits |
| Build/images allowance |2.00 |2.00 |Not a verified workload quote; image scan/SBOM and connector resources must be itemized |
| Independent fake host allowance |12.00 |12.00 |Linux host/disk/externalIP allowance, exact VM SKU not yet quoted; remove only when fake host truly unnecessary |
| NAT/IP/processing sensitivity |5.57–36.67 |5.57–36.67 |1 vs capped32-equivalent metering, oneIP/20GiB; Direct VPC actual billing count NOT VERIFIED |
| Transfer reserve |5.00 |5.00 |Separate from NAT processing; exports/cross-region/restore egress may exceed it |
| **Subtotal** |**168.34–199.44** |**207.95–239.04** |Unrounded arithmetic before display rounding |
| **With25% contingency** |**210.42–249.30** |**259.93–298.80** |Not a hard maximum |

KMS count models25 tenant keys×2 retained versions +2 platform keys×2 versions.
Per-subject erasure, more retained versions or destruction delays increase it.
GCS versioning/soft delete and object operations count; bytes alone are incomplete.
The archive/verifier design may use more objects per admission than this forecast.
The sealer verifies the log/index; an additional paid witness runtime is **not**
hidden here—if the reviewed design needs one, add its cost explicitly.

NAT's published VM formula does not establish how this exact Direct VPC deployment
will be metered. Both endpoints above are **sensitivities**, not vendor-confirmed
lower/upper bounds. Subnet allocation, extra instances and maintained connections
must be measured. Never present an assumed$8 NAT charge as confirmed.

## 3. B1a 72-hour synthetic platform experiment

This is the3a harness, not a three-day price for a completed application or all3b
proof. It budgets **two gateway epochs for72h each**, one continuous worker,
ingress/sealer warm; a separate6h request-billed throttle variant;86400 aggregate
extra active ingress/sealer instance-seconds;40000 HTTP requests; small epoch SQL.
Fake host, build, log, transfer and temporary drill figures are explicit allowances.

| Line | USD |
|---|---:|
| Warm ingress + sealer |1.94 |
| Two instance-billed gateway epochs |9.85 |
| Six-hour request-billed throttle variant |0.55 |
| Extra active ingress/sealer budget + requests |1.87 |
| Worker pool, no free credit applied |3.23 |
| Shared-core epoch SQL +10GiB SSD/5GiB backup |0.96 |
| NAT high-metering allowance/IP/2GiB |3.62 |
| Archive/KMS + secrets allowances |0.80 |
| Independent fake host/disk/IP allowance |3.00 |
| Build/images + logs/metrics allowances |3.00 |
| Transfer + temporary DB/drill allowances |4.00 |
| **Unrounded subtotal** |**32.83** |
| **With25% contingency** |**41.04** |

Rows round separately; calculator totals use unrounded values. If ingress and
sealer instead each sustain **two fully active instances for all72h**, forecast
subtotal becomes**$55.21**, or**$69.01** with contingency. Thus max2, a$50 alert or
trial balance does not make a guaranteed$50 experiment. First6h evidence should
measure actual CPU, concurrency, SKU accounting and costs before broadening.
Elapsed-time expiry, bounded synthetic callers, rate/log/storage quotas and a
named supervised stop are essential. Billing reports arrive later.

Cloud B1b must be separately repriced: dedicated SQL, result adapter, archive
capacity/corruption runs, export/PITR recovery and any extra connector/verifier
compute. Do not reuse3a's price for the whole milestone.

## 4. Free Trial and MXN balance

Owner reports **MXN5,089 credit expiring December22,2026**. As of November9 there
are43 calendar days to that date; this is owner-supplied account evidence, not a
console verification. It does not establish resource quotas, regional access,
remaining shared free allowances or ability to create the three projects.

Google's [Free Trial terms and feature guide](https://docs.cloud.google.com/free/docs/free-cloud-features)
describe90-day introductory credit and restrictions including no quota-increase
requests, Marketplace, GPUs and Windows VM images while on a non-billable trial.
The proposed Linux/SQL/Run design avoids those listed products but **account-specific
eligibility/quota still needs checking**. Do not auto-upgrade billing to unblock
anything. A paid upgrade changes spending exposure; unused credit retains its
original expiry. Trial exhaustion/expiry can stop services and endanger access to
evidence, so do not treat it as a safe shutdown/backup method.

MXN account SKU prices, taxes, exchange treatment and other account consumption
must be checked before authorization. Do not turn the displayed credit into a
new FX quote. Pure sensitivity: at an **assumed**, not quoted, MXN17–20/USD,
$41.04 consumes roughlyMXN698–821 before account differences; a$50 allocation is
MXN850–1,000. That looks affordable against the reported balance, not a guarantee.
Running24/7 through the remaining43 days could exhaust it: at the same illustrative
range the request-gateway monthly cases extrapolate to roughlyMXN4,046–5,639,
and instance cases toMXN4,998–6,759, before contingency/tax and other account usage.
Short sessions and complete teardown are the economical recommendation.

## 5. Alerts, spend controls and forgotten resources

[Alerts-only budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets)
notify; they do not stop usage. Set alerts gross of credits where supported so
trial coverage does not hide consumption. The earlier proposed$10/$25/$40 alerts
remain notifications and require a named response.

Current Google documentation also provides [spend cap budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps).
They apply to one eligible service/project, including Cloud Run, use estimated
gross costs, can overshoot through reporting delay, and auto-reset monthly. They
do not cover all SQL, storage, NAT, IP or retained-resource charges. Availability
on this account is unverified. Never call them a whole-experiment hard cap.
Test pause/resume/month-reset with dispatch persistently inert; a billing resume
is not authority to reuse an old attempt. No spend control is configured here.

Hidden/residual costs to inventory: warm/tagged old revisions, worker min1,
connector sidecars, SQL edition/minor/auto-storage growth, backup/PITR/exports,
GCS generations/soft-deleted bytes/operations, retained KMS/secret versions,
NAT/externalIPs, VM/disks/snapshots, inter-region/Internet traffic, image registry/
scanning/build minutes, audit log/metrics/trace/BigQuery exports, restore drill
destinations, org/domain setup, and later LB/WAF or production HA. Stopped compute
can leave billable storage/IP; pending project deletion is not an itemized receipt.
Use [03's full shutdown checklist](03-PHASED-PLAN-AND-SHUTDOWN.md#5-shutdown-rollback-and-abandonment).

No commitments/CUDs, paid support, permanent staging, domain purchase or commercial
provider messaging are included. Labor, legal/security/on-call, tax/FX and later
Meta/Calendar/business subscription costs are excluded and must remain explicit.
One-off≤72h experimentation is proposed; abandoning it carries no intended long-term
contract once every authorized resource and retained-charge obligation is removed.
