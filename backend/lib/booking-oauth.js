"use strict";

const fs = require("node:fs");
const http = require("node:http");
const { randomBytes, createHash, timingSafeEqual } = require("node:crypto");
const { google } = require("googleapis");
const { BOOKING_SCOPES } = require("./google-calendar");

async function authenticateBooking({ credentialsPath, timeoutMs = 5 * 60 * 1000,
  openBrowser = async url => { const child = await require("open")(url, { wait: false }); child.unref(); },
  createClient = (id, secret, redirect) => new google.auth.OAuth2(id, secret, redirect) }) {
  const saved = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  const keys = saved.installed;
  if (!keys?.client_id || !keys.client_secret) throw new Error("Booking authorization requires a Desktop OAuth credentials file; availability authorization was not changed");
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return new Promise((resolve, reject) => {
    let client, redirect, timer, finished = false, exchanging = false;
    function finish(error, value) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      server.close();
      if (error) server.closeAllConnections();
      if (error) reject(error); else resolve(value);
    }
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method !== "GET" || url.pathname !== "/oauth2callback") { res.writeHead(404).end("Not found"); return; }
      const received = Buffer.from(url.searchParams.get("state") || "");
      const expected = Buffer.from(state);
      if (received.length !== expected.length || !timingSafeEqual(received, expected)) { res.writeHead(400).end("Invalid authorization state"); return; }
      if (exchanging || finished) { res.writeHead(409).end("Authorization already being handled"); return; }
      if (url.searchParams.has("error") || !url.searchParams.get("code")) {
        res.writeHead(400).end("Authorization was not completed", () =>
          finish(new Error("Google authorization was declined; existing availability authorization was preserved")));
        return;
      }
      exchanging = true;
      try {
        const { tokens } = await client.getToken({ code: url.searchParams.get("code"), codeVerifier: verifier, redirect_uri: redirect });
        client.setCredentials(tokens);
        res.end("Booking authorization completed. Return to the terminal.", () => finish(null, client));
      } catch {
        res.writeHead(400).end("Authorization could not be completed", () =>
          finish(new Error("Google booking authorization failed; existing availability authorization was preserved")));
      }
    });
    server.once("error", error => finish(error));
    timer = setTimeout(() => finish(new Error("Google booking authorization timed out; existing availability authorization was preserved")), timeoutMs);
    server.listen(0, "127.0.0.1", async () => {
      try {
        redirect = `http://127.0.0.1:${server.address().port}/oauth2callback`;
        client = createClient(keys.client_id, keys.client_secret, redirect);
        const url = client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: BOOKING_SCOPES,
          state, code_challenge: challenge, code_challenge_method: "S256" });
        await openBrowser(url);
      } catch (error) { finish(error); }
    });
  });
}

module.exports = { authenticateBooking };
