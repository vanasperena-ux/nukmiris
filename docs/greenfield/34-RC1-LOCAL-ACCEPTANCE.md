# RC-1 — local reschedule and cancel

Scope: [Issue #26](https://github.com/vanasperena-ux/nukmiris/issues/26), source based on accepted SE-1/N1 `95b122771b0958c0bc9bda07db1dab14f35aeb67` and its documentation head `8f69e34cd265d197485dc6b947bac86a23ae796c`. No experimental cloud-proof code is imported. [Flow/copy matrix](33-RC1-FLOW-COPY.md). Exact tested commit/results: [RC-1 evidence](../../vnext/evidence/rc1/README.md).

The interactive catalog application now uses the existing sealed MOVE/CANCEL operations, attempt ownership, conversation ordering, protected ranges, read-only reconciliation and atomic proof finalizer. It does not directly edit bookings from a form or chat action. Migration 012 binds the consumed action to the customer's exact current appointment/revision/snapshot, original employee/event and current catalog revision. MOVE keeps the same event and frozen service duration/buffer; CANCEL deletes exactly that fake event. Only proven finalization releases protection and appends lifecycle history. A missing fake event or missing proof is uncertainty, not successful cancellation. An older action, new customer/tenant, expired selection or competing reservation cannot silently create a new appointment or choose another employee.

Inactive service appointments can reschedule with their frozen service and still-qualified active original employee, per the owner's RC-1 clarification. Inactive/unqualified employees or missing trustworthy snapshots route to Needs Attention; cancellation does not require an active employee/service. New bookings retain approved random allocation. No real Calendar/Meta adapter is supplied: provider identity, reconciliation, duplicate-event limitations and exact live delete/move remain external-integration gates.

Owner **Citas** has a date-grouped calendar, OFF-default cancelled toggle, grey Cancelada entries at their last booked time and an always-available history list. Detailed history shows prior/current times, request/applied timestamps and Cliente (WhatsApp) origin; current moved appointments are Confirmada. These are the existing local owner's authenticated views, not employee accounts or notifications. The chat's pending/uncertain banner derives from durable state; it is not an extra external send that bypasses ordering. Unproven, abandoned CREATE placeholders are not presented as successfully cancelled appointments.

Migration 012 is installed only in fresh isolated fixtures in RC-1. **No upgrade path for the owner's existing profiles is delivered or authorized here.** Starting this source against a profile without 012 refuses with `rc1_fresh_profile_required`. Never run reset/upgrade/book against the accepted SE-1 profile, the original Windows profile or Ana's protected case. Existing source and historical evidence remain available unchanged.

## Fresh Windows walkthrough

Prerequisites: Git, Node 24, Docker Desktop running Linux containers, enough local storage for the pinned PostgreSQL 17.11 image. These commands create synthetic local resources only. Use the exact tested source in the linked evidence README, not an unreviewed newer branch head.

```powershell
$Source = '77ea22b59d1b7022cecb3cf7a007ca14affee9ff'
$Checkout = Join-Path $env:USERPROFILE 'Desktop\NukMiris RC1 Review'
if (Test-Path -LiteralPath $Checkout) { throw 'Choose a NEW checkout directory.' }
git clone --single-branch --branch product/rc1-local-reschedule-cancel https://github.com/vanasperena-ux/nukmiris.git "$Checkout"
if ($LASTEXITCODE -ne 0) { throw 'Clone failed.' }
Set-Location -LiteralPath $Checkout
git checkout --detach $Source
if ($LASTEXITCODE -ne 0 -or (git rev-parse HEAD) -ne $Source) { throw 'Source mismatch.' }
git status --porcelain # Expect empty.
Set-Location vnext
npm.cmd ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Dependency install failed.' }
npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
npm.cmd run check:scope
if ($LASTEXITCODE -ne 0) { throw 'Scope check failed.' }
npm.cmd run test:rc1:runtime
if ($LASTEXITCODE -ne 0) { throw 'Retain the failing output; do not proceed.' }
```

Expected portable TCP result: **2 PASS / 0 FAIL / 0 SKIP** with `rc1Tcp: PASS`, `rc1Unknown: HELD`, PostgreSQL 17.11 / UTC and `nativeWindows: EXECUTED`. The test creates/deletes only its own temporary profiles. Linux core/fault/concurrency tests use a separate Unix-socket harness; do not use them as native Windows acceptance. Codex's evidence is Linux-only.

Create the browser profile in this NEW checkout. `--port 0` and `--db-port 0` choose an available supported low loopback port using the accepted Windows reserved-port safeguards. There is no fallback to a different port after an explicit collision. Keep the private URL/token local.

```powershell
$Profile = Join-Path $Checkout '.rc1-browser-profile'
if (Test-Path -LiteralPath $Profile) { throw 'Use a NEW RC1 profile, never an existing owner profile.' }
node local/cli.mjs book --state-dir "$Profile" --db-port 0 --port 0
# Open the private URL printed by this command; keep it private.
```

1. Select **Juanita's Nail Salon / Ana**. Enter `reagendar`, then `cancelar`: there are no upcoming appointments and no mutation. Enter `menu`: exactly the existing three options; no management picker yet.
2. Enter `cita`, select one offered time. It books directly. Note service, employee and time. Enter `reagendar`: select the exact appointment even though only one exists. See two replacement suggestions, use **Más opciones** and date selection as desired. Select a replacement directly. The success shows **Antes / Ahora**, same service and employee; the fake calendar has one updated event, not a second booking.
3. Open **Administrar servicios, empleados y citas** (`/owner`) from the chat. In **Citas**, see **Confirmada**. **Ver historial** shows creation and move, old/new time, Cliente (WhatsApp), request and completion timestamps. `Mostrar citas canceladas` starts OFF.
4. Return to chat. Enter `cancelar`, select the exact appointment. No extra confirmation. Success names the cancelled service/time/employee. The fake event disappears. Owner calendar hides the entry by default; enabling the toggle shows grey **Cancelada** at its last booked time. **Historial de citas** retains it regardless of toggle.
5. Book a second and third appointment on distinct days; `reagendar`/`cancelar` must let you select exactly which one. For many appointments, create at least four and use **Más citas / Citas anteriores**. Ordinary `menu` and `cita` summaries retain the approved trigger behavior; pickers appear only inside management.
6. Switch to a new synthetic customer and book after entering their name, then manage that appointment. Switch to **Bernard's Grooming Salon**: Juanita's appointments/history must not appear. Do not use any real names or provider accounts.
7. In owner **Empleados**, removing the assigned employee's service qualification must prevent rescheduling with another employee and show a safe assistance response. Cancellation remains available. Existing appointments for deactivated services can move with frozen service details and the original qualified employee. Use only these disposable profiles.
8. Optional uncertainty check: book, open reschedule suggestions, set the fake-provider failure to **BEFORE_APPLY**, then select a slot. Expect verification/Needs Attention, no success and no original-slot release. Stop/restart the disposable profile: it stays held, without a blind retry. Do not use the UI failure setting to infer or clear an outcome. Use a second NEW RC1 profile for more successful tests if needed.

Stop/restart only this test profile:

```powershell
node local/cli.mjs stop --state-dir "$Profile"
node local/cli.mjs start --state-dir "$Profile" --port 0
# Reopen the newly printed private URL. Proven history and held work persist.
node local/cli.mjs stop --state-dir "$Profile"
node local/cli.mjs backup --state-dir "$Profile"
# Keep the private SQL/archive/ledger backup local; restore stays inert.
```

Report exact source, Node/PostgreSQL versions, command output and functional observations. On a failure, retain the output and state; do not reset a held case or point these commands at protected data. Do not share tokens, local custody keys or raw private profile backups. An optional automated actual-browser check is `npm.cmd run test:rc1:browser -- "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"` (substitute the actual browser executable). It uses a disposable fixture, no real provider.

Stop at owner functional acceptance and focused independent review. No merge, profile upgrade, cloud, registry, real integration or new product scope follows automatically.
