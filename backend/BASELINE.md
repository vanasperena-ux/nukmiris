# Baseline provenance

## Calendar customer details and concise empty results — v0.7.2, awaiting PC verification

The owner requested two combined changes for v0.7.2 before testing the pending v0.7.1 labels on the PC. Newly inserted events now use `{Full Name} — Cita` and the description lines `Cliente`, `WhatsApp` in international format, `Estado: Reservada`, and `Origen: NukMiris WhatsApp`. The number is read from the existing business/customer-scoped identity after its customer-ID check. `Servicio` is omitted because no catalog selection exists. Event IDs, private ownership properties, authorization, journals/locks, availability checks and immediate booking remain unchanged. Existing events are not reformatted; the unmodified rescheduling PATCH retains display fields, including legacy descriptions.

Empty owned-appointments results for rescheduling/cancellation use exactly `No encontré citas próximas. Si deseas agendar una nueva cita, escribe "cita".` without `MENU_INSTRUCTION`. Two equivalent disabled legacy responses now share that text. The menu constant, global navigation, ownership checks and routing remain unchanged. No credentials, environment files, existing local database data, schema or live Calendar events were modified by the cloud agent.

All 536 offline tests passed, with zero failures/cancellations/skips: 525 prior regressions plus 11 booking-detail/identity/rescheduling/HTTP cases. Existing process-restart and foreign-appointment tests also verify the new fields and copy. See [CALENDAR_DETAILS.md](CALENDAR_DETAILS.md) for files, wording-review findings and the combined PC guide. Cloud integrations remain synthetic. v0.7.0 remains the last owner-verified baseline; v0.7.1/v0.7.2 await the owner's manual result.

## Spanish appointment-slot labels — v0.7.1, awaiting PC verification

After verifying v0.7.0, the owner requested the label format `vie 2 abr 10:00` for every available appointment-slot button. Version 0.7.1 adds a shared Spanish formatter in the business timezone and replaces only the two slot-title expressions in the existing availability menu. This covers initial/alternative suggestions and date-first time pages for booking and rescheduling. No leading day zero, uppercase name or 12-hour time is introduced; the formatter enforces WhatsApp's 20-character limit. Timestamps, IDs, other messages, existing appointment lists, webhook handling, Calendar data, booking/change logic and recovery remain unchanged.

All 525 offline tests passed, with zero failures/cancellations/skips, retaining the 484 earlier regressions and adding 41 formatter/view cases. Tests cover all months/weekdays, single/double-digit days, 24-hour time, timezone/year boundaries, all leap-year dates and unchanged selection/state data. See [SLOT_LABELS.md](SLOT_LABELS.md) for files and PC checks. Cloud integrations remain synthetic; v0.7.0 remains the owner-verified working baseline until the new PC results are reported.

## Verified simple menu instructions baseline — v0.7.0

After verifying v0.6.0, the owner requested concise menu instructions and an audit of global menu navigation and immediate booking. Version 0.7.0 removes routine repeated hints, centralizes the exact sentence `Escribe "menu" para volver al menú principal.`, and handles `menu` before all session-specific dispatch. This fixes a legacy-state guard that could intercept the command. Capitalization, accents and existing equivalent commands retain their established normalization.

Returning to the menu closes human support, replaces transient state and declines only unused request offers for the current business/customer. Confirmed appointments, pending/uncertain operations, request identity, locks and status recovery remain intact. No current flow created `booking_confirm`; its obsolete free-text confirmation instruction is replaced by safe stale-state recovery. Slot selection still initiates booking automatically, after name entry only for a new customer, and only verified success produces the appointment notification.

Validation: all 484 offline tests passed, with zero failures/cancellations/skips, retaining 460 earlier regressions and adding nine booking, nine management, three support/legacy-state, one read-only availability and two real process-restart tests. Cases verify capitalization, active/expired states, concise prompts, immediate booking, scoped offer invalidation, preserved confirmed appointments/uncertain requests/locks, Calendar failures, duplicate deliveries and recovery without repeated mutations. Scope, before/after messages, files, limits and PC instructions are in [MENU_UX.md](MENU_UX.md). Cloud integrations remain synthetic.

On 2026-10-25 (the owner's America/Mexico_City local date), the owner answered **“yes”** when asked whether **v0.7.0, the latest update with simpler menu instructions, also tested OK**. This confirms v0.7.0 as the current owner-verified working baseline, retaining the verified v0.6.0 dates and earlier intent, availability, lifecycle and reliability behavior. Delivered code reference: `e1c5370061ed268dffe8c17bd8f466182e544b1a`. No separate PC commit hash or detailed per-case run log was supplied. The report verifies the overall manual checkpoint; it does not independently establish each simulated API-failure, uncertain-delivery or exact crash-timing case. Existing technical limits remain applicable.

## Verified natural Spanish appointment dates baseline — v0.6.0

The owner supplied the flexible-date-input task for the next version after verifying v0.5.0. The shared availability menu previously parsed only `DD/MM/AAAA`; v0.6.0 adds a reusable deterministic date utility for numerical and Spanish month dates, relative days/weeks, and weekdays. Parsing runs only inside the existing appointment-date state for booking/rescheduling, preserving intent routing, name entry, human chat and cancellation. The owner clarified **“Use the next upcoming 13th”** for `el día 13`, so day-only inputs infer the next valid monthly occurrence without asking for a month.

The parser uses the business timezone and existing horizon policy; explicit past dates are rejected, missing years infer the next real occurrence, and invalid/ambiguous input preserves the current state. A bare weekday can use today's real remaining slots or its next-week fallback. Calendar integration, duration/overlap calculations, time selection, lifecycle confirmations, ownership, flags, event metadata, locks/journals and backup/recovery mechanisms remain in place. There is no new dependency, AI call, schema/configuration change, date-confirmation question or separate booking system. See [NATURAL_DATES.md](NATURAL_DATES.md).

Validation: all 460 offline tests passed, with zero failures/skips, retaining the 347 earlier regressions and adding 100 parser, four real-engine menu, eight signed HTTP and one process-restart tests. Fixtures cover calendar formats, all months, rollover/leap years, ambiguity, horizon limits, timezone/DST, protected names/chat, no premature mutations, state preservation and restart continuation. Cloud integrations remain synthetic; the cloud agent did not access live accounts or the PC.

On 2026-10-25 (the owner's America/Mexico_City local date), after receiving the v0.6.0 GitHub update and PC testing guide, the owner reported **“v.0.6.0 manually tested and all OK.”** This established v0.6.0 as an owner-verified baseline, retaining the verified v0.5.0 intent recognition and earlier availability, lifecycle and reliability behavior. Delivered code reference: `3238e34c5b216ce6b942f61d27e9bb58fa952068`. No separate PC commit hash or detailed per-case run log was supplied. This verifies the overall manual checkpoint; it does not provide separate live evidence for every simulated timezone/DST, API-failure or exact crash-timing case. Existing technical limits remain applicable.

## Verified Spanish intent recognition baseline — v0.5.0

The owner requested natural Spanish appointment intent recognition for v0.5.0, building on the verified v0.4.1 baseline. A centralized deterministic classifier normalizes comparison text, recognizes booking/rescheduling/cancellation expressions and LATAM terminology, handles negation and conflicts, and requests existing owned-appointment context only for attendance-dependent messages. The existing router/state storage supplies clarification buttons and protects names, date/time browsing, pending results, and human chat. See [INTENT_RECOGNITION.md](INTENT_RECOGNITION.md).

Calendar clients and mutation services, dynamic availability, identity/ownership checks, event formats/metadata, journals/locks, feature flags, and immediate-selection UX remain in place. No disabled operation is enabled. No LLM/service/dependency, schema change, natural-language date extraction, or new identity/booking confirmation is introduced. The only delivery change applies the existing prompt expiry to intent clarification buttons.

Cloud validation: all 347 offline tests passed, with zero failures/skips: the 214 earlier regressions plus 116 classifier cases, 14 signed HTTP conversation cases, and three clarification expiry/restart cases. Simulated integrations cover disabled modes, original message storage, protected names/dates, ambiguity, context failures, cross-business/customer and stale-action checks, and real subprocess restarts. The cloud agent did not access live accounts or the PC.

On 2026-10-24 (the owner's America/Mexico_City local date), after receiving the v0.5.0 GitHub update and PC testing guide, the owner reported **“I tested v.0.5.0 and all good!”** Treat v0.5.0 as the owner-verified working baseline, retaining the verified v0.4.1 availability and earlier lifecycle/reliability behavior. Delivered code reference: `b6a91692e83c6ba8a4a98522ccd38a3d91b3e328`. No separate PC commit hash or detailed per-case run log was supplied. This verifies the overall checkpoint rather than providing separate live evidence for every classifier, feature-disabled, transport-failure, or exact crash-timing case; existing limits remain applicable.

## Verified dynamic availability baseline — v0.4.1

On 2026-10-25, while starting PC testing of v0.4.0, the owner requested dynamic availability discovery. The owner clarified that the current two-plus-two suggestions and date picker must remain, and that booking and rescheduling must share the expanded search and 365-day limit. This checkpoint checks 30 calendar days, then non-overlapping 15-day extensions until three available dates are found or the horizon is reached. Specific-date requests and pre-write validation query the selected day directly, using the existing schedule engine and Calendar integrations.

Customer identification/registration, business relationships, explicit calendar mappings, Google/Meta authorization, event ownership metadata, write locks/journals, cancellation behavior, and v0.4.0 reliability/backup mechanisms are retained. No new dependencies, schema, credentials, or live account changes are involved. Scope, file list, validation, and manual tests are recorded in [DYNAMIC_AVAILABILITY.md](DYNAMIC_AVAILABILITY.md).

Cloud validation: all 214 offline tests passed, with zero failures/skipped tests, including the 188 v0.4.0 regressions, 21 dynamic-search/WhatsApp cases, and five follow-up restart/diagnostic cases. Long closures, direct distant dates, non-overlapping ranges, horizon/buffer/DST boundaries, Calendar failures, and both booking/rescheduling paths use synthetic integrations. The cloud agent did not access live accounts to repeat the owner's PC checks.

After receiving the v0.4.1 GitHub update and testing-guide instructions, the owner reported **“great I tested all as you proposed in the testing guide. all OK!”** Treat v0.4.1 as the owner-verified dynamic availability baseline, preserving the verified v0.4.0 reliability and earlier booking/rescheduling/cancellation UX. Delivered code reference: `8649109692fcaf32f3e8d536d9d5b404294c690a`. No separate PC commit hash or detailed per-case log was supplied. The report confirms the manual guide as a whole, including its long-range availability checks; it does not add independent live evidence for every simulated API-failure or DST test. Existing technical limits remain applicable.

The supplied task originally prohibited automatically committing or pushing this update. After completing the requested v0.4.0 PC checks, the owner explicitly authorized the same GitHub delivery process used for v0.3.1 → v0.4.0, overriding that restriction for v0.4.1. The owner subsequently verified the PC checkpoint as recorded above. Preserve the usual GitHub update workflow and `npm.cmd` PowerShell preference. The previous verified v0.4.0 baseline remains at `9d6358b`.

## Verified reliability/restart recovery checkpoint — v0.4.0

After verifying v0.3.1, the owner explicitly authorized the reliability/restart-recovery checkpoint. Version 0.4.0 adds an opt-in durable inbox/outbox, persisted operation continuations, saved local conversation checkpoints, signed Meta receipt handling, one local worker owner, automatic verified SQLite backups, and isolated restore commands. Setup and PC checks are in [RELIABILITY_CHECKPOINT.md](RELIABILITY_CHECKPOINT.md).

On 2026-10-25, the owner reported that rescheduling and cancellation survived restarting before selecting the saved choice. New booking also created the event and sent success, followed by an expired-option warning within 15 minutes. The subsequently supplied read-only diagnostic identifies the 7:33 PM test: inbox 4 created confirmed Booking 1; inbox 5, received 50.861 seconds later, targeted a different stale main-menu booking button and generated the warning. Both replies have Meta read statuses and each handler ran once. The saved-choice booking restart test succeeded; the later action's tap/delivery origin is not established. Matching processed inbox/outbox records confirm persisted delivery for the test. See [the investigation record](RESTART_INVESTIGATION.md).

The owner subsequently supplied a v0.4.0 PowerShell screenshot showing `backup:create` created a verified backup and `backup:restore-test` verified an isolated restore, with integrity, foreign keys, and row counts matching. The tool reported that the live database was not replaced and no app worker, Google calls, or WhatsApp sends were started. Treat manual backup/isolated restore as PC-verified. This does not establish automatic 24-hour scheduling/retention or replacing a live database.

The owner then reported **“Restart immediately after selecting: OK; Human chat: OK”** in response to the remaining calendar-operation interruption and support restart checks. Treat the requested v0.4.0 PC reliability checkpoint as owner-verified. Delivered reference: `9d6358b`; the reported package version and diagnostic were 0.4.0, without a separate PC commit hash. This confirms the overall manual checkpoint, not every exact crash timing or transport-failure case covered offline. Preserve the existing recovery/transport limits; no direct PC access or new live-account actions by the cloud agent are implied.

The verified v0.3.1 conversation flow, calendar availability engine, business/customer isolation, authorization, schedule, mutation algorithms, and request locks remain in place. Reliability preparation is additive and backed up; startup requires explicit preparation and `NUKMIRIS_ENABLE_RELIABILITY=true`. The cloud agent's tests used synthetic services; the PC screenshot, redacted diagnostic, and final success report are owner-supplied evidence.

Validation: all 188 offline tests passed, with zero failures/skipped tests. The 159 prior regressions remain covered; 29 added tests exercise ingress persistence, deduplication, ordered delivery, atomic checkpoints, unknown send outcomes, scoped recovery, backup/restore, and separate Node processes forcibly killed at recovery checkpoints. Disabling reliability cannot bypass unresolved saved work. The core availability, Calendar authorization, booking/change services, settings, and their regression tests are unchanged from the verified code baseline.

## Verified WhatsApp UX baseline — v0.3.1

The owner requested eight targeted UX changes before the planned reliability checkpoint: menu/copy changes, upcoming appointments in the menu, selection-based booking/rescheduling/cancellation, and consistent Spanish success messages. The current behavior is documented in [UX_CHECKPOINT.md](UX_CHECKPOINT.md); [the roadmap](../docs/ROADMAP.md) preserves reliability/restart recovery as the next planned work.

This request replaces the extra confirmation screens in the verified v0.3.0 UX. The existing availability engine, search window, routing, customer registration, business ownership checks, Google authorization, calendar mutation services, locks, and request journals remain in use. The existing future appointment lookup is reused for menus, including when the management feature is off in connected booking mode. No dependencies or database schema changes were introduced in that checkpoint.

The owner subsequently reported **“OK I tested v0.3.1 all good thanks”** and authorized v0.4.0. Treat v0.3.1 as the verified UX baseline. Delivered code reference: `7530df0`; the subsequent documentation-only `7e5cbbf` records use of `npm.cmd` on Windows. No separate PC commit hash or detailed run log was supplied. This verifies the overall checkpoint, not separate live evidence for every automated failure/concurrency case.

Validation: all 159 offline tests passed with no skipped tests. The original schedule, booking-service, and management-service regression tests remain unchanged; the HTTP conversation tests now cover the requested direct-selection UX, messages, menu details, failures, replay, and human handoff.

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
