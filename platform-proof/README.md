# INC1 — local-only gateway safety proof

Owner-authorized isolated engineering experiment, 2026-11-11 America/Mexico_City.
Google Cloud remains preferred. **No cloud deployment or real-provider safety is
proved or authorized.** Accepted NukMiris is unchanged; this is not an app upgrade.

Read [decisions](DECISIONS.md), [architecture and limits](ARCHITECTURE.md),
[acceptance map](ACCEPTANCE.md), [planning inventory](planning/inventory.json),
[plan-only Terraform](planning/terraform), [additive costs](planning/cost-results.json)
and [independent Claude handoff](CLAUDE-HANDOFF.md).

## Run locally (Linux)

Use Node24, Docker with a local Unix socket, OpenSSL and Python3. The SIGSTOP suite
requires Linux `/proc` and actual process signals; it deliberately does not skip
on unsupported hosts. Native Windows execution is not claimed. Use a disposable
Linux environment/VM for this proof; do not point it at the booking profile.

```
cd platform-proof
npm ci --ignore-scripts
npm run check
INC1_EVIDENCE_DIR="$PWD/.runs/full" npm test
npm run test:concurrency
npm run test:fault
node scripts/verify-evidence.mjs .runs/full
npm run fence:dry-run
npm run teardown:dry-run
npm run probe:print
npm run costs
```

The pinned PG image must already exist locally. To fetch public tooling only:
`docker --host=unix:///var/run/docker.sock pull postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`.
The harness clears inherited Docker endpoint selectors and uses that local socket,
creates a unique `inc1-*` container and `inc1_<hex>` database, binds SQL to loopback,
sets UTC/fsync/synchronous_commit, generates disposable TLS keys and service-auth
material, then removes only its own named container. Evidence contains synthetic
IDs, timestamps and hashes, never keys/passwords. Temporary key directories are
removed after each fixture; do not upload a test's private temporary directory.

A normal full run includes exactly1,000 seeded randomized real stop/continue
schedules plus20 independently awakened dead-man canaries, real TCP/TLS/SQL,
actual lost-COMMIT-response injection and intentionally unsafe counterexamples.
Tests use an independent provider process and a sibling delayed-waker process.
The gateway is paused at authority, COMMIT, TCP, TLS, partial/full write and deadline
boundaries. `test:fault` repeats the campaign; suite counts overlap, not additive.

Every case records result, durable state, provider invocation/effect counts and
fence-evidence classification. An SQL epoch bump is **NOT_PROVEN** as a physical
fence. No response is UNKNOWN, including provider acceptance followed by response
loss. A failed local test must not be renamed a platform pass.

[Published evidence](evidence/README.md) identifies exact tested source and native
Terraform validation. No Terraform plan/apply, Cloud SQL probe execution, live
billing/account lookup, real WhatsApp/Calendar traffic, profile change or merge.
Stop here for independent review; the next increment needs separate authorization.
