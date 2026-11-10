# Primary source register and access limits

Checked2026-11-09 America/Mexico_City (UTC2026-11-10). Public documentation reads
only; no Meta/Calendar business API, cloud account, credential or resource access.
Amounts derived in04 are estimates, not source quotations. No article bodies copied.

| ID | Official source | Used for / observed limit |
|---|---|---|
| G01 |https://cloud.google.com/run/pricing |Iowa request/instance/worker rates, shared monthly free usage and currency caveat |
| G02 |https://docs.cloud.google.com/run/docs/configuring/billing-settings |CPU allocation/lifecycle and current Cloud Run spend-cap description |
| G03 |https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc |Startup delays, API/VPC configuration, ephemeral addresses, /26 sizing, delayed subnet release and observability limitations |
| G04 |https://docs.cloud.google.com/run/docs/managing/revisions |Traffic/latest/only-revision deletion restrictions; image storage not automatically removed |
| G05 |https://docs.cloud.google.com/vpc/docs/firewalls |Redirects to firewall docs; established-connection behavior |
| G06 |https://cloud.google.com/sql/pricing |Explicit Enterprise compute, single-zone SSD/backup and shared-core/no-SLA rates; actual edition/settings must be pinned |
| G07 |https://docs.cloud.google.com/sql/docs/postgres/users |Managed admin restrictions, custom roles and IAM versus built-in users |
| G08 |https://docs.cloud.google.com/sql/docs/postgres/iam-authentication |SSL/IAM/connector/session identity implications; no assumption fixture login names map automatically |
| G09 |https://www.postgresql.org/docs/17/sql-alterrole.html |BYPASSRLS attribute-change privilege condition; not a live Cloud SQL compatibility test |
| G10 |https://cloud.google.com/nat/pricing |Published gateway/IP/data formula; does not verify exact Direct VPC metering |
| G11 |https://cloud.google.com/storage/pricing |Regional Standard bytes, generations/soft-delete, operations/egress and early-deletion classes |
| G12 |https://cloud.google.com/kms/pricing |Software versions/operations; disabled and pending destruction versions still have cost |
| G13 |https://cloud.google.com/secret-manager/pricing |Version/access/replication cost and shared free allowances |
| G14 |https://docs.cloud.google.com/free/docs/free-cloud-features |Trial restrictions, exhaustion/upgrade/expiry; owner account balance/quotas NOT inspected |
| G15 |https://docs.cloud.google.com/billing/docs/how-to/budgets |Alerts-only budgets and reporting delay caveat |
| G16 |https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps |Eligible-service/project scope, delayed estimated gross costs, residual persistent costs and auto-reset |
| G17 |https://developers.google.com/workspace/calendar/api/v3/reference/events |Operation-ID encoding/length and non-guaranteed duplicate-ID collision detection; no API call made |
| M01 |https://business.whatsapp.com/partners/become-a-partner |Redirects to https://whatsappbusiness.com/partners/become-a-partner/; Tech Provider path and Solution-Partner credit-line distinction |
| M02 |https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup |Meta official collection indexed text supports general signup/App Review/management scopes; live page JS shell, current detailed version/requirements NOT established |
| M03 |https://about.fb.com/news/2025/09/bringing-new-tools-to-help-businesses-boost-engagement-customer-support-and-discoverability/ |First-party announcement of same-number Business App/Platform coexistence; not universal current eligibility proof |
| M04 |https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview |HTTP429; current technical details NOT VERIFIED |
| M05 |https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider |HTTP429; actual partner approval/flow/token lifecycle NOT VERIFIED |
| M06 |https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users |HTTP429; current coexistence country/version/echo/history restrictions NOT VERIFIED |

Secondary search results were useful for locating primary URLs only. No vendor
mirror, partner blog, forum, dated SDK snippet or claimed token lifetime substitutes
for current first-party verification/account eligibility. No bypass/repeated live
provider probing was used. Exact VM SKU, Cloud SQL actual privilege attributes,
trial quotas/org controls, retention region and invoices remain pre-authorization
checks. They are not inferred from a successful documentation fetch.
