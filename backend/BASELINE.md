# Baseline provenance

Prepared on 2026-10-24 as the approved follow-up to the read-only audit.

## Source and limits

- Source archive: [`../docs/handoffs/NukMiris-Codex-Handoff-2026-10-24-redacted.zip`](../docs/handoffs/NukMiris-Codex-Handoff-2026-10-24-redacted.zip).
- Archive SHA-256: `cea734a709c1b0ae32cf607ae0f75bc1c548e9b2e7120ecd76461583aac14a14`.
- Selected source inside it: `NukMiris-Codex-Handoff-2026-10-24/src-reference/whatsapp-webhook-v6A4-business-routing-support-only.js`.
- The owner reports running v6A.4 on their PC. Exact agreement with their PC file, the real database state, and installed package versions remain unverified.
- The archive preserves the original redacted v6A.4 and the separate v5C.5 booking-enabled rollback. Neither historical snapshot has been overwritten. The original, unredacted uploaded ZIP is excluded from Git.

The root website is unchanged. No live database, credentials, migration execution, or calendar/WhatsApp connection is part of this baseline.

## Intentional runtime adaptations

`whatsapp-webhook.js` starts from the selected source, with these limited packaging changes:

1. Read local `.env` from `backend/`, skip it during tests, and use `WHATSAPP_VERIFY_TOKEN` instead of a hardcoded verification value.
2. Read `HOST`, `PORT`, and `NUKMIRIS_DB_PATH` from configuration. Bind to loopback by default and validate the port.
3. Check required configuration and existing database presence before opening SQLite; leave migrations and data initialization manual.
4. Start listening only when run as the main program. Export the application/start/close boundary so offline tests can exercise the real Express handler with a synthetic database.

The conversation logic, Spanish copy, development routing, appointment dispatch guards, unconditional Calendar throws, and postponed Calendar connection are preserved. Known audit gaps are not silently repaired or represented as verified production behavior; see [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

## Dependency reconstruction

The handoff contains imports but no `package.json` or lockfile. The exact direct dependency versions in this package were selected from the npm registry on 2026-10-24 and are locked, with transitive integrity hashes, in `package-lock.json`. This is a fresh reproducible dependency set, not proof of matching the owner's Windows installation. External API compatibility and real account authentication have not been tested.

Use Node 24.19.0 and npm 11.9.0, the versions used to validate this baseline. Node's built-in SQLite, crypto, path, and filesystem modules need no npm packages. No native app, dashboard, configurable availability engine, or production business onboarding is added by this checkpoint.

`@google-cloud/local-auth` currently brings in Gaxios 6.7.1 and its older UUID dependency. A scoped npm override pins that Gaxios dependency to CommonJS-compatible UUID 11.1.1 to address advisory GHSA-w5hq-g745-h8pq. The offline suite exercises Gaxios's multipart boundary generation through a simulated adapter to check the API it uses; live OAuth remains untested.

## Validation at this checkpoint

A frozen installation with `npm ci --ignore-scripts` completed, all 39 offline tests passed with no skipped tests, and `npm audit --omit=dev` reported zero known vulnerabilities. The tests exercised actual Express startup and requests with synthetic fixtures; they did not validate live WhatsApp delivery, Google authorization, or the PC's real database.
