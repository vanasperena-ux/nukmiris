import http from "node:http";
import https from "node:https";
import { hash } from "../../src/protocol.mjs";
// Immutable source gate. Neither flags, CI, env nor a JSON approval flag can
// activate cloud calls. A future separately reviewed source change is required.
export const LIVE_CLOUD_EXECUTION = false;
const receipts = new WeakMap(),
  caps = new WeakSet();
const SERVICES = new Set([
  "run",
  "monitoring",
  "logging",
  "compute",
  "storage",
  "secretmanager",
  "metadata",
  "jwks",
  "serviceusage",
  "sqladmin",
  "dns",
  "iam",
  "cloudkms",
  "artifactregistry",
  "billingbudgets",
  "orgpolicy",
  "resourcemanager",
]);
export function receiptData(v) {
  return receipts.get(v);
}
export function operation(
  service,
  method,
  url,
  {
    body = null,
    headers = {},
    sensitiveResponse = false,
    scope,
    responseType = "json",
  } = {},
) {
  if (
    !["json", "text"].includes(responseType) ||
    !SERVICES.has(service) ||
    !["GET", "POST", "PATCH", "DELETE"].includes(method) ||
    typeof url !== "string" ||
    !url.startsWith(
      service === "metadata" ? "http://metadata.google.internal/" : "https://",
    )
  )
    throw Error("bounded_api_operation_required");
  if (Object.keys(headers).some((k) => /authorization|cookie/i.test(k)))
    throw Error("credentials_are_transport_only");
  return Object.freeze({
    service,
    method,
    url,
    body,
    headers: Object.freeze(headers),
    sensitiveResponse,
    scope,
    responseType,
    digest: hash([service, method, url, body, scope, responseType]),
  });
}
function nativeRequest(url, op, authHeaders, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url),
      client = u.protocol === "https:" ? https : http,
      payload =
        op.body === null
          ? undefined
          : Buffer.from(
              typeof op.body === "string" ? op.body : JSON.stringify(op.body),
            );
    const request = client.request(
      u,
      {
        method: op.method,
        agent: false,
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
        headers: {
          ...op.headers,
          ...authHeaders,
          ...(payload
            ? {
                "content-type": "application/json",
                "content-length": payload.length,
              }
            : {}),
        },
      },
      (response) => {
        let bytes = 0;
        const parts = [];
        response.on("data", (b) => {
          bytes += b.length;
          if (bytes > 8388608)
            response.destroy(Error("bounded_api_response_size"));
          else parts.push(b);
        });
        response.on("end", () => {
          const raw = Buffer.concat(parts).toString("utf8");
          let value;
          try {
            value =
              op.responseType === "text" ? raw : raw ? JSON.parse(raw) : null;
          } catch {
            reject(Error("typed_json_api_response_required"));
            return;
          }
          resolve({
            status: response.statusCode,
            headers: response.headers,
            value,
            rawDigest: hash(raw),
          });
        });
        response.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => request.destroy(Error("bounded_api_deadline")),
      timeoutMs,
    );
    request.once("close", () => clearTimeout(timer));
    request.on("error", reject);
    request.end(payload);
  });
}
export function futureCloudTransport() {
  if (!LIVE_CLOUD_EXECUTION)
    throw Error("cloud_execution_requires_reviewed_activation_change");
  let transport, cached;
  transport = createTransport({
    mode: "CLOUD",
    tokenProvider: async () => {
      if (cached && cached.until > Date.now() + 60000) return cached.token;
      const r = await transport.request(
        operation(
          "metadata",
          "GET",
          "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
          {
            headers: { "Metadata-Flavor": "Google" },
            sensitiveResponse: true,
            scope: "bound-runtime-service-identity",
          },
        ),
      );
      if (
        r.status !== 200 ||
        r.metadataFlavor !== "Google" ||
        typeof r.value?.access_token !== "string" ||
        !Number.isFinite(r.value.expires_in)
      )
        throw Error("metadata_credential_unavailable");
      cached = {
        token: r.value.access_token,
        until: Date.now() + Math.min(r.value.expires_in, 3600) * 1000,
      };
      return cached.token;
    },
  });
  return transport;
}
/** Explicit localhost rewrite used by hermetic protocol servers. The intended
 * Google URL remains in the audit receipt. There is no redirect/retry/ADC path. */
export function localApiTransport({
  endpoint,
  now = Date.now,
  tokenProvider = async () => null,
}) {
  const u = new URL(endpoint);
  if (
    u.protocol !== "http:" ||
    u.hostname !== "127.0.0.1" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    Number(u.port) < 1024
  )
    throw Error("literal_local_api_fixture_required");
  return createTransport({
    mode: "LOCAL_SIMULATION",
    endpoint: u.origin,
    now,
    tokenProvider,
  });
}
function createTransport({
  mode,
  endpoint,
  now = Date.now,
  tokenProvider = async () => null,
}) {
  const t = Object.freeze({
    mode,
    async request(op) {
      if (
        !op ||
        !SERVICES.has(op.service) ||
        op.digest !==
          hash([
            op.service,
            op.method,
            op.url,
            op.body,
            op.scope,
            op.responseType,
          ])
      )
        throw Error("operation_binding_mismatch");
      if (mode === "CLOUD" && !LIVE_CLOUD_EXECUTION)
        throw Error("cloud_execution_disabled");
      const u = new URL(op.url),
        hosts = {
          run: "run.googleapis.com",
          monitoring: "monitoring.googleapis.com",
          logging: "logging.googleapis.com",
          compute: "compute.googleapis.com",
          storage: "storage.googleapis.com",
          secretmanager: "secretmanager.googleapis.com",
          serviceusage: "serviceusage.googleapis.com",
          sqladmin: "sqladmin.googleapis.com",
          dns: "dns.googleapis.com",
          iam: "iam.googleapis.com",
          cloudkms: "cloudkms.googleapis.com",
          artifactregistry: "artifactregistry.googleapis.com",
          billingbudgets: "billingbudgets.googleapis.com",
          orgpolicy: "orgpolicy.googleapis.com",
          resourcemanager: "cloudresourcemanager.googleapis.com",
          metadata: "metadata.google.internal",
          jwks: "www.googleapis.com",
        };
      if (u.hostname !== hosts[op.service] || u.username || u.password)
        throw Error("unapproved_api_origin");
      const begin = now(),
        token =
          op.service === "metadata" || op.service === "jwks"
            ? null
            : await tokenProvider(op.scope);
      const result = await nativeRequest(
          mode === "LOCAL_SIMULATION"
            ? endpoint + u.pathname + u.search
            : op.url,
          op,
          {
            ...(token ? { authorization: "Bearer " + token } : {}),
            "x-b1a2-api-service": op.service,
          },
          3000,
        ),
        end = now();
      if (end < begin) throw Error("observer_clock_regressed");
      const deepFreeze = (v) => {
        if (v && typeof v === "object") {
          Object.values(v).forEach(deepFreeze);
          Object.freeze(v);
        }
        return v;
      };
      const value = deepFreeze({
        operationDigest: op.digest,
        service: op.service,
        method: op.method,
        intendedUrl: op.url,
        scope: op.scope,
        requestedAt: begin,
        observedAt: end,
        status: result.status,
        rawDigest: result.rawDigest,
        value: result.value,
        provenance:
          mode === "LOCAL_SIMULATION"
            ? "LOCAL_PROTOCOL_FIXTURE"
            : "VERIFIED_TLS_GOOGLE_API",
        sensitive: op.sensitiveResponse,
        httpDate: Number.isFinite(Date.parse(result.headers.date))
          ? Date.parse(result.headers.date)
          : null,
        metadataFlavor: result.headers["metadata-flavor"] ?? null,
      });
      receipts.set(value, value);
      return value;
    },
  });
  caps.add(t);
  return t;
}
export function isApiTransport(v) {
  return caps.has(v);
}
