import test from "node:test";
import assert from "node:assert/strict";
import { BillingSupervisor } from "../b1a2/runtime/billing.mjs";
test("P-5 threshold, budget reset/delay, capacity pause, worker restart, suspension/recovery and expiry never auto-enable", async () => {
  const rows = [];
  let dispatch = true;
  const c = {
      async hold(reason) {
        dispatch = false;
        return { dispatchEnabled: dispatch, holdReason: reason };
      },
    },
    s = new BillingSupervisor({
      controller: c,
      journal: {
        async append(r) {
          rows.push(r);
        },
      },
    });
  for (const percent of [50, 75])
    assert.equal(
      (await s.event({ type: "THRESHOLD", percent, at: 1 })).state,
      "ALERT_ONLY",
    );
  assert.equal(dispatch, true);
  for (const type of [
    "THRESHOLD",
    "BUDGET_ENFORCED",
    "BUDGET_RESET",
    "BILLING_DELAY",
    "CAPACITY_PAUSE",
    "ACCOUNT_SUSPENDED",
    "RESOURCE_SUSPENDED",
    "WORKER_RESTART",
    "SUSPENSION_RECOVERED",
    "SESSION_EXPIRED",
  ]) {
    const r = await s.event({ type, percent: 90, at: 2 });
    assert.equal(r.dispatchEnabled, false, type);
    assert.equal(r.automaticPromotion, false);
    assert.equal(r.recreationAuthorized, false);
  }
  assert.equal(rows.length, 12);
});
test("P-5 journal failure cannot prevent hold, unavailable SQL triggers independent emergency and stops renewal", async () => {
  let held = 0,
    stopped = 0,
    kills = 0;
  const s = new BillingSupervisor({
    controller: {
      async hold() {
        held++;
        return { dispatchEnabled: false };
      },
    },
    journal: {
      async append() {
        throw Error("custody unavailable");
      },
    },
    heartbeat: {
      async stop() {
        stopped++;
      },
    },
  });
  assert.equal(
    (await s.event({ type: "BUDGET_ENFORCED", at: 1 })).dispatchEnabled,
    false,
  );
  assert.equal(held, 1);
  assert.equal(stopped, 1);
  assert.equal(
    (await s.event({ type: "THRESHOLD", percent: 50, at: 2 })).dispatchEnabled,
    false,
  );
  const failed = new BillingSupervisor({
    controller: {
      async hold() {
        throw Error("SQL unavailable");
      },
    },
    journal: {
      async append() {
        throw Error("unavailable");
      },
    },
    heartbeat: {
      async stop() {
        stopped++;
      },
    },
    emergency: async () => {
      kills++;
      return { state: "REQUESTED_NOT_TERMINATION_PROOF" };
    },
  });
  assert.equal(
    (await failed.event({ type: "ACCOUNT_SUSPENDED", at: 3 })).state,
    "HOLD_UNCOMMITTED",
  );
  assert.equal(kills, 1);
});
import { AuthorityHeartbeat } from "../b1a2/runtime/authority.mjs";
test("P-1/P-5 independent renewal cannot restore expired/revoked authority or survive a failed renewal", async () => {
  let renewed = true,
    kills = 0,
    calls = 0;
  const h = new AuthorityHeartbeat({
    controller: {
      sessionId: "synthetic",
      async read() {
        return { dispatchEnabled: true, epoch: 1, generation: 2 };
      },
      db: {
        async query() {
          calls++;
          return { rows: [{ renewed }] };
        },
      },
    },
    onUnavailable: async () => {
      kills++;
    },
  });
  h.start();
  await h.pending;
  assert.equal(calls, 1);
  renewed = false;
  assert.equal(await h.once(), false);
  assert.equal(h.running, false);
  assert.equal(kills, 1);
  assert.equal(await h.once(), false);
  await h.stop();
});
