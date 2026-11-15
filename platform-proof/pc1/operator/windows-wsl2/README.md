# PC-1 separate Windows11 / WSL2 verification

This is the hardened candidate check. The historical G-1 kit is preserved unchanged elsewhere. Do not reuse the old image digest, modify the original accepted source, or interpret an old reproducibility result as security acceptance.

Prerequisites: a separate Windows11 x64 machine, Docker Desktop Linux containers integrated with a WSL2 Ubuntu24.04 distro, ordinary WSL UID1000, Python3.12+, Git, curl, OpenSSL, tar/xz, timeout and Docker CLI inside WSL, internet for anonymous public source/tools/base/DB, and at least10GB free in WSL/Docker storage. Confirm Docker Desktop licensing is appropriate to your use; no subscription or installation is performed by this kit. No cloud project, billing, credentials, provider account or registry login is needed. The kit downloads tools into its own `/tmp` run; it does not replace system/Windows Node. Allow roughly15–30minutes, depending on network and the large vulnerability database.

The published ZIP includes `reference.json` with the exact tested source/tree and new artifact hashes. Its detached `.sha256` and internal `SHA256SUMS.txt` must be checked before running. Obtain them from this increment's Draft PR/evidence, not the older kit. The reference pins a candidate; it is not an independent signature. Read the scripts before executing.

## 1. Verify and extract in Windows PowerShell

Adjust only these downloaded paths. Do not use admin, execution-policy bypass or unblock commands.

```powershell
$zip = Join-Path $env:USERPROFILE 'Downloads\nukmiris-pc1-operator-kit.zip'
$sums = $zip + '.sha256'
$expected = ((Get-Content -LiteralPath $sums -Raw).Trim() -split '\s+')[0]
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLowerInvariant()
if ($expected -notmatch '^[a-f0-9]{64}$' -or $actual -ne $expected) { throw 'Kit checksum mismatch. Stop and preserve downloads.' }
$kit = Join-Path $env:USERPROFILE ('Downloads\NukMiris-PC1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
Expand-Archive -LiteralPath $zip -DestinationPath $kit
Set-Location -LiteralPath $kit
Get-Content -LiteralPath .\reference.json
```

Expected: source/tree/new hashes match the Draft PR's tested reference. If not, stop. The forbidden old config ID ends `c30f888`.

## 2. Capture the host receipt under Restricted PowerShell

Read `Capture-Windows-Host.txt`, then **paste its contents into the ordinary interactive PowerShell console**. It is a text snippet, not a `.ps1` invocation. Restricted script execution does not require a policy change for these interactive commands. Set its distro, non-secret machine label and actual Docker image-store choice (`classic` or `containerd`). It reads Windows build, Docker Desktop file version, WSL version and effective policy and writes `windows-host.json` in the extracted folder. It never changes a security setting. Do not include Windows login names, tokens or cloud account details.

Inspect the receipt. Expected: Windows11, x64, your distro/label, actual Desktop version, actual store and capture timestamp. Native Restricted PowerShell behavior still needs your run; Linux unit tests cannot establish it.

If your organization also blocks these interactive system-information commands, stop and preserve the error. Do not bypass policy. Request an administrator-approved read-only way to capture the same receipt fields. A missing receipt cannot silently become a completed owner check.

## 3. Launch either from PowerShell or directly from WSL

After pasting the receipt block, `$kitWsl`, `$receiptWsl` and `$Distro` are set:

```powershell
& wsl.exe -d $Distro --exec /usr/bin/env -u BASH_ENV -u ENV bash --noprofile --norc ($kitWsl + '/verify-pc1-wsl.sh') $receiptWsl
if ($LASTEXITCODE -ne 0) { Write-Output 'HOLD: preserve the printed RUN_DIRECTORY and partial results ZIP.' }
```

Or open that WSL distro directly. Adjust the extracted path, including spaces/Unicode as needed:

```bash
cd '/mnt/c/Users/YOUR-LOCAL-USER/Downloads/NukMiris-PC1-YYYYMMDD-HHMMSS'
sha256sum --check SHA256SUMS.txt
env -u BASH_ENV -u ENV bash --noprofile --norc ./verify-pc1-wsl.sh ./windows-host.json
```

The direct WSL route requires the same Windows receipt from step2. Never omit it or substitute an owner attestation for missing machine evidence. The procedure validates observed Docker store against your selection. It does not toggle store settings. Canonical Docker save archives with gzip-compressed or uncompressed layers are normalized and verified against diff_ids; an unsupported store/archive must HOLD and be reported, not silently rebuilt with different inputs. Both native store modes remain unverified until actually run.

The kit fetches the exact Git commit anonymously with credential helpers disabled, checks its tree/working bytes, freshly installs14 lockfile dependencies with scripts disabled, verifies official Node24.22.3/npm11.19.1 and Trivy0.76.2 downloads against pinned/upstream checksums, pulls the exact public base, and runs two builds with separate fresh install contexts. Each build runs the mandatory gate and preserves complete raw vulnerabilities, CycloneDX, DB hash/timestamps, runtime version/mapped-file receipts and failures. Two image-archive/config/source-layer/OCI hashes must equal the published reference. It then runs the unchanged accepted inert, negative startup, mTLS/identity/source, one synthetic effect, ledger export and cleanup smokes. Packaged SQL revocation uses a readiness stub; actual PostgreSQL is covered by the published full suite, not claimed as executed by this operator script.

Expected final local gate: `PASS_LOCAL_PENDING_INDEPENDENT_REVIEW` twice. Smokes: health200/ready503/default inert, activation blocked; all identity/authorization negatives true; one synthetic effect, unknown identity/source rejected, export verified, container/fixture cleanup true. A newer DB can find new issues. Preserve them and stop; do not use ignore rules, refresh dates, loosen version floors or change source to force a match. Policy expiry also HOLDs pending a separate reviewed update.

## 4. Preserve and verify the results package

Every exit after run initialization prints `RUN_DIRECTORY=/tmp/nukmiris-pc1-windows-...` and a JSON ZIP path/hash. On failure the package retains partial evidence and reports `INCOMPLETE_HOLD_PRESERVE_FINDINGS`. On success it reports `COMPLETE_REVIEW_PENDING`. No automatic upload or review occurs.

In WSL, replace the printed run path:

```bash
RUN='/tmp/nukmiris-pc1-windows-PRINTEDSUFFIX'
cd "$RUN/results"
sha256sum --check SHA256SUMS.txt
cd "$RUN"
sha256sum --check "$(basename "$RUN")-results.zip.sha256"
wslpath -w "$RUN"
```

Copy only that results ZIP and its `.sha256` to your chosen Windows folder using Explorer at the printed `wslpath` location. Verify again:

```powershell
$resultZip = 'C:\YOUR-CHOSEN-FOLDER\nukmiris-pc1-windows-PRINTEDSUFFIX-results.zip'
$expected = ((Get-Content -LiteralPath ($resultZip + '.sha256') -Raw).Trim() -split '\s+')[0]
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $resultZip).Hash.ToLowerInvariant() -ne $expected) { throw 'Results checksum mismatch. Stop.' }
```

Review `summary.json`, `provenance.json`, `digest-comparison.json`, `windows-host.json`, `docker-store.json`, command logs and both security directories. Retain all Medium/Low/Unknown findings and any failed security evaluation. Packages exclude image archives, DB bytes, npm cache, home, test keys and fixture folders. They include unsigned records and checksums, not a signed host/provenance attestation. Send them only when the owner authorizes review publication.

Do not run `docker push`, registry login, gcloud, Terraform apply or real providers. Do not retag/push/deploy the old image. PC1 stays open until the separate rebuild and security review pass; a local result grants no cloud authority. Do not prune Docker or alter existing application profiles; the kit removes only its own smoke containers/fixtures and empty configs it created. Its pulled base/candidate remain local, untagged for registry use, for inspection.
