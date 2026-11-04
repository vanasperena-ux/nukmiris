# Claude re-verification — WP1 C1–C4

Please independently verify **source `991ca8141ffef3471a955c450e9f789dd8aef1a7`**
(tree `711b2f1b442a74c29fccd79fb7efb0e5bfca34e4`), diff from
`1ca19248f0f26b47a7ed8013d79e75d387f508b3`. Later evidence commits are docs/evidence
only. Your [GO WITH CONDITIONS review](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6619904951)
is preserved. This is its bounded fix, not WP2.

Read [dispositions 04](04-CODEX-WP1-C1-C4-REMEDIATION.md),
[evidence](../../../vnext/evidence/checkpoint-1-conditions-c1-c4/README.md) and
[WP2 requirements/gates](../16-WP2-BOOKING-AND-INBOUND-DESIGN-REQUIREMENTS.md), then
inspect the actual SQL/test diff.

1. **C1/NEW-1:** reuse your corrected A4 harness with correct outer digests. BOGUS
   purpose and reused output ID must fail at prepare, with zero new operation,
   appointment, guard, range or attempt. Include nil/malformed/missing/JSON NULL
   IDs/purposes, self operation/attempt ID aliases and uppercase UUID spellings.
2. Reserve the same future output ID from different conversations/resources while
   one prepare is uncommitted. Check operation_output_identity serializes it, loser
   leaves no reservation, exact replay works before/after finalization, and an
   abandoned plan's original ID cannot be reused.
3. Inspect shared insert_operation_output and rolled-back preflight: actual output
   constraints/FKs checked before submission, no output survives preflight, only
   private success sentinel caught. Add a temporary output CHECK to prove schema
   changes are observed. Runtime/PUBLIC must not directly execute the helper.
   Check projected schedule revision agrees with each operation kind; retain
   existing finalizer rollback/unknown/duplicate tests.
4. **C4/NEW-4:** with valid RLS scope, owner recovery_case UPDATE/DELETE denies;
   INSERT/restore works. Verify ownership NOLOGIN, no runtime SET ROLE, and accurate
   documentation of owner state/DDL/trigger-disable powers without superuser.
5. **C2/C3:** NEW-2 reservation priority and NEW-3 sealed classification are explicit;
   001/013/016 disabled; 009/011/017 and nine OPS01 cases verbatim; no real providers,
   credentials, cloud, merge, v0.8.1 changes or WP2 application code.

Codex: Node 24.19.0/PG 17.11 full **98/98**, fault **88/88**, strict TS/scope PASS.
Ten condition tests are in both suites; `npm run test:conditions` runs them alone.
These are not independent results. From isolated vnext/: `npm ci --ignore-scripts`,
`npm run typecheck`, `npm run check:scope`, `npm test`, `npm run test:fault`.
Harness requires Linux/Docker/pinned PG/Unix sockets; native Windows is unverified.
If your environment remains PG16/Node22, record actual SQL results and limitations;
never claim unavailable Node24/PG17 executions as independently passed.

Publish exact tested commit/environment, commands/results, new counterexamples and
explicit **C1 accepted/rejected**. If accepted, state whether **CP1/initial CP2 are
formally closed for the bounded synthetic scope**, remaining gates unchanged.
Until then they are OPEN and WP2 cannot begin. Keep PR #4 Draft; no merge/live/GCP.
