# 11 — Greenfield requirements and scope

Status: **vNext implementation specification for later approval, not code authorization**. Frozen parity is [01](01-Requirements-Baseline.md) at accepted application commit `95decc812c228f25171ecfe647200447c83e2e45`; owner direction is [09](09-Owner-Product-Decisions.md), including its later amendments. [10](10-Final-Architecture-Review.md) amends the safety contract; [12](12-Implementation-Readiness-and-Verification-Plan.md) defines execution gates.

## 1. Release boundary and change control

The first implementation target is **P0: v0.8.1 functional parity on the new foundation**, with improved safety/operations. P0 is a proposed scope selection, requiring owner approval before coding. It does not include complete employee-choice, manual-adoption, consent-question, native-chat or dashboard workflows. The owner has approved their product direction, not their inclusion in P0. Their identities and authority boundaries must nevertheless be designed from day one.

Use separate behavior profiles: `parity` retains the accepted customer flow; future `assistant-add-on` intentionally changes onboarding/ordinary-message routing. Do not claim both identical UX contracts run simultaneously. Promotions between profiles invalidate only incompatible transient actions, preserving durable operations, permission, appointments and uncertain attempts. These are specification names, not required literal environment variables.

No production-data migration, old schema compatibility, pre-v0.8.1 button grammar or experimental code retention. Tests may start fresh, but a crash/restart scenario retains its own current-version data and provider simulator state. The accepted checkout/branch, its actual POC database/events and credentials remain protected. No concurrent live old/new dispatcher may target shared resources without an approved ownership transition.

## 2. Scope and traceability matrix

Classes: **P** mandatory parity; **S** new safety foundation; **F** known future structure; **L** deferred workflow; **O** owner/provider decision. Future identifiers `F-*` below reference this document, not Claude's original F-series. Every original baseline ID appears in this mapping; detailed acceptance/copy remains in 01's 49-row RTM.

| Trace | Class / first target | Required outcome and boundary | Acceptance / later change |
| --- | --- | --- | --- |
| S01, O01, O04 | P/S, P0 | Explicit capability modes and validated mappings. Commercial operation cannot bypass unresolved durable work; no automatic provider/reminder activation. | Disabled management/support/read-only cannot mutate; incompatible saved work blocks safely. |
| W01–W02, I01, I04 | P/S, P0 | Exact-byte signature, authenticated channel authority, durable scoped dedup/content conflict; admitted processing waits for required recovery evidence seal. | Invalid/unknown routing cannot create tenant work; duplicate signed event causes one accepted effect. |
| W03–W04, W07, W09 | P, P0 | Scoped registration/name priority; current menu, two-plus-two/date flow, immediate selected booking, correct timezone labels and button limits. | No new staff question in P0; preserve exact baseline success/empty copy and name-after-slot behavior. |
| W05–W06 | P/F, P0 then F-CHAT | Current human handoff/intent priority; future ownership model must distinguish automation from ordinary native chat. | P0 stored handoff remains, no fictional staff delivery/notification. Future profile tested separately. |
| W08, C01–C03, I10 | P/S, P0 | Business hours/buffer/breaks, bounded Spanish civil-date grammar, 365-day search/direct date; unavailable not empty; correct instants/local dates. | Default resource reproduces single-person behavior. Future employee availability uses same domain rules with resource scope. |
| C04–C09, I02–I03 | P/S, P0 | Immediate owned create/move/cancel, preserved customer details, stable identity/replay, current Google truth versus historical outcome. | APP_CREATED origin initially; no automatic old/manual-event import. Full ownership tuple and exact current operation required. |
| I05–I09, I12–I13 | P/S, P0 | Ordered immutable saved replies, durable continuations/attempts, protected uncertainty and atomic finalization/reminder hooks; safe expiry and scoped receipts. | Armed attempts cannot be stolen/retried by timer. Submission order does not imply Meta device delivery order. |
| I11, O02–O03 | P/S, P0 | Protected grants/operator scope, redacted diagnostics, coherent verified backup/isolated restore and no effect replay after data loss. | New independent recovery protocol and deployed role/restore proofs required before commercial use. |
| R01–R04, R07–R08 | P/S, P0 | New eligible app-created bookings only; strictly future 168/24/22/2h; 15-minute late allowance; delivered-parent follow-up; change/manual-edit invalidation. | No manual-origin enrollment until F-MANUAL; future import has its own explicitly approved policy. |
| R05–R06, R12 | P/S, P0 | Exact request/schedule attendance confirmation, single Calendar suffix, existing reschedule flow; current/historical ambiguity preserved. | Same-schedule request/follow-up represent one logical target; old schedule/customer context never falls forward. |
| R09–R11 | P/S/F, P0 then F-CONSENT | Genuine business-scoped permission ledger, withdrawal priority, actual WABA/Utility contract/TTL; off/preview/live boundaries. | No permission from booking/phone/approval; customer-initiated Accept/Decline is later explicit workflow, not an inferred grant. |
| Q01 | S, P0 | Demonstrated security, correctness, deterministic recovery, maintainability and measured operations at approved scope. | No fixed test-count, line-count, scale or legal-compliance claim. |
| F-STAFF, 09 F-01 | F now; L after P0 | Employees may overlap on same business Calendar; each employee capacity one. Preference or random available assignment, employee title/color, future reassignment. | Resource identity, reservations and assignment revision built initially; multi-employee UX/admin UI deferred. |
| F-CHAT, 09 F-11 | F now; L after P0 | Scheduling add-on to normal business WhatsApp; at most one introduction on first/new >24h inbound gap; explicit scheduling entry, reliable human process. | Participant/ownership/intro epoch foundation now. Coexistence feasibility gates actual native App deployment. |
| F-MANUAL, 09 F-06 | F now; L after P0 | Detect owner-created events, validate contact association, resource assignment, existing permission; pending authorization/Needs Attention if not eligible. | Origin/adoption/candidate identities now; detection/owner review/opt-in/enrollment workflow deferred. |
| F-CONSENT, 09 additional F-06 | F now; L after P0 | Customer writes `da mi permiso`/approved variants; named-business Accept/Decline; auditable, revocable reminder-only consent. | Verified inbound identity and explicit response; trigger is not consent. No unsolicited permission solicitation. |
| F-ADMIN / commercial scope, 09 | F/O/L | Owner reassignment/Needs Attention UI later; payer/pricing, residence/retention, staffing and targets remain open. | Scoped internal review records now, not dashboard/billing implementation. Subscription message allowance is not an approved payer arrangement. |

## 3. Initial domain/data foundation

Entities are justified by the current and known future authority model; no schema is created here. Full constraints/DDL must pass checkpoint 1.

| Concept | Required identity/relationships and initial purpose |
| --- | --- |
| Business / provider channel / Calendar mapping | One Calendar associated with one business; authenticated number/WABA mapping and revisions. A business may later have several employees on this Calendar. Provider grants are scoped, whether individually issued or part of a validated partner arrangement. |
| Employee/resource | Stable business-scoped resource ID, enabled status and schedule-policy reference. For P0, one explicit default resource has the baseline business-wide hours/duration. It is never an implicit “Calendar is employee” identity. Future per-person schedules/suspension/leave need policy. |
| Appointment identity / origin | Stable `(business, Calendar resource, event)` with separate origin APP_CREATED or later OWNER_MANUAL_VALIDATED. Local creating operation OR authorized adoption evidence binds it, plus customer association, schedule/assignment revisions and observed Google version. Copied properties or unknown phone text do not create ownership. |
| Assignment / resource reservation | One assigned employee in the current product model; source/target protections and effective interval/buffer. Unknown manual resource is an explicit unresolved state, not “available to everyone.” One unresolved event mutation protects times and assignment changes together. |
| Customer / verified channel identity / candidate contact | Raw provider sender key scoped by business, verified aliases/association provenance separate from normalized phone display. Candidate manually entered number is not a registered verified WhatsApp identity. Provisional conversation/withdrawal need not register a named customer. |
| Conversation / participant / ownership | Classify inbound customer, outbound business/owner echo and automated app output. Persist human/automation authority and explicit transitions. Native App echoes must not enter the customer command/consent reducer. |
| Intro opportunity | Business/sender plus inbound-inactivity epoch and offered/attempted outcome; atomic dedup admission gives at most one intro per eligible opportunity. Persist previous inbound instant independently of send time/Meta window. |
| Operations / attempts / guards | Stable scoped effect intent, immutable submission identity/owner, full state enum, format/configuration/credential/assignment versions, external evidence and retained uncertainty. No unconstrained caller IDs. |
| Permission head / evidence | Business plus verified sender or candidate suppression identity; persistent serialization head even without a grant. Attributable scope, wording/version, source/provider evidence, occurrence/recording times, grant/decline/withdrawal and tie precedence. |
| Manual candidate / Needs Attention | Detection event/version, candidate contact/resource, validation/authorization status and reason; idempotent review resolution. No automatic sends from detection. Public UI is deferred; operator inspection satisfies P0 diagnostics. |
| Recovery evidence / audit / sealing | Namespaced authenticated acceptance, original identity/action provenance, operation/attempt and suppression/command evidence, key/format versions and completeness markers. Raw multitenant bodies remain restricted; recovery cannot regenerate unknown effects. |

### Employee-level concurrency

Reservation exclusion is on **business-scoped employee/resource and half-open protected interval**, with validated source operation/appointment foreign keys and retained unknown effects. Calendar mapping is tenant ownership, not capacity. An appointment's self-overlap exception does not grant another mutation admission. Calendar ID alone must not exclude two different employees' simultaneous appointments.

For “any employee,” compute eligible employees for the chosen interval, then choose from those still available at **atomic admission**. Persist the selected identity exactly once with the operation. If a competitor takes a candidate before commit, choose/retry admission among remaining candidates under the same stable intent; after commit/arming, a retry never randomly picks a different employee. Persist a draw/result for replay and test deterministic seeded selection in fixtures; do not require secure lottery/fair-load optimization without owner request. A specific preference never silently switches employees; show updated options if that person is unavailable.

Reassignment later uses the same mutation coordinator: lock current appointment/source assignment, check target availability, protect both resources until the Google/assignment result is verified, update employee name/properties/color only by approved convention and version. Failure preserves the original assignment; uncertain outcome holds both protections. Decide whether resource-only reassignment resets attendance, which messages are sent, and how manual owner edits are reconciled before enabling it.

**Shared Calendar availability cannot use undifferentiated free/busy as the employee arbiter.** Use event-aware metadata/local validated assignment for known events. An unassigned external event must not silently become free for every employee: initially hold affected availability conservatively and raise review, or use an owner-approved explicit business-wide-busy convention. The commercial import/resource policy is an affected-feature gate. Google remains time/existence authority; employee association is a validated operational identity. Flag actual external overlaps for owner resolution; never automatically cancel either event.

## 4. Natural WhatsApp conversation contract (future profile)

- Only customer inbound events can open an intro opportunity or explicitly request automation. Preserve raw sender/channel authority. Deduplicate provider/App echoes so the assistant does not respond to itself or interpret owner text as customer consent/cancellation.
- On first contact or a new customer message **more than** 24 hours after that sender's previous inbound message, at most one concise intro may explain `menu`/`cita`, when permitted. Exactly 24 hours does not meet “more than.” Update the prior-inbound marker atomically even when no intro is sent.
- This owner UX epoch is **not** the Meta customer-service-window rule. A fresh inbound may open a provider service window, but the permitted response must still pass the actual account/policy contract. Neither inactivity nor a phone in Calendar authorizes proactive contact.
- Do not automatically show the full menu in this profile. Explicit `menu`, `cita`, `reagendar`, `cancelar` and supported variants start the requested flow. Ordinary conversation remains with the business; avoid unnecessary automated responses or an artificial human-mode lock on every casual message.
- Human ownership suppresses automation except approved escape/withdrawal behavior. At most one intro does not mean an intro must interrupt a human conversation. Define takeover, handback, owner activity, queued app replies and notification responsibility before rollout. Keep baseline recorded handoff in P0.
- Verify WhatsApp Business App/Cloud API coexistence for the actual region/account/onboarding pathway, customer and owner message visibility, echo callbacks/history, message types and provider policy. Do not promise that every API number can continue native App chat. If coexistence fails, present the limitation and obtain a product decision before launching this promised experience; never silently replace it with bot takeover.

## 5. Manual appointments and permission trust boundary (future workflow)

Pipeline: **detected → candidate contact/resource → identity association validated → permission/appointment eligible OR authorization pending/review → future reminder enrollment**. Persist detection keys and decisions; repeated sync must not duplicate adoption or jobs. App-created verified identity and manual adoption use the same reminder execution gates after admission, with separate origin/enrollment policy.

1. Owner writes a number in description/body under a documented field convention. Parsing yields a candidate, not proof of phone ownership, WhatsApp reachability, customer identity or consent. Multiple numbers, invalid country data or multiple customer matches go to review.
2. Link only using trusted business-scoped verified identity/alias evidence and an authorized owner-association policy; revalidate edits and prevent reassociating a booking to someone else silently. A number can be mistyped or recycled; evaluate alias verification lifetime and reconfirmation needs. A successful number-format parser is insufficient evidence.
3. Existing valid **reminder** permission can be recognized only after correct identity association, business, scope and revocation checks. A copied Calendar phone/property cannot borrow another customer's grant.
4. If missing permission/identity, set `authorization pending` or identity review and create one deduplicated Needs Attention item. Do not send an unsolicited WhatsApp permission request or use an approved template as a workaround. Owner may invite the customer through an otherwise legitimate channel/in person to initiate contact.
5. Verified inbound `da mi permiso` opens a concise named-business reminder-permission question, subject to provider service-window rules. An explicit scoped, current **Accept** records the grant; **Decline** records refusal/suppression. No response is not consent. Replayed/stale/foreign Accept cannot regrant after a later withdrawal. Original wording/version, provider identity/ID, times and recorder/source are auditable.
6. Enrollment only after adoption, resource/time/ownership, activation/enrollment policy, permission and template eligibility all pass. Only applicable future occurrences; do not replay historical reminders to “catch up.” Define whether existing manual events enter on enablement or only newly observed events before enabling ingestion. This is a future extension, not a change to P0's no-import rule.
7. Manual edits/deletions/resource/customer changes rotate/invalidate appropriate schedule/association versions; a confirmed appointment moved manually remains reviewable. Consent never moves with a number/text edit. Needs Attention may be a backend/operator queue initially; owner web UI is separately planned.

## 6. Required safety foundation

Apply amended SC-1–SC-17 in 10 and add these feature-specific invariants:

- **FS-1 Resource authority:** simultaneous appointments on different employees are allowed on the same business Calendar; overlapping appointments on one employee cannot both be admitted by cooperating writers. Assignment persists across retries, uncertainty and restart.
- **FS-2 Manual trust:** detection/parsing never grants management, verified WhatsApp identity or permission. Every manually adopted appointment retains business/customer/resource validation and origin evidence. No direct phone-triggered send.
- **FS-3 Participant authority:** business-owner echoes and bot output never count as customer commands, intro resets, identity evidence or consent. At most one intro admission per eligible customer inactivity epoch.
- **FS-4 Consent safety:** permission acceptance is scoped to the exact business/person/purpose/question version, revocable, and serialized against sending. Nonresponse, booking, notification, template approval and presence in Calendar are not opt-in.
- **FS-5 Recovery closure:** a restored app may not invent offers, employee draws, adoption decisions, consent grants or attempts from current data when historical evidence is missing. Preserve original IDs/versions or hold scopes; replay remains inert.

## 7. Unresolved decisions and first-release exclusions

| Decision needed | Before which work becomes active? |
| --- | --- |
| Approve P0 parity-first versus inclusion of named future workflows | Before implementation prompt is issued. Foundation identities remain necessary either way. |
| Employee creation, personal hours/breaks/leave/durations, any-employee presentation and random-assignment expectations | Before F-STAFF UX and operator setup; specify P0 default-resource behavior now. |
| Unknown manual event resource/busy convention; exact employee title/color/tag; reassignment/attendance/notifications | Before multi-employee Calendar interaction and owner reassignment. |
| Coexistence capability/account onboarding, echo authority, human takeover/reentry and actual staffed handoff | Before assistant-add-on profile activation/commercial promise. |
| Manual description convention, matching evidence/lifetime, adoption authority, reminder enablement/import policy | Before F-MANUAL enrollment. |
| Consent wording/variant set, refusal/regrant, evidence retention and authorized notices | Before F-CONSENT activation. Existing supported opt-out remains parity. |
| Billing payer/partner arrangement, allowance measurement, package policy | Before commercial pricing claims; no billing implementation in P0. |
| Region/privacy/retention, targets, staffing/budget and residual uncertainty release authority | Before selecting production custody/HA service and commercial activation; approve minimum development custody earlier. |

Services catalog, billing engine, owner dashboard, onboarding portal, extra channels, multi-staff workflow and manual ingestion are not silently added to P0. The owner-facing reassignment/Needs Attention UI is known future scope; backend IDs and review objects exist without implementing that UI. Neither four-instance hosting nor arbitrary numerical targets, key-retention periods or a five-minute uncertainty escape become approved by inclusion in a design document.

**First implementation boundary:** one fresh core, one default employee/resource per parity business, existing Spanish appointment journeys, validated app-created Calendar operations, current reminder/permission rules, durable transport/recovery, scoped operator tooling and evidence-based tests. Future behavior remains disabled/unimplemented until its work package is approved and verified. Nothing in this document changes the current v0.8.1 baseline.
