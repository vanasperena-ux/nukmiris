# Technical gaps, verification experiments and risk register

WP0 investigates specification and static evidence only. None of the proposed vNext PostgreSQL, archive, process, provider, recovery or deployment experiments has run. The unchanged baseline test execution is separately recorded under evidence/. Experiment owner means proposed accountable role, not assigned staff. Codex produces evidence; Claude independently reviews; owner authorizes each package/resource activation.

## Step 2B dispositions and verifiable solutions

| Gap | Recommended design / conservative fallback | Exact experiment and acceptance | Proposed owner / stage | Evidence / result |
|---|---|---|---|---|
| G01 | Closed by C01 latest approval; preserve name-after-time and optional future consent | P-W03/C04 and MVP-C01 | Codex WP3/M1, Claude CP3 | Signed scenario verified; new tests NOT RUN |
| G02 | Candidate parsing and trusted origin/adoption, preserve original event text; ambiguous association unmanaged, zero sends | E08 + MVP-O02/O04/O05/O07/O08/O09; cases below | Codex M3; Claude before manual adoption | Design only, NOT RUN |
| G03 | Purpose-specific consent evidence; exact fresh account/number/template checks; no-send when eligibility uncertain | E04/E05/E12, SEC02, DB07; actual account contracts required | Codex WP4/M0/M1, owner supplies dedicated test authorization, Claude CP4 | Existing historical excerpts attributed; current eligibility UNVERIFIED |
| G04 | Sealed admissions, immutable nontransferable attempts, one mutator and read-only uncertain reconciliation | E01/02/03/06/10/11 + F01–F30 | Codex WP1/2/5, Claude CP1/2/5 | Mechanism unproved; NOT RUN |
| G05 | Stable default resource; employee capacity independent of Calendar; event-aware busy mapping; union protections | E02/E08 + DB02–05; solo→team retains ID, two resources may overlap | Codex WP2/M2, Claude CP2 | Model only, NOT RUN |
| G06 | Product policy CLOSED Option A; business dispatch/execution head gates every automated effect | DB08/F12/F27/MVP-B01/B02; no queued/catch-up/uncertain retry on reactivation | Codex WP1 synthetic, M6 billing; Claude | Policy verified in Git; execution NOT RUN |
| G07 | Attendance provenance separate; survey purpose/eligibility, optional no-send fallback | MVP-C12/O10, E04/05; absent response remains unverified | Codex M7; provider/owner legal evidence before activation | NOT RUN; template/purpose UNVERIFIED |
| G08 | Participant-aware disabled add-on profile; imported-only one-time intro; explicit commands win | MVP-C09/C10, E04/E08 actual coexistence/account echo capture | Codex M0/M4; owner-authorized eligible number | Provider coexistence UNVERIFIED; no bot-takeover substitute |
| G09 | Objective safety and performance/ops thresholds proposed in 07; per-case evidence, no aggregate waiver | E09/OPS01, CP1–6, owner PC + pilot | Codex WP5/6/M8; owner later launch targets | Proposed only, NOT RUN |
| G10 | 178-row N/T/S worksheet and supersession ledger; request original interview export only | COVERAGE-D001–178 + all 37 and 49 rows; independent crosscheck | Codex WP0; Claude coverage review | Repository evidence verified; originals SOURCE NOT AVAILABLE |

### G02 candidate association contract (future M3)

Proposed optional explicit fields: `Cliente`, international `WhatsApp`, canonical `Servicio`, and a stable business-owned resource reference in team mode. Free-form title/description patterns can propose a candidate; no mandatory owner syntax is silently imposed. One unambiguous phone/service candidate and exact business-local duration/resource/time are required even for a high-confidence suggestion. Reject conflicting repeated fields, multiple numbers, malformed/all-day/recurring unsupported event, copied identity properties with a new event ID, wrong location, stale employee/service, invalid lengths and ambiguous normalized numbers. An existing trusted app event is recognized only by the exact local full tuple; a copy with matching properties is still a different event.

Stages: observe original event/version → parse candidate → verify current business-scoped contact/identity provenance and resource/service → authorized association/adoption evidence → evaluate distinct messaging purpose/permission → future-only eligible work. Phone formatting or existing number match alone cannot prove current person/consent (typos/recycled numbers/copies). Unknown remains unmanaged; preserve its busy interval. Owner correction can link current fields after contextual review without overwriting original Calendar text. Keep conflicting customer changes under review; no silent recipient reassociation. No forced alert merely for absent phone or optional consent. Promote automatically only under a later reviewed deterministic association rule with evidence; otherwise owner review.

Test corpus must include owner-created fresh and copied Google events, with provider-returned IDs/properties/ETags captured in a dedicated authorized account. Synthetic cases are necessary but do not establish Google copy semantics. Availability changes become effective immediately after verified observation; candidate ~60s coalescing applies only to authorized notifications. Notification permission and reminder permission are independent. Managed deletion uses owner cancel/restore Decision 92; manual intentional overlaps retain all occupancy without an automatic conflict incident. Sync cursor advances only after all pages and observations are durable; unfiltered changes plus known-ID reads detect removed metadata/tombstones. Bounded resync omission never proves deletion. Repeated page token, malformed page or lost cursor means uncertain observation, not free capacity.

### G03/G07 purpose and evidence matrix

| Message/effect | Required purpose authority | Unknown/declined/provider-unverified fallback |
|---|---|---|
| Customer-initiated booking/status reply | Verified inbound customer/channel and applicable service window | Do not infer reminder consent; persist result safely if reply cannot be sent |
| P0 four proactive reminders | Explicit valid business reminder permission, current appointment, actual approved WABA/sender/template/TTL | No send; no proactive free-form workaround |
| Manual-booking confirmation/consequential change | Verified recipient+adoption and appointment-update permission plus correct provider message contract | Appointment remains, no unconsented contact |
| Imported customer's introduction | Reliable flagged import, eligible inbound moment, original intro not verified complete; unknown-only optional consent after commands | No mass outreach; no recurring 24h introduction; unknown prior send stays uncertain |
| `permisos` / `da mi permiso` | Customer initiates permission question; Accept only grants exact business/purpose/current question | Trigger/silence not consent, Decline suppresses; no repeated solicitation after decline |
| Audited in-person checkbox | Actual named-business purpose wording/evidence/time and staff identity/grant | No fabricated/backfilled grant from Calendar text |
| Post-visit survey | Business feature enabled, distinct valid purpose scope, provider-approved category/template/window | No survey; reminder consent alone insufficient; auto-complete not attendance |
| Owner warning before suspension | Correct owner identity/contact purpose and channel eligibility while active | Escalate operationally; never send unauthorized customer warnings |

No claim of GDPR/Mexican-law compliance or legally sufficient verbal wording is made. Privacy purpose/retention/residency, local tax and applicable-law evidence are later launch work. Record minimal real evidence; no invented approval.

## Prior experiments E1–E13, preserved and amended

Labels below use zero-padded `E01` etc, corresponding to original R2 E1 etc. All results NOT RUN, evidence path `vnext/evidence/<commit>/E##/`, reviewer pending Claude. Exact failure tests are in 03; these experiments define which environment can establish the claim.

| ID / prior question | Design and pass condition / fallback | Stage / accountable role |
|---|---|---|
| E01 Calendar ID/conditional writes | Characterize exact full identity, source ETag, 404/409/410/412, accepted/lost/delayed response and tombstone/late mutation. Samples never prove same-ID exactly-once. Automatic uncertain reinsert/ETag bump stays forbidden. If If-Match contract cannot be established, block mutation rather than unconditional fallback. | WP2 simulator; dedicated provider proof before WP6 effects, Codex |
| E02 Reservation/admission | Real target PG: same event all mutators, same resource conflict, different employees same Calendar success, union merge/self-overlap, source+target, no NULL/empty/infinite range, rollback and stale finalizer. Constraint/functions/role boundaries must all reject illegal states. | WP1 DB skeleton, WP2 engine; Codex, CP1/2 |
| E03 Dispatcher/HA | SIGSTOP before/after arm/final gate/socket, duplicate loops, lost commit and failover/old-primary resume. At most one possible submission; uncertain protection retained. Initial topology fail-stops; no automatic failover promise. Physical late-submit containment remains CP5 proof. | WP1 synthetic, WP5 deployed; Codex, CP1/2/5 |
| E04 Meta evidence/order | Fake first; later actual free-form+template opaque callback, IDs, received number/WABA/recipient, owner echoes, receipt before HTTP/failed after delivered, missing correlation. Unknown stays orphan/held. No time-based pairing or device-order claim. Current v26 behavior/account standing must be verified. | WP3/4, M0/M4, WP6 authorized resources; Codex |
| E05 Reminder races | Exact STOP before/after admission, slow preflight, cancel/move/expiry/TTL reset, delivered-parent first processing, historical generic ambiguity, suspension recovery. No false success/send/regrant. | WP1 head/gate, WP4 complete; Codex, CP4 |
| E06 Destructive-loss restore | Snapshot then acknowledge STOP/revoke/config, no-receipt send/Calendar mutation, destroy SQL. Rebuild inertly using original evidence; head/key/gap missing means holds. Old runtime externally contained before resume. | WP1 local fake stores, WP5 independent custody; Codex/ops, CP5 |
| E07 Tenant privilege | Actual PG grants, RLS context spoofing, pool reuse, definer search_path/PUBLIC rights, FKs, raw mixed-tenant batch, credential AAD and scoped operator MFA/break-glass audit. Document shared-runtime compromise boundary honestly. | WP1 DB roles, WP5 real identity/KMS; Codex/security reviewer |
| E08 Search/sync/phone/time | Event-aware source exclusion, all-day/transparent/declined events, metadata loss/tombstones/pages/cursors, copied identity, raw vs display phone MX/AR, DST/tzdata/horizon. Unknown mapping blocks plausible resources. | WP2/3, M3/M4; Codex |
| E09 Capacity/ops/economics | Approved workload/skew, burst/hot tenant/quota, seal latency/block age, safe-read vs write recovery, actual monthly invoices/support effort. No 10× headroom without measured model. | WP5/6, Codex/ops/owner targets |
| E10 Archive-before-ACK | A1–A5 every write/order/lost response and missing prefix/tail/head; no ACK or execution without required seals; measured latency. Do not adopt R2 asynchronous-export alternative: master requires seal before execution. | WP1 critical, WP5 real stores; Codex, CP1/5 |
| E11 Recoverable identity | Prefer original random identity ledger plus format/key versions to deriving lost offer/ordinal. Destroy original IDs or key: inert hold, never allocate new effect IDs. Valid provider IDs characterize discovery only. | WP1/WP5; Codex |
| E12 Withdrawal fast path | Same exact baseline listed phrases, Menu/human/name priority; unknown head rows, false suppression and stale MVCC. Suppress-only disagreements require review, never automatic regrant. | WP1 protocol + WP3/4 parity; Codex, CP1/4 |
| E13 Equal-scope B/C exercise | Owner has chosen greenfield. Do not build a competing application by default. Use WP1 measurable maintainability/proof/change-cost evidence and stop if the core is unmanageable; revise plan with concrete findings. No invented numerical winner. | WP1 checkpoint; Codex, Claude/owner stop-go |

## Explicit real-DB, security and operational tests

| ID | Acceptance test definition | Evidence / result / reviewer |
|---|---|---|
| DB01 | Two sessions cannot claim STAGED/unsealed rows; sealed duplicate returns same sequence; lost commit recovery never increments twice | `DB01.json` / NOT RUN / pending Claude |
| DB02 | All create/move/cancel/attendance mutation contenders on one appointment serialize via guard, including every ARMED/UNKNOWN state | `DB02.json` / NOT RUN / pending Claude |
| DB03 | Same resource overlapping buffer range rejected, touching zero-buffer allowed; different resources on one Calendar accepted; default ID stable | `DB03.json` / NOT RUN / pending Claude |
| DB04 | Old+target protections merge without self-exemption; resource transfer contention/rollback cannot drop original | `DB04.json` / NOT RUN / pending Claude |
| DB05 | Inject failure in each finalizer statement; no partial appointment/schedule/output/guard commit; stale result cannot affect successor | `DB05.json` / NOT RUN / pending Claude |
| DB06 | Concurrent same-owner loops and different owners receive at most one one-use invocation token; unknown commit gets none | `DB06.json` / NOT RUN / pending Claude |
| DB07 | Unknown sender upsert/STOP/grant/send race, READ COMMITTED waited row revision, serialized retry and archive outage preserve suppression | `DB07.json` / NOT RUN / pending Claude |
| DB08 | Active→suspended races queued booking/send; scope isolated; reactivation considers only valid future jobs and never resets consent/uncertainty | `DB08.json` / NOT RUN / pending Claude |
| SEC01 | Signature mutations, raw byte/Unicode/shape/batch limits and unsupported event cannot reach effect authority | `SEC01.json` / NOT RUN / pending Claude |
| SEC02 | Signed wrong WABA/number/recipient/credential revision cannot cross verified mapping; unknown channel has no fallback | `SEC02.json` / NOT RUN / pending Claude |
| SEC03 | Role, RLS/FK, pool reset, forged context, PUBLIC/definer function, location/resource/customer substitution negative tests | `SEC03.json` / NOT RUN / pending Claude |
| SEC04 | Copied event/private properties/phone match cannot grant adoption/consent; injection malformed fields cannot become SDK args | `SEC04.json` / NOT RUN / pending Claude |
| SEC05 | Owner echo/app output cannot act as customer command/grant; native routing stays disabled until real proof | `SEC05.json` / NOT RUN / pending Claude |
| SEC06 | Least privilege/decrypt AAD, individual MFA, scoped operator action/revocation, audit outside actor control, redacted PII logs | `SEC06.json` / NOT RUN / pending Claude |
| REC01 | Snapshot+archive+keys destructive drill, missing chain/key/version, erased/suppressed state and no-receipt effect; restore inert/no identity invention | `REC01.json` / NOT RUN / pending Claude |
| OPS01 | Credential/egress fence, no-loss or quarantined promotion, version rollback, alert drill and measured recovery/support runbook | `OPS01.json` / NOT RUN / pending Claude |

## Q/SC closure map for independent challenge

All are proposed design dispositions, not proof. Q1→03D/E01; Q2→03B/C/F11–13/E03; Q3→04 constraints/DB02–05; Q4→03D/F22; Q5→05 R12/E05; Q6→03A/E/ F09/28/E11; Q7→03A/F03–09/E10; Q8→03C/DB07; Q9→04 event identity/SEC04; Q10→04 grants/SEC03; Q11→G02/E08; Q12→05 transcripts/E05/E12; Q13→03E/F29/OPS01; Q14→07 privacy options/REC01/SEC06; Q15→07/08/E13.

SC1→INV01/F01–09; SC2→INV02/06/DB01/05; SC3→INV10/14/SEC02/04; SC4→INV03/DB02–05; SC5→INV04/F11–17/DB06; SC6→INV05/E01; SC7→INV07/F20–22; SC8→INV08/DB07; SC9→INV09/13/F12/27; SC10→INV17/P-I10; SC11→INV10/16/SEC03/06; SC12→INV12/16/OPS01; SC13→INV11/REC01; SC14→INV12/F29/OPS01; SC15→INV14/E08; SC16→INV16/OPS01 and seal/blockage metrics in 07; SC17→INV16/REC01/07 custody policy. The prior unresolved SC5/8/13/14 remain proof gates, not closed by tables.

## Ranked ten highest risks

Severity considers unauthorized/duplicate irreversible effects above availability loss; no numerical probability is claimed. Baseline anchors identify relevant code boundary, not newly diagnosed production defects.

| Rank / severity | Failure mode | Baseline/source anchor | Proposed protocol / blocking test |
|---|---|---|---|
| 1 Critical | Lost armed identity then replay duplicates remote event/send | `lib/reliable-delivery.js:79–87`; challenge 10 Q6/Q7/Q13 | 03A/B/E, F08/09/17/28/29, E06/10/11 |
| 2 Critical | Frozen old dispatcher and replacement both submit | `lib/reliable-delivery.js:79–87,298–310`; challenge Q2 | Nontransferable owner/token 03B, F11–14/DB06; physical containment OPS01 |
| 3 Critical | STOP/revocation or suspended business races final dispatch | `lib/reminder-permissions.js:20–52`; `lib/appointment-reminders.js:204–253`; G06 | Stable heads/lock order 03C, DB07/08, F12/13/23–27 |
| 4 Critical | SQL-visible unsealed admission executes, then DB is lost | `whatsapp-webhook.js:1433–1445`; challenge Q7 | 03A execution seal, F03–09/DB01/E10 |
| 5 Critical | Copied/forged same-business event contacts wrong customer | `lib/booking.js:84–91`; `lib/appointment-management.js:48–92`; A2 O04 | Full local tuple/origin 04, SEC02/04/F30, E08 |
| 6 Critical | Same-event parallel mutation or stale finalizer releases protection | `lib/appointment-management.js:166–225`; challenge Q3 | Guard+union constraints 04, DB02–05/F10/18/19 |
| 7 Critical | Runtime/operator crosses tenant or secret scope | `whatsapp-webhook.js:100–205`; challenge Q10 | Trusted context/grants/AAD/MFA 04, SEC03/06/E07 |
| 8 High | Failover/rollback drops admission or restores old permission | `lib/database-backups.js`; challenge Q13/Q14 | Inert restore/external fence 03E, F24–29/REC01/OPS01 |
| 9 High | Out-of-order/miscorrelated receipt or generic reply targets wrong schedule | `lib/appointment-reminders.js:278–313`; `lib/reliable-delivery.js:92–112` | Ordered evidence/current+historical target 03D, F20–22/P-R04/12 |
| 10 High | Shared-calendar staff/manual sync marks occupied time free | `lib/appointment-management.js:109–142`; `lib/availability-search.js`; G05 | Event-aware resource occupancy 04/G02, DB03/04/E08; unknown attribution holds |

Provider feasibility, actual legal policy, operator staffing and archive/HA price are additional launch risks. Fail-closed holds can become long operational outages: measure held resources/conversations and assign an incident owner rather than silently timing them out.
