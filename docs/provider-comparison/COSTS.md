# Monthly cost comparison and reproducible assumptions

**Prices checked 2026-11-09 America/Mexico_City. USD; planning only.**
[Official source register and check limitations](SOURCES.md).
[Offline calculator](calculate-costs.py) → [exact results](cost-results.json).

## Scope and workload

One shared, single-zone fail-stop environment, 730 hours/month, no permanent
duplicate staging, no discounts, free usage or introductory credit deducted.
The same booking/message/custody/recovery contract applies at all sizes. A is
noncommercial, one test business and at most ~100 synthetic/test appointments;
B/C have the requested 100 appointments/business/month. Actual real-provider
contact is not authorized by this model. A's full-month price is not the proposed
first six-hour B1a run.

| Input | A: development | B: initial launch | C: growth |
|---|---:|---:|---:|
| Businesses / appointments | 1 / ≤100 | 10 / 1,000 | 100 / 10,000 |
| Requests per ingress/sealer/gateway/result per month | 1,000 | 25,000 | 250,000 |
| Active seconds/request, mean | 0.2 | 0.2 | 0.2 |
| SQL dedicated vCPU / GiB RAM (GCP) | 1 / 3.75 | 1 / 3.75 | 2 / 7.5 |
| SQL allocated SSD / used backups GiB | 10 / 15 | 20 / 30 | 100 / 150 |
| Archive stored GiB, including retained versions/exports | 5 | 25 | 250 |
| Archive Class A / B operations | 20k / 60k | 200k / 600k | 2m / 6m |
| KMS active versions / crypto operations | 6 / 20k | 24 / 200k | 204 / 2m |
| External transfer GB or GiB planning quantity | 2 | 10 | 50 |

Request counts are conservative conversation/receipt envelopes, not measured
appointments-to-requests ratios. Class-A/crypto counts model roughly eight writes
per inbound request plus amplification. Archive retention proposal is 90 days,
PITR seven days; actual retention/key erasure needs approval. Usage can exceed
these inputs. CPU/latency, tenant fairness, SQL connections, backpressure and
provider limits require load evidence. C is a capacity hypothesis, not a capacity
certification. Units follow vendor billing (Railway GB, GCP GiB); do not assume
identical bytes or performance across shapes.

## Rate checks used

| Item | Gross USD rate used | Official source |
|---|---|---|
| GCP Cloud Run request active/idle CPU and memory | .000024/.0000025 per vCPU-s; .0000025 per GiB-s; $.40/million requests | [Cloud Run](https://cloud.google.com/run/pricing) |
| GCP instance gateway / worker CPU; memory | .000018 / .000011244 per vCPU-s; .000002 / .000001235 per GiB-s | same |
| Cloud SQL Enterprise dedicated CPU/RAM | $.0413/vCPU-h; $.007/GiB-h | [SQL](https://cloud.google.com/sql/pricing) |
| SQL SSD / used backups | ~$.17 / $.08 per GiB-month, converted from hourly table | same |
| NAT assigned instance / cap / IP / processing | $.0014/h, capped $.044/h; $.005/IP-h; $.045/GiB | [NAT](https://cloud.google.com/nat/pricing) |
| GCS regional Standard / Class A / B | ~$.02/GiB-month; $.005/$.0004 per 1k flat-namespace operations | [Storage](https://cloud.google.com/storage/pricing) |
| Software KMS | ~$.06/active version-month + $.03/10k crypto operations | [KMS](https://cloud.google.com/kms/pricing) |
| Platform secrets | ~$.06/version-month + $.03/10k accesses, gross before free allowance | [Secret Manager](https://cloud.google.com/secret-manager/pricing) |
| Railway container RAM / CPU / volume | $10/GB-month; $20/vCPU-month; $.15/GB-month (docs convention) | [Railway plans](https://docs.railway.com/pricing/plans) |
| Railway Pro / egress / PITR bucket storage | $20 minimum including $20 usage; $.05/GB; $.015/GB-month | [Pricing](https://railway.com/pricing), [PITR](https://docs.railway.com/volumes/point-in-time-recovery) |
| Railway snapshot storage | same as volumes | [Backups](https://docs.railway.com/volumes/backups) |
| Render Pro / bandwidth over 25GB | $25/workspace-month; $.15/GB | [2026 pricing change](https://render.com/blog/better-pricing-for-fast-growing-teams) |
| Render services: 0.5c-512mb / 1c-2g | $7 / $25 per instance-month | [Pricing](https://render.com/pricing) |
| Render Postgres: 0.5c-1g / 1c-4g / allocated storage | $19 / $55 per month; $.30/GB-month | same |

Railway's live pricing page displays per-second RAM/CPU/volume rates
`.00000386/.00000772/.00000006`. At 730h these are ~$10.14/$20.29/$.158,
slightly above its docs' normalized month. Calculator uses the explicit docs'
$10/$20/$.15 convention, not false extra precision. Repricing all three at the
page's 730h equivalent adds roughly $1.0/$1.7/$5.2 in A/B/C before contingency;
this does not close U. Verify actual billing intervals before spending.

## GCP complete proposed architecture

Candidate us-central1; ingress and independent custody sealer min-one,
1vCPU/.5GiB request-billed. Gateway is conservatively **instance-billed**, min-one
1vCPU/.5GiB. Continuous worker 1vCPU/1GiB (C 2GiB); private result min-zero.
Sealer acts as the independent verifier under custody administration; if reviewed
design requires an additional always-on verifier, add about $10–50/month by mode.
No post-ACK work relies on request CPU. Dedicated SQL is used even in full-month
A to avoid silently applying the minimal B1a fixture's connection budget to the
application. All identities/pools/maxima must fit measured database limits.

| Monthly component | A | B | C |
|---|---:|---:|---:|
| Warm ingress + independent sealer | 19.72 | 19.95 | 22.06 |
| Instance-billed gateway | 49.93 | 49.93 | 49.93 |
| Continuous worker | 32.79 | 32.79 | 36.04 |
| Private result processing | .01 | .14 | 1.36 |
| SQL compute, SSD, used backups | 52.21 | 55.11 | 127.62 |
| WAL/PITR reserve | 2.00 | 4.00 | 10.00 |
| Independent archive + KMS | .64 | 3.78 | 35.64 |
| Platform secrets (10 versions/100k accesses) | .90 | .90 | .90 |
| Logs/metrics/export allowance | 3.00 | 5.00 | 15.00 |
| Build/images allowance | 2.00 | 2.00 | 5.00 |
| Internet/export transfer allowance | 3.00 | 5.00 | 15.00 |
| Restore-drill allowance | 3.00 | 5.00 | 10.00 |
| Independent fake-host allowance | 12.00 | 0 | 0 |
| NAT/IP/processing: one assignment → capped metering | 4.76–35.86 | 5.12–36.22 | 6.92–38.02 |
| **Subtotal** | **185.97–217.07** | **188.72–219.82** | **335.48–366.58** |
| **With 25% contingency** | **232.46–271.33** | **235.90–274.77** | **419.35–458.22** |

Totals use unrounded inputs; sum of displayed cents can differ by one cent.
NAT Direct VPC assignment metering remains uncertain; neither bound is a hard
invoice maximum. Separate internet transfer reserve avoids treating NAT processing
as all egress charges. WAL, logging, builds, fake-host and drill amounts are
**analyst allowances**, not verified SKU quotations. Fake host A remains available
for development; B/C instead reserve amortized test/restore sessions, not an
always-running second staging environment. Cloud SQL/PITR is not independent
custody: encrypted exports and keys are in the archive lines. IAM/VPC policy and
service identity have no modeled standalone license fee; an owner domain,
hardware key and any paid support are separate choices.

Conditional request gateway saves A $40.07, B $39.96, C $38.90 before contingency.
Do not take that saving until DR-04 tests demonstrate its admissibility. Compared
with PR18's $168–239/month, this model changes businesses/requests, archive/key
counts, fake-host uptime and drills, and defaults to instance gateway. It is a
new scenario model, not a correction of Claude's independently reproduced math.

## Railway and Render conditional native candidates

Five paid services: ingress, sealer, gateway, continuous worker, result; external
independent GCP verifier/custody/KMS and encrypted exports are **also included**.
Adding them does not establish RL-5 or termination equivalence. Do not replace
UNKNOWN with retries or add a broker merely to suit a hosting template.

Railway aggregate application RAM/average vCPU: A 3GB/.5, B 4GB/1, C 9GB/2.5,
across the five services. Separate DB RAM/vCPU: A 1GB/.1, B 2GB/.25, C 4GB/1.
CPU is average **consumption**, not allocated capacity; double it to see a
$12/$25/$70 increase before contingency. Database volume is 10/20/100GB;
retained snapshot equivalent 20/40/200GB, PITR bucket 15/30/150GB. Actual
snapshot changed-block storage and pgBackRest base/WAL volume may differ greatly.
PITR archive CPU is included in DB average plus a WAL reserve. Builds are free
on Railway per docs; the small build/images allowance covers external CI and
custody-image work. Plan charge is **max($20, resource usage)**, not $20 plus all
usage. Pro is modeled even for A to avoid the Hobby 5GB volume limit.

Render A has five $7 services; B four $7 services and one $25 worker; C five
$25 services. DB A $19/1GB, B/C $55/4GB, plus storage. Pro workspace in every
case buys the documented seven-day PITR window and environment controls; neither
a free web service nor a free expiring DB is used. Logs need redacted export and
alerts beyond dashboard history. No cache or Redis is necessary for SQL durability.

| Component | Railway A / B / C | Render A / B / C |
|---|---:|---:|
| App compute + DB compute + local storage/snapshots + native PITR storage + egress (Railway combined) | 56.83 / 94.95 / 249.75 | — |
| Five compute services | in combined line | 35 / 53 / 125 |
| Managed DB compute + allocated storage | in combined line | 22 / 61 / 85 |
| Workspace fee | included-usage floor in combined line | 25 / 25 / 25 |
| Native bandwidth overage | in combined line | 0 / 0 / 3.75 |
| Additional external verifier | 9.86 / 9.97 / 11.03 | 9.86 / 9.97 / 11.03 |
| External archive/KMS + platform secrets | 1.54 / 4.68 / 36.54 | 1.54 / 4.68 / 36.54 |
| Logs/builds/drill/fake-host allowances | 20 / 12 / 30 | 20 / 12 / 30 |
| Additional WAL reserve | 2 / 4 / 10 | included managed service |
| **Candidate subtotal, excluding U** | **90.23 / 125.60 / 337.32** | **113.40 / 165.65 / 316.32** |
| **With 25% contingency, excluding U** | **112.79 / 157.00 / 421.65** | **141.75 / 207.07 / 395.40** |

**Safety-equivalent native total: NOT ESTABLISHED for every A/B/C cell.** Add
U_R or U_D for a reviewed enforceable egress/termination/identity design, any
required enterprise tier/support and its independent proof. U has no defensible
finite price yet and might require moving the core to another provider. Twenty-
five percent contingency does not repair missing controls. These are useful
resource estimates, never approval to run real businesses on the candidate.

Railway now documents native PITR: do not repeat the outdated claim that it only
has snapshots. Its async archive may drop WAL at a queue cap during sustained
storage failure; monitor archive freshness and retain independent custody.
Render PITR/exports do not prove coherent application/archive frontiers either.

### Fully costed conservative fallback

Keep **all** runtime/SQL/sealer/gateway/custody on GCP; use the alternative only
for an optional nonprivileged UI. This can preserve the proposed architecture's
boundaries without pretending a cross-cloud gateway fixes native constraints.
It inherits GCP's unproven gates. At low UI usage, Railway Pro adds $20 minimum;
Render Pro plus one $7 service adds $32 (a static UI could be cheaper).

| Core on GCP plus optional UI, before contingency | A | B | C |
|---|---:|---:|---:|
| Railway | $205.97–237.07 | $208.72–239.82 | $355.48–386.58 |
| Render | $217.97–249.07 | $220.72–251.82 | $367.48–398.58 |

Do not purchase this redundant topology. It shows why retaining the critical
GCP boundaries does not deliver a cheaper or simpler switch.

## Meta charges, trial and total ownership cost

Infrastructure above excludes Meta messaging in every option. **Do not equate
appointments with billable WhatsApp messages.** Message category, recipient
market, template/window exemptions, delivery and any partner fees determine
charges. Model separately as `sum(delivered billable messages by category and
market × current applicable rate)`; record which party pays. Customers using
their own assets/payment arrangements must not be billed as one platform WABA.

Illustrative planning volumes of **four potentially chargeable template messages
per appointment** give A ≤400, B 4,000, C 40,000; this is sensitivity only, not a
claim that reminders exist or every message is billable. If the blended rate is
r USD, the rows add ≤400r/4,000r/40,000r. At a purely illustrative r=$.01,
that is ≤$4/$40/$400; **$.01 is not a checked Mexico Meta rate**. The official
pricing page returned a login gate, so an exact current Mexico fee is deliberately
not fabricated. Revalidate the official rate card/category rules before B2 or
commercial budget approval. [Official pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).

Calendar API integration does not require hosting on GCP or confer OAuth approval;
verify quotas and the customer's Workspace/account costs separately. No provider
account connection was made here.

Google's advertised new-customer Free Trial is **$300/90 days** where eligible.
This is a temporary credit, not a recurring subtraction. Owner-reported MXN5,089
and December22 expiry in PR18 are not console-verified. Existing credit balance,
currency SKU prices, product restrictions and quotas remain unverified. Maintain
December17 teardown deadline and no paid upgrade by default. First B1a ≤6h
retains Claude's ~$7.90–16.52 including contingency/about $20 allocation proposal;
do not divide the full-month app budget by hours to replace the harness inventory.
The 72h saturated case remains ~$69 with contingency. Free tiers and Railway/
Render trials are not guaranteed and are not used in this model.

Total ownership = infrastructure + Meta/other provider charges + implementation
labor + operator/support time + separately chosen domain/security/support costs
+ tax/FX. Optional paid plan controls, WAF, HA, permanent staging, extra replicas,
extended retention and image/connector overhead are **not zero-cost entitlements**:
reprice them when selected. Initial launch here preserves the ADR's supervised
single-zone fail-stop model, not a highly available commercial service. GCP's
extra $49/month-ish DB compute if doubled, a permanent staging copy, or an
extra gateway replica can matter more than the nominal appointment count.

Reproduce: `python docs/provider-comparison/calculate-costs.py`. The calculator
is documentation evidence only. It is not IaC, an SDK probe or INC1 implementation.
