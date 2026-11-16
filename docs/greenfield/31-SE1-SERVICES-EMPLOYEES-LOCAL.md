# SE-1: configure and book one service locally

Owner-approved slice: [Issue7 assessment](https://github.com/vanasperena-ux/nukmiris/issues/7#issuecomment-6902954212), followed by explicit SE-1 implementation approval and the owner's clarification to add approved random employee allocation. Base executable: `b4d0be0cb98c7f2b69be318e18b93f4de102c511`. This branch contains no experimental `platform-proof/` code. Exact tested successor and results are in `vnext/evidence/se1/README.md` when published.

Services, employees/qualifications and weekly hours are persisted in PostgreSQL. The existing private local fixture authentication opens a Spanish owner interface at `/owner`. It intentionally authorizes the test operator to switch between both synthetic businesses; business-bound signed owner sessions, distinct from customer sessions, constrain each API request. This is not commercial account registration or onboarding. No new provider, framework or infrastructure component is introduced.

Each appointment has exactly one service (Decision147). Duration and buffer are standard per service (Decision139); employee-specific duration overrides are absent. The selected time is assigned randomly among qualified, active employees available for that exact interval. The independent booking-intent receipt records the selected employee once; retries/crashes reuse it. There is no new customer-facing employee preference selector or returning-customer preference feature. Solo operation retains its default resource without requiring employee setup.

A catalog revision and new booking preparation serialize in PostgreSQL. An earlier owner edit invalidates a stale offer/plan and returns choose-again; an already committed plan retains its identity and snapshot. New appointments retain service name/description, duration, buffer, informational price/currency and employee name. Later edits/inactivation do not rewrite appointments, protections, uncertain operations or snapshots. Service/employee removal is inactivation, not destructive deletion. Unknown outcomes are still resolved only from evidence, never resubmitted blindly.

## Windows: fresh isolated checkout/profile

Use Node24, npm, Git and Docker Desktop in Linux-container mode. Local evidence uses Node24.22.3 and PostgreSQL17.11. Native Windows execution of SE-1 is pending the owner's run; earlier baseline acceptance is separate. Keep your original checkout, `.local-demo`, Ana's protected case and capacity fixture untouched.

Use the exact tested source in the PR/evidence, not a moving branch head. In ordinary PowerShell:

```powershell
$Source = '540fc4af57a29eba380c0f53df0bf3ad12093ad7'
$Checkout = Join-Path $env:USERPROFILE 'Desktop\NukMiris SE1 Acceptance'
if (Test-Path -LiteralPath $Checkout) { throw 'Choose a new checkout directory.' }
git clone --single-branch --branch product/services-employees-local-owner https://github.com/vanasperena-ux/nukmiris.git $Checkout
Set-Location -LiteralPath $Checkout
git checkout --detach $Source
Set-Location -LiteralPath (Join-Path $Checkout 'vnext')
node --version
npm.cmd ci --ignore-scripts
npm.cmd run build
$Profile = Join-Path $Checkout 'vnext\nukmiris-vnext-services-employees'
if (Test-Path -LiteralPath $Profile) { throw 'First setup requires a NEW profile. Do not reset an existing profile.' }
node local/cli.mjs book --state-dir "$Profile" --db-port 15462 --port 3107
```

Both ports are below49152. If a port is occupied or reserved, stop and choose unused supported ports; the runtime does not fall back. Direct Node invocation preserves the existing Windows path-with-spaces workaround. Do not use the default profile or run an upgrade against the owner's accepted installation. SE-1 requires a fresh profile with migration010; an older profile is rejected before the booking worker starts.

Open the private URL printed by the command, then click **Administrar servicios, empleados y citas**. Keep the same browser so the existing local authentication cookie is reused. The owner page has Servicios / Empleados / Citas; its link opens the synthetic conversation. No real accounts are connected.

## Owner acceptance: Juanita

1. In **Servicios**, edit **Cita general**, clear Activo and save. Create **Manicura**, description of your choice,30-minute duration,10-minute buffer,250.25 MXN, active. Create **Pedicura**,60-minute duration,15-minute buffer,350.00 MXN, active. Prices are display fields; no charge occurs.
2. In **Empleados**, edit Lucía: active, qualified for Manicura only; set weekly hours inside the business's existing09:00–17:00 Monday–Saturday hours. Edit Sofía: active, qualified for Pedicura only. A day with no intervals is unavailable; multiple non-overlapping intervals support split hours. These hours are interpreted in the business timezone.
3. Optional create-path check: create Carolina, assign Manicura and add weekly intervals. You can inactivate her after this check to make the following assignment predictable. No employee account/invitation is created.
4. Open the conversation and select Juanita / Ana (known synthetic customer). Send `cita`. Select Manicura, then one of the two proposed times. Expect direct confirmation and an eligible employee; no extra confirmation click. More options and date selection remain available.
5. Return to **Citas**. Check Manicura, customer Ana Ejemplo, correct employee,30-minute duration,10-minute buffer,250.25 MXN and Confirmada. The synthetic calendar and detail panel show the same service/employee.
6. Select a new-customer persona in chat. Request Pedicura, choose a time, then give a valid name such as `María Fernández`. Name is requested after slot selection. Expect an eligible employee and60+15 minutes. Use a separate persona for this second booking; existing same-customer overlap policy is unchanged.
7. Edit Manicura's price/name/duration or inactivate it. The existing appointment's details must remain unchanged. New booking options use current active services and qualifications. An old displayed choice after an edit must return choose-again rather than confirm stale settings.
8. To observe team capacity/random allocation, qualify both active employees for Manicura. New bookings may use either eligible employee; repeated submission of the same request must never reroll or create another booking. Automated tests independently cover both candidates, the crash boundary and concurrent remaining capacity; a few browser samples do not statistically prove randomness.

## Bernard and persistence

1. Switch the owner page to Bernard. Juanita's services, employees and appointments must not appear. Changes to Bernard must not modify Juanita. Configure a different service/employee if desired and book it through Bernard's own synthetic conversation.
2. Stop and restart only this new profile:

```powershell
node local/cli.mjs stop --state-dir "$Profile"
node local/cli.mjs start --state-dir "$Profile" --port 3107
```

Reopen the printed private URL. Verify saved services, qualifications/hours, appointments and histories persist. The owner **Citas → Actualizar** button reloads appointments. Refresh the owner page to reload catalog changes made in another window. A stale concurrent save gets a conflict; close its form, review current values and edit again.

3. Optional isolated automated checks:

```powershell
npm.cmd run test:services
npm.cmd run test:services:runtime
npm.cmd run test:services:browser -- "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
```

Adjust Edge's path if necessary. The browser command creates its own temporary browser/profile and uses local synthetic data only. It is separate from this manual profile. `npm.cmd run test:runtime` includes the new owner/API/restart/restore test.

4. Backup retains SQL catalog/settings, snapshots, archive and ledger together using the existing stopped-writer bundle:

```powershell
node local/cli.mjs backup --state-dir "$Profile"
node local/cli.mjs stop --state-dir "$Profile"
```

Keep backup folders private: they contain local synthetic custody keys. Restore remains inert; this feature adds no activation path. Do not reset/delete the accepted original profile or any protected case. End owner acceptance by stopping this SE-1 profile.

## Boundaries and review

Full reschedule/cancel, customer-management UI, staff invitations/accounts, commercial onboarding, business-hours/settings screens, real calendar accounts/providers and payments are outside SE-1. Availability intersects existing business hours, employee hours, qualification, service duration/buffer and protected busy ranges. Existing customer-name ambiguity remains accepted only for synthetic tests; explicit name confirmation remains a separate pre-real-WhatsApp gate.

The selective review target is catalog authorization plus catalog-edit/booking serialization and one-time employee allocation. Routine owner form work does not create another infrastructure review program. PC-1 remains accepted and is not reopened. Keep this PR Draft; no merge, real providers, registry push, cloud provisioning or spending is authorized.
