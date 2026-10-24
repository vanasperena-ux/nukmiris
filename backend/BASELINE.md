# Baseline provenance

## Verified rescheduling/cancellation baseline — v0.3.0

After accepting v0.2.1, the owner requested the next rescheduling/cancellation checkpoint. Version 0.3.0 adds a separate opt-in service for customer-owned future NukMiris appointments, explicit confirmations, ETag-protected updates/deletion, a backed-up change journal, and recovery reads. See [MANAGEMENT_CHECKPOINT.md](MANAGEMENT_CHECKPOINT.md).

The accepted availability engine, Google authorization, schedule/configuration, and two-plus-two browsing module remain unchanged. The booking service adds guards against late recovery responses overwriting completed state or releasing a subsequent change's calendar lock. The new feature shares that lock with new bookings.

On 2026-10-24, after receiving the PC upgrade/test instructions, the owner reported: **“that worked, reagendar and cancelar worked well.”** Treat v0.3.0 as the owner-verified rescheduling/cancellation baseline, alongside the accepted availability, browsing, and new-booking checkpoints. Delivered reference: `100a7a4`. No separate PC commit hash or detailed run log was supplied. This report verifies the overall management checkpoint; it does not supply separate live evidence for each concurrency, crash-recovery, or authorization case. The cloud agent did not access the PC or repeat these actions against live accounts.

Validation: all 144 offline tests passed, with zero failures/skipped tests. This includes the accepted availability/new-booking regressions, signed management flows, backup/preparation checks, ETag conflicts, duplicate/concurrent writes, persistence, and late recovery results.

## Accepted appointment browsing baseline — v0.2.1

The owner requested shorter appointment choices after verifying v0.2.0. Version 0.2.1 shows two appointments, then two more, then date selection and that day's times. Customers may also type a date as DD/MM/AAAA. See [BOOKING_UX.md](BOOKING_UX.md) for the flow and PC update steps.

All 109 offline tests passed with no skipped tests. The availability engine, Google Calendar client, booking service, signature verification, business configuration, and Juanita schedule remain unchanged from the verified code baseline. Presentation tests now cover the new menu, direct date entry, fresh calendar checks, empty dates, navigation, stale actions, and both date-first booking paths.

On 2026-10-24, the owner subsequently reported **“Ok all good, the changes are accepted.”** Delivered reference: `df816ef`. Treat the v0.2.1 browsing changes as accepted. No separate PC commit hash or detailed run log was supplied. The verified v0.2.0 and v0.1.0 checkpoints below remain the detailed integration references; no real events or messages were sent by the cloud agent.

## Verified automatic-booking baseline — v0.2.0

On 2026-10-24, after receiving the v0.2.0 upgrade and real-PC booking test instructions, the owner reported: **“tested and all good.”** Treat v0.2.0 as the owner-verified automatic-new-booking baseline, alongside the preserved v0.1.0 availability baseline.

Delivered repository reference: `345cc5a634b3f32ce078225b57ed8c25c43f931c`. No separate PC commit hash or detailed run log was supplied. The report confirms the overall PC checkpoint; it does not provide separate live evidence for every concurrency, crash-recovery, or authorization test case.

The cloud checkpoint separately passed 98 automated tests against synthetic data/simulated integrations, with zero known vulnerabilities reported by the dependency audit. The cloud agent did not access the PC or create live appointments to repeat the owner's test.

Selected business and calendar remain `juanita-nails` and **Juanita's Nailsalon – Juanita**, using the stored explicit calendar ID. Preserve the confirmed-booking flow and availability regressions. Rescheduling and cancellation remain disabled; this verification does not activate another feature.

## Verified availability baseline — v0.1.0

On 2026-10-24, the owner reported successful real Windows PC integration testing of backend v0.1.0. This is the verified availability baseline for the automatic-booking checkpoint. Preserve its existing availability flow rather than replacing it.

Repository reference: `d44c96376e1b808010aeac885934dde40aec7b04` (`main` when this verification was recorded). The owner identified the tested version as v0.1.0; no separate PC commit hash was supplied.

Owner-verified results:

- Node 24/dependencies installed and all local automated tests passed.
- `business:configure` completed successfully.
- Meta WhatsApp and Google Calendar connection checks both returned OK.
- Cloudflare tunnel and Meta webhook verification succeeded.
- WhatsApp `Menu`, then `Cita`, returned real calendar availability.
- A temporary 10:00–11:00 busy event removed 10:00 while leaving 11:00 available, confirming zero buffer between appointments.
- The temporary test event was subsequently deleted.

Selected business: `juanita-nails`. Selected Google Calendar display name: **Juanita's Nailsalon – Juanita**. The runtime must continue using the stored explicit calendar ID; this display name is documentation, not a replacement ID or a fallback to `primary`.

The evidence above is the owner's PC verification. No live account credentials, database, or event data were accessed by the cloud agent to repeat those checks. Automatic creation, rescheduling, and cancellation remain disabled in this baseline. Any new booking mode must be additive and retain the verified availability behavior and regression tests.

## Historical support-only baseline

The v0.2.0 automatic-booking checkpoint is additive and opt-in; see [BOOKING_CHECKPOINT.md](BOOKING_CHECKPOINT.md). Availability mode retains the verified engine, schedule, mappings, and separate read-only authorization. Availability and automatic-booking PC verification are recorded separately above.

Prepared on 2026-10-24 as the approved follow-up to the read-only audit.

This document records the original support-only baseline at commit `54cb8d3e876a38524ce7fc7b772f8d20f0c1bf6f`. The subsequent v0.1.0 availability checkpoint adds the calendar service, signed receiving-number routing, business configuration, and PC connection commands described in [README.md](README.md). The historical adaptation/validation notes below describe that original baseline.

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
