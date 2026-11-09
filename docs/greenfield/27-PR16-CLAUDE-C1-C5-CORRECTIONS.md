# PR16 — independent review conditions C1–C5

Scope: owner request following [Claude review6700088878](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6700088878)
and [reproducible probes6700089096](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6700089096).
Review source6fa5c18; starting evidence head7ba4e5c. Authoritative Feature Register
**v1.3**, commit **d1399b90b9c0e3c56e5bdf0fe59f24d925a0d455**, blob b26bca5a.
The documentation branch remains unchanged; branch-only register statuses follow.

Claude independently reproduced real baseline3d8f82b→008 preservation, rollback,
Ana's unchanged UNKNOWN and old pending offer/name/human-message compatibility.
His environment was Node22.23.4/PG16.15, without Docker/Windows/Chromium or usable
TypeScript types; it does not independently establish Node24/PG17.11 or Windows
acceptance. His PR15 review coverage was limited to the PR16 changes. Those limits
remain explicit. **The owner now requires C1/C2 correction and Claude acceptance of
the revised source before upgrading the Windows profile.** No upgrade is performed
on that profile during this correction increment.

| Condition / IDs | Correction | Acceptance proof |
|---|---|---|
|C1 mandatory;009/032 |hola→MENU, horarios→offers, explicit commands before expired-name/name capture; bounded greeting/thanks/control-prefix rejection; valid names still book directly |No customer/name seal/appointment/intent/attempt/guard/protection for conversational inputs; valid accent/single-name/hyphen/apostrophe cases; expired commands, COMMIT cuts, HTTP and browser |
|C2 mandatory;033/034 |One application routing decision in new sealed admissions; SQL consumes it without text normalization; completed HUMAN_HANDOFF always queues; legacy identity/custody retained;009 appends missing refs |Reported P3b, Unicode property over7392 candidates, original-ID retries, legacy receipt, burst/Menu/restart, unsupported route hold,009 backfill/rollback and both007/008 upgrade paths |
|C3;005/031 |Same upcoming/undelivered-confirmation predicate on all replies; ordinary past delivered appointments omitted; positive late-applied past facts labeled historical |cita/horarios/menu after3days; past delayed confirmation remains visible and does not say current/upcoming; existing exact C3 crash schedules retained |
|C4;001–013 relevant parity |Approved0/1/many appointment overview with start/end/timezone; both-surnames-if-you-have-them re-prompt; useful command instructions |Pure unchanged v0.8.1 overview differential across0/1/2/90 and3 zones; message limits retained; no generic-text human escalation or misleading functioning manage instructions |
|C5;037/043 |Accept date-only short labels (`mié 11 nov`), abbreviations/accents; explain clearly past matching weekday/date |All emitted date labels round-trip180days, business date-line/New Year/mismatch/impossible/horizon checks and active-vs-idle flow |

## Implementation boundaries

C1 uses a small deterministic phrase set and known greeting/thanks/control prefixes
only while collecting a name. It does not infer whether arbitrary prose is a name
and does not route unknown text to human support. Existing valid names remain
accepted without requiring two words/surnames; Unicode numeric/control characters
are not valid name characters. No extra booking confirmation step is introduced.
Old customer names, bookings and sealed work are never rewritten retroactively.

C2 freezes routing `{version:1,outcome}` in allocated LOCAL_INPUT metadata, leaving
stable-key intent unchanged. Actual processing and routing share the application
normalizer. SQL uses the registered seal's routing on INSERT; on UPDATE the durable
application HUMAN_HANDOFF result itself decides queueing. SQL has no second text
normalizer. Unknown routing versions fail closed under the original identity.
Legacy allocated receipts without this metadata remain byte-identical; if still
being admitted in support, their references are preserved conservatively. Any
navigation control semantics remain available in input_reduction. Future inbox
work must interpret those controls, not treat every legacy queue reference as a
staff notification. No queue records are deleted to repair the omission.

Migration009 replaces only the local support trigger and appends missing refs from
existing HUMAN_HANDOFF results. Migrations001–008 and roles remain byte-identical.
Upgrade handles007→008+009 or008→009 in one transaction after stopped-writer,
coherent verified backup; alreadyCurrent requires both support and routing schema.
The new app refuses an incomplete schema. Original archive, input IDs, appointment
history, attempts, protections and ledger remain untouched. Tests use disposable
fixtures only; the Unicode property bulk fixture grants its synthetic postgres
session tenant scope locally and tests actual triggers, not the production ingress
signature/receipt authentication path. Separate P3b/API tests cover real sealed
admissions and quiet application processing.

C3/C4 split upcoming summaries from historical positive booking facts. A historical
ACTIVE booking whose confirmation has no verified delivery remains visible as
`Cita registrada … La entrega de su confirmación no está verificada.` It is never
called current/upcoming, nor is unknown booking failure guessed. Existing sealed
outbound work retains its original identity/payload and normal expiry/ordering;
past messages in chat history are not edited.

C5's implicit-year weekday/calendar grammar reports PAST when the matching
current-year past occurrence is closer than the next valid future occurrence.
Near New Year the imminent future occurrence wins, followed by weekday validation
(e.g. `jueves 1 de enero` on31Dec still mismatches the coming Friday). Explicit years and
the existing365-day horizon/short-date grammar remain enforced. Date-only labels
are accepted; time-bearing labels, monthless weekday+day and `a las 10` are not
silently turned into time selections. Booking still requires the displayed action.

## C6 retained — designs, not newly activated features

- Ana's booking UNKNOWN and guarded conversation stay held. Menu/humano cannot
  bypass ordering; no extra acknowledgement, clearing, new identity or blind retry.
- No staff inbox, notification or reply. Support messages persist in the scoped
  queue; that is not delivery to authorized people (NM-034 design).
- The loopback cookie authenticates the synthetic owner viewer, with business
  session selection. Details are business-scoped, not per-customer authorization;
  production needs staff authorization (O5/NM-034/035).
- Unsupported local message types still return400; real-channel handling is gate016.
- **After an eventual upgrade, never start demo:book from the old checkout against
  the upgraded profile.** Old code lacks the new version gate and would revive old
  behavior. Only the exact reviewed new checkout may use the original state path.
- NM-038 overlap/duplicates need owner policy;006/007/010 management and030/039
  uncertainty/recovery remain designs/gated;044 natural escalation remains deferred.

## Review, owner retest and gates

Wait for Claude's focused independent acceptance of the new exact source first.
Then, on Windows, use a fresh checkout, npm.cmd ci --ignore-scripts, typecheck,
check:scope and test:runtime with native ACL/sync executed and no failures/skips.
Follow doc26's explicit original-state-path/original-instance-id upgrade procedure;
it makes/verifies a private coherent backup and stays stopped. Start only the new
checkout with demo:book pointing at that SAME state directory. Never reset Ana,
delete the original state, activate an inert restore or upload keys/backups/URLs.

Owner acceptance should repeat C1 examples at NAME_REQUIRED, C2 fractions/superscripts
in human mode plus Menu escape, future/past/delayed summaries, full re-prompt/menu
copy, short date labels and past weekday errors, then retained known/new booking,
capacity/stale IDs, restart, isolation and Ana's unchanged case. Code/test evidence,
independent review and native acceptance are separate; no VERIFIED/Milestone A
closure is inferred. Keep PR16 Draft/unmerged. All legacy, custody/witness/repair,
provider/uncertainty/OPS01 and cloud restrictions remain. No real Meta/Google or GCP.
