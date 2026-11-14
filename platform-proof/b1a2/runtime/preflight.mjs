import { receiptData } from "./transport.mjs";
import { validateInputs } from "./inputs.mjs";
import { hash } from "../../src/protocol.mjs";
/** Evidence-preserving, read-only future preflight. No account discovery or
 * ambient scope selection. Every unknown response is a blocking result. */
export class PlatformPreflight {
  constructor({ inputs, api, journal, now = Date.now }) {
    this.c = inputs;
    this.api = api;
    this.journal = journal;
    this.now = now;
  }
  async run({ quotaRequirements, expectedService }) {
    if (
      !Array.isArray(quotaRequirements) ||
      !quotaRequirements.length ||
      !expectedService
    )
      return {
        state: "HOLD",
        reason: "exact_owner_quota_and_service_requirements_missing",
      };
    const refs = [];
    const keep = async (r) => {
      if (!receiptData(r) || r.sensitive)
        throw Error("preflight_verified_receipt_required");
      await this.journal.append({
        event: "PREFLIGHT_API_RECEIPT",
        raw: r.value,
        rawDigest: r.rawDigest,
        intendedUrl: r.intendedUrl,
        observedAt: r.observedAt,
      });
      refs.push(r.rawDigest);
      return r.value;
    };
    try {
      for (const api of this.c.allowedApis) {
        const v = await keep(await this.api.enabledService(api));
        if (v.state !== "ENABLED")
          throw Error("required_api_not_enabled " + api);
      }
      const svc = await keep(await this.api.service());
      if (
        svc.name !== this.api.serviceName ||
        svc.template?.serviceAccount !== expectedService.identity ||
        svc.template?.containers?.[0]?.image !== expectedService.image ||
        svc.template?.vpcAccess?.egress !== "ALL_TRAFFIC" ||
        svc.ingress !== "INGRESS_TRAFFIC_INTERNAL_ONLY"
      )
        throw Error("exact_service_identity_image_or_private_egress_mismatch");
      const quotas = await keep(await this.api.quotaMetrics());
      if (quotas.nextPageToken || !Array.isArray(quotas.metrics))
        throw Error("quota_export_incomplete");
      for (const req of quotaRequirements) {
        if (
          req.project !== this.c.projects.runtime.id ||
          typeof req.metric !== "string" ||
          typeof req.limit !== "string" ||
          !Number.isFinite(req.minimum) ||
          req.minimum <= 0
        )
          throw Error("approved_exact_quota_requirement_invalid");
        const metrics = quotas.metrics.filter((m) => m.metric === req.metric),
          limits = metrics
            .flatMap((m) => m.consumerQuotaLimits ?? [])
            .filter((l) => l.name === req.limit),
          buckets = limits
            .flatMap((l) => l.quotaBuckets ?? [])
            .filter((b) => b.dimensions?.region === this.c.region);
        if (
          buckets.length !== 1 ||
          !/^\d+$/.test(buckets[0].effectiveLimit ?? "") ||
          Number(buckets[0].effectiveLimit) < req.minimum
        )
          throw Error("required_quota_unknown_or_insufficient");
      }
      return {
        state: "PREFLIGHT_READY",
        inputDigest: this.c.inputDigest,
        evidenceDigest: hash(refs),
        actualPlatformSafetyProven: false,
      };
    } catch (e) {
      return { state: "HOLD", reason: e.message, automaticPromotion: false };
    }
  }
}
