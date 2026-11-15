# G-1/G-2/G-3 pre-provisioning readiness

This increment implements local source corrections and executable readiness checks under [the exact owner charter](OWNER-CHARTER.md). It is stacked on PR #22 evidence head `1e720fce1102dcf7867df567fabaf3b50eebf668`, following Claude's [source acceptance](https://github.com/vanasperena-ux/nukmiris/pull/22#issuecomment-6883846918) and [H-3/transit findings](https://github.com/vanasperena-ux/nukmiris/pull/22#issuecomment-6883846130). Acceptance of this source would support a later resource-specific provisioning proposal only.

The accepted application is `b4d0be0cb98c7f2b69be318e18b93f4de102c511`. The accepted proof source is `ade1c3be3b66f81aa05a26e06fa6c8e707d0526c` (tree `76d7c525b68aa879c38fad52872b77a96e51275a`). Its evidence head/tree are `1e720fce1102dcf7867df567fabaf3b50eebf668` / `8071aae2db360e626287e855fab6598cb6e03905`. None is rewritten. New source/evidence identities and measured results are recorded separately in `evidence/publication.json` after testing.

| Gate | Source delivery | Limits that remain |
| --- | --- | --- |
| G-1 | Deterministic image assembly, fresh lockfile-only offline installation, full own-layer file manifest, immutable base, startup/negative-state and packaged mTLS smoke checks | Local candidate only. Future registry digest, account image binding and deployment authorization remain open. Historical missing source chunks remain missing; no blocked uploads retried. |
| G-2 | Signed, independently keyed measurement/provenance validation; phase/flow/clock binding; ten scenario families; native Linux freeze/resume with open mTLS connection | Collection-only fallback. No finite cloud-wide bound is established. Cloud dispatch, retirement and promotion remain held. |
| G-3 | H-3 partial identity inclusion and fake-map validation; account receipt schema; separate kill/cleanup entry plans; authenticated cleanup intent replay and exact API absence | Real organization/IAM/quota/SQL/network/platform/billing properties remain unverified. Source review and local protocol fixtures are not actual GCP evidence. |

See [image reproduction](IMAGE.md), [transit protocol](TRANSIT.md), [operations/account gates](OPERATIONS.md), [costs](COSTS.md), [acceptance matrix](ACCEPTANCE.md) and [Claude handoff](CLAUDE-HANDOFF.md). `owner-inputs.template.json` and `account-receipts.template.json` contain null real-account values deliberately.

## Owner decisions incorporated

O-1 sealer in runtime project with independent custody; O-2 organization-based topology; O-3 sole human with separately scoped technical deployment/kill/cleanup identities and explicit common-human risk; O-4 provisional 60-second physical termination target, reporting delay separate; O-5 US$30 equivalent in MXN / at most six hours, no spending permission; O-6 one-day disposable B1a PITR only; O-7 restore drill deferred to B1b, $2 removed from B1a model. The earlier B1a2 $20 cost model and fixture inputs are historical; the successor owner template and readiness cost model supersede planning defaults without rewriting historical results.

No cloud account discovery, credentials, provisioning, spending, registry push, real providers or merges are part of this increment. The immutable `LIVE_CLOUD_EXECUTION=false` and impossible Terraform apply guard remain. Production custody/index/history gates 009/011/017, OPS01 ≥10,000 trials, Meta business-token fencing, explicit customer-name confirmation and approved-identity restrictions remain blocking for their later scopes. B1b restores retain the separate seven-day/restore requirements; B1a is disposable synthetic infrastructure only.
