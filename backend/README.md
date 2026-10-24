# NukMiris calendar availability — v0.1.0

This checkpoint connects the PC backend to a specifically selected Google Calendar and signed Meta WhatsApp webhooks. `Cita`, `Horarios`, and the appointment menu button show all matching times within a configurable search window, with paging for later results. It does not create, reschedule, or cancel Calendar events yet.

**Start here:** [PC setup and connection checks](PC_SETUP.md).

Juanita's confirmed schedule is Monday–Friday, 10:00–19:00, 60-minute appointments starting on the hour, no buffer between appointments, and lunch 13:00–14:00. On an empty future weekday that gives 10:00, 11:00, 12:00, 14:00, 15:00, 16:00, 17:00, and 18:00. The final appointment ends at 19:00.

The template is [config/juanita.example.json](config/juanita.example.json). `business:configure` saves those settings and the explicit calendar/receiving-number mappings into the existing database after creating a local backup. The runtime reads the settings from SQLite, without hardcoded appointment hours or a fallback to `primary`. Other businesses retain their settings.

## Install and test

Use Node 24.19.0 and npm 11. From `backend/`:

```sh
npm ci --ignore-scripts
npm test
```

Tests use real Express/Luxon/SQLite, signed loopback HTTP, disposable synthetic databases, and simulated Google/Meta responses. They skip `.env` loading and never read real credentials or a real business database. They cover busy events, adjacent appointments, closing/lunch boundaries, calendar selection, paging, business isolation, stale selections, signature rejection, and disabled event changes.

Checkpoint validation: frozen installation completed and all 68 tests passed, with no skipped tests. Real Google authorization, Meta access, and callback delivery remain to be verified on the PC.

## Runtime modes

- `NUKMIRIS_MODE=availability`: verify the configured calendar at startup, then answer availability requests. Local Google authorization and database mappings are required.
- `NUKMIRIS_MODE=support`: support conversations and menus, with appointment actions paused and no Google connection.

Both modes verify Meta signatures. Receiving-number routing is the default: authenticated `metadata.phone_number_id` selects the business and outbound sender. `NUKMIRIS_ROUTING_MODE=development` retains the customer-number simulation for offline regression tests and deliberate legacy development; do not use it for real business routing.

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
