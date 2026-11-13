# Minimum Phase3a inventory — deliberately nondeployable plan

Google Cloud preferred, candidate **us-central1**. Exact machine-readable inventory:
[inventory.json](inventory.json); provider-schema-validated skeleton:
[terraform/main.tf.json](terraform/main.tf.json). Terraform1.17.2,
Google provider8.11.0 pinned in versions.tf/.terraform.lock.hcl. No plan/apply,
API enablement, provider credential, billing/project lookup or Cloud SQL probe run.

Every resource depends on an impossible apply precondition (false by default;
validation forbids true). Provider has a literal invalid token to prevent implicit
ADC use. Project/billing IDs, fake-provider destination and container digest are
placeholders. There is no repository apply workflow. Native validation establishes
syntax/schema only; it does not establish API acceptance, IAM, permissions, region
quotas, connectivity, lifecycle or costs. Do not remove the gate opportunistically.

**Inventory:** warm request-billed ingress and independently administered warm
custody sealer, instance-billed gateway unique epoch/tag/SA, manual1 continuous
worker pool; zonal PostgreSQL17 Enterprise db-f1-micro private IP,10GiB bounded
SSD, encrypted SQL transport, IAM authentication flag, UTC; gateway-only subnet/NAT
and staticIP, private-only other subnet and PSA reserved range; default-deny egress,
scoped SQL/private API/fake-provider allowances; separate custody bucket/KMS/SA;
platform secret metadata only; separate inert fake-host VM/disk/IP/project;
artifact repository and three gross alerts. No additional broker, scheduler, LB,
Cloud Armor, always-on second worker or permanent staging is required here.

**Connections:** assumed f1 default25 is unmeasured/secondary-source, not a quota
claim. Maximum planned pools: old/new gateway2 each +worker2 +ingress1 +sealer1
+operator1 +reserve4 =13≤15. Entry/result share gateway's2, not two independent
pools. Instances can transiently overshoot maxima: count every old/new/replacement
process before promotion; refuse rollout if its pool inventory exceeds budget.
This is only minimal Phase3a, never application B1b sizing. G1-small is a priced
alternative, not silently selected. Explicit ENTERPRISE prevents PostgreSQL17
Enterprise Plus defaults from forcing a larger incompatible tier. Measure actual
limits/CPU/queueing before any longer experiment.

**Deliberate completion gates:** identity definitions are present; no IAM role
grants are supplied. Design least privilege before apply: ingress can invoke
sealer; sealer create/verify custody under distinct administration; worker can
plan but has no provider decrypt/credentials; gateway can narrowly enter/finish and
read only epoch-scoped synthetic secret/decrypt material; observer read-only
platform/ledger; independent kill principal outside deployer can deny egress and
delete revisions/revoke scoped access; cleanup/billing operators separate roles.
No broad owner/editor grant is acceptable runtime. No default service-account
provider credentials. No provider-capable image exists in this increment.

The sealer cross-project private invocation, its own VPC/private API route,
private DNS/restricted Google API resolution, control-plane enforcement of
all-traffic, any required VPC-SC/PSC, signed per-epoch fake-host authentication,
log sinks/retention, kill/expiry controller and exact IAM custom roles still need
B1a source/review. Their absence is a **provisioning blocker**, not working network
proof. Private Google Access can reach Calendar APIs; only gateway credential
custody plus verified old-tag deny/termination contains that route (RL-5).
The fake VM is inert and needs pinned image/TLS/journal/deploy identity before use.
PSA deletion_policy ABANDON means Terraform removal alone is not teardown: the
print-only checklist explicitly requires removing peering and reserved range.

**Costs:** [offline script](calculate-costs.py) additively preserves PR18 evidence;
[results](cost-results.json) include ≤6h, max1 load (old/new gateway overlap priced),
G1, unverified Enterprise Plus SKU sensitivity and residuals. Six-hour fixed
allowances are deliberately conservative, not prorated away. First cloud session
proposal stays about$20 with named continuous supervision +independent elapsed-time
stop, never an authorization.72h only after measured6h data and a new decision.
Gross alerts10/25/40 are notifications. Limits/quotas/credit do not cap total spend.

Google [spend-cap documentation](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)
checked2026-11-11 supports one project/eligible service (Cloud Run), monthly gross
estimated costs, delayed enforcement and automatic reset. Fixed resources keep
billing; no SQL cap is implied. Inert dispatch must survive cap pause and reset.
Provider8.11.0 has no spend-cap field in google_billing_budget: the skeleton's
budgets are alerts-only. A separate verified Billing Budgets API/console spend-cap
procedure and actual account eligibility remain a pre-provisioning gate. No
invented Cloud Run endpoint or applied spending cap is claimed.

Owner must still select organization vs documented weaker standalone controls,
name kill/cleanup/billing/supervision and backup humans, accept measured fence
threshold/G06, authorize precise inventory/≤6h/$20, approve retention/custody and
trial quotas. Do not upgrade billing. Target all teardown complete2026-12-17
(owner-reported trial expiryDec22); if review slips into~Dec8, skip trial window.
Independent INC1 acceptance precedes a **separately authorized** B1a implementation;
actual provisioning is yet another explicit resource-specific owner decision.
