# Independent Claude review handoff

Prepared for a separate skeptical review. **No Claude review has been performed or claimed in this WP0 assignment.** Do not ask Claude to approve an author, assume a test passes, or implement the proposal. Review the pinned sources and complete draft planning diff. The owner controls implementation/package/merge/activation decisions.

## Artifact map and source access

| Artifact | What to challenge |
|---|---|
| [00 Executive readiness](00-EXECUTIVE-READINESS.md) | Correct go/no-go statement, ranked risks and exact owner gate |
| [01 Source/scope](01-SOURCE-AND-SCOPE-MATRIX.md) | Current pinned refs, supersessions, missing originals, immediate-booking and title-vs-ID distinction |
| [02 Traceability](02-REQUIREMENTS-TRACEABILITY.md) | 37 signed scenarios, 178 honest evidence-status rows, no invented original wording |
| [03 Safety/threats](03-SAFETY-PROTOCOLS-AND-THREAT-MODEL.md) | A1–A5, attempt/token/gate automata, INV1–17 and F01–30; challenge every freeze/dual-write claim |
| [04 Model/interfaces](04-DATA-MODEL-AND-INTERFACES.md) | Composite FKs, guard/protection completeness, grants, origin/participant/resource seams |
| [05 P0 contract](05-P0-PARITY-CONTRACT-AND-TEST-PLAN.md) | All 49 V081 requirements, actual copy/priority, no extra normal confirmation or future-feature creep |
| [06 Gaps/experiments](06-TECHNICAL-GAPS-AND-EXPERIMENTS.md) | G02–05/G07–10 plus closed G06 enforcement, Q1–15/SC1–17/E1–13 mappings |
| [07 Packages/costs](07-IMPLEMENTATION-PACKAGES-AND-COSTS.md) | Smallest useful packages, complete cost/ops assumptions, no invented vendor/SLO/legal approval |
| [08 WP1 charter](08-WP1-BOUNDED-IMPLEMENTATION-CHARTER.md) | Precise synthetic scope, feasibility, meaningful stop/go tests and residual limitations |
| [Baseline verification](evidence/2026-10-31-v081-baseline-verification.md) | Fresh unchanged-baseline logs versus historical acceptance; no inference of vNext/provider/PC pass |

Source pins: product `1f4682ccba02fe5d89ce9d671c0114d6f9a0d6e1`, architecture `c55193a95e5eb38b245215f81deb00d9b2eaad5f`, accepted tag commit `95decc812c228f25171ecfe647200447c83e2e45`, main `c439586ca512297c589ddd3bc2ae783b37358b37`. Full links and mandatory read order in 01. Review existing Draft PR #2 as approval history; do not modify it. The new planning PR has only docs/greenfield changes and remains draft.

Suggested read-only source commands in an independently authorized checkout:

```sh
git show 1f4682ccba02fe5d89ce9d671c0114d6f9a0d6e1:docs/product-review/05-codex-greenfield-rebuild-handoff.md
# Follow its A → B → C order and current source/test references.
git diff c439586ca512297c589ddd3bc2ae783b37358b37...<planning-head> --stat
git diff c439586ca512297c589ddd3bc2ae783b37358b37...<planning-head> -- docs/greenfield
```

Do not replace the original accepted checkout, execute live CLI commands, rerun provider setup, or regard review itself as authorization to implement. WP0 scripts are documentation generation/validation outside the deliverable tree; they are not application code.

## Copyable independent challenge prompt

> You are the independent reviewer for NukMiris WP0. Read the source handoff completely and follow the specified sources at the pinned commits. All 37 scenarios and G06 Option A are approved design intent. Accepted v0.8.1 source controls P0 parity. Review the complete planning diff and evidence, not this summary alone. Do not implement, merge, deploy, contact users, activate providers or reopen settled choices without a documented conflict.
>
> Find concrete counterexamples to the proposed protocols. For each finding give severity, exact artifact/section, invariant violated, a minimal process/crash/interleaving trace, requirement source, proposed correction, and deterministic/integration/provider test that would demonstrate the correction. Distinguish static deduction, owner product policy, proposed experiment, documented provider guarantee and remaining uncertainty. Do not call a model/schema table a proof. State where access/evidence is missing.
>
> Challenge A1–A5 under archive-first, accidental DB-first, lost SQL/object responses, unsealed work, conflicting batch duplicates and missing prefix/tail/head/key. Can a worker execute before independently durable evidence? Can complete-looking archived objects conceal an unknown final tail? Does the protocol safely retain uncertainty without inventing IDs?
>
> Challenge nontransferable ARMED/SUBMISSION_ENTERED ownership, one-use token, duplicate loops, ambiguous admission commit, process pause immediately before socket, failure storing result and stale finalization. Do not accept a lease/cache/epoch row as an HTTP fence. Is every automatic new generation disabled until previous non-effect/containment evidence? Does the plan honestly retain physical late-submit/deployment blockers?
>
> Challenge unknown-sender permission-head creation, READ COMMITTED waited-row visibility and fixed lock order. Test STOP-first/dispatch-first, slow preflight, stale Accept/grant restoration and archive failure. G06 must gate all actual automated booking/send admission including queued work, preserve data, resume future eligible work only and never catch up uncertain sends. Distinguish already admitted/in-flight provider traffic from a claim of strict physical retraction.
>
> Challenge the full business/channel/calendar/customer/event/operation/resource/origin authority tuple, RLS trusted context and shared-runtime compromise boundary, composite FKs, finite source/target union protections and one unresolved event mutator. Can two employees share a Calendar without Calendar-wide capacity-one? Can intentional manual overlaps later remain valid while automated booking remains conflict-free? Do copied properties or normalized phone matches ever imply identity/consent?
>
> Verify P0 has no service/staff/consent/survey feature creep, no extra booking/move/cancel click, exact Spanish/date/title semantics, name-after-time, command/human priorities, current reminder modes/timing and old-vs-current targeting. Check all 49 V081 IDs, 37 scenario rows and 178 original-evidence-status rows. Missing original interview text must stay unavailable, not fabricated or treated as unapproved journeys. Later C09/O03/O04/O12/C12/G06 amendments supersede older architecture assumptions.
>
> Assess WP1 as the smallest useful synthetic proof: identify unnecessary files/features and missing critical tests. Review packages/costs for provider, recovery, support and reviewer effort; all prices/targets must remain proposed. Give GO FOR BOUNDED SYNTHETIC WP1, GO WITH SPECIFIED REVISIONS, or NO-GO with exact blocking evidence. This recommendation cannot authorize owner implementation or any live effect.

## Required response and disposition format

| Field | Required content |
|---|---|
| Finding ID | `CR-WP0-###` stable ID |
| Severity | Critical: unauthorized/duplicate irreversible effect, cross-tenant access, grant revival/unsafe recovery; High: mandatory parity/correctness/security gap; Medium/Low: bounded maintainability/ops clarity |
| Evidence | Exact source/commit/section and reproducible counterexample; label absent evidence |
| Mapping | Relevant G/Q/SC/E, INV, V081 and J/Decision evidence category |
| Correction/test | Concrete enforceable correction plus pass criterion and environment needed |
| Codex disposition | accepted / corrected with diff+test evidence / disputed with evidence / disabled scope; unresolved remains open |
| Reviewer result | verified fixed / still open / requires provider evidence / blocked source |

No findings are prefilled as resolved. Independent review output should retain dissent/limitations. Before WP1, owner reviews/revises 08; before WP2, CP1 and initial CP2 require actual DDL/grants/code/test evidence and critical/high findings closed. CP3–CP6 remain later package gates, not waived by WP0 agreement.

Open proof targets: Q2/SC5/E03 (single use and pause), Q7/SC1/E10 (dual-store seals), Q8/SC8/E12 (withdrawal lock), Q6/SC13/E06/E11 (identity completeness), Q13/SC14/OPS01 (real failover/egress), G03/G08 (Meta account/coexistence), G02/G05 (manual/resource mapping) and G10 (missing original numbered source). Explicit no-retry, inert recovery and disabled commercial workflows remove some immediate provider dependencies; they do not certify launch readiness.
