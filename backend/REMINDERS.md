# Appointment reminders and attendance — v0.8.0

**v0.8.0 is the current owner-accepted baseline, confirmed October 26, 2026.** All 648 PC tests passed and the first two-hour reminder was created, previewed and saved as `dry_run`, with no pending jobs or review errors in the supplied status report. See [the acceptance record](BASELINE.md). Live reminder delivery and attendance confirmation remain separate checks. This release adds opt-in appointment reminders and attendance confirmation. It prepares backend data for a future owner dashboard; it adds no dashboard, owner web endpoint or hosting deployment.

The [production compliance review](META_COMPLIANCE_REPORT.md) adds safe Meta TTL validation, auditable customer permission, sender/WABA membership checks, fresh template availability reads and quoted-reply/delivery sequencing protection. Existing v0.8.0 installations must repeat the backed-up preparation command for the additive permission table. Production reminders remain off until explicitly enabled by the owner.

## Agreed scope

The owner selected PC testing first, hosting afterward; a maximum 15-minute sending delay; and enrollment of only appointments booked after reminders are activated. Existing upcoming appointments and manually created Calendar events are not imported. The owner specifically requested backend preparation for the later dashboard.

Keep the existing immediate booking flow and concise success message. Append `Te enviaremos recordatorios antes de tu cita.` only in live reminder mode when that booking has a future pending reminder. Live startup verifies all configured templates first. Dry-run, disabled reminders and bookings inside the final two-hour window do not promise reminders. No new booking confirmation question is added.

## Schedule and customer experience

| Job | Scheduled instant | Eligibility |
| --- | --- | --- |
| Seven-day reminder | Start minus 168 hours | Booking/replacement committed more than 168 hours before start |
| Attendance request | Start minus 24 hours | Scheduled instant is still future when booking/replacement commits |
| Follow-up | Start minus 22 hours | A correlated `delivered`/`read` receipt proves the 24-hour request arrived, and the customer has neither confirmed nor requested a change |
| Final reminder | Start minus 2 hours | Scheduled instant is still future; appointment remains active, including when unconfirmed |

No job is created at or before the commit/reconciliation time. Thus a booking exactly seven days ahead skips the seven-day reminder; exactly 24 hours ahead skips the request/follow-up; exactly two hours ahead has no reminder. Intervals are elapsed hours against the actual timestamp, including across daylight-saving changes. Dates and 24-hour times in messages use the business timezone.

The worker may send from the due instant through 15 minutes afterward, never at/after appointment start. Older pending jobs are marked skipped and never replayed after downtime. API acceptance within that allowance does not guarantee WhatsApp delivery within it. If no attendance response arrives, the appointment stays reserved and attendance stays `PENDING` (Sin confirmar); nonresponse never cancels it.

Requests and follow-ups have **Sí, confirmo** and **Necesito reagendar**. Their opaque action payload targets one business/customer, appointment and schedule version. It remains useful until that appointment starts or changes; it is not tied to the 15-minute browsing session. Both template `button.payload` and ordinary interactive reply IDs are supported under the existing signature verification and receiving-number routing.

`Sí`, `Confirmo`, `Confirmada`, `Confirmado` and `Sí, confirmo` can confirm a single unambiguous outstanding request. `Reagendar`, `Cambiar cita`, `Necesito cambiar` and `Otra fecha` reuse its existing reschedule flow. With multiple outstanding requests, generic confirmation text asks the customer to use the specific reminder button. Name/date entry keeps priority over generic text, and human chat retains its established priority; `menu` leaves human chat and the still-current reminder button can then be used.

Confirmation appends ` — Confirmada` to the existing meaningful event title once. It PATCHes only the title and private attendance properties with the event's ETag. It retains the event ID, start/end, description, attendees and ownership properties. The description's `Estado: Reservada` remains booking status; attendance is separate. A duplicate action checks the same stored operation. Failed/unknown Calendar updates never produce a success acknowledgment.

**Necesito reagendar** opens existing dynamic availability for that exact appointment, even with multiple bookings. The original reservation and final reminder remain active until a replacement is successfully committed. Success resets attendance, removes only a suffix NukMiris itself added, rotates action identity, skips old pending jobs and creates the new applicable schedule. Abandoned/failed browsing keeps the original reservation; after browsing expiry its prior attendance status is restored. Someone who requested a change has responded, so they do not receive a follow-up claiming otherwise. The normal final reminder remains eligible. Successful cancellation invalidates remaining jobs/actions.

## Architecture and persistence

Use the existing SQLite database, local singleton delivery-worker ownership, Google authorization/calendar locks, request journals, Meta transport classification and signed receipt handling. Reminder jobs form a scheduled queue because the existing reply outbox requires a real incoming-message ID and expires with its service window. They reuse `sendStoredReply`; no synthetic incoming messages, second database, external queue service or extra dependency is introduced.

Preparation adds five tables, without rewriting existing tables/data:

| Table | Purpose |
| --- | --- |
| `reminder_business_settings` | Explicit business activation time, WABA ID, template language/names, and future per-business interval policy |
| `appointment_attendance` | Scoped appointment identity, last observed schedule/timezone, lifecycle, attendance, response/confirmation timestamps and schedule version |
| `reminder_jobs` | Unique appointment/version/job kind, due/deadline, claim state, retry timing and Meta result |
| `reminder_attempts` | Persistent attempt/outcome/message-ID history |
| `attendance_operations` | Idempotent Calendar attendance-update journal and recovery identity |

The compliance correction adds a sixth table, `reminder_permission_events`, to retain permission/withdrawal evidence by business and customer. No permissions are inferred or backfilled. General permission for communications from the named business can qualify; it need not be WhatsApp-specific. The owner records actual evidence through `reminders:permission`; see [the permission assessment and command](META_COMPLIANCE_REPORT.md#permission-assessment-and-recording). Missing/withdrawn permission prevents proactive sends, while normal bookings/attendance replies continue to work. STOP and explicit reminder withdrawal are honored without cancelling appointments, including during human chat.

Enrollment and schedule replacement run **inside the existing booking/change transaction**, including recovery that proves a previously uncertain Calendar write succeeded. A crash cannot commit the local confirmed booking without its reminder schedule. Old bookings are never enrolled by a startup scan or a later reschedule. Automatic backups/isolated restore now count and verify the new tables too.

Jobs distinguish `pending`, `sending` (attempted), `accepted`, `uncertain`, `failed`, `skipped` and `dry_run`. A `BEGIN IMMEDIATE` claim and unique job identity prevent competing workers from claiming the same job. Known transient API rejections retry at most four attempts, with 1-, 2- and 4-minute backoff, still inside the original 15-minute deadline. Accepted messages are not retried. A transport timeout or restart during send becomes `uncertain`; a correlated signed receipt can resolve it. It is never blindly resent. Known post-acceptance delivery failure is recorded for review rather than automatically resent.

API acceptance and `sent`/`delivered`/`read` webhook statuses are stored separately. Receipts verify business, sending number, recipient and Meta message ID; late failure cannot downgrade delivered/read proof. Proof arriving before the HTTP response wins over a later uncertain result. Unknown Calendar confirmations retain their shared calendar lock; recovery only reads/verifies the original operation and never repeats a possibly accepted PATCH.

Every send rechecks the active business/customer/calendar/sending-number mapping, current Calendar ownership/time, schedule version, eligibility, expiry and original-request dispatch status. Active future tracked appointments are also checked in bounded batches every five minutes to discover earlier manual moves. A timer wakes the durable queue every 30 seconds; deadlines do not depend on a timer surviving restart.

## Files

- `lib/reminder-schedule.js`: schema and exact due/deadline policy.
- `lib/reminder-templates.js`: Spanish Utility definitions, payloads and live approval validation.
- `lib/appointment-reminders.js`: lifecycle hooks, reconciliation, durable jobs, attendance journal, receipt correlation, worker and scoped backend report.
- `lib/reminder-menu.js`: reminder actions, contextual Spanish replies and existing reschedule entry.
- `scripts/reminders.js`: backed-up preparation, scoped status report and template export/read-only checks.
- `whatsapp-webhook.js`: opt-in startup, template replies, recovery continuations and worker lifetime.
- Existing booking/management/menu/message/delivery/backup helpers: small integration hooks and shared transport/status extensions.
- Five reminder test files plus disposable fixtures; package/lockfile version, scripts and documentation. Dependency versions are unchanged.

## Windows PC update and dry-run

Use `npm.cmd` in PowerShell. Stop Node with Ctrl+C first. Keep your existing credentials, selected calendars, routing and normal booking/management/reliability configuration.

From your existing repository folder:

```powershell
git status --short
git pull --ff-only
cd backend
node -p "require('./package.json').version"
npm.cmd test
npm.cmd run backup:create
npm.cmd run reminders:prepare -- --business-id juanita-nails
```

Expect **0.8.0** and **648 passing tests**, zero failures/skips. If Git reports existing local changes, preserve them before pulling. There are no new dependencies, so a dependency reinstall or Google reconnection is not required for this update.

Older checkouts can report `EPERM` while removing temporary folders named `nukmiris-reminder-process-*`, `nukmiris-reminder-setup-*`, `nukmiris-permission-cli-*` or `nukmiris-reminder-jobs-*`. These were test-cleanup defects: test processes or SQLite connections still had the files open when directory deletion ran. The corrected cleanup stops and waits for test subprocesses, closes every test database connection, then removes the directory. If the old test run hangs, press Ctrl+C and answer `Y` if PowerShell asks to terminate the batch job; if it has already returned to the prompt, continue below. These tests use synthetic databases and mocked services; they do not load your `.env`. Saving `NUKMIRIS_REMINDERS_MODE=dry-run` during that run did not cause those failures. Other test files reported as cancelled after interruption still need to run.

From `backend/`, update and rerun the complete suite:

```powershell
git status --short
git pull --ff-only
npm.cmd test
```

Expect 648 passing tests with zero failures/cancellations. Keep Node stopped until the checks pass, then continue with `backup:create` and `reminders:prepare` above. If a test fails again, preserve its error details; no database reset, administrator session or credential changes are part of this fix.

Preparation refuses a running backend, creates a dated pre-upgrade database backup, adds the metadata tables and activates enrollment for the selected business. Repeating it preserves the activation time and existing reminders. It does not call Google/Meta, send anything, import old appointments, edit `.env`, or enable sending. Other businesses remain unconfigured.

In your local `.env`, deliberately add:

```dotenv
NUKMIRIS_REMINDERS_MODE=dry-run
NUKMIRIS_REMINDER_POLL_MS=30000
```

This requires the already prepared `NUKMIRIS_MODE=booking`, `NUKMIRIS_ENABLE_MANAGEMENT=true`, `NUKMIRIS_ENABLE_RELIABILITY=true` and `NUKMIRIS_ROUTING_MODE=receiving_number`. Existing flags are never enabled automatically. Restart with:

```powershell
npm.cmd start
```

**Dry-run applies to reminders and attendance updates only. Ordinary booking/rescheduling/cancellation still works normally and can change Calendar/send its usual replies.** Use designated test appointments.

Create a **new** test appointment more than two hours ahead, then inspect:

```powershell
npm.cmd run reminders:status -- --business-id juanita-nails
```

Its attendance should be `PENDING`, with only applicable jobs. An old appointment should not appear. The report exposes scoped backend data for the future dashboard; it is a local command, not a public web endpoint. Due/deadline values are Unix milliseconds, while appointment dates are ISO timestamps with offsets.

Keep Node running through a due time. A `Reminder dry-run:` line identifies the business/customer, kind, due instant, appointment start and template. The job becomes `dry_run`; no reminder is sent and no attendance title is changed. Restart before another due job and confirm its schedule remains. The automated suite tests accelerated clocks without changing your PC clock, live Calendar dates, or real reminder intervals.

## Meta templates and live testing

See [REMINDER_TEMPLATES.md](REMINDER_TEMPLATES.md) for exact Spanish text, four names, `es_MX`, variable order, payloads, official references and the remaining documentation check.

1. Export the local definitions with `npm.cmd run reminders:templates -- --business-id juanita-nails`. This does not submit or modify templates.
2. In WhatsApp Manager, the owner submits those four Utility templates in the **correct business's WhatsApp Business Account** with the exported custom TTLs (900 seconds, or 300 for the final reminder), and waits for approval. Existing templates need their TTL metadata configured and checked too; the accepted text/buttons remain unchanged. The official rules supplied during review and the owner's remaining actions are in [the compliance report](META_COMPLIANCE_REPORT.md). No templates are submitted or modified by this release.
3. Stop Node, then add the account's WABA ID locally. This is the Business Account ID, not the phone-number ID:

   ```powershell
   npm.cmd run reminders:prepare -- --business-id juanita-nails --waba-id YOUR_WABA_ID
   npm.cmd run reminders:templates -- --business-id juanita-nails --check
   ```

   The read-only check needs a token authorized to inspect that WABA's templates (normally `whatsapp_business_management`), in addition to sending permission. Do not post tokens or OAuth files in chat/GitHub. Existing development credentials are not changed by the code.
4. Record genuine permission for the intended test recipient using the [permission command](META_COMPLIANCE_REPORT.md#permission-assessment-and-recording). Only after the account/approval/TTL checks pass and that permission exists, the owner may set `NUKMIRIS_REMINDERS_MODE=live` in the local `.env` and restart. Startup checks all four approved matching Utility templates and their safe TTLs for each activated business, including sender/WABA membership. A missing/unapproved/mismatched template stops live startup with its name/language in the error; dry-run can still be used. Every job reads sender membership and template status fresh; neither is cached. There is no free-form proactive fallback.
5. Create a new test appointment with an applicable future request. The status report shows the due instant; keep Node/tunnel online then. Confirm actual delivery of the template/buttons on WhatsApp, click **Sí, confirmo**, inspect the title plus acknowledgment, and click again to check it stays single. Inspect `meta_status` for actual delivery/read proof, not just `accepted`.
6. Check **Necesito reagendar** with two designated appointments: only the reminder's appointment should enter availability. Complete a change, confirm details/ID remain, and verify old buttons are rejected. Test cancellation and ensure pending reminders stop. Check the normal final reminder still sends without attendance confirmation.
7. Leave a designated request unanswered to check the single follow-up two hours later; confirm attendance before another follow-up to check suppression. Interval boundaries, timezone/DST, concurrency, uncertain responses and crash timing have automated coverage and need not be forced against real customers.

Jobs already previewed in dry-run are never replayed as live sends. New future jobs can run live; use a fresh booking for an unambiguous PC test. Reminders are off in the shipped example configuration. Keep reliability/reminder processing enabled while its saved operations need reconciliation; do not clear tables or reset uncertain jobs to force a retry.

## Bernard and future businesses

Use the existing business/calendar/receiving-number configuration process with Bernard's real settings and explicit calendar. Then run `reminders:prepare -- --business-id BERNARDS_BUSINESS_ID`, initially in dry-run. Supply that business's correct WABA ID before live checks. Query `reminders:status` with its business ID and test a new designated booking through its receiving WhatsApp number. Existing identities and calendars are not inferred from customer names. Offline fixtures cover two businesses sharing a sender identity with different customer records.

The current deployment still uses shared development Google/Meta authorization. Independent owner credential onboarding, production hosting and distributed coordination remain separate work; this feature does not claim those are complete.

## Manual Calendar edits and remaining limits

- Unconfirmed manual time changes are read from Google, invalidate old actions/jobs and regenerate only future applicable reminders. Missing/cancelled events stop reminders; changed ownership, recurrence, all-day/malformed events and unverifiable mappings are held for review.
- A manual time move of an attendance-confirmed event is held as `REVIEW` with `confirmed_appointment_manually_moved`. The app does not retain the old confirmation or silently rewrite the owner's Calendar edit. No misleading reminders are sent. The regular customer **Reagendar** workflow can subsequently commit a valid schedule/reset through the existing protected write architecture; otherwise retain the hold for operator review.
- Google is the appointment source of record. Local schedule data is a checked observation and reminder version, not a second independent booking system. Polling can take longer during outages/large backlogs. An external manual edit between the final read and Meta's acceptance cannot be made atomic with sending.
- The database has one local runtime owner. Atomic job claims are tested with separate connections, but independent database copies/multi-host production workers are not coordinated. Batches are bounded at ten jobs/checks per poll; this is preparation for future scale, not proof of thousands of hosted owners.
- The PC, Node, internet and webhook tunnel must remain available for live reminders/status replies. Offline deadlines older than 15 minutes are skipped. Production requires later always-on hosting.
- API acceptance cannot prove device delivery; unknown sends stay uncertain to avoid duplicates. Delivery failures and unresolved Calendar writes appear in `reminders:status`. There is no guarantee of exactly-once external delivery across a lost provider response.
- No owner dashboard, owner authentication, new service catalog or automatic old-appointment migration is included. Reminder withdrawal supports STOP/explicit listed phrases and local evidence recording; arbitrary-language opt-out understanding is not claimed. The business must obtain and record qualifying permission before live sends.

## Validation

All **648 offline tests** pass with zero failures/cancellations/skips: the initial 616 tests plus 32 production compliance cases. Coverage includes interval boundaries, dry-run, template approval/payloads/TTL, permission and withdrawal, WABA membership/status changes, delivered-message prerequisites, contextual/quoted replies, real signed HTTP, booking/change integration, scope and ownership, manual edits, transient/unknown failures, concurrent claims, preparation/backup/restore, and three real subprocess restart/crash scenarios.

The owner subsequently reported Windows `EPERM` errors in the temporary-folder cleanup of all three reminder subprocess tests, followed by a hung runner. The cleanup correction was checked in the cloud using a guard that rejects folder removal until every fixture subprocess has closed: the old code reproduced the three failures/hang, and the corrected tests all passed and exited. This first cloud check simulated Windows file locks; the subsequent PC results are recorded below. The fix changed test infrastructure only; the app remained version 0.8.0.

The owner's next full PC run completed with 645 passes and three additional cleanup failures in reminder preparation, permission recording and persistence/concurrent-worker tests. Those connections now close in the same cleanup hook before directory deletion, including when an assertion fails. The running-backend refusal test was also hardened to close its connection after a failed assertion. The three reported failures were reproduced in the cloud with a broader guard that rejects removal of any directory containing an open SQLite database. After correction, all 648 tests passed under that guard, with zero failures/cancellations/skips; all 48 tests in the three reminder recovery/setup/scheduling files also passed normally. The owner then reported **“all tests now passed”** on the PC and subsequently confirmed the first reminder's persisted dry-run result. On October 26, 2026, the owner explicitly accepted v0.8.0 as the new baseline.

Google/Meta services and customer data in these tests are synthetic. Live reminder delivery, Meta approval and attendance updates on the owner's PC remain **unverified until the owner confirms them**. The existing v0.7.3 owner verification is retained.
