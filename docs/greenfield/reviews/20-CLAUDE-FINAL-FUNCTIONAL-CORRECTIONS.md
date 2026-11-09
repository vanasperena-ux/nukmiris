# Claude independent review — three final functional corrections

Review source **b4d0be0cb98c7f2b69be318e18b93f4de102c511**, tree
**03d08322e27d9d54485fa887b482743fe076556b**, parent
**53c40c79e165c2da62f1f8a7d4ad5fde2d4b855a**; correction increment base is
**bff61b883552c7e004722427bb1ab44b231759c9**. Whole PR16 base remains
069111187c06416f06f6fc95cffa25c2776850dd. Evidence follow-up adds only this
handoff, Windows guide30, evidence/pr16-final-functional and register results;
verify that split and source/artifact hashes. No independent approval is inferred.

Authoritative **Feature Register v1.4**, commit
**59cde023d2dff088161c1d01bd76c1099386e13f**, blob
**679a5b465b913843566fb59f1410b69cf9803bc1**; read completely, including the
approved appointment-summary table. [Immutable reference](../references/FEATURE_REGISTER_v1.4_59cde02.md).
The documentation branch was neither merged nor modified. Historical v1.3 and
older v1.4 addenda are not the current acceptance status.

[Owner6728974018](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6728974018)
accepted isolated Windows Test17C at7f35b2f, with two bookings, four verified
attempts, two protections and Customer4 zero effects after stale/replay/restart.
Retain that bounded NM-040/042 acceptance; no owner rerun requested. Real Meta
and production gates remain separate. Earlier native45/45 acceptance is not a
native run of this source. Your prior C2–C5/upgrade review and residual C1 corpus
are retained, not represented as new-source approval.

[Behavior, root causes, limits and preservation contract](../29-FINAL-FUNCTIONAL-CORRECTIONS.md)
· [Exact-source tests/environments/logs/hashes](../../../vnext/evidence/pr16-final-functional/README.md)
· [Short Windows acceptance](../30-FINAL-CORRECTIONS-WINDOWS.md).

## Changed files and reasons

| File | Reason |
|---|---|
|src/domain/customer-name.ts |Replace permissive letter+deny-list check with positive structure/casing or explicit name-intent clarification; reject intent components before identity allocation; normalize new name/preamble only |
|src/domain/classification.ts |Exact menu label `hablar con alguien` shares supported human-command routing and sealed application decision; no general NLP escalation |
|src/domain/appointment-summary.ts |Explicit ALL/LATEST/NONE policy by actual input type/result; preserve unspecified aliases and idle-menu fallback |
|src/application/interactive-booking.ts |Use trigger policy, all retrieval for direct cita/agendar, bounded Unicode batches, strip inherited precedingTexts on intermediate reconstruction |
|test/l2-final-corrections.test.ts |Actual application+SQL/worker corpus, names, commands, crashes/replays, summary matrix, support persistence and protected-row preservation |
|local/final-functional.test.mjs |Actual authenticated TCP boundary, two real existing bookings, no invalid-name allocations/effects, durable support restart and tenant controls |
|local/final-browser.mjs |Real Chromium interaction of these three corrections and ordinary UI, not an owner PASS claim |
|package.json |Focused test commands; include new HTTP regression in full runtime suite |
|docs/29, register, immutable reference |Explicit scope, decisions, historical/current owner evidence and remaining limits |

## 1. C1 root cause / proof boundary

Old code accepted almost any short letter-containing prose not in its finite
phrase list. The menu label `hablar con alguien` was not a recognized text human
command, so NAME_REQUIRED treated it as a name, allocated a customer and booked.

Inspect command-before-name/expiry ordering, new positive word/connector/initial
grammar, whole-component intent checks (including punctuation and NFKC compatibility
forms), controls/numbers/URL/emoji rejection and proper-name casing. Explicit
`Me llamo …`/`Mi nombre es …` clarifies name intent and strips the preamble.
A leading `Soy …` is stripped but does not relax casing: it can introduce a
status. Explicit regression `Soy cliente`/`SOY CLIENTE` rejects without effects;
`Soy Carlos Pérez` retains direct valid-name handling.
Lowercase ambiguous text stays at clarification, without identity/intent/attempt.
NFC/space normalization affects new names only; old identities are untouched.

**No new confirmation step.** Exact supported commands remain commands; unknown
requests are not automatically sent to humans. Genuine common Spanish names,
single names, accents, particles, initials, hyphens/apostrophes and explicit lowercase
names must still book directly after the selected-slot recheck. A bare ambiguous
calendar name requires clarification (e.g. Me llamo Julio). Empty/whitespace inputs
remain transport-invalid and cannot allocate an input/customer or block later work.

Retain and inspect **all68 Q1 non-name corpus cases** at actual app boundary,
not just the pure helper: zero customer, LOCAL_CUSTOMER/name seal, booking intent,
appointment, protection, operation, attempt or CORE effect. Check novel structural
failures, uppercase request words, original request replay, stale/superseded name
reply before/after navigation, expiration and three COMMIT cuts. Actual HTTP and
browser tests repeat the owner example and valid direct booking.

**Limits are material:** this is conservative syntax/intent validation, not proof
of a real-world name or a language oracle. A novel proper-name-shaped phrase can
still look like a genuine name. Some legitimate unusual casing/ambiguous names
need clarification; command-like names may stay ambiguous. Stronger universal
intent assurance via a new confirmation phase would change the approved journey
and needs owner approval before implementation. Assess whether this bounded policy
meets the approved conservative validation requirement; do not silently infer
universal semantic safety or promote C1 to VERIFIED from a finite corpus.

Trusted reducer/SQL-owner W7/O5 boundary remains: the SQL name function still has
its original constraints, not a duplicate language parser. No schema/role migration
is introduced. Old allocated seals/reductions/views keep their original identity;
incompatible partially allocated name matches must hold rather than reallocate,
rewrite existing records or guess a provider result.

## 2. Appointment-summary triggers / NM-045

Verify0/1/2/90 future appointments for TEXT menu/hola/cita/agendar. Direct cita and
agendar must have identical text/overview and offered labels, with fresh displayed
IDs; all rows stable chronological and tenant/customer scoped. Compare the actual
ACTION menu-book path: no second overview, even though its visible label describes
booking. More/date/time/invalid date/stale/conflict/management/confirmation responses
must not prepend existing bookings. Inherited precedingTexts is stripped;90-row
overviews remain complete, split safely within existing WhatsApp frame bounds.

Human command AND real menu action entry show guidance only; no future or historical
appointment prefix. Subsequent ordinary inputs stay silent and queued across app
restart. Menu exits and restores all appointments and three options. No inbox.
Aliases reservar/horarios intentionally keep prior availability/latest-only
display; unknown idle-menu fallback retains its prior overview. They were not
silently assigned a new owner display policy.

Retain late/applied/expired-confirmation C3 visibility on overview entry points,
historical factual wording, and entered/UNKNOWN ordering holds. Do not rewrite
old sealed or delivered chat frames. Confirmation of a newly booked appointment
must describe only that booking. Real per-frame Meta partial-send custody remains
gate016; the existing atomic fake batch is not production proof.

## 3. Regression / data preservation

No migrations/roles, archive/index/witness, dispatcher/fencing, availability,
reservation/buffer/resource logic, runtime ports/locks/backups or legacy changes.
Tests compare existing protected UNKNOWN records and compatible literal invalid-
name customer/appointment rows before/after new app work; no cleanup or customer
rename. The latter is a seeded synthetic compatibility record, not private owner
DB inspection. Actual runtime/backup/restore suites and automated capacity safety
regression retain broader evidence. Do not ask owner to repeat accepted Test17C.

Existing SQL already rejects overlapping protected appointments for the SAME
customer; fixture preparation therefore books non-overlapping slots. No NM-038
policy change is made. Owner's npm path-forwarding issue remains open; new guide
uses direct Node commands without silently changing CLI behavior.

## Codex execution at this exact source (not independent acceptance)

Linux Node24.19.0/npm11.9.0/measured PostgreSQL17.11: **667 full /657 fault /
528 concurrency /380 L2 /44 runtime /4 automated capacity /1 existing browser /
1 focused final-browser PASS;0 failures**. Runtime2 native-only skips; other
suites0 skips. Build/typecheck/scope pass; suites overlap. New core113 cases include
68 individual Claude-corpus actual-app negatives. Baseline bff61b8 was clean,
124 source hashes matched and267/267 L2 passed before modifications. New-source
native Windows NOT RUN; owner Test17C acceptance remains separate and preserved.

## Reproduce and report independently

Fresh exact-source checkout, Node24/measured pinned PG17.11, in vnext:

```text
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm test
npm run test:fault
npm run test:concurrency
npm run test:l2
npm run test:runtime
npm run test:capacity
npm run test:browser
npm run test:final-browser
```

Focused TCP command is test:final-functional; browser accepts Chromium/Edge path.
Full runtime now46 cases; Linux skips2 native Windows ACL/sync cases explicitly.
Report exact independent source, environment, commands/results and conditions.
Codex's Node24/PG17/Linux results do not establish new native Windows or Claude
acceptance. Short owner walkthrough covers only these corrections in a NEW profile.

Keep PR16 Draft/unmerged, original owner data/Ana/accidental booking untouched.
Preserve custody/chain+index/archive/repair/uncertainty/provider/OPS01 gates and all
separate review limits. No Services, admin configuration, onboarding/commercial
scope, real Meta/Google, GCP, deployment or old-checkout activation. Do not close
Milestone A solely from these corrections; owner decides remaining local criteria.
