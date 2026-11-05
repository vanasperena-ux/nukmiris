# Claude re-verification — L0a blocking B1/B2

Review basis: [GO WITH CONDITIONS](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6622229074)
and [original probes](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6622229262).
The previous baseline review is complete; these corrections still require your
independent acceptance. **L0a remains OPEN. L0b has not started.**

**Run/review source `ff45a8e9b41fa9be99e773ff053c6cd6a1ea38b7`**, tree
`4447bea4a410bf570566fd439eeaf9cd29d896fb`, parent
`a376f1eb51205b392e7ec0355bc8ac64525c8319`.
The follow-up evidence commit adds only this handoff, the historical-handoff status
note, and `vnext/evidence/wp2-l0a-b1b2/`. Verify that split and the new source hashes.

[Code/test results and reproduction](../../../vnext/evidence/wp2-l0a-b1b2/README.md)
and [N1–N6 owners/acceptance criteria](../18-WP2-L0A-B1-B2-AND-FOLLOWUPS.md).

## Re-verification targets

- **B1:** review `availability.ts`, archive call-site wrappers and operator instance
  repair. One FIFO mutex covers the entire connection operation, including await
  points, witness CAS and confirmation. Sixteen distinct-key calls all succeed;
  sixteen same-key calls allocate exactly once; reads/verify/audit wait at each
  append cut and during repair. Rejected work releases ownership; queued work
  cannot rollback another call. Check the 64-operation bound/active-close guard and
  typed `ArchiveBusyError` for real SQLite lock contention/overload. Preserve the
  four process SIGKILL cuts, process convergence, stale-CAS fence and recovery.
- **B2:** X1 is deliberately **still reproduced**. The retained test uses archive
  HMAC/AES keys and only the original witness read/CAS capability, with no original
  signing key or repair permit. A signed larger fork changes the ARM owner, loses
  an original key into authenticated absence, passes cold audit with the *older*
  retained minimum checkpoint, and permits reallocation. Documentation in doc 17,
  both evidence/trust-boundary descriptions and the witness port states the honest
  writer/key assumption. Production 009/017 now require independent append-only
  extension verification of **both chain and key index** before any non-fixture
  custody. This is a documentation/test correction, **not a production fix**.
- **N4:** recursive object/array business binding now checks match, allocation,
  decrypted bodies and repair; foreign/null envelope/intent/array bindings fail
  closed, same-tenant nested records survive read/repair. Opaque raw bytes remain
  subject to N5; no broad admission/routing expansion is included.
- **Follow-ups:** N1 has distinct typed pending/busy/held errors and a specified
  bounded read-only caller policy; caller integration remains OPEN before inbound
  expansion. N5 route/facade and raw-custody binding remains a required L0b gate.
  N2 incomplete forensic publication and N3 post-fence durable-write adoption remain
  production-011 gates; N3's honest-path behavior is explicitly regression-tested.
  N6 Windows/linear repair/disk/RSS limits remain open and measured, not an SLO.

From the exact source checkout with Node 24/npm 11 and the pinned PG17.11 image:

```sh
cd vnext
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm run test:archive
npm run test:archive:concurrency
npm test
npm run test:fault
npm run test:archive:capacity
```

Publish exact source/versions, what you ran versus evidence reviewed, and B1/B2
acceptance/rejection. If satisfied, explicitly close **L0a for bounded local
synthetic scope** and permit L0b entry; no self-review is represented as independent
acceptance. Do not infer production security from passing X1 or close any production,
Windows, 001/F13, 013/016 or OPS01 gate. PR #9 stays Draft; no merges/providers/GCP.

After your formal acceptance, the authorized next code task is L0b sealed/versioned
message classification and terminal reductions (W2-CL01–04), then reservation
ordering before any protection/attempt rows (W2-RP01–04), carrying O1/O3. Implement
and independently verify N1/N4/N5 before inbound expansion. The Windows local
booking demo remains the delivery priority after required L0/L1 prerequisites.
