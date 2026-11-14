import { readFile } from "node:fs/promises";
import { operationalPlan } from "./plan.mjs";
import { syntheticInputs, ownerTemplate } from "../runtime/inputs.mjs";
const [kind, ...args] = process.argv.slice(2);
if (
  args.length ||
  !["fixture-plan", "owner-template", "simulate", "simulate-crash"].includes(
    kind,
  )
)
  throw Error(
    "B1A2_PRINT_ONLY: fixture-plan|owner-template; live/execute/env overrides forbidden",
  );
if (kind === "simulate" || kind === "simulate-crash") {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { providerJournal } = await import("../runtime/journal.mjs");
  const { LocalOperationController, LocalCloudModel } = await import(
    "./controller.mjs"
  );
  const { simulateTeardown } = await import("./teardown.mjs");
  const { retirementFixture } = await import("../../test/b1a2-fixture.mjs");
  const dir = await mkdtemp(join(tmpdir(), "nukmiris-b1a2-simulation-")),
    plan = operationalPlan(syntheticInputs()),
    journal = await providerJournal(join(dir, "operations.jsonl")),
    adapter = new LocalCloudModel({ plan });
  let controller = new LocalOperationController({ plan, journal, adapter });
  const bundle = retirementFixture();
  for (const op of plan.commands) {
    const crash = kind === "simulate-crash" && op.id === "advance";
    const result = await controller.execute(op.id, {
      bundle,
      interruptAfterEffect: crash,
    });
    if (crash) {
      const snap = await journal.snapshot();
      controller = new LocalOperationController({
        plan,
        journal,
        adapter,
        records: snap.records,
      });
      if ((await controller.resume()).state !== "RESUMED_WITHOUT_REPLAY")
        throw Error("simulation_resume_held");
    } else if (result.state !== "CONFIRMED")
      throw Error("simulation_held " + op.id);
  }
  for (const op of plan.emergency) await controller.execute(op.id);
  const manifest = JSON.parse(
      await readFile(new URL("../inventory.json", import.meta.url), "utf8"),
    ),
    teardown = await simulateTeardown({
      manifest,
      journal,
      adapter: {
        mode: "LOCAL_SIMULATION",
        async removeExact(v) {
          return { identity: v.address, state: "ABSENT" };
        },
        async retireKeyVersions() {
          return { state: "VERSIONS_RETIRED" };
        },
      },
    });
  const snapshot = await journal.snapshot();
  await journal.close();
  console.log(
    JSON.stringify({
      mode: "LOCAL_MODEL_NOT_CLOUD",
      liveExecutionEnabled: false,
      operationsDirectory: dir,
      checkpoint: snapshot.checkpoint,
      teardown,
      crashRecovered: kind === "simulate-crash",
    }),
  );
} else {
  let value = ownerTemplate();
  if (kind === "fixture-plan") {
    const fixture = syntheticInputs();
    const artifact = JSON.parse(
      await readFile(
        new URL("../build/artifact.json", import.meta.url),
        "utf8",
      ),
    );
    const image =
      "us-central1-docker.pkg.dev/" +
      fixture.projects.runtime.id +
      "/b1a2/harness@" +
      artifact.ociManifestDigest;
    fixture.images = {
      runtime: image,
      fake: image,
      approvalRef: "SYNTHETIC_ONLY_NOT_PUSHED",
    };
    value = operationalPlan(fixture);
  }
  console.log(JSON.stringify(value, null, 2));
}
