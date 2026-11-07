# PR16 C1–C5 — exact-source correction evidence

**Tested source:** `ba1729983f438f648c6fab2aff9b9fbf22941de0`; tree `c197eea0cf62678df90537e87e1c404e4926d5be`.
Source parent `7ba4e5c09b672b624587e58e15dbd124d1743881`; whole PR base0691111 (Draft PR15).
The evidence follow-up adds only this directory, Claude handoff18 and a results
addendum in the implementation-branch Feature Register. No executable code changes.

Authoritative **Feature Register v1.3**, Git commit
**d1399b90b9c0e3c56e5bdf0fe59f24d925a0d455**, blob **b26bca5af25ebd56d7c561cd325a0faed0bfa1ba**.
Original content/owner Tests1–26 are retained as a prefix; documentation branch
was neither changed nor merged. READY FOR TEST remains distinct from VERIFIED.

## Actual execution

Linux, **Node24.19.0/npm11.9.0/measured PostgreSQL17.11**, pinned image digest in
each environment JSON. One build at exact source, followed by direct Node harnesses
equivalent to npm scripts. Core and local-runtime pipelines overlapped in isolated
fixtures. O3 observations are not idle-host benchmarks or Windows SLOs.

| Suite | PASS | FAIL | SKIP | Evidence |
|---|---:|---:|---:|---|
| full | 554 | 0 | 0 | [full.log](full.log) |
| fault | 544 | 0 | 0 | [fault.log](fault.log) |
| concurrency | 415 | 0 | 0 | [concurrency.log](concurrency.log) |
| focused | 267 | 0 | 0 | [focused.log](focused.log) |
| runtime | 43 | 0 | 2 | [runtime.log](runtime.log) |
| browser | 1 | 0 | 0 | [browser.log](browser.log) |

Build/typecheck/scope pass. Suites overlap; do not sum them. Focused267 includes
65 new C1–C6 regression cases plus202 retained L2 cases. Runtime has45 total cases;
the two skips are actual native Windows ACL and metadata-sync checks. Corrected
native Windows execution is **NOT RUN** here. Owner baseline3d8f82b really passed
41/41 native tests; [that report](owner-native-baseline.json) is separate evidence,
not acceptance of this source. **Owner upgrade remains HOLD pending Claude approval.**

[Summary](summary.json) · [measured runtime/browser](measured-runtime.json) ·
[source provenance](source-provenance.json) · [source hashes](source-sha256.txt) ·
[artifact hashes](artifact-sha256.txt) · [Unicode property](unicode-property.json) ·
[O3 raw measurements](o3-full-run.json).

Only textual logs, measurements and hashes are copied. Generated fixtures, private
profiles, databases, archives, ledger files, backups, keys and URLs are not published.
Source hashes cover112 vNext source/config/test files plus4 unchanged legacy
parity references. Migration001–008 and roles remain byte-identical to the parent.

## Acceptance mapping

| Condition / feature IDs | Executed proof |
|---|---|
| C1 mandatory;009/032 |18 conversational no-customer/no-booking cases;8 valid names;8 expired-name explicit commands; helper validation; actual HTTP/browser; greeting/queue COMMIT cuts. No new confirmation click. |
| C2 mandatory;033/034 |Actual sealed P3b menu½/Menu¹ and other variants remain quiet and queued; retries keep original IDs; legacy receipt and burst/Menu/restart; unsupported route version holds. Migration009 backfill/rollback preserves Ana/history; old007 and008-only actual CLI upgrades. |
| C2 Unicode property |7392 unique candidates,14784 admissions,7003 queued on each of two independent paths,0 mismatches, Unicode17. All numeric code points plus selected marks/letters. Actual INSERT while HUMAN and separate deferred HUMAN_HANDOFF UPDATE; scoped bulk SQL fixture is not ingress-authentication proof. Separate actual P3b/API/browser tests cover ingress. |
| C3;005/031 |Past delivered appointments omitted for cita/horarios/menu after3days; delayed/expired unverified confirmation remains a historical positive fact; prior precise C3 crash schedules retained. |
| C4;001–013 relevant parity |Read-only differential against v0.8.1 appointmentOverview across0/1/2/90 appointments and3 zones; exact both-surnames-if-present re-prompt; useful explicit menu commands; no generic unknown-text escalation. |
| C5;037/043 |Own date-only labels round-trip180days; past matching weekdays; business date-line, implicit/explicit year, New Year mismatch, impossible-date/horizon and active-vs-idle checks. Time-bearing/monthless forms remain rejected. |
| C6 retained |Ana UNKNOWN, protections and ordering unchanged; original identity preserved across migration/crashes/restart. No inbox/notification/staff reply, per-customer authorization, manage or NLP escalation activation. |
| All retained safety |Full/fault/concurrency retain tenant/history/custody/fencing/uncertainty tests; actual TCP/UTC runtime and CLI with spaces/Unicode, bookings, crash/restart, coherent backup and inert restore; actual browser known/new booking, list, queue, calendar and isolation. |

[Correction contract](../../../docs/greenfield/27-PR16-CLAUDE-C1-C5-CORRECTIONS.md) ·
[register/statuses](../../../docs/greenfield/NUKMIRIS_FEATURE_REGISTER.md) ·
[Claude handoff18](../../../docs/greenfield/reviews/18-CLAUDE-PR16-C1-C5-REVERIFICATION.md).

## Reproduction

Fresh checkout at the exact tested source, from `vnext`:

```text
npm ci --ignore-scripts
npm run build
node scripts/run-tests.mjs
node scripts/run-tests.mjs fault
node scripts/run-tests.mjs concurrency
node scripts/run-tests.mjs l2
node --test --test-concurrency=1 local/platform.test.mjs local/command-lock.test.mjs local/runtime.test.mjs local/interactive.test.mjs
node local/browser-smoke.mjs
npm run typecheck
npm run check:scope
```

Core commands are the harnesses behind npm test/test:fault/test:concurrency/test:l2;
runtime is the harness behind test:runtime, after a single build. Actual browser
requires Chromium/Edge CDP. No native behavior is inferred from Linux checks.

After independent Claude acceptance, owner runs fresh-checkout Windows
`npm.cmd run test:runtime`, requiring45 total PASS with native ACL/sync executed
and zero failures/skips. Then follow doc26's original-state-path/instance-ID upgrade
instructions: exclusive command lock, stop writer, coherent verified private backup,
transactional008+009 or009, stay stopped. Start only the reviewed new checkout
against the SAME old state directory. **Never start old code against upgraded data.**
Never reset Ana, delete the original profile, activate an inert restore or upload
private state, credentials, keys, backups or profile URLs.

## Unresolved gates

C1/C2 corrections require new independent acceptance before owner upgrade. Native
corrected-source/browser acceptance and PR15's wider independent review remain
open. Ana remains held; no acknowledgment can bypass ordering. Staff inbox/reply,
protected reconciliation, management and overlap policy remain designed/gated or
owner-decision work. Natural-language escalation044 stays deferred.

Keep PR16 and other PRs Draft/unmerged. Full parity and Milestone A remain open.
Preserve record-chain AND index-extension custody, archive/repair009/011/017,
N2/N3/A2/A3,013/016,F13,W7/O5/O6,C5,D1,Windows/N6 and OPS01. W8/W9 protections
are unchanged. Legacy and owner profile were not modified; no real Meta/Google,
GCP, deployment or production activation.
