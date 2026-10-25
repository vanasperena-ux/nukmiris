# Connect calendar lookup on your Windows PC

These PowerShell instructions use `npm.cmd`, which is the working launcher on the owner's PC. Use it for installation, tests, and all npm scripts.

This checkpoint shows available times from Juanita's specific calendar in WhatsApp. Automatic appointment creation, rescheduling, and cancellation remain off. The cloud tests use simulations; real Google/Meta connections need verification on your PC.

## 1. Stop the old app and use a separate copy

Stop the existing Node webhook with Ctrl+C. Keep the `NukMiris-poc` folder and its files. Download this repository into a separate folder, or use PowerShell with Git installed:

```powershell
cd "$env:USERPROFILE\Desktop"
git clone https://github.com/vanasperena-ux/nukmiris.git NukMiris-next
cd .\NukMiris-next\backend
npm.cmd ci --ignore-scripts
npm.cmd test
Copy-Item .env.example .env
notepad .env
```

Use the copy command only for a new folder; preserve any existing `.env`. Use Node 24. `npm.cmd test` does not use real accounts or data.

## 2. Enter local configuration

In the new `.env`, enter these existing PC values privately:

| Setting | What to enter |
| --- | --- |
| `NUKMIRIS_DB_PATH` | Absolute path to your existing `nukmiris-sessions.sqlite` with Phase 6A.3 tables. Forward slashes work, for example `C:/Users/YOUR_NAME/Desktop/NukMiris-poc/nukmiris-sessions.sqlite`. |
| `WHATSAPP_TOKEN` | Existing Meta test access token. |
| `WHATSAPP_PHONE_NUMBER_ID` | Receiving Meta test/business phone-number **ID**, not your personal telephone number. |
| `WHATSAPP_VERIFY_TOKEN` | Value configured for the Meta webhook subscription challenge. |
| `META_APP_SECRET` | App Secret from the same Meta app's Settings → Basic. This authenticates incoming messages and differs from the access token and verify token. |
| `GOOGLE_OAUTH_CREDENTIALS_PATH` | Absolute path to the existing Google Desktop OAuth `credentials.json` on your PC. |

Keep the supplied availability mode and receiving-number routing. Keep credential values, the database, `.env`, and `.local` out of Git and chat. This app integration does not require a ChatGPT Google Drive connection.

## 3. Authorize Google and select the exact calendar

```powershell
npm.cmd run google:connect
npm.cmd run calendars:list
```

The first command opens authorization in your PC browser and stores reusable authorization in ignored `.local/google-token.json`. It requests calendar-list and free/busy access, without event-writing permission. Use the Google account that owns or can edit Juanita's calendar.

The second lists calendar names and exact IDs. Find Juanita's calendar and set its ID as `GOOGLE_CALENDAR_ID` in your local `.env`. Use the full calendar ID, which may look like a long address; do not enter `primary` or just the display name.

If existing authorization needs the new scopes, run `npm.cmd run google:connect -- --reauthorize`. The Google Calendar API and OAuth consent/test-user configuration must remain enabled, as with your earlier working prototype.

## 4. Save the mapping and check both connections

Keep the old webhook stopped:

```powershell
npm.cmd run business:configure
npm.cmd run connections:check
```

Configuration creates a timestamped backup beside the existing database, then stores the calendar ID, receiving Meta phone ID, and confirmed schedule for `juanita-nails`: Monday–Friday, 10:00–19:00, 60-minute appointments, zero gap, hourly starts, and lunch 13:00–14:00. It preserves other businesses and refuses conflicting mappings.

Expected results:

```text
Meta WhatsApp: OK (read-only sender access check; no message sent).
Google Calendar: OK (...; availability only, no events changed).
```

These check Meta token access to the sender and Google's access to the chosen calendar and its availability. The incoming webhook still needs the next step.

## 5. Start the app and reconnect the webhook

```powershell
npm.cmd start
```

Reuse your existing Cloudflare tunnel for port 3000. If you use temporary tunnels, open a second terminal and run your existing Cloudflared installation:

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

In the same Meta app, set the callback to the tunnel's HTTPS address followed by `/webhook`, enter the verify-token value from `.env`, and subscribe to WhatsApp's `messages` field. Update the callback if a temporary tunnel changes address. Incoming signatures must match `META_APP_SECRET`.

From an approved test-recipient WhatsApp account, send `Menu` first to exit any existing human-support conversation, then `Cita` to the Meta test sender. You should receive two available appointments from Juanita's calendar. **Más opciones** shows two more, followed by **Elegir fecha** for choosing a day and its available times. You may also type a date as DD/MM/AAAA. Past times, busy events, lunch, and closed days are excluded. Selecting a time checks it again without reserving it in availability mode. See [the current menu guide](BOOKING_UX.md).

For an empty future weekday, starts should be **10:00, 11:00, 12:00, 14:00, 15:00, 16:00, 17:00, and 18:00**. A 10:00–11:00 event removes 10:00 and leaves 11:00 available. An all-day busy event removes that day.

## Report back

Share whether each connection says `OK` or `FAILED`, and whether `Cita` returns the expected choices. For failures, share the command and non-secret status/error text. Do not share `.env`, tokens, credential files, or the real database. After PC availability verification, use the separate [automatic-booking checkpoint](BOOKING_CHECKPOINT.md) to opt in to confirmed new appointments.
