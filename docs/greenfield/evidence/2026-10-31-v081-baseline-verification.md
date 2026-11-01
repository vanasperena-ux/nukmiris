# Fresh accepted-baseline verification — 2026-10-31

Result: **1,089 tests passed, 27 suites, 0 failed/cancelled/skipped**, exit code 0, duration **229154.056001 ms (229.154 s)**. Reviewer/executor: Codex. Independent Claude review: pending. Owner PC result for this execution: NOT RUN. No vNext test/application exists in this planning PR.

Source: accepted tag commit `95decc812c228f25171ecfe647200447c83e2e45`; executed main `c439586ca512297c589ddd3bc2ae783b37358b37` has identical app/test/config/dependency files. Only release/acceptance documentation differs. Original `/workspace/nukmiris` status before/after remains clean on its existing `work` branch; no working DB, local environment or OAuth/Meta resource was read or modified.

Isolated local clone `/workspace/work/nukmiris-wp0`; Node v24.19.0, npm 11.9.0, Linux. Command:

```sh
cd /workspace/work/nukmiris-wp0/backend
npm test > /workspace/work/wp0-evidence/baseline-tests.log 2>&1
```

The package's unchanged command runs all 27 accepted test files with `node --test --test-reporter=spec --test-concurrency=1`. Tests use synthetic databases/mocked providers and local loopback HTTP. Execution required sandbox network permission for loopback; no live provider call was made. Test fixtures skip local `.env` and supply synthetic credentials/paths. Dependencies were reused via a temporary `node_modules` symlink to the existing installed baseline dependency directory; **no fresh `npm ci`/audit is claimed**. The symlink was outside the committed diff and removed after tests. The accepted package/lockfiles were not changed.

Two initial setup attempts were interrupted and are not counted as passing runs: a NODE_PATH-only reuse failed when fixture subprocesses constructed their own environment; local symlink fixed resolution. Default sandbox denied `listen 127.0.0.1` with EPERM; the successful run used loopback-enabled execution. The failures were environment setup, not repaired application code. Final command ran the full unchanged suite once successfully after setup correction. Initial logs remain scratch evidence, not acceptance passes.

[Full final raw test output](2026-10-31-v081-baseline-test-output.txt), SHA-256 `08863d99454797c40676103fca1ca4ef05efc44c7c4988f6165e2de1b8b36a8a`. The final log is synthetic test output and contains no working provider data. Historical accepted 1,089 tests and owner PC report remain distinct source evidence in BASELINE. This run does not validate real Meta templates/consent/delivery/coexistence, real Calendar writes, deployed recovery/security, original 178 interview wording or commercial readiness.
