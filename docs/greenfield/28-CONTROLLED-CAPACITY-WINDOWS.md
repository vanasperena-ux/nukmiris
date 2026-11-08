# Controlled capacity browser test — Windows

This is the isolated **NM-040 / NM-042 / owner Test17C** fixture requested in
[PR16 comment6725118485](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6725118485).
Use exact source **`7f35b2f0f1fc251ac90fdb9c0796782dc20d60c2`** in a fresh checkout.
It adds a disposable fixture and local-only viewer, not booking logic or migrations.
Your existing Windows profile, Ana's UNKNOWN and accidental synthetic appointment
must stay as they are. **Do not run demo:upgrade, demo:reset, demo:book or any command
against your existing `.local-demo` for this test.** No global environment upgrade
is needed. All PRs remain Draft/unmerged; no real providers or cloud.

The owner reports the preceding source passed45/45 native runtime tests,008+009
upgrade and persistence/Ana checks. That is separate from the new fixture's Codex
Linux evidence. **This owner browser scenario is still PENDING.**

## 1. Fresh checkout and fixture setup

Open PowerShell. Docker Desktop must be running with Linux containers; use your
existing Node24/npm/git. Choose a NEW checkout directory (if it already exists,
choose another name; do not delete or reuse your current installation).

```powershell
$CapacitySource = '7f35b2f0f1fc251ac90fdb9c0796782dc20d60c2'
$CapacityCheckout = Join-Path $HOME 'NukMiris Capacity Test'
git clone --no-checkout https://github.com/vanasperena-ux/nukmiris.git "$CapacityCheckout"
Set-Location "$CapacityCheckout"
git checkout --detach $CapacitySource
git rev-parse HEAD
Set-Location vnext
npm.cmd ci --ignore-scripts
npm.cmd run typecheck
npm.cmd run check:scope
$CapacityDir = Join-Path (Get-Location).Path 'nukmiris-vnext-capacity-owner'
npm.cmd run capacity:prepare -- --state-dir "$CapacityDir" --db-port 15442 --port 3087
npm.cmd run capacity:start -- --state-dir "$CapacityDir"
```

`git rev-parse HEAD` must equal the source above. Stop if any command fails.
First pinned PostgreSQL17.11 image pull has a10-minute budget. `prepare` creates
the database/configuration but leaves the app stopped; `start` prints a private URL.
Open that **new URL** in your browser. Do not share its `#...` authentication token.

The page must say **“Prueba AISLADA · 4 clientes / 2 empleados”**. Verify:

- Directory ends in `nukmiris-vnext-capacity-owner` in the NEW checkout; not `.local-demo`.
- New instance and `nukmiris_vnext_<new-instance>` database; they differ from the
  existing installation. No existing data is imported or copied.
- Database15442, browser3087 and a third, separately allocated command port below49152.
  Usual owner ports15432/3077/3000 are refused by this fixture. Existing resources
  are never stopped to claim a port; no fallback is attempted.
- Business **CAPACIDAD · Negocio A**, four distinct named customer subjects and
  two employees qualified for `implicit-p0`. Both have identical opening hours and
  no absences; no appointments or other blockers exist initially.
- Displayed future open date, **09:00–10:00 America/Mexico_City**, buffer ending
  **10:15**. ISO timestamps may say15:00–16:00Z/16:15Z; those are the same instants.

Each fresh/reset fixture chooses tomorrow, or Monday if tomorrow is Sunday. Only
that weekday has09:00–17:00 hours. The day is generated at setup, not hard-coded to
the sample screenshot date. Reloj REAL_DATABASE_TIME means actual database time,
not a frozen clock. Complete the main steps within the offer's15-minute expiry.
If it expires, reset ONLY this fixture and repeat; expiration rejection alone
does not prove the intended capacity conflict.

If a port is occupied/reserved, leave the existing installation alone. On Windows
inspect `netsh interface ipv4 show excludedportrange protocol=tcp`. Explicitly
choose different available ports below49152 and a NEW fixture directory, e.g.
`nukmiris-vnext-capacity-owner-2`, during `capacity:prepare`. Never remove a port
restriction or silently fall back. Start/stop thereafter use the stored ports.

Optional automated fresh-fixture checks before manual acceptance:

```powershell
npm.cmd run test:runtime
npm.cmd run test:capacity
```

The normal runtime suite has45 cases (native ACL/sync should execute on Windows,
no native skips). Capacity has4 tests covering isolation, real stale submission/
crash/replay, near-simultaneous requests and actual CLI lifecycle with spaces and
Unicode paths. These create/clean their own temporary fixtures, not `$CapacityDir`
or your existing installation. Record actual Windows results separately.

## 2. Browser walkthrough

Stay in **Negocio A** until step8. Leave Customer3 alone until step6. Four customers
are pre-identified to isolate capacity from name collection; this does not claim
that the separate residual C1 name problem is fixed.

1. In **Cliente4**, click **Pedir horarios** FIRST. Two normal suggestions should
   include the chosen09:00 start. Do not select it yet. The “Selección original”
   panel records the actual server-issued action ID, reply ID, revision, expiry,
   slot/resource and snapshot. Save a screenshot. No IDs are invented or edited.
   Customer1/2 request controls stay disabled until this original offer exists.
2. In **Cliente1**, click **Pedir horarios**, then the09:00 suggestion. Expect the
   direct **“Tu cita está confirmada…”** reply with one employee. No extra
   confirmation click or name is needed for this known customer.
3. In **Cliente2**, request slots and choose the SAME09:00 start. Expect confirmation
   with the OTHER qualified employee. Verify two calendar rows at09:00–10:00,
   each with15-minute buffer; Lucía/Sofía order may vary with allocated IDs.
4. Before touching Customer4, take a screenshot of both confirmations/calendar
   and its saved original offer. Its original button may still be clickable;
   that is intentional. The backend—not greying—is the authority.
5. Click **Enviar selección original de Cliente4**. This test-only browser control
   posts the original displayed ID through the SAME authenticated
   `POST /api/message` → `InteractiveBooking.submit` handler as ordinary synthetic
   interactive replies. No revision/expiry/consumption/capacity validation is bypassed.
   Expect **“Ese horario ya no está disponible… No se confirmó. Elige un horario
   de nuevo.”** with fresh alternatives. There must be no third booking or success
   confirmation for Customer4. Capture the screen and backend checks below.
6. In **Cliente3**, click **Pedir horarios**. The09:00 slot must be absent. With
   the30-minute grid, first alternatives are **10:30** and11:00: protection is
   `[09:00,10:15)`, so09:30/10:00 overlap;10:15 is off-grid. Do not book a later
   alternative until you have saved the clean two-booking counts.
7. Click the saved selection control again. Restart ONLY this fixture using the
   commands below, reopen the new private URL, then submit it once more. Action/
   reply/revision/expiry remain original, no new booking/attempt appears, and
   newer input IDs safely report stale/used choice. Exact request-ID replay is
   also exercised automatically; no booking/provider identity is reallocated.
8. Optional isolation/positive controls after saving evidence: switch to
   **CONTROL AISLADO · Negocio B**. Its calendar is empty and Cliente3 can obtain
   its own09:00 availability. Return to A: the two target bookings are unchanged.
   Cliente3 in A may book its legitimate10:30 alternative; this increases global
   counts, but target09:00 capacity stays two and Customer4 stays unbooked.

Expected screens from the automated Linux walkthrough (illustrative dates/IDs,
**not your Windows acceptance**):

- [1 Original real Customer4 offer](../../vnext/evidence/pr16-capacity/01-original-offer.png)
- [2 Both employees booked; old button still clickable](../../vnext/evidence/pr16-capacity/02-full-capacity.png)
- [3 Stale selection rejected; Customer4 has no booking](../../vnext/evidence/pr16-capacity/03-stale-rejected.png)
- [4 Fresh legitimate alternatives after restart](../../vnext/evidence/pr16-capacity/04-fresh-alternatives.png)

## 3. Authoritative checks and evidence to record

The lower panel is computed from a repeatable-read, read-only transaction using
the authenticated tenant's reducer role/RLS. It is not a frontend counter.
“Estado completo” includes the fixture identity, schedule/configuration, employees/
qualifications, four subjects, actual appointments/calendar/protection ranges,
attempt states, original action and processed stale inputs. It omits credentials,
archives/keys/backups and private URLs. CLI equivalent:

```powershell
npm.cmd run capacity:status -- --state-dir "$CapacityDir"
```

After steps1–6, before any positive-control extra bookings:

| Backend fact | Expected |
|---|---:|
|ACTIVE appointments at target / distinct qualified employees / calendar rows |2 /2 /2 |
|Total appointments / operations / booking intents in A |2 /2 /2 |
|Attempts in A (2 booking +2 confirmation), all VERIFIED_APPLIED |4 |
|CORE ledger rows (booking +confirmation effects) |4 |
|Persistent reservation protections / transient mutation guards |2 /0 |
|Pending attempts / pending inputs once settled |0 /0 |
|Customer4 appointments, booking/confirmation attempts, intents, protections, CORE ledger |ALL0 |

Each reservation range must be exactly `[09:00,10:15)`, attached to the matching
employee/appointment. Successful bookings retain these2 protections; do not clear
them. All displayed `checks` become true after the first stale submission,
including exactProtectionRanges/staleProcessed/noFalseConfirmation. Replays add
processed input/reply records, never booking effects. Regular chat replies also
have REPLY ledger rows, separate from the4 CORE rows above.

Record source SHA, native Node/PG versions, displayed fixture instance/ports/day,
the four expected screenshots, table/counts and restart/replay results. Do not
post private URLs, state.json, dumps, archives, keys or backups. Report failures
with which step, actual message and safe counters. **Only your independent run
can mark owner Test17C passed.** Codex automation remains separate evidence.

## 4. Stop, resume or reset ONLY this disposable fixture

Keep `$CapacityDir` pointing at the NEW fixture folder. Commands reject
`.local-demo`, nested paths beneath it, unmarked profiles and symlinked paths.

```powershell
npm.cmd run capacity:stop -- --state-dir "$CapacityDir"
npm.cmd run capacity:start -- --state-dir "$CapacityDir"
```

Use the newly printed private URL after start. For a clean repeat, reset requires
the exact fixture instance. This creates/verifies a private coherent backup,
retains old fixture state/custody under `previous-<old-id>`, creates NEW instance/
database/identities and leaves the application STOPPED. It never selects an owner
profile. Do not delete or activate its retained backups/restores.

```powershell
$CapacityInstance = (Get-Content -LiteralPath (Join-Path $CapacityDir 'state.json') -Raw | ConvertFrom-Json).id
npm.cmd run capacity:reset -- --state-dir "$CapacityDir" --confirm "$CapacityInstance"
npm.cmd run capacity:start -- --state-dir "$CapacityDir"
```

Re-check the NEW identity and empty calendar, then begin with Customer4 again.
When finished, stop the fixture. All its data/resources remain separately named;
no cleanup command targets `.local-demo` or the existing protected appointments.

## Remaining scope and gates

No production booking logic, src/, SQL migrations, name validation or ordinary
support summary behavior changes. **NM-045** and residual **C1/NM-009/032** remain
the next separate correction scope, not fixed here. No operator reset of Ana,
blind retry, ordering bypass, staff inbox or production activation. Local owner
authorization remains business-scoped; it is not production staff custody.
Keep PR16 Draft/unmerged and all archive/witness/repair/provider/OPS01 gates.

Current acceptance reference: **Feature Register v1.4 at
10d5181720a04492cb837ac8abc869c78de81359**, read in full;
[immutable reference copy](references/FEATURE_REGISTER_v1.4_10d5181.md). Owner
Step8 (NM-045) and Step12B (C1 accidental booking) remain next-scope failures;
Step9 Menu exit is owner-verified synthetic UI behavior only, not queue custody.
