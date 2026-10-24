"use strict";

async function checkMeta({ token, phoneNumberId, apiVersion = "v26.0", request = fetch }) {
  if (!token || !phoneNumberId) throw new Error("Set the local WhatsApp token and phone-number ID first");
  const response = await request(`https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}?fields=id`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Meta access check failed (HTTP ${response.status}); review your local token and phone-number ID`);
  const result = await response.json();
  if (result.id !== phoneNumberId) throw new Error("Meta returned a different phone-number ID");
  return true;
}

async function listWritableCalendars(client) {
  const choices = [];
  let pageToken;
  do {
    const result = await client.calendarList.list({ maxResults: 250, ...(pageToken ? { pageToken } : {}) });
    for (const item of result.data.items || []) {
      if (item.id && ["owner", "writer"].includes(item.accessRole)) choices.push({ id: item.id, name: item.summary || item.id });
    }
    pageToken = result.data.nextPageToken;
  } while (pageToken);
  return choices;
}

module.exports = { checkMeta, listWritableCalendars };
