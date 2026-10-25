# Consistent appointment choices — v0.7.3

**v0.7.3 awaits PC verification.** It includes the v0.7.1 slot labels and v0.7.2 Calendar details/empty-result message. v0.7.0 remains the last owner-verified baseline.

## v0.7.2 audit and correction

The owner reported that new available slots used `mié 23 jun 10:00`, while existing appointments offered for cancellation/rescheduling still used `mié 23/06 11:00`. Source inspection confirmed the mismatch: `availability-menu.js` used the shared `slotLabel` formatter, but `management-menu.js` retained its own numerical compact format. The previous scope was too narrow; its tests even expected that old existing-appointment label.

The correction makes `management-menu.js` reuse `slotLabel` for existing-appointment choice titles and their compact `Termina:` list descriptions. It applies to cancellation, choosing among appointments to reschedule, reply buttons, list rows and every page. New availability/alternative/date-first time choices already use the same formatter.

All active appointment date/time choices now use lowercase Spanish weekday/month abbreviations, unpadded days, 24-hour time and the configured business timezone. The shared formatter enforces the 20-character button limit; the existing leap-year sweep's longest label is 17 characters. Date-only picker rows and full appointment/success messages retain their established wording. A separate old numerical formatter remains in disabled legacy handlers, which are not reachable through the supported appointment flows.

IDs, full timestamps, selected appointment order/indexes, event ownership, Google event details, journals, recovery and immediate selection behavior are unchanged. No Calendar events, database rows, credentials, environment files, schema or business settings were modified by the cloud agent.

## Files and tests

- `lib/management-menu.js`: import the shared formatter and use it only for compact management labels; keep full message formatting.
- `test/slot-label.test.cjs`: four added cancellation/rescheduling cases covering both Mexico City and Tokyo, date/year boundaries, list pagination, end-time descriptions, original IDs/indexes, full timestamps and unchanged prompts.
- `test/management-webhook.test.cjs`: exact new labels for single cancellation, multiple rescheduling choices and paginated cancellation; existing selection tests verify the same event is changed once.
- `package.json`, `package-lock.json`: version 0.7.3; dependencies and test commands unchanged.
- Root/backend READMEs, `BASELINE.md`, `KNOWN_LIMITATIONS.md`, `SLOT_LABELS.md`, `../docs/ROADMAP.md`, this guide: audit findings, release status and PC checks.

Complete `npm test` validation passed **all 540 tests**, with zero failures/cancellations/skips: the 536 earlier regressions plus four management-format cases. The 83 focused formatter/management HTTP checks also passed. Tests use synthetic databases and simulated integrations; live PC verification remains for the owner.

## Windows PC update and checks

Stop Node with Ctrl+C. From PowerShell in the existing `backend/` folder:

```powershell
npm.cmd run backup:create
git pull --ff-only
node -p "require('./package.json').version"
npm.cmd test
npm.cmd run connections:check:management
npm.cmd start
```

The version must print **0.7.3**, and `npm.cmd test` must report **540 passed**, with no failures/skips. No dependency installation, migration or reconnection is required.

In WhatsApp, start a fresh flow with `menu`. Messages already delivered to WhatsApp retain their old text.

1. Send `cita` and inspect **Más opciones**, selected-date times and **Más horarios**. Slot titles should keep the new format.
2. Send `cancelar` with a designated upcoming test appointment. Its selectable title should now use the same format; opening the list must not cancel anything until a choice is selected.
3. With multiple designated test appointments, send `reagendar`. Both the existing-appointment choices and offered replacement times should use the new format. With a single appointment, the existing direct-to-availability behavior remains.
4. If enough test appointments are already present, check **Más citas**. List titles and `Termina:` descriptions should use month names on every page.
5. Complete the [v0.7.2 combined Calendar/message checks](CALENDAR_DETAILS.md), including rescheduling/cancellation only when intended. Existing event details and normal success messages should be retained.

Record the owner's complete result before marking the combined checkpoint PC-verified.
