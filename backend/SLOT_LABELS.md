# Spanish appointment-slot labels — v0.7.1

Built on the owner-verified v0.7.0 baseline (`e1c5370`). **v0.7.1 awaits PC verification.** This update changes only the labels on available appointment-slot buttons.

| Before | After |
| --- | --- |
| `vie 02/04 10:00` | `vie 2 abr 10:00` |
| `mié 30/09 18:00` | `mié 30 sept 18:00` |
| `10:00` after choosing a date | `vie 2 abr 10:00` for that date |

Every slot button uses Spanish lowercase abbreviated weekdays/months, an unpadded day and 24-hour `HH:mm`. Weekdays are `lun`, `mar`, `mié`, `jue`, `vie`, `sáb`, `dom`; months are `ene`, `feb`, `mar`, `abr`, `may`, `jun`, `jul`, `ago`, `sept`, `oct`, `nov`, `dic`. September uses the existing Luxon Spanish abbreviation `sept`.

The label is derived from the full slot start in the business's configured timezone. Initial suggestions, **Más opciones**, time choices after selecting/typing a date, and **Más horarios** use the same formatter for booking and rescheduling. The two-plus-two interaction is retained.

The longest label in the leap-year date sweep is 17 characters; the formatter also rejects output longer than WhatsApp's 20-character button limit. Labels are never truncated. Full timestamps and action IDs stay in their original fields. Existing appointment-selection labels for cancellation/rescheduling, date-list rows, navigation buttons, message bodies and success notifications keep their existing wording. The webhook, availability engine, Calendar data, booking/change services, journals and recovery are untouched.

## Files and validation

- `lib/slot-label.js`: shared label formatter using the existing Luxon dependency.
- `lib/availability-menu.js`: replace only the two slot-title expressions, shared by booking/rescheduling.
- `test/slot-label.test.cjs`: 41 new cases for every month, all weekdays, single/double-digit days, 24-hour time, business-local date/year boundaries, invalid inputs, all 366 leap-year dates, and every slot view with preserved timestamps, IDs, message bodies and selection callbacks.
- Existing `test/availability-webhook.test.cjs`, `test/date-menu.test.cjs`, `test/management-webhook.test.cjs`: updated title expectations and stronger checks for alternatives, date-first choices, per-business timezones and unchanged existing-appointment labels.
- `package.json`, `package-lock.json`: version 0.7.1 and inclusion of the formatter tests; dependencies unchanged.
- Root/backend READMEs, `BASELINE.md`, `KNOWN_LIMITATIONS.md`, `../docs/ROADMAP.md`, this guide: release scope, status and PC checks.

All **525 offline tests passed**, with zero failures/cancellations/skips: the 484 earlier regressions plus 41 formatter/view cases. The 109 focused formatter/menu/HTTP checks also passed. Cloud tests use synthetic data and simulated integrations; the cloud agent did not access live accounts or the owner's PC. Existing technical limits remain applicable.

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

The version should print **0.7.1**, and `npm.cmd test` should report **525 passed**, with no failures/skips. No dependency installation, database migration or reconnection is required.

## Manual WhatsApp checks

1. Send `cita`. Check the first suggestions and **Más opciones**: each slot should show the new weekday/day/month/time format, such as `vie 2 abr 10:00` for Friday April 2, 2027.
2. Choose or type a date, then use **Más horarios**. The slot buttons should retain that format on every page; surrounding messages and navigation should be familiar.
3. Enter `reagendar` for a designated test appointment and inspect its available times and alternatives. Existing appointment lists keep their prior labels; the offered new slots use the new format.
4. If completing a test booking/change, check that the chosen date/time matches Google Calendar and that the normal success message and single-operation behavior are retained.

Month, weekday, midnight, year-boundary and timezone cases are automated with fixed dates; changing your PC clock or business settings is unnecessary. Record the owner's results before marking v0.7.1 verified.
