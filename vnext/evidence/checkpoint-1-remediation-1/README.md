# WP1 remediation evidence — version 1

**Tested source:** [`857bb825ac01ca67f303adbe71ef486c276c8923`](https://github.com/vanasperena-ux/nukmiris/commit/857bb825ac01ca67f303adbe71ef486c276c8923),
tree `175bbddbb8f26c581f5f365722083f24ade3b7dd`.
The subsequent evidence commit leaves every tested source file unchanged.
**CP1/initial CP2 remain OPEN pending independent Claude verification.**
No WP2, live providers, merge, deployment or accepted-application changes.

Read the [17 dispositions](../../../docs/greenfield/reviews/02-CODEX-WP1-REMEDIATION-AND-DISPOSITIONS.md)
and [independent verification handoff](../../../docs/greenfield/reviews/03-CLAUDE-WP1-REMEDIATION-VERIFICATION-HANDOFF.md).
Original Claude review/scripts and `evidence/checkpoint-1/` are unchanged.
This is a new versioned package, not replacement evidence or independent review.

## Actual verification

| Check | Result |
|---|---|
| Strict TypeScript | PASS; [raw static log](static-checks.txt) |
| Source/dependency/client confinement | PASS; only pg source client, no app start/provider SDK/HTTP/FS/env/child-process access |
| Full suite | **88 pass**, 0 fail/cancel/skip, **34.318 s**; [raw log](full-test-output.txt) |
| Fault suite, separate fresh cluster | **78 pass**, 0 fail/cancel/skip, **23.503 s**; [raw log](fault-test-output.txt) |
| Selected SQL schedules | **1,000 seeds / 1,000 distinct orders**, real restricted PG roles; local retained data¹ |
| Overlapping PG schedules | **256 seeds**, three pending clients racing gate/STOP/suspension; local retained audit traces¹ |
| Exposed mutating SQL argument matrix | **17 functions / 173 cases** (each NULL argument plus typed malformed values); no stored state changes; local retained rows¹ |
| Original F13 counterexample | **REPRODUCED**, not closed; [new trace](F13-RESIDUAL-LATE-SUBMISSION.json); original package untouched |
| Independent Claude verification of remediation | **PENDING** |
| Real provider/gateway/custody/production/native Windows | **NOT RUN**, outside this authorization |

Node **24.19.0**, npm **11.9.0**, PostgreSQL **17.11** (Debian), image
`postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`.
See [full](full-environment.json) and [fault](fault-environment.json) environments.
Container uses `--network none`, Unix socket only, tmpfs data, fsync/synchronous
commit enabled. No published port/persistent DB/real account. Fake provider HTTP
binds only loopback and counts every invocation. Runtime SQL uses actual roles.

Source clock defaults to `clock_timestamp()`; **fixture postgres bootstrap only**
replaces it with a deterministic private DB clock for the 2030 schedules. Runtime
cannot modify/read the table or replace the function. The caller sample is checked,
then DB authority is sampled after gate locks. This is not a production clock knob.

¹ Compressed SQL/state evidence is **withheld from public publication** after
  automatic approval review rejected the full snapshot and remediation trace
  uploads. See [publication status](FULL-SNAPSHOT-PUBLICATION-STATUS.md) and
  [retained bundle hashes](withheld-artifact-manifest.json). All execution results
  below are actual; unpublished artifacts are explicitly identified.

## Integrity and stored data

[Tested source manifest](tested-source-manifest.json): **38 files**, SHA-256
`bb68b1ebdc24089ad5b26bfc4d8e2d3cf8484e6c1bfa169fd1044939e3974e14`.
[Artifact manifest](artifact-manifest.json) hashes every package file except itself.
[Preserved review hashes](preserved-review.sha256) match the review starting head;
[scope and preservation audit](scope-and-preservation.txt) records the empty
accepted-application diff and untouched checkpoint-1 tree. No baseline tests were
substituted for vNext verification.

- [Before counterexamples](before-reproductions.jsonl) are actual executions on the
  unchanged reviewed SQL at `e0b470d` (same original source as `108adb6`).
  [Executed adapter](before-reproduction-adapter.mjs) adapts Claude's SQL sequences
  to the pinned PG fixture; it is not the original shell scripts. It expects an
  original checkout/build at `/workspace/work/wp1-before-review/vnext/`; adjust
  only import prefixes for a different path. No edited SQL is used for “before”.
  Cases 002/003/004/006/007/008/009/012/014 all reproduce the reported behavior.
- Remediation rows, full/fault boundary traces, seeded schedules and overlapping
  schedule audit traces are retained locally with exact hashes in the withheld
  manifest. They include original identities and real negative-test SQL outcomes;
  they are **not publicly accessible** in this PR.
- [Snapshot content inspection](snapshot-content-inspection.json) inventories all
  **187** archived snapshots (99 full / 88 fault), every table/field and each
  uncompressed hash. All business/channel/calendar/customer/actor identities were
  checked against the synthetic fixtures; nested records were scanned for
  credential/key fields and signatures. No rawBase64 root bodies were present.
  This is a machine check, not independent Claude review.
- Full/fault SQL snapshot archives are retained locally, unpublished.
  [Full manifest](full-fixture-manifest.jsonl) and [fault manifest](fault-fixture-manifest.jsonl)
  provide uncompressed SHA-256 values and original diagnosis directories.
- [Database inventory](database-inventory.json) was read from a fresh instance of
  these migrations/roles: table/RLS owners, roles/timeouts, function ACL/search paths,
  triggers, table grants, extension versions. Fixture-only clock override identified.
- The retained local development-logs archive preserves failed intermediate runs,
  including missing pgcrypto schema access, restore/frozen-membership interaction,
  ordering assertions requiring explicit safe disposition, SQL CASE syntax and
  test-setup mistakes. They are diagnostic records, not passing acceptance runs.

All records/IDs/payloads are synthetic. No archive encryption keys, provider
credentials, working POC database or production data are included.

## Reproduce and stop

From isolated `vnext/`, Node 24/npm 11/Docker:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:fault
```

Use a writable npm cache if required. Runner creates and stops only its uniquely
named synthetic container; it retains fixture diagnostics under `/tmp/nukmiris-wp1-*`
and writes ignored run evidence under `evidence/runs/`. Linux/POSIX signal coverage
is real; native Windows remains unverified. No provider endpoint is configured.

Eleven findings are corrected and locally verified. Six remain explicit later
implementation/capability gates; see the disposition report. F13 and transport
budget are not solved by SQL. Archive custody/authentication/repair/scale and real
Meta receipt normalization remain prerequisites for their named later stages.
Recommend final independent Claude verification. **Stop after WP1 remediation.**
