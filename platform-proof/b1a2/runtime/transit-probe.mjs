import { connect } from "node:tls";
import { once } from "node:events";
import { hash, id } from "../../src/protocol.mjs";
import { TRANSIT_PROTOCOL } from "./transit-evidence.mjs";
const observations = new WeakMap();

/** Separately controlled, synthetic measurement sender. It is not a gateway
 * permit or a cloud transport. No retry, endpoint discovery or real provider. */
export async function runLocalTransitProbe({
  address,
  tls,
  binding,
  sessionId,
  afterTls = async () => {},
  now = Date.now,
  mode = "LOCAL_SIMULATION",
}) {
  if (
    mode !== "LOCAL_SIMULATION" ||
    address?.host !== "127.0.0.1" ||
    !Number.isInteger(address.port) ||
    address.port < 1024 ||
    binding?.payload?.synthetic !== true ||
    hash(binding.payload) !== binding.payloadDigest
  )
    throw Error("local_synthetic_transit_probe_only");
  if (
    Object.keys(binding.payload).length !== 1 ||
    !Number.isSafeInteger(binding.epoch) ||
    binding.epoch < 1 ||
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(binding.revision ?? "")
  )
    throw Error("synthetic_probe_binding_required");
  [sessionId, binding.scopeId, binding.attemptId, binding.operationId].forEach(
    id,
  );
  const phases = [],
    mark = (phase) =>
      phases.push({
        phase,
        at: now(),
        monotonicNs: String(process.hrtime.bigint()),
      });
  mark("CONNECT_BEGIN");
  const socket = connect({
    ...tls,
    ...address,
    rejectUnauthorized: true,
    minVersion: "TLSv1.3",
    ALPNProtocols: ["http/1.1"],
  });
  const timer = setTimeout(
    () => socket.destroy(Error("transit_probe_deadline")),
    3000,
  );
  socket.once("connect", () => mark("TCP_CONNECTED"));
  try {
    await once(socket, "secureConnect");
    mark("TLS_ESTABLISHED");
    const providerFingerprint = socket.getPeerCertificate().fingerprint256,
      localPort = socket.localPort;
    await afterTls();
    const body = JSON.stringify(binding.payload),
      headers = [
        "POST /effect HTTP/1.1",
        "Host: localhost",
        "Connection: close",
        "Content-Type: application/json",
        "Content-Length: " + Buffer.byteLength(body),
        ...Object.entries({
          scope: binding.scopeId,
          attempt: binding.attemptId,
          operation: binding.operationId,
          epoch: binding.epoch,
          revision: binding.revision,
          digest: binding.payloadDigest,
        }).map(([k, v]) => "x-inc1-" + k + ": " + v),
        "",
        "",
      ].join("\r\n");
    let response = "";
    socket.on("data", (b) => {
      response += b;
      if (response.length > 65536)
        socket.destroy(Error("bounded_transit_response"));
    });
    const ended = once(socket, "end");
    mark("WRITE_BEGIN");
    await new Promise((resolve, reject) =>
      socket.write(headers + body, (e) => (e ? reject(e) : resolve())),
    );
    mark("WRITE_END");
    await ended;
    if (!response.startsWith("HTTP/1.1 200"))
      throw Error("transit_probe_provider_rejected");
    const record = Object.freeze({
      protocol: TRANSIT_PROTOCOL,
      scopeId: binding.scopeId,
      epoch: binding.epoch,
      revision: binding.revision,
      attemptId: binding.attemptId,
      operationId: binding.operationId,
      payloadDigest: binding.payloadDigest,
      providerFingerprint,
      probeFingerprint: tls.fingerprint,
      localPort,
      clockSource: "independent-observer-clock",
      phases,
    });
    observations.set(record, record);
    return record;
  } finally {
    clearTimeout(timer);
    socket.destroy();
  }
}
export function attestLocalTransitProbe(receipt, signer) {
  const data = observations.get(receipt);
  if (!data) throw Error("native_transit_probe_receipt_required");
  return signer.observe("ACTIVITY", data);
}
