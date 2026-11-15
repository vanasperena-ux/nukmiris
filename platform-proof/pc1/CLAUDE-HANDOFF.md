# Independent review: PC-1 HARDENED SOURCE/IMAGE CANDIDATE ACCEPTANCE

Review [Draft PR24](https://github.com/vanasperena-ux/nukmiris/pull/24), tested source `78f182b2282cbbeb39408c3d57fae841ca70aab5`, tree `85b9f50e1dea52a8948a91d2f1f507889cac2479`, on exact PR23 head `564be22d57ec895208002925c9ac1a2f7abd4a8e`. This is the owner's authorized PC1 response to [your G-1 operator-results review](https://github.com/vanasperena-ux/nukmiris/pull/23#issuecomment-6899142650), not provisioning authorization. Read the [owner charter](OWNER-CHARTER.md), source diff, [policy/architecture limits](README.md), [raw evidence](evidence/README.md), source guards and operator kit. Do not rely solely on this handoff.

## Requirement traceability

| Requirement | Implementation/evidence | Independent checks requested |
| --- | --- | --- |
|H1 current official Node/OS|Official distroless Node24.22.3/Debian13.7 digest/config pin; Node binary matches official tar, OpenSSL3.5.9; official release references/receipts|Recheck official advisories, upstream base provenance and exact binary; distinguish bundled OpenSSL from retained OS libssl.|
|H2 remove runtime tooling|No npm/npx/Corepack/Yarn/shell/apt/dpkg executable; whole archive tooling-path inspection; UID1000 public account compatibility; direct Node; two fresh matching builds and original smokes|Review actual slim/distroless comparison,190 canonical own entries, source roots/dependencies, loaded-file hashes and no private/cert/data inclusion. Slim has only base decode/runtime/scan evidence, not a second complete final build.|
|H3 F2 explicit validation|Security asserts removed; `unoptimized()` before CLI actions and assembly; `[A-Z0-9 ]*PRIVATE KEY` pattern; source/base/layer/SRI/path/regular-file checks|Run19 Python tests; normal/-O/-OO private-header negatives and CLI optimization rejection. Investigate any bypass without changing accepted application logic.|
|H4 mandatory scan gate|Pinned Trivy0.76.2; fresh DB/command/hash receipts; complete raw JSON and CycloneDX1.7; independent Node floor; scan/SBOM/image/package/loaded-file binding; all OS/app potentially reachable; no exceptions accepted|Try scanner-exit0 with severe findings, stale/future/missing DB, wrong Node/image/SBOM/PURL/epoch/release/attribution, tooling/addons and optimized mode. Verify0C/0H/39M/12L/2U, retain alternate raw ratings and Unknowns. Recorded-time replay is not current security approval.|
|H5 operator proof|Separate ZIP/ref/checksums, interactive PS receipt works without invoking unsigned .ps1 or bypass; direct WSL requires receipt, actual Docker store recorded; two fresh builds/gates/smokes, complete raw reports and checksummed partial failure package|Review commands against Restricted PowerShell semantics, receipt privacy, no credential/config reuse and both store/archive formats. Native execution is NOT EXECUTED in Codex and remains mandatory on owner machine.|

Tests: **141 full /100 fault /30 concurrency /24 readiness**, plus19 Python; zero failures/cancellations/skips/todos. Counts overlap. Node24.22.3; measured PG17.11/UTC. Original inert/startup/mTLS/export/cleanup smokes pass. All56 SQL exports verify through both unchanged helpers; ten historical and three new signed retirement bundles and four new native transit bundles reverify.1,087 historical/application files unchanged. No gateway/business/SQL/Terraform runtime edits; apply guard and LIVE=false preserved.

New local hashes:

```yaml
sourceLayerDigest: sha256:e1e9e5b6e62842ea0d27a67b2c7a187808a11d39fe1eca627f62caef80a89161
imageConfigId: sha256:cdeed164f6cdba2ea419b5e92ef340326383feef16d97a3f1df4412c3954657a
canonicalUncompressedOciManifestDigest: sha256:f52c1948e758368f270f491d5a19d05f791e0bf0431bcd32ba4db1d11e3ed4bd
dockerArchiveSha256: ceb375af667795107d25075a115918bff5e15a7481ceab983b6c432926c5158b
sourceManifestSha256: af71fee90cd25d66938eedd14650dd48726f019f879d88b8cdcf99ec34078f7b
registryDigest: null
operatorZipSha256: ce672f9143e62e258027ad021113e962ef7730e3b4f51d0afdc0ebe429830d9f
```

Reference base: `gcr.io/distroless/nodejs24-debian13@sha256:6abfcb367ebc291572c774c1592a986be2ab26a2486f73093401327495a5962a`; config `sha256:aa456d5b0d14c99ec011ddd5f28c7d540501bbfb2df41b26e8d83b2b426dae33`. Two Codex builds are one-host evidence. The owner's second-host rebuild/security review has not happened. Old image1931766 remains permanently local-test-only. No exception was granted; zero C/H is not zero vulnerabilities or a production verdict.

## Reproduce source and tests

Use a new isolated checkout at the exact tested commit, Node24.22.3/npm11.19.1, PG17.11 pinned fixture, Python3.12+, Docker/OpenSSL and empty fixture configs; no credentials/account. From platform-proof:

```bash
npm ci --ignore-scripts --no-audit --no-fund
python3 -I pc1/test_security.py
npm test
npm run test:fault
npm run test:concurrency
npm run test:readiness
npm run pc1:check
npm run readiness:check
```

For images, use the source-pinned [operator kit](evidence/operator/nukmiris-pc1-operator-kit.zip) on a separate Windows11/WSL2/Docker Desktop machine with its detached SHA. It downloads verified portable tools and public anonymous inputs only. Read [the full procedure](operator/windows-wsl2/README.md). Do not bypass expiry, alter policies, retag/push images or access GCP. Preserve any newer-DB finding. Inspect the initial failed format evaluation and subsequent source correction; it was not rewritten.

Published `evidence/SHA256SUMS.json` binds every initial evidence file/Git blob except itself; the additive publication readback receipt records actual GitHub verification separately. Raw SQL campaigns other than three representative cases remain session-local with a complete index; do not claim all campaign bytes published. The complete raw vulnerability reports/SBOMs are published. All raw historical G-1 records and old operator ZIP remain unchanged. Recursive Terraform fmt reports one pre-existing historical file; current B1a-2 fmt passes. Provider init/validate/plan/apply are NOT EXECUTED; no infrastructure changes were made.

Please independently return GO / GO WITH CONDITIONS / NO-GO for **PC-1 HARDENED SOURCE/IMAGE CANDIDATE ACCEPTANCE**, listing blockers, exact source and limits. A favorable source/image-candidate review does not close PC1 without owner second-machine rebuild and subsequent security review. It grants no cloud implementation, credentials, billing, registry push, providers, provisioning, spending or merge authority. G2 measurement-only, G3 actual account/custody, production009/011/017, OPS01 and real-provider/name-confirmation gates stay open. Stop at review.
