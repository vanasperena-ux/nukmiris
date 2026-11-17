# RM-1 — Windows R0 acceptance (NM-068 / NM-069)

This tests the complete **local synthetic** copy/reminder/attendance increment. Codex's evidence is Linux-only; native Windows execution of this new source remains pending. All accounts, delivery receipts and permissions below are explicit simulation. No real customer, Meta or Google account is needed.

Use Windows 11, Git, Node 24 and Docker Desktop with Linux containers. Leave every accepted owner checkout/profile, Ana's protected case and v0.8.1 alone. A new profile basename must begin **nukmiris-vnext-**. Clock changes affect only this new profile, but apply to **both** synthetic businesses within it.

## 1. New checkout and automated checks

PowerShell:

```powershell
$ErrorActionPreference = 'Stop'
$Source = '6a25e295a7b05860d0cb8207c0b4c57731af74e7'
$Checkout = Join-Path $env:USERPROFILE 'Desktop\NukMiris RM1 Review'
if (Test-Path -LiteralPath $Checkout) { throw 'Choose a NEW checkout directory.' }
git clone --single-branch --branch product/rm1-reminders-communications https://github.com/vanasperena-ux/nukmiris.git "$Checkout"
if ($LASTEXITCODE -ne 0) { throw 'Clone failed.' }
Set-Location -LiteralPath $Checkout
git checkout --detach $Source
if ($LASTEXITCODE -ne 0 -or (git rev-parse HEAD) -ne $Source) { throw 'Source mismatch.' }
if (git status --porcelain) { throw 'Checkout must be clean.' }
node --version # Node 24.x
Set-Location vnext
npm.cmd ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Dependency install failed.' }
npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
npm.cmd run check:scope
if ($LASTEXITCODE -ne 0) { throw 'Scope check failed.' }
npm.cmd run test:rm1:runtime
if ($LASTEXITCODE -ne 0) { throw 'Retain the output; stop on failure.' }
# Expected: 2 PASS / 0 FAIL / 0 SKIP, rm1Tcp PASS and rm1Unknown HELD_NO_RETRY.
# PostgreSQL 17.11, TimeZone UTC, nativeWindows EXECUTED on this laptop.
# Optional complete portable regression:
npm.cmd run test:runtime
if ($LASTEXITCODE -ne 0) { throw 'Retain the failing output; do not bypass guards.' }
```

Linux core tests use a separate Unix-socket fixture; they are not native Windows evidence. An optional actual Edge test is `npm.cmd run test:rm1:browser -- "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"` (substitute your actual executable). It creates its own disposable profile and executes the owner controls and browser conversation.

## 2. Start an isolated browser profile

```powershell
$Profile = Join-Path $Checkout 'nukmiris-vnext-rm1-review'
if (Test-Path -LiteralPath $Profile) { throw 'Choose a NEW profile; do not reuse any owner profile.' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
node local/cli.mjs book --state-dir "$Profile" --db-port 0 --port 0
if ($LASTEXITCODE -ne 0) { throw 'Retain the output; do not bypass privacy or port guards.' }
# Open the private loopback URL printed above. Keep its token private.
```

Port `0` uses the existing supported low loopback-port allocator. An explicit occupied port fails without fallback. No upgrade/reset of another profile is authorized or required.

## 3. Copy and ordinary booking

1. Select **Juanita’s Nail Salon / Ana**. Send `menu`. Expect `Hola Ana Ejemplo, bienvenido a Juanita’s Nail Salon. Soy un bot que te ayuda a agendar, reagendar o cancelar una cita.`, the exact three paragraphs in [CX022](CX-MATRIX.md), and the same three menu options. Unknown customer greeting omits the name: `Hola, bienvenido a …`. No braces, literal backslash-n or stray `n`.
2. Send `cita`: **Elige un horario** with two times and **Más opciones**. Clicking more shows **Te muestro más opciones. Elige un horario:**. More times on a chosen date uses that same sentence; the initial chosen-date prompt is unchanged.
3. In date selection, test `ayer`, `en 366 días`, an impossible date such as `31 feb 2030`, and an upcoming full date with the wrong weekday. Expect the exact CX012–015 strings in the matrix. The default horizon shows **365**, not braces. These errors must not book or remove usable choices.
4. Send `humano`: only **Escribe tu mensaje. El bot ya no está activo.**, blank line, **Escribe "menu" para activar el bot y volver al menú principal.** A subsequent support message and `cita` remain quiet and retained. `menu` exits. No appointment summary on human entry; ordinary menu retains its existing all-upcoming summary.
5. The existing no-active-services trigger deliberately uses the same no-availability wording as no times. On a disposable profile, deactivate all services in owner **Servicios**, send `cita`, and expect the exact CX008 sentence with no choices/bookings. Restore services before the reminder walkthrough.

## 4. Four-stage reminder demonstration without waiting

1. Open **Administrar servicios, empleados y citas** → **Recordatorios**. It starts **disabled**, with no old appointments adopted. Activate it **before** creating the appointment below. The four account-specific template fixtures should show **Aprobada (simulada)**.
2. Under **Permiso del cliente**, select **Ana Ejemplo**. Enter explicit synthetic evidence naming the customer/business, check the affirmation checkbox and click **Registrar permiso**. Expect **Permiso sintético registrado**. Booking alone never grants this permission.
3. Return to chat. Send `cita`, type an unambiguous future date **at least 10 days ahead**, choosing a business opening day (default Monday–Saturday), and select a time. It books directly for this known customer. For a new customer, select the slot first, then provide the name; record that customer's synthetic permission in the owner screen after booking and before advancing to any due time. No new consent prompt is sent.
4. Return to owner **Recordatorios**. Find four **Programado** entries for that appointment: 7 days, 24 hours, 22 hours and 2 hours. Dates use the business timezone. The appointment is still an ordinary confirmed booking; attendance starts **Asistencia sin confirmar**.
5. Click **Avanzar al siguiente recordatorio** once. Wait until the seven-day row says **Aceptado por el simulador; entrega no confirmada**. The synthetic customer chat displays the exact informational template. Acceptance must not say delivered. Each row has timed history.
6. Advance to the 24-hour request and wait for acceptance. The chat has **Sí, confirmo** / **Necesito reagendar**. For this demonstration, do **not** answer yet. In the owner request row, click **Simular entregado** and wait for **Entrega simulada acreditada**. This explicit correlated receipt is required for the next step.
7. Advance to 22 hours. With the 24-hour delivery evidence and no response, the follow-up is accepted and has the same two buttons. In the chat, click the follow-up's **Sí, confirmo**. Expect the legacy Spanish thank-you with the exact appointment date/time. Owner rows show **Asistencia confirmada**. Clicking again cannot create another booking or change the first confirmation time.
8. Advance to 2 hours. The final information-only reminder is accepted. The appointment remains ACTIVE/Confirmada; no response would also have left it booked and eligible for the final reminder. No automatic cancellation or no-show policy exists.

Wait for each accepted/held/skipped result before advancing again. Advancing manually beyond a window is an intentional expiry test, not a way to force a missed send. The durable clock does not move backward or resume wall time after advancement. **Avanzar 1 segundo** is available for distinct permission-event times. A manual instant must include `Z` or an explicit UTC offset.

## 5. Negative and change scenarios

Use additional **new profiles** for independent timing/failure scenarios; never rewind the clock, clear tables or reset a held operation.

- **No 24-hour delivery proof:** leave the request merely accepted and advance to 22 hours. Follow-up is **Omitido**, with the no-delivery-evidence reason. Injecting delivery afterward must not revive it. Advance to final: it still sends if permission and other gates remain valid.
- **Missing permission:** a newly named customer without evidence gets no proactive reminder; due row is **Suprimido**. Recording permission later only enables still-future eligible thresholds; it does not revive that omitted due reminder.
- **Withdrawal and reauthorization:** send `STOP` while in bot mode, or use owner **Retirar permiso**. Future reminders are suppressed. Advance the profile clock **1 second**, then send `da mi permiso` as the same registered customer/business. Expect a recorded permission event and only still-future thresholds restored. Unknown/other-business customer and stale/duplicate evidence cannot grant permission. The one-second step avoids a same-timestamp grant/revocation tie, which correctly favors withdrawal.
- **Template problem:** set one template to **Ausente**, **Rechazada** or **No disponible temporalmente**, then advance to its due time. No proactive fallback message appears; owner activity shows **Requiere atención** with the reason. Restoring the synthetic approval within the original window may allow an unsubmitted job; expiry never reallocates an entered/UNKNOWN attempt. Bernard's independent account remains unaffected.
- **Failed delivery:** inject **Simular fallo de entrega** for an accepted request. It shows **Entrega fallida**, never silently resubmits, and cannot establish 22-hour delivery proof.
- **Reschedule from a reminder:** choose **Necesito reagendar**. The existing exact appointment opens directly with the original employee. Nothing moves until a new time is selected. Successful selection keeps the identity/frozen service/original employee, resets attendance and replaces only eligible future schedules. Old reminders/actions remain historical. Abandoning the change for 15 minutes keeps the original booking and restores prior attendance, while retaining response evidence so no false “no response” follow-up appears.
- **Cancel after a send:** ordinary `cancelar` selects the exact appointment. After proven cancellation, remaining reminders are suppressed; the earlier send remains in history. An unresolved cancellation/move must retain the old schedule/protections and must not send a false new-state message.
- **Protected send:** in the existing chat fake-provider failure selector choose **BEFORE_APPLY**, then advance a fresh appointment to a due reminder. Expect held/Needs Attention, no false delivery and no blind retry after restart. Changing the simulator setting is not proof resolving that case. Stop and retain it; use a new profile for further successful tests.
- **Tenant separation:** switch to **Bernard’s Grooming Salon** in owner and chat. Juanita's jobs, permission and approvals must not appear or apply. Permission evidence fields are cleared on customer/business changes. The fixture clock is shared, as explicitly labelled, but communication/customer data remains scoped.

Stale/changed picker responses CX039/040, receipt substitution, concurrency and crash schedules are automated deterministically. The existing expired-action message remains a separate unchanged scenario. No laptop SQL edits are needed.

## 6. Stop, restart, coherent backup and inert restore

```powershell
node local/cli.mjs stop --state-dir "$Profile"
if ($LASTEXITCODE -ne 0) { throw 'Stop failed.' }
node local/cli.mjs start --state-dir "$Profile" --port 0
if ($LASTEXITCODE -ne 0) { throw 'Restart failed.' }
# Reopen the newly printed private URL. Check jobs, attendance, clock and no duplicates.
node local/cli.mjs stop --state-dir "$Profile"
if ($LASTEXITCODE -ne 0) { throw 'Stop failed.' }
$Backup = node local/cli.mjs backup --state-dir "$Profile" | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $Backup.coherent) { throw 'Backup was not confirmed coherent.' }
node local/cli.mjs stop --state-dir "$Profile"
if ($LASTEXITCODE -ne 0) { throw 'Database stop failed.' }
# Optional: restore to another NEW isolated target. Keep backup and hash private.
$Restore = Join-Path $Checkout 'nukmiris-vnext-rm1-inert-restore'
if (Test-Path -LiteralPath $Restore) { throw 'Choose a NEW restore target.' }
node local/cli.mjs restore --state-dir "$Restore" --db-port 0 --backup "$($Backup.directory)" --sha256 "$($Backup.manifestSha256)"
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; retain evidence.' }
# Restore is deliberately suspended/inert. Do not activate it or bypass the guard.
```

PASS requires exact copy, correct four-stage scheduling/receipts/attendance, no false delivery or booking outcomes, no duplicates after restart, retained history and tenant isolation. On failure, record exact source, Node/PostgreSQL versions, command output and redacted observations. Do not share tokens, custody keys or private backups. Stop for owner functional acceptance and focused independent review; this does not close R0, authorize a merge or open any production gate.
