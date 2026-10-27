# Claude — Independent Requirements Assessment

> **Source:** Claude's original PDF submission, 26 October 2026. This is a text-only transcription of the uploaded PDF, not the original PDF binary. Page layout, embedded figures and diagram images may not be preserved. Consult the original PDF for visual material.

---

<PARSED TEXT FOR PAGE: 1 / 11>

NukMiris v0.8.1 Greenfield Challenge — 1 of 5: Independent Requirements Assessment




  NukMiris v0.8.1 — Independent Greenfield
  Architecture Challenge

  Deliverable 1 of 5 — Independent Requirements Assessment
  Independent architect submission · 26 October 2026 · Design only: no code, schema,
  configuration or provider asset was touched.


  1. Basis, scope and independence
       Inputs read: the assignment brief and 01-Requirements-Baseline.md (accepted
       v0.8.1, tag 95decc8… ). I did not read documents 02–05, the application source or the
       tests. Where the baseline is silent or tense, I list the gap below instead of resolving it
       from code.
       IDs (S01, W01–W09, C01–C09, R01–R12, I01–I13, O01–O04, Q01, U-*) are the baseline's.
       No provider was contacted. Claims about Google or Meta behaviour that I cannot
       verify from the baseline are marked [verify S-n] and collected in §7 as spikes that
       must pass before the design is committed.
       Numbers I propose (§6) are assumptions for owner approval. The baseline supplies no
       commercial targets and I do not treat mine as requirements.


  2. Summary of the assessment
  The baseline is unusually good input. The A–E classification separates product behaviour
  from mechanism, and the B-class invariants (I01–I13) are what actually decide the
  architecture. Four properties drive almost everything:

   1. Google Calendar is the truth for appointments, but no transaction spans Google and
       the platform. Every booking, move, cancellation and attendance write is a two-system
       update with an unavoidable uncertainty window.
   2. WhatsApp sends are not idempotent (no provider-side deduplication is described),
      so an unknown send outcome can never be resolved by retrying.
   3. Restart and multi-instance correctness are mandatory (I04, I05, I06, I12), so in-
      process locks and in-memory queues are not acceptable coordination mechanisms.
   4. Backups cannot undo external effects (O03). Recovery therefore needs inputs from
      outside the database.


                                                                                              Page 1 of 11

<PARSED TEXT FOR PAGE: 2 / 11>

NukMiris v0.8.1 Greenfield Challenge — 1 of 5: Independent Requirements Assessment




  I found 17 points where the baseline is silent, ambiguous or internally tense in ways that
  change design. Eight are high impact and need an owner decision before build: F-01, F-02,
  F-03, F-04, F-05, F-06, F-12, F-13. None blocks the architecture, but each fixes an
  assumption the data model or recovery design leans on.


  3. Load-bearing requirements and what they force

     Requirement                                                                     What it forces in any compliant design

     I04, I05, I12 (accept before acknowledging;                                     Accepted input, state changes and queued
     ordered; survive crashes)                                                       replies live in one transactional store so that
                                                                                     "accepted" and "processed" cannot diverge.

     Section 2, C03, C06 (Google is truth; failure                                   An appointment projection is only a cache.
     is not "empty")                                                                 Every adapter needs an explicit unavailable
                                                                                     result distinct from empty.

     I07, I09, Section 4 (definite vs uncertain                                      A tri-state outcome type (applied, definitely
     outcomes)                                                                       rejected, uncertain) on every external call,
                                                                                     plus an operation-specific read-only
                                                                                     reconciliation procedure.

     I06 (cooperating operations cannot finalize                                     Database-level serialization with fencing.
     conflicting intervals; stale workers cannot                                     Process-local locks fail the moment two
     release successors)                                                             instances run.

     I01, W02 (tenant authority from the                                             Tenant is derived once, from authenticated
     receiving channel)                                                              provider metadata, then enforced
                                                                                     structurally at the data layer, not by
                                                                                     repeated application checks.

     R02, R03, I10 (instants for offsets; 15-minute                                  A durable schedule of occurrences with
     late allowance; no replay after downtime)                                       absolute due instants and an expiry. A timer
                                                                                     or queue delay alone is insufficient.

     R09–R11 (permission and template readiness                                      Permission evidence as append-only data
     gate live sends)                                                                and template readiness as data, evaluated
                                                                                     fail-closed at the moment of each send.

     Section 3 (15-minute transient views; stale                                     Offers are server-side records with opaque
     and guessed actions refused)                                                    identifiers. Encoding state in button
                                                                                     payloads would not meet I03.




                                                                                                                                Page 2 of 11

<PARSED TEXT FOR PAGE: 3 / 11>

NukMiris v0.8.1 Greenfield Challenge — 1 of 5: Independent Requirements Assessment




     Requirement                                                                     What it forces in any compliant design

     O03, I12 and the restore scenario                                               Disaster recovery must treat provider state
                                                                                     (Calendar events, delivered messages) as
                                                                                     out-of-band facts that reconciliation reads
                                                                                     back.




  4. Findings: ambiguities, gaps and tensions
  Each finding gives what is unclear, why it matters, the assumption I design to, and
  whether the owner must decide.

  F-01 · Calendar capacity is one appointment at a time (High). The baseline specifies one
  Calendar, business-wide duration and no staff or resource concept, but never states
  capacity. Why it matters: capacity 1 allows a database exclusion constraint to serialize
  bookings. Capacity N or per-staff resources need a different concurrency model.
  Assumption: exactly one concurrent appointment per Calendar; multi-staff is E-class and
  would be modelled later as extra Calendars or resources. Owner: confirm.

  F-02 · WhatsApp account and channel ownership (High). Tenant authority is "the
  authenticated receiving business channel", and each business uses its own approved
  templates and "authorized WABA/sending number" (R10). The baseline does not say who
  owns the WABA (business or platform acting as a technology provider), how numbers are
  onboarded, how credentials are issued, or who bears messaging cost. Why it matters: it
  fixes the credential shape (per-business token vs partner token), the blast radius of a
  stolen credential and the template-provisioning workload (several templates per
  business). Assumption: one phone number per business, mapped to exactly one active
  business by provider phone-number identifier; credentials held per business; onboarding
  stays an operator process. Owner: decide ownership and billing before the first paying
  tenant.

  F-03 · "Do not repeat blindly" versus idempotent Calendar inserts (High). Section 4 says
  provider "not found" cannot prove a late insert never occurred, so the write must not be
  repeated blindly. As far as I know, Google Calendar accepts a client-chosen event
  identifier and rejects duplicates [verify S-1]. A repeat with the same identifier, followed
  by a read, is idempotent and therefore not blind. Why it matters: it turns uncertain
  bookings from "operator reconciliation" into automatic safe resolution. Assumption: the




                                                                                                                              Page 3 of 11

<PARSED TEXT FOR PAGE: 4 / 11>

NukMiris v0.8.1 Greenfield Challenge — 1 of 5: Independent Requirements Assessment




  prohibition targets non-idempotent repeats; a same-identifier retry with read verification
  is permitted. If S-1 fails, uncertain inserts stay uncertain until read-only proof or an
  operator decision. Owner: confirm the interpretation.

  F-04 · What "Calendar ownership metadata" means; one Calendar, one business (High).
  The baseline does not define what marks an event as NukMiris-managed or whether two
  businesses may map the same Google Calendar. Why it matters: tenant isolation, manual-
  change detection (R08) and post-restore reconciliation all depend on it. Assumption:
  managed events carry private extended properties (business, customer, operation and
  schedule identity). Managed means those properties are present and match the acting
  business. A Calendar may map to at most one active business, enforced by a uniqueness
  constraint. Any mismatch fails safe. Owner: confirm that shared Calendars are out of
  scope.

  F-05 · How long an uncertain outgoing message holds later replies (High). I05, I09 and I13
  say unknown sends are never blindly resent and expired output must not block fresh

  work indefinitely. The baseline does not say how long an unexpired uncertain reply holds
  later replies in the same conversation, nor how long to wait for receipt evidence.
  Assumption: strict in-order delivery with a bounded receipt-wait (default 5 minutes,
  configurable). After that the conversation proceeds and the attempt stays uncertain in
  the review queue. Owner: approve the default.

  F-06 · Customer phone identity (High). The baseline forbids asking for a phone already
  supplied and shows an "international" number in Calendar text, but does not define the
  canonical key. WhatsApp identifiers and dialled formats differ in some Latin American
  countries (Mexico and Argentina are the usual examples) [verify S-9]. Why it matters: it
  decides scoped-identity uniqueness, send-to formatting and Calendar text. Assumption:
  the identity key is the provider-supplied wa_id exactly as received, per business. A
  display form derived by a phone library is never used as a key. Owner: no decision needed,
  but the S-9 result may change formatting rules.

  F-07 · Ordering across independent streams (Medium). Ordering is required per
  conversation for inbound processing and reply groups. The baseline does not relate a
  conversation reply, a late operation result and a reminder to the same customer, nor say
  whether a reminder waits while the customer is mid-booking. Assumption: operation
  results join the conversation's ordered outbox. Reminders are an independent stream
  that never waits on browsing state. Interleaving a reminder with a booking dialogue is
  accepted.




                                                                                         Page 4 of 11

<PARSED TEXT FOR PAGE: 5 / 11>

NukMiris v0.8.1 Greenfield Challenge — 1 of 5: Independent Requirements Assessment




  F-08 · Results that resolve after the service window (Medium). An uncertain operation
  may resolve hours later. Ordinary replies are limited to the 24-hour window (I13) and the
  only templates are reminders. The baseline does not say what the customer is told if the
  window has closed. Assumption: no proactive message; the recorded result is returned
  the next time the customer writes, and the operator can contact the business out of
  band. Owner: accept.

  F-09 · No hold during name entry (Medium). Browsing never reserves and execution
  rechecks after name entry (Section 3), so a new customer can finish name entry and then
  lose the slot. Assumption: parity with the baseline: reserve only at submission; on a failed
  recheck, return fresh nearby options. A short TTL hold would be an additive change if the
  product wants it.

  F-10 · Configuration changes while work is outstanding (Medium). Hours, duration,
  buffer and capability flags can change while offers, operations and reminders exist. The
  baseline does not say which version governs a pending operation. Assumption:
  configuration is versioned; each operation records the version it used; existing
  appointments keep the interval recorded in Calendar; an offer is invalidated if an
  availability-relevant field changed.

  F-11 · Human handoff has no human (Medium, product and operations). Handoff records
  are stored but nobody is notified (Section 2). A customer in human mode gets no
  automation until they send Menu. This is a perceived-reliability risk, not a correctness
  defect. Assumption: the design stores handoffs and exposes a read-only operator queue
  with an oldest-unattended metric. It adds no customer-facing behaviour. Owner: be
  aware; I recommend at least an operator alert before commercial launch.

  F-12 · Jurisdiction, privacy and retention (High for commercial use). U-OPS leaves
  retention, residency and deletion open. The target market spans countries with distinct
  data-protection regimes (for example Mexico, Brazil, Argentina, Colombia and Chile).
  Customer names and phones also live in the business's Google Calendar, which NukMiris
  does not own. Why it matters: it decides region, retention jobs, erasure mechanics, how
  consent evidence is stored and how diagnostics are redacted. Assumption: minimal PII,
  per-data-class retention that is configurable, per-business export and deletion capability,
  and protected credentials. Region is fixed after the owner decides. Owner: required
  before a pilot with real customers.

  F-13 · Provider standing and quotas (High). The baseline omits launch prerequisites that
  can fail independently of code: Google OAuth consent-screen publishing and verification
  (refresh tokens for apps left in testing may expire quickly [verify S-5]), Meta business




                                                                                         Page 5 of 11

<PARSED TEXT FOR PAGE: 6 / 11>

NukMiris v0.8.1 Greenfield Challenge — 1 of 5: Independent Requirements Assessment




  verification, display-name approval, per-WABA template approval, and messaging limits
  and quality ratings. Assumption: these are tracked as launch prerequisites with named
  owners, and the design exposes credential, channel and template health per business.

  F-14 · Template lifecycle during live operation (Medium). R10 blocks sending when a
  template is paused, disabled or rejected, but not how NukMiris learns of a change
  between checks. Assumption: subscribe to template status and quality notifications
  [verify S-7], store them as data, re-verify at send time (Meta remains final authority),
  alert the operator, and block reminders fail-closed.

  F-15 · Time-zone rule changes and DST policy (Medium). U-DST leaves ambiguous
  (repeated) wall-clock times open, and the baseline says nothing about governments
  changing time-zone rules after an appointment is booked. Assumption: store the instant
  plus the business zone; reject nonexistent times; exclude repeated wall-clock starts from
  offers (conservative); keep time-zone data updatable without a code release.

  F-16 · Operator model (Medium). "Authorized platform operator" has no authentication,
  authorization, headcount, offboarding or separation-of-duties specification, yet operators
  can retry uncertain messages, record consent evidence and restore backups.
  Assumption: one to three operators; single sign-on with MFA; read-only, support and
  admin roles; every mutating action requires a reason and is audited. Consent evidence
  recorded by an operator is attributable, but its truth is an off-platform business process.

  F-17 · Customer-visible copy as a contract (Low). Some strings are exact (the no-
  appointments message, reminder bodies, label format) and others are only described.
  Assumption: all customer copy lives in a versioned catalog. The exactly-specified strings
  are snapshot-tested.



  5. Disposition of the baseline's own open items

     ID                                       My proposed resolution                    Needs approval

     U-NAME / U-                              Keep the stated validation as a pure,     Yes
     COMMAND                                  replaceable function. During name entry
                                              only the exact global menu command
                                              overrides; other navigation words are
                                              treated as names if they validate.




                                                                                                         Page 6 of 11

<PARSED TEXT FOR PAGE: 7 / 11>

NukMiris v0.8.1 Greenfield Challenge — 1 of 5: Independent Requirements Assessment




     ID                                       My proposed resolution                        Needs approval

     U-DST                                    Reject nonexistent local times. Exclude       Yes
                                              repeated local times from offers. Preserve
                                              instants everywhere.

     U-EXTERNAL                               App-level concurrency safety via database     Yes (commercial
                                              constraint plus a fresh Calendar read         policy)
                                              before write. After each write, an overlap
                                              audit flags external overlaps to a review
                                              queue and never auto-cancels.

     U-REPLAY                                 Separate the recorded outcome of an           Yes (wording)
                                              operation from current appointment state.
                                              A repeat returns the outcome labelled as
                                              historical and adds current state when
                                              Google is readable.

     U-ACTIVATION                             Conservative parity: compare intent-          Yes
                                              creation time with activation. Store both
                                              intent and commit timestamps so either
                                              policy applies without migration.

     U-GENERIC                                Target a generic "Sí" only when exactly one   Yes
                                              dispatched, unresolved request exists
                                              across the customer's current upcoming
                                              schedules in that business. Otherwise ask
                                              for the specific button. Requests on
                                              cancelled, moved or past schedules cannot
                                              be targeted, so no arbitrary age cutoff is
                                              needed.

     U-RETRY                                  Operator-only, scoped, audited retry with     No (parity)
                                              a reason and a duplication warning,
                                              recorded as a new linked attempt. Never
                                              automatic.


     U-OPS                                    Proposed targets in §6; hosting               Yes
                                              recommendation in Deliverable 2.




                                                                                                              Page 7 of 11

<PARSED TEXT FOR PAGE: 8 / 11>

NukMiris v0.8.1 Greenfield Challenge — 1 of 5: Independent Requirements Assessment




  6. Proposed targets (assumptions exposed for owner approval)
  The baseline asks that proposed targets be exposed as assumptions. These are my
  proposals, chosen to size the design, not requirements.


     ID         Proposed target                                                      Used to decide

     T-1        Design envelope of up to 500 businesses,                             Single Postgres primary; no broker; no
                roughly 5,000 appointments per day                                   sharding.
                platform-wide and about 100,000 inbound
                provider events per day, with 10× headroom
                before any architectural change.

     T-2        Webhook acknowledgement p99 under 1                                  Process topology; HA database.
                second. Acknowledgement only after
                durable commit. Monthly ingress
                availability 99.5%, with provider retries
                covering short outages [verify S-7].

     T-3        Customer-visible latency: browse step p95                            Availability-search budget and
                under 4 seconds; booking result p95 under                            caching.
                8 seconds (Calendar-bound).

     T-4        RPO at most 5 minutes; RTO at most 2                                 Backup and DR design.
                hours for full restore and 15 minutes for
                automatic failover.

     T-5        At least 99% of eligible reminder                                    Scheduler polling cadence and
                occurrences submitted inside the [due,                               alerting.
                due+15 min) window; zero duplicate
                reminder submissions by construction.

     T-6        Uncertain operations resolved or escalated                           Reconciler cadence.
                to review within 15 minutes (settle window
                10 minutes).

     T-7        Retention (provisional): raw provider                                Archive and purge jobs.
                payload archive 30 days; all other classes
                pending legal input.




                                                                                                                        Page 8 of 11

<PARSED TEXT FOR PAGE: 9 / 11>

NukMiris v0.8.1 Greenfield Challenge — 1 of 5: Independent Requirements Assessment




  7. External-behaviour assumptions to verify before committing
  The design leans on provider behaviours I could not confirm from here. Each is a spike
  with an explicit fallback.


     ID         What must be true                                                    If false

     S-1        Google Calendar events.insert                                        Fall back to read-only proof plus
                accepts a client-supplied event ID; a                                operator resolution (see F-03).
                duplicate returns a conflict; a deleted
                event's ID stays unusable; a read right
                after a successful insert is consistent.

     S-2         If-Match / ETag preconditions on patch                              Replace with read-compare-write inside
                and delete return 412 on mismatch.                                   the operation lease and widen the post-
                                                                                     write audit.

     S-3         events.list supports private-                                       Fetch broader windows and filter locally.
                extended-property filtering together
                with updatedMin , showDeleted and
                fields .

     S-4         freebusy.query handles all-day,                                     Use events.list and compute busy
                tentative and declined events as the                                 time locally.
                baseline requires; per-calendar errors are
                reported distinctly; range and quota
                limits are known.

     S-5        Least-privilege OAuth scope that permits                             Accept a broader scope with
                create, patch, delete and free/busy;                                 documented justification.
                verification requirements; refresh-token
                lifetime in production; invalid_grant
                taxonomy; PKCE support.

     S-6        An opaque caller-supplied value on                                   Correlate by recipient, time window and
                outgoing messages is echoed in status                                provider message ID only; treat more
                notifications; no send-side idempotency                              outcomes as uncertain.
                key exists; error codes can be split into
                definite and uncertain classes.




                                                                                                                          Page 9 of 11

<PARSED TEXT FOR PAGE: 10 / 11>

NukMiris v0.8.1 Greenfield Challenge — 1 of 5: Independent Requirements Assessment




     ID         What must be true                                                    If false

     S-7        Webhook retry schedule and duration;                                 Poll template status; tighten durable-
                status identifiers; quoted-message                                   ingress alerting.
                context ID; template-status and quality
                notifications; signature over raw bytes.

     S-8        Utility template TTL ranges and the                                  Adjust reminder timing and reply expiry.
                practical rules of the 24-hour window for
                interactive messages.

     S-9        Phone identifier formats in target                                   Per-country normalization table.
                countries and the correct send-to format.

     S-         Postgres: exclusion constraint combining                             Use advisory locks plus a unique index
     10         range overlap with a not-equal key (via                              on discretized slots.
                 btree_gist ); row-level security with
                pooled connections; claim-query
                performance on the chosen managed
                service.

     S-11       Time-zone library behaviour for                                      Pin and test a different library.
                nonexistent and repeated local times;
                tzdata update path.

     S-         Managed-Postgres point-in-time restore                               Revise T-4 or change provider.
     12         granularity and restore duration meet T-4.




  8. Scope decisions I am making explicitly
       One durable mode. The baseline calls non-durable mode non-commercial and weaker.
       The greenfield system has no such mode, so there is no downgrade path to guard
       (O04).
       Tenant resolution only from the receiving channel. No test-only sender-to-business
       routing in the product code (D-class).
       No LLM in the control path. Date and intent recognition remain bounded,
       deterministic grammar, as specified.
       No dashboard, billing or self-service onboarding (E-class). Operator tooling is a CLI
       and private admin API.
       No migration of POC data or pre-v0.8.1 states.




                                                                                                                          Page 10 of 11

<PARSED TEXT FOR PAGE: 11 / 11>

NukMiris v0.8.1 Greenfield Challenge — 1 of 5: Independent Requirements Assessment




       "No extra confirmation" is respected. An acknowledgement that a request is being
       processed is not a confirmation question.



  9. Where this assessment may be wrong
       I have not seen the source. The baseline warns that some behaviours are source-only
       quirks. I may have missed a subtle decision encoded in tests.
       F-03 rests on one provider feature. If client-assigned event IDs do not behave as I
       expect, recovery gets more manual and the operator workload rises.
       F-04 and F-01 may be too restrictive. A pilot customer with two practitioners on one
       Calendar would break the capacity-1 assumption.
       My targets are guesses. T-1 through T-7 should be replaced by owner numbers when
       they exist.
       Some findings are risk disclosures, not defects. F-11 and F-13 describe commercial
       exposure the architecture can only partly mitigate.




                                                                                         Page 11 of 11