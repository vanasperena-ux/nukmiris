# Automatic new bookings — v0.2.0 PC checkpoint

The owner verified v0.1.0 availability on Windows on 2026-10-24. The v0.2.0 checkpoint preserved that mode and added optional **new appointment creation after customer confirmation**. Rescheduling and cancellation were disabled in that checkpoint. No real booking was created or tested by the cloud agent; automated tests use synthetic customers and simulated services.

**Owner verification:** on 2026-10-24, the owner reported this PC checkpoint “tested and all good.” Version 0.2.0 is the verified new-booking baseline. The instructions below remain the upgrade/retest guide; they do not imply an outstanding first test. Detailed scope is recorded in [BASELINE.md](BASELINE.md).

For the subsequent v0.2.1 browsing update, use [shorter appointment choices](BOOKING_UX.md). An already prepared v0.2.0 installation needs only the code update and restart; its existing configuration and booking setup remain usable.

Rescheduling and cancellation are available in the separate opt-in [v0.3.0 management checkpoint](MANAGEMENT_CHECKPOINT.md). The instructions below describe the previously verified new-booking setup.

## 1. Update without replacing the working configuration

Stop Node with Ctrl+C. Keep your existing `.env`, database, read-only Google token, Meta settings, calendar mapping, and tunnel configuration. Do not replace `.env` with the example or rerun `business:configure` for this upgrade.

If using Git, from your repository folder:

```powershell
git pull --ff-only
cd backend
npm ci --ignore-scripts
npm test
```

For a ZIP installation, keep the old copy and private settings while updating the backend code. Do not overwrite local configuration with public examples.

## 2. Prepare the booking journal with Node stopped

```powershell
npm run booking:prepare
```

This creates a timestamped SQLite backup and adds two booking tables and a customer identity index. It does not change schedules, customers, calendar/WhatsApp mappings, or Google events. Repeating it is safe and creates another backup.

The journal must survive restarts. Do not delete it or use separate database copies for the same active calendar. Run one app instance for this PC checkpoint.

## 3. Grant booking permission separately

```powershell
npm run google:connect:booking
```

This uses your existing Desktop OAuth credentials path but opens a new explicit consent flow with loopback, state validation, and PKCE. It requests calendar-list/free/busy access plus `calendar.events`. Google may describe the latter as viewing/editing events; the app only inserts new appointments and reads them for verification. No enabled path edits or deletes an event.

You do not need to revoke the working Google grant. The new authorization defaults to ignored `.local/google-booking-token.json`; the verified `.local/google-token.json` is left untouched. A customized `GOOGLE_BOOKING_TOKEN_PATH` must differ from `GOOGLE_OAUTH_TOKEN_PATH`.

To repeat booking consent after declining it or receiving insufficient permission:

```powershell
npm run google:connect:booking -- --reauthorize
```

Do not share credential values or commit authorization files.

## 4. Enable booking mode and check connections

Change only this setting in your existing `.env`:

```dotenv
NUKMIRIS_MODE=booking
```

Keep receiving-number routing and all verified business/calendar/Meta values. Then:

```powershell
npm run connections:check:booking
npm start
```

Checks verify Meta sender access, the exact calendar and access role, Google availability, journal presence, and actual event permission. They create no test event. Startup rejects missing permission, missing journal tables, or legacy customer-number routing.

Business `juanita-nails` continues using the stored ID for **Juanita's Nailsalon – Juanita**, never the display name or `primary`. Hours remain Monday–Friday 10:00–19:00, hourly 60-minute appointments, zero buffer, lunch 13:00–14:00. Reuse the verified Meta callback and tunnel unless its address changed.

## 5. Verify one real booking

1. Send **Menu**, then **Cita** from your approved WhatsApp test account.
2. Select a future free hour. Selection alone creates no event.
3. If asked, supply a full name for the selected business's customer registration.
4. Review the business, name, date, and time. Press **Confirmar cita** to create the appointment. **Elegir otro horario** returns without booking.
5. Verify WhatsApp confirmation and exactly one event with the customer's name and chosen times in Juanita's calendar.
6. Press the same confirmation button again: no second event should appear.
7. Send **Cita** again: the booked hour should disappear. A 10:00–11:00 appointment must leave 11:00 available when otherwise free.

The app rechecks schedule and availability at confirmation. Expired offers, changed mappings, another app customer's completed booking, and foreign customer/business IDs are rejected. You may remove only your test event manually afterward. Start a new **Cita** flow for another booking; an old confirmation button must never create a replacement event.

## Ambiguous results and recovery

Each request has a persistent identity and deterministic Google event ID. If Google saved the event but its response was lost, the app reads that same ID and verifies business, customer, request, and time before reporting success. It does not blindly insert again.

If the outcome remains unclear, the calendar stays protected against further automatic bookings. The customer may press the same confirmation button to check status. An operator may use the request ID from the local log:

```powershell
npm run booking:reconcile -- REQUEST_ID_FROM_LOCAL_LOG
```

This only reads Google and updates local status. A missing event after an ambiguous write is insufficient proof that the write cannot finish later, so unresolved requests retain protection. If status stays `uncertain`, return to availability mode and report it for review. Do not clear the journal or force-release a lock.

## Boundaries and return to availability

The SQLite journal coordinates app requests using the same database. Google has no atomic “check availability and reserve” operation: a simultaneous manual edit or another calendar app can still race with insertion. This is not a production distributed booking guarantee. General webhook delivery also remains in memory, so a crash before work is journaled can still lose a message.

To return to the verified read-only behavior: stop Node, set `NUKMIRIS_MODE=availability`, and run `npm start`. The read-only token, schedules, and mappings remain usable. Keep the booking journal and existing Google events; switching modes deletes nothing.

Report connection statuses, whether one event was created in the correct calendar, whether duplicate confirmation kept one event, and whether the adjacent hour remained available. Share no `.env`, tokens, OAuth files, or real database.
