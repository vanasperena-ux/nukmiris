# Dynamic availability — v0.4.1 checkpoint

Prepared on 2026-10-25 against the now owner-verified v0.4.0 baseline (`9d6358b`). The original task prohibited automatically committing or pushing; the owner subsequently authorized the same GitHub update process used for v0.3.1 → v0.4.0. That later instruction authorizes committing/pushing v0.4.1 for the next PC testing round. **v0.4.1 still needs its own PC verification.**

## Customer behavior

The owner's clarifications take precedence over the uploaded example: keep **two appointment choices → Más opciones → two more → Elegir fecha**, and apply the same expanded availability rules to **booking and rescheduling**.

Customers can now find appointments months ahead without choosing a search range. The date picker shows the earliest three available dates, with **Más fechas** and **Fechas anteriores** for navigation. Selecting a date retrieves its times afresh. Customers can still type **DD/MM/AAAA** directly, including a date beyond the first suggestions. Selecting a time immediately attempts the booking or reschedule; there is no extra confirmation screen. New customers still provide their name once.

If a selected time becomes busy, NukMiris briefly explains in Spanish and presents refreshed choices. When the full permitted horizon has no availability, it says:

> No encontré horarios disponibles por ahora. Puedes llamar al negocio para consultar más opciones.

A failed Calendar lookup remains an error, never an empty-availability claim. An out-of-range typed date receives the existing friendly Spanish date guidance and the permitted date range without querying Google.

## Search algorithm and boundaries

1. Read the current time and existing schedule in the business's configured time zone.
2. Query one range from now to local midnight 30 calendar days from today's date. This includes the remaining hours today. Include any configured buffer before the first query's start so a preceding busy event can still block a candidate.
3. Pass the busy periods to the existing slot engine. Weekdays, opening/closing hours, lunch, duration, spacing, and buffers continue to determine valid slots.
4. If fewer than three distinct available dates were found, query the next 15 calendar days. Each extension starts exactly where the prior range ended. Retain busy periods within this search to preserve buffers across boundaries without rereading a period.
5. Stop after finding three available dates or reaching the booking horizon. Return all valid times on the earliest three dates, or the smaller set if fewer dates exist.

The default booking horizon ends at **the current business-local time plus 365 calendar days**. The final date can therefore be partial. Start times must be in the future, and appointment duration plus any buffer must fit before the cutoff. Queries and slots never extend past it. Local date arithmetic preserves month/year and daylight-saving boundaries; ranges have inclusive starts and exclusive ends.

Specific-date queries bypass discovery and inspect only the requested day, clipped to now and the horizon, plus the required preceding buffer. Final booking/rescheduling validation also uses a direct-day query. It runs before the existing Calendar write under the existing write protection; the first three suggestions do not limit which in-range date can be booked.

Booking discovery uses the existing exact-calendar FreeBusy integration. Rescheduling uses the existing paginated event lookup, excluding the owned source appointment and its original time. Both use the same search orchestrator and schedule engine. Readiness/startup checks query one day only. No periodic scan, new cache, infrastructure, schema, or dependency is introduced. The existing temporary session snapshots still support navigation; selected times are rechecked before writes.

Each availability API request has a 15-second timeout and no automatic retry. A fully booked default year takes at most 24 range batches; rescheduling may require multiple event pages in each batch. Any failing batch aborts the search, including when one or two dates were already found.

## Configuration and preserved safeguards

The existing `.env` pattern supplies a single policy through `lib/availability-search.js`:

| Setting | Default | Purpose |
| --- | --- | --- |
| `NUKMIRIS_INITIAL_SEARCH_DAYS` | `30` | First discovery range |
| `NUKMIRIS_SEARCH_EXTENSION_DAYS` | `15` | Additional days per batch |
| `NUKMIRIS_TARGET_AVAILABLE_DATES` | `3` | Available dates to return |
| `NUKMIRIS_MAX_BOOKING_HORIZON_DAYS` | `365` | Maximum future booking boundary |

The old `NUKMIRIS_LOOKAHEAD_DAYS` runtime setting is retired and ignored. Existing PC `.env` files can omit the four new settings and receive the defaults. No credentials, token files, calendar IDs, phone mappings, WhatsApp settings, or Juanita schedule values need changes. The service configuration accepts a future per-business policy override; no settings interface or new persistence has been built. Legacy explicitly injected `lookaheadDays` bounds remain supported for existing service callers/tests, outside runtime environment configuration.

Customer recognition/registration, business/customer relationships, ownership metadata, Google authorization, receiving-number routing, shared calendar locks, write journals, event identity, ETags, and cancellation behavior remain in place. The immediate-selection UX and v0.4.0 persisted delivery/recovery/backup mechanisms are retained. Google still offers no atomic check-and-write operation against simultaneous manual edits; the existing limitation documented in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) remains.

## Changed files

All paths below are relative to the repository root.

| File | Change |
| --- | --- |
| `backend/lib/availability-search.js` (new) | Shared policy, date/horizon bounds, expanding non-overlapping batches |
| `backend/lib/availability.js` | Let the existing engine evaluate bounded subranges within the horizon |
| `backend/lib/google-calendar.js` | Batched exact-calendar discovery, direct-day requests, bounded readiness check |
| `backend/lib/appointment-management.js` | Same dynamic search for rescheduling; direct-day selection and final checks |
| `backend/lib/booking.js` | Direct-day availability revalidation before insertion |
| `backend/lib/availability-menu.js` | Preserve two-plus-two choices; three-date pages, direct date lookup, refreshed alternatives |
| `backend/lib/management-menu.js` | Forward date queries and refresh rejected rescheduling choices |
| `backend/whatsapp-webhook.js` | Wire shared policy, direct-day checks, and refreshed booking alternatives |
| `backend/.env.example` | Document new policy defaults and retire the old lookahead setting |
| `backend/package.json`, `backend/package-lock.json` | Version 0.4.1; include the new tests; dependencies unchanged |
| `backend/test/dynamic-availability.test.cjs` (new) | Range, horizon, buffer, DST, error, and distant-booking/rescheduling tests |
| `backend/test/availability-webhook.test.cjs` | Wider date range, direct-date lookup, navigation, empty-year and API-error messages |
| `backend/test/booking-webhook.test.cjs` | Updated alternatives after rejected bookings |
| `backend/test/management-webhook.test.cjs` | Updated alternatives after rejected rescheduling |
| `README.md`, `backend/README.md` | Current behavior, GitHub delivery, configuration and guide links |
| `backend/BASELINE.md`, `backend/KNOWN_LIMITATIONS.md` | Verification status and bounded-search limits |
| `docs/ROADMAP.md` | Owner's clarifications, verified v0.4.0 status, and later GitHub delivery authorization |
| `backend/DYNAMIC_AVAILABILITY.md` (new) | This implementation and testing record |
| `backend/scripts/inspect-restart.cjs` (new), `backend/test/restart-inspection.test.cjs` (new) | Read-only v0.4.0 restart report and privacy/read-only tests |
| `backend/test/recovery-webhook.test.cjs` | Two additional restart/stale-menu reproduction cases |
| `backend/RELIABILITY_CHECKPOINT.md`, `backend/RESTART_INVESTIGATION.md` (new) | Owner-verified v0.4.0 checkpoint and diagnostic findings |

## Automated validation

Run the complete existing framework from `backend/`:

```powershell
npm.cmd test
```

The cloud uses the Linux equivalent, `npm test`, on Node 24.19.0. Tests use disposable synthetic databases, simulated Google/Meta APIs, signed loopback webhooks, and real restart/recovery subprocesses. They do not access the owner's PC, credentials, calendars, or WhatsApp account.

**Result: all 209 tests passed, with zero failures or skipped tests.** This retains the 188 v0.4.0 regressions and adds 21 cases: 19 dynamic-search/service tests and two additional signed WhatsApp tests. The existing conversation expectations were also updated for the wider horizon and refreshed alternatives. `git diff --check` passed.

The subsequent [v0.4.0 booking-restart investigation](RESTART_INVESTIGATION.md) added two reproduction tests and three read-only diagnostic tests. The current complete suite passes **214 tests**, with no failures/skips. Those follow-up files and PC findings are documented separately; the dynamic behavior above is unchanged.

The expanded suite covers:

- Three dates in the initial range, with no extension; businesses fully booked for 30, 45, 60, and 180 days.
- Only two available dates within a year; a completely full year and its call-the-business message.
- Direct dates six months ahead; polite rejection beyond the horizon; the final partial day.
- Non-overlapping batches, cross-boundary buffers, month/year changes, and 23/25-hour DST days.
- Calendar failures/timeouts in initial and extension batches, including failures after partial results.
- Distant new bookings and rescheduling, all-day closures, fresh checks, unchanged event identity, and updated alternatives after conflicts.
- Existing customer isolation, signature checks, booking, cancellation, ownership/ETag checks, duplicate/concurrent requests, persisted delivery, crash recovery, backups, and restore tests.

Live Google/Meta integration and Windows PC tests cannot run in this cloud workspace. They remain manual checks below. No tests were skipped to stand in for those integrations.

## Update the Windows PC from GitHub

The requested [v0.4.0 reliability checks](RELIABILITY_CHECKPOINT.md) are now owner-verified. The owner authorized the normal GitHub delivery process for v0.4.1. No new OAuth connection, feature preparation, dependency, or database migration is required beyond the existing v0.4.0 setup.

Stop Node with Ctrl+C. From PowerShell in the existing `NukMiris-next/backend` folder:

```powershell
npm.cmd run backup:create
git pull --ff-only
node -p "require('./package.json').version"
npm.cmd test
npm.cmd run connections:check:management
npm.cmd start
```

The version command must print **0.4.1** and the tests must report **214 passed**, with no failures/skips. There are no dependency upgrades; the existing installed packages can remain. Keep the existing `.env`, `.local`, database, credentials/token files, feature flags, and tunnel setup. Start Node from this existing folder and use the existing Cloudflare tunnel.

## WhatsApp checks

Keep the existing Cloudflare tunnel/Meta webhook setup and local credentials. Use a disposable test calendar/database for the long closure scenarios so the verified business calendar remains usable. Label and remove any temporary busy events after testing.

| Manual check | Expected result |
| --- | --- |
| Send `Menu`, then `Cita` | Same first two choices, **Más opciones** for two more, then **Elegir fecha** |
| Open the date picker, navigate forward/back, and choose a day | Earliest available dates stay chronological; that day's real times are shown |
| Type a working-day date about six months ahead | That day's availability appears even when earlier dates are free |
| Type a date more than 365 days ahead | Friendly Spanish guidance; no booking attempt |
| In the isolated test calendar, mark the next 30, then 60, then 180 days busy | `Cita` finds the first available dates after each closure automatically |
| Leave only two test dates free in the year, then make the whole year busy | Those two dates remain reachable; the full year produces the call-the-business message |
| After receiving choices, add a busy event at one offered time, then select it | No overlapping app booking; a short explanation and updated choices |
| Book a distant date as an existing customer and as a new customer | Existing customer is recognized; new customer supplies the name once; one event is created only after selection |
| Send `Reagendar`, choose/type a distant date, and select a time | Same dynamic rules; one owned appointment moves and retains its identity |
| Send `Cancelar` and select the test appointment | Existing immediate cancellation behavior still works |
| With reliability enabled, repeat the existing restart test during a selected operation | Recovery resumes the saved operation without duplicate Calendar events |

Google outages are covered by the simulated failure tests. Do not alter real credentials just to manufacture an outage. Record the PC results before declaring this update verified.
