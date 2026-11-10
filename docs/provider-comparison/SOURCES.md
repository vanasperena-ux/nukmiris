# Source register and evidence limits

All web checks below occurred **2026-11-09 America/Mexico_City** (execution UTC
date may be November10). Live documentation is mutable. These are documentation
checks, not account-specific prices, contract guarantees or platform experiments.

## Official pricing checks

| Source | Result used / check quality |
|---|---|
| [GCP Run](https://cloud.google.com/run/pricing) | Opened pricing tables; request/idle/instance/worker rates used in calculator; us-central1 candidate, on-demand. |
| [GCP SQL](https://cloud.google.com/sql/pricing) | Opened Enterprise CPU/RAM, single-zone SSD/backup hourly and shared-core tables. No Enterprise Plus default assumed; edition must be pinned. |
| [GCP NAT](https://cloud.google.com/nat/pricing) | Opened gateway/processing/IP rates; Direct VPC assignment accounting still unresolved. |
| [GCS](https://cloud.google.com/storage/pricing) | Opened regional pricing and flat-namespace operation table; ~$0.02 regional Standard from hourly price. Version/soft-delete amplification is a workload assumption. |
| [KMS](https://cloud.google.com/kms/pricing) | Opened software-version and crypto-operation table. Use destruction-capable software keys; no HSM entitlement priced. |
| [Secret Manager](https://cloud.google.com/secret-manager/pricing) | Opened version/access table and enabled/disabled billing note. Gross model applies no free usage deduction. |
| [GCP Free Trial](https://docs.cloud.google.com/free/docs/free-cloud-features) | Opened $300/90-day program, eligibility and stop-on-expiry behavior. Actual owner balance/expiry not accessed. |
| [Railway pricing](https://railway.com/pricing) and [plan docs](https://docs.railway.com/pricing/plans) | Opened both. Docs monthly convention used; per-second page normalization differs slightly and is disclosed in COSTS. Pro included-usage treatment avoids double counting. Builds documented free. |
| [Railway backups](https://docs.railway.com/volumes/backups) | Opened schedules/pricing: snapshots bill like volumes. |
| [Railway PITR](https://docs.railway.com/volumes/point-in-time-recovery) | Opened current native PITR, pgBackRest archive/base backup behavior. Does not establish independent recovery custody. |
| [Render pricing](https://render.com/pricing) | Direct open returned dynamic page shell without rate tables. Official-domain search-index extracts returned $7/$25 services, $19/$55 DB, $.30 DB storage. This is a dated indexed check, weaker than rendered live checkout. Reconfirm before spending. |
| [Render pricing change](https://render.com/blog/better-pricing-for-fast-growing-teams) | Direct open confirmed April2026 announcement, rollout completed August1, Pro $25/workspace, 25GB included then $.15/GB. Do not use old per-seat Professional pricing. |
| [Render compute plans](https://render.com/docs/compute-plans) and [plan change](https://render.com/docs/compute-plans-update) | Direct open confirms plan IDs/specs and renamed-plan convention; prices obtained as above. |
| [Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) | Open returned login gate. No independently verified current Mexico/category dollar rate; report uses explicitly hypothetical blended-rate sensitivity. |

## Capability evidence read

| Official source | Supported inference and limit |
|---|---|
| [Railway private networking](https://docs.railway.com/networking/private-networking) | Private service connectivity is available; this is not evidence of default-deny internet egress. |
| [Railway outbound networking](https://docs.railway.com/networking/outbound-networking) | Static outbound IPs/IPv6 controls are documented. Neither establishes an epoch-specific default-deny firewall covering all alternate paths. No assertion that every possible enterprise feature is absent. |
| [Railway deployment lifecycle](https://docs.railway.com/deployments/reference) | Docker deployment/removal/draining and retained-image rollback exist; not sufficient evidence of every frozen instance's termination with an independently scoped kill principal. |
| [Railway PostgreSQL](https://docs.railway.com/databases/postgresql) | Image derives from official Postgres with TLS support. Exact BYPASSRLS/bootstrap and maintenance policy still require probes/design. |
| [Render private networking](https://render.com/docs/private-network) | Same-workspace/region connectivity, environment controls on Pro, private service support. Not proof of independently enforced per-service provider egress denial. |
| [Render deploys](https://render.com/docs/deploys) | Platform deploy/shutdown lifecycle, automatic deployment options and restarts exist. No direct equivalence to ADR death-evidence protocol inferred. |
| [Render Node version](https://render.com/docs/node-version) | Node24 native support and explicit pin mechanisms; actual executable still needs reviewed hosted adapter. |
| [Render PostgreSQL](https://render.com/docs/postgresql-creating-connecting) | Managed paid DB/PITR/export support. |
| [Render credentials](https://render.com/docs/postgresql-credentials) | SQL-created users are supported but not dashboard-managed; does not establish BYPASSRLS or owner-role membership. Attempted `/docs/postgresql-users` failed; not treated as evidence. |
| [Render backups](https://render.com/docs/postgresql-backups) | Hobby three-day vs Pro seven-day PITR; restore creates new instance but copies network allowlist. Need explicit inert isolation. |
| [Postgres17 roles](https://www.postgresql.org/docs/17/sql-createrole.html) | Official role-attribute restrictions support need for privilege probes; generic PostgreSQL docs do not certify managed-provider permissions. |
| [Embedded Signup overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/) | This run received 429. PR18 Claude's 2026-11-09 successful first-party review is attributed prior evidence, not a successful independent re-fetch here. |

Additional authoritative GCP control evidence remains the pinned ADR/PR18 plus
Claude review: [Direct VPC](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc),
[revision management](https://docs.cloud.google.com/run/docs/managing/revisions),
[container contract](https://docs.cloud.google.com/run/docs/container-contract),
[SQL users](https://docs.cloud.google.com/sql/docs/postgres/users),
[SQL editions](https://docs.cloud.google.com/sql/docs/postgres/editions-intro).
These links are prior-review references, not new platform execution evidence.

Search also surfaced provider-hosted community answers. They were not used as
proof that a control is impossible or that a commercial guarantee exists. Missing
documentation means **NOT PROVEN**, not proven absent. No support enquiry or
message was sent to a provider, Claude or another person.
