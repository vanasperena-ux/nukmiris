// Adversarial local transport canary, separate from the accepted gateway. Parent
// independently verifies /proc stopped state; this message is not death proof.
import { invokeOnce } from "../../src/transport.mjs";
import { prepareLocalMutualTlsTarget } from "../../b1a/runtime/profile.mjs";
process.once("message", async (c) => {
  const target = c.target ? prepareLocalMutualTlsTarget(c.target, c.tls) : null;
  process.send({ type: "armed", attemptId: c.attemptId });
  process.kill(process.pid, "SIGSTOP");
  try {
    if (target) await invokeOnce({ target, ca: c.tls.ca, binding: c.binding });
    process.send({ type: "resumed", attemptId: c.attemptId });
  } catch {
    process.send({ type: "resumed", attemptId: c.attemptId });
  }
  process.disconnect();
});
