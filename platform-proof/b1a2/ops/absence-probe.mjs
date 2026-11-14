import {
  operation,
  isApiTransport,
  receiptData,
} from "../runtime/transport.mjs";
/** Independent exact GET after provider/state removal. Unknown API shape, paging,
 * permission/network failure or an existing binding never count as absence. */
export class ExactResourceProbe {
  constructor({ transport, inputs }) {
    if (!isApiTransport(transport)) throw Error("verified_transport_required");
    this.t = transport;
    this.c = inputs;
  }
  async read(original) {
    if (!original) return { state: "UNKNOWN" };
    const { type, id, project, attributes: a = {} } = original,
      c = this.c;
    if (!Object.values(c.projects).some((p) => p.id === project))
      throw Error("foreign_absence_project");
    const clean = (v) => {
      if (
        typeof v !== "string" ||
        v.includes("..") ||
        !/^[a-zA-Z0-9_@.:/+-]+$/.test(v)
      )
        throw Error("exact_resource_probe_identifier");
      return v;
    };
    let service,
      url,
      method = "GET",
      body = null,
      policy = false,
      list = false;
    if (type === "terraform_data")
      return { id, state: "ABSENT", meaning: "LOCAL_STATE_METADATA_ONLY" };
    const resource = type.includes("_iam_member") ? id : clean(id),
      q = clean(project);
    if (
      resource.startsWith("projects/") &&
      !resource.startsWith("projects/" + q + "/") &&
      !resource.startsWith(
        "projects/" +
          Object.values(c.projects).find((p) => p.id === q).number +
          "/",
      )
    )
      throw Error("foreign_resource_identity");
    if (type === "google_compute_router_nat") {
      service = "compute";
      url =
        "https://compute.googleapis.com/compute/v1/projects/" +
        q +
        "/regions/" +
        clean(a.region) +
        "/routers/" +
        clean(a.router);
      list = "NAT";
    } else if (type.startsWith("google_compute_")) {
      service = "compute";
      url = "https://compute.googleapis.com/compute/v1/" + resource;
    } else if (type === "google_sql_database_instance") {
      service = "sqladmin";
      url =
        "https://sqladmin.googleapis.com/sql/v1beta4/projects/" +
        q +
        "/instances/" +
        clean(a.name);
    } else if (type === "google_dns_record_set") {
      service = "dns";
      url =
        "https://dns.googleapis.com/dns/v1/projects/" +
        q +
        "/managedZones/" +
        clean(a.managed_zone) +
        "/rrsets?" +
        new URLSearchParams({ name: a.name, type: a.type });
      list = true;
    } else if (type === "google_dns_managed_zone") {
      service = "dns";
      url =
        "https://dns.googleapis.com/dns/v1/projects/" +
        q +
        "/managedZones/" +
        clean(a.name);
    } else if (type === "google_service_account") {
      service = "iam";
      url = "https://iam.googleapis.com/v1/" + resource;
    } else if (type === "google_project_iam_custom_role") {
      service = "iam";
      url = "https://iam.googleapis.com/v1/" + resource;
    } else if (
      type === "google_cloud_run_v2_service" ||
      type === "google_cloud_run_v2_worker_pool"
    ) {
      service = "run";
      url = "https://run.googleapis.com/v2/" + resource;
    } else if (type === "google_secret_manager_secret") {
      service = "secretmanager";
      url = "https://secretmanager.googleapis.com/v1/" + resource;
    } else if (type === "google_storage_bucket") {
      if (id !== c.names.bucket) throw Error("foreign_bucket");
      service = "storage";
      url = "https://storage.googleapis.com/storage/v1/b/" + clean(id);
    } else if (type === "google_artifact_registry_repository") {
      service = "artifactregistry";
      url = "https://artifactregistry.googleapis.com/v1/" + resource;
    } else if (type === "google_billing_budget") {
      if (
        !resource.startsWith(
          "billingAccounts/" + c.budget.billingAccountId + "/budgets/",
        )
      )
        throw Error("foreign_budget");
      service = "billingbudgets";
      url = "https://billingbudgets.googleapis.com/v1/" + resource;
    } else if (type === "google_org_policy_policy") {
      service = "orgpolicy";
      url = "https://orgpolicy.googleapis.com/v2/" + resource;
    } else if (type.includes("_iam_member")) {
      policy = true;
      if (type === "google_project_iam_member") {
        service = "resourcemanager";
        url =
          "https://cloudresourcemanager.googleapis.com/v1/projects/" +
          q +
          ":getIamPolicy";
        method = "POST";
        body = { options: { requestedPolicyVersion: 3 } };
      } else if (type === "google_service_account_iam_member") {
        service = "iam";
        url =
          "https://iam.googleapis.com/v1/" +
          clean(a.service_account_id) +
          ":getIamPolicy";
        method = "POST";
        body = { options: { requestedPolicyVersion: 3 } };
      } else if (type === "google_secret_manager_secret_iam_member") {
        service = "secretmanager";
        url =
          "https://secretmanager.googleapis.com/v1/" +
          clean(a.secret_id) +
          ":getIamPolicy";
      } else if (type === "google_kms_crypto_key_iam_member") {
        service = "cloudkms";
        url =
          "https://cloudkms.googleapis.com/v1/" +
          clean(a.crypto_key_id) +
          ":getIamPolicy";
      } else if (type === "google_storage_bucket_iam_member") {
        if (a.bucket !== c.names.bucket) throw Error("foreign_bucket");
        service = "storage";
        url =
          "https://storage.googleapis.com/storage/v1/b/" +
          clean(a.bucket) +
          "/iam";
      } else if (type === "google_cloud_run_v2_service_iam_member") {
        service = "run";
        url =
          "https://run.googleapis.com/v2/projects/" +
          q +
          "/locations/" +
          c.region +
          "/services/" +
          clean(a.name) +
          ":getIamPolicy";
      } else if (type === "google_artifact_registry_repository_iam_member") {
        service = "artifactregistry";
        url =
          "https://artifactregistry.googleapis.com/v1/projects/" +
          q +
          "/locations/" +
          clean(a.location) +
          "/repositories/" +
          clean(a.repository) +
          ":getIamPolicy";
      }
    }
    if (!service || !url)
      return {
        id,
        state: "UNKNOWN",
        reason: "independent_probe_contract_missing",
      };
    const r = await this.t.request(
      operation(service, method, url, { body, scope: project }),
    );
    if (!receiptData(r)) throw Error("unverified_absence_receipt");
    if (r.status === 404)
      return { id, state: "ABSENT", rawDigest: r.rawDigest };
    if (r.status !== 200)
      return { id, state: "UNKNOWN", rawDigest: r.rawDigest };
    if (
      policy &&
      Array.isArray(r.value?.bindings) &&
      !r.value.bindings.some(
        (b) => b.role === a.role && b.members?.includes(a.member),
      )
    )
      return {
        id,
        state: "ABSENT",
        rawDigest: r.rawDigest,
        meaning: "EXACT_IAM_MEMBER_REMOVED",
      };
    if (
      list === "NAT" &&
      Array.isArray(r.value?.nats) &&
      !r.value.nats.some((n) => n.name === a.name)
    )
      return { id, state: "ABSENT", rawDigest: r.rawDigest };
    if (
      list === true &&
      Array.isArray(r.value?.rrsets) &&
      r.value.rrsets.length === 0 &&
      !r.value.nextPageToken
    )
      return { id, state: "ABSENT", rawDigest: r.rawDigest };
    if (type === "google_project_iam_custom_role" && r.value?.deleted === true)
      return {
        id,
        state: "ABSENT",
        rawDigest: r.rawDigest,
        meaning: "ROLE_SOFT_DELETED_METADATA_RETAINED",
      };
    return { id, state: "PRESENT_OR_INCOMPLETE", rawDigest: r.rawDigest };
  }
  async keyVersions(original) {
    if (
      original?.type !== "google_kms_crypto_key" ||
      !Object.values(this.c.projects).some((p) =>
        original.id.startsWith("projects/" + p.id + "/"),
      ) ||
      original.id.includes("..")
    )
      throw Error("exact_key_identity_required");
    const r = await this.t.request(
      operation(
        "cloudkms",
        "GET",
        "https://cloudkms.googleapis.com/v1/" +
          original.id +
          "/cryptoKeyVersions",
        { scope: original.project },
      ),
    );
    if (
      !receiptData(r) ||
      r.status !== 200 ||
      r.value?.nextPageToken ||
      !Array.isArray(r.value?.cryptoKeyVersions) ||
      r.value.cryptoKeyVersions.some(
        (v) => !["DESTROY_SCHEDULED", "DESTROYED"].includes(v.state),
      )
    )
      return { state: "HOLD", id: original.id };
    return {
      state: "VERSIONS_RETIRED",
      id: original.id,
      rawDigest: r.rawDigest,
      metadataStillExists: true,
    };
  }
}
