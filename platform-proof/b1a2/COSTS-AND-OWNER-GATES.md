# Offline cost preparation and owner gates

`python3 platform-proof/b1a2/calculate-costs.py` reproduces the itemized `cost-model.json`, inheriting the public-rate basis from PR18/INC1/B1a (checked2026-11-13). Conservative allowances are **not verified account-specific SKU quotes**. No account, tax treatment, currency, Free Trial eligibility, spend-cap API or credit balance has been queried. Do not subtract introductory credit from gross estimated spend or treat its expiry as permission to run resources.

Six-hour baseline: USD13.84 estimated subtotal; USD17.30 including25% contingency. Illustrative16% tax raises that to USD20.07; an additional USD1 billing lag and USD1 retained-resource sensitivity gives USD22.07. At illustrative20.50 MXN/USD plus10% FX risk, this can exceed the fixture's MXN410/USD20 allocation. **That stressed six-hour configuration is not budget-ready.** The high-load case is costed separately. A shorter/reduced synthetic session preserving every safety prerequisite, or a separately owner-approved allocation/quote, is necessary if the owner requires the gross USD20 ceiling including these sensitivities. The optional restore-drill allowance is included conservatively; O-7 remains undecided. No duration/workload/allocation is automatically changed.

O-1 eliminates the previous sealer-only ALB/PSC path; the new plan has one SQL PSC consumer endpoint and four private DNS zones. Added IAM/secret metadata does not justify omitting secret-version, log, artifact, observer, fake-host, IP, SQL/PITR and retained-key costs. The observer is an independently supervised operator process; an always-on independent observer VM is not silently included or assumed free. Any such addition needs a new inventory/cost approval.

`runtime/billing.mjs` converts a proposed USD planning amount to an explicitly supplied account currency using owner-supplied dated FX, strict decimal units and integer minor units. Fixture20.50 produces MXN410.00, not MXN20.00. The FX is a synthetic example, **not an approved owner rate**. Missing/stale FX, wrong units, unsupported currency, inconsistent local amount and unknown owner account inputs fail validation. Real-owner template values remain null/unapproved.

Billing alerts at50/75/90/100% are not hard project spending caps.50/75% are notification-only; the local controller holds on90/100%, enforced budget, delay/control unavailability, capacity pause, account/resource suspension, reset/restart/recovery or session expiry. Holds are committed in SQL; they never auto-promote dispatch, recreate a resource or restore an old epoch. SQL can hold new entry but cannot prove an already-entered old process physically dead. Billing-enforcement resets are not safety authorization.

Before any later provisioning decision, the named billing operator must separately obtain owner approval to inspect the exact billing account and verify Free Trial restrictions/expiry/currency, available credits, Cloud Run cap eligibility and exclusions, reset behavior, account suspension behavior, alert delivery and expected lag. Save official account/console evidence under independent custody. If a cap feature is unavailable, do not relabel alerts as a cap; use a newly approved bounded-duration/gross-allocation plan with independent elapsed-time kill and teardown authority. No billing upgrade or live inspection is authorized now.

## Decision ledger

| Decision | State | Required before later execution |
| --- | --- | --- |
| O-1 runtime-project synthetic sealer | OWNER APPROVED for B1a | Implemented; independent custody preserved; not automatic B1b placement approval |
| O-2 org/standalone | OPEN | Exact org policy or separately reviewed standalone risk acceptance |
| O-3 named people | OPEN | Supervisor, independent kill, cleanup, billing, backup and custody; exact impersonation scopes; externally administered final cleanup authority must survive deletion of experiment-managed SAs/grants |
| O-4 physical/canary policy | OPEN | Owner-approved termination threshold, independent wake schedule/tail, drift/transit bounds and source trust; provisional60s and20 canaries are test inputs only |
| O-5 exact account/session/resources/budget | OPEN | Three project IDs/numbers, images/host artifact, APIs/quotas/networks/identities, source hashes, exact start/end≤6h and dated gross local-currency budget/FX |
| O-6 disposable one-day recovery | OWNER APPROVED for B1a only | No final/retained backup; explicit deletion checks. B1b restores7day requirements |
| O-7 restore drill | OPEN | Include or omit explicitly, with time/cost/evidence and no owner data |

No favorable source review closes any of these open owner decisions, the source activation gate, production custody/OPS01, B1b/B2, real Meta business-token fencing, explicit customer-name confirmation or restricted pilot identity gates.
