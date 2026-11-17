# RM-1 — R0 implementation scope and traceability

Baseline: owner-accepted RC-1 executable **47f485b691c62dc8968ad2aec7cf6f05aaf7df93** (tree de03771ed5110dcee98e5c5d0edd8f884b36c045). PR #27 and its acceptance evidence are unchanged. This increment implements **NM-068 and NM-069 only**, for fresh local synthetic profiles. R0 remains open until owner acceptance.

## Controlling sources and checkpoint decisions

- [Feature Register v1.13](https://github.com/vanasperena-ux/nukmiris/blob/6c1cdf67fe49b677a6ba16d964badcbc7318b303/docs/product/NUKMIRIS_FEATURE_REGISTER.md), [Release Roadmap v1.3](https://github.com/vanasperena-ux/nukmiris/blob/6c1cdf67fe49b677a6ba16d964badcbc7318b303/docs/product/RELEASE_ROADMAP.md) and [Customer-Facing Text Review v1.3](https://github.com/vanasperena-ux/nukmiris/blob/6c1cdf67fe49b677a6ba16d964badcbc7318b303/docs/product/CUSTOMER_FACING_TEXT_REVIEW.md), pinned at **6c1cdf67fe49b677a6ba16d964badcbc7318b303**. The initial complete v1.12/copy/roadmap reading was at 0ad6d508868b4f6a879825426b3b02509fc9e40c; the complete v1.13/roadmap diff was reconciled before reminder coding. The 13 definitive NM-068 strings are unchanged.
- Accepted-source `backend/REMINDERS.md`, `REMINDER_TEMPLATES.md`, `lib/reminder-schedule.js`, `reminder-templates.js`, `appointment-reminders.js`, `reminder-permissions.js`, `reminder-menu.js` and relevant tests. These legacy files are read-only references, never runtime imports.
- Approved C01/C08/O12 journeys at 1f4682ccba02fe5d89ce9d671c0114d6f9a0d6e1 and historical ADR-006–009/011 at c55193a95e5eb38b245215f81deb00d9b2eaad5f, reconciled with the accepted vNext archive/one-use attempt/ordered output/recovery protocols and migrations 001–012. Historical recommendations do not establish live-provider proof or require an infrastructure redesign.

Checkpoint 1 originally identified two conflicts. **Both are resolved by the owner's chat clarification and v1.13/NM-069:** R0 expressly includes synthetic reminder parity now; all four legacy stages, including conditional 22h, are required. The owner also expressly approved synthetic permission evidence plus `da mi permiso`, while prohibiting a new first-contact consent prompt/wording/timing. That narrower decision controls this increment. No R1–R5 transition, R3 implementation, merge or provider activation is implied.

## Feature traceability

Statuses below describe this implementation branch; authoritative documentation branches remain untouched. **READY FOR TEST** does not mean Windows acceptance or independent review.

| Feature / requirement | Accepted executable status | Delivered scope / acceptance evidence | Deferred dependency |
|---|---|---|---|
| NM-068 | Superseded copy in 13 scenarios | READY FOR TEST; [13-row exact CX matrix](CX-MATRIX.md), 15 independent literal/state tests | Owner/native acceptance |
| NM-069: schedule | No vNext scheduler | READY FOR TEST; four stages 168/24/22/2 elapsed hours, strictly-future enrollment, 15-minute late window, disabled by default, no adoption/backfill; unique appointment/revision/kind jobs | Real provider scheduling/operation gates unchanged |
| NM-069: changes | RC-1 proven move/cancel exists | Same transaction as proof-time history schedules replacement jobs or suppresses pending old jobs; old sends retained; UNKNOWN never invents new time/cancellation; rollback/replay/crash tests | No arbitrary operator clearing |
| NM-069: attendance | No local reminder attendance view | Exact business/customer/channel/appointment/revision response, duplicate/stale/quoted safety, direct exact-target RC-1 move, owner-visible attendance and reset/history | Attendance is a durable local SQL projection, not proof of a real Google Calendar attendance patch |
| NM-017/019 synthetic prerequisite | Prepared legacy template definitions only | NM-069 fixture checks actual synthetic channel/WABA/number mapping and per-account approved/missing/rejected/unavailable state, with exact four legacy bodies and metadata | Live WABA ownership, exact current Meta approval/TTL verification remain R3 |
| NM-018 synthetic prerequisite | Durable outputs without reminder jobs/UI | Scheduled/due/queued/entered/accepted/delivered/failed/skipped/suppressed/held distinctions; append-only timed job/attempt/receipt events, Spanish owner activity | Live transport/provider delivery evidence remain R3 |
| NM-020/026 synthetic prerequisite | Immediate opt-out and evidence/CAS protocol exists | Explicit synthetic evidence/source/time; missing/withdrawn blocks proactive sends; reauthorization event and timestamp; stale evidence never clears revocation; no booking-as-consent | New first-contact collection, production legal/Meta policy and compliance claims remain open/R3 |
| NM-027/030 | Held state and diagnostics, no safe extra acknowledgment sender | Design only: ordered-channel gate, blocked/impossible handling; [communication design](COMMUNICATION-DESIGN.md) | No new outbound acknowledgment bypass |
| NM-033/045 | Quiet human mode and retained support messages | Regression-tested entry-only CX024, no appointment summary, quiet ordinary input, menu exit; human mode also holds reminders | No new natural-language escalation |
| NM-034 / OD-09/10 | Retained support messages, no owner reply channel | Design only; business-scoped tracking, authorized access/closure/audit and notifications | Desired replies through business WhatsApp app; coexistence feasibility and owner-approved fallback unresolved |
| NM-039 | Evidence-only recovery and UNKNOWN protection | Preserved; visible held diagnostics; no arbitrary resolution/retry | Operator reconciliation UI remains outside this increment |
| SE-1 / RC-1 | Accepted synthetic service booking, original employee move/cancel, overlap-safe offers/history | Full existing regression; one service per appointment, original employee/frozen metadata, tenant isolation and SQL protection retained | Live integrations and commercial authentication not implied |

## Behavior and safety details

Four reminder times are UTC elapsed-hour offsets from the verified appointment start. Business IANA timezone determines full Spanish labels. A threshold at or before proven booking/replacement commit is logged as skipped; it is never invented as an immediate catch-up send. A due job gets at most the original 15-minute window. No response never cancels the booking. The final two-hour notice remains eligible when attendance is pending.

The 22-hour job requires correlated delivered/read proof for the same schedule's 24-hour request and no customer response. Provider acceptance alone is insufficient. As in legacy, a due follow-up lacking that proof is skipped; a late receipt cannot revive it. Requesting a change suppresses the follow-up immediately. Abandoning that request for 15 minutes restores prior attendance (pending/confirmed) while preserving response history, so the bot never subsequently says the customer did not respond. An unresolved mutation guard prevents unsafe restoration/dispatch.

Schedule creation/suppression is triggered from the existing proof-time `rc1_history` insertion, inside the accepted finalizer transaction. No future output intent is allocated merely to wait for a timer: jobs wait durably until due and eligible, avoiding a week-long conversation barrier. At enqueue, output identity is archived once under a stable job key. Dispatch uses the existing sealed output plan, immutable attempt, owner continuation and result finalizer. An additional SQL entry gate can only veto reminder dispatch; it does not weaken existing gates. Config/template edits serialize against entry through the business lock; permission and appointment checks remain authoritative.

Entered/UNKNOWN sends are reconciled against the same fake ledger read-only; no lease/time/crash transfers invocation authority. Never-entered interrupted output expires through existing recovery. A withdrawal committed before entry prevents the send. **The existing in-flight boundary remains:** an already-entered original invocation may complete after withdrawal; the race test records this and permits no successor/retry. This does not solve the production physical-cutoff/OPS01 gate.

Receipt injection is an authenticated synthetic owner action, sealed to business/job/attempt/channel/WABA/number/recipient/message and matching fake-ledger evidence. Wrong correlation is retained as uncorrelated evidence; it never enables follow-up. Receipt history is monotonic and append-only. It does not prove that a real customer received anything. Failed delivery never automatically resubmits an accepted or uncertain attempt. Legacy transient retry timers do not override accepted vNext one-use/uncertainty safeguards.

The fixture clock is durable, monotonic, operator-controlled and **shared by both synthetic businesses in this one isolated profile**. It deliberately replaces real time only in the local synthetic composition. Coherent SQL/archive/ledger backup retains jobs, receipts, permission and clock; restore stays suspended/inert. No upgrade/migration of existing owner profiles is supplied. Runtime refuses profiles lacking migration 013.

Manual/imported appointments are not supported by the accepted local model (origin APP_CREATED). An unmanaged fake-calendar event is never adopted as a customer, permission or reminder. Implementing manual entry/import would expand R1 and is deferred. First-contact consent, real template administration, owner reply inbox, notifications, provider monitoring and new uncertain-request acknowledgments are not implemented.

## Acceptance mapping

Core cases are in `vnext/test/l2-rm1-reminders.test.ts` (NM069 prefix) and `l2-rm1-copy.test.ts` (NM068). Portable TCP/process/backup tests are `local/reminders.test.mjs`; actual browser controls are exercised by `local/reminders-browser.mjs`.

| Requested test category | Automated coverage |
|---|---|
| 1 all intervals | Four exact thresholds; TCP and actual browser execute 168/24/22/2 |
| 2 short lead | Less than two hours, exact two-hour and 24-hour threshold, no catch-up |
| 3 timezone/DST | Both New York transitions, elapsed offsets, full Spanish appointment date/time |
| 4 booking generation | Disabled/no adoption, exactly four unique jobs, every finalizer rollback stage |
| 5 reschedule before due | Exact-target direct RC-1 move, atomic revision replacement and frozen employee/service |
| 6 cancellation before due | Proven-only suppression; unchanged booking history/identity |
| 7 changes after sends | Prior accepted reminder retained; old actions expire, attendance resets |
| 8 duplicate/replay | Scheduler concurrency, archived output identity, duplicate receipts/inputs/confirmation |
| 9 crash/restart | Before/after enqueue commit, before/after entry and provider call, actual child-process death/restart |
| 10 delivery failure | Failed receipt vs accepted vs UNKNOWN; no blind retry |
| 11 template readiness | Missing/rejected/temporary-unavailable, channel/account binding, no free-form fallback |
| 12 consent | Granted/missing/withdrawn/reauthorized, timestamp/evidence, duplicate/restart/stale-grant replay |
| 13 manual where supported | Unsupported/manual-like event is not adopted and grants no consent |
| 14 attendance | Exact buttons, generic and quoted targeting, multiple-request ambiguity, stale/duplicate, direct move and abandoned change |
| 15 UNKNOWN/protected | UNKNOWN move retains old schedule, entered send held across crash/expiry, prior uncertain reply blocks reminders |
| 16 two businesses | Scoped registry/permission/jobs, foreign customer/tenant actions denied, owner browser/API isolation |
| 17 privacy | Text rendering, no raw secrets/payloads in owner activity, append-only/role checks |
| 18 CX13 matrix | Exact literals, accents/newlines/substitutions, 0/1/many appointments, all specified scenarios |
| 19 SE-1/RC-1 | Complete existing core/fault/concurrency files and portable runtime/browser regression |

Exact final source/tree, commands, results and raw logs are in [evidence](../../../vnext/evidence/rm1/README.md). [Windows walkthrough](WINDOWS.md). Independent review and owner acceptance remain pending; no automatic continuation follows publication.
