# B1a cloud-specific preparation — source and local synthetic tests only

2026-11-13. Stacked on corrected PR20 `2ca5cf215b68f187bfa48b42aaa041bbe93cf56d`.
Accepted app `b4d0be0cb98c7f2b69be318e18b93f4de102c511` remains untouched.
This is a standalone platform experiment, not the booking app's cloud upgrade.

Read [decisions/deltas](DECISIONS.md), [acceptance and gates](ACCEPTANCE.md),
[operational contract](OPERATIONS.md), [inventory](inventory.json),
[cost assumptions](COSTS.md), [sources](SOURCES.md) and
[Claude handoff](CLAUDE-HANDOFF.md). Exact tested source/tree, counts and complete
logs are published additively in [evidence](evidence/README.md).
Historical `../evidence/`, `../planning/` and ADR files are preserved byte-for-byte.
Their old coverage claims/fixtures are not the B1a implementation or cloud proof.

## Reproduce on disposable Linux

Node24.19.0, PostgreSQL17.11 pinned Docker image, local Unix Docker socket,
OpenSSL, Python3; no cloud credentials or real data. SIGSTOP tests require Linux
`/proc`. No native Windows or cloud behavior is claimed.

```sh
cd platform-proof
npm ci --ignore-scripts
npm run b1a:check
B1A_SOURCE_SHA="$(git rev-parse HEAD)" B1A_EVIDENCE_DIR="$PWD/.runs/b1a-full" npm test
B1A_SOURCE_SHA="$(git rev-parse HEAD)" B1A_EVIDENCE_DIR="$PWD/.runs/b1a-fault" npm run test:fault
B1A_SOURCE_SHA="$(git rev-parse HEAD)" B1A_EVIDENCE_DIR="$PWD/.runs/b1a-concurrency" npm run test:concurrency
node b1a/verify-evidence.mjs .runs/b1a-full
node scripts/verify-evidence.mjs .runs/b1a-full
npm run b1a:fence:dry-run
npm run b1a:teardown:dry-run
npm run b1a:spend-cap:print
npm run b1a:costs
```

Preload the exact image documented in `../README.md`. Evidence exports are
whitelisted synthetic ledgers/results/checkpoints only. Never upload the fixture
private directory or key/credential files. B8 diagnostics capture redacted state
and bounded PostgreSQL logs **before** owned-resource removal. Earlier INC1
fixture failure's original cause remains unconfirmed.

For Terraform1.17.2 / google8.11.0, **only** offline-source init/validate/fmt:

```sh
python3 b1a/generate-infra.py
terraform -chdir=b1a/terraform init -backend=false -input=false
terraform -chdir=b1a/terraform fmt -check
terraform -chdir=b1a/terraform validate
```

Registry/package downloads are tooling, not cloud API operations. No plan/apply/
destroy or billing/ADC lookup. Guard validation forbids `true` while every resource
requires it, so this candidate cannot apply. Do not remove it in this increment.

## What the source prepares

The gateway owns the COMMIT-confirmed one-use continuation; immutable original
attempt/operation/digest/epoch/revision bindings and UNKNOWN survive failure.
Both COMMIT-loss directions and a ROLLBACK completion tag are tested. Native SQL
TLS verifies CA **and DNS hostname**. New privileged pure profile builders prepare
private SQL and a single allocated fake IPv4/mTLS target; copied/serialized
capabilities cannot enable those endpoints. No untrusted request can supply a
provider target/SQL config or a `sourceVerified` assertion.

Full 9×3×2 campaign has 20 real instrumented stops per cell, plus 400
uninstrumented asynchronous stops with 130 direct kills. Instrumented cuts are
not arbitrary instructions; asynchronous delays may hit idle/complete work, and
neither finite campaign proves every instruction schedule. Both campaigns retain
SQL-only F13 counterexamples. Local process death is never Cloud Run death.

Signed independent-origin envelope/clock/retirement contracts fail closed.
Native mTLS fake-provider ledger binds a client certificate to epoch/revision;
old certs remain observable rather than silently revoked to mask stale effects.
Local signatures/ledger custody do not establish Google API provenance or
production chain/index extension. Source supports separate trust pins; actual
observer administration must be independently established.

Durable session SQL starts inert, expires within six hours and holds after any
billing pause/reset. Sealer must read exact committed batch and fsync independent
journal before eligibility; unavailable/cold/false-success/timeout cannot ACK.
These are **minimal platform fixtures**, not accepted application archive SQL.

## Deliberately non-deployable bootstrap

`Dockerfile` starts only `INERT_UNCONFIGURED` health endpoints; `/readyz` and work
return503. No image was built/pushed; its base digest and fake-host immutable OS/
image pin remain future review inputs. Wiring live workload-identity/OIDC,
secret mounts, actual SQL bootstrap identities, Google observation collectors,
GCS custody export and synthetic-role orchestration is an explicit **pre-execution
source review gate**. They cannot be inferred from Terraform validation or local
injected adapters. The pure prepared gateway profile is tested without opening
any non-loopback socket. No current artifact is advertised as deploy-and-run.

After independent source review, a separately authorized, resource-specific
preflight/experiment must resolve those adapters and measured platform contracts
before any dispatch promotion. Owner authorization to provision is still absent.
No commercial feature, application behavior or production gate is changed.
