# Windows acceptance — only the three final corrections

Exact source **b4d0be0cb98c7f2b69be318e18b93f4de102c511**. Independent Claude
review/new-source Windows acceptance are not yet claimed. Test17C is already
[owner-accepted](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6728974018)
at7f35b2f and does not need repeating for this walkthrough.

Use a NEW profile. Do not stop/reset/upgrade/repair the owner's `.local-demo`, Ana's
UNKNOWN, accidental booking or original capacity fixture. This source needs no
migration. Existing Node24/Docker Desktop Linux-container setup is sufficient.

1. **Fresh checkout and start.** Choose a new checkout folder if this name exists.
   Direct Node commands avoid the already reported npm Windows path-forwarding
   issue; that unrelated CLI issue is not declared fixed.

   ```powershell
   $FinalSource = 'b4d0be0cb98c7f2b69be318e18b93f4de102c511'
   $FinalCheckout = Join-Path $HOME 'NukMiris Final Acceptance'
   git clone --no-checkout https://github.com/vanasperena-ux/nukmiris.git "$FinalCheckout"
   Set-Location "$FinalCheckout"
   git checkout --detach $FinalSource
   git rev-parse HEAD
   Set-Location vnext
   npm.cmd ci --ignore-scripts
   npm.cmd run build
   $FinalDir = Join-Path (Get-Location).Path 'nukmiris-vnext-final-acceptance'
   node .\local\cli.mjs book --state-dir "$FinalDir" --db-port 15452 --port 3097
   ```

   Stop on errors. Verify the exact SHA and newly printed instance/database/URL.
   Ports15452/3097 differ from the owner15432/3077 and capacity15442/3087; command
   guard uses another low port. An occupied/reserved port fails without fallback;
   do not reclaim another profile's port. Keep private URL/token/state off GitHub.

2. **Prepare two existing appointments in this new profile.** Open its NEW private
   URL; select Juanita and the known synthetic customer (fresh Ana, not the owner's
   protected Ana). `cita` → select a slot. Then `agendar` → Más opciones/Elegir fecha
   → select a NON-overlapping slot at least90minutes later or on another day. Two
   calendar events should be confirmed. This is summary setup, not Test17C.

3. **Check the overview triggers.** Type `menu`, `hola`, `cita`, `agendar`. Each must
   list BOTH upcoming appointments; `cita` and `agendar` then offer the same booking
   flow. From `menu`, select **Agendar una cita**: no repeated overview. Continue
   with Más opciones/Elegir fecha/date choice; type `31 nov`: no overview on these
   responses. Reagendar/cancelar remains honestly unavailable, without an extra
   overview. Do not create an extra booking during this step.

4. **Check NM-045 and persistence.** Type `humano` or choose **Hablar con alguien**:
   only support guidance, no appointment prefix. Send ordinary text: no repeated
   bot reply. Optionally restart ONLY this new fixture below; support remains
   quiet. `menu` exits, shows BOTH appointments and restores the three choices.

   ```powershell
   node .\local\cli.mjs stop --state-dir "$FinalDir"
   node .\local\cli.mjs start --state-dir "$FinalDir" --port 3097
   ```

5. **Check C1 with the new-customer persona.** `cita` → slot → name prompt. Enter
   `hablar con alguien`: human support, no booking/event. Exit with `menu`, then
   `cita` → slot again. Try `quiero cancelar`, `ok gracias`, `María 99` and repeat:
   clarification, no new booking. Empty input is blocked by the form/transport.
   Lowercase ambiguous input also clarifies; enter **María Fernández** or
   **Me llamo maría fernández**: direct booking after revalidation, no extra
   confirmation click, stored name excludes the preamble. Confirmation describes
   ONLY this new appointment. Calendar now has three, old two unchanged.

6. **Record and stop.** Report the source, native versions, these three outcomes
   and any unexpected message/calendar change. Do not repeat the capacity test or
   upload state/keys/backups/private URL. Stop only the new profile:

   ```powershell
   node .\local\cli.mjs stop --state-dir "$FinalDir"
   ```

Optional focused automation: `npm.cmd run test:final-functional` (one actual TCP
HTTP test of the three corrections; its temporary data is isolated). Full runtime
now has46 cases, including the new test; Linux evidence has two native-only skips.
Do not treat old native45/45 acceptance or Linux results as new native execution.

The parser is conservative syntax/intent validation, not a real-name registry.
Some genuine ambiguous names/casing need clarification (`Me llamo Julio`, for example).
An arbitrary proper-name-shaped phrase can be indistinguishable from a name;
universal semantic assurance is not claimed. A new confirmation phase would need
owner approval and is not added. `reservar`/`horarios` retain their previous latest-
only prefix/availability behavior. Services, inbox, onboarding and cloud are out
of scope. PR16 stays Draft; these checks do not by themselves close Milestone A.
