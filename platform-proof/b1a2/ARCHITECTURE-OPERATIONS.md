# B1a-2 placement, operational authority and exact cleanup

Baseline: ADR-005 Revision 3 at `ad705c8cf666ae4ec617e00cae37eaad7f3f4511`, PR #6's nine redlines; PR #18 reconciliation/DR-01–12; PR #19 provider decision; PR #20 INC1; PR #21 B1a. No original architecture document is edited. No provider choice is reopened. B1a proof does not incorporate the accepted application or enable business effects.

The approved O-1 delta returns the dedicated synthetic sealer to the runtime project. Ingress calls the same-project internal Run service using its own invoker identity and a separate bounded application caller key. All-traffic VPC egress and restricted-VIP DNS remain explicit. The sealer uses the runtime private subnet and the single runtime SQL PSC endpoint. It retains its own restricted SQL role and seal-before-ACK contract.

Custody retains separately administered GCS/KMS/observer identity/signing secret. Sealer writes generation-zero immutable session slots and has prefix-bounded read/list recovery authority; no delete/IAM/admin. Runtime/deployer cannot obtain the observer signing key. A customer-supplied HTTP field cannot become an authenticated observation. Administrative custody authority is a separate higher-trust boundary; this disposable journal is not a replacement for production authenticated archive/index extension gates.

Runtime gateway → runtime NAT → independently authenticated fake HTTPS VM in the fake project. Only gateway NAT /32 and IAP 35.235.240.0/20 may reach fake443; mTLS separately identifies gateway epochs and the observer. Fake restricted-Google-VIP egress/DNS/route supports future immutable evidence export/approved artifact access. No public0/0 fake ingress or SSH path is required. This is a locally validated **model**, not actual GCP firewall evidence. The fake's provider ledger remains available to observe forbidden old initiations rather than silently revoking its TLS identity and hiding them.

`inventory.json` lists every Terraform address, planned name, project, cleanup identity, dependencies, lifetime and retention. Starting119, O-1 removes30 network/ALB/PSC/DNS/certificate resources, leaving89 before additions. The final source includes140 resources: additions are bootstrap bundles, corrected scoped IAM/cleanup/observer authority and fake restricted/IAP paths, not a second custody serving stack. IAM resources have no per-resource hourly charge; active network/compute costs are modeled separately. The compiler does not execute the historical generator or rewrite old evidence.

## Authority

`ops/plan.mjs` emits the full command-to-identity-to-permission matrix. `requiredByCommand` derives requirements independently of the grant list. `ops/teardown-permissions.mjs` covers every inventory type, including SQL backups, IAM policy CAS, secrets, key versions, DNS, artifact repositories and local Terraform metadata. Missing rights block execution/simulation rather than borrowing the deployer.

Normal deployer can attach only enumerated runtime service identities. Traffic change requires the staged candidate gateway's `iam.serviceAccounts.actAs` and repository read according to the Run traffic management guide. Whole-service emergency DELETE does not require actAs, repository download or deployer participation. Kill also has revision-delete, worker-delete and epoch-tag firewall update. IAM spelling is `run.workerpools.delete` (lowercase); REST v2 resource spelling `workerPools` is different.

Cleanup is separate from dispatch/deployer and more privileged: project policy removal is administrative within disposable projects. Exact inventory, read-modify-write etags and supervision are mandatory; this is not a grant to arbitrary production resources. Custody cleanup is separate. Human impersonation requires `iam.serviceAccounts.getAccessToken` on only approved role SAs; no runtime is granted that authority. Exact billing-account budget get/delete is an owner-supplied **manual prerequisite**, not an invented Terraform project-role binding on a billing account. Source validation checks the required scope; actual IAM support/effective grants must be independently checked before any authorized execution.

## Seven steps and interruption

1. Stage pinned candidate inert, own identity/tag, no traffic.
2. Advance SQL epoch with CAS, dispatch=false; old bindings preserved.
3. Move100% traffic to candidate and remove old traffic tags.
4. Enable old v4/v6 deny; withdraw exact old secret/decrypt grants; request independent revision deletion. Cached secrets and established connections still require termination.
5. Gather complete signed clock/platform/metric/canary/ledger evidence. Missing or contradictory data holds. No new effects just because billing/lease/instance restarted.
6. Recover only retired ENTERED→UNKNOWN using original identities, with evidence complete. No resend or invented outcome.
7. Explicit guarded promotion by session/epoch/generation CAS. A protected hold cannot be cleared by restart, suspension recovery, budget reset or generic promotion. Rollback uses a fresh N+2, never reactivation of N.

`LocalOperationController` persists intent before effect. A crash after epoch advance cannot advance again on replay; original exact digest is probed before a result is appended. Unresolved readback holds. `PreparedOperationalAdapter` wires the restricted SQL controller, evidence decision and exact future gcloud argv. `FutureCloudCommandExecutor` checks the immutable source gate before any subprocess/credential access. No live CLI exists in this source; local CLI only prints a fixture plan/template.

`PreparedTerraformTeardown` constrains the pinned provider to owner-approved state lineage/serial/digest, exact original resource IDs and an independently administered cleanup principal outside the experiment-managed resources. Missing, replaced or ambiguous state holds; state removal alone requires a separate typed API absence probe. Embedded NAT is inspected on its parent router rather than treating a nonexistent child GET as proof of deletion. KMS versions require separate retirement evidence; metadata remains a residual.

`teardownInventory` reverses dependencies for **all140 addresses**, including IAM/resources absent from the shorter emergency command list. `simulateTeardown` tests exact identity/absence or HOLD; it never claims an unknown item is gone. This is a local complete inventory simulation, not a claim that every Terraform-provider destruction API has been executed. The blocked future Terraform transport and exact-resource API probe provide the execution contracts; source activation review must bind them to the independently authorized cleanup principal and verify their actual account permissions, provider behavior and API responses.

## Retention and residual closure

B1a uses one-day PITR/backup retention, final backup disabled, retain_backups_on_delete=false. No owner data. Before deletion export the approved synthetic evidence and verify its hashes. Stop/fence all epochs and workers; remove fake VM+boot disk, services/revisions, SQL+backups/PITR, NAT/router/IP/PSC/firewalls/routes/subnets/DNS, images/repos, secret versions, bucket generations and IAM in dependency order. Never run a broad wildcard purge.

KMS key rings **and CryptoKey metadata** cannot be individually deleted. Destroy all key versions on the explicit keys (24h scheduled destruction), verify no enabled versions, and record four metadata residuals; disposal of the dedicated projects requires separate owner authorization. Do not report them as deleted. Budget/IAM metadata and independent evidence retention also require explicit closure records. Verify resources/billing at+2h,+48h and the next statement. A stopped service or exhausted budget is not complete teardown.

## Official sources checked using public documentation only

- https://docs.cloud.google.com/run/docs/container-contract
- https://docs.cloud.google.com/sdk/gcloud/reference/run/worker-pools/update
- https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration
- https://docs.cloud.google.com/run/docs/reference/iam/permissions
- https://docs.cloud.google.com/run/docs/reference/rest/v1/namespaces.workerpools/delete
- https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.workerPools/delete
- https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.services/patch
- https://docs.cloud.google.com/iap/docs/using-tcp-forwarding
- https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z

Public documents do not verify the owner's account, quotas, Free Trial, billing currency, spend caps, effective IAM or actual platform behavior.
