import { startInert } from "../../b1a/runtime/bootstrap.mjs";
import { mountedCloudMain } from "./assembly.mjs";
if (process.argv.length !== 2) throw Error("unexpected_bootstrap_arguments");
if (process.env.B1A2_MODE === "INERT_UNCONFIGURED") {
  const app = await startInert({
    role: process.env.B1A2_ROLE,
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 8080),
  });
  process.once("SIGTERM", () => app.close());
  process.once("SIGINT", () => app.close());
} else await mountedCloudMain({ role: process.env.B1A2_ROLE });
