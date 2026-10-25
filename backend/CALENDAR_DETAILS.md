# Calendar customer details and concise empty results — v0.7.2

Built on v0.7.1 (`68cda63`), including its Spanish slot labels. **The new Calendar-entry details passed the owner's PC check; the complete combined checkpoint remains pending. v0.7.0 is the last fully owner-verified baseline.** Use [the v0.7.3 guide](APPOINTMENT_LABELS.md) for the current combined PC checks.

On 2026-10-25 (America/Mexico_City), the owner reported the Calendar-entry check **“PASSED”** and supplied a screenshot showing the requested name/title, international WhatsApp number, reserved status, origin and no service placeholder in the selected Juanita calendar. This verifies new-event visible details only; preservation after rescheduling and the other WhatsApp checks remain pending. See [BASELINE.md](BASELINE.md) for evidence and scope. Customer identifying values are not reproduced here.

## Newly created Google Calendar appointments

The visible title is now `{Customer Full Name} — Cita`. For example:

```text
Cliente de Prueba — Cita
```

The visible description is:

```text
Cliente: Cliente de Prueba
WhatsApp: +525500000001
Estado: Reservada
Origen: NukMiris WhatsApp
```

The example number is synthetic. The real number comes from the existing `business_customers` record matched by the booking business and incoming WhatsApp identity, after the existing customer-ID ownership check. The name uses the full-name snapshot already saved from that scoped registration into the booking journal. No additional question or confirmation is introduced.

Numbers display with one leading `+`. The historical Mexican Meta form `521` followed by ten national digits displays as `+52` followed by those same ten digits, matching the established outbound normalization. The original stored sender, customer IDs and private event ownership properties are unchanged. Other international country codes are preserved.

There is no Services Catalog or persisted service selection in this runtime. Therefore real events omit `Servicio` entirely. No generic service, placeholder or guessed service is emitted. Once a catalog is implemented, its actual durable selection can supply that field; this checkpoint adds no catalog, service input or service storage.

This change applies only when the existing booking service inserts a new event. It performs no migration, scan or update of previously created events. Existing confirmed events and older uncertain inserts continue to be verified by event identity, ownership and timestamps, without rewriting display fields.

The rescheduling review found that its existing PATCH sends only `start`, `end` and private extended properties, adding the change-request ID while retaining the previous private properties. It already preserves the title and description, including business edits and legacy descriptions. That implementation is unchanged. Rescheduling a legacy event does not upgrade its visible fields. Cancellation, availability revalidation, ETags, locks, journals, event IDs, confirmation, recovery and idempotency retain their existing behavior.

## No upcoming appointments

Both `Reagendar` and `Cancelar` now return exactly:

> No encontré citas próximas. Si deseas agendar una nueva cita, escribe "cita".

No menu hint is appended to that response. The shared `MENU_INSTRUCTION` and global menu handler are unchanged; `menu`, `Menu` and `MENU` still return to the main menu.

The backend wording search found two equivalent legacy responses in `whatsapp-webhook.js`, in `startRescheduling` and `startCancellation`: “No encontré una cita futura asociada a este WhatsApp. Escribe Cita para agendar una nueva.” Those now use the same shared new message. The legacy handlers remain disabled. The legacy registration explanation about identifying a WhatsApp number serves a separate identity-display purpose, and other unavailable-slot/error messages have different meanings; their wording is retained. Internal documentation, logs, database identifiers, configuration and brand references remain in place.

## Files and validation

| File | Change |
| --- | --- |
| `lib/booking.js` | Read the stored scoped WhatsApp ID alongside the existing customer-ID check; change only new-event visible title/description |
| `lib/appointment-messages.js` | Add the exact shared no-upcoming-appointments response |
| `lib/management-menu.js` | Use that response for an empty owned-appointments result, without a menu suffix |
| `whatsapp-webhook.js` | Use the same response in the two disabled legacy handlers; routing/handlers are unchanged |
| `test/booking.test.cjs` | Realistic synthetic phone formats, exact details, metadata, isolation and unchanged legacy events/reconciliation |
| `test/management.test.cjs` | Preserve new details and ownership through normal/lost-response rescheduling; retain old event wording |
| `test/booking-webhook.test.cjs` | Name entry immediately creates an event with the saved phone, without another question or duplicate insertion |
| `test/management-webhook.test.cjs` | Exact empty messages for both commands, scoped empty lookups, unchanged foreign appointments and menu escape |
| `test/recovery-webhook.test.cjs` | Customer details survive a real process crash after Calendar insertion |
| `package.json`, `package-lock.json` | Version 0.7.2; dependencies and test commands unchanged |
| Root/backend READMEs, `BASELINE.md`, `KNOWN_LIMITATIONS.md`, `../docs/ROADMAP.md`, this guide | Scope, findings, test results and PC checks |

Complete `npm test` validation passed **all 536 tests**, with zero failures/cancellations/skips. This retains the 525 v0.7.1 regressions and adds 11 cases: five booking-detail/identity/legacy cases, three rescheduling-detail cases, one new-customer HTTP case, and two empty-result/menu HTTP cases. Existing crash recovery and foreign-appointment tests also verify the new details and exact wording. The 120 focused booking/management/HTTP checks passed as well.

Tests use synthetic databases, stubbed Google/Meta integrations and real disposable subprocesses. No live credentials, environment files, customer databases or Google Calendar events were accessed or changed by the cloud agent. No schema, dependencies, OAuth scopes, receiving-number/calendar mappings or feature flags change.

## Windows PC update and combined checks

Stop Node with Ctrl+C. From PowerShell in the existing `backend/` folder:

```powershell
npm.cmd run backup:create
git pull --ff-only
node -p "require('./package.json').version"
npm.cmd test
npm.cmd run connections:check:management
npm.cmd start
```

The version must print **0.7.2**, and `npm.cmd test` must report **536 passed**, with no failures/skips. No dependency installation, database preparation, configuration change or OAuth reconnection is required.

Use designated test appointments when intentionally booking, moving or cancelling one:

1. Check the included v0.7.1 labels in `cita`, **Más opciones**, date-specific times, **Más horarios** and rescheduling: for example, `vie 2 abr 10:00` for April 2, 2027. Existing navigation/messages should be familiar.
2. Make a new test booking with a registered customer. In the selected Google Calendar, check `{Full Name} — Cita`, all four description lines and the correct international WhatsApp number. There should be no `Servicio` placeholder or extra customer confirmation.
3. If also testing a new customer, select a time, enter their full name and check the same event details. The app should not ask for their number.
4. Reschedule that test appointment. Confirm that the same Calendar event moves and retains the title, customer details and phone. Check normal success and absence of an extra event.
5. Cancel the test appointment normally. With no remaining upcoming appointments for that test customer, send `Reagendar` and `Cancelar`: both must return the exact new sentence. Then type `MENU` and check the main menu returns.
6. Inspect an older appointment: updating/restarting the app must not reformat it. If deliberately rescheduling an older test appointment, its existing title/description should remain intact.

Cross-business/customer isolation, ownership tampering, API failures, repeated selections, uncertain writes and process-crash timing are covered offline. Existing Calendar concurrency and uncertain-delivery limits still apply. Record the owner's manual result before declaring this combined checkpoint verified.
