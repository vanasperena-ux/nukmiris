"use strict";

const { DateTime } = require("luxon");

function slotLabel(iso, timeZone) {
  const date = DateTime.fromISO(iso, { zone: timeZone }).setZone(timeZone).setLocale("es");
  if (!date.isValid) throw new Error("A valid slot timestamp and business timezone are required");
  const label = date.toFormat("ccc d LLL HH:mm").toLowerCase();
  if (label.length > 20) throw new Error("WhatsApp slot label exceeds 20 characters");
  return label;
}

module.exports = { slotLabel };
