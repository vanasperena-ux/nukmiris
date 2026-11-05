# L2 safety composition — implemented entry foundations

[Claude accepted C1](https://github.com/vanasperena-ux/nukmiris/pull/11#issuecomment-6658436709)
and [L1](https://github.com/vanasperena-ux/nukmiris/pull/13#issuecomment-6658774399),
clearing L2 start. This branch composes accepted L1 source afa1b74 with the corrected
runtime source8432dd8 on a separate branch; no Draft PR is merged. Original reviewed
source/evidence remain at their exact GitHub pins. New code implements R1 and
L1-C1–C6 foundations before the first interactive interface.

## R1 — automatic deadline recovery

Migration006 and recover-expired.ts add machine-sealed DEADLINE_EXPIRED abandonment
for operation attempts whose original deadline is strictly before DB time. The seal
binds business, original attempt/payload and exact deadline; no identity factory,
provider port or operator role is involved. SQL takes business/conversation,
appointment/attempt and resource locks, then checks state/time and calls the existing
safe abandonment transition. CREATE becomes CANCELLED; MOVE restores its applied
source protection/history. Only PREPARED/ARMED can change. SUBMISSION_ENTERED/UNKNOWN
remain protected, including lost entry COMMIT replies. Entry and expiry cannot both
succeed. Missing custody rolls back and retains guards; original-key reconciliation
is idempotent after before/after-COMMIT crash cuts.

Ordinary admission's existing drain now runs this recovery, so a dead predecessor
cannot indefinitely block the next ordinary input after its deadline. The ACK's
reduction observation is updated to the final reduction for that partition. The
RecoveryWorker also provides an explicit periodic loop for silent deadlines, with
bounded pages/cursors, tenant-bound archive facades, non-overlapping ticks and
awaitable shutdown. Output deadline expiry uses the accepted output CAS as well.
The inert health runtime does not silently start this worker; L2's explicitly
activated synthetic composition must start/stop it with the app lifecycle.

## L1-C1–C6 composition

| Condition | Implemented contract / test |
|---|---|
| C1 buffer | prepareBookingSelection passes the rechecked slot's bufferMinutes explicitly into the core request and maps calendar/employee identifiers to validated UUIDs. An appointment at the prior unbuffered end conflicts when its buffer is nonzero. |
| C2 local protections | protectedCalendar merges scoped core.protection ranges into the read, including PREPARED/UNKNOWN and MOVE source/target ranges. Their upper bound already includes buffer, so their synthetic busy buffer is zero. Stable local projection hashes join the calendar snapshot; a changed projection holds a multi-page search. Use a fresh wrapper for each logical search/recheck; observations are not reservations and SQL remains authoritative. |
| C3 reassignment | Final recheck preserves identical start/end/service/buffer and picks any qualified free employee, instead of failing solely because the original implicit employee became busy. The fresh employee UUID is the one reserved. There is no customer employee picker. |
| C4 expiration | Each actually displayed view receives an explicit revision and fresh15-minute expiresAt. New navigation/date/name views refresh their own lifetime; all old revision tokens remain invalid. This is a deliberate per-view technical contract; it changes no customer steps or direct-selection rule. L2 must persist/check these values under DB-authoritative action claims. |
| C5 unknown resources | Unknown calendar resource IDs are normalized to unassigned/block-all for that interval and emit a structured operator signal. Unknown local protection resource mappings also block-all and signal. Foreign scope, malformed/incomplete reads and failed custody still HOLD; normalization cannot make them free. L2 must persist/project these signals to Needs Attention. |
| C6 presentation | Oracle views explicitly declare LIST/REPLY_BUTTONS/TEXT. Five-choice date navigation is rendered as a list, suggestions/time choices as at most3 buttons. Payload validation enforces list/button limits and rejects an empty BOOK_REQUEST reference as a customer reply. This is local payload shape proof, not live Meta016 contract acceptance. |

One service per appointment, two suggestions, more two/date selection, new-customer
name after slot and known-customer direct selection remain. No new confirmation
click/service/staff picker is introduced. Human mode owns ordinary pending input
until Menu. O5's sealer/reducer trust root is unchanged. Unknown calendar/provider
facts are not released or retried due to elapsed time.

## Acceptance and exact next UI implementation

Run from vnext: npm ci --ignore-scripts; typecheck; check:scope; test:l2prep;
npm test; test:fault; test:concurrency; test:runtime. The selector carries the accepted
80 L1/C1 cases plus new R1/composition scenarios. Tests kill dispatchers before arm
and entry, advance DB fixture time, drive ordinary input and the actual recovery
scheduler, exercise both entry/expiry orders and SQL rollback/lost COMMIT, retain
entered/UNKNOWN protections, recover original keys, restore MOVE source, and verify
every composition contract above. Runtime's native Windows ACL case remains an
explicit Linux SKIP; owner native execution is still required. Exact tested source,
results and hashes are in vnext/evidence/wp2-l2-prep/.

This is executable foundation code, **not a finished interactive booking app**.
The next concrete L2 increment is durable scoped conversation/action/view state and
typed navigation-reply contexts without dummy appointments. Seal/validate the real
synthetic action/booking-intent schema, compose fresh protected availability with
prepare/arm/fake-provider/result/ordered confirmation, and add the minimal loopback
browser chat/fake-calendar viewer. Known selection commits directly; new selection
asks/validates a full name before booking. Preserve actual v0.8.1 natural-language
dates and name rules. After terminal resource/lock conflict, tell the customer to
choose again without retrying the old plan. R2: Menu/next reply must show an ACTIVE
booking when its earlier confirmation was safely expired. Coherent SQL/custody/key/
ledger backup and inert restore must precede claiming persistent L2 recovery.

That UI and persistent runtime activation need explicit local operator intent and
independent L2 review, followed by the owner's native Windows demo. No further
planning-only milestone is needed. Native W1–W3 review/run, Windows/N6 performance,
X1/F13/OPS01,009/011/production017,N2/N3,A2/A3,013/016,production custody/provider/cloud
and merge gates remain. No v0.8.1/data, real Meta/Google, GCP or deployment changes.
