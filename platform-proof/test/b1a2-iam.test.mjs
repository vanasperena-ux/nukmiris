import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("P-1/P-6 GCS recovery lists the bucket and reads only current-session objects; managed IAM principals exist before binding", async () => {
  const tf = JSON.parse(
      await readFile(
        new URL("../b1a2/terraform/main.tf.json", import.meta.url),
        "utf8",
      ),
    ),
    grant = tf.resource.google_storage_bucket_iam_member.sealer_recovery,
    expr = grant.condition.expression;
  // Evaluate only this audited CEL fragment. Not a general/cloud IAM evaluator.
  const match = expr.match(
    /^resource\.name == ("[^"]+") \|\| resource\.name\.startsWith\(("[^"]+")\)$/,
  );
  assert.ok(
    match,
    "a prefix-only expression cannot authorize bucket-level LIST",
  );
  const bucket = JSON.parse(match[1]),
    prefix = JSON.parse(match[2]),
    allowed = (name) => name === bucket || name.startsWith(prefix);
  assert.equal(allowed(bucket), true);
  assert.equal(allowed(prefix + "records/00000001.json"), true);
  assert.equal(allowed(bucket + "/objects/sessions/other/record.json"), false);
  assert.equal(allowed(bucket + "-foreign"), false);
  assert.equal(
    tf.resource.google_storage_bucket.custody.uniform_bucket_level_access,
    true,
  );
  for (const [type, rows] of Object.entries(tf.resource))
    for (const [name, v] of Object.entries(rows)) {
      if (
        !type.endsWith("_iam_member") ||
        !v.member?.startsWith("serviceAccount:b1a2-")
      )
        continue;
      if (v.member.includes("${")) continue;
      assert.ok(
        v.depends_on.some((x) => x.startsWith("google_service_account.")),
        type + "." + name + " must depend on the managed principal",
      );
    }
});
