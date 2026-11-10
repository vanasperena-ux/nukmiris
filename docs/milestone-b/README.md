# Milestone B — cloud reconciliation and review package

Prepared **2026-11-09, America/Mexico_City**, following the owner's clarification:
Codex authors these planning deliverables; **Claude's independent review is still
required**. This package does not claim an independent approval of its own design.

| Document | Purpose |
|---|---|
| [01 — Architecture reconciliation](01-CLOUD-ARCHITECTURE-RECONCILIATION.md) | ADR-005 Revision 3, all nine redlines, accepted application and authority boundaries |
| [02 — Implementation gaps](02-IMPLEMENTATION-GAPS.md) | Concrete missing components, evidence, owners and verifiable exit criteria |
| [03 — Stages and shutdown](03-PHASED-PLAN-AND-SHUTDOWN.md) | B1 synthetic platform/application stages, B2 gates, minimal inventory and teardown |
| [04 — Itemized costs](04-GCP-COST-MODEL.md) | Recomputed rates, 72-hour and monthly scenarios, Free Trial restrictions and sensitivities |
| [05 — Multi-business Meta onboarding](05-MULTI-BUSINESS-META-ONBOARDING.md) | Business-owned assets, Embedded Signup design, tenant routing, credentials and traceability |
| [06 — Claude handoff](06-CLAUDE-INDEPENDENT-REVIEW-HANDOFF.md) | Self-contained independent-review instructions and required verdict |
| [Evidence](evidence/README.md) | Immutable source pins/hashes, acceptance records, source access limits and arithmetic reproduction |

**Baselines:** executable `b4d0be0cb98c7f2b69be318e18b93f4de102c511`;
application evidence-only head `50f3a5be4a22cb0fbbaa7887e366e7c4c8db8117`;
ADR branch `83907db61daa929fa91ed9301c75b92eaa5f5436` (Revision 3 text from
`ad705c8cf666ae4ec617e00cae37eaad7f3f4511`);
Feature Register **v1.4 at `59cde023d2dff088161c1d01bd76c1099386e13f`**.

The owner has accepted the agreed **local synthetic** Milestone A scope. Do not
reopen that acceptance or request another Test 17C. Its scope does not establish
cloud containment, production custody or actual Meta/Calendar behavior.

**Current authorization:** documents, reconciliation and review handoff only.
No cloud implementation, provisioning, paid-service enablement, billing upgrade,
application change, Embedded Signup implementation, Services implementation,
deployment or merge. PR #16 remains Draft. All existing owner profiles, Ana's
UNKNOWN, accidental booking, capacity fixture and legacy application remain intact.

**Recommended next gate:** Claude reviews this exact package. The owner then
decides whether to authorize a bounded B1 implementation charter; a subsequent,
separate resource-specific authorization is required before provisioning. Neither
a planning verdict nor available trial credit grants that authorization.
