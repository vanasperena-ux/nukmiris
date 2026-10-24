"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { authenticate } = require("@google-cloud/local-auth");
const { loadLocalEnv } = require("../lib/local-env");
const { READ_SCOPES, BOOKING_SCOPES, tokenPath, loadCalendarClient, verifyBookingAuthorization } = require("../lib/google-calendar");
const { authenticateBooking } = require("../lib/booking-oauth");

function persistAuthorization(client, credentialsPath, destination, requestedScopes = READ_SCOPES) {
  const raw = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  const keys = raw.installed || raw.web;
  if (!keys?.client_id || !keys.client_secret) throw new Error("The Google Desktop OAuth credentials file is incomplete");
  const granted = client.credentials.scope ? client.credentials.scope.split(/\s+/) : requestedScopes;
  if (!requestedScopes.every(scope => granted.includes(scope) || granted.includes("https://www.googleapis.com/auth/calendar"))) {
    throw new Error("Google did not grant all requested permissions; existing authorization was preserved");
  }
  let refreshToken = client.credentials.refresh_token;
  if (!refreshToken && fs.existsSync(destination)) {
    const previous = JSON.parse(fs.readFileSync(destination, "utf8"));
    if (previous.client_id === keys.client_id) refreshToken = previous.refresh_token;
  }
  if (!refreshToken) throw new Error("Google returned no reusable authorization. Revoke the old app grant in your Google account and authorize again");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify({ type: "authorized_user", client_id: keys.client_id,
      client_secret: keys.client_secret, refresh_token: refreshToken, nukmiris_scopes: granted }), { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, destination);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

async function main() {
  loadLocalEnv();
  const booking = process.argv.includes("--booking");
  const destination = tokenPath({ booking });
  if (fs.existsSync(destination) && !process.argv.includes("--reauthorize")) {
    if (booking) await verifyBookingAuthorization();
    await loadCalendarClient({ booking }).calendarList.list({ maxResults: 1 });
    console.log("Existing Google authorization works. No authorization file was replaced.");
    return;
  }
  if (!process.env.GOOGLE_OAUTH_CREDENTIALS_PATH) throw new Error("Set GOOGLE_OAUTH_CREDENTIALS_PATH to your existing Desktop OAuth credentials file");
  const credentialsPath = path.resolve(__dirname, "..", process.env.GOOGLE_OAUTH_CREDENTIALS_PATH);
  if (!fs.existsSync(credentialsPath)) throw new Error("The configured Google credentials file does not exist");
  console.log(booking ? "Opening Google authorization for appointment creation; the verified availability authorization stays separate."
    : "Opening Google authorization in your PC browser for calendar listing and availability access.");
  const scopes = booking ? BOOKING_SCOPES : READ_SCOPES;
  const client = booking ? await authenticateBooking({ credentialsPath }) : await authenticate({ keyfilePath: credentialsPath, scopes });
  persistAuthorization(client, credentialsPath, destination, scopes);
  if (booking) await verifyBookingAuthorization();
  console.log("Google authorization saved locally. Credentials and tokens were not printed.");
}

if (require.main === module) main().catch(error => {
  console.error(error.message.startsWith("Set ") || error.message.startsWith("Google returned") || error.message.startsWith("The configured")
    ? error.message : "Google authorization failed. Check the credentials path, consent, and local browser; no token values are shown.");
  process.exitCode = 1;
});

module.exports = { persistAuthorization };
