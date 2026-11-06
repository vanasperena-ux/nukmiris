# L2 interactive booking — Windows local walkthrough

This increment implements the first browser booking application with synthetic
WhatsApp conversations and a fake calendar. It builds on independently accepted
[PR12 W1–W6](https://github.com/vanasperena-ux/nukmiris/pull/12#issuecomment-6671645023)
and [PR14 R1/L1-C1–C6](https://github.com/vanasperena-ux/nukmiris/pull/14#issuecomment-6671645331).
All PRs stay Draft/unmerged. This new code needs independent Claude review and
owner-device acceptance. Codex's execution is Linux; native L2 Windows is NOT RUN.
The owner's original PR12 native run found W9 (24 PASS/5 FAIL), with ACL/TCP/UTC
checks passing. This branch includes the writable-handle W9 correction from source
a61e65f; its independent/native re-verification remains a gate, tracked in
[PR12 handoff14](https://github.com/vanasperena-ux/nukmiris/pull/12#issuecomment-6672882540).

## Start a fresh, separate copy

Use a new checkout of this PR, Node24.x/npm11 and Docker Desktop running Linux
containers. Keep the accepted v0.8.1 folder, data, ports and credentials separate.
The default vNext database port is now **15432**, browser **3077**, and command
guard is a probed port in **20000–39999**. No persistent port uses the Windows
dynamic range49152–65535. The pinned PostgreSQL17.11 image is explicitly pulled
and digest-verified; its first download has a ten-minute budget.

From PowerShell in the checkout's vnext directory:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run typecheck
npm.cmd run check:scope
npm.cmd run test:runtime
npm.cmd run demo:book
```

Open the private `http://127.0.0.1:3077/#…` URL printed by demo:book. The fragment
exchanges for an HttpOnly/SameSite cookie and is removed from the address bar.
Do not share the URL. All browser/API listeners bind127.0.0.1, check Host, require
same-origin POSTs and reject foreign actions. Signed local sessions bind the
selected synthetic tenant/customer. No Meta/Google sign-in, credentials or network
integration is involved. CSP permits only this loopback origin.

demo:book explicitly bootstraps/activates the **synthetic** local composition. It
does not enable production providers. It starts RecoveryWorker and ordered-effect/
reply processing. Earlier demo:prepare profiles stay health-only until demo:book;
profiles without migration007 must be replaced with a fresh candidate folder.
Old/incompatible archives are never silently reused or upgraded (A2/011).

## Exercise the customer journey

1. Choose Juanita’s Nail Salon and Ana (known customer). Type **menu** or **cita**.
   There are two suggested appointments and More options. Select a time: booking
   happens directly, without another confirmation click. The reply states the
   confirmed time and assigned employee; the fake-calendar panel updates.
2. Choose Cliente nuevo. Type cita, choose a time, then provide a name. There is
   no reservation before name capture. Invalid names retain the prompt; accepted
   validation matches v0.8.1. Once the name is valid, revalidation/reservation and
   confirmation occur automatically. One service per appointment; no staff picker.
3. More options shows two more suggestions, then date selection. Date navigation
   uses a WhatsApp-compatible list (up to five items), never more than three reply
   buttons. Try mañana, próximo lunes,13 oct or13/10. The accepted date grammar is
   ported locally; the running app never imports v0.8.1. Typed dates select times
   without an additional date-confirmation step.
4. Select another customer/window to compete for a slot. Current calendar facts,
   SQL protections and buffers participate in revalidation. A qualified free
   employee can take the same time. A conflict/timeout tells the customer to choose
   again and offers fresh options; the rejected sealed plan is never retried.
5. Write **humano**: ordinary input stays in human support until Menu. Write Menu
   during pending work: never-entered work can end safely; entered/UNKNOWN work
   stays protected. A next reply states any ACTIVE booking after its confirmation
   safely expired or was superseded. Expired/consumed/foreign actions cannot book.
6. The failure selector affects only that tenant's fake effects. Lost response
   after apply is reconciled read-only from the ledger. Before-apply failure with
   no proof stays UNKNOWN/protected and is visible in Needs Attention. There is no
   resend/release button or elapsed-time inference. Diagnostic facts are retained.

The calendar panel is an owner-oriented synthetic business view; chat data and
actions remain customer-bound. Bernard's tenant has separate chats/calendar/data.
These are fixture names and calendars, not real businesses/accounts.

## Lifecycle and W8 port recovery

```powershell
npm.cmd run demo:stop
npm.cmd run demo:start
npm.cmd run demo:book
npm.cmd run demo:backup
npm.cmd run demo:start
```

start/book prints the private URL again, including when already running. stop
drains the app/recovery tasks and closes SQL/archive handles before the database.
A crash/reboot releases only the CLI's OS guard; stale metadata is reconciled
without PID killing or age-based takeover. ARMED work from a lost owner is not
resubmitted; never-entered work expires through RecoveryWorker. Entered work is
reconciled read-only against the same fake ledger and original identities.

If Windows denies a persisted guard port, **CLI_GUARD_PORT_RESERVED** identifies
EACCES, rather than claiming another command is running:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
npm.cmd run demo:unlock -- --confirm <instance-id> --command-port 28471
```

Choose an available port below49152, distinct from DB/browser ports. This explicit
confirmed relocation holds both guards when possible; it can recover EACCES but
refuses a live occupied command guard. It changes only CLI metadata, never archive
custody or provider permits. Legacy empty/corrupt lock recovery without the port
option remains supported. Docker bind-forbidden diagnostics identify a port problem
and preserve TLS; there is no silent alternate bind. Old55432 profiles are not used
for the persistent L2 demo: create a fresh separate low-port candidate.

## Coherent private backup and inert restore

demo:backup stops the app writer, authenticates/checkpoints archive+witness, and
captures one SQL dump (including conversation/actions, calendar and append-only
fake ledger) plus archive, witness, custody keys and configuration. It returns a
private directory and manifestSha256. Record the hash separately. SQL and all
custody files must remain together; missing/corrupt components fail closed.
The manifest lists exact files, sizes/digests and scope. No partial bundle is valid.

```powershell
npm.cmd run demo:restore -- --backup "<backup-directory>" --sha256 <manifestSha256> --state-dir "C:\NukMiris-local\nukmiris-vnext-restored" --db-port 15433
```

The destination must be fresh; restoration never overwrites the source profile.
It verifies the externally supplied manifest hash and every component, restores
into isolated new SQL resources, authenticates archive identity and leaves all
businesses SUSPENDED/dispatch disabled with advanced recovery epochs. Restored
profiles are marked inert **before restoration** and cannot start/book automatically.
There is deliberately no activation command for restored state in this increment.
This proves coherent synthetic restoration; it is not production restore/custody
gate closure. Backups contain private custody keys and synthetic data: do not
upload them, state.json, worker logs, databases or .local-demo contents to GitHub.

demo:reset -- --confirm <instance-id> first backs up, then creates a new inert
identity, retaining previous private custody/configuration. No active unknown
attempt is retried or reassigned to the new identity. Explicit reset is fixture
replacement, not a reconciliation decision. Run demo:book to use that fresh fixture.

## Implemented safety conditions and verification

- C1: RecoveryWorker starts/stops with the local app; silent never-entered deadlines
  clear without new customer input. Worker/dispatch/custody errors surface in Needs
  Attention. No time-based release of entered/UNKNOWN work.
- C2: persisted displayed UUIDs, revision/expiry and consumed_by are checked under
  DB time and the conversation lock in the consuming transaction. Intent/reservation
  recheck expiry and later sealed Menu/human priority. Restart uses original seal
  keys/IDs; no dummy appointment is used for navigation replies.
- C3: expired/superseded confirmation retains the ACTIVE appointment and includes it
  in the next reply. Uncertain earlier output blocks later reply entry until proof
  reconciles, preserving customer order.
- C4: SLOT_UNAVAILABLE, SQL RESOURCE_CONFLICT and LOCK_TIMEOUT all re-offer with
  informative choose-again copy. Invalid plans/custody failures stay held as errors.
- W8: all allocated/default ports below49152; EACCES guidance, bind-error mapping
  and confirmed guard relocation; no lock stealing or port fallback.

Reproduce: npm run test:l2, npm test, test:fault, test:concurrency, test:runtime,
typecheck and check:scope. Unix-socket/fault suites require Linux/WSL; test:runtime
uses portable TCP/process controls and includes native ACL checks. Optional actual
browser proof: npm run test:browser -- <Chromium-or-Edge-executable>. It drives both
flows with CDP, verifies the calendar and tenant selector, and uses only loopback.
Exact tested source, measured environments, plain logs and hashes are published
with this PR's evidence and Claude handoff; suites overlap.

Limitations remain: first booking workflow only; no move/cancel/admin catalog UI,
real WhatsApp/Calendar contracts, production credentials, multi-worker operation or
cloud deployment. Single-calendar composition retains C5 shared-resource-offer
limitations; conservative DST D1 and Windows/N6 performance remain. Local admin/
same-host custody W7/O5 and human-support O6 boundaries remain. X1 witness monotonic
size/epoch still does not independently prove record-chain AND index extension.
Preserve X1/F13,009/011/production017,N2/N3,A2/A3,013/016 and OPS01 gates. Owner/native
Windows and independent L2 acceptance are outstanding. No PR merge, v0.8.1 change,
real Meta/Google, GCP, production activation or cutover.
