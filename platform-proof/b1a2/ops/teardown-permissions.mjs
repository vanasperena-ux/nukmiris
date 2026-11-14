export function teardownRequirements(v, c) {
  const scope =
    v.project === "RESOURCE_SCOPED"
      ? "projects/" + c.projects.custody.id
      : "projects/" + v.project;
  const permissions = {
    terraform_data: [],
    google_compute_network: ["compute.networks.get", "compute.networks.delete"],
    google_compute_subnetwork: [
      "compute.subnetworks.get",
      "compute.subnetworks.delete",
    ],
    google_sql_database_instance: [
      "cloudsql.instances.get",
      "cloudsql.backupRuns.list",
      "cloudsql.backupRuns.delete",
      "cloudsql.instances.delete",
    ],
    google_compute_address: [
      "compute.addresses.get",
      "compute.addresses.delete",
    ],
    google_compute_forwarding_rule: [
      "compute.forwardingRules.get",
      "compute.forwardingRules.delete",
    ],
    google_compute_router: ["compute.routers.get", "compute.routers.delete"],
    google_compute_router_nat: [
      "compute.routers.get",
      "compute.routers.update",
    ],
    google_compute_firewall: [
      "compute.firewalls.get",
      "compute.firewalls.delete",
    ],
    google_compute_route: ["compute.routes.get", "compute.routes.delete"],
    google_dns_managed_zone: [
      "dns.managedZones.get",
      "dns.managedZones.delete",
    ],
    google_dns_record_set: [
      "dns.resourceRecordSets.list",
      "dns.changes.create",
    ],
    google_service_account: [
      "iam.serviceAccounts.get",
      "iam.serviceAccounts.delete",
    ],
    google_cloud_run_v2_service: ["run.services.get", "run.services.delete"],
    google_cloud_run_v2_worker_pool: [
      "run.workerpools.get",
      "run.workerpools.delete",
    ],
    google_secret_manager_secret: [
      "secretmanager.secrets.get",
      "secretmanager.versions.list",
      "secretmanager.versions.destroy",
      "secretmanager.secrets.delete",
    ],
    google_storage_bucket: [
      "storage.buckets.get",
      "storage.objects.get",
      "storage.objects.list",
      "storage.objects.delete",
      "storage.buckets.delete",
    ],
    google_kms_key_ring: [],
    google_kms_crypto_key: [
      "cloudkms.cryptoKeyVersions.list",
      "cloudkms.cryptoKeyVersions.destroy",
    ],
    google_artifact_registry_repository: [
      "artifactregistry.repositories.get",
      "artifactregistry.repositories.delete",
    ],
    google_compute_instance: [
      "compute.instances.get",
      "compute.instances.delete",
      "compute.disks.delete",
    ],
    google_cloud_run_v2_service_iam_member: [
      "run.services.getIamPolicy",
      "run.services.setIamPolicy",
    ],
    google_secret_manager_secret_iam_member: [
      "secretmanager.secrets.getIamPolicy",
      "secretmanager.secrets.setIamPolicy",
    ],
    google_kms_crypto_key_iam_member: [
      "cloudkms.cryptoKeys.getIamPolicy",
      "cloudkms.cryptoKeys.setIamPolicy",
    ],
    google_storage_bucket_iam_member: [
      "storage.buckets.getIamPolicy",
      "storage.buckets.setIamPolicy",
    ],
    google_billing_budget: ["billing.budgets.get", "billing.budgets.delete"],
    google_org_policy_policy: [
      "orgpolicy.policies.get",
      "orgpolicy.policies.delete",
    ],
    google_project_iam_custom_role: ["iam.roles.get", "iam.roles.delete"],
    google_project_iam_member: [
      "resourcemanager.projects.getIamPolicy",
      "resourcemanager.projects.setIamPolicy",
    ],
    google_service_account_iam_member: [
      "iam.serviceAccounts.getIamPolicy",
      "iam.serviceAccounts.setIamPolicy",
    ],
    google_artifact_registry_repository_iam_member: [
      "artifactregistry.repositories.getIamPolicy",
      "artifactregistry.repositories.setIamPolicy",
    ],
  }[v.type];
  if (!permissions) throw Error("unmapped_inventory_type " + v.type);
  const effectiveScope =
    v.type === "google_billing_budget"
      ? "billingAccounts/" + c.budget.billingAccountId
      : v.type.includes("storage_bucket")
        ? "buckets/" + c.names.bucket
        : scope;
  return [{ scope: effectiveScope, permissions }];
}
export function assertTeardownAuthority(manifest, c, grants) {
  for (const item of manifest.inventory) {
    const principal = c.serviceIdentities[item.cleanupRole];
    if (!principal) throw Error("cleanup_identity_missing " + item.address);
    for (const r of teardownRequirements(item, c))
      for (const p of r.permissions)
        if (
          !grants.some(
            (g) =>
              g.principal === principal &&
              g.scope === r.scope &&
              g.permissions.includes(p),
          )
        )
          throw Error(
            "teardown_permission_missing " +
              item.address +
              " " +
              p +
              " " +
              r.scope,
          );
  }
  return true;
}
