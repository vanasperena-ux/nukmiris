# Milestone A — three final functional corrections

Only C1, approved summary triggers and NM-045 are in scope. Baseline branch
`implementation/wp2-l2-functional-corrections`, Draft PR16, clean commit
**bff61b883552c7e004722427bb1ab44b231759c9**. Node24.19.0/npm11.9.0; baseline
build and **267/267 L2** independently rerun before modifications; the existing
124-file source manifest matched the preceding capacity source7f35b2f.

Current authoritative **Feature Register v1.4**, commit
**59cde023d2dff088161c1d01bd76c1099386e13f**, blob
**679a5b465b913843566fb59f1410b69cf9803bc1**, SHA256
`5a3d29093dc6b2b393656eaa4b708f8a64c3087c7c6b68b9df651d1b8443fdae`.
[Complete immutable reference](references/FEATURE_REGISTER_v1.4_59cde02.md), read
including the approved trigger table, owner Steps8/9/12B and Test17C. Version
remains1.4 although its commit advanced; exact commit resolves that ambiguity.
The documentation branch is read only, neither merged nor modified. The original
v1.3 prefix/older addenda in the implementation register remain historical.

[Owner Test17C6728974018](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6728974018)
is accepted Windows evidence at7f35b2f, not pending: real saved offer, two qualified
employee bookings, rejected stale/replayed selection before/after restart, nine
true read-only checks and Customer4 zero effects. Preserve that bounded acceptance.
No owner capacity rerun is requested; automated regression remains separate.

## C1 root cause and correction

Previously any short text containing a letter could become a customer name unless
it matched a finite phrase list/prefix. `hablar con alguien` missed command routing,
passed that validator, allocated a LOCAL_CUSTOMER identity and entered booking.

The new path routes exact supported commands first. `hablar con alguien` is an
explicit text equivalent of the existing menu action, with the same application
normalizer, sealed routing decision and ordinary priority reduction. Unknown
natural-language requests still do not automatically activate NM-044 escalation.

The name validator positively requires a bounded name structure:3–120 characters,
at most12 words, complete letter components, supported apostrophes/hyphens/initials
and interior Spanish connectors. It rejects controls, format characters, numbers,
emoji, URLs/email/sentence punctuation, malformed/repeated components and bare
connectors/initials before allocation. Intent/request/question/time tokens are
checked anywhere, including punctuation-separated components and compatibility
characters. Unprefixed names require initial capitals (all capitals work too);
particles may remain lowercase. Ambiguous lowercase prose gets clarification.

`Me llamo …`, `Soy …` and `Mi nombre es …` explicitly clarify name intent and are
removed before storing the NFC name; lowercase genuine names remain available
through that path. Ordinary names such as Ana/Sol/Luz, María Fernández, José Ángel
de la Cruz, Graciela Gracias, Valentina Hola, Vale Gómez, Mar Pérez, Julio César,
Ma. del Carmen and apostrophes/hyphens remain supported. A bare calendar-like name
such as Julio asks for clarification; `Soy Julio` resolves it. Ambiguous command-
like names (e.g. Cita Rodríguez) are clarified, not booked. Existing identities,
including literal invalid names, are never normalized/renamed retroactively.

The approved legacy re-prompt sentence is retained, followed by a short explicit
capitalization/self-identification tip. Empty/whitespace messages remain rejected
at the strict transport boundary, leaving NAME_REQUIRED intact; the existing UI
asks the customer to enter a message. Do not weaken ingress schemas to admit them.

**No extra confirmation phase/click.** Known customers still book on selection;
new customers still select a slot, provide a valid/clarified name, then book after
availability revalidation. Rejected names allocate no customer/name seal, booking
intent, appointment, protection, attempt or CORE provider effect. The existing
SQL head/revision/expiry guards, original request IDs and immutable cached work
remain authoritative. Invalid-name replies terminate normally and do not block
later correction/navigation. Valid-name retries preserve their original identity.

**Trade-off:** clarification can reject unusual casing, initials-only inputs or
ambiguous genuine names until clarified. This is syntax/intent validation, not a
registry or proof of a person's real-world name. A novel title-cased phrase can
still resemble a legitimate name; no finite local parser can prove otherwise.
Explicit confirmation after every proposed name would add stronger customer
intent evidence, but changes the approved direct-booking flow and requires owner
approval before implementation. It is not silently added or claimed unnecessary
for every possible semantic ambiguity. Independent review must assess this
bounded conservative policy and its false-positive/false-negative trade-off.

## Summary trigger contract

| Input / trusted result | Overview |
|---|---|
|Direct TEXT menu/hola |All scoped upcoming appointments, then main menu |
|Direct TEXT cita/agendar |All scoped upcoming appointments, then identical availability flow |
|Validated ACTION menu-book, more/times/date/list/slot/manage/human |No repeated overview |
|Typed valid/invalid date or name; stale/expired/unavailable option |No repeated overview |
|Human-support entry and silent human messages |No appointment information |
|Successful booking |Only the newly confirmed appointment |
|Existing reservar/horarios aliases |Keep availability routing and prior latest-only prefix; no new display policy inferred |
|Existing unrecognized-text idle-menu fallback |Existing greeting/menu/all overview retained; no new NLP escalation |
|Explicit cancelar/reagendar |Honest unavailable management response, no redundant overview |

The decision uses TEXT vs ACTION plus the trusted resulting view; action UUIDs
still resolve in SQL under conversation/revision/expiry checks and the oracle's
registered action metadata. It never treats the surface label as a booking command.
MENU view type alone is insufficient because management also returns MENU.

All overview entry points use stable chronological ALL retrieval (customer and
tenant scoped), rather than the previous non-menu LIMIT1. Ordinary past delivered
appointments remain excluded. Existing historical positive bookings whose
confirmation is unverified retain their separate factual wording on overview
entry points, never a guessed confirmation. Human entry/intermediate messages
do not expose them; their authoritative rows/visibility remain intact for Menu/
cita/agendar/calendar. Entered/UNKNOWN still hold before any unsafe reply.

Long overviews use the existing ordered local batch: every appointment retained,
preceding text frames bounded at4000 Unicode code points, interactive body≤1024,
and existing WhatsApp button/list constraints unchanged. No silent truncation.
Invalid-date/name reconstruction strips old delivery-only precedingTexts so a
saved long overview is not repeated. Existing sealed/delivered replies retain
their original identities/payloads; no chat history is rewritten. Real per-frame
partial-send custody remains gate016; local fake batch is not production proof.

## NM-045 and preservation

Command and menu-action human entry contain only guidance. Subsequent support
texts/commands remain silent/durable; queue records survive process restart.
Menu exits and restores all upcoming appointments plus the three choices. No
owner inbox/notification/reply platform is added.

No SQL migration, role/schema change, archive/dispatcher change or data cleanup.
New tests use independent synthetic fixtures only. They compare Ana's UNKNOWN/
attempt/operation/protections and a seeded compatible literal-invalid-name ACTIVE
appointment/customer byte-for-byte, with no extra CORE effect. They do not inspect
the owner's actual database or claim to reconstruct its private state.

Existing SQL already rejects overlapping protected ranges for the SAME customer
(`customer_overlap`). Non-overlapping appointments are used to prepare summary
tests. This pre-existing constraint is not changed or a new NM-038 policy decision;
that policy/acceptance item remains separately open.

## Evidence and remaining gates

New tests cover Claude's68 non-name corpus at the actual SQL/worker boundary;
genuine names/normalization/preamble clarification; commands, repeated invalid,
empty/schema rejection, stale/superseded/expired name replies and original-ID
replay; COMMIT crashes;0/1/2/90 histories; all trigger transitions, support restart,
tenant isolation, actual authenticated TCP and Chromium browser interaction.
Exact tested source/results, baseline logs and source/artifact hashes accompany
the evidence follow-up and independent Claude handoff20.

Native corrected-source Windows and Claude review remain pending; do not infer
acceptance from Linux. Do not repeat owner Test17C unless review finds a change
that invalidates its accepted scope. The prior Windows npm path-with-spaces
forwarding concern remains open; the short owner guide uses direct Node CLI,
not a new runtime correction. Keep original .local-demo, Ana UNKNOWN, accidental
appointment and acceptance data untouched. No reset, repair, silent migration,
merge, old-checkout activation, real Meta/Google, GCP or production activation.
Preserve custody/chain+index/archive/repair/uncertainty/provider/OPS01 gates.
Services/configuration/onboarding/commercial backlog are excluded. Passing these
corrections alone does not close Milestone A; independent review, focused owner
acceptance and any remaining owner-defined local parity criteria stay explicit.
