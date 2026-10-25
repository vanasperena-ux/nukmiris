# NukMiris consistent appointment choices — v0.7.3

Version 0.7.3 corrects the v0.7.2 inconsistency between new available slots and existing-appointment choices for cancellation/rescheduling. Both now use the shared Spanish format, such as `mié 23 jun 11:00`, in the business timezone, including paginated lists and compact end-time descriptions. Calendar details, IDs, timestamps, ownership, immediate actions and full messages are retained. See [APPOINTMENT_LABELS.md](APPOINTMENT_LABELS.md) for findings and PC checks. **The combined v0.7.1–v0.7.3 checkpoint awaits PC verification; v0.7.0 remains the owner-verified baseline.**

Version 0.7.2 gives new Calendar events the title `{Full Name} — Cita` and a Spanish description with the registered customer name, international WhatsApp number, reserved status and WhatsApp origin. Service information is omitted until an actual catalog selection exists. Existing events are not upgraded; the unchanged rescheduling PATCH preserves their title/description. Empty rescheduling/cancellation results now say exactly `No encontré citas próximas. Si deseas agendar una nueva cita, escribe "cita".` The global menu command and immediate booking behavior remain in place. See [CALENDAR_DETAILS.md](CALENDAR_DETAILS.md) for files, wording review and combined PC checks. **v0.7.2 includes v0.7.1; both await PC verification. v0.7.0 remains the owner-verified baseline.**

Version 0.7.1 changes available slot titles from `vie 02/04 10:00` to `vie 2 abr 10:00`, using lowercase Spanish abbreviations, unpadded days and 24-hour time in the business timezone. Initial/alternative suggestions and date-first time buttons share this format for booking and rescheduling. Timestamps, IDs, other messages, Calendar data and webhook/booking logic remain unchanged. See [SLOT_LABELS.md](SLOT_LABELS.md) for scope and PC checks. **v0.7.1 PC verification is pending; v0.7.0 remains the owner-verified baseline.**

Version 0.7.0 removes repeated menu instructions from normal name/date/time and appointment-selection prompts. Helpful escape instructions use exactly `Escribe "menu" para volver al menú principal.` A global text-command handler returns to the main menu before current or legacy session handlers, clears transient selections and closes human support while preserving confirmed appointments and saved operations. The obsolete `booking_confirm` instruction is removed; selecting a time still initiates booking immediately, with name entry only for new customers. See [MENU_UX.md](MENU_UX.md) for the message comparison, code audit, limits and PC tests. **The owner confirmed successful v0.7.0 PC testing; it is the current verified working baseline.**

Version 0.6.0 accepts dates such as `13 oct`, `13/10`, `mañana`, `próximo lunes`, and `en dos semanas` inside the existing booking/rescheduling availability flow. It uses the business timezone, infers the next year when needed, and validates real dates against the existing booking horizon. As confirmed by the owner, `el día 13` means the next actual 13th. Invalid dates keep the conversation in place; valid dates show available times without a date-confirmation question. See [NATURAL_DATES.md](NATURAL_DATES.md) for rules, limitations and PC tests. **The owner manually tested v0.6.0 successfully; v0.7.0 retains its verified behavior.**

Version 0.5.0 recognizes natural Spanish booking, rescheduling, and cancellation requests through deterministic local rules. “Hola, quiero una cita”, “Necesito cambiar la hora”, and “Cancélame la cita por favor” enter the existing workflows. Conflicting requests ask which action to start; inability to attend uses the existing owned-appointment context before clarification. Names, date/time responses, pending results, and human chat keep their existing handlers. No AI calls, dependencies, feature flags, Calendar mutation changes, or extra booking confirmation are added. See [INTENT_RECOGNITION.md](INTENT_RECOGNITION.md) for phrases, state precedence, limitations, and PC update/testing steps. **The owner tested v0.5.0 successfully; v0.6.0 retains its verified behavior.**

The accepted calendar engine and two-plus-two choices remain in place. `Cita`, `Horarios`, and **Agendar una cita** offer two appointments, then **Más opciones** for two more, then **Elegir fecha** for a day and its times. Version 0.3.1 simplifies the Spanish copy, displays upcoming appointments in a recognized customer's menu, and makes the customer's explicit selection commit booking, rescheduling, or cancellation without an extra confirmation screen. New customers still supply their full name once.

Version 0.4.0 preserves that PC-verified UX and adds optional saved incoming messages/replies, recovery after a process restart, and automatic verified database backups. Calendar writes continue using their existing request journals and verification logic; delivering a saved reply does not create another Calendar request.

The v0.4.1 update extends availability discovery: check 30 calendar days, then 15 new days at a time until three available dates are found or the 365-day booking horizon is reached. Booking and rescheduling share these rules. The two-plus-two interaction stays in place, specific dates are checked directly, and each selected slot is checked again before the existing Calendar write. See [the implementation and PC update/test guide](DYNAMIC_AVAILABILITY.md). The owner completed that checkpoint successfully; v0.5.0 retains its verified behavior.

**Current combined PC checkpoint:** [v0.7.3 consistent choices](APPOINTMENT_LABELS.md), including [v0.7.2 Calendar details and empty results](CALENDAR_DETAILS.md) and [v0.7.1 slot labels](SLOT_LABELS.md). **Verified menu guidance:** [v0.7.0 guide](MENU_UX.md). **Verified natural dates:** [v0.6.0 guide](NATURAL_DATES.md). **Verified Spanish intent recognition:** [v0.5.0 guide](INTENT_RECOGNITION.md). **Verified dynamic availability:** [v0.4.1 guide](DYNAMIC_AVAILABILITY.md). **Verified reliability:** [v0.4.0 setup and restart tests](RELIABILITY_CHECKPOINT.md). **Verified UX:** [v0.3.1 guide](UX_CHECKPOINT.md). **Verified management setup:** [v0.3.0 guide](MANAGEMENT_CHECKPOINT.md). **First booking setup:** [v0.2.0 guide](BOOKING_CHECKPOINT.md). **Initial read-only setup:** [PC setup](PC_SETUP.md). **Project continuity:** [saved roadmap](../docs/ROADMAP.md).

Juanita's confirmed schedule is Monday–Friday, 10:00–19:00, 60-minute appointments starting on the hour, no buffer between appointments, and lunch 13:00–14:00. On an empty future weekday that gives 10:00, 11:00, 12:00, 14:00, 15:00, 16:00, 17:00, and 18:00. The final appointment ends at 19:00.

The template is [config/juanita.example.json](config/juanita.example.json). `business:configure` saves those settings and the explicit calendar/receiving-number mappings into the existing database after creating a local backup. The runtime reads the settings from SQLite, without hardcoded appointment hours or a fallback to `primary`. Other businesses retain their settings.

## Install and test

Use Node 24.19.0 and npm 11. From `backend/`:

```sh
npm ci --ignore-scripts
npm test
```

On the owner's Windows PC in PowerShell, use `npm.cmd` for these commands: `npm.cmd ci --ignore-scripts`, `npm.cmd test`, and `npm.cmd start`. All PC-specific guides use that form; see the [saved command preference](../docs/ROADMAP.md#windows-pc-command-preference).

Tests use real Express/Luxon/SQLite, signed loopback HTTP, disposable synthetic databases, and simulated Google/Meta responses. They skip `.env` loading and never read real credentials or a real business database. They cover busy events, adjacent appointments, closing/lunch boundaries, calendar selection, two-plus-two suggestions, date entry, daily times, navigation, business isolation, stale selections, signature rejection, and disabled writes in availability mode.

Booking tests additionally cover immediate selection-based actions, business/customer ownership, repeated selections, saved-request recovery, separate SQLite connections, persistence after reopening the database, overlapping requests, ambiguous Google responses, and failed reply delivery after an event was saved. Menu tests cover upcoming/past/cancelled appointments, chronological lists, local Spanish dates/times, business isolation, and human chat. OAuth tests cover loopback callbacks, state/PKCE, declined consent, and separation from the verified read-only cache.

Checkpoint validation: frozen installation completed and all 68 cloud tests passed, with no skipped tests. On 2026-10-24, the owner also confirmed successful real Windows PC installation/tests, Google and Meta checks, webhook delivery, and calendar busy-time filtering. This v0.1.0 availability flow is the verified baseline; see [BASELINE.md](BASELINE.md) for the recorded evidence.

The v0.2.0 checkpoint subsequently passed all 98 offline tests, with no skipped tests, and `npm audit --omit=dev` reported zero known vulnerabilities. On 2026-10-24 the owner also reported the real PC booking checkpoint tested successfully (“tested and all good”). This is the verified automatic-new-booking baseline. Cloud tests did not create real events; see [BASELINE.md](BASELINE.md) for the evidence and scope.

The v0.2.1 browsing update passed all 109 offline tests with no skipped tests, and the owner subsequently accepted the changes on 2026-10-24. The v0.3.0 management checkpoint retains those regressions and adds tests for ownership, confirmation, source edits, new conflicts, duplicate/concurrent actions, shared locks, persistence, and lost write/delivery responses. On 2026-10-24 the owner also confirmed that rescheduling and cancellation worked on the PC (“that worked, reagendar and cancelar worked well”). See [BASELINE.md](BASELINE.md) for scope and [MANAGEMENT_CHECKPOINT.md](MANAGEMENT_CHECKPOINT.md) for setup/retest instructions.

The complete v0.3.0 offline suite passed all **144 tests**, with no skipped tests. No dependencies changed and no live calendar events or WhatsApp messages were sent by these tests.

The v0.3.1 UX update passed all **159 offline tests**, with no skipped tests, and the owner subsequently reported the PC checkpoint successful (“OK I tested v0.3.1 all good thanks”). This includes the verified immediate booking/rescheduling/cancellation flow. Detailed live results for each failure/concurrency case were not supplied.

Reliability tests additionally cover committed ingress before acknowledgement, cross-restart deduplication, ordered replies, state/operation recovery, ambiguous Meta delivery, backups/restore, and forcibly terminated separate Node processes. All integrations in the cloud suite remain simulated.

The complete v0.4.0 suite passed all **188 tests**, with zero failures/skipped tests. It retains the 159 earlier regressions and adds 29 reliability/backup/process tests. The owner subsequently completed the requested PC restart, support, backup, and isolated restore checks; v0.4.0 is the verified reliability baseline. See [BASELINE.md](BASELINE.md) for evidence and scope.

The v0.4.1 dynamic update initially passed all **209 offline tests**, with zero failures/skipped tests. It retains the 188 regressions and adds 21 cases for dynamic ranges, distant dates, rescheduling, horizon/buffer/DST boundaries, and Calendar errors. The owner subsequently reported all checks in the PC testing guide successful. See [DYNAMIC_AVAILABILITY.md](DYNAMIC_AVAILABILITY.md) and [BASELINE.md](BASELINE.md) for evidence and scope.

Following the owner's booking-restart report, five additional process/diagnostic tests brought the complete local suite to **214 passing tests**. The supplied PC report validates saved-choice booking recovery: the later warning was generated by a separate stale main-menu action received about 51 seconds afterward, while the new booking remains confirmed. Saved rescheduling/cancellation choices also worked after restart. The owner's subsequent screenshot confirms verified manual backup creation and a successful isolated restore, leaving the live database untouched. The owner then reported **“Restart immediately after selecting: OK; Human chat: OK”**, completing the requested v0.4.0 PC checkpoint. See [the diagnostic findings](RESTART_INVESTIGATION.md); no runtime correction was needed for this trace.

The complete v0.5.0 suite passed **347 offline tests**, with no failures/skips, retaining the 214 earlier regressions and adding 133 intent/conversation/recovery cases. The verified v0.4.1 lifecycle services and flags remain unchanged. The owner subsequently reported **“I tested v.0.5.0 and all good!”** See [BASELINE.md](BASELINE.md) for the PC verification record and its scope.

## Runtime modes

The v0.7.3 suite passed **540 offline tests**, with zero failures/cancellations/skips: 536 regressions plus four cancellation/rescheduling label cases covering business timezones, year boundaries, pagination and preserved actions/state. Existing event details, ownership and lifecycle/recovery checks continue to pass. On 2026-10-25 (America/Mexico_City), the owner reported the new Google Calendar-entry check passed, with a screenshot confirming visible customer details. The remaining combined PC checks are pending; see [BASELINE.md](BASELINE.md) for scope and [APPOINTMENT_LABELS.md](APPOINTMENT_LABELS.md) for the guide.

The v0.7.2 suite passed **536 offline tests**, with zero failures/cancellations/skips, retaining 525 regressions and adding 11 event-detail/identity/rescheduling/HTTP cases. Existing crash recovery, ownership, cancellation and idempotency checks continue to pass. Combined v0.7.1/v0.7.2 PC verification is pending; use [CALENDAR_DETAILS.md](CALENDAR_DETAILS.md).

The v0.7.1 suite passed **525 offline tests**, with zero failures/cancellations/skips: 484 earlier regressions plus 41 formatter/view cases. Only available slot titles change; other messages and scheduling/integration/recovery behavior are retained. Owner PC verification is pending; use [SLOT_LABELS.md](SLOT_LABELS.md).

The v0.7.0 suite passed **484 offline tests**, with zero failures/cancellations/skips: 460 earlier regressions plus 24 navigation, state, failure, deduplication and process-restart cases. The menu/wording update leaves the existing calendar lifecycle and recovery services intact. On 2026-10-25 (America/Mexico_City), the owner confirmed that the latest v0.7.0 menu update tested OK. See [BASELINE.md](BASELINE.md) for the verification record and [MENU_UX.md](MENU_UX.md) for the guide.

The v0.6.0 suite passed **460 offline tests**, with no failures/skips: the 347 earlier regressions plus 113 date-parser/menu/conversation/restart cases. No dependencies, feature flags, database schema, Calendar services or event metadata changed. On 2026-10-25 (America/Mexico_City), the owner reported **“v.0.6.0 manually tested and all OK.”** See [BASELINE.md](BASELINE.md) for the verification record and [NATURAL_DATES.md](NATURAL_DATES.md) for the guide.

- `NUKMIRIS_MODE=availability`: verify the configured calendar at startup, then answer availability requests. Local Google authorization and database mappings are required.
- `NUKMIRIS_MODE=support`: support conversations and menus, with appointment actions paused and no Google connection.
- `NUKMIRIS_MODE=booking`: the same availability engine plus new-event creation when the customer selects a slot, and live upcoming appointment details in recognized customers' menus. Separate booking authorization and backed-up journal preparation are required. This is opt-in; `.env.example` still selects availability mode.

In booking mode, `NUKMIRIS_ENABLE_MANAGEMENT=true` additionally enables **Reagendar**, **Cancelar**, and the management menu after the `management:prepare` setup command. Selecting a new time commits the reschedule; selecting an appointment from the cancellation list commits cancellation. The flag defaults to false. Existing booking authorization covers both actions. Read-only/support modes never enable them. The legacy archived handlers remain disabled in every mode.

`NUKMIRIS_ENABLE_RELIABILITY=true` enables the saved inbox/outbox and automatic backups after `reliability:prepare`. It requires receiving-number routing and a single local worker for the database. Once enabled, keep it on while saved work remains. Unknown Meta send outcomes wait for a matching signed status or explicit operator review; they are not blindly resent. See the [PC guide](RELIABILITY_CHECKPOINT.md) for recovery and restore limits.

All modes verify Meta signatures. Receiving-number routing is the default: authenticated `metadata.phone_number_id` selects the business and outbound sender. `NUKMIRIS_ROUTING_MODE=development` retains the customer-number simulation for offline regression tests and deliberate legacy development; booking mode rejects it.

Availability discovery uses `NUKMIRIS_INITIAL_SEARCH_DAYS=30`, `NUKMIRIS_SEARCH_EXTENSION_DAYS=15`, and `NUKMIRIS_TARGET_AVAILABLE_DATES=3`. `NUKMIRIS_MAX_BOOKING_HORIZON_DAYS=365` is a separate upper bound, measured from the current business-local time; selected appointments and their buffers must fit inside it. The old `NUKMIRIS_LOOKAHEAD_DAYS` setting is retired and ignored by this runtime. Existing PC `.env` files can omit all four new settings to use the defaults; credentials, calendar IDs, and WhatsApp configuration do not need changes.

Start-time spacing, duration, buffer, hours, breaks, and weekdays remain independent business settings. A configured buffer is cleanup time after appointments and must fit before breaks and closing. Juanita's buffer is explicitly zero. Discovery runs only on demand; startup/connection checks perform one direct-day connectivity query rather than an expanding search.

## PC connections

The PC guide explains these commands and the required local settings:

```powershell
npm.cmd run google:connect
npm.cmd run calendars:list
npm.cmd run business:configure
npm.cmd run connections:check
npm.cmd start
```

Stop the old webhook before configuring its database. The configuration command backs up SQLite, adds missing mapping tables, and updates only the selected business. It refuses conflicting mappings and never changes Calendar events. There is no owner dashboard yet; the root website remains separate.

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for remaining gaps and [BASELINE.md](BASELINE.md) for provenance. Preserve the historical v5C.5 and v6A.4 archive; the booking-enabled rollback must not be used as a multi-business runtime.
