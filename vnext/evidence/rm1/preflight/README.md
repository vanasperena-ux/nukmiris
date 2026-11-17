# Preserved preflight evidence

These original files are copied byte-for-byte. They are **not** the final-source result set. Existing accepted PR #27 evidence is unchanged.

| File | Actual source/scope | Outcome / correction |
|---|---|---|
| full-ddbd-before-null-guards.log | ddbd8a6fd5c8ef9ac840f33b163d21d709373fb4 | 806 pass / 1 fail: new SQL functions rejected null arguments with the wrong error contract. Guards corrected; original reflection test unchanged |
| full-231d-before-fixture-release.log | 231d913d1753a1909dc9de7c7ea4d265f1825edd | 813 pass / 0 fail / 0 skip. Final application/core files are identical; subsequent commit changes only three runtime test files |
| runtime-231d-before-fixture-release.log | 231d913d1753a1909dc9de7c7ea4d265f1825edd | 47 pass / 4 fail / 2 native-only skips. All four failures start a second PostgreSQL container during restore; application/reminder cases passed |
| restore-host-diagnostic.log | Local disposable diagnostic, no application changes | Target exits during cluster initialization; host filesystem 100% used, <6 MB available, not OOM. Sequentially releasing the owned source container removes that capacity pressure |
| browser-development-assertion.log | Uncommitted development preflight | Test read the ASISTENTE bubble header instead of the exact message body. Selector corrected; application copy unchanged |
| targeted-development-schedule.log | Uncommitted development preflight | Injected the race after a full tick had already sent. Test corrected to inject at the actual dispatch.beforeGate suspension point; no ordering protection was removed |

The final runtime tests release only their randomly named, labelled disposable source resources after backup/source assertions. The unknown-upgrade source assertions execute before disposal. All restore, history, isolation, uncertainty and inertness assertions remain; restoring independently after losing the source is still proved. This is a host-capacity fixture correction, not a native Windows result or a production recovery claim.
