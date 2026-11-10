# Reconciliation evidence and reproduction

This is planning evidence, not a cloud test report. Read [source manifest](source-manifest.json),
[acceptance provenance](acceptance-records.json), [prior remote branch inventory](branch-discovery.json),
[verification](verification.json), [provider sources/access limits](PROVIDER-SOURCES.md)
and [cost arithmetic](cost-calculation.json).

Repository objects are pinned per file; ADR text/reviews live on PR6 and were not
merged into PR16. Feature Register v1.4 at59cde023 was read completely; no write to
its documentation branch. Current owner acceptance comments supersede stale
pending/FAIL labels without editing historical records. Source code stays b4d0be0.

Observed before authorship: application planning base50f3a5b and legacyc439586 clean.
The author checked127 accepted source and26 published evidence hashes. Cost
calculations run offline with Python Decimal and assertions; regenerated JSON must
match the committed output. No DBs, runtime profiles, provider credentials, raw
payloads, private URLs, keys or backups are published here.

Reproduce from repository root:

```text
python3 docs/milestone-b/evidence/calculate-costs.py
```

Compare output to `cost-calculation.json`; verify listed input blobs/SHA256 against
their exact Git refs. `verification.json` records the actual static/arithmetic
checks and non-executions. A later publication record pins this design commit;
its follow-up contains only that provenance file. Check that split and confirm
the branch diff is confined to `docs/milestone-b/`.

Application suite counts, Windows46/46 and owner browser/Test17C are **prior**
executions by their recorded actors, not runs in this planning task. Cloud safety,
cost invoice, account quotas, managed role behavior, runtime termination and Meta
contracts remain untested. Claude's independent verdict is pending.
