# NukMiris confirmed bookings and appointment management — v0.3.0

The accepted availability and new-booking flow remains in place. `Cita`, `Horarios`, and the appointment menu button offer two appointments, then **Más opciones** for two more, then **Elegir fecha** to choose a day and see its available times. Customers can also type a date as DD/MM/AAAA. New bookings require explicit confirmation. Version 0.3.0 adds optional customer-confirmed rescheduling and cancellation of owned future NukMiris appointments.

**Next PC checkpoint:** [enable and test rescheduling/cancellation](MANAGEMENT_CHECKPOINT.md). **Accepted appointment choices:** [menu guide](BOOKING_UX.md). **First booking setup:** [automatic-booking upgrade and test](BOOKING_CHECKPOINT.md). **Initial read-only setup:** [PC setup and connection checks](PC_SETUP.md).

Juanita's confirmed schedule is Monday–Friday, 10:00–19:00, 60-minute appointments starting on the hour, no buffer between appointments, and lunch 13:00–14:00. On an empty future weekday that gives 10:00, 11:00, 12:00, 14:00, 15:00, 16:00, 17:00, and 18:00. The final appointment ends at 19:00.

The template is [config/juanita.example.json](config/juanita.example.json). `business:configure` saves those settings and the explicit calendar/receiving-number mappings into the existing database after creating a local backup. The runtime reads the settings from SQLite, without hardcoded appointment hours or a fallback to `primary`. Other businesses retain their settings.

## Install and test

Use Node 24.19.0 and npm 11. From `backend/`:

```sh
npm ci --ignore-scripts
npm test
```

Tests use real Express/Luxon/SQLite, signed loopback HTTP, disposable synthetic databases, and simulated Google/Meta responses. They skip `.env` loading and never read real credentials or a real business database. They cover busy events, adjacent appointments, closing/lunch boundaries, calendar selection, two-plus-two suggestions, date entry, daily times, navigation, business isolation, stale selections, signature rejection, and disabled writes in availability mode.

Booking tests additionally cover explicit confirmation, business/customer ownership, duplicate confirmations, separate SQLite connections, persistence after reopening the database, overlapping requests, ambiguous Google responses, and a failed WhatsApp confirmation after the event was saved. OAuth tests cover loopback callbacks, state/PKCE, declined consent, and separation from the verified read-only cache.

Checkpoint validation: frozen installation completed and all 68 cloud tests passed, with no skipped tests. On 2026-10-24, the owner also confirmed successful real Windows PC installation/tests, Google and Meta checks, webhook delivery, and calendar busy-time filtering. This v0.1.0 availability flow is the verified baseline; see [BASELINE.md](BASELINE.md) for the recorded evidence.

The v0.2.0 checkpoint subsequently passed all 98 offline tests, with no skipped tests, and `npm audit --omit=dev` reported zero known vulnerabilities. On 2026-10-24 the owner also reported the real PC booking checkpoint tested successfully (“tested and all good”). This is the verified automatic-new-booking baseline. Cloud tests did not create real events; see [BASELINE.md](BASELINE.md) for the evidence and scope.

The v0.2.1 browsing update passed all 109 offline tests with no skipped tests, and the owner subsequently accepted the changes on 2026-10-24. The v0.3.0 management checkpoint retains those regressions and adds tests for ownership, confirmation, source edits, new conflicts, duplicate/concurrent actions, shared locks, persistence, and lost write/delivery responses. The new management actions still need a real PC check; [MANAGEMENT_CHECKPOINT.md](MANAGEMENT_CHECKPOINT.md) provides the steps.

The complete v0.3.0 offline suite passed all **144 tests**, with no skipped tests. No dependencies changed and no live calendar events or WhatsApp messages were sent by these tests.

## Runtime modes

- `NUKMIRIS_MODE=availability`: verify the configured calendar at startup, then answer availability requests. Local Google authorization and database mappings are required.
- `NUKMIRIS_MODE=support`: support conversations and menus, with appointment actions paused and no Google connection.
- `NUKMIRIS_MODE=booking`: the same availability engine plus explicit customer confirmation and new-event creation. Separate booking authorization and backed-up journal preparation are required. This is opt-in; `.env.example` still selects availability mode.

In booking mode, `NUKMIRIS_ENABLE_MANAGEMENT=true` additionally enables **Reagendar**, **Cancelar**, and the management menu after `npm run management:prepare`. It defaults to false. The existing booking authorization covers both actions. Read-only/support modes never enable them. The legacy archived handlers remain disabled in every mode.

All modes verify Meta signatures. Receiving-number routing is the default: authenticated `metadata.phone_number_id` selects the business and outbound sender. `NUKMIRIS_ROUTING_MODE=development` retains the customer-number simulation for offline regression tests and deliberate legacy development; booking mode rejects it.

The default search window is 14 days, configurable through `NUKMIRIS_LOOKAHEAD_DAYS` from 1 to 90. Start-time spacing, duration, buffer, hours, breaks, and weekdays are independent settings. A configured buffer is cleanup time after appointments and must fit before breaks and closing. Juanita's buffer is explicitly zero.

## PC connections

The PC guide explains these commands and the required local settings:

```sh
npm run google:connect
npm run calendars:list
npm run business:configure
npm run connections:check
npm start
```

Stop the old webhook before configuring its database. The configuration command backs up SQLite, adds missing mapping tables, and updates only the selected business. It refuses conflicting mappings and never changes Calendar events. There is no owner dashboard yet; the root website remains separate.

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for remaining gaps and [BASELINE.md](BASELINE.md) for provenance. Preserve the historical v5C.5 and v6A.4 archive; the booking-enabled rollback must not be used as a multi-business runtime.
