# Runtime W1–W6 re-verification evidence

**Tested source: 8432dd846237efd959e4656ae8ddb2d7ff74adea**.
Tree5dcce88a1fbc6629e20112713e5b4bb5fd004261; parent reviewed runtime head f44d171.
Evidence follow-up changes only this directory and handoff12.

| Command from vnext | Result | Evidence |
|---|---|---|
| npm run test:runtime | 28 PASS,0 FAIL,1 native Windows ACL SKIP | [runtime.log](runtime.log) |
| npm test | 259/259,zero skips | [full.log](full.log) |
| npm run test:fault | 249/249,zero skips | [fault.log](fault.log) |
| npm run test:concurrency | 120/120,zero skips | [concurrency.log](concurrency.log) |
| typecheck / check:scope | PASS | [typecheck.log](typecheck.log),[scope.log](scope.log) |

Node24.19.0/npm11.9.0, **measured PostgreSQL17.11 (Debian17.11-1.pgdg12+2)**, Linux.
[Measured runtime JSON](measured-runtime.json),[summary](summary.json),
[source hashes](source-sha256.txt),[artifact hashes](artifact-sha256.txt).
Original reviewed source/evidence remain unchanged history.

W1 tests check *numeric SID syntax, localized-name-independent ACL read-back,
extra/wrong/inherited ACE denial, AzureAD SID and empty-root cleanup.
W2 checks explicit ten-minute pull, exact digest and redacted actionable errors.
W3 uses actual concurrent owners and a killed child, reboot/PID-reuse residue and
confirmed legacy-file recovery. W4 exercises inherited PGSSLMODE=require/verify-full.
W5 checks hidden exec/fork options. W6 prints queried server_version.
Real TCP/SCRAM/UTC, CLI lifecycle, backup/reset and core booking smoke still pass.

**Native Windows is NOT RUN.** Windows command mocks are contract tests, not native
execution. The native ACL case is explicitly skipped on Linux. Run the exact source
on the laptop with Node24/npm11/Docker Desktop Linux containers, then return the
console output, win32/EXECUTED measured JSON, icacls output and Docker context info
for Claude review. No secret state files/dumps are published or requested.

[Implementation/recovery commands](../../../docs/greenfield/23-WINDOWS-W1-W6-CORRECTIONS.md)
and [Claude handoff12](../../../docs/greenfield/reviews/12-CLAUDE-WINDOWS-W1-W6-REVERIFICATION.md).
Fresh source checkout: npm ci --ignore-scripts; run the commands in the table.
The image is pulled/verified explicitly, with no alternate image, TLS bypass,
remote daemon or daemon restart. Legacy recovery only affects the CLI record;
it cannot steal archive custody or reissue a dispatch permit.

C1 and L1 are independently accepted for L2 start. R1 and L1-C1–C6 remain required
before L2 demo acceptance. This PR remains inert/health-only, with ephemeral automated
booking smoke and fixture-only backups. W7,production custody/repair/provider/OPS01,
X1/F13,N2/N3,A2/A3,013/016 and native Windows/N6 remain blocking.
No merge, real Meta/Google, GCP, deployment, cutover or v0.8.1 change.

