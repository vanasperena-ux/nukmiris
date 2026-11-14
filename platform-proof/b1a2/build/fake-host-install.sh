#!/bin/sh
# Local/source installation only. No downloads, cloud CLI, account discovery or
# secret retrieval. Host disk and every key mount must be separately approved.
set -eu
[ "$#" = 4 ] || { echo 'usage: fake-host-install IMAGE_TAR IMAGE_ID MOUNT_DIR SESSION_EXPIRY_EPOCH' >&2; exit 64; }
archive=$1 image=$2 mountdir=$3 expiry=$4
case "$image" in sha256:????????????????????????????????????????????????????????????????) ;; *) exit 64;; esac
case "$mountdir" in /*) ;; *) exit 64;; esac
[ -f "$archive" ] && [ -f "$mountdir/manifest.json" ] || exit 65
[ "$(date +%s)" -lt "$expiry" ] || exit 66
# Explicit operator command is PRINTED, never executed by cloud preparation.
# No key is put in image, user-data or Terraform state. An installed host will
# run without a cloud exec-capable binary until reviewed activation.
printf '%s\n' "docker load --input '$archive'" "docker image inspect '$image'" \
 "docker run --read-only --cap-drop=ALL --security-opt=no-new-privileges --publish=443:8443 --mount=type=bind,src='$mountdir',dst=/secrets,readonly --mount=type=volume,src=b1a2-fake-ledger,dst=/ledger --env=B1A2_ROLE=fake --env=B1A2_MODE=MOUNTED_PREPARATION '$image'"
