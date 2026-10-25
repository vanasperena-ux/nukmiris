# Rescheduling and cancellation — v0.3.0 PC checkpoint

**Current UX:** v0.3.1 removes the additional confirmation screens after explicit selections. Use [UX_CHECKPOINT.md](UX_CHECKPOINT.md) for current PC checks. The preparation/authorization steps below remain valid; the confirmation-screen examples describe the verified historical v0.3.0 flow.

The owner accepted the v0.2.1 appointment choices after verifying the earlier availability and new-booking checkpoints. This update adds optional **customer-confirmed rescheduling and cancellation**. Automated tests use synthetic data and simulated Google/Meta services.

**Owner verification:** on 2026-10-24, the owner reported the PC checkpoint successful: “that worked, reagendar and cancelar worked well.” Version 0.3.0 is now the verified rescheduling/cancellation baseline. The instructions below remain the setup/retest guide; they do not imply an outstanding first test. See [BASELINE.md](BASELINE.md) for the evidence and scope.

All **144 automated tests passed**, with no skipped tests, including the earlier availability/new-booking regressions and the new management flows and recovery checks.

## 1. Update and prepare

Stop Node with Ctrl+C. From the repository folder:

```powershell
git pull --ff-only
cd backend
npm test
npm run management:prepare
```

The preparation command creates a timestamped SQLite backup, then adds the appointment-change journal. It preserves existing bookings, customers, schedules, calendar mappings, and Google events. Repeating preparation is safe. Startup never prepares the database automatically.

Keep your existing `.env`, database, OAuth files, Meta settings, and tunnel. There are no new packages or Google permissions to add after the verified booking setup. The existing separate booking token already has `calendar.events`, which covers these actions. If Google reports missing event permission, repeat the existing `google:connect:booking` flow; do not revoke or replace the read-only token.

## 2. Enable and start

Keep booking mode and add the new setting in your existing `.env`:

```dotenv
NUKMIRIS_MODE=booking
NUKMIRIS_ENABLE_MANAGEMENT=true
```

Then:

```powershell
npm run connections:check:management
npm start
```

The connection check reads Google/Meta and checks the local journal; it changes no events. Startup should report customer confirmation required for rescheduling and cancellation. Keep one app instance for this PC checkpoint, using the same database.

Business `juanita-nails` still uses the stored calendar ID for **Juanita's Nailsalon – Juanita**, never `primary`. Juanita's hours, lunch, hourly starts, and zero buffer remain unchanged.

## 3. Test rescheduling using a test appointment

1. In WhatsApp, send **Menu → Cita** and create one future test appointment through NukMiris. Verify it appears once in Juanita's calendar.
2. Send **Reagendar**, or use **Menu → Reagendar / cancelar → Reagendar tu cita**. Choose that appointment.
3. Choose a new time through the accepted two-plus-two menu or **Elegir fecha**. You can also type a date as **DD/MM/AAAA**.
4. Review the current and new appointment times. Before confirmation, the original event must remain unchanged. **Conservar mi cita** abandons the change.
5. Press **Confirmar cambio**. Verify the same calendar event moved to the new time, with no second event. The original time should become available and the new time should be occupied.
6. Press the same confirmation button again. It must report the saved outcome without moving or creating another event.

The new time is checked again at confirmation. If another appointment has taken it, the move is rejected and the original appointment remains. A direct edit to the source event after selection also requires a fresh selection rather than overwriting that edit.

## 4. Test cancellation on that test appointment

1. Send **Cancelar**, or use **Menu → Reagendar / cancelar → Cancelar una cita**. Select the moved test appointment.
2. Review its date/time. Try **Conservar mi cita** first: the event must remain.
3. Start **Cancelar** again, select the appointment, and press **Sí, cancelar**.
4. Verify WhatsApp confirmation, removal from Juanita's calendar, and that its time becomes available again.
5. Press the same cancellation confirmation again. It must not affect another appointment. **Cancelar** should no longer list the cancelled test appointment.

Report whether rescheduling moved one event, cancellation removed it, and repeated confirmations caused no extra changes. Share no tokens, `.env`, OAuth files, or real database.

## What customers can manage

Only future, nonrecurring appointments created by this NukMiris booking service, recorded as confirmed in its database, and still carrying the matching business/customer/request metadata are eligible. A customer sees only appointments for their signed WhatsApp sender and the receiving business's configured calendar. Manually created events and historical appointments without a matching booking record are not imported or changed.

The rescheduling search uses the existing availability engine with the original event excluded from busy periods. Other events, including all-day events, still block time. This permits a valid move that overlaps the original appointment when other businesses use longer durations or shorter start intervals.

Offers expire after 15 minutes. **Menu**, a new booking flow, or a new management command invalidates unconfirmed offers. Confirmed/pending requests retain their persistent identity across restarts. Legacy archived appointment handlers stay disabled; this is a separate scoped service.

## Unclear responses and recovery

Every change is journaled before writing. New bookings and appointment changes share the same calendar lock. Writes use the source event's ETag so a concurrent edit to that event is rejected. Rescheduling patches the same event; cancellation deletes only that verified event. API write retries are disabled.

If a write response is lost, NukMiris reads that same event to check the result. A reschedule must match its request marker, ownership, and target times. A cancellation is complete when the event is cancelled or no longer exists. An unresolved result keeps the calendar protected; the customer can press the same confirmation button to check again without repeating the write.

An operator may check a request ID from the local log:

```powershell
npm run management:reconcile -- CHANGE_REQUEST_ID_FROM_LOCAL_LOG
```

This only reads Google and updates local status. If the result remains `uncertain`, inspect it before making another reservation/change. Do not delete the journal or force-release locks.

To disable these two actions, stop Node, set `NUKMIRIS_ENABLE_MANAGEMENT=false`, and restart. Keep the journal and existing events. Unresolved locks remain protective even when the feature is disabled. For read-only access during investigation, set `NUKMIRIS_MODE=availability` and restart.

Google has no atomic availability-check-and-move operation. Local locks coordinate instances sharing this database, but a simultaneous manual edit or another app can still occupy the target after it is checked. ETags protect the source event, not every event in the calendar. General message delivery also remains in memory. These existing prototype limits still apply.
