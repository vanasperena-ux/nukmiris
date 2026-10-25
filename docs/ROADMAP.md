# NukMiris project continuity

Current implementation checkpoint: v0.7.3 consistent appointment choices, including v0.7.2 Calendar details/empty results and v0.7.1 slot labels; combined PC verification is pending. Current owner-verified baseline: v0.7.0 simple menu instructions (`e1c5370`), retaining the verified v0.6.0 natural dates (`3238e34`), v0.5.0 intent recognition (`b6a9169`), v0.4.1 availability (`8649109`) and v0.4.0 reliability (`9d6358b`) behavior.

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

After the GitHub update, the owner reported **“great I tested all as you proposed in the testing guide. all OK!”** Record the v0.4.1 manual PC guide as passed and preserve this version as the new working baseline. All 214 offline tests also passed before delivery. No separate PC commit hash or detailed per-case log was supplied; retain existing technical limits and do not equate the report with live verification of each simulated API-error/DST case. The logical next planning topic is always-on hosting; no hosting deployment or new feature is authorized by this success report alone.

## Authorized checkpoint — v0.5.0 Spanish intent recognition

The owner subsequently supplied the Spanish WhatsApp intent-recognition task for version 0.5. Reuse the current checkout and verified v0.4.1 workflows. The implementation recognizes natural BOOK/RESCHEDULE/CANCEL requests and LATAM terminology using centralized local rules, handles negation/conflicts/context, and offers existing-style scoped clarification buttons. Preserve original text, human chat, protected name/date/time states, existing controls, flags, ownership, Calendar services, lifecycle metadata and safeguards. No LLM, external AI dependency, date extraction, schema change, or additional booking confirmation is authorized.

All 347 offline tests passed, retaining 214 regressions and adding 133 classifier/conversation/recovery cases. Delivery used the established GitHub update and `npm.cmd` PC workflow. On the owner's local date 2026-10-24 (America/Mexico_City), the owner reported **“I tested v.0.5.0 and all good!”** Record v0.5.0 as the new owner-verified working baseline. No separate PC commit hash or detailed per-case log was supplied; preserve the established technical limits and do not equate the report with independent live verification of every simulated failure case. See [the implementation and PC test guide](../backend/INTENT_RECOGNITION.md). Always-on hosting and other feature work remain separate and are not authorized by this success report alone.

## Authorized checkpoint — v0.6.0 natural Spanish date input

The owner supplied the natural-date-input task for the next version. Replace rigid date entry inside the existing availability state shared by booking/rescheduling; preserve the verified v0.5.0 intent, lifecycle, identity, feature flags, Calendar services, duration/overlap rules, state isolation and immediate time-selection behavior. Support LATAM numerical dates, Spanish months, relative days/weeks and weekdays using the configured business timezone and existing horizon. Keep invalid dates in the same flow and avoid a new date-confirmation step. No new AI/dependency, schema, settings interface or independent scheduling mechanism is authorized.

The owner explicitly selected **“Use the next upcoming 13th”** for `el día 13`. Day-only input therefore uses the next actual occurrence, skipping impossible month days, rather than asking for a month. Missing years infer the next real day/month occurrence; explicit years are respected. Bare weekdays use today only when real valid slots remain, otherwise checking next week within the horizon. The parser runs only where typed dates were already accepted, not in idle intent messages, names or human support.

All 460 offline tests passed, retaining 347 regressions and adding 113 parser/menu/HTTP/restart cases. Delivery used the established GitHub and `npm.cmd` PC update process. On 2026-10-25 (America/Mexico_City), the owner reported **“v.0.6.0 manually tested and all OK.”** Record v0.6.0 (`3238e34c5b216ce6b942f61d27e9bb58fa952068`) as owner-verified. No separate PC commit hash or detailed per-case log was supplied; preserve existing technical limits. See [the implementation and test guide](../backend/NATURAL_DATES.md) and [verification record](../backend/BASELINE.md). Hosting and unrelated features remain separate.

## Authorized checkpoint — v0.7.0 simple menu instructions

The owner supplied the menu simplification task after verifying v0.6.0. Preserve that baseline, use the existing checkout without a worktree, remove repeated routine hints, and use exactly `Escribe "menu" para volver al menú principal.` where useful for escape/recovery. Handle the text command before any current or legacy session state; invalidate unused selections without changing confirmed appointments or discarding pending/uncertain operations.

The `booking_confirm` audit found no current state writer: immediate time-selection booking has been active since v0.3.1. Remove its obsolete customer instruction, safely reset saved legacy state, and retain the internal booking decision/journal/recovery mechanisms. New customers still supply their name once; verified success still produces the existing appointment notification. No changes to identity, calendar ownership, date understanding, availability/durations, lifecycle rules, flags, schema or dependencies are authorized. Services Catalog/reminders are not implemented by this checkpoint.

All 484 offline tests passed, retaining 460 regressions and adding 24 navigation/state/failure/duplicate-delivery/restart cases. Delivery used the established GitHub and `npm.cmd` PC workflow. On 2026-10-25 (America/Mexico_City), the owner confirmed **“yes”** when asked whether the latest v0.7.0 menu update tested OK. Record v0.7.0 (`e1c5370061ed268dffe8c17bd8f466182e544b1a`) as the current owner-verified working baseline. No separate PC commit hash or detailed per-case log was supplied; preserve existing technical limits. See [the before/after messages, audit and test guide](../backend/MENU_UX.md) and [verification record](../backend/BASELINE.md). Hosting and unrelated feature work remain separate.

## Authorized checkpoint — v0.7.1 Spanish appointment-slot labels

The owner requested a focused label change from `vie 02/04 10:00` to `vie 2 abr 10:00`: Spanish lowercase abbreviated weekdays/months, unpadded day, 24-hour time, business timezone and the 20-character button limit. Apply it to all available slot choices and alternatives, including date-first time pages, for booking and rescheduling. Preserve IDs, full timestamps, other appointment messages, webhook handling, Calendar data and lifecycle logic. Existing appointment-selection lists are separate from offered availability slots and retain their labels.

All 525 offline tests passed, retaining 484 regressions and adding 41 formatter/view cases. Use the established GitHub and `npm.cmd` PC delivery workflow. v0.7.1 awaits owner PC verification; v0.7.0 remains the verified baseline. See [the scope and test guide](../backend/SLOT_LABELS.md). No other feature work is authorized by this label update.

## Authorized checkpoint — v0.7.2 Calendar details and concise empty results

The owner requested that v0.7.2 combine the pending v0.7.1 labels with new-event visible details and a simpler no-appointments message, then be tested on the PC. Use `{Full Name} — Cita` and the Spanish customer/WhatsApp/status/origin description. Derive the phone from the existing scoped customer identity; preserve original IDs/private ownership metadata and all booking safeguards. Omit the service field until a real Services Catalog selection exists. Do not reformat old events or alter rescheduling, cancellation, recovery, idempotency, extra questions or confirmations. The existing rescheduling PATCH already preserves the title/description.

Use exactly `No encontré citas próximas. Si deseas agendar una nueva cita, escribe "cita".` for empty rescheduling/cancellation results, without a menu suffix. The review found two equivalent disabled legacy responses; standardize their text without enabling the handlers. Keep the shared menu instruction, global command, business/customer isolation and ownership checks. No schema, dependencies, credentials, environment files or live database changes are authorized. The Calendar payload presentation change is authorized by the first task; the second task leaves the integration/client and business rules unchanged.

All 536 offline tests passed, retaining 525 regressions and adding 11 booking-detail/identity/rescheduling/HTTP cases. Existing process-restart, ownership, cancellation and idempotency checks continue to pass. Use the established GitHub and `npm.cmd` PC workflow. v0.7.0 remains the owner-verified baseline until the owner confirms the combined v0.7.2 checkpoint. See [the files, findings and PC guide](../backend/CALENDAR_DETAILS.md).

## Authorized correction — v0.7.3 consistent appointment choices

The owner reported v0.7.2 still displayed numerical month labels for existing appointments offered by cancellation/rescheduling. The earlier availability-only interpretation was too narrow. Use the same shared `slotLabel` formatter for existing-appointment titles and compact end-time descriptions, including list pagination and business timezone/year boundaries. Preserve full messages, IDs, timestamps, appointment ownership, Calendar event details, immediate selection, cancellation/rescheduling logic and recovery. This supersedes the original v0.7.1 interpretation that existing-appointment choices should retain their labels.

All 540 offline tests passed, retaining 536 regressions and adding four management-format cases; the 83 focused checks passed as well. Use the established GitHub and `npm.cmd` PC workflow. v0.7.0 remains the owner-verified baseline until the owner confirms the combined v0.7.3 checkpoint. See [the audit, files and PC guide](../backend/APPOINTMENT_LABELS.md).
