# Natural Spanish appointment dates — v0.6.0

Built on the owner-verified v0.5.0 baseline. **v0.6.0 is owner-verified; the current working baseline is [v0.7.0](MENU_UX.md), which retains this date behavior.** This update changes date understanding and date guidance in the existing availability menu shared by booking and rescheduling. It retains the two-plus-two choices, time buttons, Calendar services, feature flags, identity, and existing immediate-selection lifecycle.

On 2026-10-25 (America/Mexico_City), the owner reported **“v.0.6.0 manually tested and all OK.”** Delivered code reference: `3238e34c5b216ce6b942f61d27e9bb58fa952068`. This records the overall manual checkpoint; no separate PC commit hash or detailed per-case log was supplied. See [BASELINE.md](BASELINE.md) for scope. The automated results and technical limits below remain applicable.

## Supported input

| Input | Meaning |
| --- | --- |
| `13/10`, `13-10`, `13.10`, `13 10` | Next October 13, using LATAM day/month order |
| `13/10/2027`, `13-10-2027`, `13.10.2027`, `13 10 2027` | Explicit October 13, 2027; the year is respected |
| `13 octubre`, `13 oct`, `13 de octubre`, `13 de oct` | Next October 13 |
| `13 octubre 2027`, `13 de octubre de 2027` | Explicit year |
| `hoy`, `mañana`, `pasado mañana` | Today, tomorrow, or two local calendar days ahead |
| `lunes`, `el lunes`, `este viernes` | Nearest upcoming occurrence, including today when valid times remain |
| `próximo lunes`, `el próximo lunes`, `el viernes que viene` | Strictly future occurrence; if today has that weekday, use next week |
| `en 3 días`, `dentro de una semana`, `en dos semanas` | Local calendar-day/week offsets |
| `quiero el 13 de octubre`, `para el 13 oct`, `puede ser mañana`, `me gustaría el viernes`, `para pasado mañana` | Same dates with the supported conversational wording |
| `el día 13`, `13` | Next actual 13th, as explicitly chosen by the owner; advance to the next month if needed |

All twelve full Spanish month names and `ene`, `feb`, `mar`, `abr`, `may`, `jun`, `jul`, `ago`, `sep`, `sept`, `oct`, `nov`, `dic` are supported. September also accepts `setiembre`/`set`. Case, accents, whitespace, question marks, common WhatsApp emphasis and surrounding polite wording are normalized for comparison. Raw customer messages continue through the established storage/state handlers.

With no year, use the next real calendar occurrence of the day/month. A past date this year advances to the following valid year, subject to the booking horizon. February 29 finds its next real leap-year occurrence; it never overflows into March. An explicit invalid leap date is rejected. A day-only 31st skips months that have no 31st. Today remains today's date for explicit numerical/calendar-day requests; an empty day displays the existing no-times response.

Examples with a **fixed illustrative reference of October 24, 2026 in Mexico City**: `13 oct` → `2027-10-13`; `4 nov` → `2026-11-04`; `mañana` → `2026-10-25`; `pasado mañana` → `2026-10-26`; `el día 13` → `2026-11-13`. The runtime does not hardcode that reference date.

## Integration and safeguards

The existing `createAvailabilityMenu.handleText` previously accepted only `DD/MM/AAAA`. It now calls `lib/appointment-date.js` only after validating an active availability session. The same menu is already used for rescheduling. Interactive date rows continue to provide their existing ISO dates directly; time selection is unchanged.

`parseAppointmentDate(input, { now, timeZone, maxBookingHorizonDays })` returns a structured result:

```javascript
{ success: true, date: "2027-10-13", error: null }
// or
{ success: false, date: null, error: "INVALID" }
```

Errors are `INVALID`, `AMBIGUOUS`, `PAST`, or `OUT_OF_HORIZON`. The utility requires a valid business time zone and derives the default horizon from the existing shared search policy. The menu passes the actual business policy. Dates are validated against local today and the same rolling calendar-day horizon used by the existing availability service; the final horizon date may be partial. Existing duration/buffer checks still determine which slots fit.

A bare weekday that resolves to today includes a checked next-week fallback. The caller first queries today's real availability. Only when no valid time remains does it query that next weekday, within the horizon. A Google error aborts instead of being mistaken for an empty day. Explicit `hoy`, month/day inputs, and future weekdays do not silently jump to another date when fully booked.

Successful input goes directly through the existing direct-day availability lookup and displays that day's times, with the resolved date/year in the normal next-step message. It never creates or moves an event. The original slot selection, final availability check, shared locks/journals, event identity/metadata, ownership/ETag checks, and cancellation behavior remain in place.

The parser runs only in the existing appointment-date conversation state, including availability suggestions and date/time browsing where typed dates were already allowed. It does not run in human chat, name collection, cancellation appointment selection, idle messages, or intent recognition. A new request such as “Quiero una cita mañana” still enters the existing intent/booking workflow; date extraction from a new intent message is outside this change. Menu and exact legacy commands retain their control behavior.

## Customer messages

The date prompt is now:

> ¿Para qué día te gustaría tu cita? Puedes escribir, por ejemplo: 13 oct, 13/10 o próximo lunes.

Invalid or ambiguous input:

> No pude identificar bien la fecha. ¿Qué día te gustaría? Puedes escribir, por ejemplo: 13 oct, 13/10 o próximo lunes.

Past input:

> Esa fecha ya pasó. ¿Qué otro día te gustaría?

Out-of-horizon input uses the configured number of days:

> Por ahora solo podemos agendar citas dentro de los próximos 365 días. ¿Qué otra fecha te gustaría?

Invalid input leaves the current session, offered dates, and action IDs intact and makes no availability API call. The customer can correct the date immediately. There is no date-confirmation question. A genuinely ambiguous expression such as `lunes o martes`, `algún día`, or `la otra semana` asks for a clear date using the message above.

## Files changed

| File(s) | Purpose |
| --- | --- |
| `lib/appointment-date.js` (new) | Pure date normalization/parsing, timezone/year/leap/horizon validation and Spanish guidance |
| `lib/availability-menu.js` | Shared booking/rescheduling date input, friendly prompt, direct-day lookup and conditional weekday fallback |
| `test/appointment-date.test.cjs` (new) | Fixed-reference parser, calendar, timezone, ambiguity and boundary tests |
| `test/date-menu.test.cjs` (new) | Actual availability rules after closing, custom horizon, API errors and state preservation |
| Existing availability/booking/management HTTP tests | New date input, direct queries, isolated business timezones, no premature writes, and preserved names/states |
| Existing support/recovery tests | Date-like text stays in human chat; invalid input and selected times survive restart |
| `package.json`, `package-lock.json` | Version 0.6.0 and test inclusion; dependency versions unchanged |
| Root/backend READMEs, `BASELINE.md`, `KNOWN_LIMITATIONS.md`, `../docs/ROADMAP.md`, this guide | Behavior, owner clarification, verification status and PC tests |

## Automated validation and limits

Tests use fixed reference dates, synthetic business databases, stubbed Google/Meta services and actual subprocess restarts. The suite retains the verified intent, availability, booking, rescheduling, cancellation, signature, isolation, concurrency, backup and delivery regressions. The cloud agent does not use the owner's credentials, Calendar or WhatsApp account; live PC checks remain below.

**Result: all 460 offline tests passed, with zero failures or skipped tests.** This retains the 347 earlier regressions and adds 113 cases: 100 parser tests, four real-engine menu tests, eight signed HTTP conversation cases, and one process-restart case. Existing copy expectations were updated for the requested friendly messages, and availability HTTP tests now use a fixed clock. `git diff --check` passed. Windows/live-account checks cannot run from this cloud workspace.

This is a bounded deterministic parser using the existing Luxon dependency. It does not parse times, date ranges, two-digit years, arbitrary prose, or incomplete week-only preferences into a chosen day. Unknown wording receives clarification. Service durations, phone numbers, currency and time-only values such as `13:10` are rejected as dates. Numerical input is always day/month. A valid date can be closed or fully busy; the existing no-availability-for-that-day response still applies. No new AI/API dependency, flag, migration, settings interface, or booking system is introduced.

## Windows PC update

Stop Node with Ctrl+C. From PowerShell in the existing `backend/` folder:

```powershell
npm.cmd run backup:create
git pull --ff-only
node -p "require('./package.json').version"
npm.cmd test
npm.cmd run connections:check:management
npm.cmd start
```

The version must print **0.6.0**, and `npm.cmd test` must report **460 passed**, with no failures/skips. Keep existing credentials, database, feature flags, receiving number/calendar mappings and Cloudflare tunnel. No OAuth reconnection or migration/preparation is needed; dependencies are unchanged.

## Manual WhatsApp checks

Use Menu → Agendar to enter the existing availability flow, then type the date. Repeat date scenarios during Reagendar with a designated test appointment. A parsed date only shows times; choose a time when you intend the existing Calendar action.

| Check | Expected result |
| --- | --- |
| Compare `13/10`, `13-10`, `13.10`, `13 10`, `13 oct`, `13 octubre` | Same next October 13 and its real times; year shown in the next step |
| `13 de octubre de 2027` or another explicit in-range year/date | Respect that explicit year; never change it silently |
| `hoy`, `mañana`, `pasado mañana`, `en 3 días`, `dentro de una semana`, `en dos semanas` | Correct business-local dates; a closed day can validly have no times |
| `lunes`, `próximo lunes`, `este viernes`, `el viernes que viene` | Upcoming weekday rules; today is used only while valid slots remain for a bare weekday |
| `quiero el 13 de octubre`, `puede ser mañana`, `me gustaría el viernes` | Supported wording goes directly to availability |
| `el día 13` | Next upcoming 13th without a month or date confirmation question |
| `31 febrero`, `32 octubre`, `13/15`, `lunes o martes`, `la otra semana` | Friendly clarification; remain in the date flow and accept a corrected date |
| `ayer` or an explicitly past year/date | “Esa fecha ya pasó”; remain in the date flow |
| `en 366 días` with the existing 365-day horizon | Friendly horizon message; no Calendar availability query for the invalid date |
| `60 minutos`, a phone number, `13:10` | Ask for a date rather than interpreting the number as one |
| Select a time after a valid date, then repeat normal booking/rescheduling/cancellation checks | Original immediate-selection lifecycle and one event/change per action |
| In human chat or while a new customer's name is expected, use date-like text/name | Preserve the existing conversation/name handling |
| Enter an invalid date, restart Node, then correct it; restart again before selecting a shown time | Same flow resumes and the selected appointment is created once |

Separate business timezone/horizon and DST checks are automated with synthetic configurations; the working PC configuration does not need changes to exercise the parser. The owner's successful manual checkpoint is recorded above; these checks remain available for future regression testing.
