import { SessionController as HistoricalSessionController } from "../../b1a/runtime/session-policy.mjs";
import { retirementV2 } from "./retirement.mjs";

/** B1a-2 SQL gates require V2 before the historical controller can read or
 * recover/promote anything. The original B1a API remains a historical surface.
 */
export class SessionController extends HistoricalSessionController {
  async reconcile(bundle, attemptIds) {
    const decision = retirementV2(bundle ?? {});
    if (decision.state !== "EVIDENCE_READY")
      return { ...decision, dispatchEnabled: false };
    return super.reconcile(bundle, attemptIds);
  }
  async promote(bundle) {
    const decision = retirementV2(bundle ?? {});
    if (decision.state !== "EVIDENCE_READY")
      return { ...decision, dispatchEnabled: false };
    return super.promote(bundle);
  }
}
