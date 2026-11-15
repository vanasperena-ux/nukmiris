#!/usr/bin/env bash
# Public-source local proof only. No login, registry write or cloud invocation.
if [ "$(printenv PC1_OPERATOR_SCRUBBED)" != "$$" ]; then
  exec env -i HOME="$HOME" PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin LANG=C.UTF-8 TZ=UTC PC1_OPERATOR_SCRUBBED="$$" bash --noprofile --norc "$0" "$@"
fi
set -Eeuo pipefail
umask 077
KIT=$(cd -- "$(dirname -- "$0")" && pwd)
for tool in python3 git curl openssl tar xz timeout sha256sum docker; do
  command -v "$tool" >/dev/null || { printf 'Missing prerequisite: %s. Stop.\n' "$tool" >&2; exit 2; }
done
RUN=$(mktemp -d /tmp/nukmiris-pc1-windows-XXXXXXXX)
RESULTS="$RUN/results"
mkdir -m 700 -p "$RESULTS/logs" "$RUN/tools" "$RUN/downloads" "$RUN/npm-cache" "$RUN/trivy-cache" "$RUN/xdg-config"
cp "$KIT/operator_checks.py" "$RUN/operator_checks.py"
HELPER="$RUN/operator_checks.py"
STAGE=initialization
OWN_CFG1=0
OWN_CFG2=0
finish() {
  rc=$?
  trap - EXIT
  set +e
  python3 -I "$HELPER" package "$RUN" "$STAGE" "$rc"
  package_rc=$?
  if [ "$OWN_CFG1" = 1 ]; then rmdir /tmp/nukmiris-readiness-docker-config 2>/dev/null || true; fi
  if [ "$OWN_CFG2" = 1 ]; then rmdir /tmp/nukmiris-b1a2-docker-config 2>/dev/null || true; fi
  printf '\nRUN_DIRECTORY=%s\n' "$RUN"
  if [ "$package_rc" -ne 0 ]; then printf 'Packaging failed. Preserve results/ only; exclude TLS fixtures and caches.\n' >&2; exit 3; fi
  if [ "$rc" -ne 0 ]; then printf 'HOLD at %s. Preserve partial findings; no fallback or gate bypass.\n' "$STAGE" >&2; fi
  exit "$rc"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
run_step() {
  local label="$1"; shift
  STAGE="$label"
  local started ended code
  started=$(date -u +%FT%TZ)
  printf 'RUNNING %s\n' "$label"
  set +e
  "$@" > "$RESULTS/logs/$label.log" 2>&1
  code=$?
  set -e
  ended=$(date -u +%FT%TZ)
  python3 -I "$HELPER" record "$RESULTS/commands.jsonl" "$label" "$started" "$ended" "$code" "$@"
  if [ "$code" -ne 0 ]; then tail -n 40 "$RESULTS/logs/$label.log" >&2; return "$code"; fi
  printf 'COMPLETED %s\n' "$label"
}
if [ "$#" -ne 1 ]; then
  printf 'A Windows host receipt is mandatory, including direct WSL use. Paste Capture-Windows-Host.txt in ordinary Windows PowerShell first. No ExecutionPolicy change is needed.\n' >&2
  exit 2
fi
run_step windows-host python3 -I "$HELPER" host "$1" "$RESULTS/windows-host.json"
cp "$KIT/reference.json" "$RESULTS/reference.json"
PINS=$(python3 -I "$HELPER" pins "$KIT")
mapfile -t VALUES <<< "$PINS"
SOURCE="${VALUES[0]}"
IMAGE="${VALUES[1]}"
BASE="${VALUES[2]}"
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/bin/false
export XDG_CONFIG_HOME="$RUN/xdg-config" XDG_CACHE_HOME="$RUN/xdg-cache"
export npm_config_userconfig="$RUN/empty-user.npmrc" npm_config_globalconfig="$RUN/empty-global.npmrc"
: > "$npm_config_userconfig"
: > "$npm_config_globalconfig"
export B1A2_SOURCE_SHA="$SOURCE"
run_step preflight python3 -I - "$RESULTS/preflight.json" <<'PY'
import json,os,pathlib,platform,sys
if sys.version_info<(3,12) or sys.flags.optimize:raise RuntimeError('Unoptimized Python3.12+ required')
if platform.machine()!='x86_64' or os.getuid()!=1000:raise RuntimeError('x86_64 WSL primary UID1000 required; do not sudo or change fixture permissions')
if 'microsoft' not in platform.release().lower():raise RuntimeError('Owner second-machine procedure requires WSL2; Linux development evidence is separate')
if not pathlib.Path('/var/run/docker.sock').is_socket():raise RuntimeError('Enable Docker Desktop Linux-container integration for this WSL2 distro')
pathlib.Path(sys.argv[1]).write_text(json.dumps({'kernel':platform.release(),'machine':platform.machine(),'uid':os.getuid(),'python':sys.version,'scope':'OPERATOR_WSL2_LOCAL_SYNTHETIC'},indent=2)+'\n')
PY
for path in /tmp/nukmiris-readiness-docker-config /tmp/nukmiris-b1a2-docker-config; do
  if [ -e "$path" ]; then printf 'Pre-existing recipe config path %s: do not read, reuse or delete. Use a clean verification distro.\n' "$path" >&2; exit 2; fi
done
mkdir -m 700 /tmp/nukmiris-readiness-docker-config
OWN_CFG1=1
mkdir -m 700 /tmp/nukmiris-b1a2-docker-config
OWN_CFG2=1
export DOCKER_CONFIG=/tmp/nukmiris-readiness-docker-config
D=(docker --host=unix:///var/run/docker.sock --config /tmp/nukmiris-readiness-docker-config)
run_step docker-version "${D[@]}" version --format '{{json .}}'
run_step docker-info "${D[@]}" info --format '{"OSType":{{json .OSType}},"OperatingSystem":{{json .OperatingSystem}},"Architecture":{{json .Architecture}},"Driver":{{json .Driver}},"DriverStatus":{{json .DriverStatus}}}'
run_step docker-store python3 -I - "$RESULTS" <<'PY'
import json,pathlib,sys
r=pathlib.Path(sys.argv[1]);info=json.loads((r/'logs/docker-info.log').read_text());host=json.loads((r/'windows-host.json').read_text())
if info['OSType']!='linux' or 'docker desktop' not in info['OperatingSystem'].lower():raise RuntimeError('Expected Docker Desktop Linux engine')
observed='containerd' if 'io.containerd.snapshotter' in json.dumps(info['DriverStatus']) else 'classic'
if observed!=host['selectedDockerImageStore']:raise RuntimeError('Declared Docker store differs from observed store; preserve evidence and correct the receipt in a new run, never change settings automatically')
(r/'docker-store.json').write_text(json.dumps({'selected':host['selectedDockerImageStore'],'observed':observed,'details':info,'unsupportedArchiveHandling':'HOLD; no silent store toggle or recipe edit'},indent=2)+'\n')
PY
REPO="$RUN/repo"
run_step git-init git init "$REPO"
git -C "$REPO" config --local core.autocrlf false
run_step git-fetch timeout 300 git -C "$REPO" -c credential.helper= -c core.askPass= fetch --no-tags --depth=1 https://github.com/vanasperena-ux/nukmiris.git "$SOURCE"
run_step git-checkout git -C "$REPO" checkout --detach "$SOURCE"
run_step git-fsck git -C "$REPO" fsck --full
run_step source-integrity python3 -I "$HELPER" source "$REPO" "$KIT" "$RESULTS"
DL="$RUN/downloads"
CURL=(curl --disable --fail --show-error --silent --location --connect-timeout 20 --max-time 300 --proto =https --proto-redir =https)
run_step node-download "${CURL[@]}" https://nodejs.org/dist/v24.22.3/node-v24.22.3-linux-x64.tar.xz -o "$DL/node.tar.xz"
run_step node-checksums "${CURL[@]}" https://nodejs.org/dist/v24.22.3/SHASUMS256.txt -o "$RESULTS/node-SHASUMS256.txt"
run_step node-checksum python3 -I "$HELPER" checksum "$DL/node.tar.xz" node-v24.22.3-linux-x64.tar.xz "$RESULTS/node-SHASUMS256.txt" 4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb
mkdir "$RUN/tools/node"
run_step node-extract tar -xJf "$DL/node.tar.xz" -C "$RUN/tools/node" --strip-components=1
export PATH="$RUN/tools/node/bin:$PATH"
run_step exact-toolchain python3 -I - <<'PY'
import json,subprocess
v={k:subprocess.check_output(cmd,text=True).strip() for k,cmd in {'node':['node','--version'],'npm':['npm','--version'],'openssl':['openssl','version']}.items()}
if v['node']!='v24.22.3' or v['npm']!='11.19.1':raise RuntimeError('Pinned toolchain mismatch')
print(json.dumps(v))
PY
run_step scanner-download "${CURL[@]}" https://github.com/aquasecurity/trivy/releases/download/v0.76.2/trivy_0.76.2_Linux-64bit.tar.gz -o "$DL/trivy.tar.gz"
run_step scanner-checksums "${CURL[@]}" https://github.com/aquasecurity/trivy/releases/download/v0.76.2/trivy_0.76.2_checksums.txt -o "$RESULTS/trivy-checksums.txt"
run_step scanner-checksum python3 -I "$HELPER" checksum "$DL/trivy.tar.gz" trivy_0.76.2_Linux-64bit.tar.gz "$RESULTS/trivy-checksums.txt" bc0fc726e017b8927a62b2d3531d7a84ee01769daf5c99ed866dced54089fdbf
mkdir "$RUN/tools/trivy"
run_step scanner-extract tar -xzf "$DL/trivy.tar.gz" -C "$RUN/tools/trivy" trivy
TRIVY="$RUN/tools/trivy/trivy"
run_step scanner-db "$TRIVY" image --cache-dir "$RUN/trivy-cache" --config '' --db-repository ghcr.io/aquasecurity/trivy-db:2 --download-db-only --disable-telemetry --skip-version-check --no-progress --timeout 10m
cd "$REPO/platform-proof"
run_step fresh-npm-ci timeout 300 npm ci --ignore-scripts --omit=dev --no-audit --no-fund --cache "$RUN/npm-cache" --registry https://registry.npmjs.org
run_step python-security python3 -I pc1/test_security.py
run_step base-pull timeout 300 "${D[@]}" pull --platform linux/amd64 "$BASE"
run_step base-inspect "${D[@]}" image inspect "$BASE"
for label in a b; do
  run_step "build-$label" timeout 600 python3 -I readiness/build-image.py --repo "$REPO" --source "$SOURCE" --cache "$RUN/npm-cache" --base-archive "$RUN/base.docker.tar" --out "$RUN/build-$label" --trivy "$TRIVY" --trivy-cache "$RUN/trivy-cache"
done
run_step independent-digests python3 -I "$HELPER" build "$REPO" "$KIT" "$RUN"
run_step inert-smoke timeout 150 node b1a2/build/container-smoke.mjs "$IMAGE"
run_step startup-smoke timeout 100 node readiness/image-smoke.mjs "$IMAGE"
run_step fake-smoke timeout 150 node readiness/package-fake-smoke.mjs "$IMAGE"
run_step inspect-smoke-verdicts python3 -I "$HELPER" smoke "$REPO" "$RESULTS/logs"
run_step source-after-tests python3 -I "$HELPER" source "$REPO" "$KIT" "$RESULTS"
STAGE=complete
printf 'Local PC1 verification completed. Owner second-host/security acceptance remains pending review. No registry or cloud permission is implied.\n'
