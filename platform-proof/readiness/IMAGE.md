# G-1 deterministic local candidate

The new candidate is a source successor of the accepted B1a-2 implementation; it includes final C-1/C-2 plus narrowly scoped H-3/readiness corrections. It is not the older historical image and does not claim to recover its missing raw archive chunks.

`build-image.py` exports exact committed Git roots `platform-proof/{src,b1a/runtime,b1a2/runtime,package.json,package-lock.json}`. It installs lockfile dependencies afresh using `npm ci --ignore-scripts --omit=dev --offline` in a private temporary context. No application/customer roots, test fixtures, evidence, credential mounts or ambient npm configuration enter the layer. Dependencies are lockfile/SRI resolved; scripts are disabled. Symlinks and key/database/ledger files are rejected. Every own-layer file is hashed and scanned for private-key/service-account markers. Runtime private keys are generated/mounted outside the image. The public base is separately immutable-pinned; this is not a forensic proof of every upstream binary's semantics.

Base: `node@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df`, linux/amd64. The local Docker daemon must already have it or the operator may pull that public Docker Hub digest under the local-build authorization, with an empty temporary Docker config. No GCP registry is accessed. PostgreSQL local fixture is separately pinned to 17.11; it is not baked into the candidate.

The builder verifies the base config identity and each uncompressed base layer's diff_id, then adds a canonical sorted USTAR layer (mtime 0, uid/gid 1000, fixed modes) and canonical JSON image config. Created/history timestamp is 1970-01-01, source label is the exact source commit. Default entrypoint is the inert B1a2 bootstrap, USER=node, health 200 / readiness 503 without mounts. It also records a canonical uncompressed OCI manifest. The local image ID equals the config digest. The Docker archive and own source layer are separately hashed.

## Reproduce locally

From repository root at the **tested source SHA in `evidence/publication.json`**, with Node24, Python3, Docker, OpenSSL and npm package cache:

```bash
cd platform-proof
npm ci --ignore-scripts --cache=/tmp/b1a-npm-cache
SOURCE=$(git rev-parse HEAD)
python3 readiness/build-image.py --repo .. --source "$SOURCE" \
  --cache /tmp/b1a-npm-cache --base-archive /tmp/nukmiris-readiness-base.tar \
  --out /tmp/nukmiris-readiness-build-a
python3 readiness/build-image.py --repo .. --source "$SOURCE" \
  --cache /tmp/b1a-npm-cache --base-archive /tmp/nukmiris-readiness-base.tar \
  --out /tmp/nukmiris-readiness-build-b
```

Populate the fresh npm cache once from public packages if needed; future recipe runs are offline. Compare `artifact.json` source/tree, all file hashes, layer digests, imageConfigId, canonicalUncompressedOciManifestDigest and dockerArchiveSha256 between the two independently exported/installed contexts. Shared base bytes are independently verified in both. This is two local reassemblies by the same environment/operator, not an independent human or second-host build.

```bash
docker --host=unix:///var/run/docker.sock --config /tmp/nukmiris-readiness-docker-config \
  load --input /tmp/nukmiris-readiness-build-a/candidate.docker.tar
# Use exact imageConfigId from artifact.json for IMAGE; never a mutable tag.
node b1a2/build/container-smoke.mjs "$IMAGE"
node readiness/image-smoke.mjs "$IMAGE"
node readiness/package-fake-smoke.mjs "$IMAGE"
```

Container checks cover missing/copied service identity, invalid epoch, expired identity/session, missing mounts and revoked SQL-readiness authorization. The packaged revocation check uses a clearly labeled local SQL readiness stub; the full suite independently exercises actual PostgreSQL revocation/COMMIT behavior. Packaged mTLS verifies synthetic effect count, unknown identity denial, source allowlist denial, durable ledger export/hash chain, nonroot execution and container/fixture cleanup. Runtime secrets exist only in disposable mounted local fixtures.

Only UTF-8 recipe/manifests/metadata/logs are published for the new candidate. Image/layer tar bytes remain local and are reproducible from published source, immutable public base and lockfile. No binary publication or alternative blocked-upload method is attempted. The old missing chunks remain an accurate historical limitation. A future registry push, resulting digest (which may differ due to compression/media type), digest-only deployment binding, vulnerability/provenance review and resource-specific owner approval are separate open gates. Reproduction alone does not authorize cloud use.
