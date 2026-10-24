"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { authenticate } = require("@google-cloud/local-auth");
const { loadLocalEnv } = require("../lib/local-env");
const { READ_SCOPES, tokenPath, loadCalendarClient } = require("../lib/google-calendar");

function persistAuthorization(client, credentialsPath, destination) {
  const raw = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  const keys = raw.installed || raw.web;
  if (!keys?.client_id || !keys.client_secret) throw new Error("The Google Desktop OAuth credentials file is incomplete");
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
      client_secret: keys.client_secret, refresh_token: refreshToken }), { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, destination);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

async function main() {
  loadLocalEnv();
  const destination = tokenPath();
  if (fs.existsSync(destination) && !process.argv.includes("--reauthorize")) {
    await loadCalendarClient().calendarList.list({ maxResults: 1 });
    console.log("Existing Google authorization works. No authorization file was replaced.");
    return;
  }
  if (!process.env.GOOGLE_OAUTH_CREDENTIALS_PATH) throw new Error("Set GOOGLE_OAUTH_CREDENTIALS_PATH to your existing Desktop OAuth credentials file");
  const credentialsPath = path.resolve(__dirname, "..", process.env.GOOGLE_OAUTH_CREDENTIALS_PATH);
  if (!fs.existsSync(credentialsPath)) throw new Error("The configured Google credentials file does not exist");
  console.log("Opening Google authorization in your PC browser for calendar listing and availability access.");
  const client = await authenticate({ keyfilePath: credentialsPath, scopes: READ_SCOPES });
  persistAuthorization(client, credentialsPath, destination);
  console.log("Google authorization saved locally. Credentials and tokens were not printed.");
}

if (require.main === module) main().catch(error => {
  console.error(error.message.startsWith("Set ") || error.message.startsWith("Google returned") || error.message.startsWith("The configured")
    ? error.message : "Google authorization failed. Check the credentials path, consent, and local browser; no token values are shown.");
  process.exitCode = 1;
});

module.exports = { persistAuthorization };
