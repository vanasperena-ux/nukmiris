# Claude independent review — L2 functional corrections (Draft PR16)

Review exact source **6fa5c1800860290c051b23a5e3871e67f43c796d**, tree
**f6e940689741dc4a720f6284f7c6942aaf8aab89**, source parent8fddd31; increment base0691111 (Draft PR15).
Authoritative **Feature Register v1.3**, commit
**d1399b90b9c0e3c56e5bdf0fe59f24d925a0d455**, blob
**b26bca5af25ebd56d7c561cd325a0faed0bfa1ba**. Read the whole register, its
Tests1–26 owner evidence and BUILD/DESIGN/VERIFY/DEFER section. Documentation
branch was read only, not merged or edited. Original register content is retained
as a prefix in this implementation branch, with READY FOR TEST/design statuses
appended. No feature is claimed independently VERIFIED.

[Scope/dependencies, causes, designs and upgrade](../26-L2-FUNCTIONAL-CORRECTIONS.md)
· [Exact-source reproducible evidence and actual results](../../../vnext/evidence/wp2-l2-functional-corrections/README.md).
The evidence follow-up changes only that evidence directory and this handoff.
Verify source hashes and that split before treating the follow-up as the same code.

Owner baseline **3d8f82b** really passed **41 native Windows runtime tests,0 fail,
0 skip**, PG17.11, actual native ACL/sync execution and synthetic booking checks.
Browser Tests1–26 contain the limitations/defects driving this increment. Codex's
corrected-source runs are **Linux**, not new Windows acceptance. Native corrected
runtime/browser retest and independent acceptance are still required.

## Review and execute

1. **NM-031/032,001/005:** Menu is a durable three-action view; cita/agendar bypass it.
   All upcoming appointment summaries precede actions, with bounded preceding
   text batches for long histories. No appointment selector until management
   actually exists. Manage shortcuts/actions explicitly report unavailable; no
   booking mutation. Verify0/1/2/90, tenant/customer scope, IDs/order/expiry.
   Preserve C3 late applied proof/expired confirmation even after scheduled start.
2. **NM-033:** Human entry guidance once; subsequent text/action/booking commands
   produce no extra reply, remain HUMAN and finish durably. SQL support queue
   references original scoped inputs, survives COMMIT cuts and priority Menu,
   deduplicates request IDs and excludes post-Menu admissions. Queue is append-only
   under ordinary roles; SQL owner/superuser can disable/drop triggers (trusted
   local owner, not independent production custody). Needs Attention has count/
   category, no message text. No human notification/inbox/reply is claimed shipped.
3. **NM-029/036/004/011:** One short formatter, business zone/Spanish accents/year
   boundaries; button3/20 vs list10/24; SQL and TS construction checks; no internal
   action metadata in Meta-shaped payload. Actual browser list rather than four
   reply buttons. Long summaries: fake SQL atomically commits one ordered batch;
   real per-frame partial-send custody is still gate016, NOT solved here.
4. **NM-035:** Owner cookie and signed tenant bind detail lookup; foreign event and
   alternative tenant fields reject. Name/contact/service ID come from persisted
   rows; phone and service display name stay null. Assigned employee/status/time/
   buffer/duration/source are scoped stored facts/explicit derivations. Inspect
   Google mapping design without implying real provider execution.
5. **NM-037/043:** Explicit weekday+date grammar, inferred/provided year and mismatch
   rejection; no fuzzy AI parsing. Short forms and unchanged100 legacy date cases
   retained. Date-only idle text does not start booking. Impossible/unrecognized/
   past/horizon copy and recovery stay actionable.
6. **NM-040/041/042:** Fourth persona without resetting old identities; Ana UNKNOWN
   unchanged while two other customers fill both employees and stale third click
   cannot book. Future60+15 per-employee boundaries/reassignment, SQL half-open
   end10:15 and normal30-minute-grid10:30. Backend forged expired/superseded/
   replayed/out-of-order IDs after cita/Menu/human/restart, not disabled-UI proof.
7. **Upgrade:**008 is additive. Review exclusive CLI lock, authenticated stop,
   coherent hash-verified pre-upgrade backup, transaction, idempotence, no replay
   of empty-fixture001–007, no archive/attempt/identity/history clearing. TCP test
   exercises old007 profile upgrade through actual CLI, unchanged protected state,
   failed old-schema activation, coherent backup and separate inert restore.
8. **Design boundaries:**030 acknowledgment remains blocked by ordering;034 inbox,
  038 overlap policy/owner decision,039 operator recovery and006/007/010 manage
   parity are designs only.044 remains deferred. Do not “fix” UNKNOWN by clearing,
   new IDs, blind retries or manual success, and do not implement overlap bans.

Reproduce from fresh vnext at source pin:

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

Browser command requires local Chromium/Edge CDP. Windows uses npm.cmd; the runtime
must execute native ACL and metadata-sync checks with no skips. For existing owner
state use the exact stopped-writer upgrade instructions in26, never reset Ana or
activate an inert restore. Do not upload private state/backups/keys or profile URLs.

Please report exact source/environment/commands independently reviewed/executed,
conditions and evidence limits. Do not infer agreement or closure from Codex's
reported tests. Full parity, Milestone A and production remain open. All Draft PRs
stay unmerged; legacy/working data, migrations001–007/roles, W8/W9 and production
custody/witness/repair/provider/uncertainty/OPS01 gates remain protected. No real
Meta/Google, GCP, deployment or production activation.
