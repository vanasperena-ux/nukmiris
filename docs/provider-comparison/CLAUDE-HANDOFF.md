# Independent Claude review handoff — provider decision

This is a handoff for the owner to give Claude, not a claim that Claude has
reviewed this package. No review was sent automatically. Compare the exact new
PR head and tree shown by GitHub; the base is PR18 head
`23079800b825502cf290c5a61ee32c2e3c256dd6`. Every new file must be under
`docs/provider-comparison/`; every pre-existing file must match the base.

## Required reading

1. [Comparison and safety matrix](README.md), [cost report](COSTS.md),
   [sources/limits](SOURCES.md), [calculator](calculate-costs.py),
   [results](cost-results.json).
2. [PR18](https://github.com/vanasperena-ux/nukmiris/pull/18), design
   `bc1dc2f5aa731623ae701fa6b889d2a99736516c`, publication `2307980…`.
3. Your [PR18 review](https://github.com/vanasperena-ux/nukmiris/pull/18#issuecomment-6756171002)
   and [cost evidence](https://github.com/vanasperena-ux/nukmiris/pull/18#issuecomment-6756171826),
   including MB-01–12, C-1–14 and INC1.
4. Executable `b4d0be0cb98c7f2b69be318e18b93f4de102c511`, especially
   `vnext/src/application/dispatch-once.ts`, Postgres roles/unit-of-work,
   archive protocol and synthetic runtime guards. PR16 local acceptance remains
   bounded and is not reopened by this planning exercise.
5. Original ADR `55f6fae`, Rev3 at `83907db61daa929fa91ed9301c75b92eaa5f5436`,
   reviews03/04/05, all RL-1–9 and DR-01–12. Links/pins are in README.

## Questions to independently challenge

- Does staying on GCP follow from actual required controls rather than familiarity
  or sunk cost? Are any Railway/Render controls overlooked? Seek current official
  evidence; absence of a doc is not proof of absence.
- Is every N/I/E/U matrix classification defensible? In particular, custom SQL
  users are not proof of BYPASSRLS, static outbound IPs are not an egress firewall,
  and a deployment status is not frozen-process termination evidence.
- Are full equivalent native totals honestly unresolved? Challenge U rather than
  assuming zero. Is there a cheaper **provably equivalent** topology? Moving only
  gateway does not automatically preserve RL-5 for other processes.
- Recompute costs independently, including monthly normalization, included usage,
  five service roles, external verifier, backups/PITR, archive operations, key
  versions, egress, logs, restore drills and actual plan names. Render live table
  extraction failed; independently verify the indexed rates. Check Railway's
  monthly vs per-second discrepancy. Do not treat allowances as quoted SKUs.
- Does commercial business-token fencing remain blocked under MB-08? Does the
  design preserve customer portfolio/WABA/number ownership, PIN custody, routing,
  offboarding and future Embedded Signup without claiming implementation?
- Are engineering/operations estimates realistic and the weighted matrix honest
  about uncertainty? Recalculate 3.45/2.45/2.20 and the safety/simplicity sensitivity.
- Is a local tunnel actually faster once B2 contracts/gates are counted? Identify
  any safe narrower experiment without granting real-provider authority.
- Confirm preservation of UNKNOWN, stable operation IDs, chain **and index**
  extension, no false ACK, old-image/new-epoch rollback and all existing gates.

## Requested review output

Return **GO FOR PROVIDER DECISION / GO WITH CONDITIONS / NO-GO**, stating exact
scope, disqualifying gaps, corrections, independent price checks/arithmetic,
unexecuted checks and owner decisions. Distinguish a preferred provider from an
approved deployment. A vendor switch requires an explicit reviewed ADR amendment;
a risk waiver is not proof of equivalence. Do not reinterpret your prior
conditional INC1 verdict as implementation authority.

No app, migrations, owner profiles, historical evidence, INC1, account/subscription,
cloud resources, real-provider calls, billing upgrade, deployment or merge is in
scope. This research request explicitly pauses INC1 until the provider decision.
Keep PR16, PR18 and the new PR Draft/unmerged. After the provider decision, propose
only a separately chartered local INC1, reviewed before any provisioning request.
