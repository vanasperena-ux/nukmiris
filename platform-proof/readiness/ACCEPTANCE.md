# Source acceptance matrix

Exact final measurements and source/tree pins belong to `evidence/publication.json`; this is the intended verifiable acceptance contract, not a substitute for measured logs. Native/local results never count as GCP execution. An unsupported run must be NOT EXECUTED, and failed development runs remain separately recorded.

| Requirement | Executable evidence | Expected outcome |
| --- | --- | --- |
| G1 exact corrected source / immutable base | `build-image.py`, artifact manifests and second independently exported/installed build | Same own-layer, config/image, canonical OCI and Docker-archive hashes; source file hashes match exact Git tree |
| G1 inert startup | `b1a2/build/container-smoke.mjs IMAGE` | Health200, readiness503; CLOUD/execute env cannot activate |
| G1 missing/copied identities, bad epoch, expiry, missing secrets, revocation | `readiness/image-smoke.mjs IMAGE` mounted checks | Packaged validators reject invalid states; stubbed SQL revocation holds; actual SQL separately covered by full suite |
| G1 fake mTLS/export/cleanup | `readiness/package-fake-smoke.mjs IMAGE` | One synthetic effect, unknown cert/source denied; fsynced hash-chain export verifies; fixture/container removed |
| G1 no embedded private keys/customer roots | Per-file source/dependency manifest and scan in artifact.json | No private-key/service-account/key-DB-ledger files; roots allowlisted; runtime fixtures mounted only. Base immutable pin, upstream binary semantics not exhaustively audited |
| G2/1 authenticated measurement | `readiness-transit` valid sample | COLLECTED only; no universal bound or retirement capability |
| G2/2 absent/forged/stale evidence | `readiness-transit` auth tests | HOLD, copied token rejected; independent observer/probe pins |
| G2/3,5 long delay/pre-fence write late arrival | `readiness-transit` interval tests | Preserved pre-fence identity, HOLD when candidate exceeded; no invented new initiation/resend |
| G2/4,6 frozen existing connection / post-fence write | `readiness-native-transit` + signed export | Real TLS then instrumented SIGSTOP/SIGCONT; post-fence write VIOLATION; gate HOLD |
| G2/7 wrong identity/flow | `readiness-transit`, `readiness-identity` | Wrong session/provider/cert/epoch/revision/digest/flow never accepted |
| G2/8 clock uncertainty | `readiness-transit`, existing time tests | Fence overlap/contradictory/stale/unbound clocks HOLD |
| G2/9 late canary | `readiness-transit`, existing observer/retirement | Unobserved late wake HOLD; actual authenticated forbidden REQUEST still VIOLATION |
| G2/10 insufficient cloud bound | `readiness-transit`, original V2 retirement | No measured cloud policy minted; absent/exceeded/untrusted basis stays held |
| G3/H3 partial old identity | `readiness-identity` | Old epoch with missing/conflicting revision, old revision with missing/conflicting epoch → HOLD; conclusive authenticated exact old post-fence traffic outranks partial ambiguity → VIOLATION |
| G3 identity-map/profile validation | `readiness-identity` | Unapproved pairs/observer masquerade/unknown fields rejected before listener/mounted fake startup |
| G3 adapters | Existing API/observer/time/provider/preflight/SQL/startup suites | Exact local protocol, complete active+idle gauges, logs/NAT/custody/clock/SQL roles; actual account/cloud proof NOT EXECUTED |
| G3 one human, separate authority | `readiness-operations`, `b1a2-controller/preflight` | Kill/cleanup controllers construct without deployer grants, independent fence/delete ops present; missing kill permission rejects; no independent-human claim |
| G3 seven steps / expiry / unknown outcomes | Existing session/controller/billing/startup/interruption suites | Exact seven steps, original identities retained, no auto resend/promote/re-enable after UNKNOWN/expiry/restart |
| G3 cleanup crash/restart | `readiness-operations`, `b1a2-teardown/journal` | Pending authenticated intent restored; no destructive replay; absent Terraform state needs independent exact API absence; corrupt/replaced/missing/403 remains unresolved |
| G3 complete teardown | `readiness-operations`, inventory/permission checks | 140 exact slots; manual budget and nondeletable KMS residuals explicit |
| G3 account receipts | `readiness-account` | Null template HOLD; invalid/stale/scope/FX/session/authority rejected; even valid local JSON cannot grant runtime/provisioning |
| Costs / O1–O7 | `readiness-costs`, Python model | $30/6h, restore$2 removed; tax/FX/lag/residual/repeats separated; actual FX null |
| Original safety / C1/C2 | Complete full/fault/concurrency suites | One-use permission after COMMIT, no tickets/retries on UNKNOWN, all old authenticated activity derived, V1 rejected at all B1a2 gates |
| Source preservation | `node readiness/check.mjs`, `git diff` | Accepted application, historical documents/reviews/raw evidence/hashes unchanged; only platform-proof paths changed |
| Infrastructure guard/static validity | Terraform fmt + validate (cached provider; no plan/apply) | Formatting and static validation pass; impossible apply guard and LIVE=false remain |

## Open real-cloud gates

No GCP execution, org-policy/IAM/quotas/SQL/actual SKUs, registry publication identity, network/clock/physical termination guarantee, dead-man canary lifecycle, account billing/FX/Free Trial, real resource teardown or actual residual statement proof is established. Real operator identity/access/session fields remain null. Historical missing image-source chunks remain unrepaired; the new recipe/candidate can be independently reviewed as a replacement local-source route without rewriting the old record. Future registry identity remains open. Resource-specific proposal, independent review, separately authorized read-only verification and explicit owner provisioning/spending approval are required before any change to LIVE/apply guards. A source GO does not grant deployment permission.
