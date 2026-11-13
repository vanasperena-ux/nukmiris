import test from "node:test";
import assert from "node:assert/strict";
import { fixture, ownedVolumePresent } from "./helpers.mjs";
test("fixture: labeled independent SQL volume is removed after the fixture closes", async (t) => {
  let name;
  await t.test("create and use disposable volume", async (child) => {
    const f = await fixture(child);
    name = f.volume;
    assert.equal(await ownedVolumePresent(name), true);
    assert.equal((await f.admin.query("SELECT 1 v")).rows[0].v, 1);
  });
  assert.equal(await ownedVolumePresent(name), false);
});
