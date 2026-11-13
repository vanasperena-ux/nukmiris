# B1a source/local evidence — Draft PR21

**Artifact publication status: text evidence ready; raw archive parts are still pending upload. Do not treat the remote evidence set as complete until the PR completion comment.**

**No Google Cloud experiment executed. No source acceptance from Claude yet.**
[Draft PR21](https://github.com/vanasperena-ux/nukmiris/pull/21) is stacked on exact
corrected PR20 head2ca5cf215b68f187bfa48b42aaa041bbe93cf56d.

| Pin | Exact value |
|---|---|
| Tested implementation | **38ad02abbb0b7353f6768ff67f74542a4df0dedb** |
| Tested root tree |9192e00e97da478608d71b4421513725b7a7196c|
| Accepted application |b4d0be0cb98c7f2b69be318e18b93f4de102c511|
| Accepted original root tree |03d08322e27d9d54485fa887b482743fe076556b|
| Original INC1 implementation |3204e73c823d7e552c0aacad74294617490465f6|
| Corrected base root tree |d03bbc806facc29cb26628156fd20999eb592852|

This additive evidence publication changes only `platform-proof/b1a/evidence/`.
It does not retest or rewrite historical INC1 results. `tested-files-sha256.json`
pins all50 implementation-diff files;127 accepted application files and35
historical planning/evidence files are independently checked by the source tool.
The evidence commit hash is recorded in the PR publication comment (a commit
cannot contain its own hash). Raw results carry the exact testedSource above.

## Executed, serially, from that source

Linux amd64, Node24.19.0/npm11.9.0, pinned Docker PostgreSQL17.11, UTC,
fsync/synchronous_commit on. Fixture result.version contains actual measured
PostgreSQL/UTC. Every suite exited0; **zero skips/cancellations/failures**.

| Command from platform-proof | Tests passed | Complete output |
|---|---:|---|
| `npm test` |62|[full.log](full.log)|
| `npm run test:fault` |29|[fault.log](fault.log)|
| `npm run test:concurrency` |8|[concurrency.log](concurrency.log)|

Counts overlap. Each full/fault run includes original1000 schedules plus new
1080 instrumented schedules (54cells×20) and400 uninstrumented asynchronous stops,
including130 direct SIGKILL and270 continues. Instrumented points are explicitly
not arbitrary instructions; asynchronous delays may hit idle/completed work and
are recorded rather than claimed exhaustive. Original campaign's legacy `mode`
is still provider mode; the new b1a-* campaigns have distinct controlMode and
providerMode. Original INC1 evidence and Claude's adapted Node22/PG16 probes remain
separate historical evidence, not relabeled as this run.

New matrix/asynchronous ledgers show max1 REQUEST and1 EFFECT per attempt; preserved
SQL-only retirement counterexamples are NOT_PROVEN as physical fences. Native
kill/delayed-provider traces distinguish initiation from later application.
All25 full-case ledgers verify (fault21, concurrency4); see verifier JSONs for exact
exported case lists. `legacy-verification-*` and `ledger-verification-*` are our
source verifiers, not independent Claude acceptance. Extracted archives are
reverified separately. A raw archive contains only each case's provider.jsonl,
checkpoint.json and result.json; no private fixture directory/keys/passwords.

Terraform1.17.2/google8.11.0 native fmt/validate: **valid true,0 errors,0 warnings**.
Init uses cached pinned public provider, backend disabled. No plan/apply/destroy.
All119 proposed resource blocks retain the impossible apply gate. Controller and
teardown are print-only; spend-cap JSON is **PRINTED, NOT EXECUTED**.
Native Windows, real Cloud Run/SQL/network/IAM/custody/clock/budget/platform
experiments are **NOT EXECUTED**, never inferred from source validation.

## Reproduce / verify

Checkout the exact tested source, follow `../README.md` and run suites **serially**
in a disposable Linux environment. Each exported run sets B1A_SOURCE_SHA to the
actual checkout and its own B1A_EVIDENCE_DIR; no historical directory is reused.
To verify the published evidence, download this evidence directory and check every
SHA256SUMS.json entry. The full/fault archives are split losslessly under
archive-parts/ after large publication requests stalled. Automatic approval
review then rejected an opaque upload until its sensitivity was verified.
The subsequent complete data audit (privacy-audit.json) inspected all150 archived
JSON files and every string/key: the only payload is {"synthetic":true}; zero
customer/phone/password/token/private-key fields or secret patterns. This is a
Codex content audit, not independent Claude acceptance. Splitting does not waive
approval and preserves the exact same audited bytes. Their
original bytes/hash and ordered parts are in archive-assembly.json; concurrency
is a small unsplit archive. Reassemble from this evidence directory with:

```python
import json, hashlib
from pathlib import Path
for archive in json.loads(Path("archive-assembly.json").read_text())["archives"]:
    data = b"".join(Path(p).read_bytes() for p in archive["parts"])
    assert len(data) == archive["bytes"]
    assert hashlib.sha256(data).hexdigest() == archive["sha256"]
    Path(archive["file"]).write_bytes(data)
```

Reassembly is verified locally against the already extracted/reverified originals.
No raw result/log/hash is rewritten by the transport split. Extract each archive
into a different empty folder and run both source verifiers against each folder:

```
node b1a/verify-evidence.mjs EXTRACTED_RUN_FOLDER
node scripts/verify-evidence.mjs EXTRACTED_RUN_FOLDER
```

Do not concatenate independently initialized ledgers, upload runtime key files or
confuse synthetic signatures/clock models with platform observations. See command
start/end timestamps in commands.json and exact source/source-integrity outputs.

## Retained failures and diagnostic limits

- `earlier-1557242-full-FAILED.log`: earlier source1557242,60pass/1fail, cross-product
  child_message_timeout. It overlapped a development run that exhausted disk;
  timeout's exact cause is **not independently established**. Failed campaign raw
  trace was not exported before cleanup, so it is not reconstructed or used as
  passing evidence. Final source reran all62 tests cleanly, with complete exports.
- `earlier-recovery-development-FAILED.log` / earlier-diagnostics: unpinned targeted
  development run, startup failed **before assertions**. Captured PostgreSQL logs
  explicitly say "No space left on device". Diagnostics record owned IDs, exit1,
  OOMfalse and capture-before-removal. A duplicate task-created provider download
  was removed; final suites ran serially. No broad Docker cleanup was used.
- `recovery-focused-before-source-pin.log`: subsequent focused test passed before
  pinning38ad02a; supplemental only, not substituted for the final complete runs.
- The original historical INC1 fixture failure remains unresolved. New ENOSPC
  evidence does not establish the old failure's cause. Historical logs/hashes
  remain untouched. Failed evidence is retained under these distinct identifiers.

## Boundaries and next review

Source and repository secret checks pass; all six protected worktrees were clean
before additive evidence. Cleanup inventory shows zero owned proof containers or
volumes. No owner Windows profile/Ana data was accessed, no app/legacy source
changed, no new GCP resources/credentials/spending or real Meta/Calendar calls.
Zero-provider-call declarations mean **real external providers**, not local fake
requests counted in the ledgers. Public documentation/package downloads and
GitHub publication are not deployment.

Read `../CLAUDE-HANDOFF.md`, `../ACCEPTANCE.md`, `../OPERATIONS.md`, `../DECISIONS.md`
and the complete owner charter. Remaining pre-execution source adapters (live
bootstrap/OIDC/observation/custody/orchestration), organization choice, named
operators, exact resource/FX/expiry authorization and actual cloud proofs remain
explicit gates. Minimal container bootstrap is inert, not deploy-and-run.
Cost is proposed6h f1high15.51USDgross/19.38with25%; actual currency/SKUs/eligibility
unverified. No source verdict authorizes cloud spending or execution. Claude must
review the exact source before the owner considers a separate resource decision.
