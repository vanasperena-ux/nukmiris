# WhatsApp UX improvements — v0.3.1

This checkpoint implements the owner's eight requested improvements on top of the PC-verified v0.3.0 baseline. The owner subsequently verified v0.3.1 (“OK I tested v0.3.1 all good thanks”). The instructions below remain the UX/retest guide; the next [v0.4.0 reliability checkpoint](RELIABILITY_CHECKPOINT.md) preserves these interactions.

## Customer behavior

- The main booking button is **Agendar una cita**, with the existing routing ID.
- Human chat returns with: **Para organizar tu cita o cancelar, escribe "menu".** Menu remains case-insensitive.
- The initial availability message is exactly **Elige un horario que te funciona mejor:**
- More options use exactly **Te muestro mas opciones. Elige un horario que te funciona mejor:**
- In connected booking mode, a recognized customer's menu includes their current upcoming NukMiris appointments from Google Calendar, using the existing scoped lookup. All are shown chronologically in the business's local time. Past/cancelled appointments are omitted. A long overview is split into text messages before the menu buttons; no appointments are dropped. A lookup failure is reported without blocking the menu. Support/read-only modes retain their existing authorization boundaries.
- Selecting a booking slot now commits it directly for a recognized customer. A new customer supplies their full name once before that selected slot is booked. There is no additional confirmation screen.
- **Reagendar** goes directly to available times when there is one appointment. With multiple appointments, the customer first selects the appointment to move. Selecting the new slot commits the move, using the same event ID.
- **Cancelar** always shows an appointment selection, including when there is only one. Selecting that appointment commits cancellation. There is no extra cancellation confirmation.

Booking and rescheduling success messages use the date on one line, local start/end times on the next, and **¡Te esperamos en BUSINESS!** as the closing phrase. The business/date/name values are dynamic. Success is sent only after the existing Calendar service accepts or verifies the operation.

The existing schedule engine, booking window, two-plus-two choices, date/time navigation, ownership checks, locks, ETags, journals, and Calendar recovery remain in use. These are targeted conversation changes, with no new dependencies, permissions, or schema migration. No-show tracking is not introduced; existing cancellation/journal distinctions remain unchanged.

## Files and reused logic

| File | Change |
| --- | --- |
| `whatsapp-webhook.js` | Menu wording and appointment overview; selected-slot booking; existing registration and human handoff retained. |
| `lib/availability-menu.js` | Exact requested messages and passing the selected action ID; search/window/pagination calculations retained. |
| `lib/management-menu.js` | Direct rescheduling/cancellation and saved-request replay; existing management service and date menu reused. |
| `lib/appointment-management.js` | Read-only adapter for the existing future appointment lookup, plus a recognizable already-cancelled result; mutation safeguards retained. |
| `lib/appointment-messages.js` | Shared Spanish success/menu formatting and long-overview text splitting. |
| `test/*-webhook.test.cjs`, `test/support-only.test.cjs` | Updated conversation expectations and tests for the requested UX and failure cases. |

Version metadata and current/historical guides are updated. `docs/ROADMAP.md` saves the explicitly requested next-step plan. Calendar authorization, mutation algorithms, schema, schedule configuration, and core service regression tests are unchanged.

## Update the verified PC installation

PowerShell commands use `npm.cmd`, the working launcher on your PC. Future release/testing instructions should use the same form.

Stop Node with Ctrl+C. From your repository folder:

```powershell
git pull --ff-only
cd backend
npm.cmd test
npm.cmd start
```

Keep `.env`, the database, OAuth files, Meta/tunnel settings, booking mode, and the existing `NUKMIRIS_ENABLE_MANAGEMENT=true` setting. An already prepared v0.3.0 installation needs no new setup. The historical booking/management guides describe the older confirmation screens; this guide describes the current behavior.

## Real WhatsApp checks

Use test appointments in the already selected business calendar:

1. Send **menu** as a recognized customer. Check the name, business, upcoming appointment dates/times, and **Agendar una cita** button. Repeat with more than one upcoming appointment.
2. Open **Cita**, then **Más opciones**. Check the exact short messages. Select a free slot: it should book immediately, without asking for the recognized customer's name or another confirmation.
3. Send **menu** again. Verify the new appointment is listed with the correct local time. Check the new success-message layout and business name in the closing phrase.
4. Use **Reagendar**. With one appointment, times appear directly. Select a new time and verify the same event moves once; no confirmation screen should appear.
5. Use **Cancelar**. Verify it waits for the appointment selection, then cancels only the selected appointment. A repeated selection must not affect another event.
6. Try an older selection after starting another flow or returning to **menu**. It must be rejected. Check that a busy target or failed move preserves the original appointment.
7. Enter human chat, send a message, and use mixed-case **MeNu** to return. Check the requested return wording and upcoming appointments.

If a calendar result is unclear, **Consultar estado** checks the recorded request. **Reintentar** may appear after a busy response. These are recovery actions after a selected operation, not extra confirmation steps in the normal flow. Old v0.3.0 confirmation buttons remain bound to their existing request for compatibility; new flows do not publish them.

The cloud tests use synthetic databases and simulated services, not your PC or real Google/Meta accounts. A cloud test passing is separate from your real WhatsApp verification.

All **159 offline tests passed**, with zero failures/skipped tests. The availability-engine, booking-service, and management-service regression tests remain unchanged. Updated HTTP tests cover the eight requested improvements, failures, stale/repeated selections, and replay after a webhook restart.

The [saved roadmap](../docs/ROADMAP.md) records the owner's authorization to proceed with reliability/restart recovery after accepting these UX changes.
