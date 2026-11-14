import {
  runLocalTransitProbe,
  attestLocalTransitProbe,
} from "../b1a2/runtime/transit-probe.mjs";
import { ObserverSigner } from "../b1a2/runtime/identity.mjs";
process.once("message", async ({ config, privateKey, sessionId }) => {
  try {
    const signer = new ObserverSigner({
      privateKey,
      sessionId,
      issuer: "independent-native-probe",
    });
    const receipt = await runLocalTransitProbe({
      ...config,
      afterTls: async () => {
        process.send({ state: "TLS_PARKED", pid: process.pid });
        await new Promise((resolve) => process.once("message", resolve));
      },
    });
    const signed = attestLocalTransitProbe(receipt, signer);
    process.send({ state: "DONE", wire: signed.wire }, () =>
      process.disconnect(),
    );
  } catch (e) {
    process.send({ state: "ERROR", message: e.message }, () =>
      process.disconnect(),
    );
  }
});
