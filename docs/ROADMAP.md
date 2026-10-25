# NukMiris project continuity

Last updated: 2026-10-24.

## Windows PC command preference

The owner runs commands in PowerShell, where invoking `npm` is not allowed, and uses `npm.cmd` successfully. Use **`npm.cmd` for all Windows PC release, setup, testing, and troubleshooting instructions**, including `npm.cmd ci --ignore-scripts`, `npm.cmd test`, `npm.cmd run SCRIPT_NAME`, and `npm.cmd start`. Cloud/Linux commands can continue using `npm`.

## Current priorities

The owner verified v0.3.0 booking, rescheduling, and cancellation on the Windows PC, and accepted the earlier short appointment menu. Preserve these calendar integrations, business/customer isolation, schedule settings, and safeguards.

The owner then requested the eight WhatsApp UX improvements as the immediate priority (v0.3.1): simpler Spanish messages, appointment details in the menu, and direct booking/rescheduling/cancellation when the customer explicitly selects the target. The request supersedes the previous extra confirmation screens. Do not add unrelated features to this UX checkpoint.

## Next planned checkpoint — v0.4.0 reliability and restart recovery

The owner asked to retain this plan and address the UX improvements first. Resume the following checkpoint after the UX work is accepted:

- Persist incoming messages so an app/PC restart does not lose acknowledged requests.
- Persist unfinished replies and resume them without repeating calendar mutations.
- Add automatic database backups and test restoring one.
- Test interruptions during processing, recovery after restart, correct customer replies, and absence of duplicate calendar operations.

The current journals and locks already protect booking/change requests after they are recorded, and selected-action receipts support retries. This is not a durable webhook delivery queue: failures before recording work and outgoing reply delivery remain part of the planned checkpoint, not completed functionality.

After reliability is verified, consider always-on hosting so customer access does not depend on the PC staying on. Hosting, reminders, dashboards, and additional business onboarding have not been authorized as part of the UX work.
