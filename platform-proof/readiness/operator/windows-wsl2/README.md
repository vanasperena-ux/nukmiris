# NukMiris G-1 — operator-run, separate Windows/WSL2 machine

This kit is a procedure, not evidence that the Windows run happened. Run it yourself after reading the scripts. No commands have been executed on your laptop. Nothing is uploaded automatically. There are no GitHub writes, image pushes, Google Cloud commands, logins, provider integrations, resource provisioning or billing actions.

Authority: [Claude's PR23 source acceptance](https://github.com/vanasperena-ux/nukmiris/pull/23#issuecomment-6888352338), especially PC-1 and F-2. Follow the accepted [IMAGE.md](https://github.com/vanasperena-ux/nukmiris/blob/9b526c048d5df1b3fbcf03e8f33c3ba53979b492/platform-proof/readiness/IMAGE.md). This procedure preserves that source exactly.

| Pin | Required value |
|---|---|
| Original accepted source | `9b526c048d5df1b3fbcf03e8f33c3ba53979b492` |
| Source tree | `74801a03193011c24385d6ff36fb60178d61f107` |
| Published reference/evidence commit | `d6dc74b6efa2c103a83f188465d8e426502822d7` |
| Evidence tree | `71e654fa01161e4a88f1dbb67ef5ae157a11a395` |
| Base, linux/amd64 | `node@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df` |
| Own source layer | `sha256:6b18c59d7cf8ea39b77cd5a7f46e87656dd87326009e8900b94604cf7c297ed3` |
| Image config / local image ID | `sha256:1931766e764e9b400e3781796fa416421dda01fc992d69c4933295f29c30f888` |
| Canonical uncompressed OCI manifest | `sha256:2f4f4b87448651dc8aef36de244771c33c96edf421983e066ef2375fd4713e80` |
| Canonical Docker archive SHA-256 | `21679e621c173331df503c9ce7326457884a596955e18869502fdf58c0ab8484` |

These are not a future registry digest. Do not substitute a mutable tag or the PR head for the accepted source. A registry upload could change artifact representation and needs separate authorization and exact-digest approval.

## 1. Prerequisites — operator checks

Use a separate Windows 11 x64 machine from Codex's build host. Use a verification-only WSL2 distribution with its normal first user, UID1000. Work is created in WSL's Linux filesystem under a fresh `/tmp/nukmiris-readiness-windows-XXXXXXXX`, never an existing NukMiris checkout or Windows profile.

Required existing installation:

- Windows11 x64; WSL2; Ubuntu24.04 or another suitable Linux distribution.
- Docker Desktop already installed, licensed as appropriate, running **Linux containers**, using the **WSL2 engine**, with integration enabled for the selected distribution.
- A Linux Docker CLI and `/var/run/docker.sock` inside that distro. Docker VMM's `docker.exe`-only integration is not compatible with this unchanged recipe. Do not install/start a second Docker Engine in WSL.
- Git, Python3.12+, curl, CA certificates, OpenSSL, tar, xz, GNU timeout/coreutils. Reference Python was3.12.14; record the actual version. The three required content hashes decide reproducibility.
- Approximately4GB available WSL memory and12GB free disk are practical allowances, not measured requirements. Leave room in both the WSL filesystem and Docker Desktop's storage. Run serially, with no other verification jobs.
- Anonymous public downloads from GitHub/GitHub release assets, nodejs.org, registry.npmjs.org, Docker Hub and GHCR. No tokens or sign-ins. If policy/rate limiting blocks them, preserve the failure and stop rather than route around it.

The original builder expects uncompressed Docker-save layer bytes. For the closest reproduction on this **dedicated verification machine**, configure Docker Desktop's **classic image store** if supported: Settings → General → clear “Use containerd for pulling and storing images.” Do this deliberately before the run and record it. Switching stores hides the inactive store's images/containers; it does not migrate or delete them. Do not toggle a shared installation to make a failure disappear. If this setup is unavailable, report the compatibility limitation; do not convert layers or rewrite the accepted builder. [Docker image-store documentation](https://docs.docker.com/desktop/features/containerd/).

Check Windows/WSL yourself in **PowerShell**:

```powershell
wsl.exe --version
wsl.exe --list --verbose
```

The selected distribution must show VERSION `2`. In Docker Desktop enable Settings → General → WSL2 engine and Settings → Resources → WSL Integration → that distribution. [Docker WSL2 instructions](https://docs.docker.com/desktop/features/wsl/).

If basic Linux tools are missing, these are optional **operator-run local package setup** commands, not part of the verification results:

```powershell
wsl.exe -d Ubuntu-24.04 --exec bash --noprofile --norc
```

Then in that **WSL shell**, as the normal user:

```bash
sudo apt-get update
sudo apt-get install --no-install-recommends git python3 curl ca-certificates openssl tar xz-utils coreutils
id -u
python3 --version
command -v docker
test -S /var/run/docker.sock
```

Expected UID: `1000`; Python ≥3.12; Linux Docker CLI; socket check exit0. Return to PowerShell with `exit`. Do not run the verification itself with sudo. No PostgreSQL, Terraform, cloud SDK or Windows Node installation is required for these G-1 smokes.

## 2. Inspect the kit and run from PowerShell

The files are `Start-G1.ps1`, `verify-g1-wsl.sh`, `operator_checks.py`, this README and `SHA256SUMS.txt`. Review them before execution. The launcher does not change PowerShell execution policy, Docker settings or WSL settings. If local policy disallows the procedure, stop and obtain normal local administrator review; do not use a policy-bypass flag.

Save the supplied ZIP to Downloads. In **PowerShell**:

```powershell
$kitZip = Join-Path $env:USERPROFILE 'Downloads\nukmiris-g1-operator-kit.zip'
Get-FileHash -Algorithm SHA256 -LiteralPath $kitZip
# Compare with the ZIP SHA-256 supplied alongside the kit.
$kitRoot = Join-Path $env:USERPROFILE 'Downloads\NukMiris-G1-OperatorKit'
if (Test-Path -LiteralPath $kitRoot) { throw 'Choose a new empty kit directory; do not overlay an old run.' }
Expand-Archive -LiteralPath $kitZip -DestinationPath $kitRoot
Set-Location -LiteralPath $kitRoot
Get-Content -LiteralPath .\README.md
Get-Content -LiteralPath .\Start-G1.ps1
Get-Content -LiteralPath .\verify-g1-wsl.sh
Get-Content -LiteralPath .\operator_checks.py
```

Verify all kit file checksums before running:

```powershell
foreach ($line in Get-Content -LiteralPath .\SHA256SUMS.txt) {
    $parts = $line -split '  ', 2
    if ($parts.Count -ne 2) { throw 'Invalid kit manifest.' }
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $kitRoot $parts[1])).Hash.ToLowerInvariant()
    if ($actual -ne $parts[0]) { throw ('KIT HASH MISMATCH: ' + $parts[1]) }
}
'KIT CHECKSUMS PASS'
```

Run, changing the distro name and non-secret machine label as necessary:

```powershell
.\Start-G1.ps1 -Distro 'Ubuntu-24.04' -MachineLabel 'Owner separate Windows11 verification laptop'
```

The Windows version, WSL version, selected distro and installed Docker Desktop version are recorded. For a nonstandard/per-user Desktop installation, add `-DockerDesktopVersion 'VERSION_FROM_ABOUT'` using its actual About-screen value; otherwise the launcher reads ProductVersion from the normal Program Files executable. No account names, tokens, cookies or cloud config files are collected. The launcher creates a new Downloads results folder, invokes the local WSL script, copies back only the results ZIP/checksum, and verifies the ZIP hash. Nothing is sent anywhere.

For direct **WSL execution** instead of the launcher, after prerequisite checks, the equivalent command is:

```bash
KIT=$(wslpath -u 'C:\Users\YOUR_WINDOWS_USER\Downloads\NukMiris-G1-OperatorKit')
/usr/bin/env -u BASH_ENV -u ENV -u G1_OPERATOR_SCRUBBED \
  bash --noprofile --norc "$KIT/verify-g1-wsl.sh"
```

Only replace the Windows path. This direct route omits the automatic Windows version receipt; add a separate non-secret Windows/WSL/Desktop version note for review. All underlying exact commands are in `verify-g1-wsl.sh`; the following sections explain what it does and what each result means.

## 3. Source, local tools and dependency installation

The WSL script starts a scrubbed shell, keeps HOME at its original value, disables Git credential helpers/global configuration and curl startup configuration, and uses two fresh empty npm config files. It refuses to reuse either hardcoded recipe Docker config directory if already present. Its exit handler removes only those directories it created, only if empty. It never reads a real Docker credential config or a cloud SDK profile.

It initializes a new local repository and fetches the exact two public Git objects without credentials:

```bash
git -C "$REPO" -c credential.helper= -c core.askPass= fetch \
  --no-tags --depth=1 https://github.com/vanasperena-ux/nukmiris.git \
  9b526c048d5df1b3fbcf03e8f33c3ba53979b492 \
  d6dc74b6efa2c103a83f188465d8e426502822d7
git -C "$REPO" checkout --detach 9b526c048d5df1b3fbcf03e8f33c3ba53979b492
git -C "$REPO" fsck --full
```

It verifies both tree pins, all44 published changed-source hashes/Git blob IDs, all47 own-layer source files and all14 lockfile package origins/SHA-512 SRI entries. Tracked/untracked source changes fail. No accepted source is patched. `source-integrity.json` must say `PASS`.

Node24.19.0 is downloaded as the official Linux-x64 portable archive and verified against its official SHASUMS256 file, then extracted only under this run's tools directory. [Node release](https://nodejs.org/en/blog/release/v24.19.0). It does not replace Windows or system Node. Because bundled npm differs from the reference host, npm11.9.0 is installed with scripts disabled into a separate run-local prefix:

```bash
npm install --global --prefix "$TOOLS/npm" --ignore-scripts --no-audit --no-fund \
  --cache "$RUN/tool-npm-cache" --registry https://registry.npmjs.org npm@11.9.0
# The script then prepends this run-local npm/bin to PATH and checks versions.
node --version
npm --version
```

Expected: `v24.19.0` and `11.9.0`. No nvm/profile changes. Official HTTPS checksums detect byte corruption; this procedure does not claim independently verified publisher signatures for these tools.

A fresh install from the unchanged lockfile populates a **new initially empty** cache and host smoke dependencies:

```bash
cd "$REPO/platform-proof"
npm ci --ignore-scripts --omit=dev --no-audit --no-fund \
  --cache "$RUN/npm-cache" --registry https://registry.npmjs.org
```

Expect14 packages; the script verifies source integrity again. The builder subsequently performs its own fresh `npm ci --offline` into a new exported context, using only this newly populated SRI-checked cache. It repeats that process into a second context. An old Codex cache, copied node_modules or prebuilt image is not used as the result.

## 4. F-2: preserve historical reproducibility, recommend a separate fix

**Do not edit `readiness/build-image.py` in this run.** The accepted source's critical checks use Python assert and its key-header regex misses ENCRYPTED/DSA. To reproduce the original safely:

- invoke `python3 -I` with no `-O`; the preflight requires optimization0 / `__debug__=True`;
- keep the accepted file byte-identical;
- independently inspect output with `operator_checks.py`, whose checks use explicit exceptions and generic `-----BEGIN [A-Z ]*PRIVATE KEY-----` matching.

Those are operator-side compensating checks, **not a source-level resolution of F-2**. The scan reports filenames/hashes, never private-key bytes, and scans the complete own layer. The upstream public base is separately immutable-pinned; that is not a forensic secret audit of every upstream binary.

**Recommended separate follow-up:** obtain authorization for a distinct hardening change replacing every safety-critical assert with explicit checks/raise, broadening the private-key pattern, and adding normal/optimized-Python regression tests for invalid identities, paths, symlinks and RSA/EC/OPENSSH/ENCRYPTED/DSA headers. Preserve this original run. Review the new commit separately and establish new expected build identities, even if some layer bytes remain unchanged. This kit does not implement or authorize that change.

## 5. Exact accepted build and digest comparison

The script pulls the public base by immutable digest, with anonymous isolated Docker config and explicit `linux/amd64`. Both builds use the exact accepted commit:

```bash
python3 -I readiness/build-image.py --repo "$REPO" \
  --source 9b526c048d5df1b3fbcf03e8f33c3ba53979b492 \
  --cache "$RUN/npm-cache" --base-archive "$RUN/base.docker.tar" --out "$RUN/build-a"
python3 -I readiness/build-image.py --repo "$REPO" \
  --source 9b526c048d5df1b3fbcf03e8f33c3ba53979b492 \
  --cache "$RUN/npm-cache" --base-archive "$RUN/base.docker.tar" --out "$RUN/build-b"
```

The extra `-I` is interpreter isolation, not a source edit. The independent helper recomputes all three core hashes and the canonical Docker archive hash from actual bytes, compares every188 file/metadata entry with the accepted manifest, verifies every Docker archive layer/config against the OCI descriptors, checks inert configuration, and scans for unexpected keys/data files. It saves partial comparisons and metadata before stopping on a mismatch. Only exact success allows image load.

Expected output: `digest-comparison.json` status `PASS`; both builds match every hash in the pin table. `independent-own-layer-scan-a.json` and `-b.json`:188 files and empty findings. No image is rebuilt with updated packages or an alternate base to make a security report cleaner.

## 6. Inert startup and safe synthetic smoke checks

After exact digest verification, these accepted commands run unchanged:

```bash
IMAGE=sha256:1931766e764e9b400e3781796fa416421dda01fc992d69c4933295f29c30f888
docker --host=unix:///var/run/docker.sock --config /tmp/nukmiris-readiness-docker-config \
  load --input "$RUN/build-a/candidate.docker.tar"
node b1a2/build/container-smoke.mjs "$IMAGE"
node readiness/image-smoke.mjs "$IMAGE"
node readiness/package-fake-smoke.mjs "$IMAGE"
```

Expected JSON verdicts:

| Log | Required result |
|---|---|
| inert-smoke | health200, ready503, liveActivationBlocked:true |
| startup-smoke | missing/copied identity, invalid epoch, expired identity/session, missing secrets all rejected; revokedAuthorizationHeld:true |
| fake-smoke | nonRootUser:node; syntheticEffects:1; unknownIdentityRejected:true; unauthorizedSourceRejected:true; exportedLedgerVerified:true |
| fake-smoke cleanup | containerRemoved:true, fixtureDirectoryRemoved:true |

Only synthetic fixture certificates/payloads and loopback-published ports are used. The CLOUD-flag check is a negative test proving refusal before any cloud activity. SQL revocation in the container is a readiness stub. This run does **not** reproduce real PostgreSQL/Cloud SQL, all140/99/29/24 earlier tests, Cloud Run death, G-2 cloud retirement, real WhatsApp or Calendar.

Important Desktop compatibility boundary: the original fake helper assumes its observed source is the Docker bridge gateway and that UID1000 can read its synthetic bind mounts. Some Desktop configurations may differ. A403 clock/provider response, mount error or helper timeout is **a failed/incomplete smoke**, not permission to widen the source allowlist, use root, change TLS validation or patch the accepted helper. Keep the bridge-address/diagnostic logs for a separately reviewed harness correction.

## 7. Vulnerability/SBOM/provenance reports

Only after exact reproduction and successful smokes, the operator script downloads pinned **Trivy0.76.2** from its official public release and verifies the archive checksum. [Release](https://github.com/aquasecurity/trivy/releases/tag/v0.76.2). No install script, account, daemon-socket mount or Docker Scout service is used.

The database is downloaded anonymously from **GHCR only**, overriding Trivy's default Google mirror. Telemetry and version notices are disabled. The actual DB metadata and binary hash are recorded. The two scans then consume the **local candidate Docker archive**, with DB updates/dependency API lookups disabled, no ignore file, and no fixed-only filtering:

```bash
trivy image --cache-dir "$RUN/trivy-cache" --config '' \
  --db-repository ghcr.io/aquasecurity/trivy-db:2 --download-db-only \
  --disable-telemetry --skip-version-check --timeout 10m

# Full exact flags, including explicit module/config isolation, are in the driver.
trivy image --input "$RUN/build-a/candidate.docker.tar" \
  --scanners vuln --pkg-types os,library --format json \
  --output "$RESULTS/vulnerabilities.json" --exit-code 0 \
  --offline-scan --skip-db-update --skip-java-db-update \
  --disable-telemetry --skip-version-check
```

The driver also generates `sbom.cdx.json` with CycloneDX output. [Trivy archive/CLI documentation](https://trivy.dev/docs/latest/guide/references/configuration/cli/trivy_image/).

`--exit-code 0` preserves findings without discarding the results package; it **does not mean zero vulnerabilities**. Scanner execution errors still stop the procedure. Every severity, including unfixed findings, is retained. A HIGH/CRITICAL count requires review; even zero findings is not deployment approval. Do not run npm audit fix, change the lockfile or update the base during this original-source run.

`provenance.json` records exact source/tree/recipe identity, lockfile/SRI receipt, base and image digests, tools, Windows/WSL/Linux metadata, command receipt hash, scanner binary checksum and database hashes/metadata. This is an **unsigned operator-generated build record**, not a SLSA or cloud attestation. A mutable DB tag is documented with observation time, actual DB hash and metadata; the DB remains local for potential follow-up.

## 8. Expected final output and results package

On normal completion the script prints:

```text
Original-source checks completed. Vulnerability/provenance approval and Claude PC-1 closure remain pending.
RUN_DIRECTORY=/tmp/nukmiris-readiness-windows-XXXXXXXX
```

PowerShell prints:

```text
RESULTS_FOLDER=C:\Users\...\Downloads\NukMiris-G1-...
RESULT_ZIP_SHA256=<actual SHA-256>
WSL_EXIT_CODE=0
```

The small results ZIP contains:

- summary/provenance, Windows/Linux/tool version receipts and every stage's command/exit/timestamp;
- source/reference integrity and14 lockfile SRI entries;
- both artifact/config/OCI manifests, npm install logs and explicit digest comparisons;
- raw smoke logs, own-layer scan findings, full vulnerability JSON and CycloneDX SBOM;
- the procedure/helper itself, and a SHA256SUMS.txt covering every report file except itself.

It excludes raw image/base/source-layer tar archives, node_modules/npm caches, the vulnerability DB binary, the Git database and all synthetic private-key fixture directories. Keep those public image/DB build inputs **locally** until review, but never add broad `/tmp` or home-directory contents to the review package. Reports are not silently trimmed to meet an arbitrary size limit.

The copied Windows results ZIP persists independently of WSL /tmp. Raw build archives and the database under /tmp may be cleared on restart; if you need to retain them for review, copy only the named public artifacts into a new local retention folder before shutting down WSL, for example:

```bash
# Set RUN to the exact RUN_DIRECTORY printed by your run.
RETENTION="$HOME/NukMiris-G1-Retention/$(basename -- "$RUN")"
mkdir -p -- "$RETENTION"
cp -- "$RUN/build-a/candidate.docker.tar" "$RUN/build-a/source-layer.tar" "$RUN/base.docker.tar" "$RETENTION/"
# Optional exact scanner inputs, when the scan reached this stage:
if test -f "$RUN/trivy-cache/db/trivy.db"; then
  cp -- "$RUN/trivy-cache/db/trivy.db" "$RUN/trivy-cache/db/metadata.json" "$RETENTION/"
fi
```

Do not copy entire /tmp, home, Docker config or TLS fixture directories. This retention is local only; it is excluded from the small review ZIP.

The launcher compares the copied ZIP's SHA-256 with the WSL original. You can repeat from **PowerShell**:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\path\to\the-results.zip'
Get-Content -LiteralPath 'C:\path\to\the-results.zip.sha256'
```

A reviewer can verify the inner package **without extraction**, in WSL/Python (replace only the results ZIP path):

```bash
python3 -I - '/path/to/the-results.zip' <<'PY'
import hashlib,pathlib,re,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    names=z.namelist()
    if len(names)!=len(set(names)):raise SystemExit('FAIL duplicate ZIP entries')
    if any(not n.startswith('results/') or '..' in pathlib.PurePosixPath(n).parts for n in names):raise SystemExit('FAIL unsafe ZIP path')
    rows=z.read('results/SHA256SUMS.txt').decode().splitlines();listed=set()
    for line in rows:
        digest,name=line.split('  ',1)
        if not re.fullmatch('[a-f0-9]{64}',digest):raise SystemExit('FAIL manifest digest')
        if hashlib.sha256(z.read('results/'+name)).hexdigest()!=digest:raise SystemExit('FAIL '+name)
        listed.add('results/'+name)
    if set(names)!=listed|{'results/SHA256SUMS.txt'}:raise SystemExit('FAIL unlisted report')
    print('PACKAGE CHECKSUMS PASS:',len(listed),'files')
    print(z.read('results/summary.json').decode())
PY
```

Hashes establish package integrity, not who physically performed the work. With the ZIP and its outer checksum, provide a short separate operator note: non-secret machine label, confirmation it is a different machine from Codex's, date/time, actual Desktop store setting, whether all commands were run unchanged, and any failures/extra attempts. The machine label in the report is self-reported. Do not claim independent acceptance before Claude reviews it.

## 9. Stop/failure handling

| Failure | Required handling |
|---|---|
| Missing tools, wrong UID/architecture, no Unix socket or wrong engine | STOP; local prerequisites/compatibility issue. No docker.exe/remote-daemon or root fallback. |
| Credentials/login requested; anonymous public access blocked | STOP. No token retrieval, sign-in, mirror/proxy bypass or cloud account access. |
| Exact commit/tree/source bytes or any digest mismatch | STOP before loading/running the mismatched image. Preserve actual/expected hashes, manifests and logs. Do not edit pins. |
| Builder assertion / base layer mismatch on Desktop | Record Docker version/store and the failure. Do not use Python -O, decompress/convert layers or change the builder. Any new environment attempt must be separately labelled; preserve this failure. |
| Private-key/unexpected-file finding | STOP before execution. Preserve filename/hash/redacted finding; do not print or distribute key bytes. |
| Smoke403, bind-mount permission, timeout or cleanup failure | Mark the smoke INCOMPLETE/FAIL and preserve diagnostics. Do not weaken TLS, allowlists or source controls to obtain PASS. |
| Scanner/DB/network/JSON/SBOM failure | Reproducibility may have passed, but vulnerability review is INCOMPLETE. Partial package is retained; no resource-specific proposal based on a missing scan. |
| Vulnerabilities found | Keep complete fixed/unfixed findings. Review/triage separately. Any remedy gets its own source/image identity and review. |
| Ctrl+C/crash | Preserve the printed RUN_DIRECTORY/results where available; no positive verdict. Accepted helper cleanup may have been interrupted. Never archive leftover TLS-key folders. |

The exit handler attempts to package partial results after any stage failure; the launcher still copies and hashes that package before reporting failure. A failure before Python or the run directory exists may have only the PowerShell console/prerequisite output. Preserve that instead of inventing a ZIP.

Do not use docker system prune, wildcard deletion, or stop unrelated containers. Successful accepted helpers remove their own test containers and fixture directories. If cleanup is interrupted, inspect only the exact test container IDs/names from this run and seek review before changing the harness. Keep failed and successful attempts separate.

Stop after the results package and operator note. G-1 second-host results and vulnerability/provenance findings go to Claude for PC-1 review. F-2 source hardening remains a separate authorized increment. G-2 remains measurement-and-safety only with no promotion; live custody map generation/account receipts and all other cloud/production gates remain open. No GitHub updates, registry push, cloud provisioning or paid-service activation are included.
