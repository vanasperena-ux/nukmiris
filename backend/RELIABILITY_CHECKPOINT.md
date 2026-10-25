# Reliability and restart recovery — v0.4.0 PC checkpoint

The owner verified v0.3.1 on the Windows PC (“OK I tested v0.3.1 all good thanks”) and authorized this checkpoint. Its menus, direct booking/rescheduling/cancellation, calendar selection, schedules, and permissions remain in place. v0.4.0 adds an optional saved inbox, saved replies, restart recovery, and automatic database backups.

Cloud tests use synthetic customers and simulated services. The owner has now completed the requested PC checks below. PowerShell commands deliberately use **`npm.cmd`**.

**PC follow-up, 2026-10-25:** the owner reported that saved booking/rescheduling/cancellation choices worked after restart. The supplied diagnostic explains the later booking warning: a separate action received about 51 seconds after successful booking targeted a different stale main-menu button. The booking remains confirmed; the report does not establish whether the later action was another tap or a delayed message. See [the recorded findings](RESTART_INVESTIGATION.md).

**Backup/restore PC check passed:** the owner's v0.4.0 PowerShell screenshot confirms a verified backup and an isolated restore with matching integrity, foreign keys, and row counts. The live database was not replaced; the command reported no app worker or external calls were started.

**Requested PC checkpoint passed:** the owner subsequently reported **“Restart immediately after selecting: OK; Human chat: OK”** for the remaining checks. Treat v0.4.0 (`9d6358b`) as the owner-verified reliability baseline. This report does not establish exact crash timing, each simulated transport-failure case, or 24-hour backup scheduling/retention on the PC. The limits below remain applicable. Next is [v0.4.1 dynamic availability testing](DYNAMIC_AVAILABILITY.md).

All **188 automated tests passed**, with zero failures/skipped tests: the 159 earlier regressions plus 29 reliability, backup, and process-based integration tests. The calendar engine, mutation services, authorization, and their existing regression tests remain unchanged.

## 1. Update and prepare with Node stopped

Press Ctrl+C to stop Node. From your repository folder:

```powershell
git pull --ff-only
cd backend
npm.cmd test
npm.cmd run reliability:prepare
```

Preparation creates a timestamped backup beside the existing database, then adds the inbox, outbox, and worker-owner tables. It preserves customers, appointments, mappings, settings, and existing journals. It makes no Google or Meta calls and is safe to repeat. Startup never prepares these tables automatically.

Keep your existing `.env`, database, Google tokens, Meta/tunnel settings, `NUKMIRIS_MODE=booking`, and `NUKMIRIS_ENABLE_MANAGEMENT=true`. No new packages, OAuth permissions, Meta callback address, or business configuration are required.

## 2. Enable and start

Add this to your existing `.env`:

```dotenv
NUKMIRIS_ENABLE_RELIABILITY=true
```

Backup defaults need no extra settings: the app uses `.local/backups`, checks once a minute, creates a verified backup at startup if needed and every 24 hours while running, and keeps seven automatic copies. Optional overrides are:

```dotenv
NUKMIRIS_BACKUP_DIR=.local/backups
NUKMIRIS_BACKUP_INTERVAL_HOURS=24
NUKMIRIS_BACKUP_KEEP=7
```

Then run:

```powershell
npm.cmd run connections:check:management
npm.cmd start
```

Startup must report **Reliable delivery: persisted inbox/outbox and automatic backups enabled**. It requires receiving-number routing, a successful initial backup, and one worker for this database. Keep one app instance. A second process is refused; a restart takes over only after the previous local process has exited. Never run independent database copies against the same active calendar.

Juanita continues using the stored ID for **Juanita's Nailsalon – Juanita**. The calendar engine and its Monday–Friday schedule, lunch, zero buffer, and hourly starts are unchanged.

## 3. Test on the PC with test appointments

1. Send **Menu → Cita**. Stop/restart Node, then use a saved choice while it is still within the normal 15-minute offer lifetime. The existing appointment flow should work.
2. Choose a future test slot and stop Node immediately afterward. Restart with `npm.cmd start`. Check that there is exactly one appointment and that the customer receives the saved result or a verification-status message. Selecting that same slot again must not create a second event.
3. Repeat an interruption during **Reagendar**, then during **Cancelar**, using that test appointment. Check that the same event moves once and that cancellation affects only that event. An ambiguous Calendar result remains protected for verification rather than being blindly retried.
4. Enter human chat and send a test message, then restart. Confirm that the stored support message and **menu** return still work.
5. From another PowerShell window in `backend/`, inspect saved work and backups:

```powershell
npm.cmd run reliability:status
npm.cmd run backup:create
npm.cmd run backup:restore-test
```

`reliability:status` shows counts and review IDs for the selected `NUKMIRIS_BUSINESS_ID`. `backup:create` makes a consistent verified copy. `backup:restore-test` restores the newest automatic copy into a new file under `.local/backups/restore-checks`, verifies integrity/foreign keys/row counts, and leaves the working database untouched. Neither backup command starts a worker or contacts Google/Meta.

PC timing may allow an operation to finish before you interrupt it. The automated suite also kills separate Node processes at exact checkpoints: before handling an acknowledged request, after local state changes, after each Calendar mutation, after reply creation, and after Meta accepts a reply but before its HTTP result is recorded.

Report whether the original UX still works, each Calendar action happens once, replies recover or show a saved verification state, and the restore test succeeds. Share status counts rather than tokens, customer messages, or database files.

## What recovery guarantees

- Supported signed incoming messages are committed before HTTP 200. If storage fails, Meta receives an error and can retry. Duplicate message IDs are remembered in SQLite across restarts and scoped by business.
- Incoming messages and outgoing replies retain order for each business/customer. A delayed customer's reply does not prevent other customers from progressing.
- Local menu/support state is checkpointed. If a handler is interrupted before creating replies, it can replay from the previous state. All parts of a long menu are saved together before delivery.
- Before a Calendar operation, the incoming message is linked to its existing booking/change request. Restart recovery uses that same request and its verification logic, including after a new customer's name was supplied. Reply delivery never creates a fresh Calendar request.
- Outgoing payloads are saved separately. A crash before sending resumes that stored reply. Known transient Meta rejections retry with backoff; configuration/permission failures remain available for review. Expired prompts and replies outside the customer-service window are not sent; a fresh **Menu** starts a current flow.

Meta offers no general exactly-once message-send guarantee. If a process dies during a send, or the network response is unclear, the reply is marked **uncertain**. A signed matching Meta status callback can resolve it automatically using the saved callback reference. Until then, the app avoids blindly sending the reply twice. This uncertainty concerns WhatsApp delivery, not a reason to repeat the Calendar operation.

After correcting a definite local/Meta failure, retry the selected business's failed work with:

```powershell
npm.cmd run reliability:retry
```

For an uncertain reply, first inspect the actual test conversation/status. Only if you deliberately want another send attempt:

```powershell
npm.cmd run reliability:retry -- --include-uncertain
```

That explicit option may duplicate a WhatsApp reply that Meta already accepted. It requeues saved replies without recreating Calendar operations. A configuration mismatch is retried only after the business/receiving-number mapping and runtime capabilities match the original saved work. Handler failures retry with backoff and stop for review after five attempts.

Unresolved Google writes retain the existing calendar lock. Use the established `booking:reconcile` or `management:reconcile` commands for those requests. Never delete request journals or force-release their locks.

## Backups and restore

Backups use SQLite's online backup API, not a copy of a potentially incomplete live database file. Each copy is checked before publication; retention removes only this tool's older copies after a verified replacement exists. Credentials and `.env` are separate local files and are not part of the database backup. Private databases, backups, and partial copies remain ignored by Git.

For a real restore, stop Node first and choose an unused destination filename:

```powershell
npm.cmd run backup:restore -- "FULL_PATH_TO_BACKUP" --to "FULL_PATH_TO_NEW_RESTORE.sqlite"
```

The command never replaces an existing file or the configured live database, starts no worker, and changes no Google events. Inspect the result before choosing it as `NUKMIRIS_DB_PATH`; keep the original database. A backup represents its creation time, so work accepted after that point may be missing. Restoring SQLite does not roll back Google Calendar. Review pending operations against the calendar before activating a replacement, and keep the original app stopped.

To pause automatic processing during investigation, stop Node. The v0.4.0 compatibility handler refuses startup when durable work is unresolved, so accidentally dropping the reliability flag cannot bypass it. Do not downgrade to older code or delete queue tables to bypass this protection. Keep the queue tables, booking/change journals, and backups. Reliability mode is off by default for compatibility, but leave it enabled once this PC checkpoint is accepted.

This remains a single-PC prototype. It does not add always-on hosting, distributed workers, outbound message templates, or automatic purging of message history. Google still has no atomic availability-check-and-write operation with other calendar apps. Local disk failure and restoring an older backup can lose work newer than that backup.

## Implementation reference

| Files | Purpose |
| --- | --- |
| `lib/reliable-delivery.js` | Additive inbox/outbox schema, deduplication, checkpoints, ordering, worker ownership, Meta receipts, safe retries, and delivery worker. |
| `lib/database-backups.js` | Verified online backups, retention, automatic scheduling, and isolated restores. |
| `whatsapp-webhook.js`, `lib/management-menu.js` | Connect the existing UX to saved inputs, operation continuations, and reply batches. Save the first human-support message before queuing its acknowledgement. |
| `scripts/reliability.js`, `scripts/database-backup.js` | PC preparation, status/retry, backup, and restore commands. |
| `test/reliability.test.cjs`, `test/backups.test.cjs`, `test/recovery-webhook.test.cjs`, `test/helpers/recovery-runtime.cjs` | Synthetic queue/backup verification and real subprocess termination/restart against simulated integrations. |

Existing HTTP suites explicitly test compatibility mode; package metadata, example settings, private-file ignores, baseline notes, and roadmap are updated. No dependency upgrades or new account permissions are included.
