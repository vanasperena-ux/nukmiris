# RM-1 / R0 — local synthetic evidence

**Executable:** `6a25e295a7b05860d0cb8207c0b4c57731af74e7`  
**Tree:** `b36328203fb462bc59e76a0c20bf1e984c286e84`  
**Baseline:** owner-accepted RC-1 `47f485b691c62dc8968ad2aec7cf6f05aaf7df93`. Draft PR #27 and its evidence are unchanged. Delivery: [Draft PR #28](https://github.com/vanasperena-ux/nukmiris/pull/28).

**Requirements:** Feature Register **v1.13**, roadmap **v1.3**, copy review **v1.3**, commit **6c1cdf67fe49b677a6ba16d964badcbc7318b303**. The original v1.12 NM-068 13-string table at 0ad6d508868b4f6a879825426b3b02509fc9e40c is unchanged. The owner expressly authorized NM-069's synthetic four-stage rebuild within still-open R0 and synthetic evidence/`da mi permiso`, excluding any new first-contact consent prompt. [Pinned source hashes](sources.json).

Status: **READY FOR OWNER TEST / INDEPENDENT REVIEW**, not R0 closure, native Windows acceptance or production readiness.

## Final verification

Linux, Node **24.19.0**, npm **11.9.0**, PostgreSQL **17.11**, Docker **28.4.0**, Chromium **154.0.8037.57**. PostgreSQL image is pinned to `postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`. Portable fixture uses loopback TCP, explicit `ssl:false`, SCRAM and UTC.

| Check | Result | Raw evidence |
|---|---|---|
| Complete core, including all fault/concurrency/regression files | 813 PASS / 0 FAIL / 0 SKIP | [full.log](logs/full.log) |
| New NM-068/NM-069 cases inside core | 64 PASS (15 copy + 49 reminders) | Same full log; not an additional count |
| Complete portable runtime | 51 PASS / 0 FAIL / 2 native Windows-only SKIP | [runtime.log](logs/runtime.log) |
| Actual RM-1 browser: copy, owner consent/clock, 168/24/22/2, delivery receipt, attendance, tenant switch, mobile | 1 PASS / 0 FAIL / 0 SKIP | [rm1-browser.log](logs/rm1-browser.log) |
| Actual RC-1 browser: direct move/cancel, owner calendar/history, isolation, mobile | 1 PASS / 0 FAIL / 0 SKIP | [rc1-browser.log](logs/rc1-browser.log) |
| Actual Services browser: owner forms, qualification, booking, frozen history, isolation, mobile | 1 PASS / 0 FAIL / 0 SKIP | [services-browser.log](logs/services-browser.log) |
| Typecheck / scope / whitespace | PASS | [typecheck.log](logs/typecheck.log), [scope.log](logs/scope.log) |

Counts overlap. The full core runner includes the new tests and all existing fault/concurrency files; separate subset counts are not added to the total. Runtime tests exercised actual process death/restart and coherent independent restore, not only mocks. **Native Windows has not been executed for this source**; the two platform-specific cases are correctly skipped on Linux. Earlier owner laptop results are not reused as acceptance.

The final runtime-only commit changes three test files to release their labelled disposable source containers after successful backup/source assertions and before independent restore. It does not change application, SQL or restore code. This environment's VFS Docker storage exhausted the host filesystem when two image copies were retained: the diagnostic recorded <6 MB free, 100% used, target exit 1 and no OOM. All restore assertions remain, and the unknown-upgrade source assertions run before disposal. [Original diagnostic](preflight/restore-host-diagnostic.log).

## Reproduce

From a fresh checkout of the exact source above, in `vnext/`, with Node 24, Docker Linux containers and Chromium available:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:runtime
npm run test:rm1:browser
npm run test:rc1:browser
npm run test:services:browser
```

Run heavy Docker suites serially. The core runner uses a disposable Unix-socket cluster with container networking disabled; the portable runtime uses separate isolated TCP fixtures and generated credentials. Browser scripts accept an executable argument (e.g. Edge on Windows). The source installer and all profiles stay synthetic. [Exact Windows procedure](../../../docs/product/rm1/WINDOWS.md).

## Scope, integrity and review

- [Requirements / 19-category acceptance mapping](../../../docs/product/rm1/REQUIREMENTS.md), [13-row exact CX matrix](../../../docs/product/rm1/CX-MATRIX.md), [R3 communication design only](../../../docs/product/rm1/COMMUNICATION-DESIGN.md).
- [Focused Claude handoff](CLAUDE-HANDOFF.md), [machine-readable results](results.json), [146-file source manifest](source-integrity.json). SHA-256 and Git blob IDs permit independent verification. Publication readback is recorded in the PR comment after upload; no private profile backups or custody keys are published.
- Legacy `backend/`, migrations 001–012, original dispatcher/preparation/finalizer, archive implementation and experimental infrastructure paths are unchanged. All source changes are in the vNext product/test scope; documentation/evidence is additive. No PR merge or existing owner-profile upgrade took place.
- Default reminders are OFF. New approved synthetic bookings only; no historical/manual adoption. Delivery requires explicit correlated synthetic evidence. Attendance is local SQL state, not proof of a real Calendar update. Production WABA/template/compliance, custody, provider, physical-cutoff and OPS01 gates remain open. An already-entered original invocation may finish after revocation; no successor is allocated. A request arriving after reminder preparation can conservatively wait for the 15-minute never-entered recovery deadline; no UNKNOWN work is cleared.

`preflight/` retains failed/superseded development runs byte-for-byte, with their actual scope/source where known. They are not final-source acceptance results and were not rewritten to appear generated by corrected code. Earlier accepted repository evidence is untouched. Stop for focused independent review and the owner's fresh-profile Windows acceptance.
