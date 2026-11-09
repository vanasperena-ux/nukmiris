# Three final functional corrections — exact-source evidence

**Tested source:** `b4d0be0cb98c7f2b69be318e18b93f4de102c511`; tree `03d08322e27d9d54485fa887b482743fe076556b`; parent `53c40c79e165c2da62f1f8a7d4ad5fde2d4b855a`.
Correction increment base `bff61b883552c7e004722427bb1ab44b231759c9`. Subsequent evidence-only commit adds this
folder, review handoff20, Windows guide30 and register results; executable code
unchanged. [Source contract](../../../docs/greenfield/29-FINAL-FUNCTIONAL-CORRECTIONS.md).

Authoritative **Feature Register v1.4**, commit **59cde023d2dff088161c1d01bd76c1099386e13f**,
blob **679a5b465b913843566fb59f1410b69cf9803bc1**, read completely. Immutable reference at its recorded
path; documentation branch untouched/unmerged. Earlier register prefix retained
as history; current addendum records accepted owner Test17C and new READY FOR TEST.

## Actual execution

Linux **Node24.19.0/npm11.9.0/measured pinned PostgreSQL17.11**. One exact-source
build then direct Node harnesses equivalent to npm scripts. Independent clusters/
local fixtures allow overlapping pipelines. Timing/O3 is not an idle-host benchmark
or Windows SLO. No code changes after the tested pin.

| Suite | PASS | FAIL | SKIP | Evidence |
|---|---:|---:|---:|---|
|full|667|0|0|[full.log](full.log)|
|fault|657|0|0|[fault.log](fault.log)|
|concurrency|528|0|0|[concurrency.log](concurrency.log)|
|focused|380|0|0|[focused.log](focused.log)|
|runtime|44|0|2|[runtime.log](runtime.log)|
|capacity|4|0|0|[capacity.log](capacity.log)|
|browser|1|0|0|[browser.log](browser.log)|
|final-browser|1|0|0|[final-browser.log](final-browser.log)|

Build/typecheck/scope pass. Suites overlap; do not sum them. Runtime now46 cases:
44 Linux PASS,2 native Windows ACL/metadata-sync SKIP. Corrected-source native
Windows NOT RUN by Codex. Independent Claude and focused owner acceptance pending.
113 new core cases include68 individual Claude-corpus inputs through actual app/
SQL/worker; do not mistake the pure name helper alone for booking-safety proof.

Before modifications: clean bff61b8,124 baseline source hashes,build and267/267 L2
PASS. [Baseline facts](baseline.json)/[log](baseline-l2.log) and measured baseline
environment are retained separately. Exact source is established by Git and
[127 source hashes](source-sha256.txt), not by relabeling older runs.

[Summary](summary.json) · [measured runtime/browser](measured-runtime.json)
· [provenance](source-provenance.json) · [artifact hashes](artifact-sha256.txt)
· [O3 raw measurements](o3-full-run.json) · [owner Test17C](owner-capacity-acceptance.json).
The unchanged capacity script emits `ownerBrowserAcceptance: PENDING` for its
own automated run. It cannot grant owner acceptance; that raw self-label does
not revoke the separately recorded owner Test17C PASS at source7f35b2f.
Only textual logs, measurements and hashes are copied. No databases, archive/ledger
files, private state.json, keys, backups or private URLs are published.

## Acceptance mapping

| Correction / requirement | Automated proof |
|---|---|
|C1 owner hablar con alguien |Exact supported label enters human mode before NAME_REQUIRED parsing; no customer/name seal, intent, appointment, attempt, protection or CORE effect |
|C1 underlying validation |Positive letter/component/connector/initial grammar; proper casing or explicit Me llamo/Mi nombre es clarification; intent tokens anywhere including punctuation/NFKC; novel malformed and non-name prose rejected. Soy cliente/SOY CLIENTE reject; Soy Carlos Pérez stays valid. |
|C1 genuine names |Single/multiple Spanish names, accents/NFC, Unicode spaces, particles, initials, apostrophes/hyphens and explicit lowercase names book directly; preamble removed only for newly created names |
|C1 state/identity |Commands, repeated invalid, empty/schema rejection, stale/superseded/expired name responses, original request replay and COMMIT cuts; rejected names have0 customer/name/booking allocation/effect; later valid clarification progresses |
|Summary59cde |0/1/2/90 scoped future appointments on menu/hola/direct cita/agendar; both direct commands identical; complete Unicode-bounded ordered batches, no silent dropped appointments |
|No repeated overview |Actual menu action UUID→booking; more/date/list/times, typed valid/invalid date, stale/unavailable recovery, management and successful confirmation; old precedingTexts stripped from intermediate reconstruction |
|NM-045 |Command/menu-action entry has guidance only for0/1/2/90; quiet durable support across app restart; Menu exit restores all appointments/three actions |
|Uncertainty/data |Precise previous C3 late/applied/expired visibility tests retained; UNKNOWN/entered holds; byte-identical protected and compatible literal-invalid-name rows. Original owner data not inspected or changed. |
|Actual boundaries |Authenticated TCP regression with2 real non-overlapping bookings, SQL zero effects on bad names, support restart, stable IDs/tenant controls; real Chromium drives these same three corrections |
|Accepted safety |Full/fault/concurrency retain buffers, resources, single-service P0, capacity, archive/custody/fencing/history/roles, restart/inert restore and date parsing. Automated capacity4 tests pass; owner17C acceptance is preserved. |

**Policy limits:** conservative syntax is not a real-world name/semantic oracle.
Unusual casing or ambiguous genuine names may require explicit clarification.
An arbitrary proper-name-shaped phrase can still resemble a name. A new always-
confirm-name phase would change the approved journey and needs owner approval;
none is added. The trusted reducer/SQL-owner boundary remains; SQL is not given a
second language parser. Existing customer/appointment data and allocated identities
are not retroactively rewritten; incompatible partial custody holds rather than
reallocating. C1 is READY FOR TEST, not automatically VERIFIED.

Aliases reservar/horarios retain previous routing/latest-only prefix. Unknown idle
menu fallback remains; no generic NLP escalation. Existing SQL customer_overlap
constraint is unchanged; test setup uses non-overlapping appointments. NM-038
policy remains separate. Historical delayed confirmation facts remain available
on overview entry points; human entry/booking continuation contain no overview.

## Reproduction

Fresh exact-source checkout, in vnext:

```text
npm ci --ignore-scripts
npm run build
node scripts/run-tests.mjs
node scripts/run-tests.mjs fault
node scripts/run-tests.mjs concurrency
node scripts/run-tests.mjs l2
node --test --test-concurrency=1 local/platform.test.mjs local/command-lock.test.mjs local/runtime.test.mjs local/interactive.test.mjs local/final-functional.test.mjs
node --test --test-concurrency=1 local/capacity.test.mjs
node local/browser-smoke.mjs
node local/final-browser.mjs
npm run typecheck
npm run check:scope
```

Browser requires Chromium/Edge (executable can be passed as first argument).
Focused TCP command: npm run test:final-functional. Every fixture is separately
generated; no default .local-demo or owner capacity profile is used.
[Independent Claude handoff20](../../../docs/greenfield/reviews/20-CLAUDE-FINAL-FUNCTIONAL-CORRECTIONS.md)
· [short Windows walkthrough30](../../../docs/greenfield/30-FINAL-CORRECTIONS-WINDOWS.md).

## Remaining acceptance / scope

Claude independent review and new-source Windows focused acceptance remain open.
Owner Test17C at7f35b2f is accepted; **no owner capacity rerun requested**. Windows
npm path-forwarding issue remains separate; direct Node CLI is the documented
workaround. No migration/reset/repair of Ana UNKNOWN, accidental booking or other
owner data. C1 syntax/clarification trade-off needs independent/owner assessment.
Move/cancel, inbox/recovery and other separately tracked local parity work are not
implemented by these corrections; owner decides final Milestone A criteria.

Keep PR16 Draft/unmerged. Preserve all production custody/record-chain AND index-
extension/archive/repair/uncertainty/provider/OPS01 gates. Real per-frame Meta
partial-send custody is not inferred from local atomic fake batches. No Services,
owner configuration, onboarding/commercial work, real Meta/Google, GCP, deployment,
old-checkout activation or production activation. Passing this package alone does
not close Milestone A.
