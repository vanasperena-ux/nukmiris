# PC-1 reproducible local evidence

Tested source **`78f182b2282cbbeb39408c3d57fae841ca70aab5`**, tree **`85b9f50e1dea52a8948a91d2f1f507889cac2479`**, stacked on PR23 head `564be22d57ec895208002925c9ac1a2f7abd4a8e`. [Draft PR24](https://github.com/vanasperena-ux/nukmiris/pull/24). These results are new local synthetic execution, not a rewritten G-1 result or native owner-machine acceptance. No application/business/runtime/SQL/Terraform execution bytes changed.

## Results

| Command from platform-proof | Passing tests | Measured duration |
| --- | --- | --- |
| `npm test` |141|428.54s|
| `npm run test:fault` |100|388.60s|
| `npm run test:concurrency` |30|41.89s|
| `npm run test:readiness` |24|1.48s|
| `python3 -I pc1/test_security.py` |19|4.06s|

Zero failures/cancellations/skips/todos in these suites. Counts overlap: the19 Python cases are wrapped as one test in full/fault/concurrency; readiness tests also appear in full. [commands.json](commands.json) contains actual start/end times/exit codes; [logs](logs) retain complete output. Node24.22.3/npm11.19.1/OpenSSL3.5.9, measured PostgreSQL17.11/UTC; Linux/Docker28.4.0. [Environment](environment.json). Native Windows/WSL/Restricted PowerShell and Docker Desktop store modes: **NOT EXECUTED in Codex**.

Both fresh builds pass the mandatory gate and have identical188 application/dependency file records plus two public UID1000 compatibility files. [Independent digest/canonical-entry inspection](reproducibility.json), [build A](build-a/artifact.json), [build B](build-b/artifact.json). Both complete raw scans, CycloneDX1.7 SBOMs, loaded-file provenance, DB hashes/timestamps and command receipts are in the respective `security/` directories.

```yaml
sourceLayerDigest: sha256:e1e9e5b6e62842ea0d27a67b2c7a187808a11d39fe1eca627f62caef80a89161
imageConfigId: sha256:cdeed164f6cdba2ea419b5e92ef340326383feef16d97a3f1df4412c3954657a
canonicalUncompressedOciManifestDigest: sha256:f52c1948e758368f270f491d5a19d05f791e0bf0431bcd32ba4db1d11e3ed4bd
dockerArchiveSha256: ceb375af667795107d25075a115918bff5e15a7481ceab983b6c432926c5158b
sourceManifestSha256: af71fee90cd25d66938eedd14650dd48726f019f879d88b8cdcf99ec34078f7b
registryDigest: null
```

These are local config and canonical uncompressed OCI hashes, not a pushed registry digest. Image/layer archives are preserved locally and reproducible from the exact public source/immutable base/lockfile; no registry tag/push/deployment occurred. Two builds use separate fresh `npm ci` contexts on the same Codex host, not two independent hosts.

## Security finding inventory

The final image has0Critical/0High/39Medium/12Low/2Unknown package findings, zero fixable C/H, zero runtime C/H, **no exceptions and no ignored findings**. All14 retained OS packages,14 dependencies and the application root are inventoried. Actual mapped-package findings:24Medium/10Low/2Unknown; other retained packages:15Medium/2Low. The gate treats both sets as potentially reachable. Node is checked separately by exact security version/binary hash and bundled OpenSSL; Trivy's standalone Node blind spot is not treated as zero vulnerabilities. [Complete reachability/fixability/exception inventory](vulnerability-inventory.json).

The database was fetched from the public Aquasecurity GHCR repository; version/freshness/content hashes are recorded in both scan receipts. Maximum database age24h, policy review age7days, future/missing/due-for-update evidence fails closed. Re-review current official Node advisories before any eventual deployment proposal and rescan; a recorded-time replay is not a fresh security approval.

[Base comparison](base-comparison) preserves the rejected updated slim result:0C/54H/97M/65L/5U, including fixable npm-tooling and zlib findings. Distroless base:0C/0H/39M/12L/2U and the official Node binary. Repeated base-layer/config decoding of both alternatives verifies assembly-format compatibility; it is explicitly not a second slim final-image build or independent host reproduction. Selection avoided retaining/remediating unnecessary runtime tooling; no architecture redesign was made.

## Failures and historical preservation

[Initial format HOLD](development/initial-format-hold) preserves source `263bdb1773cdd37174669dc6a611322907fad499`, its exact artifact/raw scans/receipt and nonzero CLI result. The initial gate expected CycloneDX1.6/14 language packages; the actual scanner emitted1.7 and the application root plus14 dependencies. Development diagnostics also found Debian epoch/revision/PURL normalization. These are retained separately, then corrected at the tested source; no failed result was overwritten or relabeled. Synthetic negative-test failures are expected and retained in the Python log; they are not failed regression tests.

Current B1a-2 Terraform fmt and all scope guards pass. The broader recursive fmt probe reports one unchanged historical `platform-proof/planning/terraform/versions.tf`; [raw output](logs/terraform-fmt.log). This pre-existing formatting issue was not modified. Terraform provider init/validate/plan/apply were **NOT EXECUTED** in this increment; provider cache is absent and no infrastructure code changed. The scope guard verifies the impossible apply guard byte for byte and LIVE=false.

## Safety evidence

The unchanged inert/negative startup and packaged synthetic provider smokes pass: health200/readiness503 without configuration, cloud mode rejected, missing/copied/expired identity/session/epoch/authorization held, unknown identity/source rejected, exactly one synthetic effect, hash-chain export and container/private-fixture cleanup verified. [Smoke timings](logs/smoke-commands.json). Packaged SQL revocation is a labeled readiness stub; the full suite separately uses actual PG17.11 for SQL/COMMIT/revocation.

Both unchanged ledger verifiers accept all56 new local SQL case exports. [Verifier outputs](verification). Ten historical signed retirement bundles, three new signed retirement exports and four new signed native transit exports reverify. The three local retirement results retain derived authenticated activity; native post-fence writes remain VIOLATION and never grant cloud dispatch/promotion. [Signed native records](native).

Only three representative SQL cases are published in [sql-ledgers](sql-ledgers). The other raw campaign exports remain session-local (26,802,486bytes), with a complete [168-file hash index](verification/local-sql-export-index.json) and successful verifier outputs. This index does not make those bytes remotely available. No original blocked archive chunks were retried or repackaged. The complete vulnerability/SBOM/security reports are published, including unsuccessful security evaluation.

## Owner procedure and remaining gates

[Windows/WSL2 instructions](../operator/windows-wsl2/README.md), [operator ZIP](operator/nukmiris-pc1-operator-kit.zip), [ZIP checksum](operator/nukmiris-pc1-operator-kit.zip.sha256), [exact reference](operator/reference.json). ZIP SHA-256: `ce672f9143e62e258027ad021113e962ef7730e3b4f51d0afdc0ebe429830d9f`. Linux helper tests validate source/digests/smoke verdicts and the missing-host failure path; they do not prove native Restricted PowerShell/WSL behavior. The ZIP requires an interactive Windows receipt without changing execution policy and checks the declared/observed Docker store. Every failed run preserves findings and a checksummed partial package.

All provenance is unsigned local/operator evidence, not SLSA or cryptographic host attestation. Independent Claude PC1 candidate review and owner's separate-machine rebuild/security review remain open. The old image `sha256:1931766e764e9b400e3781796fa416421dda01fc992d69c4933295f29c30f888` stays permanently LOCAL-TEST-ONLY, never registry-tagged/pushed/deployed. Source approval cannot close PC1 on its own. Cloud/transit/retirement/custody009/011/017/OPS01/actual-account/cost/provider gates remain blocking. No cloud account, credentials, provisioning, spending, real Meta/Calendar, registry push or merge occurred.
