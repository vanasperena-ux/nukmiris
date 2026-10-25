# Investigating the v0.4.0 booking restart report

The owner reported on 2026-10-25:

- **Menu → Agendar una cita → receive choices → stop Node → restart → select a choice** created the appointment and sent the successful booking message, followed later by an expired-option warning.
- The choice was selected within 15 minutes. The reliability-enabled startup line was not confirmed.
- The equivalent rescheduling and cancellation restart tests showed no issues.

The saved-choice booking restart test is now validated by the owner's report and the diagnostic history below. The owner subsequently supplied a screenshot confirming that v0.4.0 manual backup creation and isolated restore passed integrity, foreign-key, and row-count checks without replacing the live database, then reported **“Restart immediately after selecting: OK; Human chat: OK.”** The requested v0.4.0 PC checkpoint is now owner-verified; exact crash timing, individual transport-failure cases, and 24-hour backup scheduling/retention remain outside the supplied live evidence.

## Finding from the owner's diagnostic report

The owner supplied the v0.4.0 diagnostic output and identified test 1 as **7:33 PM**. The matching receipt times are October 24 in `America/Mexico_City` (UTC−06:00), corresponding to October 25 in the UTC report:

| Local receipt time | Saved input | Result |
| --- | --- | --- |
| 19:33:28 | Inbox 2: `menu` | New main-menu choices |
| 19:33:35 | Inbox 3: `main_menu_book` | Appointment choices; button fingerprint `9d246f6924ac` |
| 19:33:58 | Inbox 4: `appointment_slot` | `booking_success`, linked to Booking 1; handler attempt 1 |
| 19:34:49 | Inbox 5: `main_menu_book` | `expired_main_menu`; a different button fingerprint, `df14961855cc`, with prior session `booking_result` |

Booking 1 was recorded confirmed at **19:33:59.435** and remains `confirmed` in this report. Both the success and warning replies have matching Meta `read` statuses. The warning belongs to a separate incoming action received **50.861 seconds after** the appointment selection. Its button fingerprint differs from the main-menu action that originally opened availability, so it was not a repeat selection of that same menu button or appointment slot. Each handler ran once; the trace contains no handler retry or error for these actions.

The application-level cause of the warning is established: the later action targeted a main menu that was no longer current after booking completed. The normal stale-menu guard rejected it. This does not indicate failed booking recovery, an expired chosen slot, or reversal of the confirmed appointment. The report cannot determine whether the later action came from another tap, a delayed incoming action, or another cause outside the recorded handler path. It contains receipt times, not original button-tap times, so that origin remains unproven.

The processed inbox/outbox records for the matching test also establish that persisted delivery handled these actions; `reliabilityEnabledNow: true` alone would only describe the checker's current settings. Rescheduling success is separately recorded at 19:38:24 and cancellation success at 19:39:05, consistent with the owner's successful test reports. Their source booking identities are not exported by this checker, so do not assume those management actions targeted Booking 1, which remains confirmed.

No runtime correction is justified by this trace. Preserve the current stale-action protection and recorded booking result. A future copy improvement could clarify that an earlier menu has been replaced; that is separate from restart correctness. Full PC reliability acceptance is based on the owner's subsequent completed-check report above. The owner separately authorized normal GitHub delivery of v0.4.1, which includes this investigation record.

## What has been validated here

Two new process tests were run against an isolated checkout of the **original published v0.4.0 code at `9d6358b`**, using synthetic integrations. Both passed:

1. The exact Menu → Agendar → restart-before-selection sequence produces one Calendar insert and one successful result. Redelivery of the same incoming message after a further restart produces no extra reply or event.
2. A subsequent selection of the old main-menu booking button produces **“Esta opción ya no está vigente. Escribe Cita para consultar horarios.”** as a separate incoming/outgoing record, after a successful booking.

Before receiving the PC report, the second test established one way to reproduce the symptom, without establishing what happened on the PC. The supplied report now confirms that the warning was linked to a separate stale main-menu action. It still does not establish who or what generated that later action. The separate appointment-choice expiry check uses slightly different wording.

No runtime recovery behavior has been changed for this investigation. The diagnostic and regression tests accompany the separately authorized v0.4.1 GitHub update. The standalone diagnostic below also works with v0.4.0 and does not require installing the dynamic update.

## Read the existing PC records

Save [scripts/inspect-restart.cjs](scripts/inspect-restart.cjs) as **`inspect-restart.cjs` inside the PC's `backend` folder**, beside `package.json`. Keep the `.cjs` extension. From PowerShell in that folder:

```powershell
node .\inspect-restart.cjs
```

The app can remain running. The script opens the configured database in read-only mode and prints the latest 50 saved inputs and booking records for the configured business. It uses the existing `.env` file and Node 24 installation. It contacts no external service, starts no worker, retries no replies, and changes no appointments, settings, or tables. It hides names, phone numbers, message bodies, token values, calendar IDs, event IDs, and raw button/request IDs. Customer/booking aliases and shortened button fingerprints link related records within the report.

Paste the report in the chat with the approximate local time of test 1. If the Node startup window is still available, include whether it showed:

```text
Reliable delivery: persisted inbox/outbox and automatic backups enabled
```

The report's `reliabilityEnabledNow` describes configuration **when the checker runs**; it cannot establish what was enabled during the earlier test. Existing history can also come from an earlier run. A startup line or a controlled repeat confirms the mode used for that run.

## How to interpret the report

| Evidence | Meaning |
| --- | --- |
| `booking_success` linked to a `confirmed` booking | The app recorded a successful booking result for that input; the owner separately saw the event and success message |
| A later, separate `main_menu_book` input with `expired_main_menu` | An additional action targeted an old main menu; investigate that input and its timing separately from the completed booking |
| Repeated `buttonReference` values on different inbox records | Separate incoming message IDs targeted the same button; this alone does not identify why those inputs occurred |
| `expired_option` for an `appointment_slot` input | Inspect that input's prior session, whether its selection matched, and its receipt time relative to the offer expiry |
| `attempts` greater than one | The handler retried processing that saved input; this is not a count of Meta redeliveries |
| `uncertain`, `failed`, or `pending` reply state | Delivery needs investigation; it does not establish that the Calendar booking failed |
| `messageHistoryAvailable: false` or no records for the test | Retrospective tracing is unavailable for that run; confirm reliability mode before a controlled repeat |

Times are **UTC receipt times**, not WhatsApp display times. The v0.4.0 outbox does not store send timestamps. `accepted` means Meta accepted the send or a matching status arrived; `metaStatus: delivered/read`, when present, supplies additional receipt evidence. A read-only report cannot establish the exact order displayed on the phone or reconstruct requests absent from the journal. `priorOfferExpiredAtReceipt` compares the saved offer to receipt time; a handler delayed in the queue could run later.

If no useful history exists, run the already available status command:

```powershell
npm.cmd run reliability:status
```

Then use the existing [reliability setup](RELIABILITY_CHECKPOINT.md) to confirm preparation and the startup line before repeating the test with a designated test appointment. Use a fresh Menu, restart after receiving choices, select within 15 minutes, and collect the report immediately after the result. Preserve the existing appointment and message journals for investigation.

## Diagnostic validation

Three offline tests verify that the report correlates separate booking/stale-menu inputs, hides private values, scopes records by business, operates against a read-only database without changing its bytes, tolerates absent reliability tables without creating them, loads the existing local settings, and refuses to create a missing database. They use synthetic records and credentials only.

The complete local suite passed **214 tests**, with zero failures or skipped tests: the previous 209 plus two process-reproduction tests and three diagnostic tests. The two reproduction tests also passed separately against the original published v0.4.0 code, before any dynamic-search changes. `git diff --check` passed.

The owner's report has now identified the actual input/reply pair, as recorded above. The investigation required no runtime correction or live-account action. The completed PC checkpoint and its limits are recorded in [RELIABILITY_CHECKPOINT.md](RELIABILITY_CHECKPOINT.md); the record is included in the authorized v0.4.1 GitHub delivery.
