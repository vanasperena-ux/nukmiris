# Simple menu instructions — v0.7.0

Built on the owner-verified v0.6.0 baseline (`3238e34`). **v0.7.0 is owner-verified; the current working baseline is [v0.7.3](APPOINTMENT_LABELS.md), which retains this menu behavior.** Normal appointment conversations no longer repeat how to return to the menu after each question. Helpful escape instructions use exactly:

> Escribe "menu" para volver al menú principal.

On 2026-10-25 (America/Mexico_City), the owner confirmed **“yes”** when asked whether the latest v0.7.0 menu update tested OK. Delivered code reference: `e1c5370061ed268dffe8c17bd8f466182e544b1a`. This records the overall manual checkpoint; no separate PC commit hash or detailed per-case log was supplied. See [BASELINE.md](BASELINE.md) for scope. The automated results and technical limits below remain applicable.

## Customer messages before and after

The standardized sentence is included only in the recovery, unavailable-operation, result-navigation and human-support cases below. It is not automatically appended to outgoing messages.

| Context | Before | After |
| --- | --- | --- |
| New customer, including tapping the chosen time again | Para reservar este horario, indícanos tu nombre completo. Escribe Menu para volver. | Para reservar este horario, indícanos tu nombre completo. |
| Invalid name | Por favor, escribe tu nombre completo (máximo 120 caracteres). Escribe Menu para volver. | Por favor, escribe tu nombre completo (máximo 120 caracteres). |
| Times for a chosen date | ¿Qué hora prefieres para el [fecha]? … Para cambiar de día, escribe otra fecha. Escribe Menu para volver. | Same date/time guidance, ending at “Para cambiar de día, escribe otra fecha.” |
| No times on that date | No hay horarios disponibles para el [fecha]. Elige otra fecha o escríbela. Escribe Menu para volver. | No hay horarios disponibles para el [fecha]. Elige otra fecha o escríbela. |
| Choose appointment to reschedule | Selecciona la cita que deseas reagendar. Escribe "menu" para volver. | Selecciona la cita que deseas reagendar. |
| Choose appointment to cancel | Selecciona la cita que deseas cancelar. Se cancelará al seleccionarla. Escribe "menu" para volver. | Selecciona la cita que deseas cancelar. Se cancelará al seleccionarla. |
| Free text during appointment selection | Usa los botones para elegir o confirmar. Escribe Menu para volver. | Selecciona una de las opciones disponibles. |
| Enter human support | Escribe tu mensaje. Para organizar tu cita o cancelar, escribe "menu". | Escribe tu mensaje. + standardized sentence |
| Interactive action during human support | Tu conversación está en atención personal. Escribe tu mensaje o Menu. | Tu conversación está en atención personal. Escribe tu mensaje. + standardized sentence |
| Scheduling paused | Las citas están temporalmente deshabilitadas mientras configuramos el calendario de este negocio. Puedes escribir Menu para regresar o Hablar con alguien para recibir ayuda. | Same unavailable-operation explanation + standardized sentence |
| Read-only time selection | El horario sigue disponible: [fecha/hora]. La reserva automática todavía no está activada. Escribe Menu para regresar o hablar con el negocio. | Same availability-only explanation + standardized sentence |
| Management disabled | Esta opción aún no está disponible. Escribe Cita para hacer una reserva nueva o Menu para recibir ayuda. | Esta opción aún no está disponible. Escribe Cita para hacer una reserva nueva. + standardized sentence |
| Appointment-context or availability lookup failure | No pude consultar tus citas / el calendario en este momento. Intenta más tarde o escribe Menu para recibir ayuda. | Same failure explanation. Intenta más tarde. + standardized sentence |
| Typed-date lookup failure | No pude consultar esa fecha. Intenta de nuevo o escribe Menu para recibir ayuda. | No pude consultar esa fecha. Intenta de nuevo. + standardized sentence |
| Management exception | No pude completar la solicitud. Si ya seleccionaste un horario o una cita, vuelve a seleccionar la misma opción para revisar su estado antes de intentar otro cambio. Escribe "menu" para volver. | Same saved-request recovery guidance + standardized sentence |
| No owned upcoming appointments | No encontré próximas citas de NukMiris para tu número en este negocio. Escribe Cita para hacer una reserva nueva o Menu para recibir ayuda. | Same no-appointments explanation. Escribe Cita para hacer una reserva nueva. + standardized sentence |
| Selected appointment is gone | Esa cita ya no aparece en el calendario. Escribe "menu" para revisar tus citas. | Esa cita ya no aparece en el calendario. + standardized sentence |
| Declined change | No realizamos cambios en tu cita. Escribe Menu para volver. | No realizamos cambios en tu cita. + standardized sentence |
| Other rejected/invalid change | No pudimos realizar este cambio. Escribe Reagendar o Cancelar para consultar de nuevo tu cita, o Menu para recibir ayuda. | Same failure explanation. Escribe Reagendar o Cancelar para consultar de nuevo tu cita. + standardized sentence |
| Free text at booking/change result | Para organizar tu cita o cancelar, escribe "menu". | Standardized sentence |
| Expired intent clarification | Esta opción ya no está vigente. Escribe Menu para ver las opciones actuales. | Esta opción ya no está vigente. + standardized sentence |
| Other unrecognized interactive action | Esta opción ya no está vigente. Escribe Hola para ver el menú actual. | Esta opción ya no está vigente. + standardized sentence |
| Free text in a saved legacy `booking_confirm` session | Usa los botones Confirmar cita o Elegir otro horario. Escribe Menu para volver. | Esta opción ya no está vigente. + standardized sentence; discard that transient session without creating an appointment |

Specific existing recovery instructions such as “Escribe Cita para consultar nuevos horarios” remain where they already lead directly back to the relevant workflow. Successful booking/rescheduling/cancellation notifications retain their verified appointment details and wording.

## Global menu behavior

The router handles a text `menu` immediately after command normalization, before human support, natural intent recognition, date/name input, management, or legacy-state dispatch. `menu`, `Menu`, `MENU`, mixed case, surrounding whitespace and the existing accented `menú` equivalent work. Existing `Hola`, exact appointment commands and natural-intent routing retain their established behavior; `Hola` remains ordinary text in an open human conversation.

Returning to the menu closes human support when open, removes the current transient session and creates a fresh main menu. Previously unused booking/change journal offers are declined only for that receiving business and sender. Old date/time, appointment, clarification and navigation selections no longer match the new session. It does not register a pending name or create, move, cancel or duplicate an appointment.

Confirmed, pending and uncertain request records and their calendar locks remain intact. Returning to the menu does not withdraw a Calendar operation already submitted. Existing request-ID status/recovery buttons remain usable and reconcile that same request; they do not authorize a second write. Reliability mode continues processing each customer's messages in order and recording replies atomically. If a process dies while the menu transition is being prepared, its existing local-state recovery replays the transition safely.

The v0.6.0 router already skipped most active input handlers for `menu`, but its later legacy-session guard could clear an old session and send the scheduling-paused message before reaching the main menu. The early global branch fixes that behavior, including active and expired saved states.

## Booking confirmation audit

`booking_confirm` was **legacy**: no current flow created it. Its leftover free-text handler still told customers to use “Confirmar cita” or “Elegir otro horario.” That instruction is removed. A saved legacy state receives a stale-option explanation rather than turning arbitrary text into permission to book.

Current booking behavior was already immediate and stays immediate:

1. An existing customer selects a currently offered time. The app saves the booking request, rechecks availability under its existing lock and initiates creation.
2. A new customer selects a time, supplies a valid full name once, and the app initiates the same booking path automatically.
3. Only a verified successful creation produces the existing “¡Tu cita está agendada!” notification with date, times and business.

No new customer confirmation screen or button is added. `handleBookingDecision`, `bookings.confirm`, request decisions named `yes`, and old request-ID buttons are retained for the internal transaction/recovery path and compatibility with previously issued requests. Removing those would disrupt persistence or recovery; their names do not imply that a new customer confirmation is requested.

## Files modified

| File | Purpose |
| --- | --- |
| `whatsapp-webhook.js` | Early global navigation, concise name prompts, standard useful hints and safe legacy-state handling |
| `lib/menu-messages.js` (new) | Single shared exact menu instruction |
| `lib/availability-menu.js` | Remove repeated menu instruction from normal time/empty-date guidance |
| `lib/management-menu.js` | Short appointment-selection prompts and standard recovery hints |
| `lib/intent-menu.js` | Standard stale-clarification escape instruction |
| `test/booking-webhook.test.cjs` | Names/immediate booking, actual state navigation, preserved uncertain requests/locks, duplicate Meta delivery and repeated selections |
| `test/management-webhook.test.cjs` | Actual management-state navigation, scoped offer invalidation, unchanged appointments, preserved uncertain changes and failure recovery |
| `test/availability-webhook.test.cjs` | Lean time guidance, read-only navigation and Calendar-failure escape |
| `test/support-only.test.cjs` | Current/legacy states, capitalization/accent equivalence and human-support exit |
| `test/recovery-webhook.test.cjs` | Real subprocess interruption of menu transitions, restart, deduplication and stale selection rejection |
| `package.json`, `package-lock.json` | Version 0.7.0; dependency versions unchanged |
| Root/backend READMEs, `BASELINE.md`, `KNOWN_LIMITATIONS.md`, `../docs/ROADMAP.md`, this guide | Release scope, verification status, before/after messages and PC instructions |

## Automated validation and limits

**All 484 offline tests passed, with zero failures, cancellations or skipped tests.** This retains all 460 v0.6.0 regressions and adds 24 tests: nine booking, nine management, three support/legacy-state, one read-only availability and two real process-restart cases. Parameterized scenarios exercise command capitalization across actual date/time, name, clarification, result and management states, plus active/expired saved legacy states. Existing cases also verify the shorter prompts, immediate booking for registered/new customers, expired selections, Calendar failures, duplicate delivery, repeated selections and recovery without repeated writes.

Tests use synthetic databases, stubbed Google/Meta services, signed loopback HTTP and actual subprocess restarts. The cloud agent does not access the owner's PC or live accounts. `git diff --check` and local documentation links pass; package/lockfile comparison confirms dependency versions and test scripts are unchanged. The owner's successful PC checkpoint is recorded above.

The shared availability/date engine, business/customer identity, calendar ownership, lifecycle services, concurrency locks, request journals, schema, flags and dependencies are unchanged. Existing reliability/unknown-result limits still apply. `menu` is processed in order after an earlier message/operation; it cannot recall a submitted Calendar request. It can perform the existing read-only appointment overview lookup when building the main menu.

This repository has no active Services Catalog or appointment-reminder workflow. Neither is added by this change, and the success notification does not promise reminders. The global branch precedes all current and legacy session handlers; live service/reminder interactions cannot be claimed or tested as implemented features.

## Windows PC update and checks

Stop Node with Ctrl+C. From PowerShell in the existing `backend/` folder:

```powershell
npm.cmd run backup:create
git pull --ff-only
node -p "require('./package.json').version"
npm.cmd test
npm.cmd run connections:check:management
npm.cmd start
```

The version must print **0.7.0**, and `npm.cmd test` must report **484 passed**, with no failures/skips. Keep existing credentials, database, feature flags, business/calendar mappings and Cloudflare tunnel. No migration, preparation command, dependency update or OAuth reconnection is required.

Use designated test appointments for any checks that intentionally book, move or cancel one:

1. With a new test customer, choose a time. Confirm the name prompt and invalid-name correction have no repeated menu instruction. Enter a valid name and check that booking completes automatically, with one success message and one Calendar event.
2. With a registered test customer, choose a time and check that booking starts immediately without a confirmation button. Tap the same selected time again and verify that no second event appears.
3. Enter `menu`, `Menu` or `MENU` while choosing dates/times, entering a name, selecting an appointment to reschedule/cancel, and after a result. Check the fresh main menu, then try the earlier selection: it must be stale and must not change an appointment.
4. Enter human support, send a test message, then type `menu`. Check that the standard instruction appeared on entry and that the main menu returns. Normal appointment words should still remain in support until that exit.
5. Check the shorter reschedule/cancellation selection messages. Normal rescheduling and cancellation must still act on the selected appointment exactly once.
6. Restart after receiving a name prompt or a date/time option. Type `menu`, restart again and try the old choice; it must stay invalid. Check that existing confirmed appointments remain unchanged.

Calendar/API failure, exact process-interruption timing, duplicate signed deliveries, uncertain outcomes, and active/expired legacy states are tested offline; no PC configuration change is needed to force those failures. The owner's successful manual checkpoint is recorded above; these checks remain available for future regression testing.
