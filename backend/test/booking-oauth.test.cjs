"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { google } = require("googleapis");
const { authenticateBooking } = require("../lib/booking-oauth");
const { BOOKING_SCOPES } = require("../lib/google-calendar");

test("booking consent uses loopback, state, PKCE, and explicit consent without a real browser or Google request", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-booking-oauth-"));
  try {
    const credentialsPath = path.join(directory, "synthetic-credentials.json");
    fs.writeFileSync(credentialsPath, JSON.stringify({ installed: { client_id: "synthetic-client", client_secret: "synthetic-secret" } }));
    let challenge, redirect, tokenCalls = 0;
    const authorized = await authenticateBooking({ credentialsPath,
      createClient: (id, secret, callback) => {
        const client = new google.auth.OAuth2(id, secret, callback);
        client.getToken = async args => {
          tokenCalls++;
          assert.equal(args.code, "synthetic-code");
          assert.equal(args.redirect_uri, redirect);
          assert.equal(createHash("sha256").update(args.codeVerifier).digest("base64url"), challenge);
          return { tokens: { refresh_token: "synthetic-refresh", scope: BOOKING_SCOPES.join(" ") } };
        };
        return client;
      },
      openBrowser: async value => {
        const url = new URL(value);
        assert.equal(url.searchParams.get("prompt"), "consent");
        assert.equal(url.searchParams.get("access_type"), "offline");
        assert.equal(url.searchParams.get("code_challenge_method"), "S256");
        assert.deepEqual(url.searchParams.get("scope").split(" "), BOOKING_SCOPES);
        challenge = url.searchParams.get("code_challenge");
        redirect = url.searchParams.get("redirect_uri");
        assert.equal(new URL(redirect).hostname, "127.0.0.1");
        const invalid = await fetch(`${redirect}?code=synthetic-code&state=wrong-state`);
        assert.equal(invalid.status, 400); await invalid.arrayBuffer();
        const valid = await fetch(`${redirect}?code=synthetic-code&state=${encodeURIComponent(url.searchParams.get("state"))}`);
        assert.equal(valid.status, 200); await valid.arrayBuffer();
      },
    });
    assert.equal(authorized.credentials.refresh_token, "synthetic-refresh");
    assert.equal(tokenCalls, 1);
    assert.equal(fs.readdirSync(directory).length, 1, "OAuth transport itself must not write or replace any token file");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("declined Google booking consent leaves existing files unchanged", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nukmiris-booking-oauth-declined-"));
  try {
    const credentialsPath = path.join(directory, "synthetic-credentials.json");
    const contents = JSON.stringify({ installed: { client_id: "synthetic-client", client_secret: "synthetic-secret" } });
    fs.writeFileSync(credentialsPath, contents);
    await assert.rejects(authenticateBooking({ credentialsPath, openBrowser: async value => {
      const url = new URL(value);
      const response = await fetch(`${url.searchParams.get("redirect_uri")}?error=access_denied&state=${encodeURIComponent(url.searchParams.get("state"))}`);
      assert.equal(response.status, 400); await response.arrayBuffer();
    } }), /declined/);
    assert.equal(fs.readFileSync(credentialsPath, "utf8"), contents);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
