# RC-1 customer-overlap correction

Authority: owner's RC-1 follow-up on Draft [PR #27](https://github.com/vanasperena-ux/nukmiris/pull/27). The owner observed a second 09:00 offer after Cliente nuevo had booked 09:00–10:00 with Lucía on November 17, 2026. Source `77ea22b59d1b7022cecb3cf7a007ca14affee9ff`; prior evidence/docs head `4d61f52ba89f288d195bd48057f1b2dcf061046b`. Claude's [GO for local acceptance](https://github.com/vanasperena-ux/nukmiris/pull/27#issuecomment-6925363476) applies to that earlier source; it is not independent acceptance of this correction.

## Confirmed rule and cause

`core.prepare_operation`, migration 007 lines 330–354, locks the scoped customer and rejects CREATE/MOVE when **any protection for another appointment of that same customer in that business** overlaps `[candidate start, candidate end + candidate buffer)`. The customer check has **no calendar, employee or appointment-state filter**. Protections are the authority: confirmed ACTIVE appointments retain them; PREPARED/ARMED/entered/UNKNOWN work retains its ranges; an unresolved MOVE retains old and proposed ranges; a pending CANCEL retains its source. Proven finalization or safe never-entered abandonment changes/releases the protections. A state label or elapsed deadline alone never proves release. The current MOVE source appointment alone is excluded from this customer check.

Both buffers matter. A 09:00–10:00 booking with a 15-minute buffer blocks starts before **10:15**. A candidate ending at 09:00 whose own buffer extends beyond 09:00 also conflicts. Exact half-open boundaries are allowed; on a 30-minute grid, the first post-booking start is 10:30. No buffer is added twice.

`InteractiveBooking.reader` previously supplied only business/calendar context to `protectedCalendar`. That reader projected protections as employee-specific busy events. The oracle saw Sofía as free, although SQL already prohibited the same customer's overlapping booking. This is a genuine invalid offer when the protection predates the search. A later change after observation is a stale offer; final revalidation and the serialized SQL check remain necessary. An unrelated customer's reservation on another qualified employee is legitimate capacity, not a customer conflict.

Register **v1.4 at `59cde023d2dff088161c1d01bd76c1099386e13f`** marks broader NM-038 policy/exception handling open. The owner's present instruction explicitly authorizes this bounded alignment with the existing SQL rule; no exception, commercial policy or SQL change is introduced.

## Small correction

Only three production TypeScript files change. The shared reader gets the **server claim's customer subject**, joins the business-scoped customer and projects that customer's protection ranges as busy for every employee. It also reads that customer's protections on other calendars, matching SQL. Other customers' busy periods remain resource-specific. The composition helper resolves its scoped customer before its final read; new-customer name capture uses the same subject, so a newly persisted customer is visible on recheck.

Initial offers, more/time pagination and date choices use this customer-filtered reader. Navigation refreshes the current search rather than republishing stale cached candidates; slot/name/employee-allocation rechecks and rescheduling use the same reader. An observation can still become stale after it is displayed. It does not reserve availability; the selection recheck and SQL customer/resource locks still reject a racing conflict. Historical sealed views/replays are not rewritten. Rescheduling still excludes only the selected source event/protection, refuses a held source and retains all other appointments. Random employee allocation, service 139/147 rules, snapshots, SQL, migrations, dispatch/custody and recovery mechanisms are unchanged.

[New evidence, exact source and results](../../vnext/evidence/rc1-overlap/README.md). The new regression fixture reproduces the exact November 17 / Mexico City / Lucía example, plus partial/buffer boundaries, different customers, navigation, reschedule, two race schedules, all protected attempt states, release, cross-calendar/tenant isolation and restart/replay. A portable TCP test covers the formerly new customer, another customer at the same time, restart and another business. Native Windows execution of this correction is **not performed by Codex**.

## Short native Windows retest — fresh profile only

Keep the existing Windows test profile and Ana's protected case untouched. Requires Git, Node 24 and Docker Desktop in Linux-container mode. Read the final tested SHA from the evidence README linked above; this guide's publication may be a documentation-only successor.

```powershell
$Source = '47f485b691c62dc8968ad2aec7cf6f05aaf7df93'
$Checkout = Join-Path $env:USERPROFILE 'Desktop\NukMiris RC1 Overlap Retest'
if (Test-Path -LiteralPath $Checkout) { throw 'Choose a NEW checkout directory.' }
git clone --single-branch --branch product/rc1-local-reschedule-cancel https://github.com/vanasperena-ux/nukmiris.git "$Checkout"
if ($LASTEXITCODE -ne 0) { throw 'Clone failed.' }
Set-Location -LiteralPath $Checkout
git checkout --detach $Source
if ($LASTEXITCODE -ne 0 -or (git rev-parse HEAD) -ne $Source) { throw 'Source mismatch.' }
Set-Location vnext
npm.cmd ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Install failed.' }
npm.cmd run test:rc1:runtime
if ($LASTEXITCODE -ne 0) { throw 'Retain output and stop.' }
# Expect 3 PASS / 0 FAIL / 0 SKIP and rc1CustomerOverlap: PASS,
# with nativeWindows: EXECUTED, measured PostgreSQL 17.11 and UTC.
$Profile = Join-Path $Checkout '.rc1-overlap-profile'
if (Test-Path -LiteralPath $Profile) { throw 'Use a NEW profile.' }
node local/cli.mjs book --state-dir "$Profile" --db-port 0 --port 0
```

Open only the private URL printed by the last command; keep its token local.

1. Juanita's Nail Salon → **Cliente nuevo**. Enter `cita`, then select a future open weekday by typing its date (e.g. `17 nov 2026` only while that date is still in the future). Select 09:00 and enter a synthetic valid name. Note the assigned employee; either employee is permitted by the unchanged allocation rule.
2. Enter `cita` again and the same date. With the default 60-minute service / 15-minute buffer, **09:00, 09:30 and 10:00 must not be offered to that customer**. The earliest possible grid start is 10:30, subject to other availability. Check Más opciones/Más horarios and date selection.
3. Switch to **Ana · clienta conocida** in this NEW disposable profile. Request the same date. The other employee's 09:00 capacity should remain available; book it. Confirm two different customers at the same time with different employees.
4. Switch back to the first customer; enter `reagendar`, explicitly select their appointment, and inspect replacements. A shift overlapping the source appointment itself can be valid; other appointments of this same customer must remain blocking. The original employee remains assigned. Create another non-overlapping appointment on another day to check that second appointment is not ignored while moving the first.
5. Stop/restart this disposable profile with the commands below, reopen its newly printed private URL and repeat the first customer's `cita`/date check. Check Bernard's Grooming Salon: Juanita's appointments must not appear or block Bernard's availability.

```powershell
node local/cli.mjs stop --state-dir "$Profile"
node local/cli.mjs start --state-dir "$Profile" --port 0
# Open the newly printed private URL; after checking:
node local/cli.mjs stop --state-dir "$Profile"
```

Report source, versions, automated output and observed offers. A failure should retain its state/output; do not reset or upgrade an old/held profile to retest. Keep PR #27 Draft; no providers, deployment, cloud, merge or automatic continuation.
