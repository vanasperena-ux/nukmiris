#!/usr/bin/env bash
# Operator-run only. No cloud clients, registry pushes, logins or Git writes.
if [ "$(printenv G1_OPERATOR_SCRUBBED)" != "$$" ]; then
  exec env -i HOME="$HOME" PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin LANG=C.UTF-8 TZ=UTC G1_OPERATOR_SCRUBBED="$$" bash --noprofile --norc "$0" "$@"
fi
set -Eeuo pipefail
umask 077
KIT=$(cd -- "$(dirname -- "$0")" && pwd)
WINDOWS_RECEIPT=""
if [ "$#" -gt 0 ]; then WINDOWS_RECEIPT="$1"; fi
for tool in python3 git curl openssl tar xz timeout sha256sum docker; do
  command -v "$tool" >/dev/null || { printf 'Missing prerequisite: %s; stop before verification.\n' "$tool" >&2; exit 2; }
done
RUN=$(mktemp -d /tmp/nukmiris-readiness-windows-XXXXXXXX)
RESULTS="$RUN/results"
mkdir -m 700 -p "$RESULTS/logs" "$RUN/tools" "$RUN/downloads" "$RUN/npm-cache" "$RUN/xdg-config" "$RUN/xdg-cache" "$RUN/trivy-cache" "$RUN/trivy-modules"
cp "$KIT/operator_checks.py" "$KIT/verify-g1-wsl.sh" "$RESULTS/"
HELPER="$RUN/operator_checks.py"
cp "$KIT/operator_checks.py" "$HELPER"
if [ -n "$WINDOWS_RECEIPT" ]; then
  python3 -I - "$WINDOWS_RECEIPT" "$RESULTS/windows-host.json" <<'PY'
import json,pathlib,sys
p=pathlib.Path(sys.argv[1]);v=json.loads(p.read_text(encoding='utf-8-sig'));allowed=['windowsCaption','windowsVersion','windowsBuild','os64Bit','selectedDistro','wslVersion','dockerDesktopVersion','operatorMachineLabel']
pathlib.Path(sys.argv[2]).write_text(json.dumps({k:v.get(k) for k in allowed},indent=2)+'\n')
PY
fi
SOURCE=9b526c048d5df1b3fbcf03e8f33c3ba53979b492
EVIDENCE=d6dc74b6efa2c103a83f188465d8e426502822d7
BASE=node@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
STAGE=initialization
OWN_CFG1=0
OWN_CFG2=0
finish() {
  rc=$?
  trap - EXIT
  set +e
  python3 -I "$HELPER" package "$RUN" "$STAGE" "$rc" > "$RUN/package-receipt.json" 2>&1
  package_rc=$?
  cat "$RUN/package-receipt.json"
  if [ "$OWN_CFG1" = 1 ]; then rmdir /tmp/nukmiris-readiness-docker-config 2>/dev/null || true; fi
  if [ "$OWN_CFG2" = 1 ]; then rmdir /tmp/nukmiris-b1a2-docker-config 2>/dev/null || true; fi
  printf '\nRUN_DIRECTORY=%s\n' "$RUN"
  if [ "$package_rc" -ne 0 ]; then printf 'RESULT PACKAGE FAILED: preserve the entire results directory, not private fixture folders.\n' >&2; exit 3; fi
  if [ "$rc" -ne 0 ]; then printf 'STOPPED at %s; partial results retained. No fallback or source changes.\n' "$STAGE" >&2; fi
  exit "$rc"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
run_step() {
  label="$1"; shift
  STAGE="$label"
  started=$(date -u +%FT%TZ)
  seconds_start=$(date +%s)
  printf 'RUNNING %s\n' "$label"
  set +e
  "$@" > "$RESULTS/logs/$label.log" 2>&1
  code=$?
  set -e
  ended=$(date -u +%FT%TZ)
  elapsed=$(( $(date +%s) - seconds_start ))
  python3 -I "$HELPER" record "$RESULTS/commands.jsonl" "$label" "$started" "$ended" "$elapsed" "$code" "$@"
  if [ "$code" -ne 0 ]; then tail -n 50 "$RESULTS/logs/$label.log" >&2; return "$code"; fi
  printf 'COMPLETED %s\n' "$label"
}
# Credentials are not copied, listed or loaded. Git and package-manager config
# paths are explicit and empty. HOME retains its original value, unchanged.
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/bin/false
export XDG_CONFIG_HOME="$RUN/xdg-config" XDG_CACHE_HOME="$RUN/xdg-cache"
export npm_config_userconfig="$RUN/empty-user.npmrc" npm_config_globalconfig="$RUN/empty-global.npmrc"
: > "$npm_config_userconfig"
: > "$npm_config_globalconfig"
export DOCKER_CONFIG=/tmp/nukmiris-readiness-docker-config
export B1A2_SOURCE_SHA="$SOURCE"
run_step preflight python3 -I - "$RESULTS/preflight.json" <<'PY'
import json,os,pathlib,platform,sys
if sys.version_info<(3,12):raise RuntimeError('Python3.12+ required; reference used3.12.14')
if sys.flags.optimize!=0 or not __debug__:raise RuntimeError('Python optimization prohibited for accepted assert-based recipe')
if platform.machine()!='x86_64':raise RuntimeError('This recipe verification requires x86_64 / linux-amd64')
if os.getuid()!=1000:raise RuntimeError('Original packaged smoke expects a normal WSL primary user UID1000; do not use sudo/node or edit fixture permissions')
if not pathlib.Path('/var/run/docker.sock').is_socket():raise RuntimeError('Docker Desktop WSL2 Unix socket unavailable; Docker VMM/docker.exe fallback unsupported')
pathlib.Path(sys.argv[1]).write_text(json.dumps({'python':sys.version,'pythonOptimize':sys.flags.optimize,'kernel':platform.release(),'architecture':platform.machine(),'uid':os.getuid(),'clock':'UTC','sourceMode':'exact original accepted commit; no hardening edits'},indent=2)+'\n')
PY
for path in /tmp/nukmiris-readiness-docker-config /tmp/nukmiris-b1a2-docker-config; do
  if [ -e "$path" ]; then printf 'Pre-existing recipe config path: %s; do not read/delete/reuse it. Use a fresh verification distro.\n' "$path" >&2; exit 2; fi
done
mkdir -m 700 /tmp/nukmiris-readiness-docker-config
OWN_CFG1=1
mkdir -m 700 /tmp/nukmiris-b1a2-docker-config
OWN_CFG2=1
D=(docker --host=unix:///var/run/docker.sock --config /tmp/nukmiris-readiness-docker-config)
run_step docker-version "${D[@]}" version --format '{"clientVersion":{{json .Client.Version}},"serverVersion":{{json .Server.Version}},"serverOs":{{json .Server.Os}},"serverArch":{{json .Server.Arch}}}' 
run_step docker-info "${D[@]}" info --format '{"OSType":{{json .OSType}},"OperatingSystem":{{json .OperatingSystem}},"Architecture":{{json .Architecture}},"Driver":{{json .Driver}},"DriverStatus":{{json .DriverStatus}}}' 
run_step check-docker-desktop python3 -I - "$RESULTS/logs/docker-info.log" <<'PY'
import json,pathlib,sys
v=json.loads(pathlib.Path(sys.argv[1]).read_text())
if v.get('OSType')!='linux':raise RuntimeError('Linux containers required')
if 'docker desktop' not in v.get('OperatingSystem','').lower():raise RuntimeError('Expected Docker Desktop engine, not a second dockerd in WSL')
print(json.dumps({'operatingSystem':v.get('OperatingSystem'),'architecture':v.get('Architecture'),'driver':v.get('Driver'),'driverStatus':v.get('DriverStatus'),'classicStoreNote':'If accepted builder rejects compressed layers, record compatibility failure; do not modify the recipe'}))
PY
# Fetch public objects without Git credential helpers, tokens or SSH.
REPO="$RUN/repo"
run_step git-init git init "$REPO"
git -C "$REPO" config --local core.autocrlf false
run_step git-fetch timeout 300 git -C "$REPO" -c credential.helper= -c core.askPass= fetch --no-tags --depth=1 https://github.com/vanasperena-ux/nukmiris.git "$SOURCE" "$EVIDENCE"
run_step git-checkout git -C "$REPO" checkout --detach "$SOURCE"
run_step git-fsck git -C "$REPO" fsck --full
run_step source-integrity python3 -I "$HELPER" source "$REPO" "$RESULTS"
# Local portable Node; never replaces Windows Node or system Node.
DL="$RUN/downloads"
TOOLS="$RUN/tools"
CURL=(curl --disable --fail --show-error --silent --location --connect-timeout 20 --max-time 300 --proto =https --proto-redir =https)
run_step node-download "${CURL[@]}" https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz -o "$DL/node-v24.19.0-linux-x64.tar.xz"
run_step node-checksums-download "${CURL[@]}" https://nodejs.org/dist/v24.19.0/SHASUMS256.txt -o "$RESULTS/node-SHASUMS256.txt"
run_step node-checksum python3 -I "$HELPER" checksum "$DL/node-v24.19.0-linux-x64.tar.xz" node-v24.19.0-linux-x64.tar.xz "$RESULTS/node-SHASUMS256.txt"
mkdir "$TOOLS/node"
run_step node-extract tar -xJf "$DL/node-v24.19.0-linux-x64.tar.xz" -C "$TOOLS/node" --strip-components=1
export PATH="$TOOLS/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
run_step node-version node --version
# Bundled npm may differ. Pin the reference npm in this run's tools directory.
run_step npm-reference-install timeout 300 npm install --global --prefix "$TOOLS/npm" --ignore-scripts --no-audit --no-fund --cache "$RUN/tool-npm-cache" --registry https://registry.npmjs.org npm@11.9.0
export PATH="$TOOLS/npm/bin:$PATH"
run_step exact-toolchain python3 -I - <<'PY'
import json,subprocess
commands={'node':['node','--version'],'npm':['npm','--version'],'git':['git','--version'],'openssl':['openssl','version']}
v={k:subprocess.check_output(cmd,text=True).strip() for k,cmd in commands.items()}
if v['node']!='v24.19.0' or v['npm']!='11.9.0':raise RuntimeError('Reference Node/npm versions not active in WSL PATH')
print(json.dumps(v,indent=2))
PY
# Fresh cache and dependency tree; lockfile preserved, scripts disabled.
cd "$REPO/platform-proof"
run_step fresh-npm-ci timeout 300 npm ci --ignore-scripts --omit=dev --no-audit --no-fund --cache "$RUN/npm-cache" --registry https://registry.npmjs.org
run_step source-after-install python3 -I "$HELPER" source "$REPO" "$RESULTS"
run_step base-pull timeout 300 "${D[@]}" pull --platform linux/amd64 "$BASE"
run_step base-inspect "${D[@]}" image inspect "$BASE"
# Exact unchanged accepted recipe. -I ignores Python environment injection;
# no -O, no PYTHONOPTIMIZE, no edits to assert or the key regex.
run_step build-a timeout 300 python3 -I readiness/build-image.py --repo "$REPO" --source "$SOURCE" --cache "$RUN/npm-cache" --base-archive "$RUN/base.docker.tar" --out "$RUN/build-a"
run_step build-b timeout 300 python3 -I readiness/build-image.py --repo "$REPO" --source "$SOURCE" --cache "$RUN/npm-cache" --base-archive "$RUN/base.docker.tar" --out "$RUN/build-b"
run_step independent-digests python3 -I "$HELPER" build "$REPO" "$RUN/build-a" "$RUN/build-b" "$RESULTS"
IMAGE=sha256:1931766e764e9b400e3781796fa416421dda01fc992d69c4933295f29c30f888
run_step image-load timeout 180 "${D[@]}" load --input "$RUN/build-a/candidate.docker.tar"
run_step image-inspect "${D[@]}" image inspect "$IMAGE"
run_step bridge-address "${D[@]}" network inspect bridge --format '{{json .IPAM.Config}}'
# Existing accepted smoke helpers, unmodified; synthetic fixture keys only.
run_step inert-smoke timeout 150 node b1a2/build/container-smoke.mjs "$IMAGE"
run_step startup-smoke timeout 100 node readiness/image-smoke.mjs "$IMAGE"
run_step fake-smoke timeout 150 node readiness/package-fake-smoke.mjs "$IMAGE"
run_step inspect-smoke-verdicts python3 -I "$HELPER" smoke "$RESULTS/logs"
run_step source-after-smokes python3 -I "$HELPER" source "$REPO" "$RESULTS"
# Independent local scanner. No daemon socket or credential mounts; archive input.
cd "$RUN"
TRIVY_VERSION=0.76.2
run_step scanner-download "${CURL[@]}" https://github.com/aquasecurity/trivy/releases/download/v0.76.2/trivy_0.76.2_Linux-64bit.tar.gz -o "$DL/trivy_0.76.2_Linux-64bit.tar.gz"
run_step scanner-checksums-download "${CURL[@]}" https://github.com/aquasecurity/trivy/releases/download/v0.76.2/trivy_0.76.2_checksums.txt -o "$RESULTS/trivy-checksums.txt"
run_step scanner-checksum python3 -I "$HELPER" checksum "$DL/trivy_0.76.2_Linux-64bit.tar.gz" trivy_0.76.2_Linux-64bit.tar.gz "$RESULTS/trivy-checksums.txt"
mkdir "$TOOLS/trivy"
run_step scanner-extract tar -xzf "$DL/trivy_0.76.2_Linux-64bit.tar.gz" -C "$TOOLS/trivy" trivy
TRIVY="$TOOLS/trivy/trivy"
run_step scanner-version "$TRIVY" --version
# Explicit GHCR-only DB avoids Trivy's default Google mirror. If unavailable,
# stop; no login, alternative registry or bypass is attempted.
run_step scanner-db "$TRIVY" image --cache-dir "$RUN/trivy-cache" --config '' --module-dir "$RUN/trivy-modules" --db-repository ghcr.io/aquasecurity/trivy-db:2 --download-db-only --no-progress --disable-telemetry --skip-version-check --timeout 10m
SCAN=("$TRIVY" image --cache-dir "$RUN/trivy-cache" --config '' --module-dir "$RUN/trivy-modules" --input "$RUN/build-a/candidate.docker.tar" --db-repository ghcr.io/aquasecurity/trivy-db:2 --java-db-repository ghcr.io/aquasecurity/trivy-java-db:1 --skip-db-update --skip-java-db-update --skip-check-update --skip-vex-repo-update --skip-version-check --offline-scan --disable-telemetry --ignorefile '' --secret-config '' --no-progress --timeout 10m --exit-code 0 --scanners vuln --pkg-types os,library)
run_step vulnerability-scan "${SCAN[@]}" --format json --output "$RESULTS/vulnerabilities.json"
run_step sbom "${SCAN[@]}" --format cyclonedx --output "$RESULTS/sbom.cdx.json"
run_step validate-scan-json python3 -I - "$RESULTS" <<'PY'
import json,pathlib,sys
r=pathlib.Path(sys.argv[1]);v=json.loads((r/'vulnerabilities.json').read_text());b=json.loads((r/'sbom.cdx.json').read_text())
if not isinstance(v.get('Results'),list) or not v['Results']:raise RuntimeError('No valid package-scan results')
if b.get('bomFormat')!='CycloneDX' or not b.get('components'):raise RuntimeError('SBOM missing components')
print(json.dumps({'vulnerabilityReport':'GENERATED_NOT_APPROVED','sbom':'CycloneDX','findingsPreserved':True,'ignoreUnfixed':False,'scannerExit0DoesNotMeanNoVulnerabilities':True}))
PY
STAGE=complete
printf 'Original-source checks completed. Vulnerability/provenance approval and Claude PC-1 closure remain pending.\n'
