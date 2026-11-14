# B1a-2 local evidence

Implementation: `ecc085f3a2e413c9f3a228066292b81ad9c1be73`; tree `5748cbadd56bdfed11319e51d11530abb2dccc1d`. Base: `ac38ede7777e5493a458995b021a103e55a0059e`. Draft PR #22. Source changes are confined to `platform-proof/`; accepted application `b4d0be0cb98c7f2b69be318e18b93f4de102c511`, its127 source hashes and107 historical proof files are unchanged.

Final Linux results: **103 full /62 fault /21 concurrency PASS**, zero failures/cancellations/skips. Suites overlap. Node24.19.0, measured PostgreSQL17.11/UTC, pinned Docker image; Terraform1.17.2/google8.11.0 formatting and validation pass. `commands.json` records exact commands/start/end/source and serial execution. Full/fault/concurrency ledgers26/22/5 pass both original verifiers. Each signed realistic-latency retirement bundle independently reproduces EVIDENCE_READY at its recorded **fixture reference time**, never current live authority.

`publication.json` is authoritative for archive availability. An automatic review initially rejected a compressed full-run chunk because the artifact was opaque and exact-byte authorization was unclear. `exact-payload-review.json` maps those exact100000 bytes to the audited parent archive and its member manifest. No encoding/format/channel change is used to route around that decision. Complete readable logs, signature evidence, audits and available archive parts are published separately. Pending parts are not claimed complete; the additional exact-byte check was also rejected, so uploads are stopped pending explicit owner approval of `pending-upload-approval.json`.

`privacy-audit.json` examined312 archived files, all keys/strings and5920 effect payloads; effect bodies are only `{synthetic:true}`. Signed observation payloads contain clock/metric/canary metadata and are verified separately. Zero unexpected credential/customer fields or private-key/credential patterns. This is a Codex content audit, not Claude acceptance or forensic account inspection. The image's184 packaged files were separately audited:42 runtime files match the final source, no private keys. No runtime credential/key mounts are archived.

## Reproduce

Use a fresh isolated Linux checkout of the tested source and follow `../README.md`. Set `B1A_SOURCE_SHA` and `B1A2_SOURCE_SHA` to the exact source; direct each suite's `B1A_EVIDENCE_DIR`, `B1A2_EVIDENCE_DIR`, `B1A_DIAGNOSTIC_DIR` to separate new folders. Run full/fault/concurrency serially. Source/run hashes are in `tested-files-sha256.json`; `source-integrity.log` verifies protected source and original bytes. No cloud credentials, account queries or provider calls are needed.

Verify all published `SHA256SUMS.json` entries first. Reassemble an archive only when **all** its parts are available:

```python
import hashlib,json
from pathlib import Path
for item in json.loads(Path('archive-assembly.json').read_text())['archives']:
    if not all(Path(p).is_file() for p in item['parts']):
        print('PENDING',item['file']); continue
    data=b''.join(Path(p).read_bytes() for p in item['parts'])
    assert len(data)==item['bytes']
    assert hashlib.sha256(data).hexdigest()==item['sha256']
    Path(item['file']).write_bytes(data)
```

Extract each complete archive into its own empty folder; reject absolute paths, links and `..` members. Run the existing verifiers against that folder's `native/` subdirectory:

```sh
node platform-proof/b1a/verify-evidence.mjs EXTRACTED/native
node platform-proof/scripts/verify-evidence.mjs EXTRACTED/native
node platform-proof/b1a2/evidence/verify-retirement.mjs EXTRACTED/new/observer-retirement.json
```

The readable `retirement/full.json`, `fault.json`, `concurrency.json` permit signature/result verification even before archive download. Do not combine independently initialized ledgers, use historical fixture signatures as fresh evidence, or reinterpret a local decision as GCP safety proof.

## Coverage and retained history

The dedicated B1a matrix covers54 point×control×provider cells,20 trials each (1080), and400 uninstrumented asynchronous suspensions with130 direct kills. The legacy1000 campaign retains its historical metadata behavior:18/27 point×control combinations, not27; its `mode` can contain provider mode because the control field was overwritten. Instrumented SIGSTOP/SIGCONT is not arbitrary instruction suspension. No old raw result, mode field or hash is repaired retrospectively.

The initial source `b5ed555aee52058e8641d863a5aa857d12c64d31` passed102 full/62 fault before an offline IAM review corrected GCS bucket-list conditions and managed-principal dependencies. Its separately identified raw/log records are retained under `prior-b5-raw` and `development/`; they are not substituted for the final pin. Earlier unpinned development logs include corrected wiring errors and a captured disk-exhaustion startup failure. Failed pre-export traces are not reconstructed. Final runs use new directories and the corrected source exclusively.

## Image, fake provider and restrictions

Canonical OCI manifest `sha256:dc01d76b91e833a516ad97220d47d28aac050e24e0e559612a4cbcaad17e7c29`; exact Docker image/config `sha256:4280e7b91f0bbf3ba517cbfa411db8282624964023162e0c095a72670e56c144`. These are local artifacts, **not uploaded Artifact Registry images**. `image-source.tar.gz` contains the original own source layer; large public Node base layers are referenced by immutable hashes. `assemble-image.py` reconstructs the exact tested Docker image using a `docker save` of `node@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df` plus that own layer. Six layer hashes, config and manifest hashes were verified; Docker reload and inert smoke succeeded. Recompression/push may change registry digests and requires new verification/approval.

The packaged fake was executed non-root/read-only through loopback-only ports. Actual mTLS accepted one synthetic effect, rejected an unknown identity and an unauthorized source, and exported a verified fsynced ledger. `package-fake-smoke.mjs` reproduces that supplemental test; its disposable keys are generated outside images/state and removed. Native Windows was NOT EXECUTED. Network models and localhost Google-shaped API fixtures do not establish actual GCP IAM, firewall, clock, shutdown, canary or billing behavior.

Inventory140, with30 sealer-only placement removals; sealer remains runtime-project, independent custody retained. Six-hour USD17.30 with contingency becomes USD22.07 under illustrative tax/billing-lag/retention stress, exceeding the proposed USD20 allocation. No budget/FX/window is authorized. O-2/O-3/O-4/O-5/O-7 remain open; O-1/O-6 are B1a-only. Production custody, old-instance removal, real Meta token fencing, customer-name confirmation and approved pilot identities remain mandatory. B1b/B2 are not authorized. No GCP account access, credentials, provisioning, spend, real Meta/Calendar calls or merges occurred. Claude review is pending.
