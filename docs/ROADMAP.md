# NukMiris project continuity

Current implementation checkpoint: v0.4.1 dynamic availability, ready for PC testing through the usual GitHub update process. Verified reliability baseline: v0.4.0 (`9d6358b`).

## Windows PC command preference

The owner runs commands in PowerShell, where invoking `npm` is not allowed, and uses `npm.cmd` successfully. Use **`npm.cmd` for all Windows PC release, setup, testing, and troubleshooting instructions**, including `npm.cmd ci --ignore-scripts`, `npm.cmd test`, `npm.cmd run SCRIPT_NAME`, and `npm.cmd start`. Cloud/Linux commands can continue using `npm`.

## Current priorities

The owner verified v0.3.0 booking, rescheduling, and cancellation on the Windows PC, and accepted the earlier short appointment menu. Preserve these calendar integrations, business/customer isolation, schedule settings, and safeguards.

The owner then requested the eight WhatsApp UX improvements (v0.3.1): simpler Spanish messages, appointment details in the menu, and direct booking/rescheduling/cancellation when the customer explicitly selects the target. The owner has now verified that checkpoint: “OK I tested v0.3.1 all good thanks.” Preserve those interactions.

## Authorized checkpoint — v0.4.0 reliability and restart recovery

The owner explicitly authorized proceeding with the following work after accepting v0.3.1:

- Persist incoming messages so an app/PC restart does not lose acknowledged requests.
- Persist unfinished replies and resume them without repeating calendar mutations.
- Add automatic database backups and test restoring one.
- Test interruptions during processing, recovery after restart, correct customer replies, and absence of duplicate calendar operations.

The v0.4.0 implementation adds an opt-in persisted inbox/outbox, local-state and operation checkpoints, signed Meta receipt handling, single-worker ownership, automatic verified SQLite backups, and isolated restore commands. Process-crash tests use simulated integrations and forcibly terminated Node subprocesses. The owner has now completed the requested PC checkpoint; use [the checkpoint guide](../backend/RELIABILITY_CHECKPOINT.md) for its evidence and scope. Unknown Google/Meta results stay protected for verification, not blind duplicate writes/sends.

PC report and diagnostic on 2026-10-25: saved choices worked after restarting for booking, rescheduling, and cancellation. The 7:33 PM booking warning is explained: inbox 4 produced confirmed Booking 1 and a read success reply; inbox 5 arrived 50.861 seconds later targeting a different stale main-menu booking button and produced the read expiry warning. Each handler ran once, with no reported error; persisted delivery was active for these records. Whether that later action was another tap or a delayed incoming action is unproven. The saved-choice restart tests passed. See [the investigation findings](../backend/RESTART_INVESTIGATION.md). Preserve stale-menu protection; no runtime correction was made for this report.

The owner then supplied a v0.4.0 PowerShell screenshot confirming `npm.cmd run backup:create` produced a verified backup and `npm.cmd run backup:restore-test` passed integrity, foreign-key, and row-count checks in an isolated restored file. The tool reported that the live database was not replaced and no worker or external calls were started. Record manual backup/isolated restore as PC-verified; this is not a test of 24-hour scheduling/retention or live database replacement.

The owner's final report was **“Restart immediately after selecting: OK; Human chat: OK”** in response to the remaining booking/rescheduling/cancellation interruption and human-support restart checks. Treat the requested v0.4.0 PC reliability checkpoint as owner-verified. Exact crash timing, individual transport-failure cases, 24-hour scheduling/retention, and independent PC logs were not supplied beyond the screenshot/diagnostic; retain existing technical limits. Proceed to v0.4.1 PC tests using the GitHub delivery authorization below.

After reliability is verified, consider always-on hosting so customer access does not depend on the PC staying on. Hosting, reminders, dashboards, and additional business onboarding are outside this reliability checkpoint.

## Authorized checkpoint — dynamic availability

While beginning v0.4.0 PC tests, the owner supplied the dynamic availability task on 2026-10-25. Preserve the now owner-verified v0.4.0 baseline. The original supplied task said not to automatically commit or push. The owner subsequently stated **“I am fine with you following the same process as we moved from v0.3.1 to 0.4.0”**, authorizing the usual commit/push to GitHub and PC update workflow for v0.4.1. This later instruction overrides the earlier no-auto-commit/push restriction for this delivery. Use GitHub and `git pull --ff-only` for the PC update; a ZIP installation is unnecessary.

The owner clarified two requirements: **keep the current two choices → Más opciones → two more → Elegir fecha flow**, and **apply the same dynamic search and 365-day booking horizon to both new bookings and rescheduling**. These answers supersede the uploaded example's initial three-date presentation.

The implementation uses a 30-day first search, 15-day non-overlapping extensions, and the earliest three available dates, capped at 365 business-local calendar days from now. Typed/selected dates and final availability checks use direct-day queries. Existing identity, business/customer isolation, authorization, calendar mutation safeguards, cancellation, and reliability/backup mechanisms remain in use. No reminders, hosting, new dependencies, scheduled scans, or settings interface are added. See [the implementation and PC test guide](../backend/DYNAMIC_AVAILABILITY.md).
