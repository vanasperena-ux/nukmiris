import https from "node:https";
import { randomUUID } from "node:crypto";
import { LIVE_CLOUD_EXECUTION } from "./transport.mjs";
import { hash } from "../../src/protocol.mjs";
const receipts = new WeakMap();
export const fakeReceipt = (v) => receipts.get(v);
const deepFreeze = (v) => {
  if (v && typeof v === "object") {
    Object.values(v).forEach(deepFreeze);
    Object.freeze(v);
  }
  return v;
};
export class FakeEvidenceClient {
  constructor({
    address,
    tls,
    sessionId,
    mode = "LOCAL_SIMULATION",
    now = Date.now,
  }) {
    if (mode !== "LOCAL_SIMULATION" && !LIVE_CLOUD_EXECUTION)
      throw Error("cloud_execution_disabled");
    if (
      mode === "LOCAL_SIMULATION" &&
      (address.host !== "127.0.0.1" ||
        !Number.isInteger(address.port) ||
        address.port < 1024)
    )
      throw Error("literal_local_fake_fixture_required");
    this.address = address;
    this.tls = tls;
    this.sessionId = sessionId;
    this.now = now;
    this.seen = new Set();
  }
  async request(method, path, body) {
    const nonce = randomUUID(),
      query = path.includes("?") ? "&" : "?",
      begin = this.now(),
      raw = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const result = await new Promise((resolve, reject) => {
      const request = https.request(
        {
          ...this.address,
          ...this.tls,
          servername: this.tls.servername ?? "localhost",
          rejectUnauthorized: true,
          minVersion: "TLSv1.3",
          agent: false,
          method,
          path: path + (method === "GET" ? query + "nonce=" + nonce : ""),
          headers: {
            connection: "close",
            ...(raw
              ? {
                  "content-type": "application/json",
                  "content-length": raw.length,
                }
              : {}),
          },
        },
        (res) => {
          const fingerprint =
            res.socket?.getPeerCertificate()?.fingerprint256 ?? null;
          let text = "";
          res.on("data", (b) => {
            text += b;
            if (Buffer.byteLength(text) > 8388608)
              res.destroy(Error("bounded_fake_export"));
          });
          res.on("end", () => {
            try {
              if (res.statusCode !== 200)
                throw Error("fake_evidence_denied_" + res.statusCode);
              resolve({
                value: JSON.parse(text),
                fingerprint,
                digest: hash(text),
              });
            } catch (e) {
              reject(e);
            }
          });
          res.on("error", reject);
        },
      );
      const timer = setTimeout(
        () => request.destroy(Error("fake_evidence_deadline")),
        3000,
      );
      request.once("close", () => clearTimeout(timer));
      request.on("error", reject);
      request.end(raw);
    });
    const at = this.now();
    if (at < begin) throw Error("observer_clock_regressed");
    if (
      method === "GET" &&
      (result.value.nonce !== nonce ||
        result.value.sessionId !== this.sessionId ||
        this.seen.has(nonce))
    )
      throw Error("replayed_or_wrong_session_fake_evidence");
    this.seen.add(nonce);
    const receipt = deepFreeze({
      value: result.value,
      requestedAt: begin,
      observedAt: at,
      nonce,
      rawDigest: result.digest,
      source: "MUTUALLY_AUTHENTICATED_INDEPENDENT_FAKE",
      peerFingerprint: result.fingerprint,
    });
    receipts.set(receipt, receipt);
    return receipt;
  }
  clock() {
    return this.request("GET", "/clock");
  }
  ledger() {
    return this.request("GET", "/ledger");
  }
  plan(binding) {
    return this.request("POST", "/control/plan", binding);
  }
}
