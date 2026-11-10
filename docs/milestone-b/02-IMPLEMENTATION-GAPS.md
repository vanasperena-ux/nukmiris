# Milestone B implementation gaps and acceptance matrix

**Planning only, 2026-11-09 (America/Mexico_City).** Evidence is the exact accepted
executable and ADR pins in [01](01-CLOUD-ARCHITECTURE-RECONCILIATION.md), not an
assumption that the local adapter is cloud-ready. Accountable roles below must be
assigned to people before execution. No package is authorized by this table.

Gate names: **D** independent design review; **I** owner implementation charter;
**P** separate owner provisioning approval; **B1a** synthetic platform proof;
**B1b** synthetic application proof; **B2** separately authorized controlled real
providers; **C** later commercial/customer onboarding. B2 is not ADR Phase 3b.

## Prioritized gaps

| ID / priority | Actual source evidence / missing component | Proposed verifiable correction | Accountable / gate |
|---|---|---|---|
| B-G01 / blocker | ADR rev3/review05 permits test design; no Cloud Run fence, harness, cloud invoice or teardown proof exists. Local acceptance is bounded. | Publish versioned charter/resource inventory, separate I/P gates and immutable image/source pins. Run 3a before app proof; retain every failed schedule. Never infer approval from credit or a draft PR. | Architecture lead + owner / D,I,P |
| B-G02 / blocker | `dispatch-once.ts` invokes a synthetic provider after SQL COMMIT via a local one-use continuation. No externally authenticated epoch ticket/gateway; F13 retained counterexample. | Specify ticket issuance/consumption SQL and gateway protocol binding original attempt, operation, digest, purpose, business/permission/channel/calendar/grant revisions, recovery AND deployment epochs, authenticated caller and absolute expiry. Lost COMMIT/response cannot recreate a permit. Concurrent/replayed ticket gives at most one physical fake invocation. | Safety implementer / D,B1a,B1b; OPS01 before B2 |
| B-G03 / high | `UnitOfWork` accepts only local fixture endpoints, `ssl:false`, max8 pools. `roles.sql:15` requires BYPASSRLS; role scope and restore compare `session_user`/`wp1_recovery`. | Separate cloud adapter; TLS/IAM connector or explicitly reviewed equivalent. Prove managed bootstrap privileges, actual `rolbypassrls`, role membership/ownership, actual IAM login→scope mapping and restore principal. PostgreSQL17 permits a non-superuser to change BYPASSRLS only if it has that attribute; Cloud SQL does not expose ordinary SUPERUSER. Do not assume the local bootstrap works unchanged. No RLS removal or runtime cloudsqlsuperuser shortcut. Test all negative role/tenant/forged-seal/restore cases using actual managed login identities. | DB/security implementer / D; minimal fixture B1a; full contract B1b |
| B-G04 / blocker | `local/custody.mjs` holds writer HMAC/AES and witness private key on the same host. `archive/protocol.ts` and X1 explicitly permit a signed larger fork. | Implement a separate verifier/key domain that validates **both record-chain and authenticated-index extension** before signing/accepting heads. Prove stable-key non-membership/inclusion, duplicate denial, old-key re-pointing denial, malicious writer, missing proofs/tail, fork/rollback and cross-tenant roots. No Cloud Run writable-disk SQLite, shared keys, or GCS FUSE SQLite substitution. | Custody/security implementer / D,B1b; production009/017 remain open until reviewed proof |
| B-G05 / high | Archive repair N2/N3 and A2/A3 gates remain; local mutex/SQLite durability is not multi-instance storage custody. | GCS immutable unique objects + CAS head + independently verified append protocol (or another separately justified store preserving the contract). Bounded remote witness calls, idempotent original-key resolution after ambiguous CAS, writer fencing, authenticated atomic forensic-copy completion and signed repair disposition. Kill repair/backup at every cut; missing/incompatible archives quarantine. | Storage/recovery implementer / B1b; production011/017 |
| B-G06 / blocker | No old-revision kill controller or measured D. Heartbeats may stop while a process is frozen. | Fixed rev3 release sequence; unique epoch tags; independent kill principal; platform deletion/zero-instance evidence after reporting delay, logs where available and dead-man challenges. Test existing socket, partial write, request timeout, CPU late-resume, old tags and control-plane outage. Never promote on missing evidence. | Platform/safety implementer + kill holder / B1a; real OPS01 before B2 |
| B-G07 / high | No enforceable cloud network/IAM admission policy; Private Google Access can reach API VIPs. | All-traffic VPC + attached network required; deny no-VPC/private-ranges-only deployment. Dedicated gateway NAT subnet, default-deny non-gateway provider egress, test IPv4/IPv6/DNS/alternate path. KMS decrypt of stored sending tokens only gateway; separate app-secret signature authority. Org/no-org enforcement limits explicit. | Cloud security implementer / D,B1a |
| B-G08 / high | `booking-worker.mjs` is loopback synthetic UI/auth, `/api/session` selects test personas; `admit-input.ts` text/receipt schema is not complete Meta wire format. | Keep existing server local. Separate authenticated cloud synthetic test endpoint/UI adapter; no public persona selector or fault endpoint. Future Meta app-bound HMAC raw-body verification and strict wire→canonical conversion, server-owned WABA/phone routing, full interactive/status contracts and stable provider IDs. Body/depth/size/fairness limits, mixed-tenant STOP and no ACK on incomplete custody. | Ingress implementer / B1b; real wire contracts B2 |
| B-G09 / high | Local process holds ingress/sealer/reducer/dispatch/result pools and key custody; global restore relies on privileged fixture role. | Per-process least-privilege principals; independent sealer and gateway; private separate result identity; migration/manual inert restore outside runtime/CI. Normal never-entered expiry worker is distinct from privileged restore. Prevent worker borrowing sealer/result/decrypt authority. Failure injection proves verifier/result unavailable means safe hold. | Security/DB implementers / D,B1b |
| B-G10 / high | Local timers run RecoveryWorker and polling; no continuous cloud worker deployment, backpressure, connection quota or health alerts. | One manually scaled continuous worker pool initially, or reviewed instance-billed min1 fallback; no request-CPU-after-ACK scheduling. Durable SQL cursor/due state, bounded pools, fairness and time windows; termination/restart/duplicate-worker tests, due-lag and zero-worker alarms. No reminders expansion without its separate feature/gate acceptance. | Runtime/operations implementer / B1a,B1b |
| B-G11 / high | Coherent laptop backup stops writer and bundles local archive, witness, keys and SQL ledger. No independent export/PITR cloud recovery drill. | Consistent cloud backup frontier plus independently trusted later suppression/permission heads; restore new DB inert/no decrypt/egress, verify original IDs and unknown protections, advance epoch before attachment. Restore export-alone, SQL-only loss, archive-only loss, stale witness/missing key, lost tail and old primary return. No safe-write RTO claim. | Recovery implementer + custodian / B1b |
| B-G12 / high | No real Calendar/Meta transport, receipt correlation, per-frame partial-send custody or customer-specific token lifecycle. Synthetic provider explicitly rejects real mode. | Build only fake HTTP adapters for B1 over the gateway path. Before B2, separately implement/review zero-retry transports/deadlines, Calendar ID/ETag/deleted-ID and duplicate acceptance behavior, Meta receipt correlation/partial sends and A/B revocation latency. Preserve001/013/016 and OPS01; no absence→failure inference. | Provider/safety implementer / B1b,B2 |
| B-G13 / blocker before B2 | `customer-name.ts` accepts some capitalized single words; owner accepted only local synthetic residual. No explicit name-confirmation state/action. | Before real WhatsApp, select slot→capture proposed name→explicit confirm/edit/cancel→revalidate→book. Bind confirmation to tenant/subject/name digest/slot/revision/expiry and consume transactionally once. Stale/replayed/cross-tenant/crash/command/cancellation tests; zero booking effects before confirmation. Known-customer booking flow is not given an unrelated extra confirmation. | Conversation implementer + owner UX acceptance / B2; owner disposition for B1b synthetic extension |
| B-G14 / high | Global `Route` has business/WABA/number/revision, composite tenant FKs and scoped archives; no portfolio/connection/grant lifecycle or Embedded Signup. | Implement design accommodations in doc05: business-owned assets; versioned environment/app/asset and credential references; no global NukMiris WABA assumption; future onboarding control plane. Per-business token/template/billing/offboarding tests. **No Embedded Signup implementation in B1/B2.** | Architecture/identity implementer / D,B1 architecture; C implementation |
| B-G15 / high | Earlier ADR cost lines are illustrative; current trial quotas/org/payer not inspected. No staffed shutdown runbook or measured invoice. | Itemized gross-cost model and sensitivities (04), named billing/cleanup/kill roles, bounded instance/log/storage/test counts, elapsed-time expiry and fully itemized teardown (03). Alerts-only vs service spend caps distinguished. No billing upgrade or commitments. | FinOps/operations owner / D,P,B1a |
| B-G16 / high before real data | No approved real-data region, privacy/retention/key-erasure contract, production operator auth or signed independent audit custody. | Choose regions/legal roles, retention/PITR/key windows and audit access; test erasure across wrapped keys/backups and mixed-tenant raw custody. No retention lock by default. Hardware-key/MFA operator identity, scoped break-glass, immutable approvals/image provenance; no plaintext PII/tokens in logs. | Owner + security/custody/legal reviewers / D for design; B2/C before applicable data |

Cloud SQL [user privileges](https://docs.cloud.google.com/sql/docs/postgres/users),
[IAM authentication](https://docs.cloud.google.com/sql/docs/postgres/iam-authentication)
and PostgreSQL17 [ALTER ROLE](https://www.postgresql.org/docs/17/sql-alterrole.html)
support B-G03's compatibility concern. This is a static design risk, **not a
reproduced Cloud SQL failure**: no instance was accessed. IAM authentication needs
encrypted connections and connector support must be confirmed for the selected
Node/proxy version, including sidecar resource costs and actual `session_user`.

## Functional/register traceability

| Register IDs | B1 treatment | Later required evidence |
|---|---|---|
| NM-001/003/004/005/008/009/011/013,029,031/032,033,035/036/037/043/045 | Preserve accepted menu, copy, complete summaries, labels, date grammar, details and quiet support; run existing fixtures through cloud application path | Genuine WhatsApp payload/list/date fidelity in B2; completed management is not implied |
| NM-040/042,041 | Retain accepted Test17C and automated capacity/buffer/replay protections; add cloud concurrency/network/restart schedules without resetting owner fixtures | Actual Meta old-button and ordering behavior later; no owner Test17C repeat requested |
| NM-015/017/019/020/023/026/027 | Architecture provides tenant integration health, WABA-specific template/consent state, held errors and audit; no fake claim of live compliance | Auth failure, templates, consent/opt-out and channel failure semantics before enabled real sends/reminders |
| NM-018/024/028/030/039 | Preserve uncertainty/status/permission and ordered-reply facts; structured held status never counted as success | Reminder audit/customer toggle/recovery tooling/acknowledgments require separate approved increments; no arbitrary Ana clearing |
| NM-006/007/010,012/014/016/021/022/025/034/038/044 | Existing honest management unavailability, unknown-text policy and overlap constraints remain; record unfinished scope | Separate owner-authorized management/inbox/configuration/capacity-policy work; no Services or deferred NLP implementation |

## Small implementation packages to propose after review

Estimates are engineer-days, not promises or labor costs hidden in infrastructure
prices. Review/owner/Meta turnaround is additional. Stop at each package boundary.

| Package | Deliverable | Rough effort | Stop/go |
|---|---|---:|---|
| B1-P0 | Freeze reviewed contracts, actual account quota/region check, managed SQL role design and exact priced resource plan | 2–4 | Owner I/P gates; no automatic resource creation |
| B1-P1 | Purpose-built minimal platform epoch/ticket harness, fake ledger, fence/kill and connection instruments | 6–10 | Local tests and independent review before cloud execution; then3a evidence gate |
| B1-P2 | Candidate independent cloud custody/verifier/repair adapter and adversarial X1/chain/index tests | 6–10 | Review009/011/017 evidence; no app promotion on a monotonic witness alone |
| B1-P3 | Accepted application + cloud SQL/ingress/gateway/result adapters and restricted synthetic UI; preserve accepted source | 5–8 | All B1b functional/fault/isolation tests and original-ID uncertainty protections |
| B1-P4 | Custody-only/PITR inert recovery, release/rollback/expiry/cleanup and cost evidence | 3–5 | Independent B1 review and explicit owner closure; B2 stays disabled |

B1a can be reviewed and run before P2/P3; failure may change the platform design.
Do not implement the entire package table under a planning approval. Explicit name
confirmation and real-provider contracts are separately scoped prerequisites for
B2; commercial Embedded Signup is later. Small safe increments have priority over
claiming a quick unchanged-container deployment.
