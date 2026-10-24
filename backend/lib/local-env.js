"use strict";
const path = require("node:path");
function loadLocalEnv() {
  if (process.env.NODE_ENV !== "test") require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
}
module.exports = { loadLocalEnv };
