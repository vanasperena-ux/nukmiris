/** Local policy model ONLY. Existing flows survive a firewall change: actual
 * instance termination and independent evidence remain mandatory. */
export class NetworkPolicyModel {
  constructor() {
    this.revoked = new Set();
    this.flows = new Map();
  }
  revoke(epoch) {
    this.revoked.add(epoch);
  }
  connect({ id, role, epoch, destination }) {
    const allowed =
      (role === "gateway" &&
        destination === "fake:443" &&
        !this.revoked.has(epoch)) ||
      (role === "fake" && destination === "restricted-google-api:443") ||
      (role === "observer" && destination === "iap-fake:443");
    if (!allowed)
      return {
        allowed: false,
        reason: "MODELED_EGRESS_DENIED",
        cloudEnforcementProven: false,
      };
    if (this.flows.has(id)) throw Error("new_connection_id_required");
    this.flows.set(id, { role, epoch, destination });
    return { allowed: true, cloudEnforcementProven: false };
  }
  existing(id) {
    return {
      allowed: this.flows.has(id),
      reason: "EXISTING_FLOW_REQUIRES_TERMINATION",
      cloudEnforcementProven: false,
    };
  }
  terminate(epoch) {
    for (const [id, v] of this.flows)
      if (v.epoch === epoch) this.flows.delete(id);
  }
}
