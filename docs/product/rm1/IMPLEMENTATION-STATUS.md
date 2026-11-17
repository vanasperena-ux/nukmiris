# RM-1 implementation-branch register addendum

Authoritative register **v1.13**, commit **6c1cdf67fe49b677a6ba16d964badcbc7318b303**; roadmap v1.3 and copy review v1.3. The authoritative branch and existing NM IDs are unchanged. This addendum records the implementation status in [Draft PR #28](https://github.com/vanasperena-ux/nukmiris/pull/28), executable **6a25e295a7b05860d0cb8207c0b4c57731af74e7**.

| Feature | Implementation status | Evidence / boundary |
|---|---|---|
| NM-068 | READY FOR TEST | All 13 approved scenarios; exact Unicode, paragraphs, name/business/horizon, state/limit/privacy tests; [CX matrix](CX-MATRIX.md) |
| NM-069 | READY FOR TEST | Four legacy stages 168/24/conditional 22/2 h, future-only/15-minute timing, scoped synthetic permission/template/receipt fixtures, attendance, direct exact-appointment RC-1 reschedule, owner activity, durable clock, recovery and inert restore |
| NM-017–020 / NM-026 | R3 OPEN | Only the explicitly authorized synthetic prerequisites inside NM-069 are delivered. No live WABA approval, legal compliance or new first-contact consent workflow is claimed |
| NM-027 / NM-030 / NM-034 / NM-039 | DESIGN ONLY / R3 GATED | Existing held diagnostics and support custody retained; no new outbound acknowledgment bypass, owner reply inbox, arbitrary reconciliation/clear action or notification channel |
| Manual/imported appointment reminders | NOT IMPLEMENTED | Current APP_CREATED-only model; no unauthorized adoption, fabricated customer or inferred permission |
| Native Windows / independent RM-1 acceptance | PENDING | Linux evidence is not laptop acceptance. [Fresh-profile Windows walkthrough](WINDOWS.md) / [Claude handoff](../../../vnext/evidence/rm1/CLAUDE-HANDOFF.md) |

[Final automated evidence](../../../vnext/evidence/rm1/README.md). R0 remains open. No merge, protected-profile change, provider/cloud activation or automatic continuation follows this delivery.
