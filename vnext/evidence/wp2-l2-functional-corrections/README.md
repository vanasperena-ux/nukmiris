# L2 functional corrections — exact-source evidence

**Tested source:** `6fa5c1800860290c051b23a5e3871e67f43c796d`; tree `f6e940689741dc4a720f6284f7c6942aaf8aab89`.
Increment base0691111 (Draft PR15); final source parent8fddd31.
Evidence follow-up adds only this directory and Claude handoff17, with no code changes.

Authoritative **Feature Register v1.3**, commit
**d1399b90b9c0e3c56e5bdf0fe59f24d925a0d455**, blob
**b26bca5af25ebd56d7c561cd325a0faed0bfa1ba**. Entire register/Tests1–26 and scope
decision were read before implementation. Original input retained with branch-only
status addendum; documentation branch unchanged/unmerged.

## Actual Codex execution

Linux, Node **24.19.0**, npm **11.9.0**, measured PostgreSQL
**17.11 (Debian17.11-1.pgdg12+2)**. Pinned image and measured environments are below.
One build at exact source; then direct Node harnesses equivalent to the npm scripts.
Core and TCP/runtime pipelines overlapped in separate isolated fixtures; timing
measurements are host observations, not an idle-host benchmark or Windows SLO.

| Suite | PASS | FAIL | SKIP | Evidence |
|---|---:|---:|---:|---|
| full | 489 | 0 | 0 | [full.log](full.log) |
| fault | 479 | 0 | 0 | [fault.log](fault.log) |
| concurrency | 350 | 0 | 0 | [concurrency.log](concurrency.log) |
| focused | 202 | 0 | 0 | [focused.log](focused.log) |
| runtime | 41 | 0 | 2 | [runtime.log](runtime.log) |
| browser | 1 | 0 | 0 | [browser.log](browser.log) |

Build/typecheck/confinement pass. Suites overlap: focused202 includes40 first-pass
correction tests plus4 name-command precedence cases and158 retained L2 cases.
The two runtime skips are native Windows ACL and metadata sync. Corrected-source
native Windows and independent Claude acceptance remain pending. The owner's
**baseline3d8f82b** actually passed41 native tests/0fail/0skip with ACL/sync executed;
that is separate evidence ([owner report](owner-native-baseline.json)), not a new
Windows run by Codex. Never promote READY FOR TEST to VERIFIED from these results.

[Summary](summary.json) · [measured runtime](measured-runtime.json) ·
[source provenance](source-provenance.json) · [source hashes](source-sha256.txt) ·
[artifact hashes](artifact-sha256.txt). Each full/fault/concurrency/focused environment
JSON records actual Node/PG and isolated Unix socket harness; runtime uses TCP/UTC.
No generated fixture dumps, databases, keys, backups or private profile URLs copied.

## Requirements and automated acceptance mapping

| IDs / owner tests | Exact-source acceptance evidence |
|---|---|
|031/032/001/005;12/20 |0/1/2/90 upcoming summaries, three menu actions, customer/business scope, stable IDs/order; manage says unavailable without mutation; direct cita/agendar; late-proof C3 visibility |
|033;5/21/22 |One entry acknowledgment; quiet text/cita/agendar/actions; original-ID queue/restart/COMMIT cuts; Menu exit and post-Menu routing; no appointment effects or diagnostic PII |
|029/036/004/011;4/19 |Shared Spanish formatter across all months/days/zones/year edges; Unicode/limit rejection; TS/SQL four-button guard; sanitized Meta-shaped rows; browser renders a date list |
|035;1/2/11 |Authenticated HTTP and browser click-to-detail; foreign tenant/alternate field denial; stored name/contact/service ID/employee/time/duration/buffer/status/source; missing phone/service name stay null |
|037/043;13–16/24 |Unchanged100 legacy date cases; full weekday/date grammar and mismatch/year rollover; active-flow end-to-end; idle dates do not book; distinct actionable impossible/unknown/past/horizon copy |
|040/041/042;3/17/19/25 |Fourth identity holds old future offer while two others fill both resources; Ana UNKNOWN/protections unchanged; forged stale/replayed/out-of-order API-core IDs after Menu/human/cita/restart;60+15 buffer/other employee/30min grid/SQL10:15 half-open boundary |
|009/032;1/2/18 |cita/agendar/reagendar/cancelar while NAME_REQUIRED cannot become a customer name or book; restart-direct booking or explicit manage-unavailable; normal valid/invalid names remain covered |
|030/039;6–10/26 |Before-apply UNKNOWN and uncertain reply gate stay held, no extra acknowledgment identity/blind retry; read-only lost-response recovery retained; isolation and protected restart/upgrade proof; operator workflow design only |
|All retained behavior |Full/fault/concurrency retain core custody/fencing/history/role/isolation/recovery and L1/C1 regressions; actual TCP CLI with spaces/Unicode, two bookings, crash/restart, coherent backup/inert restore |

[Full scope/root causes/designs and safe Windows upgrade](../../../docs/greenfield/26-L2-FUNCTIONAL-CORRECTIONS.md)
· [register/status addendum](../../../docs/greenfield/NUKMIRIS_FEATURE_REGISTER.md)
· [independent Claude handoff17](../../../docs/greenfield/reviews/17-CLAUDE-L2-FUNCTIONAL-CORRECTIONS.md).
Owner Tests1–26 remain owner-visible evidence; the matrix does not turn partial UI
observations into independent backend/provider proof. All new native/browser owner
checks remain required. O3 full-run measurements: [raw JSON](o3-full-run.json),
including contention and forced50/3000ms terminal timeouts; no same-plan retry.

## Reproduction

Fresh exact-source checkout, from vnext:

```text
npm ci --ignore-scripts
npm run build
node scripts/run-tests.mjs
node scripts/run-tests.mjs fault
node scripts/run-tests.mjs concurrency
node scripts/run-tests.mjs l2
node --test --test-concurrency=1 local/platform.test.mjs local/command-lock.test.mjs local/runtime.test.mjs local/interactive.test.mjs
node local/browser-smoke.mjs
npm run typecheck
npm run check:scope
```

The core commands are the harnesses behind npm test/test:fault/test:concurrency/
test:l2; runtime is the harness behind test:runtime. They were executed after the
single build, without simultaneous writes to dist. Browser requires local
Chromium/Edge CDP; code drives both bookings, menu, list, quiet human mode,
calendar details and tenant switching. Browser screenshot stays in the disposable
private fixture; it is not published as evidence of native Windows.

For owner Windows use npm.cmd run test:runtime (native ACL/sync must execute),
then follow26's explicit old-profile **demo:upgrade --state-dir ... --confirm ...**
and **demo:book --state-dir ...** instructions. Upgrade takes/verifies a coherent
backup and stays stopped. Test proves an old007 schema profile keeps original
UNKNOWN/protections/history/identities, produces a separate inert rollback restore
and restarts safely. Never reset Ana, delete the original profile, activate a
restore or upload state/keys/backups.

## Unresolved gates

NM-030 acknowledgment is design-only and BLOCKED by ordering, not shipped through
a bypass.034 staff inbox/notification/reply and039 protected reconciliation remain
designs.038 overlap/duplicate policy needs owner choice; no new ban.006/007/010
management parity is the next bounded stage, not functioning here.044 and deferred
commercial features stay deferred. Missing phone/service display-name model and
real Calendar mapping are explicit. Real Meta counts/transport/custody still gate016.

All PRs remain Draft/unmerged. Full parity, independent review, owner acceptance
and Milestone A remain open. Preserve production X1 record-chain AND index extension,
archive/repair,009/011/017,N2/N3/A2/A3,013/016,F13,W7/O5/O6,C5,D1,Windows/N6 and
OPS01 gates. Legacy, migrations001–007/roles, W8/W9 unchanged. No real providers,
GCP, deployment or production activation.
