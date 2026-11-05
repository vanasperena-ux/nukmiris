# Claude re-verification — runtime W1–W6

Review exact source **8432dd846237efd959e4656ae8ddb2d7ff74adea**, tree
5dcce88a1fbc6629e20112713e5b4bb5fd004261, parent f44d171. The evidence follow-up
only adds this handoff and vnext/evidence/wp2-runtime-w1-w6/. Verify that split/hashes.

Responds to [your PR12 review](https://github.com/vanasperena-ux/nukmiris/pull/12#issuecomment-6658674741).
[Implementation/recovery](../23-WINDOWS-W1-W6-CORRECTIONS.md),
[results/reproduction](../../../vnext/evidence/wp2-runtime-w1-w6/README.md).

- W1: *numeric SID, icacls read-back plus SID-normalized Get-Acl; only current-user
  FullControl ACE, protected directory inheritance and state/child privacy. ACL
  failures remove only the empty root created by that attempt. Existing files stay.
- W2: explicit pinned-image pull with600000ms timeout; RepoDigests verification.
  Sanitized bounded stderr/actionable guidance, no argv or raw-error cause leakage.
- W3: CLI-only OS-held loopback guard with pid/instance/startedAt metadata. Crash/
  reboot releases ownership without killing a PID, age inference or provider permit
  transfer. Actual child-death/concurrent-recovery tests. Legacy empty/corrupt file
  requires stopped old CLI commands and explicit instance confirmation; it is retained.
- W4–W6: ssl:false at both connection boundaries, windowsHide on native commands/
  forks, measured PostgreSQL version. Original isolation and UTC/SCRAM remain.

Codex executed Node24.19/PG17.11:28 runtime PASS plus1 explicit native ACL SKIP;
259 full,249 fault,120 concurrency PASS with zero skips. Typecheck/confinement pass.
**Linux only; native Windows NOT RUN.** Command mocks do not close Windows acceptance.

Run npm ci --ignore-scripts, typecheck, check:scope, test:runtime, npm test,
test:fault and test:concurrency. Publish exact environment/tests executed versus
reviewed and W1–W3 corrected/rejected verdict. If corrected, permit the owner's
fresh native test:runtime run. Native evidence must show win32/EXECUTED, actual
server_version, verified ACL and Docker context; no private state files.

Keep PR12 Draft. C1/L1 acceptance does not close R1/L1-C1–C6, native Windows/N6,
W7,production custody/repair/provider/OPS01 or X1/F13. No merge/providers/GCP/v0.8.1.

