/** Renewal extends an already valid SQL lease only. Expired/held authority can
 * never be recreated by a timer or process restart. No provider/cloud I/O. */
export class AuthorityHeartbeat {
  constructor({
    controller,
    intervalMs = 1000,
    onUnavailable = async () => {},
  }) {
    if (!Number.isInteger(intervalMs) || intervalMs < 50 || intervalMs > 1000)
      throw Error("bounded_authority_heartbeat_interval");
    this.controller = controller;
    this.intervalMs = intervalMs;
    this.onUnavailable = onUnavailable;
    this.running = false;
    this.pending = Promise.resolve();
  }
  async once() {
    if (!this.running) return false;
    try {
      const s = await this.controller.read();
      if (!s?.dispatchEnabled) throw Error("dispatch_held");
      const r = await this.controller.db.query(
        "SELECT proof.control_renew($1,$2,$3) renewed",
        [this.controller.sessionId, s.epoch, s.generation],
      );
      if (r.rows[0].renewed !== true) throw Error("lease_expired_or_revoked");
      return true;
    } catch {
      this.running = false;
      clearTimeout(this.timer);
      await this.onUnavailable({
        action: "INDEPENDENT_KILL_REQUIRED",
        automaticPromotion: false,
      });
      return false;
    }
  }
  start() {
    if (this.running) throw Error("heartbeat_already_running");
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.pending = this.once().finally(() => {
        if (this.running) this.timer = setTimeout(loop, this.intervalMs);
      });
    };
    loop();
  }
  async stop() {
    this.running = false;
    clearTimeout(this.timer);
    await this.pending;
  }
}
