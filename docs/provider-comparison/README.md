# NukMiris cloud provider decision — Google Cloud, Railway and Render

**Proposed planning decision; 2026-11-09, America/Mexico_City. Author: Codex.**
Independent review of this comparison is pending. This package authorizes no
implementation, account connection, resource, subscription, payment or deployment.

## Executive decision

**Stay with Google Cloud, subject to the existing proof gates.** Railway and
Render can host Node.js, PostgreSQL, webhooks and workers. They do not currently
have sufficient documented evidence to claim the complete ADR-005 containment
contract. In particular, private networking, a stop button, a deployment status
and a graceful-shutdown timeout do not establish externally enforced per-epoch
egress denial or that every frozen old instance has died. GCP has more relevant
control primitives; its actual guarantees remain unproven until B1a executes.

Neither alternative is demonstrated to deliver **the same safety with less total
work and lower cost**. Railway's low-volume resource bill is attractive; Render's
managed database reduces database administration. Both still need the common
gateway, custody, uncertain-effect, recovery and real-provider implementation.
An external gateway alone does not fix unrestricted egress from other runtimes
or prove old-instance termination. Do not weaken the redlines to obtain a cheap
Node server.

| Option | A: monthly development | B: 10 businesses / 1,000 appointments | C: 100 businesses / 10,000 appointments | Decision eligibility |
|---|---:|---:|---:|---|
| GCP, complete proposed topology | $186–217 | $189–220 | $335–367 | Candidate for proof; not production certified |
| Railway candidate + external custody services | $90 + U_R | $126 + U_R | $337 + U_R | Native safety equivalence NOT PROVEN |
| Render candidate + external custody services | $113 + U_D | $166 + U_D | $316 + U_D | Native safety equivalence NOT PROVEN |

USD gross before 25% contingency, Meta, labor and tax. **U_R/U_D are unpriced
safety architecture gaps, not optional features or assumed zero-dollar work.**
No finite equivalent native total can honestly be certified from the evidence.
The [cost report](COSTS.md) gives itemized conditional estimates and a fully
priced GCP-core fallback for each PaaS; that fallback retains GCP and costs more.
A uses a full-month runtime for comparison, not the recommended first experiment.
An optional request-billed GCP gateway could save about $39–40/month only if its
late-resume proof passes. Even the instance-billed B envelope with contingency
($236–275) can exceed the old $250 target.

The smallest next step **now** is independent review of this docs-only comparison
and an explicit owner provider decision. After that decision and a separate INC1
charter, propose Claude's **local-only INC1** with the permit-creating COMMIT in
the gateway process. Do not implement it under this research request. Following
independent INC1 review and closure of provisioning conditions, a separately
authorized supervised GCP B1a session of at most six hours is the first cloud
step. Real WhatsApp/Calendar testing remains B2, separately gated.

## Evidence and authority

This branch is stacked on [PR #18](https://github.com/vanasperena-ux/nukmiris/pull/18),
head `23079800b825502cf290c5a61ee32c2e3c256dd6`. It adds only this directory;
PR18 and the historical ADR are unchanged. PR18's design commit is
`bc1dc2f5aa731623ae701fa6b889d2a99736516c`.

| Evidence reviewed | Authority and practical consequence |
|---|---|
| [PR16](https://github.com/vanasperena-ux/nukmiris/pull/16), executable `b4d0be0cb98c7f2b69be318e18b93f4de102c511` | Accepted local synthetic foundation. Read package/runtime contract, SQL roles, unit of work and dispatch continuation directly. No claim of a new application audit or test run. |
| [Original ADR](https://github.com/vanasperena-ux/nukmiris/blob/55f6fae/docs/greenfield/12-ADR-005-GCP-CLOUD-ARCHITECTURE.md) and [Rev3](https://github.com/vanasperena-ux/nukmiris/blob/83907db61daa929fa91ed9301c75b92eaa5f5436/docs/greenfield/12-ADR-005-GCP-CLOUD-ARCHITECTURE.md) | Original control hypothesis plus later RL/DR corrections. Rev3 SHA256 `c3bfc7acb209ccd5fe946063f94f03ea06fc518c2f75d8b20277d5ce83e8babc`. Original cheaper estimates are historical, not current guarantees. |
| [Review03](https://github.com/vanasperena-ux/nukmiris/blob/83907db61daa929fa91ed9301c75b92eaa5f5436/docs/greenfield/reviews/03-CLAUDE-ADR-005-INDEPENDENT-REVIEW.md), [Review04](https://github.com/vanasperena-ux/nukmiris/blob/83907db61daa929fa91ed9301c75b92eaa5f5436/docs/greenfield/reviews/04-CLAUDE-ADR-005-REV2-DELTA-REVIEW.md), [Review05](https://github.com/vanasperena-ux/nukmiris/blob/83907db61daa929fa91ed9301c75b92eaa5f5436/docs/greenfield/reviews/05-CLAUDE-ADR-005-REV3-FINAL-CHECK.md) | All nine redlines, DR-01–12 and Rev3 refinements govern this comparison. DR-01 supersedes heartbeat-based termination; DR-03 supersedes a reliable duplicate-ID fence. |
| [PR18 reconciliation](../milestone-b/01-CLOUD-ARCHITECTURE-RECONCILIATION.md), [gaps](../milestone-b/02-IMPLEMENTATION-GAPS.md), [plan](../milestone-b/03-PHASED-PLAN-AND-SHUTDOWN.md), [costs](../milestone-b/04-GCP-COST-MODEL.md), [business onboarding](../milestone-b/05-MULTI-BUSINESS-META-ONBOARDING.md) | Reused as pinned planning evidence, not edited or treated as running infrastructure. |
| [Claude PR18 review](https://github.com/vanasperena-ux/nukmiris/pull/18#issuecomment-6756171002) and [supporting evidence](https://github.com/vanasperena-ux/nukmiris/pull/18#issuecomment-6756171826) | GO WITH CONDITIONS for B1 planning/local INC1 only; no implementation authority. MB-01–12 and C-1–14 remain applicable. |

At the executable pin, `vnext/package.json` requires Node >=24 <25;
`src/infrastructure/postgres/unit-of-work.ts` deliberately rejects nonlocal
fixtures, uses `ssl:false` and max-eight pools. `roles.sql` uses BYPASSRLS,
literal session identities and migration ownership transfers. `dispatch-once.ts`
restricts providers to synthetic mode and gives a one-use permit only in the
successful-COMMIT continuation. Hosting changes must use separately reviewed
adapters, not disable these guards or publish `local/booking-worker.mjs`.

## Technical capability matrix

**N** = natively supported primitive; **I** = additional implementation required;
**E** = external infrastructure needed in the evaluated design; **U** = not proven
or potentially unsupported. Combined codes distinguish available primitives from
the missing end-to-end guarantee. An N is never a NukMiris acceptance verdict.
Official evidence is linked in [sources](SOURCES.md).

| Requirement | Google Cloud | Railway | Render |
|---|---|---|---|
| Node.js 24 | N/I: pinned container, new cloud entrypoint | N/I: Docker/explicit version, new entrypoint | N/I: native version pin or Docker, new entrypoint |
| PostgreSQL transactions, constraints, RLS | N/I/U: Cloud SQL; MB-01 role port required | N/I/U: Postgres image; likely greater bootstrap control, exact role/TLS/extension probe still required | N/I/U: managed Postgres/custom SQL users; BYPASSRLS/ownership must be probed, not assumed |
| Public TLS Meta webhook | N/I: HTTPS service; wire authentication/custody adapter | N/I: public domain; same adapter | N/I: web service; same adapter |
| Durable work and background execution | N/I: SQL outbox + continuous worker pool; region/quota proof | N/I: always-on service + SQL state; disable sleeping | N/I: paid background worker + SQL state |
| Google Calendar API and OAuth | N/I: API reachability is not business authorization | N/I: external HTTPS, reviewed OAuth adapter | N/I: external HTTPS, reviewed OAuth adapter |
| UNKNOWN handling, stable operation IDs, receipts | I: accepted rules must span new transport | I: same | I: same |
| One-time effect permission | I: in-gateway COMMIT per MB-03; no bearer permit | I: same; DB gate alone is not physical fence | I: same |
| Gateway-only provider credentials | N/I: service IAM + gateway-only KMS decrypt | E/I/U: external KMS/verifier, scoped bootstrap identity; environment vars alone insufficient | E/I/U: same; env groups are not per-tenant key custody |
| Default-deny runtime egress; unique epoch network fence | N/I/U: Direct VPC/all-traffic/firewalls; org decision and bypass tests open | U/E: reviewed private/outbound docs do not establish equivalent controls | U/E: private network/environment isolation and outbound IPs do not establish equivalent controls |
| Forced old-instance termination and dead-man evidence | N/I/U: revision deletion + delayed platform instance evidence + canary; NOT executed | U: deployment removal/draining exists; required frozen-instance evidence/independent kill scope unestablished | U: documented SIGTERM/SIGKILL lifecycle; frozen-instance oracle/kill scope unestablished |
| Independent seal-before-ACK and archive verification | N/I: separate custody project + verifier of chain AND authenticated index extension | E/I: GCP custody/verifier in priced candidate, not same-project bucket alone | E/I: same |
| Backups/PITR | N/I: SQL backups/PITR plus separate custody exports | N/I/E: current Railway PITR exists; archiving image/bucket health and independent export needed | N/I/E: paid PITR; Pro 7-day window plus independent export |
| Inert recovery, suppression precedence, old primary return | I: new isolated DB/no decrypt/egress, new epoch, coherent verified frontiers | I/E/U: same contract; route/identity isolation unresolved | I/E/U: same; restore's copied network settings need explicit isolation |
| Controlled rollout/rollback | N/I: digest pinned, manual seven-step fence, old image as new epoch | N/I/U: disable automatic deploy/rollback; new-epoch controller, kill proof missing | N/I/U: same; ordinary zero-downtime deploy is insufficient |
| Observability/independent audit | N/I: epoch/attempt metrics and separate audit custody | N/I/E: native logs/metrics plus independent export and ledger | N/I/E: same; native deploy status is not death proof |
| Multi-business assets, routing and offboarding | I/U: provider-neutral contracts; commercial token fence open | I/U: can implement same contracts; no provider resolves Meta fence | I/U: same |

RLS is a database capability, not proof that NukMiris's exact bootstrap works.
For every candidate require throwaway probes of `rolbypassrls`, CREATE/ALTER ROLE,
WITH SET membership, function/table ownership, FORCE RLS, actual `session_user`,
`btree_gist`/`pgcrypto`, TLS and pool budget. Runtime superuser/admin, dropping
RLS or substituting SET ROLE for session identity are prohibited shortcuts.
Railway's image-based Postgres trades flexibility for more patching, capacity
and recovery responsibility; Render documents SQL-created users but this does
not settle privileged attributes.

## Nine-redline safety comparison and required decisions

| Redline (with later DR correction) | GCP route | Railway / Render gap, mitigation and decision |
|---|---|---|
| RL-1: fresh TCP/TLS after final authority check, zero transport retries; platform termination | Implement dedicated per-attempt client; delete old revision and prove zero old instances, frozen canary and ledger | Client is portable. Native termination evidence at required granularity is U. Get first-party control/API evidence and later authorized canary trials, or move effect runtime to controlled GCP. SIGTERM/heartbeat absence is insufficient. |
| RL-2: two-part F13, pre-fence tail D and G06 | Measure connect/write/arrival separately; owner threshold and residual disposition | Same required schedules; no bounded native D claim. Missing evidence holds dispatch. An unavailable independent kill plane remains a material risk on all providers. |
| RL-3: independent warm sealer before ACK, safe cold-start failure | Min-one service under custody principal | Paid always-on service plus independent verifier is feasible. Never ACK on partial custody or rely on an in-memory queue. Extra service/custody costs are included. |
| RL-4: Calendar stable IDs/If-Match, short cache, Meta epoch revocation | New adapters; ID collision rejection not guaranteed, grant never revoked for release | Portable I; Meta commercial business-token revocation is U for all. MB-08 requires explicit ADR amendment and owner risk decision before commercial use. |
| RL-5: all-traffic enforcement, no-VPC rejection, gateway-only decrypt, old VIP denial | VPC/IAM primitives, with MB-04 no-org limitation declared | No documented equivalent native per-epoch egress policy in this review. Private connectivity, an outbound static IP or HTTP_PROXY is insufficient. External KMS can restrict stored secrets but cannot kill a cached-token socket. Controlled external runtime or new proven provider control needed. Architecture amendment/re-review required for substitution; risk acceptance alone is not equivalence. |
| RL-6: inert N+1, epoch advance, routing removal, deny/delete, death proof, UNKNOWN, explicit enable | Preserve corrected seven-step sequence, independent kill holder, unique epoch identity/tag | Native deployment algorithms differ. Need mapping to every step and independently scoped kill authority, U until demonstrated. Rollback always new epoch N+2; no native one-click reactivation. |
| RL-7: epoch-labeled metrics and independent ledger | Export opaque IDs, connect/failure/lag/custody metrics | Native logs support diagnosis; add external custody/alerts. Stale/missing instance metrics yield NOT PROVEN. Paid audit/RBAC tier must be checked before treating two accounts as independent. |
| RL-8: independent export, chain AND index-extension verifier, inert recovery, crypto-shred | New verifier required; separate admin/key domain; no retention lock | External GCP custody/verifier included. Native snapshots/PITR are not independent custody. Test export-only restore, malicious writer, fork/re-pointing, missing tail/key, suppression heads and old primary. Same-human-root risk remains even across clouds. |
| RL-9: platform 3a before app 3b; costs and cleanup | B1a then B1b, both synthetic; later B2 | Every platform needs its own proof; GCP results cannot certify a PaaS. Cheap native candidate subtotals leave blocking controls unpriced. No automatic promotion. |

Moving only the gateway to GCP still leaves RL-5 unmet for PaaS workers/ingress
and introduces cross-cloud identity, SQL access, loss windows and control planes.
Calling that equivalent would require an explicit reviewed architecture amendment
and evidence, not just an owner waiver. The conservative fallback is to keep **all
safety-critical runtime** in GCP and limit a PaaS to an optional untrusted UI;
that adds a vendor and recurring cost without simplifying the current proof.

### Claude conditions carried forward

MB-01: reviewed Cloud SQL role/identity/ownership design before B1b adapters.
MB-02: pin Enterprise edition/tier and fit actual connection limits; do not budget
24 runtime plus 10 reserved connections against an unmeasured shared-core tier.
MB-03: prefer in-gateway `enter_submission` COMMIT/`mark_unknown`, keeping the
one-use continuation in the process opening the socket. A pull-worker gateway
would change the service fence and needs an ADR delta; this comparison does not
silently choose it.

MB-04–07: organization decision or explicit unavailable-policy compensation;
named kill/custody/cleanup/billing owners; proposed fence threshold disposition;
first cloud window ≤6h/about $20, elapsed-time kill and gross alerts; review
service spend caps and their delayed/service-only behavior; no paid upgrade by
default. Owner-reported trial expiry is December 22, 2026; retain Claude's
**December 17 teardown-complete deadline** and +48h/statement reconciliation.
Teardown must include SQL backups/deletion protection, PSA peering/range, NAT/IPs,
disabled secret versions, KMS versions, held VPC IPs and project/billing closure.

MB-08–10: commercial business-token fence amendment, number PIN custody, current
Embedded Signup requirements, coexistence echo/history/disconnect semantics.
MB-11–12: measure cold-start ACK failures separately from readiness/termination;
carry corrected costs/connection assumptions in new work. **C-1–14 remain open as
scoped in Claude's review**; this package closes none by assertion. B2 still needs
explicit name confirmation, private inbound/outbound identity/asset allowlists,
transport/receipt/consent contracts, all nine OPS01 cases and ≥10,000 schedules.

## Commercial architecture across all three options

Each customer owns its Business Portfolio, WABA and number. NukMiris stores
versioned authorized mappings and grant references; it does not put all customers
under a platform-owned WABA. Infrastructure scales with measured resource usage,
not one mandatory container/database per business.

On ingress verify app-bound raw-body signature, then resolve **both WABA ID and
phone-number ID** within environment/app. No default tenant or learned-recipient
fallback. Bind each planned effect to business, asset/grant/calendar/permission
revisions, recipient, purpose, digest, operation/attempt and deployment/recovery
epochs. Unknown, conflicting or offboarded mappings hold without an effect.
RLS/composite FKs and negative cross-tenant tests supplement routing.

Tenant refresh/business tokens and registration PIN are encrypted in SQL with
scoped key references; only gateway authority decrypts sending credentials.
App-secret signature verification is separate from sending-token access. A shared
gateway necessarily has a multi-tenant blast radius: one environment variable
set is not tenant isolation. Audit decrypt/use without logging plaintext secrets.
Offboarding suppresses work, advances mapping/grant revisions, removes relevant
subscriptions/access by the approved flow and preserves UNKNOWN/evidence under
the retention contract. It does not revive old work or deregister a
customer-owned number as a release mechanism.

Future Embedded Signup needs server-side code exchange, per-customer grants,
verified asset binding and callbacks. None of the providers prevents implementing
this. Claude's dated first-party findings on PR18 include v4, App Review/Tech
Provider requirements, business-specific tokens, no graduation of developer test
WABAs and coexistence events. **This run could not independently re-fetch the
overview (429)**; treat those as attributed prior review evidence and revalidate
before implementation. Coexistence echoes need human-hold handling, history must
not become booking input, and PARTNER_REMOVED invalidates grants/mapping.

The key unresolved commercial problem is common: independently revocable fresh
Meta credentials per customer/epoch may not be available through the business-
token flow. Self-owned B2 A/B results do not certify that flow. Choosing a cloud
cannot resolve MB-08; no commercial launch on any provider until the amendment,
flow evidence and explicit residual-risk decision exist.

## Engineering effort, owner experience and operational cost

Estimates are focused engineer-days at roughly 6–8 productive hours/day, with
wide uncertainty. Independent assurance, owner decisions, Meta/App Review wait,
product backlog and support staffing are additional. They are not delivery dates.

| Work package | GCP | Railway | Render |
|---|---:|---:|---:|
| Common B1 safety/adapters/custody/recovery work | 18–30 | 18–30 | 18–30 |
| Platform deployment/IAM/network/controller/proof integration | 6–10 | 4–7 for ordinary deployment only | 4–7 for ordinary deployment only |
| Additional alternative-control design, identity bridge and proof | 0–3 | 8–18+; feasibility unresolved | 8–18+; feasibility unresolved |
| Total to synthetic B1 evidence | **24–43** | **30–55+ conditional** | **30–55+ conditional** |
| Subsequent controlled real adapters/name confirmation/B2 evidence | 8–15+ | 8–15+ | 8–15+ |

These are overlapping workstream budgets, not additions to PR18's package table.
Claude's local INC1 estimate (8–14 days) sits **inside** the B1 total. Re-estimate
after its review. For Railway self-operated database/PITR care can add 2–5 days
and ongoing maintenance; included uncertainty does not guarantee a ceiling.
No number promises that an unsupported control can be engineered into existence.

| Dimension | GCP | Railway | Render |
|---|---|---|---|
| Account/setup | Highest: projects, org choice, IAM/WIF, private SQL, VPC/NAT, independent custody | Low for ordinary app; two-vendor custody/control design removes much of that advantage | Low ordinary app + managed DB; same independent control/custody issue |
| Application changes | New entrypoint, TLS DB adapter/role decision, ingress, separate sealer/gateway/result, archive and release adapters | Same common changes; may keep literal SQL logins after successful probe | Same common changes; managed-role decision still required |
| ADR work | Record MB-01/03 decisions and later commercial amendment; preserve Rev3 | New provider ADR/amendment mapping every redline, deployment/API evidence and residual decisions | Same |
| Operations/month, initial estimate | 4–8 hours for patch review, drills, keys, costs and alerts | 6–12 hours including DB/archive checks and split control planes | 4–10 hours; managed DB helps, hybrid control planes remain |
| Lock-in | IAM/VPC/SQL connector/KMS/GCS controllers; portable domain/SQL/containers | Moderate native deployment/volume/PITR APIs plus external security dependencies | Moderate Blueprints, managed DB and deploy APIs plus external dependencies |
| Windows laptop | PowerShell + Git/Node24; optional WSL/container tools; new profiles/fixtures, remote cloud shell for Linux-only proof | CLI/dashboard can speed ordinary hosting; native Windows fixtures stay separate | Dashboard/Blueprints easy; same local test separation |

For illustration, at $50/hour, an additional ten engineer-days costs $3,000–4,000.
The modeled B Railway saving before U is only $63–94/month: roughly 32–63 months
to repay that extra work, before operations and control services. Use the owner's
actual rate; this is arithmetic sensitivity, not a contractor quote.

Railway/Render can accelerate obtaining a persistent HTTPS URL, but **do not
materially remove the critical path to real integration**: no real-provider
adapters currently exist, name confirmation and receipt/partial-send custody are
missing, and OPS01/real asset authorization remain gated. A laptop with a tunnel
can test selected wire behavior later, but cannot establish cloud containment or
independent recovery and adds Windows sleep/network exposure. It is not a safe
shortcut to B2 now; retain isolated local synthetic development in the meantime.

## Weighted decision and sensitivity

Scores: 1 = major unresolved requirement; 2 = substantial redesign; 3 = workable
with material effort; 4 = strong primitives/fit; 5 = demonstrated complete fit.
No provider earns 5 for safety. Cost scores use **unproved candidate** estimates
and therefore intentionally favor the PaaS options; they cannot override gates.

| Criterion | Weight | GCP | Railway | Render |
|---|---:|---:|---:|---:|
| Safety/reliability | 35% | 4 | 1 | 1 |
| Total operating cost | 25% | 3 | 4 | 3 |
| Development speed/simplicity to required guarantees | 20% | 3 | 2 | 2 |
| Multi-business scalability | 10% | 4 | 3 | 3 |
| Portability/flexibility | 10% | 3 | 4 | 4 |
| **Weighted /5** | **100%** | **3.45** | **2.45** | **2.20** |

GCP's control primitives and prior design work explain safety/speed scores;
Railway's adjustable resource usage explains low-volume cost; Render's managed
DB improves operations but adds workspace/per-service floors. PostgreSQL and
containers make both alternatives portable, while hybrid key/control dependencies
limit that advantage. Counts of businesses alone prove no throughput capacity.

**Disqualifying gate for native PaaS selection today:** RL-5 equivalent enforcement
and RL-1/6 independently evidenced frozen-instance containment are unproven.
GCP also remains blocked for activation until its actual proofs and conditions
pass. The weighted matrix ranks design candidates; it does not approve launch.

If credible first-party evidence and later tests raise Railway safety from 1 to
4 and simplicity from 2 to 4 without new costs, its score becomes **3.90** and it
would beat GCP. Render under the same changes becomes **3.65**. That is a valid
reason to reopen the decision. Merely changing Railway cost from 4 to 5 yields
2.70, still below GCP and still gated. At growth, increased Railway CPU/RAM or
archive volume can erase savings; Render can be cheaper but remains gated.
NAT metering, dedicated gateway billing, extra verifier compute, staging and
database size are more influential than 1,000 vs 10,000 appointments alone.

## Risks, limitations and stop conditions

This is static architecture research with official web price checks, not a live
provider capability test or invoice. Search-index extracts supplied Render prices
where its dynamic pricing page did not render tables; Railway pricing page and
docs disagree on exact per-second volume normalization. Both limitations are
recorded in sources/costs. No account, quota, paid support tier, region SLA or
customer-data residency decision was verified. Marketing availability targets
are not an end-to-end reliability guarantee.

Single-zone fail-stop is intentional; none of these budgets promises HA,
automatic failover, zero loss, exactly-once external effects or safe-write RTO.
If commercial availability expectations require HA or permanent staging, reprice
and redesign before launch. An owner who controls both custody roots remains a
shared ultimate authority. Unknown platform evidence, missing archive/index
proof, lost response, expired grant, unclosed commercial token fence or budget
shutdown leaves dispatch inert. Keep PR16/18 Draft/unmerged, original owner
profiles and historical uncertainty untouched.

Next reviewer instructions: [independent Claude handoff](CLAUDE-HANDOFF.md).
