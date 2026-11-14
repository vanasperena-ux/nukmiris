import { operation, isApiTransport, receiptData } from "./transport.mjs";
const safeName = (x) => {
  if (
    typeof x !== "string" ||
    !/^[a-zA-Z0-9_.:/-]{1,512}$/.test(x) ||
    x.includes("..")
  )
    throw Error("exact_resource_identifier_required");
  return x;
};
const checked = (r, statuses = [200]) => {
  if (!receiptData(r) || !statuses.includes(r.status))
    throw Error("platform_evidence_unavailable_" + (r?.status ?? "unverified"));
  return r;
};
export class CloudApi {
  constructor({ inputs, transport }) {
    if (!isApiTransport(transport))
      throw Error("verified_transport_capability_required");
    this.c = inputs;
    this.t = transport;
  }
  get serviceName() {
    return (
      "projects/" +
      this.c.projects.runtime.id +
      "/locations/" +
      this.c.region +
      "/services/" +
      this.c.names.gateway
    );
  }
  async revision(revision) {
    return checked(
      await this.t.request(
        operation(
          "run",
          "GET",
          "https://run.googleapis.com/v2/" +
            this.serviceName +
            "/revisions/" +
            safeName(revision),
          { scope: this.serviceName },
        ),
      ),
      [200, 404],
    );
  }
  async service() {
    return checked(
      await this.t.request(
        operation(
          "run",
          "GET",
          "https://run.googleapis.com/v2/" + this.serviceName,
          { scope: this.serviceName },
        ),
      ),
    );
  }
  async deletionOperation(name) {
    if (
      !name.startsWith(
        "projects/" +
          this.c.projects.runtime.id +
          "/locations/" +
          this.c.region +
          "/operations/",
      )
    )
      throw Error("foreign_deletion_operation");
    return checked(
      await this.t.request(
        operation(
          "run",
          "GET",
          "https://run.googleapis.com/v2/" + safeName(name),
          { scope: this.serviceName },
        ),
      ),
    );
  }
  async instanceCounts({ revision, start, end }) {
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end < start ||
      end - start > 21600000
    )
      throw Error("bounded_metric_interval_required");
    const query = new URLSearchParams({
      filter:
        'metric.type="run.googleapis.com/container/instance_count" AND resource.type="cloud_run_revision" AND resource.labels.service_name="' +
        this.c.names.gateway +
        '" AND resource.labels.revision_name="' +
        safeName(revision) +
        '"',
      "interval.startTime": new Date(start).toISOString(),
      "interval.endTime": new Date(end).toISOString(),
      view: "FULL",
    });
    return checked(
      await this.t.request(
        operation(
          "monitoring",
          "GET",
          "https://monitoring.googleapis.com/v3/projects/" +
            this.c.projects.runtime.id +
            "/timeSeries?" +
            query,
          { scope: this.serviceName },
        ),
      ),
    );
  }
  async logs({ kind = "revision", revision, pageToken }) {
    if (
      !["revision", "nat"].includes(kind) ||
      (pageToken && !/^[a-zA-Z0-9_-]{1,2048}$/.test(pageToken))
    )
      throw Error("bounded_log_query");
    const filter =
      kind === "revision"
        ? 'resource.type="cloud_run_revision" AND resource.labels.revision_name="' +
          safeName(revision) +
          '"'
        : 'resource.type="nat_gateway" AND logName:"compute.googleapis.com%2Fnat_flows"';
    return checked(
      await this.t.request(
        operation(
          "logging",
          "POST",
          "https://logging.googleapis.com/v2/entries:list",
          {
            scope: "projects/" + this.c.projects.runtime.id,
            body: {
              resourceNames: ["projects/" + this.c.projects.runtime.id],
              filter,
              orderBy: "timestamp asc",
              pageSize: 1000,
              ...(pageToken ? { pageToken } : {}),
            },
          },
        ),
      ),
    );
  }
  async secretVersion(ref) {
    const allowed = [
      this.c.projects.runtime.id,
      this.c.projects.custody.id,
      this.c.projects.fake.id,
    ];
    if (
      !/^projects\/[a-z0-9-]+\/secrets\/b1a2-[a-z0-9-]+\/versions\/[1-9][0-9]*$/.test(
        ref,
      ) ||
      !allowed.includes(ref.split("/")[1])
    )
      throw Error("pinned_b1a2_secret_version_required");
    return checked(
      await this.t.request(
        operation(
          "secretmanager",
          "GET",
          "https://secretmanager.googleapis.com/v1/" + ref + ":access",
          { scope: ref, sensitiveResponse: true },
        ),
      ),
    );
  }
  async metadataIdentity(audience) {
    if (
      typeof audience !== "string" ||
      (!/^https:\/\/[a-z0-9.-]+\.run\.app\/?$/.test(audience) &&
        !/^https:\/\/b1a2-attestation\.invalid\/[a-f0-9-]{36}\/(gateway|ingress|worker|sealer)\/[a-f0-9]{64}$/.test(
          audience,
        ))
    )
      throw Error("exact_cloud_run_audience_required");
    return checked(
      await this.t.request(
        operation(
          "metadata",
          "GET",
          "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?" +
            new URLSearchParams({ audience, format: "full" }),
          {
            headers: { "Metadata-Flavor": "Google" },
            scope: audience,
            sensitiveResponse: true,
            responseType: "text",
          },
        ),
      ),
    );
  }
  async metadataToken() {
    return checked(
      await this.t.request(
        operation(
          "metadata",
          "GET",
          "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
          {
            headers: { "Metadata-Flavor": "Google" },
            scope: "platform-read-or-custody-only",
            sensitiveResponse: true,
          },
        ),
      ),
    );
  }
  async googleSigningKeys() {
    return checked(
      await this.t.request(
        operation("jwks", "GET", "https://www.googleapis.com/oauth2/v3/certs", {
          scope: "google-public-identity-keys",
        }),
      ),
    );
  }
  async storage(method, name, { body = null, generation } = {}) {
    if (
      !["GET", "PUT", "LIST"].includes(method) ||
      typeof name !== "string" ||
      !name.startsWith("sessions/" + this.c.session.id + "/") ||
      name.includes("..") ||
      name.length > 512
    )
      throw Error("session_scoped_custody_object_required");
    const bucket = this.c.names.bucket;
    let url, verb;
    if (method === "PUT") {
      url =
        "https://storage.googleapis.com/upload/storage/v1/b/" +
        bucket +
        "/o?" +
        new URLSearchParams({
          uploadType: "media",
          name,
          ifGenerationMatch: "0",
        });
      verb = "POST";
    } else if (method === "LIST") {
      url =
        "https://storage.googleapis.com/storage/v1/b/" +
        bucket +
        "/o?" +
        new URLSearchParams({ prefix: name, versions: "false" });
      verb = "GET";
    } else {
      url =
        "https://storage.googleapis.com/storage/v1/b/" +
        bucket +
        "/o/" +
        encodeURIComponent(name) +
        "?" +
        new URLSearchParams({
          alt: "media",
          ...(generation ? { generation: String(generation) } : {}),
        });
      verb = "GET";
    }
    return checked(
      await this.t.request(
        operation("storage", verb, url, {
          body,
          scope: "buckets/" + bucket + "/" + name,
        }),
      ),
      method === "PUT" ? [200, 201, 412] : [200, 404],
    );
  }
  async component(role) {
    if (!["gateway", "ingress", "sealer", "worker"].includes(role))
      throw Error("prepared_role_required");
    return checked(
      await this.t.request(
        operation(
          "run",
          "GET",
          "https://run.googleapis.com/v2/projects/" +
            this.c.projects.runtime.id +
            "/locations/" +
            this.c.region +
            "/" +
            (role === "worker" ? "workerPools" : "services") +
            "/" +
            this.c.names[role],
          { scope: "projects/" + this.c.projects.runtime.id },
        ),
      ),
    );
  }
  async preparationLogs(role) {
    if (!["gateway", "worker", "ingress", "sealer"].includes(role))
      throw Error("prepared_role_required");
    const filter =
      'jsonPayload.event="B1A2_PREPARED" AND jsonPayload.sessionId="' +
      this.c.session.id +
      '" AND jsonPayload.role="' +
      role +
      '" AND resource.labels.' +
      (role === "worker" ? "worker_pool_name" : "service_name") +
      '="' +
      this.c.names[role] +
      '"';
    return checked(
      await this.t.request(
        operation(
          "logging",
          "POST",
          "https://logging.googleapis.com/v2/entries:list",
          {
            scope: "projects/" + this.c.projects.runtime.id,
            body: {
              resourceNames: ["projects/" + this.c.projects.runtime.id],
              filter,
              pageSize: 1000,
              orderBy: "timestamp desc",
            },
          },
        ),
      ),
    );
  }
  async quotaMetrics() {
    return checked(
      await this.t.request(
        operation(
          "serviceusage",
          "GET",
          "https://serviceusage.googleapis.com/v1beta1/projects/" +
            this.c.projects.runtime.number +
            "/services/run.googleapis.com/consumerQuotaMetrics?view=FULL",
          { scope: "projects/" + this.c.projects.runtime.id },
        ),
      ),
    );
  }
  async enabledService(api) {
    if (!this.c.allowedApis.includes(api)) throw Error("unapproved_service");
    return checked(
      await this.t.request(
        operation(
          "serviceusage",
          "GET",
          "https://serviceusage.googleapis.com/v1/projects/" +
            this.c.projects.runtime.number +
            "/services/" +
            api,
          { scope: "projects/" + this.c.projects.runtime.id },
        ),
      ),
    );
  }
}
/** Decode true API responses; a missing label/interval is never zero-filled. */
export function decodeCounts(
  receipt,
  { service, revision, requiredStates = ["active", "idle"] },
) {
  checked(receipt);
  if (
    receipt.service !== "monitoring" ||
    !Array.isArray(receipt.value?.timeSeries) ||
    receipt.value.nextPageToken
  )
    throw Error("complete_metric_page_required");
  const buckets = new Map();
  for (const series of receipt.value.timeSeries) {
    if (
      series.metric?.type !== "run.googleapis.com/container/instance_count" ||
      series.resource?.labels?.service_name !== service ||
      series.resource?.labels?.revision_name !== revision ||
      !requiredStates.includes(series.metric?.labels?.state) ||
      !Array.isArray(series.points)
    )
      throw Error("metric_resource_or_state_mismatch");
    for (const point of series.points) {
      const sampleAt = Date.parse(point.interval?.endTime),
        state = series.metric.labels.state,
        value = Number(point.value?.int64Value);
      if (
        !Number.isFinite(sampleAt) ||
        point.value?.int64Value === undefined ||
        !Number.isSafeInteger(value) ||
        value < 0 ||
        sampleAt > receipt.observedAt
      )
        throw Error("invalid_instance_gauge");
      const b = buckets.get(sampleAt) ?? {
        sampleAt,
        visibleAt: receipt.observedAt,
        states: {},
        rawDigest: receipt.rawDigest,
        visibilityMeaning: "FIRST_OBSERVER_READ_UPPER_BOUND",
      };
      if (Object.hasOwn(b.states, state))
        throw Error("duplicate_instance_state_sample");
      b.states[state] = value;
      buckets.set(sampleAt, b);
    }
  }
  const rows = [...buckets.values()].sort((a, b) => a.sampleAt - b.sampleAt);
  if (
    !rows.length ||
    rows.some((b) => requiredStates.some((k) => !Object.hasOwn(b.states, k)))
  )
    throw Error("missing_instance_state_series");
  return rows;
}
