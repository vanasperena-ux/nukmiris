import { id } from "../../src/protocol.mjs";
/** GCS LIST authorizes on the bucket, not on object prefixes. This B1a bucket
 * contains synthetic evidence only. LIST exposes its opaque object names;
 * object contents remain restricted to the approved session prefix. */
export function custodyReadCondition({ bucket, sessionId }) {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket ?? ""))
    throw Error("exact_synthetic_custody_bucket_required");
  id(sessionId);
  const bucketResource = "projects/_/buckets/" + bucket,
    objectPrefix = bucketResource + "/objects/sessions/" + sessionId + "/";
  return {
    title: "B1a2BucketListSessionGet",
    expression:
      "resource.name == " +
      JSON.stringify(bucketResource) +
      " || resource.name.startsWith(" +
      JSON.stringify(objectPrefix) +
      ")",
  };
}
