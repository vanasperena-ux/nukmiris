# Source register and public documentation checks

Read alongside immutable `../ARCHITECTURE.md` source pins. Public documentation
checked2026-11-13; no account/credential/Google API request was made.

| Source | Exact reference / use |
|---|---|
| Accepted executable / app evidence | PR16; b4d0be0cb98c7f2b69be318e18b93f4de102c511; tree03d08322e27d9d54485fa887b482743fe076556b; accepted127-file manifest preserved |
| ADR005 Revision3 | ad705c8cf666ae4ec617e00cae37eaad7f3f4511; `docs/greenfield/12-ADR-005-GCP-CLOUD-ARCHITECTURE.md`, SHA256c3bfc7acb209ccd5fe946063f94f03ea06fc518c2f75d8b20277d5ce83e8babc; RL1–9/DR01–12 and reviews on PR6 head83907db61daa929fa91ed9301c75b92eaa5f5436 |
| Architecture reconciliation | PR18 head23079800b825502cf290c5a61ee32c2e3c256dd6; `docs/milestone-b/*`; gapsB-G01–16 and B-T01–15 |
| Provider choice | PR19 d3fa65192374ca206ff1f6d166a789c295a15e97; GCP owner preference settled; no provider redesign |
| Feature Register | v1.4 at59cde023d2dff088161c1d01bd76c1099386e13f; no functional changes |
| INC1 implementation / evidence / correction |3204e73c823d7e552c0aacad74294617490465f6; evidence133430a2e4988d334e071d4b64f43393beb992eb; corrected base2ca5cf215b68f187bfa48b42aaa041bbe93cf56d |
| Claude independent review | [full review](https://github.com/vanasperena-ux/nukmiris/pull/20#issuecomment-6838315312), [full supporting P1–P4 probes](https://github.com/vanasperena-ux/nukmiris/pull/20#issuecomment-6838315843); no claim of review of this increment |
| Cloud Run private cross-project networking | [official private networking](https://docs.cloud.google.com/run/docs/securing/private-networking): peering/DNS alone does not make another project's requests internal; published PSC/internalALB selected explicitly, not a silent direct-invoke assumption |
| Load balancer cost | [official pricing](https://cloud.google.com/load-balancing/pricing): internalALB minimum three proxies0.075USD/hour total in us-central1, plus data/CloudRun charges; account-currency SKUs may differ |
| PSC cost | [official network pricing](https://cloud.google.com/vpc/network-pricing): endpoint/data/producer arrangement affects charges; three-endpoint allowance is conservative, exact SQLPSC SKU billing unverified |
| Spend-cap API | [official procedure](https://docs.cloud.google.com/billing/docs/how-to/budget-api-spend-cap), [REST schema](https://docs.cloud.google.com/billing/docs/reference/budget/rest/v1/billingAccounts.budgets): spendCap.inputState, CloudRun service152E-C115-5142, one-project/service scope, eligibility/latency/reset limits; template prints only, never calls API |
| Native tooling | Terraform1.17.2/google8.11.0 pinned lock; source-only init/fmt/validate; no plan/apply/destroy; Node24.19/PG17.11 Docker SHA pin recorded in evidence |

No public documentation is substituted for actual platform tests. The PSC/private
ALB/one-day synthetic retention proposals are called out in DECISIONS.md; owner
and independent review must accept the exact inventory before any future guard
change. Production app recovery/retention and all custody/OPS01 gates stay open.
