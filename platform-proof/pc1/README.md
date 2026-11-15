# PC-1 local image security hardening

Owner authorization: [OWNER-CHARTER.md](OWNER-CHARTER.md). Review baseline: PR #23 head `564be22d57ec895208002925c9ac1a2f7abd4a8e`, with [Claude's G-1 operator-results review](https://github.com/vanasperena-ux/nukmiris/pull/23#issuecomment-6899142650). This increment changes packaging/validation and local verification only. Accepted gateway/application/SQL/Terraform execution bytes and historical evidence remain unchanged. Run `npm run pc1:check` from `platform-proof` to verify the boundary.

The old image `sha256:1931766e764e9b400e3781796fa416421dda01fc992d69c4933295f29c30f888` remains **permanently LOCAL-TEST-ONLY: never tag for a registry, push or deploy**. Its accepted reproducibility and rejected security are distinct historical results. This increment never changes its recipe commit or evidence.

## Selected runtime and alternatives

[image-policy.json](image-policy.json) pins official distroless Node24/Debian13 `linux/amd64` by immutable repository digest and config identity. Node 24.22.3 is the current 24.x security release at the 2026-11-15 review, incorporating the October and November Node security releases. The actual `/nodejs/bin/node` SHA-256 matches the binary extracted from the official Node tarball; the build/runtime record includes bundled OpenSSL 3.5.9 and Debian 13.7. Official HTTPS checksum validation is claimed; independent signed publisher attestation is not.

Both public base alternatives were pulled and run locally as UID1000, read-only, network-none, and scanned using the same fresh Trivy0.76.2 database:

| Candidate | Critical / High | Medium / Low / Unknown | Runtime and packaging |
| --- | --- | --- | --- |
| `node:24.22.3-trixie-slim`, digest `sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0` | 0 / 54 | 97 / 65 / 5 | Node24.22.3/OpenSSL3.5.9/Debian13.7; package managers and shell present; fixable zlib and npm dependencies. Rejected as-is. Removing npm would leave fixable zlib and many severe unused-tool findings. |
| `gcr.io/distroless/nodejs24-debian13:nonroot`, digest `sha256:6abfcb367ebc291572c774c1592a986be2ab26a2486f73093401327495a5962a` | 0 / 0 | 39 / 12 / 2 | Same upstream Node binary; no shell/npm/npx/Corepack/Yarn/apt/dpkg executable. Selected, subject to final candidate tests and independent review. |

Complete raw reports, including the rejected slim result, are retained in PC1 evidence. These are package-finding counts, not unique CVE counts. Severity follows Trivy's vendor-selected `Severity`; all other vendor ratings/CVSS/Unknown findings remain visible. Zero severe findings does not mean zero vulnerabilities or production approval. Fresh final-image scans, loaded-library attribution and two actual fresh dependency installs/reassemblies are separate evidence. Base-layer/config compatibility checks for both alternatives are not presented as a second-host final-image reproduction of slim.

The existing canonical assembly format is preserved: exact Git roots, fresh lockfile/SRI offline `npm ci --ignore-scripts --omit=dev`, fixed metadata sorted USTAR, unchanged upstream uncompressed layers, canonical JSON config/OCI manifest. Two public `/etc/passwd` and `/etc/group` additions map `node` to UID/GID1000; PATH includes `/nodejs/bin`. No host account file, private key, certificate fixture, credential config, ledger or customer database is copied into the layer. Direct Node entrypoint and accepted inert default remain. A package manager and shell are not needed at runtime. All image-archive paths are inspected for prohibited tooling, including symlinks and versioned Yarn roots.

## Mandatory gate

The public `readiness/build-image.py` CLI always calls [scan-image.py](scan-image.py). It has no skip-security option. Assembly produces an explicitly pending artifact; only a complete gate can produce `PASS_LOCAL_PENDING_INDEPENDENT_REVIEW`. Pure assembly helpers are testable but are not an acceptance API.

The scanner verifies the pinned Trivy binary, actual artifact/config/layer hashes, full raw report and CycloneDX image/package identities, fresh database hashes/timestamps, exact 14 application dependencies, OS coverage and runtime-file ownership against the scanned package inventory and archive bytes. A read-only network-none probe exercises crypto/TLS/zlib/DNS/HTTPS/pg and hashes its mapped files. All retained OS packages and all application dependencies are conservatively potentially reachable, including libraries not observed in that particular probe. Native addons require a new review. Trivy does not reliably inventory the standalone Node executable, so a separate exact Node version, security floor, binary hash, OpenSSL version and current dated Node release policy are mandatory.

Every fixable Critical/High blocks. Every runtime/application Critical/High blocks, even without a fix. This candidate accepts **no severe-finding exceptions**. Any future proposal for unused, unfixable severe findings needs an individual package/version/CVE/base-bound justification, dated independent approval and expiry; changing a scanner ignore file or a CLI option cannot grant it. Scanner errors, absent attribution, stale/future database/policy, mismatched scan/SBOM/image and unexpected addons fail closed. Raw failures and a HOLD receipt are preserved. Scanner exit0 means execution completed, never security PASS.

Database maximum age is24h and it must not be due for update. Node policy expires after7days; this is an upper bound for local review, not a promise no new advisory can appear during that window. Before an eventual deployment proposal, repeat official advisory review and scan within7days (prefer same-day), and stop on any newly disclosed relevant issue. Do not backdate/refresh the policy to bypass expiry. Reproduction remains possible after expiry, but candidate acceptance must HOLD pending a separately reviewed source/policy update.

No signing key is generated. Provenance is an unsigned local record, not a SLSA attestation. Public anonymous base/tool/DB downloads do not access a Google Cloud account. No registry writes, infrastructure apply, provider calls or account credentials are part of the procedure.

## Local commands

Use explicit Node24.22.3/npm11.19.1, Python3.12+, Docker Linux engine, OpenSSL and Trivy0.76.2. Use a fresh empty Docker config at `/tmp/nukmiris-readiness-docker-config`; never reuse an existing credentials config. Fetch the public base by `image-policy.json` digest. Populate a private npm cache once with scripts disabled. Download the public Trivy DB explicitly from `ghcr.io/aquasecurity/trivy-db:2`; scans are offline thereafter.

```bash
cd platform-proof
npm ci --ignore-scripts --cache /tmp/nukmiris-pc1-npm-cache --no-audit --no-fund
SOURCE=$(git rev-parse HEAD)
python3 -I readiness/build-image.py --repo .. --source "$SOURCE" \
  --out /tmp/nukmiris-pc1-build-a --cache /tmp/nukmiris-pc1-npm-cache \
  --base-archive /tmp/nukmiris-pc1-base.tar --trivy /path/to/verified/trivy \
  --trivy-cache /tmp/nukmiris-pc1-trivy-cache
python3 -I pc1/test_security.py
npm run test:pc1
npm run pc1:check
npm test
npm run test:fault
npm run test:concurrency
npm run test:readiness
```

Use a new empty `--out` for the second build. Compare the source-layer, config, canonical uncompressed OCI manifest, Docker archive and source-file manifest hashes. `registryDigest` remains null; a future compressed registry manifest may differ and is a separate authorized step.

## Owner verification and remaining gates

[Windows/WSL2 instructions](operator/windows-wsl2/README.md) require a separate owner machine, a captured Windows receipt even under Restricted PowerShell, two fresh builds, security gates and all accepted synthetic smokes. Native Windows/WSL execution in this Codex Linux environment is **NOT EXECUTED**; unit-tested receipt handling is not native Windows acceptance. Source review alone does not close PC1. Owner rebuild/security review must follow.

`LIVE_CLOUD_EXECUTION=false`, the source-only infrastructure apply guard, production custody009/011/017, OPS01, retirement/transit measurement and promotion gates, actual-account/read-only owner authorization and costs remain blocking. This hardening does not establish cloud worker/CPU/old-version-removal behavior, real Meta/Calendar safety or commercial activation. No provisioning, registry push, spending, merge, credentials or real-provider activity is authorized by a local PASS.
