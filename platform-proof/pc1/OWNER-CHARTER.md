# NukMiris — PC-1 Security Hardening Increment

## Objective

Remediate the cloud-image security blockers identified in Claude's independent G-1 operator-results review of Draft PR #23.

Review:
https://github.com/vanasperena-ux/nukmiris/pull/23#issuecomment-6899142650

Repository: `vanasperena-ux/nukmiris`

Accepted G-1 source: `9b526c048d5df1b3fbcf03e8f33c3ba53979b492`

Current Draft PR #23 head at review: `564be22d57ec895208002925c9ac1a2f7abd4a8e`

The existing image `sha256:1931766e764e9b400e3781796fa416421dda01fc992d69c4933295f29c30f888` is permanently LOCAL-TEST-ONLY. Never push or deploy it.

**Authorization: source-only changes, local synthetic tests, and Draft PR publication. No cloud activation.**

## Required changes

### H1 — Updated Node.js and OS base

- Select an official, security-updated Node.js 24 LTS image, version 24.22.3 or newer as appropriate at build time.
- Pin its immutable digest and record provenance.
- Prefer a reduced runtime footprint, but evaluate compatibility with our deterministic build format, UID 1000, TLS certificates, mTLS tests and synthetic gateway.
- Record Node, OpenSSL and Debian versions.
- Ensure changes to TLS behavior do not weaken certificate or identity validation.

### H2 — Remove unused runtime tooling

- Remove npm, npx, Corepack and Yarn from the final runtime image.
- Evaluate an updated slim versus distroless image using actual vulnerability, runtime and reproducibility evidence.
- Avoid unnecessarily rewriting the existing image-building architecture.
- Verify the runtime operates without a package manager, shell wrapper or root privileges.
- Ensure there are no accidental additions of credentials, test certificates or application data.

### H3 — Repair F-2 build validation

- Replace all security-sensitive Python `assert` checks with explicit validation and exceptions.
- Reject optimized Python mode.
- Detect RSA, EC, OpenSSH, encrypted, DSA and other private-key header variants.
- Add tests proving invalid inputs fail, including when Python optimization is enabled.
- Preserve source and image provenance checks.

### H4 — Mandatory vulnerability gate

- Integrate a reproducible vulnerability scan and CycloneDX SBOM into the verification procedure.
- Explicitly verify the Node.js runtime security version; do not rely solely on Trivy.
- Block acceptance for any fixable Critical or High finding.
- Block acceptance for Critical or High findings affecting the application process or loaded runtime libraries.
- Require dated, individually justified exceptions for remaining non-fixable findings.
- Fail closed if scanner execution, database freshness, package attribution or scan integrity is insufficient.
- Preserve complete raw scan results, including unsuccessful security evaluations.

A vulnerability scan must not falsely report PASS merely because the scanner exited successfully.

### H5 — Provenance and operator procedure

Update the Windows/WSL2 operator kit to:

- Capture the Windows host receipt even when PowerShell script execution is restricted.
- Support the documented direct-WSL path without disabling Windows security settings.
- Record the selected Docker image-store configuration.
- Verify new immutable image digests.
- Perform two fresh image builds and synthetic smokes.
- Preserve the complete vulnerability report and SBOM.
- Provide a complete, checksummed results package for independent review.

Keep signing/attestation planning separate. Do not generate or publish signing credentials.

## Source boundaries

- Create a narrowly scoped PC-1 hardening branch and new Draft PR, stacked on the exact current PR #23 head after verifying it.
- Changes only within `platform-proof/`.
- Do not change accepted application behavior or business logic.
- Do not modify historical evidence, previous image hashes or review records.
- Do not merge any PR.
- Maintain `LIVE_CLOUD_EXECUTION = false` and the impossible infrastructure-apply guard.
- Do not access any Google Cloud account, credentials or live providers.
- Do not push images to registries or incur cloud charges.

## Verification

Run, where supported:

1. Full regression, fault and concurrency suites using the updated Node 24 security release and PostgreSQL 17.
2. All mTLS, certificate, identity, authorization and retirement tests.
3. Inert container startup and negative-state tests.
4. Synthetic provider/ledger/export/cleanup tests.
5. Python normal and optimized-mode security tests.
6. Fresh SBOM, vulnerability scan, version and provenance verification.
7. Repeated deterministic builds and exact new image digest comparisons.
8. Source-boundary and infrastructure-guard checks.

Tests that cannot run must be labeled NOT EXECUTED.

If the updated Node runtime breaks an existing test, investigate it without weakening TLS, identity, one-use permission or no-resend safeguards.

## Independent review handoff

Publish a self-contained handoff containing:

- New Draft PR URL and tested source/tree hashes.
- Selected base image and reasoning.
- New source-layer, image-config, OCI-manifest and archive hashes.
- Complete test results.
- SBOM and vulnerability counts by severity and runtime reachability.
- Fixable Critical/High counts.
- All remaining exceptions with justification and expiry.
- Build validation improvements.
- Updated Windows/WSL operator kit and checksum.
- Comparison against Claude's H1–H5 requirements.
- Remaining deployment prerequisites.

Request Claude's independent verdict on **PC-1 HARDENED SOURCE/IMAGE CANDIDATE ACCEPTANCE**.

A favorable source review does not close PC-1 until the owner's second-machine rebuild and subsequent security review also pass.

## Stop conditions

If the chosen base cannot meet security or reproducibility requirements, stop and document alternatives. Do not silently downgrade the security gate.

Stop after local implementation, tests, evidence publication and review handoff.

Report clearly that no provisioning, registry push, spending, merge, credentials or real-provider activity occurred.

**Begin this focused local PC-1 hardening increment.**