# Claude focused re-verification — PR16 C1–C5

Review exact source **ba1729983f438f648c6fab2aff9b9fbf22941de0**, tree
**c197eea0cf62678df90537e87e1c404e4926d5be**; parent
**7ba4e5c09b672b624587e58e15dbd124d1743881**. Whole PR increment base is
069111187c06416f06f6fc95cffa25c2776850dd (Draft PR15). The evidence follow-up
changes only this handoff, `vnext/evidence/pr16-c1-c5/` and a results addendum in
the implementation-branch register; verify that split and source hashes before
treating its branch head as the same executable code.

Authoritative **Feature Register v1.3**, Git commit
**d1399b90b9c0e3c56e5bdf0fe59f24d925a0d455**, blob
**b26bca5af25ebd56d7c561cd325a0faed0bfa1ba**. Its complete original content,
implementation decisions and owner Tests1–26 remain the reference. The register
on this implementation branch appends READY FOR TEST statuses; no feature is
promoted to independently VERIFIED. Documentation branch remains unchanged.

Previous independent [review6700088878](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6700088878)
and [probes6700089096](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6700089096)
reviewed source6fa5c18/evidence7ba4e5c. Its real baseline3d8f82b→008 preservation,
rollback and Ana UNKNOWN proofs remain valuable. Its executed environment was
Node22.23.4/PG16.15, without Docker/Windows/Chromium; that is not independent
Node24/PG17.11/native acceptance. PR15 review coverage was limited to touched code.

[Corrections and boundaries](../27-PR16-CLAUDE-C1-C5-CORRECTIONS.md) ·
[exact-source results, environments, logs and hashes](../../../vnext/evidence/pr16-c1-c5/README.md).

## Required checks

1. **C1 mandatory; NM-009/032:** At NAME_REQUIRED send hola, Hola!, horarios,
   gracias and the other finite conversational cases. Check menu/offer/explicit
   command routing or a name re-prompt, with no customer/name allocation, booking
   intent, reservation, protection or provider attempt. Commands must precede
   expired-name handling. Valid names (including Ana, Sol, accents, apostrophes,
   hyphens and Graciela Gracias) retain direct booking without a new confirmation.
   Inspect the deliberately bounded phrase/prefix validator; it is not general
   natural-language name inference or deferred NM-044 escalation. Repeat COMMIT
   cuts and actual HTTP/browser scenarios, not only the pure helper tests.
2. **C2 mandatory; NM-033/034:** Compare application routing with queue admission
   for menu ½, Menu¹ and Unicode corpus. New LOCAL_INPUT allocation freezes the
   same application decision in authenticated seal metadata; stable-key intent
   is unchanged. SQL INSERT consumes that registered decision without its own
   text normalizer; durable HUMAN_HANDOFF UPDATE queues unconditionally. Unsupported
   versions fail closed. Legacy receipts keep original input IDs/bytes and use
   conservative support admission; navigation remains in the reduction. Check
   retry/restart/Menu/burst schedules and append-only queue behavior.
3. **C2 migration009:** Review replacement trigger, scoped append-only backfill,
   ownership and rollback. Existing migrations001–008 and roles are byte-identical.
   Actual upgrade supports007→008+009 and008→009, takes/verifies a coherent backup
   under exclusive CLI ownership, runs transactionally and stays stopped. Verify
   incomplete schema rejection, idempotence, preserved core/history/UNKNOWN/
   protections and inert restore. No existing seals, attempts, archive or queue
   references are rewritten/deleted. Trusted SQL owner can still disable triggers;
   independent production custody is not supplied by this trigger.
4. **C3; NM-005/031:** Ordinary replies omit past delivered appointments. Every
   query uses the upcoming-or-undelivered-confirmation predicate. Past positive
   bookings with unverified/expired confirmation stay visible as historical
   registered facts, never “current” or “upcoming.” Retain earlier late-confirmation
   crash tests and ordering; do not rewrite old sealed replies or chat history.
5. **C4; relevant NM-001–013:** Differentially compare unchanged v0.8.1
   appointmentOverview for0/1/2/90 appointments in3 zones, including start/end.
   Re-prompt includes “incluyendo ambos apellidos si los tienes”; menu has useful
   explicit commands and accurately describes unavailable manage actions. Unknown
   text is not offered as automatic staff escalation. Existing WhatsApp limits,
   ordered summary batching and the approved customer journey must remain intact.
6. **C5; NM-037/043:** Bot-generated date-only short labels round-trip180days.
   Matching current-year past weekday/date gets PAST when closer than the next
   valid future occurrence. Inspect explicit-year, year-boundary, mismatch,
   impossible-date, horizon and active/idle tests. Near New Year the imminent
   future occurrence still wins before weekday checking. Monthless/time-bearing
   forms remain unsupported; typing a date never consumes a booking action.

The Unicode property exercises **7392 unique candidates /14784 admissions** in
two independent conversations/paths: INSERT while HUMAN, and INSERT outside HUMAN
followed by authoritative HUMAN_HANDOFF UPDATE. It checks actual SQL triggers,
including all Unicode numeric code points in Unicode17 plus selected letter and
combining variants. Its bulk fixture uses explicitly scoped synthetic SQL rows;
it does not prove ingress authentication by itself. Separate real P3b, legacy
receipt, HTTP and browser tests exercise sealed admissions and quiet processing.
Please inspect both, and do not substitute a same-row INSERT+UPDATE property that
could hide a broken UPDATE path behind an existing queue entry.

## Reproduce and report limits

From a fresh exact-source checkout, in `vnext`:

```text
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:fault
npm run test:concurrency
npm run test:l2
npm run test:runtime
npm run test:browser
```

Use Node24 and measured pinned PostgreSQL17.11; browser requires Chromium/Edge.
Report the exact source, independent environment, commands executed, conditions
and limits. Codex evidence uses Linux; two native-only checks are skipped there.
Owner baseline3d8f82b passed41/41 on real Windows with ACL/sync executed; that does
not accept this corrected source. Do not infer new acceptance from reported tests.

## C6 and owner upgrade HOLD

**Owner Windows upgrade is held until Claude accepts this revised exact source.**
Then use a fresh reviewed checkout, native `npm.cmd run test:runtime` with actual
ACL/sync and zero failures/skips, followed by doc26's original-state-directory/
original-instance-ID upgrade procedure. Upgrade verifies a private coherent backup
and remains stopped. Never reset/delete Ana's profile, activate an inert restore,
or publish private URLs, databases, keys or backups. **Never start the old checkout
against an upgraded profile**: old code lacks the new schema gate.

Ana's UNKNOWN still blocks Menu/humano without a new acknowledgment or identity.
No staff inbox, notification or reply is shipped. Loopback owner-cookie details
are business-scoped, not per-customer staff authorization. Unsupported local
payload types remain400; live channel handling stays gate016. NM-030/039 recovery,
034 inbox and006/007/010 management remain designs/gated;038 overlap policy needs
owner choice;044 remains deferred. Preserve record-chain AND index-extension
custody, repair/archive, uncertainty, provider and OPS01 gates. PR16 stays Draft,
unmerged; Milestone A/full parity remain open. No v0.8.1/profile changes, real
Meta/Google, GCP, deployment or production activation.
