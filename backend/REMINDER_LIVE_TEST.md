# Approved Meta reminders — controlled Windows PC test

This is a feature-branch candidate based on the accepted **v0.8.1** application. Package version remains 0.8.1. It does not implement the separate greenfield proposal, change dependencies/schema or activate a live deployment automatically. Use **`npm.cmd`** in PowerShell.

## What is known and what still needs verification

The owner reports the four templates approved as **Active – Quality pending** for Spanish (Mexico). This corresponds to a sendable `APPROVED` asset if the actual API contract matches. The existing application already uses these exact names and `es_MX`:

| Kind | Normal due time | Buttons | Explicit safe TTL |
| --- | --- | --- | --- |
| `nukmiris_seven_day_v1` | Start −168 hours | None | 30–900 seconds |
| `nukmiris_confirmation_v1` | Start −24 hours | Sí, confirmo; Necesito reagendar | 30–900 seconds |
| `nukmiris_followup_v1` | Start −22 hours | Same two buttons/order | 30–900 seconds |
| `nukmiris_final_v1` | Start −2 hours | None | 30–300 seconds |

The four positional body values remain customer full name, business name, full Spanish business-local appointment date and `HH:mm`. Exact copy is in [REMINDER_TEMPLATES.md](REMINDER_TEMPLATES.md). Template button indexes are strings `"0"`/`"1"`; payloads are opaque `reminder:<UUID>:confirm` / `reminder:<UUID>:reschedule`. Signed callbacks use the existing webhook and ownership checks.

Approval alone does not establish WABA/phone membership, actual text/buttons, safe custom TTL, token rights, customer permission or delivery. These require the read-only checks and PC results below. No cloud credentials, PC database or live provider access were available for this task; no real messages/events were sent/changed here.

## Changes in this candidate

- Post-dispatch exceptions and failed result persistence retain uncertainty instead of making a possible accepted send retryable. A known Meta ID is preserved when possible; signed delivery proof still wins over a later transport error.
- Optional runtime restriction holds reminder work outside **one test business + exact recipient + booking**. It also blocks out-of-scope attendance actions and reminder promises; ordinary booking/management remains available. Receipt evidence and conservative restart recovery remain recorded.
- `reminders:live-test` defaults to a read-only plan. Explicit apply changes only that booking's four pending, never-attempted occurrence due times. It keeps their identities/version and standard 15-minute validity allowance, creates a verified backup using configured retention, requires Node stopped and never sends or writes Calendar itself.
- Template checks report all four assets and specific mismatches; status reports expose scoped attempts, Meta IDs, acceptance and delivery status.

Normal intervals remain **168/24/22/2 hours**. There is no global accelerated-clock or interval switch. No consumed, previewed, failed, uncertain, accepted or obsolete occurrence can be rearmed by the test command.

## 1. Update the test checkout and run automated checks

Stop Node with Ctrl+C. Keep the existing database, credentials, Calendar mapping, webhook and local changes. From the repository root:

```powershell
git status --short
git fetch origin
git switch feature/v0.8.1-approved-reminder-testing
git pull --ff-only
cd backend
node -p "require('./package.json').version"
npm.cmd test
npm.cmd run backup:create
```

Expect package label **0.8.1**; confirm the feature branch, not only that label. Preserve local changes if Git refuses to switch. No dependency reinstall or schema preparation is required for an already prepared v0.8.1 installation. Automated tests use synthetic providers/databases and do not load the local `.env`. Do not export test-recipient variables into the shell running the suite; configure them in `.env` for the application steps below.

## 2. Check the existing test business and approved assets

Use the existing **`juanita-nails` test business** and its selected **Juanita's Nailsalon – Juanita** Calendar. Use deliberately created test appointments. Do not change real appointments to manufacture test eligibility.

```powershell
npm.cmd run reminders:status -- --business-id juanita-nails
npm.cmd run connections:check:management
```

`businessStatus` must be `test`. If it is `active`, stop: the controlled tooling deliberately refuses it. Do not relabel a production business to bypass this check. This procedure assumes the existing PC test deployment; initial dry-run can consume due preview jobs, so it should not be used as a replacement production worker.

If the business's WABA ID is missing, with Node stopped configure that existing reminder record:

```powershell
npm.cmd run reminders:prepare -- --business-id juanita-nails --waba-id YOUR_WABA_ID --language es_MX
```

Use the **WhatsApp Business Account ID**, not the phone-number ID. Repeating preparation preserves activation time and existing jobs. It makes no Meta calls, changes no Calendar events and does not enable sending. Then run:

```powershell
npm.cmd run reminders:templates -- --business-id juanita-nails --check --json
```

Require `ready: true` and all four `ok: true`. It uses the configured `WHATSAPP_API_VERSION` (default `v26.0`) and read-only Meta GETs. `quality.score` can be unknown/pending; `status` must be `APPROVED`, `category` `UTILITY`, and language `es_MX`.

| Failure | Owner action before continuing |
| --- | --- |
| `ttl_missing` / `ttl_out_of_range` | Approval can retain Meta's default long validity. Configure template-level `message_send_ttl_seconds` within the table's cap using Meta's current template controls/API, then rerun. The export command shows intended values; it does not update assets. Do not loosen the checker. |
| Body/variables/buttons/language mismatch | Compare the approved asset with the exact export and documented copy/order. Resolve the specific asset/configuration; do not silently remap variables or redesign copy. |
| Sender/WABA mismatch | Select the WABA that actually owns the configured sending number. Each business needs its own valid account/assets. |
| HTTP 401/403 | Fix the local token's validity and account access. It needs `whatsapp_business_messaging` to send and normally `whatsapp_business_management` to inspect assets. Never paste tokens into chat/GitHub. |
| Paused/rejected/disabled/unavailable | Restore an approved available asset before proceeding. No free-form fallback exists. |

Keep existing `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`, Google booking authorization and exact Calendar mapping locally. The code changes none of them. The current Cloudflare tunnel must reach `/webhook`, and the Meta app must be subscribed to the sending WABA's `messages` callbacks for incoming replies and delivery statuses. Keep tunnel, internet and Node online throughout testing.

## 3. Create a fresh eligible appointment and record actual permission

While still in the existing PC **dry-run** reminder mode, with the three new test restriction values blank, start Node and book a **new test appointment 8–10 days ahead** through WhatsApp. A shorter lead time cannot naturally create all four occurrences. Existing appointments are not imported. Stop Node after the successful booking and inspect:

```powershell
npm.cmd run reminders:status -- --business-id juanita-nails
```

Identify its `booking_request_id`, raw `sender`, date and four pending jobs. The test recipient must be your explicitly authorized test phone. Copy the **raw WhatsApp sender ID** exactly from this local report: digits only, no `+`. A Mexican raw sender can begin `521` even though outbound/display normalization uses `52`; do not substitute a different identity.

Booking or template approval does not grant permission. The test recipient must actually agree to receive reminder messages from the named business. If that genuine evidence is not already recorded, record it locally. Example **only after the test recipient gives that permission**, using their actual wording/time/reference:

```powershell
$testWhatsappId = "EXACT_RAW_SENDER_ID"
$testBookingId = "EXACT_BOOKING_REQUEST_ID"
$permissionTime = (Get-Date).ToString("o")
npm.cmd run reminders:permission -- --business-id juanita-nails --whatsapp-id $testWhatsappId --grant --occurred-at $permissionTime --source owner-controlled-test --wording "Quiero recibir recordatorios de mis citas de Juanita's Nailsalon por WhatsApp." --evidence "YOUR_ACTUAL_TEST_PERMISSION_REFERENCE" --recorded-by "YOUR_NAME"
```

Do not invent evidence or overwrite a withdrawal. Grant recording requires the registered customer in that business. Confirm the appointment report now says `reminderPermission: granted`.

## 4. Restrict the runtime before scheduling any live tests

With Node stopped, set these in local `.env`, replacing placeholders with the exact values above:

```dotenv
NUKMIRIS_REMINDERS_MODE=dry-run
NUKMIRIS_REMINDER_POLL_MS=30000
NUKMIRIS_REMINDER_TEST_BUSINESS_ID=juanita-nails
NUKMIRIS_REMINDER_TEST_RECIPIENT=EXACT_RAW_SENDER_ID
NUKMIRIS_REMINDER_TEST_BOOKING_ID=EXACT_BOOKING_REQUEST_ID
```

Keep the existing required gates: booking mode, management/reliability enabled and receiving-number routing. Set **all three** restriction fields together. Invalid/partial scope fails closed; it never widens the selection. The selected business must remain `test`.

First preview; it is read-only and performs no provider calls:

```powershell
npm.cmd run reminders:live-test -- --business-id juanita-nails --whatsapp-id $testWhatsappId --booking-request-id $testBookingId
```

Check the recipient, booking, date, Calendar and all four job IDs. `requiredEnvironment` must match `.env`. The preview's `dueUtc` values are UTC; `dueAt`/`expiresAt` are Unix milliseconds. Then explicitly authorize that exact recipient and apply:

```powershell
npm.cmd run reminders:live-test -- --business-id juanita-nails --whatsapp-id $testWhatsappId --booking-request-id $testBookingId --apply --authorize-recipient $testWhatsappId
```

Apply creates a verified backup before changing any due times. It rechecks worker ownership and eligibility in a transaction. It changes only these four unattempted current-version occurrences, retaining normal business interval settings and all other appointments' jobs. It refuses a running backend or consumed/dry-run/uncertain jobs; use a fresh test booking rather than resetting them.

## 5. Send the four templates in a controlled run

After apply, change **only** `NUKMIRIS_REMINDERS_MODE=live`; retain all three restriction values. Start promptly:

```powershell
npm.cmd start
```

Require both `Appointment reminders: live` and the **one test business, authorized recipient and booking only** restriction message. Startup verifies the selected business's four approved assets. If it fails, resolve the named blocker; do not remove the restriction to get past it.

For this first run, **do not confirm or request rescheduling until all four messages have arrived**:

| Approximately after apply | Expected observation |
| --- | --- |
| 2 minutes | Seven-day template arrives with the real test appointment date/time and no buttons. |
| 4 minutes | Confirmation template arrives with both buttons; leave it unanswered. |
| Before 8 minutes | Verify the confirmation request has `meta_status: delivered` or `read` through a signed callback. API `accepted` alone is insufficient. |
| 8 minutes | Follow-up arrives only if that delivery proof exists and no response/change occurred. |
| 12 minutes | Final template arrives with no buttons, even while attendance remains pending. |

Polling adds up to about 30 seconds under normal conditions; this is not a delivery guarantee. The ordinary 15-minute submission allowance still applies. The four actual appointment offsets were not changed globally; this is an explicitly authorized test of the real sender/lifecycle using accelerated occurrence due times. Visible messages still show the actual future appointment date, not a fabricated “today.”

Use a second PowerShell window in `backend`:

```powershell
npm.cmd run reminders:status -- --business-id juanita-nails
```

`recentJobs` contains job/booking/version, attempts, `accepted_at`, `meta_message_id`, `meta_status` and errors; `attempts` contains persisted attempt outcomes. Match the selected booking and each kind. `accepted` means the API accepted the request. Only **`delivered`/`read`** proves delivery; also inspect the actual WhatsApp screen. Reports intentionally include local customer/provider identifiers; redact them before sharing publicly.

Established rule preserved: if the follow-up is processed before delivery proof exists, it is **skipped permanently**, even if proof arrives later inside the allowance. This task does not change that policy. If needed, repeat using a fresh test booking after fixing callbacks; never reset the skipped job.

## 6. Verify replies, management and restart behavior

Use designated fresh test bookings for independent cases. While the current three-field restriction remains enabled, ordinary WhatsApp booking can create another booking normally; its reminders remain held until you stop Node and explicitly repoint the booking restriction. Never clear the restriction while live to switch test cases. Repeat permission/plan/apply only for the newly selected, eligible booking.

| Case | Expected result |
| --- | --- |
| After the four-message run, tap **Sí, confirmo** on its request/follow-up | Exactly that Calendar event gains ` — Confirmada` once. ID/time/customer description remain intact; WhatsApp acknowledges success and report says `CONFIRMED`. Tap again: no second Calendar patch/suffix. |
| Confirm a fresh test booking after its 4-minute request | The follow-up becomes skipped; the 12-minute final still sends. |
| Tap **Necesito reagendar** | Availability opens for that exact appointment. The original stays until replacement succeeds. Completing a move keeps the event ID/details, resets attendance, increments schedule version and invalidates old jobs/buttons. New jobs use normal timing until explicitly planned for a fresh current schedule. |
| Cancel before a reminder | Use normal WhatsApp cancellation for the selected test appointment; remaining jobs are skipped and old actions cannot update it. |
| Reschedule before a reminder | Old schedule jobs cannot send; replacement has its own current jobs/actions. No automatic acceleration carries across. |
| Restart before a due time | Stop/start Node with the same restriction and database; selected pending jobs persist and other bookings remain held. |
| Interrupted/unknown send | A `sending` job recovered after restart becomes `uncertain`, not automatically resent. A later matching signed receipt may resolve it. Preserve evidence; do not clear/reset jobs to force delivery. |
| Delayed/foreign/old button | It cannot update another business/customer or replacement schedule. Human chat still takes priority; send `menu` before testing automation again. |

Transient rejection, database failure after send, lost responses, duplicate ticks, exact 168/24/2-hour boundaries, tenant attacks and crash timing are automated fault tests. Do not break live credentials or send fault-injection traffic to real customers to reproduce them.

## 7. End the test safely

Stop Node. Set `NUKMIRIS_REMINDERS_MODE=off` (or the previous dry-run mode) **before** clearing any restriction fields. If returning to dry-run, retaining the restriction keeps unrelated preview jobs held. Keep the test restriction if investigating any unresolved send/attendance operation. Do not restore the pre-test database to undo messages/events: external effects already happened.

Cancel designated test appointments through the normal management flow when finished. Do not bulk-delete Calendar or database records. Switching to general production sending is a separate explicit owner decision; removing the restriction while mode is live makes all normally enabled/eligible business jobs eligible for processing. No production activation is performed by this branch.

## Acceptance record and remaining limits

Record the candidate Git commit, PC suite result, four per-kind job/message IDs and delivered/read outcomes, recipient authorization reference, successful Calendar confirmation/management and restart result. Exact current automated results and requirement coverage are in [the activation report](../docs/testing/v0.8.1-approved-reminder-validation.md).

**Ready for controlled PC live testing once the local readiness/permission checks pass. Real end-to-end success remains unverified until the owner records these observations.** API/status access, actual approved TTL/content, token/WABA rights, callbacks and Google's live attendance response can still block completion. The PC/tunnel must remain online; no always-on hosting, distributed coordination, dashboard or new business feature is included. Current conservative unknown-send behavior prevents blind duplicates, but no exactly-once external delivery guarantee is possible after a lost provider response.
