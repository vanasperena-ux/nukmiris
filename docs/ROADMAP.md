# NukMiris project continuity

Current implementation checkpoint: v0.4.0, awaiting PC reliability verification.

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

The v0.4.0 implementation adds an opt-in persisted inbox/outbox, local-state and operation checkpoints, signed Meta receipt handling, single-worker ownership, automatic verified SQLite backups, and isolated restore commands. Process-crash tests use simulated integrations and forcibly terminated Node subprocesses. Real PC reliability verification remains pending; use [the checkpoint guide](../backend/RELIABILITY_CHECKPOINT.md). Unknown Google/Meta results stay protected for verification, not blind duplicate writes/sends.

After reliability is verified, consider always-on hosting so customer access does not depend on the PC staying on. Hosting, reminders, dashboards, and additional business onboarding are outside this reliability checkpoint.
