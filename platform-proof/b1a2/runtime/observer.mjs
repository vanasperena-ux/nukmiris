import { transitPolicy as verifiedTransit } from "./transit.mjs";
import { wakeReceipt } from "./canaries.mjs";
import { randomUUID } from "node:crypto";
import { hash } from "../../src/protocol.mjs";
import { verifyRecords } from "../../src/ledger.mjs";
import { measuredClock } from "../../src/evidence-source.mjs";
import { receiptData } from "./transport.mjs";
import { fakeReceipt } from "./fake-client.mjs";
import { decodeCounts } from "./cloud-api.mjs";
/** Collectors preserve immutable API receipts and refuse sensitive token/key
 * responses. They never sign user assertions or stale gateway trace fields. */
export class IndependentObserver {
  constructor({
    inputs,
    api,
    fake,
    signer,
    journal,
    clockPolicy,
    now = Date.now,
  }) {
    this.c = inputs;
    this.api = api;
    this.fake = fake;
    this.signer = signer;
    this.journal = journal;
    this.clockPolicy = clockPolicy;
    this.now = now;
    this.samples = new Map();
    this.lastLedger = null;
    this.seenNonces = new Set();
  }
  async preserve(receipt) {
    const r = receiptData(receipt) ?? fakeReceipt(receipt);
    if (!r || r.sensitive)
      throw Error("independent_noncredential_receipt_required");
    await this.journal.append({
      event: "INDEPENDENT_RECEIPT",
      at: this.now(),
      rawDigest: r.rawDigest,
      source: r.service ?? r.source,
      requestedAt: r.requestedAt,
      observedAt: r.observedAt,
      raw: r.value,
    });
    return r;
  }
  async calibrate() {
    const samples = [],
      refs = [];
    for (let i = 0; i < 3; i++) {
      const r = await this.fake.clock(),
        v = r.value;
      if (
        !fakeReceipt(r) ||
        this.seenNonces.has(r.nonce) ||
        v.clockSource !== "independent-fake-clock" ||
        !Number.isFinite(v.receivedAt) ||
        !Number.isFinite(v.sentAt)
      )
        throw Error("authenticated_clock_reply_required");
      this.seenNonces.add(r.nonce);
      refs.push((await this.preserve(r)).rawDigest);
      samples.push([r.requestedAt, v.receivedAt, v.sentAt, r.observedAt]);
    }
    const measuredAt = this.now(),
      p = this.clockPolicy;
    if (
      !p ||
      ![
        p.precisionMs,
        p.driftPpm,
        p.resyncAllowanceMs,
        p.maxExtrapolationMs,
      ].every(Number.isFinite)
    )
      throw Error("explicit_measured_clock_policy_required");
    const payload = {
      model: "BOUNDED_DRIFT_V2",
      referenceClockSource: "independent-observer-clock",
      remoteClockSource: "independent-fake-clock",
      samples,
      precisionMs: p.precisionMs,
      driftPpm: p.driftPpm,
      resyncAllowanceMs: p.resyncAllowanceMs,
      maxExtrapolationMs: p.maxExtrapolationMs,
      measuredAt,
      validUntil: measuredAt + 60000,
      rawRefs: refs,
      driftBasis:
        "DECLARED_CONSERVATIVE_BOUND_PLUS_MEASURED_OFFSETS; actual cloud bound remains unproven",
    };
    measuredClock(payload);
    return this.signer.observe("CLOCK", payload, {
      ttlMs: Math.min(p.maxExtrapolationMs, 3600000),
    });
  }
  async calibratePlatform() {
    const p = this.clockPolicy;
    if (
      !p ||
      !Number.isFinite(p.platformTimestampAllowanceMs) ||
      p.platformTimestampAllowanceMs < 1000
    )
      throw Error("platform_internal_clock_bound_required");
    const samples = [],
      refs = [];
    for (let i = 0; i < 3; i++) {
      const r = await this.api.service();
      if (!Number.isFinite(r.httpDate))
        throw Error("authenticated_api_date_required");
      await this.preserve(r);
      samples.push([r.requestedAt, r.httpDate, r.httpDate, r.observedAt]);
      refs.push(r.rawDigest);
    }
    const measuredAt = this.now(),
      payload = {
        model: "BOUNDED_DRIFT_V2",
        referenceClockSource: "independent-observer-clock",
        remoteClockSource: "gcp-platform-clock",
        samples,
        precisionMs: p.platformTimestampAllowanceMs,
        driftPpm: p.driftPpm,
        resyncAllowanceMs: p.resyncAllowanceMs,
        maxExtrapolationMs: p.maxExtrapolationMs,
        measuredAt,
        validUntil: measuredAt + 60000,
        rawRefs: refs,
        driftBasis:
          "API_DATE_PLUS_EXPLICIT_INTERNAL_PLATFORM_CLOCK_ALLOWANCE; NOT_CLOUD_PROVEN",
      };
    measuredClock(payload);
    return this.signer.observe("CLOCK", payload, {
      ttlMs: Math.min(p.maxExtrapolationMs, 3600000),
    });
  }
  async metrics({ start, end }) {
    const r = await this.api.instanceCounts({
      revision: this.c.epochs.oldRevision,
      start,
      end,
    });
    await this.preserve(r);
    const rows = decodeCounts(r, {
      service: this.c.names.gateway,
      revision: this.c.epochs.oldRevision,
    });
    for (const row of rows) {
      const old = this.samples.get(row.sampleAt);
      if (old && JSON.stringify(old.states) !== JSON.stringify(row.states))
        throw Error("contradictory_instance_gauge");
      if (!old) this.samples.set(row.sampleAt, row);
    }
    return [...this.samples.values()].sort((a, b) => a.sampleAt - b.sampleAt);
  }
  async deletion(operationName) {
    const op = await this.api.deletionOperation(operationName),
      revision = await this.api.revision(this.c.epochs.oldRevision);
    await this.preserve(op);
    await this.preserve(revision);
    if (op.value?.done !== true || op.value.error || revision.status !== 404)
      throw Error("deletion_receipt_not_complete");
    const end = Date.parse(op.value.metadata?.endTime),
      completedAt = Number.isFinite(end) ? end : op.observedAt;
    return {
      operationDone: true,
      revisionNotFound: true,
      revision: this.c.epochs.oldRevision,
      completedAt,
      receiptObservedAt: op.observedAt,
      clockSource: Number.isFinite(end)
        ? "gcp-platform-clock"
        : "independent-observer-clock",
      completionMeaning: Number.isFinite(end)
        ? "PLATFORM_END_TIME"
        : "OBSERVER_READ_UPPER_BOUND",
      rawDigest: hash([op.rawDigest, revision.rawDigest]),
    };
  }
  async systemLogs() {
    const r = await this.api.logs({ revision: this.c.epochs.oldRevision });
    await this.preserve(r);
    if (!Array.isArray(r.value?.entries) || r.value.nextPageToken)
      throw Error("complete_system_log_export_required");
    return r.value.entries;
  }
  async networkLogs() {
    const r = await this.api.logs({ kind: "nat" });
    await this.preserve(r);
    if (!Array.isArray(r.value?.entries) || r.value.nextPageToken)
      throw Error("complete_nat_export_required");
    return r;
  }
  async providerLedger() {
    const r = await this.fake.ledger();
    await this.preserve(r);
    const v = r.value;
    if (
      !Array.isArray(v.records) ||
      !Number.isFinite(v.observedUntil) ||
      v.clockSource !== "independent-fake-clock"
    )
      throw Error("independent_ledger_contract");
    verifyRecords(v.records, v.checkpoint);
    if (
      this.lastLedger &&
      (v.checkpoint.sequence < this.lastLedger.sequence ||
        (v.checkpoint.sequence === this.lastLedger.sequence &&
          v.checkpoint.hash !== this.lastLedger.hash))
    )
      throw Error("provider_ledger_rollback");
    this.lastLedger = v.checkpoint;
    return {
      records: v.records,
      observation: this.signer.observe("LEDGER", {
        scope: this.c.session.scopeId,
        epoch: this.c.epochs.old,
        revision: this.c.epochs.oldRevision,
        clockSource: v.clockSource,
        observedUntil: v.observedUntil,
        recordsDigest: hash(v.records),
        checkpoint: v.checkpoint,
        rawRefs: [r.rawDigest],
      }),
    };
  }
  deriveActivities({ ledgerReceipt, natReceipt, transitPolicy }) {
    const provider = fakeReceipt(ledgerReceipt),
      nat = receiptData(natReceipt);
    transitPolicy = verifiedTransit(transitPolicy);
    if (
      !provider ||
      !nat ||
      nat.service !== "logging" ||
      !Array.isArray(nat.value?.entries) ||
      !transitPolicy ||
      !Number.isFinite(transitPolicy.upperMs) ||
      transitPolicy.upperMs <= 0 ||
      transitPolicy.upperMs > 60000 ||
      !transitPolicy.measurementRefs?.length ||
      transitPolicy.validUntil < this.now()
    )
      throw Error("independent_network_and_transit_evidence_required");
    const rows = provider.value.records;
    verifyRecords(rows, provider.value.checkpoint);
    const output = [];
    for (const r of rows.filter((r) => r.event === "REQUEST")) {
      if (
        r.authenticatedEpoch !== this.c.epochs.old ||
        r.authenticatedRevision !== this.c.epochs.oldRevision ||
        !r.authenticatedFingerprint
      )
        continue;
      const tls = rows.find(
          (v) => v.event === "TLS_READY" && v.connectionId === r.connectionId,
        ),
        matches = nat.value.entries.filter(
          (e) =>
            e.jsonPayload?.connection?.dest_port === 443 &&
            Number(e.jsonPayload?.nat_port) === tls?.remotePort &&
            e.jsonPayload?.allocation_status === "OK",
        );
      if (matches.length !== 1 || !tls)
        throw Error("independent_nat_fake_flow_binding_missing");
      const payload = {
        scope: this.c.session.scopeId,
        epoch: r.authenticatedEpoch,
        revision: r.authenticatedRevision,
        clockSource: "independent-fake-clock",
        connect: [tls.at - transitPolicy.upperMs, tls.at],
        providerArrival: r.at,
        sourceEvidence: "INDEPENDENT_MTLS_LEDGER_AND_NAT",
        rawRefs: [
          provider.rawDigest,
          nat.rawDigest,
          ...transitPolicy.measurementRefs,
        ],
        transitUpperMs: transitPolicy.upperMs,
        transitBasis:
          "BOUNDED_EXPERIMENT_POLICY_NOT_A_UNIVERSAL_NETWORK_GUARANTEE",
      };
      output.push(this.signer.observe("ACTIVITY", payload));
    }
    return output;
  }
}
export class CanaryScheduler {
  constructor({ inputs, signer, waker, journal, now = Date.now, waitUntil }) {
    this.c = inputs;
    this.signer = signer;
    this.waker = waker;
    this.journal = journal;
    this.now = now;
    this.waitUntil = waitUntil;
    this.schedules = new WeakMap();
  }
  async prepare({ firstWakeAt, spacingMs, count = 20 }) {
    if (
      !Number.isInteger(count) ||
      count < 20 ||
      count > 1000 ||
      !Number.isFinite(firstWakeAt) ||
      firstWakeAt <= this.now() ||
      !Number.isFinite(spacingMs) ||
      spacingMs <= 0
    )
      throw Error("bounded_independent_canary_schedule_required");
    const trials = [];
    for (let i = 0; i < count; i++) {
      const scheduledWakeAt = firstWakeAt + i * spacingMs;
      if (scheduledWakeAt >= Date.parse(this.c.session.expiresAt))
        throw Error("canary_outside_session");
      const attemptId = randomUUID();
      await this.journal.append({
        event: "CANARY_SCHEDULE",
        attemptId,
        scheduledWakeAt,
        sessionId: this.c.session.id,
      });
      const planned = await this.waker.prepare({
        attemptId,
        scheduledWakeAt,
        revision: this.c.epochs.oldRevision,
      });
      trials.push({ attemptId, scheduledWakeAt, planned });
    }
    const cap = Object.freeze({ count, preparedAt: this.now() });
    this.schedules.set(cap, trials);
    return cap;
  }
  async run({
    schedule,
    declaredAt,
    measuredWakeTailMs,
    networkTransitBoundMs,
  }) {
    const plan = this.schedules.get(schedule);
    if (
      !plan ||
      schedule.preparedAt >= declaredAt ||
      ![measuredWakeTailMs, networkTransitBoundMs].every(Number.isFinite) ||
      measuredWakeTailMs < 0 ||
      networkTransitBoundMs < 0
    )
      throw Error("pre_fence_independent_schedule_required");
    this.schedules.delete(schedule);
    const trials = [];
    for (const { attemptId, scheduledWakeAt, planned } of plan) {
      if (scheduledWakeAt <= declaredAt) throw Error("wake_before_retirement");
      await this.waitUntil(scheduledWakeAt);
      const receipt = wakeReceipt(await this.waker.wake(planned));
      if (
        !receipt ||
        !receipt.independent ||
        !receipt.parkedBeforeConnect ||
        receipt.attemptId !== attemptId
      )
        throw Error("independent_wake_receipt_required");
      const row = {
        attemptId,
        scheduledWakeAt,
        wakeObservedAt: this.now(),
        independentWakeAttempted: true,
        parkedBeforeConnect: true,
        independentWakeSource: receipt.source,
        receiptDigest: hash(receipt),
        preparedAt: schedule.preparedAt,
      };
      trials.push(row);
      await this.journal.append({ event: "CANARY_OBSERVATION", ...row });
    }
    return this.signer.observe("CANARY", {
      scope: this.c.session.scopeId,
      epoch: this.c.epochs.old,
      revision: this.c.epochs.oldRevision,
      clockSource: "independent-observer-clock",
      measuredWakeTailMs,
      networkTransitBoundMs,
      trials,
    });
  }
}
