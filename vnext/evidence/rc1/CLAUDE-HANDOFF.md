# Focused independent RC-1 safety review

Review [Draft PR #27](https://github.com/vanasperena-ux/nukmiris/pull/27), **tested application source `77ea22b59d1b7022cecb3cf7a007ca14affee9ff`**, tree `33e683382e48f492fbd9a8c722b0d07ff4c8fbe4`. Evidence/documentation successors do not change that source. This is a review request, not a claim of independent acceptance.

Authority: [Issue #26 and final authorization](https://github.com/vanasperena-ux/nukmiris/issues/26#issuecomment-6922799623), [inactive-service clarification and copy matrix](https://github.com/vanasperena-ux/nukmiris/issues/26#issuecomment-6923524363); accepted SE-1/N1 source `95b122771b0958c0bc9bda07db1dab14f35aeb67`, docs head/base `8f69e34cd265d197485dc6b947bac86a23ae796c`. Authoritative register **v1.4, `59cde023d2dff088161c1d01bd76c1099386e13f`**, especially NM-006/007/010/029/031/032 and its summary-trigger table. Read source requirements, not only this handoff. N1 is independently/owner accepted; do not reopen PC-1 or unrelated N2–N5.

## Contract and changed code

- Always select an exact upcoming appointment, including one. MOVE keeps original employee, stable appointment/event IDs, frozen service/duration/buffer. Selecting a replacement immediately initiates the move, no second confirmation. CANCEL selection immediately initiates exact fake-event deletion, no second confirmation or obsolete menu suffix. Success only after proof. Two suggestions/more/date, direct new booking, summary triggers and random allocation for new bookings remain.
- Inactive service: existing appointment MAY move with frozen snapshot and original eligible employee. Inactive/unqualified original employee: assistance/Needs Attention, no reassignment. Cancellation remains possible. One service per appointment (147), standard booked duration/buffer (139).
- Main application: `vnext/src/application/appointment-management.ts`, RC-1 branches in `interactive-booking.ts`, `booking-composition.ts` protection exclusion, `availability.ts` exclusion of original time, bounded plan deadline in `prepare-operation.ts`.
- SQL: new migration **012-local-appointment-management.sql** only; originals 001–011 and `local/upgrade.mjs` unchanged. Review action/customer/tenant/current-revision/snapshot binding; catalog revision lock; original-employee eligibility; preserved MOVE/CANCEL kernel/guard/exclusion rules; same-event fake mutation and atomic ledger rollback on precondition failure; proof-time append-only `rc1_history` and scoped read grants.
- Presentation: `service-catalog.ts` owner read model and `local/web/owner.*`; OFF-default cancelled toggle, grey last-booked position, always retained history; currently valid moved appointment Confirmada. Pending banner in `local/web/app.js` is durable-state status, not an external send. Browser remains the existing authenticated local owner simulator, not a public WhatsApp/customer or employee account.

## Verification targets

| Risk | Test/source evidence |
|---|---|
|Wrong customer/tenant, forged/stale/replayed/expired picker or slot, changed catalog between observation and SQL, past appointment|`test/rc1-management.test.ts`: customer/tenant substitution, replay, expiry, catalog edit, exact picker; existing full permission/custody/ordering cases. Challenge the SQL guards independently.|
|Correct appointment and original employee across zero/one/two/nine appointments, pagination and Meta limits|RC-1 explicit picker, two/many, maximum-name, inactive-service and employee ineligibility tests. No new employee draw in crash continuation.|
|No double booking/release across concurrent customers/workers, interruption, expiry and protected UNKNOWN|RC-1 simultaneous workers, duplicate cancellation, competing booking, never-entered supersession/expiry, entered-without-call, before-effect UNKNOWN; existing kernel race tests include both lock orders and MOVE guard exclusivity.|
|Provider effect without local proof / finalizer interruption|RC-1 lost-provider-reply tests retain source/target protection and run finalizer rollback at appointment/protection/output/guard cuts, then read exact ledger once without resubmit; missing event is UNKNOWN, never successful cancel.|
|Calendar correctness / frozen history|RC-1 duration/buffer/hours/absence/break and DST tests; same event/appointment/snapshot assertions; exact fake deletion; append-only/role isolation.|
|Actual local process/browser behavior|`local/rc1.test.mjs`: known/new customer HTTP flow, authorization, lifecycle history, crash/restart, coherent inert restore and uncertain move held across process crash. `local/rc1-browser.mjs`: Chromium UI direct move/cancel, owner toggle/history, tenant switch and 390px layout.|

[Final results, reproducible commands and limits](README.md); raw logs and checksums alongside. The full suite includes fault and concurrency tests; subset counts overlap. Injected fault points are deterministic suspension/exception schedules, not arbitrary-instruction crash coverage. Actual child crashes are separately exercised by the portable TCP suite. Linux tests do not prove native Windows or real Google/Meta behavior.

Please independently challenge authorization, sealed identity reuse, action/claim/revision binding, mutation ordering, uncertainty/protection retention, scoped immutable history and operator/browser disclosure. Identify any concrete failure schedule with file/line references. State acceptance for the bounded local synthetic RC-1 scope only, or list blocking corrections. Windows owner acceptance remains separate. No cloud/production redesign is requested.

## Still closed

No automatic upgrade of existing owner profiles; RC-1 requires a fresh isolated profile and refuses profiles without 012. No changes to protected Ana, accepted data or historical artifacts. No real provider calls or safety claims, Google Calendar activation, employee accounts/notifications, infrastructure work, deployment or merge. Exact live-provider delete/move and external-outcome reconciliation remain future gates. Keep PRs #25/#27 Draft/unmerged; stop for owner functional acceptance and this focused review.
