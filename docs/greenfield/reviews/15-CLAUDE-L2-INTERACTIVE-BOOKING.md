# Claude review — first interactive local synthetic booking application

Review exact source **75491d9734def18471bf7b96f5004d7fd4988314**, tree **730e29a99b38203852ef255367fd9fe7cc83ecd7**. Evidence follow-up adds
only this handoff and vnext/evidence/wp2-l2-interactive/. Verify that split/hashes.

Follows your accepted [PR12 W1–W6](https://github.com/vanasperena-ux/nukmiris/pull/12#issuecomment-6671645023)
and [PR14 R1/L1-C1–C6 with C1–C4](https://github.com/vanasperena-ux/nukmiris/pull/14#issuecomment-6671645331).
Base is accepted PR14 evidence6e1ae2a. W9's writable publication/tests from source
a61e65f are selectively incorporated with W8; no Draft PR is merged. W9's separate
[PR12 re-verification](https://github.com/vanasperena-ux/nukmiris/pull/12#issuecomment-6672882540)
and corrected-source native owner run remain pending.

This is executable local application code: npm.cmd ci --ignore-scripts, then
npm.cmd run demo:book from vnext prints a private loopback browser URL. It creates
a fresh synthetic profile, not a production activation. Do not point at legacy data.
[Owner walkthrough](../25-L2-INTERACTIVE-LOCAL.md), [reproduction/evidence](../../../vnext/evidence/wp2-l2-interactive/README.md).

Please independently verify:

1. **C2/durable actions:** separate sealed LOCAL_INPUT plus SQL-authoritative
   LOCAL_CHAT v2; v1 Meta classification unchanged. Persisted displayed UUID,
   revision, expiry and consumed_by checked under DB time/tenant/conversation lock.
   Original request/seal IDs reconcile after lost ACK/COMMIT. Missing claim/session
   rows fail closed even with valid seals. Later sealed Menu/human decisions are
   checked again before intent/reservation/finish; no stale consumed action wins.
2. **Known/new booking:** menu/cita → two slots/more/date, known selection directly
   creates, new selection asks/validates name before any reservation. Natural-date
   port runs all100 accepted legacy parser tests unchanged in a read-only sandbox.
   Recheck protected availability, explicit buffer, complete UUID bindings and
   qualified same-time reassignment. No extra confirmation/service/staff picker.
3. **C1/runtime recovery:** actual RecoveryWorker starts/stops with the local app;
   silent never-entered deadlines recover without original customer input. SQL
   history/MOVE/entered/UNKNOWN protections remain. Worker/custody/fake-provider
   errors are visible in Needs Attention. No replay of another ARMED owner's permit.
4. **Ordered replies/C3:** typed navigation replies need no dummy appointments.
   Commit-continuation entry precedes one fake effect; entered uncertainty requires
   read-only ledger proof and blocks later replies. Never-entered expiry/supersession
   is not mislabeled UNKNOWN. Expired or Menu-superseded confirmation preserves
   ACTIVE appointment and states it next. The chat summary is bounded; full schedule
   remains in the calendar view.
5. **C4:** SLOT_UNAVAILABLE, resource race after recheck, and forced SQL lock timeout
   tell the customer to choose again and re-offer; never replay the rejected plan
   or claim success. Invalid plans/custody fail held. Human mode persists until Menu,
   including stale displayed-action replays.
6. **Local provider/HTTP:** same-database append-only fake ledger/calendar; result
   proof reconciles actual effects without submitting again. Absent proof remains
   held. Private HttpOnly/SameSite cookie + signed tenant/customer sessions, exact
   Host/Origin/schema checks, loopback only/CSP/textContent. Viewer is owner-oriented
   synthetic data, not production user authorization.
7. **W8/W9:** default/probed ports below49152, typed EACCES/netsh guidance and
   confirmed guard relocation without live-owner takeover; Docker bind-forbidden
   is a port diagnostic. Metadata uses same exclusive writable handle through
   sync/close/atomic rename. No swallowed fsync or archive/dispatcher weakening.
8. **Coherent backup/inert restore:** stop/drain app, checkpoint/authenticate indexed
   archive/witness, dump SQL including fake ledger, copy private keys/config,
   verify recorded manifest hash and all files. Restore only to fresh isolated
   resources, marked inert before restore; SUSPENDED/disabled + advanced epochs.
   Restored profile cannot activate. Missing/corrupt data fails closed. No keys,
   databases, backups or provider state uploaded as evidence.
9. Legacy/backend and migrations001–006/roles are byte-identical to accepted base.
   007 applies only to empty fixtures. Reviewer should assess its explicit typed
   intent/classification additions to the retained reservation function and all
   RLS/role/NULL/shape/state checks; do not treat the copy as a new relaxation.

Codex executed Linux/Node24.19.0/npm11.9.0/measured PG17.11: 445 full /435 fault /306 concurrency /158 focused PASS, zero skips;38 runtime PASS /2 native-only SKIPs, and1 actual-browser PASS.
Suites overlap; typecheck/confinement pass. The actual Chromium/Edge CDP proof
drives both customer flows, verifies calendar/tenant switch and composer visibility.
Runtime tests exercise published CLI paths with spaces/Unicode, actual app crash/
restart, archive reopen, coherent backup and inert restore. Fault tests include
claim/view/entry/plan before/after-COMMIT cuts, fake response loss, missing proof,
both booking/expiry orders and supersession races. State what you actually ran.

Owner original PR12 Windows source8432dd8:24 PASS/5 FAIL/0 SKIP, native ACL passed;
W9 corrected source and integrated L2 native Windows are NOT executed by Codex.
Native-only ACL/W9 skips are explicit, not passes. Return conditional/corrected/
rejected findings; keep Draft/unmerged and Milestone A open until independent and
owner acceptance.

No real providers/cloud/move-cancel/admin catalog UI or multi-worker production
claim. Local admin and sealer/reducer/result trust root (W7/O5), human O6, C5
shared-resource/read-boundary, DST D1 and native Windows/N6 limitations remain.
X1 witness only checks monotonic size/epoch, not independent record-chain AND index
extension. Preserve X1/F13,009/011/production017,N2/N3,A2/A3,013/016 and OPS01,
custody/provider/cloud gates. No legacy change, PR merge, deployment or cutover.

