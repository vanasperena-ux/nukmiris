# O-4–O-7 six-hour offline cost envelope

`python3 readiness/calculate-costs.py` deterministically generates `cost-model.json` from the historical B1a2 rate model without changing historical JSON/results. Pricing basis remains 2026-11-13 public-rate assumptions and allowances; this is not a new SKU quote or actual account verification. Every SKU, region, edition/tier, quota, tax and FX treatment must be rechecked before a separately authorized session.

Owner planning: US$30 equivalent in MXN; at most six hours; one supervised human; provisional physical termination target 60 seconds, reporting latency separate; one-day PITR disposable B1a only; no restore drill until B1b. No spending is authorized. The old $2 restore allowance is removed from each scenario. The historical $20/20.50 FX illustrative model is retained unchanged and is superseded for current planning only; **20.50 is not a current or approved exchange rate**.

| Component | Six-hour baseline USD |
| --- | ---: |
| Base itemized infrastructure/allowances | 11.84 |
| 25% contingency | 2.96 |
| Subtotal | 14.80 |
| Illustrative 16% tax | 2.37 |
| With illustrative tax | 17.17 |
| Delayed billing allowance | 1.00 |
| Residual retention allowance | 1.00 |
| Before FX stress | 19.17 |
| 10% FX stress, USD equivalent | 1.92 |
| Total stress, USD equivalent | 21.08 |
| Remaining against US$30 equivalent | 8.92 |
| Two failed/repeated full runs at stress | 42.16 |

Rows are individually rounded for display; arithmetic uses unrounded Decimal values, so rounded rows need not sum exactly. Higher-load and SQL g1 scenarios are separately itemized in JSON. Retries are not free or implicitly authorized; cumulative spend includes failed sessions. Two full runs exceed the same planning allocation. A contingency is not a ceiling.

Base lines include ingress/sealer, both gateway revisions, throttling comparison, worker, SQL compute/storage/PITR, NAT/public-IP/transfer, fake VM/disk/IP, build/images/Artifact Registry, logs/metrics, PSC/private DNS, custody/KMS/secrets and monitoring/IAP allowances. Conservative overlapping line allowances are retained rather than removing always-on CPU/canaries to meet price. No permanent observer VM or second human is assumed. Human labor/hardware/internet is unpriced; the one-person operational/custody failure domain is explicit.

Null future inputs: actual billing currency, account FX rate/as-of/validity/owner approval, tax, Free Trial eligibility/remaining credit, effective region/SKUs/quotas and exact session window/operator. Convert an eventual approved alert budget only after these receipts: MXN = 30 × owner-approved MXN/USD, with upward minor-unit rounding. Neither trial credit nor an assumed exchange rate reduces the estimate now.

Budget alerts, Cloud Run settings, a proposed expiry/kill plan and Free Trial credit are **not hard total-project spending caps**. Suspension or delayed billing can outlive compute. NAT/static IP, SQL disk/PITR/backups, DNS, Artifact Registry, log retention, Secret versions, KMS versions and custody may continue charging. Verify exact teardown immediately, +2h, +48h and next statement; KMS ring/key metadata is nondeletable individually and key-version destruction is delayed. Independent cleanup access must survive experiment deletion; billing-budget removal requires owner-account rights and a manual receipt. No billing upgrade, budget reset or automatic resource recreation is authorized.
