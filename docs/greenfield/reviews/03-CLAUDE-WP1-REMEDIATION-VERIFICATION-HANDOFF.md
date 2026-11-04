# Independent Claude verification handoff — WP1 remediation

Please independently verify the bounded remediation of your GO WITH SPECIFIED
REVISIONS. **CP1/initial CP2 remain open.** No WP2, merge, deployment or real
Meta/Google call is authorized. Do not modify the original review/scripts or old
checkpoint evidence.

**Review diff:** `e0b470d8f28bd380c9d6bfdeab0b9aad5e5ab507..857bb825ac01ca67f303adbe71ef486c276c8923`.
The later evidence commit changes only documentation/evidence. Starting reviewed
implementation was `108adb62604b9963bd3468ab8b43c36b69fcef6e` with evidence `d184f32`.

Read [dispositions 02](02-CODEX-WP1-REMEDIATION-AND-DISPOSITIONS.md) and
[new evidence README](../../../vnext/evidence/checkpoint-1-remediation-1/README.md),
then inspect the actual source diff: migrations 001/002, new 003, roles, admission,
plan building, status path, canonical JSON, fixture clock, and all changed tests.
The owner approved only bounded WP1 remediation.

Executed here: Node 24.19.0/npm 11.9.0, pinned PostgreSQL 17.11, full **88/88**,
fault **78/78**, no failures/cancellations/skips, strict TS/source confinement pass.
1,000 recorded SQL schedules plus 256 overlapping three-client PG schedules;
173 NULL/typed-malformed argument cases across all 17 exposed mutating functions.
Readable logs, exact source hashes and baseline counterexamples are stored in
the new package; compressed rows/snapshots remain local. **The compressed SQL/state evidence is withheld locally
after automatic approval review rejected public upload.** Its all-member synthetic
content inventory and hashes are published; compressed SQL snapshots/state traces remain local, unpublished. See the
publication-status record before claiming access to the full archive. These counts are Codex executions, not your results.
Reproduce with `npm ci --ignore-scripts`, `npm run typecheck`, `npm run check:scope`,
`npm test`, `npm run test:fault` from isolated `vnext/` with Node 24/Docker. Do not
replace unavailable executions with a claim they passed; record limitations.

Priority review questions:

1. **002/003/004:** can any malformed SQL/JSON/NULL, sealed replay, changed membership,
   count, purpose or caller-clock value still make unsafe work executable? Verify
   exact idempotent retries remain usable. SQL must defend without TypeScript.
2. **006:** mutate each payload/context/identity/time/digest independently while
   recomputing a correct outer seal digest. Does preparation deny disagreement
   with the authoritative plan/rows before reservations? Check unsupported JSON
   number/Unicode canonicalization behavior and the integrity/authenticity distinction.
3. **007:** independently repeat STAGED and entered/UNKNOWN earlier-operation
   variants, including absent earlier output. Race preparation against HOLD_INPUT;
   inspect lock order, FK locks, finalizer and bounded waits. Does later output
   remain held until earlier command and outputs are terminal?
4. **008/012:** snapshot ACTIVE, suspend, restore with missing/empty archive tail;
   verify SUSPENDED, new revision/epoch, dispatch false and no resume. NULL and
   forged future grant clocks must never create a grant. Runtime must not change
   the fixture clock or substitute the production clock function.
5. **010:** attack abandonment before/after ARM, gate CAS, unknown commit, and
   finalization. Can entered/UNKNOWN work ever free a guard/range/head? Verify
   MOVE source identity/buffer/protection, rollback, idempotence and retained audit.
   Check HOLD_INPUT cannot race an existing or preparing operation into execution.
6. **005/009/014/015:** mixed-tenant STOP survives a different tenant's failure and
   shared archive outage; ACK waits for all durable partitions. Check raw-byte
   root/partition links, digest recomputation, crossed-role denial, conflicting
   status replay and owner payload UPDATE/DELETE. Fixture custody is not production
   cryptographic authentication; production roles/processes/keys remain gated.
7. **001/011/013/016/017:** are the explicit disabled capabilities and later gates
   sufficient within WP1? Confirm original and new F13 counterexamples remain
   visible; SQL locking is not represented as a physical cutoff. Review OPS01's
   nine cases, archive repair/capacity proposals and receipt-contract prerequisite.

Please report finding-by-finding verification (including new counterexamples),
exact tested commit/environment, actual executed commands, limits, residual risks
and a CP1/initial CP2 recommendation. All 17 findings need a disposition. Nothing
in a positive WP1 review authorizes WP2 or real provider activation.
