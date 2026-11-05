# Claude independent C1 re-verification

Review source **`c46f22949fa996a1a79139218d768c51013dec6b`**, tree
`8cbf8143ef413dfd045b703ed393b4f4274d149e`. Evidence follow-up only adds this
handoff and `vnext/evidence/wp2-c1/`. Verify source/artifact hashes and that split.
Base is accepted L0b `a0eca88c`; PR #10 remains Draft/unmerged.

Your [GO WITH CONDITIONS](https://github.com/vanasperena-ux/nukmiris/pull/10#issuecomment-6649052579)
permits Windows L0/L1 now; **C1 must be independently accepted before L2**.
[Implementation](../20-C1-NORMAL-CONVERSATION-PROGRESS.md) and
[results/reproduction](../../../vnext/evidence/wp2-c1/README.md).

Please re-run/challenge your precise L1/L1b/L2 schedules against migration 005:

- Machine-sealed supersession binds exact priority decision, original input and
  attempt/payload. SQL commits context and all dispositions atomically under the
  conversation lock. Missing custody, rollback, lost COMMIT response and exact retry
  must not leak reservations, duplicate IDs or require an operator.
- PREPARED/ARMED booking or confirmation at Menu/humano, including real child
  crash/freeze before arm/entry: abandoned/expired with zero calls; next new booking
  progresses (after explicit Menu when human mode owns conversation).
- Entered/UNKNOWN remains protected. Both actual concurrent lock orders are tested;
  entry and supersession/expiry cannot both succeed. Normal expiry handles ARMED
  confirmations and never re-arms/reissues a permit. MOVE restores only source range.
- O2: PLAN_INVALID is an explicit marker/error reason; resource/output contention
  stays distinct. Existing terminal-rejection reduction family carries planReason.
- O4: TS/SQL recognize aliases after stripping all non-alphanumeric punctuation;
  representative provider field names pass. Real Meta compatibility is still 016.

Executed here on Node24.19/PG17.11: **259 full, 249 fault, 120 concurrency**, all
passing, zero skips; each includes 52 new cases. From vnext run npm ci --ignore-scripts,
npm run typecheck, npm run check:scope, npm test, npm run test:fault,
npm run test:concurrency, npm run test:progress. State your exact environment,
tests executed versus reviewed and explicit C1 acceptance/rejection before L2.

O5 reducer/sealer trust-root limitation and O6 human-mode semantics are unchanged.
X1 and F13 still reproduce; all production/custody/repair/provider/OPS01/Windows
gates remain. No merge, real provider, GCP or v0.8.1 changes. Keep the PR Draft.
