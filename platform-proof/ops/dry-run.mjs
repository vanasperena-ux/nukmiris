import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const [kind, ...extra] = process.argv.slice(2);
if (extra.length || !["fence", "teardown", "probe"].includes(kind))
  throw Error(
    "PRINT_ONLY: usage fence|teardown|probe; execution flags forbidden",
  );
if (kind === "probe") {
  console.log(
    await readFile(new URL("./cloud-sql-probe.sql", import.meta.url), "utf8"),
  );
  process.exit(0);
}
const fence = [
  [
    "Pin image/schema/policies; stage N+1 inert with unique epoch identity/tag",
    "signed source/image/schema/policy digests; no traffic; no effect authority",
  ],
  [
    "Advance durable execution epoch atomically; freeze intake/promotion",
    "transaction commit receipt; original attempt identities; N+1 inert",
  ],
  [
    "Route 100% to inert N+1; remove ALL N traffic tags",
    "API results and propagation; traffic-zero is not termination",
  ],
  [
    "Independent kill identity denies old-tag egress, removes scoped secrets/decrypt and deletes N",
    "deny-policy receipt; secret/IAM changes; revision deletion receipt; production Meta token fence unresolved; synthetic only",
  ],
  [
    "Observe deletion AND zero instances after reporting delay; reconcile canaries/ledger",
    "fresh complete old-scope platform samples; system logs; independent delayed wake; missing/stale => NOT_PROVEN",
  ],
  [
    "Preserve may-have-entered attempts UNKNOWN and protect resources",
    "no rearm, new identity, replay or invented outcome; pre-fence bytes may arrive later",
  ],
  [
    "Explicitly promote N+1 only after all evidence; otherwise hold inert",
    "recorded decision; rollback prior image at N+2 through same fence, never reactivate old epoch",
  ],
];
const teardown = [
  [
    "Freeze intake and effect dispatch; fence all gateways/worker epochs",
    "complete fence evidence before deleting protected state",
  ],
  [
    "Export coherent synthetic evidence then delete SQL",
    "deletion protection false; final backup disabled; retain_backups_on_delete false; list/delete backups/PITR/WAL and temporary restore instances",
  ],
  [
    "Delete workers, all revisions/tags/min instances, fake VM/disks/snapshots",
    "confirm absence including old images/service identities",
  ],
  [
    "Delete NAT/router/public and unattached IPs",
    "Direct VPC addresses may linger ~20m; subnet removal ~1–2h; re-inventory",
  ],
  [
    "Delete SQL PSA peering and reserved ranges after SQL removal; subnets/firewalls/VPC",
    "enumerate dependencies; reserved ranges are not automatically removed",
  ],
  [
    "Delete secrets including disabled versions; KMS active keys and schedule versions destruction",
    "disabled secrets billable; scheduled KMS destruction delay; record irreversible custody consequences",
  ],
  [
    "Delete bucket versions/exports/log sinks/log buckets and retention locks; images/build caches",
    "explicit inventory; do not destroy owner application/protected data",
  ],
  [
    "Delete disposable projects and unlink billing where authorized",
    "never rely only on stopped compute; quotas/caps not hard account spending limits",
  ],
  [
    "Reconcile billing at +48h and next statement; named operator and backup sign off",
    "pending charges and retained resources zero/explicit exceptions; complete by 2026-12-17",
  ],
];
console.log(
  JSON.stringify(
    {
      mode: "PRINT_ONLY_NO_CLOUD_EXECUTION",
      kind,
      steps: (kind === "fence" ? fence : teardown).map(
        ([action, evidence], i) => ({ step: i + 1, action, evidence }),
      ),
      approval: "Separate owner provisioning/operations authorization required",
    },
    null,
    2,
  ),
);
