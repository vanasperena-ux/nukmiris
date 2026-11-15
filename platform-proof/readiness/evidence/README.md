# Exact-source G-1/G-2/G-3 evidence

Tested implementation: **`9b526c048d5df1b3fbcf03e8f33c3ba53979b492`**; tree **`74801a03193011c24385d6ff36fb60178d61f107`**. Stacked on accepted PR22 evidence head `1e720fce1102dcf7867df567fabaf3b50eebf668`. [Draft PR23](https://github.com/vanasperena-ux/nukmiris/pull/23). The additive evidence commit is named in the final PR handoff; it is not the tested executable source. Only this new evidence directory is added by that commit.

**140 full / 99 fault / 29 concurrency / 24 targeted PASS**; zero failures, cancellations, skips or todos. Suites overlap. Node24.19.0, measured PostgreSQL17.11/UTC, Docker28.4.0/vfs, Linux. `commands.json` records exact argv/source/tree/UTC timestamps/elapsed times. Full435.772s, fault389.731s, concurrency40.527s, targeted1.752s; these are measured runs, not estimates. Logs are complete in `logs/`. Terraform fmt and static validate pass using cached Google provider8.11.0; no plan/apply or cloud API calls. Scope checking verifies all827 historical/application files, preserves107 historical INC1/B1a files and the prior accepted-app manifest, and leaves LIVE=false plus the impossible apply guard intact. No Windows or GCP execution is claimed.

## G-1 measured candidate

Two fresh source exports and offline npm installs produce identical188-file manifests, source layer, config, canonical uncompressed OCI manifest and Docker archive. These are separate local reassemblies on the same host/operator, not a second human/host review. `image/artifact.json` indexes every own-layer file; `source-readback.json` independently matches44 changed paths and47 runtime/lock files against a fresh GitHub Git download and all188 extracted own-layer files against their hashes.

- Local config/image ID: `sha256:1931766e764e9b400e3781796fa416421dda01fc992d69c4933295f29c30f888`.
- Own source layer: `sha256:6b18c59d7cf8ea39b77cd5a7f46e87656dd87326009e8900b94604cf7c297ed3`.
- Canonical uncompressed OCI manifest: `sha256:2f4f4b87448651dc8aef36de244771c33c96edf421983e066ef2375fd4713e80`.
- Docker archive SHA-256: `21679e621c173331df503c9ce7326457884a596955e18869502fdf58c0ab8484`.

All three smoke scripts pass: inert health200/readiness503 and blocked CLOUD flags; missing/copied identities, invalid epoch, expired identity/session, absent secrets and revoked authorization; packaged synthetic mTLS effect, unknown certificate/source denial, complete ledger hash-chain export and cleanup. Container SQL revocation is explicitly a readiness stub; actual SQL revocation and one-use/COMMIT behavior pass separately in full/fault suites. Own-layer scan finds no private-key/service-account/key/database/ledger files; customer roots are excluded. The public immutable Node base is pinned/verified, not forensically audited for every upstream binary semantic.

`image/commands.json`, build logs, inspect/config/OCI JSON and `reassembly.json` give reproduction inputs and measurements. See [the recipe](../IMAGE.md). Raw image/layer tar bytes remain local, with no binary upload or registry push. The original missing historical chunks remain missing; no retry, re-encoding or alternative publication was attempted. Future registry digest, provenance/security review and owner publication approval remain separate gates. Candidate/base were unloaded only after retaining exports/hashes, to give disposable PostgreSQL fixtures enough local disk; no unrelated old Docker volumes were deleted.

## G-2/H-3 measured safety

`h3-counterexamples.json` reproduces Q29/Q30/conflicting-epoch baseline EVIDENCE_READY→corrected HOLD, Q31 HOLD→HOLD and exact authenticated post-fence activity VIOLATION→VIOLATION, using independently regenerated signed fixtures rather than rewriting old raw evidence. Unit coverage also rejects invalid certificate maps/mounted profiles and copied/forged tokens; conclusive violations outrank nonfatal evidence gaps.

Four `native/*-transit.json` exports contain independently signed probe CLOCK/ACTIVITY/LEDGER observations, public fixture pins, full provider history, native stopped PID/start ticks and correlated phase intervals. Each contains one old TLS_READY, one REQUEST and one EFFECT; after an instrumented post-TLS SIGSTOP/SIGCONT, the new write on that same socket after the fence is VIOLATION. General dispatch/promotion remains HOLD, no resend/new identity. These are local native signals, not arbitrary-instruction or Cloud Run termination evidence. No finite cloud-wide transit bound is established. Valid finite samples elsewhere return COLLECTED only and cannot become a retirement capability. See [TRANSIT](../TRANSIT.md).

Both original ledger helpers pass all56 full/fault/concurrency case exports (27/23/6); results are in `verification/`. Three newly signed retirement bundles in `retirement/` reverify EVIDENCE_READY with one derived old TLS each; the seven historical bundles reverify unchanged (three count0, four count1). Those are local measured-policy V2 fixtures, **not cloud retirement readiness**. `verification/summary.json` maps all results. Raw protected UNKNOWN identities and no-resend rules are preserved.

## Scope of published raw data and reproduction

Published: complete final logs/commands, all three new signed retirement bundles, four signed native transit exports, three small SQL V2-gate ledgers/checkpoints/results, source/image manifests and verification summaries. Larger newly generated native campaign exports remain **session-local only**. `local-raw-integrity.json` lists all181 captured run files and hashes; this index is not a durable remote backup or a claim that every raw campaign byte was published. No new binary archive was uploaded. Historical evidence remains byte-for-byte unchanged.

From a clean isolated checkout of the exact tested source, install dependencies using `npm ci --ignore-scripts`, Node24 and the pinned PostgreSQL17.11 fixture. Give each suite its own newly created output folder and set B1A_SOURCE_SHA/B1A2_SOURCE_SHA/INC1_SOURCE_SHA to the source above; set B1A_EVIDENCE_DIR/B1A2_EVIDENCE_DIR/INC1_EVIDENCE_DIR to that folder. Run `npm run test:readiness`, `npm test`, `npm run test:fault`, `npm run test:concurrency`, `npm run readiness:check` serially as recorded. Do not reuse an owner profile or database.

At the evidence head (runtime files unchanged from the tested source), reverify the published signed examples:

```bash
node platform-proof/readiness/evidence/verify-transit.mjs \
  platform-proof/readiness/evidence/native/full-transit.json \
  9b526c048d5df1b3fbcf03e8f33c3ba53979b492
node platform-proof/b1a2/evidence/verify-retirement.mjs \
  platform-proof/readiness/evidence/retirement/full.json \
  9b526c048d5df1b3fbcf03e8f33c3ba53979b492
```

Repeat for other suites. The new evidence-only transit replay helper verifies local published fixture pins at the recorded reference time; it cannot bootstrap cloud trust or authorize live promotion. For regenerated full raw evidence, place only ledger-case directories (each with checkpoint/result/provider files) in a fresh verification input directory, then run `scripts/verify-evidence.mjs` and `b1a/verify-evidence.mjs` on that directory. Native B1a matrix remains54 cells×20, asynchronous400 and original legacy campaign1000; no new claim of all27 original point×control cells or arbitrary cloud suspension is made.

## Costs, open gates and stop

Current six-hour estimate: base$11.84, with25% contingency$14.80, illustrative tax$17.17, lag/residual$19.17, 10% FX stress$21.08 equivalent. Rows round separately. Two stressed runs$42.16 exceed the$30 planning allocation; actual MXN FX remains null and alerts are not hard caps. Enterprise Plus misconfiguration and72h scenarios are **sensitivity-only**, rejected/not authorized by the Enterprise/≤6h receipt/session gates. The historical$2 restore allowance is removed for B1a; B1b restore obligations remain. See [costs](../COSTS.md).

G1 local candidate, G2 collection-only validation/fail-closed algorithm, G3 H3/authority/cleanup/account preparation are implemented and locally tested. Independent Claude acceptance is PENDING. Actual org policies/IAM/quotas/SQL/private networking/CPU/lifecycle/clock/death/canary/custody/teardown/billing facts remain NOT EXECUTED. Registry digest and named operator/account/session/FX inputs remain open. LIVE=false/impossible apply guard, production custody009/011/017, OPS01, Meta token/name-confirmation/approved-identity gates remain. Accepted app/owner data are untouched; no cloud account/credential access, real Meta/Calendar calls, spending or merges. Stop for independent source review and a separately authorized future resource-specific proposal.
