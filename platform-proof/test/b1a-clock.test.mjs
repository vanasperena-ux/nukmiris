import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { measuredClock } from "../src/evidence-source.mjs";

test("native four-timestamp clock sampling measures explicit uncertainty; no cloud-default tolerance", async () => {
  const child = fork(new URL("./clock-peer.mjs", import.meta.url), [], {
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  try {
    await once(child, "message");
    const samples = [];
    for (let i = 0; i < 12; i++) {
      const response = once(child, "message"),
        t1 = Date.now();
      child.send({ type: "sample" });
      const [{ t2, t3 }] = await response;
      samples.push([t1, t2, t3, Date.now()]);
    }
    const payload = {
        referenceClockSource: "native-parent-observer",
        remoteClockSource: "native-child-modeled-offset1000",
        samples,
        precisionMs: 1,
        driftPpm: 50,
        measuredAt: Date.now(),
        validUntil: Date.now() + 5000,
      },
      m = measuredClock(payload);
    assert.ok(m.uncertaintyMs > 0);
    assert.ok(Math.abs(m.remoteMinusReferenceMs - 1000) <= m.uncertaintyMs);
    assert.throws(
      () => measuredClock({ ...payload, precisionMs: undefined }),
      /measured_clock/,
    );
    console.log(
      JSON.stringify({
        nativeClockMeasurement: { ...m, samples, cloudClockMeasurement: false },
      }),
    );
  } finally {
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
  }
});
