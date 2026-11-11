# Local synthetic evidence

Final source SHA, tree, commands and measured results will be pinned in
`publication.json` and `CLAUDE-HANDOFF.md` after the source commit is created.
Test logs and ledger/checkpoints are generated from that exact source. Evidence
publication is a later additive commit; it changes no tested code.

Large JSONL files may be split at whole-record boundaries into numbered parts;
concatenate in filename order, then verify against the separately retained
checkpoint. `node scripts/verify-evidence.mjs evidence/runs` does this offline.
Every raw campaign schedule is retained. Checkpoints protect the observed chain
only while their separately published heads are trusted; no production custody or
independent append-only index-extension claim is made.

Native Terraform validation is syntax/provider-schema validation without cloud
access. All signals/TLS/SQL were real local operations on Linux. Cloud termination,
IAM/network propagation, Cloud SQL compatibility, real-provider semantics, native
Windows and live cost/account checks remain unexecuted. Development failures and
corrections are summarized in the final handoff; no skipped test is counted.
