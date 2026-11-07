# L2 functional correction increment

Authoritative scope: Feature Register **v1.3**, commit
**d1399b90b9c0e3c56e5bdf0fe59f24d925a0d455**, blob
**b26bca5af25ebd56d7c561cd325a0faed0bfa1ba**. Documentation branch remains read-only.
The register retains the input content and appends branch-only statuses; the addendum records
evidence without claiming independent or owner verification. Parent:0691111; owner
native baseline3d8f82b:41 PASS/0 FAIL/0 SKIP, PG17.11, native ACL/sync executed.

## Scope and dependencies (recorded before implementation)

| Category | IDs | Contract / dependency |
|---|---|---|
| Build |029,031,032 |Shared short labels; three-choice menu and all upcoming summaries before choices; no appointment selector; direct cita/agendar |
| Build |033 |Entry acknowledgment only; durable scoped support queue; subsequent support messages silent; menu exits; no owner reply UI |
| Build |035,036 |Stored-fact authorized calendar details; explicit WhatsApp types/limits at construction and SQL boundaries |
| Build |037,040,043 |Deterministic full Spanish grammar in date flow; fourth identity; specific date errors |
| Verify/restore copy |001,003,004,005,008,009,011,013 |Legacy menu, greeting, booking/confirmation copy, accent; no customer-message platform branding |
| Verify |041,042 |Future per-employee60+15 buffers; forged old selections after newer offer/menu/human/restart/capacity races |
| Design |030,034,039 |Uncertain acknowledgment ordering; authorized inbox/routing; evidence-only protected recovery; no blind retry/clear |
| Owner decision |038 |Customer overlap/duplicate policy; no new restrictions without approval |
| Next parity stage |006,007,010 |Direct move/cancel using durable operation semantics; management selection only when implemented |
| Defer |044,012,014–028 |Natural-language escalation and commercial/provider features;027 is a dependency, not provider authorization |

## Confirmed causes

Menu explicitly calls availability.open(); human ordinary() generates another reply;
active summary has LIMIT1; browser ignores LIST; date grammar lacks weekday+calendar
composition; calendar projection lacks a joined detail view. Existing construction
validation needs coverage for all outgoing paths and SQL insertion.

## Implemented behavior and boundaries

Menu uses the three approved labels. Greeting uses stored name and configured
business title; upcoming ACTIVE appointments are ordered by time/ID, without an
appointment selector. An ACTIVE booking with an undelivered/expired confirmation
also remains visible even after its scheduled start (C3), so late applied proof
cannot disappear from the customer view. Historical, already-confirmed past rows
are not called upcoming. Long summaries become bounded preceding text messages,
then the menu. Local SQL transport commits the ordered synthetic batch as one
ledger effect; this is NOT proof of safe partial delivery over real WhatsApp.
Production gate016 must allocate/fence/reconcile each real message independently.
Management and shortcuts explicitly say unavailable and perform no mutation.

Human entry gives the legacy guidance once. Subsequent messages/actions (including
cita/agendar/humano) finish durably with a null reply, retain HUMAN_HANDOFF state,
and are referenced in an append-only business-scoped local_support_message queue.
Original input sequence orders messages; retries use the original input ID. Menu
exits. SQL routing captures messages before a later priority Menu can supersede
processing. Messages admitted after Menu are not routed into the old human queue.
Diagnostics expose a count/category, never customer message text. **No person is
notified and no authorized staff inbox/reply path exists yet.** This is durable
local queueing, not proof of delivery to Juanita or any real human. NM-034 owns
that missing end-to-end route; the simulator says so instead of faking replies.
The local cookie is the synthetic fixture-owner credential; selecting a signed
tenant/customer session is not real staff authentication (existing O5 boundary).

Date labels share shortDate(): business zone, lowercase Spanish, accented mié/sáb,
no day padding,24-hour time. Full weekday+calendar grammar checks the weekday of
the inferred/provided year; contradictory dates fail. Existing100 legacy date
acceptance cases remain unchanged. Impossible, unknown, past and horizon errors
remain actionable; idle date text returns the menu, not availability. UI LIST
uses a separate date-list control. TS and SQL enforce counts/title/body bounds;
Meta payload construction strips internal action metadata. Real Meta validation,
transport contracts and old-button UI remain provider-gated.

Calendar details are authenticated by the local owner cookie plus the signed
business session. Event lookup joins only the same business. Stored local_customer
name, customer.subject synthetic contact, local_booking_intent.slot service ID,
resource assignment, calendar times/buffer, appointment state and original input
classification produce the displayed facts. Duration is computed from stored
start/end. **No phone number or service display name is stored**; both remain
null/not registered, never inferred from a contact alias or business title.
Imported/unlinked synthetic calendar rows keep unavailable booking facts null.
A fourth persona new3 uses a new deterministic subject in each business; no
existing identity/profile config/UNKNOWN case is reset or replaced.

## Designs only and decisions

### NM-030 — nonconfirming uncertain acknowledgment (not shipped)

The existing booking/confirmation attempt and local_reply enter/UNKNOWN states
are authoritative. A before-apply exception is NOT proof of nonapplication. No
extra identity or bypass send is allowed. A prior uncertain reply blocks later
replies; booking UNKNOWN holds Menu until authoritative booking facts arrive.
The proposed acknowledgment cannot currently pass both gates. It remains
**BLOCKED_BY_ORDERING_CONTRACT**, not queued/sent. Needs Attention retains the
existing operation category, without PII. Regression cases cover before-apply,
lost applied response/read-only recovery, missing outbound proof/channel-like
failure, restart and no duplicate extra sends. A live channel outage cannot be
proved by a local fake; no live-provider claim is made.

A later safe design requires an explicit sealed nonconfirming output class and
SQL ordering rule that may accompany a held booking without overtaking ANY earlier
entered/UNKNOWN outbound. Original ID, due/window/expiry, channel readiness and
no-resubmit permit remain mandatory. Record queued/sent/blocked/impossible as facts,
never promise follow-up. Independent review must approve that class before code.

### NM-034 — authorized support inbox

Propose a separate business-scoped inbox, linked from Needs Attention; support
requests are not automatically provider incidents. Roles: assigned business owner
and explicitly delegated support staff can read/claim/reply within that business;
platform recovery reviewers receive masked evidence, not blanket customer access.
Use verified identities/membership, short-lived authorization, RLS and immutable
role/assignment/read/reply/transfer/close audit. Notifications contain an opaque
case reference and business label, no message body/phone. Persist one notification
intent with deduplication and delivery status; a missing notification is visible.
Queue references the original input rather than copying customer text into logs.

Staff replies must enter the same durable ordered outbound/fencing mechanism;
no direct HTTP/provider sends from an inbox button. UNKNOWN staff sends block
later sends and cannot be retried blindly. Claim/transfer/close use revision CAS,
mandatory reason and scope checks. Closing does not silently change the customer's
bot mode; approved Menu remains the customer escape. Test cross-tenant membership,
revocation, both-direction delivery/uncertainty, multiple staff races, read status,
notification outages, restart and Menu/close races before building. This increment
ships neither inbox endpoints nor fake owner replies.

### NM-038 — owner decision required; behavior unchanged

Observed: Ana held10:30 and was offered10:30/11:00; María held14:00 and was offered
13:30/14:00. UI rejection at an earlier11:00 attempt does not prove overlap policy.
Current availability checks employees/calendar/local protections. The SQL layer
also protects unresolved same-customer ranges; it is not a general policy against
overlapping already-applied appointments. Do not infer a ban or remove that safety
protection. No new customer-overlap or duplicate restriction is implemented.

Recommend for the pilot: block exact duplicates and overlapping appointments for
one customer, with a separately approved business exception for group/simultaneous
services. Alternative: permit overlaps under explicit business policy, with a
clear duplicate warning before a new request, preserving direct slot selection.
Owner must choose allowed exceptions and whether a customer's buffer counts;
then define transactional cross-employee/customer admission checks and tests.
Distinct nonoverlapping appointments remain supported either way.

### NM-039 — protected-operation operator workflow

Propose authenticated role-scoped read-only case inspection: original business,
masked customer/appointment identity, original input/plan/attempt/output IDs,
expected/current revisions, protected resources, custody/checkpoint status,
entry/UNKNOWN facts and provider/ledger evidence. Each inspection/query records an
audit intent/outcome. Existing authoritative read-only fake-ledger proof may be
recorded through the machine result reducer, under the original identity; operators
do not declare success. No evidence/negative lookup leaves UNKNOWN held.

A later provider-specific authoritative nonapplication procedure requires its own
contract and independent approval; absence of a result alone cannot release a
protection. No generic clear, manual success, retry, new booking identity or
restored-profile activation button. Separate local operator sandbox tests from
production X1/custody/repair/OPS01 gates. Preserve Ana's live test case for review.

### NM-035 — eventual Google event map (no provider calls)

| Field | Source / proposed mapping |
|---|---|
| Event identity | Original sealed eventId, bound appointment/business; no new ID on retry |
| Summary | Verified stored customer name + “— Cita”; safe configured generic fallback if absent |
| Description | Authorized name/contact/service/employee details, only when stored and permitted; never fabricate phone/name |
| Start/end | Original sealed service start/end with business IANA zone and explicit instant offsets |
| Private metadata | Stable business/appointment/operation identity, resource/service IDs, schedule revision; authorization required |
| Buffer | Preserve stored scheduling buffer; decide separate busy block vs employee-calendar policy before provider activation; never extend displayed service duration silently |
| Status/source | Proven local booking status and original input classification; provider reconciliation must bind the original event/envelope |

Missing model requirements: verified customer WhatsApp address separate from local
subject; service display-name/version snapshot; consent/retention and staff access;
provider field contract, per-employee calendar mapping and buffer representation.
These are not silently added to existing sealed booking envelopes.

### Next parity implementation stage — NM-006/007/010

1. Durable owned-upcoming-appointment selection only after manage/reschedule/cancel,
   with scoped displayed ID/revision/expiry and backend replay protection.
2. Wire existing MOVE/CANCEL reducers and history to fake calendar semantics (the
   present fake adapter accepts CREATE only). MOVE retains source AND proposed
   target protections until proof; cancellation retains required custody. A chosen
   new slot or cancellation target executes directly without an extra confirmation.
3. Apply legacy copy and complete independent fault/concurrency/restart/stale-action
   review, then owner Windows acceptance. This scope is design-only now; the next
   bounded implementation increment needs owner authorization.

NM-044 and other deferred commercial/provider features remain deferred. All prior
production X1 record-chain AND index-extension custody, archive/repair,009/011/017,
N2/N3/A2/A3,013/016,F13,W7/O5/O6,C5,D1,Windows/N6 and OPS01 restrictions remain.
No PR merge, legacy data change, real Meta/Google, cloud or production activation.

## Existing Windows profile upgrade

Keep the old checkout and private profile. **Do not reset, delete or reuse an inert
restore as an active profile.** A fresh code checkout must point explicitly at the
original vNext state directory, never v0.8.1. Keep backup files and returned digest
private/off-repository. Replace placeholders below with the existing absolute path
and original instance ID from private state.json; do not paste credentials anywhere.

From old vnext, stop the app (`npm.cmd run demo:stop -- --state-dir "C:\\...\\.local-demo"`).
Create a fresh isolated checkout at the published exact tested source, then:

```powershell
cd vnext
npm.cmd ci --ignore-scripts
npm.cmd run typecheck
npm.cmd run check:scope
npm.cmd run test:runtime
npm.cmd run demo:upgrade -- --state-dir "C:\path with spaces\old-vnext\vnext\.local-demo" --confirm "EXISTING_INSTANCE_ID"
npm.cmd run demo:book -- --state-dir "C:\path with spaces\old-vnext\vnext\.local-demo"
```

Upgrade holds the exclusive command socket, stops the only app writer, takes and
hash-verifies a coherent SQL/archive/witness/key/config backup, then transactionally
adds008. It never re-runs empty-fixture migrations001–007 or rewrites old rows,
identities, archive, booking attempts or protections. It stays stopped; activation
is a separate explicit book command. Repeated upgrade reports alreadyCurrent;
transaction failure leaves the old schema/data intact. Keep the old checkout and
recorded backup digest for investigation. A restored backup is a separate **inert**
profile and cannot activate automatically; rollback activation is not implemented.
W8 port/guard reservation rules and W9 writable atomic metadata publication remain.

Owner smoke: inspect Ana's existing Needs Attention/held operation first, without
clearing it. In other personas test menu vs cita/agendar, new-customer name after
slot, manage-unavailable response, all upcoming summaries, short date list, full
Spanish date/mismatch, entry-only human acknowledgment/quiet text/Menu exit,
calendar detail, fourth-person race, restart and business isolation. Full corrected
native Windows/browser acceptance remains pending until the owner runs this source.
