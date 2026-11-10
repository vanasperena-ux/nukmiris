# Claude independent review handoff — Milestone B cloud reconciliation

**Author:** Codex;2026-11-09 America/Mexico_City. **Independent verdict PENDING.**
The owner clarified that Codex must author the reconciliation/costs first, then
Claude independently reviews them before any cloud implementation authorization.
Do not present this author's package as the independent approval it requests.

## Review subjects and immutable references

Repository `vanasperena-ux/nukmiris`; dedicated planning branch
`planning/milestone-b-cloud-reconciliation-2026-11-09`. Exact design commit/tree
are in the PR publication record and `evidence/publication.json` when published.
The publication follow-up adds that record only; verify this before reviewing.

- Accepted executable **`b4d0be0cb98c7f2b69be318e18b93f4de102c511`**, tree
  **`03d08322e27d9d54485fa887b482743fe076556b`**.
- Application evidence/docs head **`50f3a5be4a22cb0fbbaa7887e366e7c4c8db8117`**;
 127 source hashes and26 artifact hashes were checked by this planning task.
- ADR branch **`83907db61daa929fa91ed9301c75b92eaa5f5436`**; Revision3 content
  from **`ad705c8cf666ae4ec617e00cae37eaad7f3f4511`**, SHA256
  **`c3bfc7acb209ccd5fe946063f94f03ea06fc518c2f75d8b20277d5ce83e8babc`**.
- Feature Register **v1.4**, documentation branch
  `docs/feature-register-vnext-20261106`, commit
  **`59cde023d2dff088161c1d01bd76c1099386e13f`**, blob
  `679a5b465b913843566fb59f1410b69cf9803bc1`; read completely. Later owner/Claude
  acceptance comments supersede its historical pending/defect status, not the
  approved scope or future provider gates. Documentation branch remains untouched.
- Main/legacy `c439586ca512297c589ddd3bc2ae783b37358b37`; PR16 stays Draft.

Read source documents and actual code, not just these summaries. Hashes and full
paths are in `evidence/source-manifest.json`; primary web references/access limits
are in `evidence/PROVIDER-SOURCES.md`.

## Required reading order

1. Original ADR-005 at PR6's fixed commit, all RL-1–RL-9 in review03, DR-01–DR-12
   in review04, Revision3 and review05. Review02 is historical and superseded where
   corrected, especially Calendar duplicate prevention, deletion sequence and
   heartbeat-based termination. Read Issue5's decision sequence.
2. Owner/independent acceptance: [WP1 closure](https://github.com/vanasperena-ux/nukmiris/pull/4#issuecomment-6620571487),
   [L0a/B2 limitation](https://github.com/vanasperena-ux/nukmiris/pull/9#issuecomment-6646622771),
   [Claude PR16](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6730422478),
   [owner C1 decision](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6731276697),
   [Test17C](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6728974018),
   [Windows browser](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6754899286),
   [46/46 native runtime](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6754990526),
   [bounded Milestone A assessment](https://github.com/vanasperena-ux/nukmiris/pull/16#issuecomment-6755009222).
3. Exact accepted source: ports, admission/custody, dispatch/result/recovery,
   local connection guard, SQL roles/scope/constraints, SQLite/witness/key custody,
   X1 test/F13 evidence, local backup and loopback UI; doc16's verbatim OPS01 and
   production009/011/017 gates. Do not rerun on owner profiles or clear Ana.
4. This package: [01](01-CLOUD-ARCHITECTURE-RECONCILIATION.md),
   [02](02-IMPLEMENTATION-GAPS.md), [03](03-PHASED-PLAN-AND-SHUTDOWN.md),
   [04](04-GCP-COST-MODEL.md), [05](05-MULTI-BUSINESS-META-ONBOARDING.md), evidence.
5. Recheck current official cloud/Meta documentation, particularly pricing and any
   first-party detail the author could not access. No live provider/cloud resource
   access is authorized by this handoff; account-specific evidence needs owner input.

## Questions to challenge

- Does01 faithfully retain all nine redlines and Revision3's corrections, without
  treating local acceptance, historical conditional GO or trial credit as deployment
  approval? Are B1a/3a, B1b/3b and separately gated B2 clearly distinct?
- Is the purpose-built platform proof small enough, yet capable of establishing
  actual old-revision termination, fresh-connection behavior, dead-man canaries,
  CPU late-resume and independent fake-ledger observations? Are missing/stale metrics
  denied as proof? Do pre-fence bytes remain honestly distinguished from forbidden
  new old-epoch writes? Are≥1,000 platform trials and≥20 canaries preserved without
  substituting for the≥10,000 OPS01 suspension requirement before real effects?
- Does gateway ticket transfer preserve the local unrepeatable-COMMIT continuation
  safety? New epoch, service retries or lost consume responses must not reconstruct
  original permits. Is the proposed result/restore separation sufficient under009?
- Is B-G03's Cloud SQL role/IAM compatibility concern accurate and adequately bounded
  as untested? Challenge BYPASSRLS, actual session_user names, FORCE RLS, SECURITY
  DEFINER ownership, default cloudsqlsuperuser membership, SSL/IAM connector support
  and whole-deployment connection/memory budgets. No disabling isolation to port code.
- Does the archive design address independent verification of **both** chain and
  index extension, including key re-pointing, not just signatures/CAS/size? Does
  recovery preserve permissions/original IDs/UNKNOWN and coherent SQL/archive/ledger
  frontiers without claiming local offline bundle proves cloud recovery?
- Are network, identities, secrets, logging, retention/key destruction and human-root
  custody limits appropriate? Could CI/no-VPC/alternate routes bypass the fence?
  Does instance billing remove only one pause source, rather than solve F13?
- Is deferring old T01b's actual Calendar request to B2 the correct reconciliation
  of the owner's B1 synthetic-only rule? B1 cannot call Calendar and describe it as
  entirely synthetic merely because no credential was supplied.
- Recompute04 and challenge every allowance. Distinguish gross USD estimates, shared
  free usage, MXN account prices and owner-reported trial balance/expiry. NAT's
  Direct VPC accounting, fake VM SKU, sidecars, result/backup/witness/restore costs
  remain conditions, not verified quotes. Test the monthly gateway fallback against
  the$250 target and the72h saturation case against the proposed$50 allocation.
- Do alerting, service spend caps, persistent resources, delayed charges and monthly
  automatic resume leave a loophole? Is the shutdown plan actually complete and
  abandonable without long-term commitments? No hard whole-project cap claim.
- Does05 preserve customer-owned portfolio/WABA/phone assets for every business,
  rather than imposing a platform-owned WABA? Challenge authorization proof, app/
  environment routing, per-tenant grants, raw mixed-tenant custody, billing ownership,
  coexistence/migration risks and offboarding. Current Meta developer pages returned
 429: do not convert proposed token/approval details into confirmed facts.
- Is the A/B epoch credential scheme compatible with future Embedded Signup business
  grants? If not demonstrated, require an explicit future decision and proof without
  revoking customer consent or silently weakening ADR protections.
- Is explicit customer-name confirmation **mandatory before any real WhatsApp pilot**
  and clearly absent from the baseline? Real testing is limited to owner-approved
  identities/assets; local name ambiguity acceptance is not a commercial waiver.

## Reproduction and evidence limits

Offline only, from repository root:

```text
python3 docs/milestone-b/evidence/calculate-costs.py
```

Compare JSON with `cost-calculation.json`. Recheck Git object SHA256 manifests and
confirm this planning branch changes only `docs/milestone-b/`. No application suite,
cloud harness, resource creation, provider integration, Windows test or account
inspection was executed by this planning task. Prior application tests/acceptance
are cited with their actual owners and environments. Do not relabel them as cloud
or independent execution. Record your own exact reviewed SHA and execution limits.

## Required independent output

Give **one** verdict:

- **GO FOR B1 IMPLEMENTATION PLANNING**;
- **GO WITH CONDITIONS**; or
- **NO-GO**.

State whether it covers technical planning only or supports a **separately owner-
approved provisioning stage**. It never grants implementation/provisioning, spending,
paid-billing upgrade or deployment authority on the owner's behalf. List precise
blockers, conditions, missing evidence, corrections, owner decisions, accountable
roles and acceptance tests. Independently assess the cost model and prioritize
Codex corrections; preserve accepted product decisions and local Milestone A scope.

Publish the review in a separate review artifact/commit linked from this planning
PR and Issue5. Keep PR16 Draft/unmerged and its executable unchanged. No app code,
Services, owner-profile changes, providers, GCP provisioning, billing changes,
Embedded Signup implementation or production activation. After review, the owner
chooses the next bounded implementation charter and later resource authorization.
