# C-1 / C-2 correction evidence

Exact tested implementation: `ade1c3be3b66f81aa05a26e06fa6c8e707d0526c`; tree `76d7c525b68aa879c38fad52872b77a96e51275a`. Parent evidence head: `655d07d7ae45a280d28e4c6ae58071c199db523d`. This is a separate correction to the reviewed ecc085f implementation, not a rewrite of its historical results. See [Claude's complete finding](https://github.com/vanasperena-ux/nukmiris/pull/22#issuecomment-6882892257) and [support/P9/P10b/P6b](https://github.com/vanasperena-ux/nukmiris/pull/22#issuecomment-6882891450).

**25 targeted / 116 full / 75 fault / 24 concurrency PASS**, zero failures/cancellations/skips/todos. Suites overlap. Node24.19.0; measured PostgreSQL17.11/UTC; Linux and cached pinned Docker fixtures. `commands.json` records exact argv, source/tree, UTC start/end and duration. The source-check log verifies all107 historical INC1/B1a files, the accepted127-file application manifest, source-only scope, secret scan, immutable cloud-execution flag and Terraform apply guard. No application, SQL source or Terraform source changed in this correction.

## Finding-to-test mapping

| Finding / required schedule | Automated evidence and outcome |
| --- | --- |
| C-1 cases1/2, P10b: old TLS_READY/REQUEST/EFFECT at520s; caller list omitted, empty or misleading | `test/b1a2-retirement.test.mjs`: VIOLATION; three ledger records derived independently of caller activities |
| C-1 case3:100s arrival minus signed60s transit overlaps59s fence | same: HOLD, never EVIDENCE_READY |
| C-1 cases4/5, P9: canary REQUEST plus unrelated incomplete trial or19 complete trials | same: VIOLATION ahead of completeness/metric/tail holds |
| C-1 case6: pre-fence request, delayed application | same: EVIDENCE_READY; EFFECT inherits original request initiation. A new post-fence write is VIOLATION |
| C-1 case7, H-2: original realistic-latency bundles | all three immutable signed bundles reverify EVIDENCE_READY; derived count0 (only observer TLS). Recorded original digests are separately verified and preserved |
| C-1 authentication/integrity/uncertainty | forged/copied/mixed-session tokens, broken chain/head/digest, unknown attribution and absent/invalid signed transit policy HOLD; uncertainty is never narrowed by caller assertions |
| H-1 | standalone authenticated old TLS without REQUEST is checked; late TLS is VIOLATION |
| C-2/P6b: legacy bundle through every B1a-2 gate | `test/b1a2-controller.test.mjs`: V1 still verifies historically, but B1a-2 verdict, controller observe/recover/promote, direct model, prepared adapter and SQL reconciliation/promotion refuse it with `b1a2_requires_v2_retirement`, before effects |
| C-2 positive / ordering and uncertainty | real restricted PG reconciliation preserves the original ARMED attempt; only explicit valid V2 promotion enables dispatch; a repeat promotion holds. Historical ENTERED→UNKNOWN/no-resend/CAS tests still pass |
| End-to-end derived activity | `test/b1a2-observer.test.mjs`: real authenticated pre-fence old TLS, signed measured transit,20 native canaries, signed clocks/metrics and full provider ledger → EVIDENCE_READY; count1 in every exported new run |

Counts refer to derived ledger records, not unique booking attempts. `AUTHENTICATED_LEDGER_ACTIVITY_V1` versions the new digest format; retirement/clock protocols remain strictly METRIC_LATENCY_V2/BOUNDED_DRIFT_V2. The B1a-2 SessionController wraps the unchanged historical controller with a V2 gate; prepared adapter and local operation/model gates independently enforce V2.

## Read-back and reproduction

Verify every `SHA256SUMS.json` entry from the repository root. `source-publication.json` lists every changed source path/byte/hash and the exact source tree. `verification/` contains both original ledger verifiers over 27/23/6 full/fault/concurrency ledgers, plus the targeted ledger. All four new signed retirement bundles are in `retirement/`; their corrected-verifier outputs are alongside the ledger outputs. `native/` publishes the small new SQL-gate case from each run. Full native legacy campaign exports remain local: `local-raw-integrity.json` indexes their captured bytes, not their publication. No new raw archive is claimed.

From a fresh isolated source checkout, install `platform-proof` dependencies with `npm ci --ignore-scripts`, use Node24 and the pinned PostgreSQL17.11 image from `test/helpers.mjs`, and run the exact commands in `commands.json` serially. Export B1A_SOURCE_SHA/B1A2_SOURCE_SHA as the tested source; give each run fresh B1A_EVIDENCE_DIR, B1A2_EVIDENCE_DIR and B1A_DIAGNOSTIC_DIR folders, creating them first. No cloud account or provider access is required. The original campaign remains18/27 instrumented point/control cells with overwritten `mode`; the separate native B1a matrix remains54 cells x20 and400 asynchronous schedules. These are not relabeled as arbitrary cloud instruction suspensions.

`historical-reverification/` applies the corrected verifier at the original fixture reference times. `recordedResult` stays the historical result; `result` is the new derivation verdict/digest. New exports require the explicit source SHA: `node b1a2/evidence/verify-retirement.mjs FILE ade1c3be3b66f81aa05a26e06fa6c8e707d0526c`. The three historical files use the verifier's original-source default. Historical signatures are never live promotion authority. Baseline probe output was captured from parent655d07d using its unchanged ecc085f runtime; corrected probe output is separate.

The original `../SHA256SUMS.json` is unchanged and applies at655d07d. All85 entries verify there. Exactly one indexed helper is intentionally different now: `../verify-retirement.mjs`; its corrected bytes are in the source manifest. All original raw evidence, logs, hashes, signatures, pending-upload manifest and accepted app data remain untouched.

## Gates and stop

Independent Claude re-verification is PENDING. G-1 remains OPEN before any cloud deployment: historical image-source chunks are missing, and the retained historical image does not contain this corrected runtime. A separately reviewed corrected-source rebuild, all layers/config/manifest and eventual registry digest are required. No blocked chunk was retried, attached or moved to another upload method. Missing historical raw archives do not block source acceptance under Claude's finding.

G-2 actual cloud proofs, G-3 live adapter/independent cleanup, G-4 pricing/FX and G-5 owner decisions remain open. O-2/O-3/O-4/O-5/O-7, production custody/OPS01, Meta fencing, customer-name confirmation and approved pilot identities remain blocking. O-1/O-6 are B1a only. Native Windows and actual GCP safety are NOT PROVEN. Zero cloud provisioning, cloud credential/account access, spending, real Meta/Calendar calls or merges. PR22 stays Draft. Stop for Claude; no B1b/B2 or deployment authority is inferred.
