import tls from "node:tls";
import { once } from "node:events";
import { endpoint, beforeDeadline, canonical } from "./protocol.mjs";
import { preparedTarget } from "../b1a/runtime/profile.mjs";
/** Single raw TLS socket, no HTTP agent, pool, redirect handler or retry loop. */
export async function invokeOnce({ target, ca, binding, hook, trace }) {
  const prepared = preparedTarget(target);
  const to = prepared ?? endpoint(target),
    deadline = Date.parse(binding.deadlineAt);
  beforeDeadline(deadline);
  await hook("beforeConnect", binding.attemptId);
  beforeDeadline(deadline);
  trace("CONNECT_BEGIN");
  const socket = tls.connect({
    ...to,
    servername: "localhost",
    ca,
    ...(prepared ?? {}),
    rejectUnauthorized: true,
    minVersion: "TLSv1.3",
    ALPNProtocols: ["http/1.1"],
  });
  const ready = once(socket, "secureConnect");
  ready.catch(() => {});
  const connected = once(socket, "connect");
  connected.catch(() => {});
  let response = "";
  const responseDone = new Promise((resolve, reject) => {
    socket.on("data", (b) => {
      response += b.toString("utf8");
      if (response.length > 8192) socket.destroy(Error("response_too_large"));
    });
    socket.once("end", resolve);
    socket.once("error", reject);
    socket.once("close", () => {
      if (!socket.readableEnded) reject(Error("response_missing"));
    });
  });
  responseDone.catch(() => {});
  const timer = setTimeout(
    () => socket.destroy(Error("effect_deadline")),
    Math.max(1, deadline - Date.now()),
  );
  try {
    await connected;
    if (socket.remoteAddress !== to.host) throw Error("non_loopback_peer");
    trace("CONNECTED", {
      localPort: socket.localPort,
      remotePort: socket.remotePort,
    });
    await hook("afterConnect", binding.attemptId);
    beforeDeadline(deadline);
    await ready;
    trace("TLS_READY");
    await hook("afterTls", binding.attemptId);
    beforeDeadline(deadline);
    const body = Buffer.from(canonical(binding.payload));
    const headers = [
      "POST /effect HTTP/1.1",
      "Host: " + (prepared?.servername ?? "localhost"),
      "Connection: close",
      "Content-Type: application/json",
      "Content-Length: " + body.length,
      "X-Inc1-Scope: " + binding.scopeId,
      "X-Inc1-Attempt: " + binding.attemptId,
      "X-Inc1-Operation: " + binding.operationId,
      "X-Inc1-Epoch: " + binding.epoch,
      "X-Inc1-Revision: " + binding.revision,
      "X-Inc1-Digest: " + binding.payloadDigest,
    ];
    await hook("beforeWrite", binding.attemptId);
    beforeDeadline(deadline);
    trace("WRITE_BEGIN");
    // One HTTP request, deliberately two fragments so the proof can pause in a
    // partial write. Bytes in the kernel can arrive after process termination.
    const splitAt = Math.max(1, Math.floor(body.length / 2));
    const write = (data) =>
      new Promise((resolve, reject) =>
        socket.write(data, (e) => (e ? reject(e) : resolve())),
      );
    await write(
      Buffer.concat([
        Buffer.from(headers.join("\r\n") + "\r\n\r\n"),
        body.subarray(0, splitAt),
      ]),
    );
    trace("WRITE_PART");
    await hook("midWrite", binding.attemptId);
    beforeDeadline(deadline);
    await write(body.subarray(splitAt));
    trace("WRITE_CALLBACK");
    await hook("afterWrite", binding.attemptId);
    beforeDeadline(deadline);
    await responseDone;
    beforeDeadline(deadline);
    trace("RESPONSE_END");
    const split = response.indexOf("\r\n\r\n");
    if (split < 0 || !/^HTTP\/1\.1 200 /.test(response))
      throw Error("positive_proof_missing");
    const proof = JSON.parse(response.slice(split + 4));
    for (const k of [
      "scopeId",
      "attemptId",
      "operationId",
      "payloadDigest",
      "epoch",
      "revision",
    ])
      if (proof[k] !== binding[k]) throw Error("proof_binding_mismatch");
    if (proof.accepted !== true) throw Error("positive_proof_missing");
    return proof;
  } finally {
    clearTimeout(timer);
    socket.destroy();
  }
}
