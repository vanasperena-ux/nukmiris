"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { saveBusinessConfiguration } = require("../../lib/business-config");
const settings = require("../../config/juanita.example.json").settings;
function createDatabase(filename = ":memory:") {
  const db = new DatabaseSync(filename);
  db.exec(fs.readFileSync(path.resolve(__dirname, "../fixtures/schema.sql"), "utf8"));
  for (const id of ["synthetic-a", "synthetic-b"]) {
    db.prepare("INSERT INTO businesses VALUES (?,?,?,'America/Mexico_City','test','fixture','fixture')").run(id, `Business ${id}`, "synthetic");
    db.prepare("INSERT INTO business_settings VALUES (?,?,'10:00','19:00',60,0,60,'[]','fixture')").run(id, "[1,2,3,4,5]");
    saveBusinessConfiguration(db, { businessId: id, calendarId: `calendar-${id}`, phoneNumberId: `phone-${id}`, settings });
  }
  return db;
}
module.exports = { createDatabase, settings };
