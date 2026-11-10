# Multi-Business Meta Onboarding Architecture

**Design only, 2026-11-09 America/Mexico_City.** Codex proposal for Claude review;
no Embedded Signup implementation, provider access or commercial activation.
This reconciles ADR-005's per-business WABA/number requirement with the accepted
application and the owner's explicit multi-business requirement.

## 1. Ownership contract

Juanita's Nail Salon, Bernard's Grooming and each future subscribing business
retain **their own Meta Business Portfolio, WhatsApp Business Account and business
phone number**, controlled by that business's authorized administrators. NukMiris
owns its platform/developer app and scheduling software, not every customer's WABA.
Connection is delegated, scoped authorization; it is not an asset transfer.

| Asset / charge | Juanita | Bernard | NukMiris |
|---|---|---|---|
| Portfolio, WABA, number and business profile |Business-owned assets and admins |Separate business-owned assets and admins |Authorized application/partner access only |
| Platform Meta app / Embedded Signup configuration |Authorizes relevant assets |Authorizes relevant assets |Platform-controlled, reviewed app/configuration |
| Calendar authorization |Juanita's grant and calendar rights |Bernard's grant and calendar rights |Separate Google OAuth custody; Meta signup does not grant Calendar access |
| Meta usage/payment arrangement |Its explicitly selected supported arrangement |Its own arrangement |No assumed right to charge/pay every business's Meta bill |
| NukMiris subscription |Business's separate contract/invoice |Business's separate contract/invoice |Later commercial billing, distinct from Meta charges |

B2's controlled NukMiris-owned Meta test-number setup is a **test exception**, not
the future ownership model. No migration of v0.8.1 assets, owner numbers, Ana's
protected data or existing Windows fixtures is proposed.

Before B2, enforce the owner's private, versioned allowlist of inbound subjects,
outbound recipients, WABA/receiving-number and Calendar assets at admission **and**
the gateway. Do not learn new authorized recipients from incoming traffic. An
unapproved sender must not trigger a greeting, booking, template or automated
reply. Test bypasses through receipts, retries and every message purpose. Keep
the actual phone identities/configuration out of GitHub; broadening needs further
owner approval. No such real-identity allowlist is configured in this task.

## 2. Primary-source verification and limits

Meta's [official partner page](https://business.whatsapp.com/partners/become-a-partner)
(redirects to WhatsApp's current business site) distinguishes Tech Provider,
Tech Partner and Solution Partner, supports Embedded Signup, and restricts shared
credit-line billing to Solution Partners. This supports the intended provider
path, not proof NukMiris currently holds the required status or approvals.

Meta's [official Postman Embedded Signup collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup)
describes hosted business onboarding, SDK/login integration and App Review /
Advanced Access for business and WhatsApp account management. Indexed official
collection text was readable, but its live page returned a JavaScript shell;
the detailed current implementation must be revalidated.

The current Meta developer overview, Tech Provider onboarding and Business App
onboarding pages returned **HTTP429** during this task. We did not use third-party
mirrors to certify current token lifetime, required signup version, supported
countries, account eligibility, exact scopes, coexistence restrictions or revocation
semantics. Those remain explicit verification gates. See the source register.

Meta's [September2025 announcement](https://about.fb.com/news/2025/09/bringing-new-tools-to-help-businesses-boost-engagement-customer-support-and-discoverability/)
confirms that businesses can use the Business App and Platform together with the
same number. It does **not** establish eligibility for every number or current
country/version/history/echo behavior. Design accommodates eligible coexistence;
do not promise universal migration-free onboarding.

## 3. Future authorization and connection flow

This is a proposed application security flow, not a claim these steps are already
implemented or every Meta detail has been independently approved.

1. **Platform prerequisites.** Establish the NukMiris business/app owner, business
   verification and required Tech Provider/access-verification path. Configure the
   appropriate Facebook Login for Business / Embedded Signup use case, exact
   approved domains/redirects, privacy policy, deletion callback, secure webhook,
   required App Review/Advanced Access and current version. Candidate permissions
   include `whatsapp_business_management`, `whatsapp_business_messaging`, and
   `business_management` only where the current approved flow requires it. Verify
   each scope and approval in first-party documentation/dashboard; do not request
   broad unrelated access or infer approval from a working self-owned test app.
2. **Authenticate the business admin.** In a future authenticated owner control
   plane, prove the operator's role for exactly one NukMiris business. Generate a
   short-lived, one-use server-side onboarding session binding business, user,
   environment, Meta app/config version and a cryptographic state/nonce. B1 does not
   implement commercial admin screens or expose `/api/session` as owner auth.
3. **Business chooses assets.** Launch Meta's hosted flow. The business admin
   selects/creates **its** portfolio/WABA and verifies authority over **its** number
   through Meta's supported process. Never force the NukMiris portfolio. Record
   whether additional business verification, display-name, number, payment or
   eligibility steps remain pending; do not label all customers verified because
   NukMiris's app was reviewed.
4. **Validate callback.** Accept only an exact allowlisted Meta SDK origin and
   valid expected message type/session; bind the authorization code to server state,
   expiry and one-time use. Never treat browser-returned WABA/phone IDs or a posted
   businessId as proof of ownership. Exchange code server-side using the correct
   app credentials over TLS; no token in URL, frontend storage or logs. Exact current
   code exchange/version/token type must be verified before implementation.
5. **Prove grant and ownership.** Use the returned authorized credential to verify
   token app/audience, actual scopes, accessible assets and owning portfolio, WABA
   and number relationship. Resolve duplicate/previously bound numbers through a
   safe audited procedure, never last-write-wins. A partially completed flow stays
   PENDING, without sending rights. Business integration/system-user tokens are
   candidates subject to the verified flow; **no non-expiring-token assumption**.
6. **Persist connection transactionally.** Store encrypted credential plus metadata;
   create an immutable/versioned provider connection and server route. Bind the
   correct app/environment/tenant, grant revision and WABA/phone. Subscribe the
   reviewed app to that WABA and register/verify the number only through Meta's
   supported procedures. Handle each partial completion idempotently under the
   original onboarding session/connection identity; no blind repeated side effects.
7. **Activate only through gates.** Connection readiness includes tenant-specific
   template/consent/payment/health state, verified receiving route and explicit
   owner-approved sending scope. Test reception and controlled sends using approved
   identities before any wider activation. Show pending/error/disconnected state
   honestly; do not automatically message customers while setup is incomplete.

## 4. Data contracts B1 must accommodate

These are logical fields/interfaces for review, **not migrations in this package**.
Keep current immutable business/channel/operation identities and composite tenant
constraints. Customer onboarding is later; do not hardcode global platform assets now.

| Logical record | Required fields / invariant |
|---|---|
| Provider connection |Opaque connectionId + businessId, provider, environment, platform appId, external portfolio/WABA/phone IDs, status and mapping revision; ownership/grant verification provenance |
| Authorized grant/credential |Connection/business/app binding, credential type/version and encrypted material reference, exact scopes, granted/expiry/revoked/last-verified metadata, key version and refresh/reauthorization policy where supported |
| Active route |Server-owned app/environment + WABA/receiving-number → **one** current business/channel/connection; ambiguous or unknown routes fail closed. Do not weaken existing unique WABA/number ownership merely to support more apps |
| Onboarding session |Authenticated business admin, app/config/API version, nonce/state hash, expiry, single-use code/session disposition and original connection allocation |
| WABA template/health |Actual connection/WABA, language/category/version/approval, opt-in/permission head and health/error revision; never borrow another WABA's template approval |
| Connection audit |Append-only ownership/authorization/change/revocation evidence, actor/time/reason, old/new mapping/grant revisions; no raw secret/token |
| Billing arrangement |Business/direct-Meta or specifically approved partner arrangement; partner/credit-line references only if supported; separate NukMiris subscription record |

One business can eventually have multiple authorized connections; the provider
port must not embed a singleton WABA/token. Environment/app context is explicit.
Connection reassignment cannot rewrite old seals or bookings: retain history,
tombstones and revision checks. Stale/never-entered work may safely expire under
existing rules; entered/UNKNOWN work remains protected, not reissued to a new grant.
Opaque provider IDs are not canonical NukMiris tenant IDs. A validated canonical
projection keeps real provider fields out of the sealed-body tenant alias trap;
the original signed raw bytes stay in separately restricted custody.

## 5. Secure inbound and outbound tenant routing

- Choose a **known platform app** from the configured webhook endpoint/context;
  validate HMAC over the exact raw body with its app secret before trusting fields.
  The webhook verify token, app secret and sending token are separate purposes.
- Validate object/schema/limits, then require both `entry.id` (WABA) and receiving
  `metadata.phone_number_id` to match a current authorized server binding for that
  app/environment. Customer `from`, display phone, browser tenantId, query parameters
  or an ID prefix are never tenant authorization. A signature authenticates the
  Meta app message, not permission to select an arbitrary NukMiris business.
- A webhook may contain multiple businesses. Partition under authenticated routes,
  apply withdrawal/suppression correctly, retain separately scoped raw custody and
  per-tenant evidence, and withhold ACK until all required custody is complete.
  Redelivery reuses original provider/input/action identities; conflicting duplicate
  content or missing binding is held, never routed to the first/default business.
- Before effects, independently bind ticket tenant/channel/WABA/phone/recipient/
  credential revision and current permission/status. Gateway uses stored trusted
  asset identifiers and an allowlisted provider host, never a caller-controlled URL.
  Unknown status/receipt correlation is evidence for inspection, not confirmation.

Current app has route checks, business-scoped subjects/constraints and archive
facades, but its receipt/text envelope is synthetic. Full interactive/status/echo
normalization, webhook control verification and current Meta correlation are later
adapter work. Same signing app or shared runtime does not prove tenant isolation.

## 6. Credential isolation and epoch-fence compatibility

Store each business grant encrypted in PostgreSQL with business/connection/app/
environment/credential-version authenticated encryption context. Keep sending-token
decrypt permission only in the gateway identity, outside worker/ingress/result/
restore/CI. The future onboarding controller can receive, validate and encrypt a
new credential without retrieving every existing tenant secret. Platform app-secret
signature verification and server code exchange have separately scoped authority.

Use least privilege, bounded plaintext cache, explicit expiry/invalid-token holds,
rotation and prompt revocation detection. Never log tokens or store one global
NukMiris sending token for all customers. Rotation cannot automatically resend
an uncertain attempt. Metadata and grant/mapping revisions prevent using stale
credentials for newly authorized work. Test wrong-tenant ciphertext, moved asset,
wrong app/scope, expiry/revocation and partially rotated credentials.

**Important unresolved compatibility:** ADR requires fresh independently revocable
A/B system-user credentials by deployment epoch. Future business integration
grants from Embedded Signup might not support that exact parallel/revocation
model. Verify token independence, asset access, old-token revocation/noninterference
and worst-case latency using the actual approved flow before commercial activation.
Do not revoke every customer's business authorization on each release; do not force
their WABAs into NukMiris ownership to make fencing convenient. Preserve platform
termination/network and current-authority gates; any change to the mandatory Meta
credential layer requires documented ADR/independent review and owner disposition.
B2 self-owned A/B test evidence cannot certify this commercial grant model.

Key erasure must include recoverable wrapped data keys and retained backups.
One global wrapping key plus deletion of a credential row cannot selectively erase
that tenant's historical ciphertext. Define tenant/subject key boundaries, retained
versions, recovery obligations and destruction approval before immutable retention.

## 7. Business separation, charges and existing numbers

Business isolation covers conversations, displayed action IDs/revisions, customers,
appointments/protections, employee/calendar mapping, reminders/templates, support
records, credentials and audit/export—not just inbound messages. RLS/composite FKs
help, but a broadly authorized shared service remains a trusted cross-business
boundary. Runtime identity and server-validated capabilities are also required.
Prove same customer phone used at both businesses stays two scoped relationships;
wrong credential/template/calendar/employee or action never causes cross-business
effects. B1 cloud testing uses synthetic equivalents and does not prove a live WABA.

**Billing:** prefer business-paid Meta usage through its supported payment setup.
NukMiris separately invoices its subscription later. A Solution Partner's approved
shared credit line is another possible arrangement, subject to partner eligibility,
contracts/credit risk and explicit business choice. Tech Provider status alone
does not authorize extending that line, paying every account or automatically
collecting Meta fees. Meta pricing/categories/rates must be verified for destination
market and account before quoting; this document adds no messaging rate assumption.

**Existing Business App numbers:** offer eligible Meta-supported coexistence as a
future path; distinguish it from API-only migration of an existing API number or
new-number onboarding. Current eligibility, app/version/country requirements,
supported message/history/echo features, linked-device behavior, quality/limits,
template/24-hour-window interactions and disconnect behavior need primary-source
and controlled-asset tests. Consumer WhatsApp is not assumed eligible. Never tell
a business to delete/unregister its mobile account, transfer number/portfolio,
discard history or disable2FA to bypass signup eligibility. If unsupported, explain
alternatives and require an approved migration/backup/downtime/rollback plan.
History/echo events are not automatically new booking commands or evidence that a
bot sent a message; manual app sends and Calendar edits can create distinct safety
constraints. No history import or coexistence integration is implemented now.

## 8. Disconnection and offboarding

An authenticated business admin can request disconnection and can revoke NukMiris
authorization through Meta's supported controls. Plan: persist disabled connection
and increment mapping/grant/permission revisions; stop new automated work and fence
in-flight authority; retain unresolved UNKNOWN and appointment protections; revoke
only the appropriate NukMiris access and unsubscribe its app where supported.
The business keeps its portfolio/WABA/phone/admins—do not delete those assets.

Provide export/deletion/retention according to reviewed policy and account for
backups and legally required evidence. Removing a UI connection is not proof all
tokens are revoked. Verify continued business ownership/access and revocation
noninterference; handle provider-first revocation and partial failures safely.
Do not promise chat-history portability, immediate API→mobile reversal or instant
number migration until tested under Meta's current procedures. Subscription
cancellation, Meta billing and platform disconnection are separate recorded events.

## 9. Traceability: current support, B1 accommodations, deferred delivery

| Requirement / register link | Accepted baseline support | B1 architecture accommodation / test | Deferred until separately approved |
|---|---|---|---|
| Business-owned portfolios/WABAs/numbers; NM-019 |`core.channel` supports per-business WABA/number, unique pair; no asset ownership onboarding |No platform-WABA singleton; connection/app/env/owner provenance contract; two independently configured synthetic routes |Business verification, ownership proof via actual Meta APIs and signup |
| Embedded Signup |None |Control-plane/session/grant interface and independent role design; no signup endpoint |Tech Provider/app approvals, SDK/code exchange and self-service UI |
| Tenant routing; NM-042 |`admit-input.ts`, canonical tenants, scoped custody and composite FKs |App-bound HMAC→WABA/number mapping; mixed-tenant redelivery/STOP and no fallback tests |Actual Meta interactive/status/echo schemas and hosted webhook B2 tests |
| Credential separation; NM-015/023 |Synthetic-only ports, no real tokens |Per-connection encrypted credential references, gateway-only decrypt; rotate/revoke/restore denial with fake grants |Real token lifetime/scope, A/B versus business-grant compatibility and revocation latency |
| Data isolation; NM-012/019/028/034/035 |Scoped app/SQL/archive and local synthetic personas |Hostile cross-business actions, appointments, customers, employees/calendar/template/grants, exports and role tests |Commercial business-owner/staff authorization, dashboard/inbox and customer controls |
| Templates/consent/reminders; NM-017/018/019/020/026 |Core permission/status and synthetic purpose/time protections; no real reminder delivery |Connection/WABA-scoped readiness and consent/audit contracts; no cross-WABA reuse |Current policy/legal evidence and separately enabled real reminders |
| Billing ownership |None |Separate Meta payer-arrangement metadata from platform subscription; no assumed credit line |Commercial subscriptions, partner billing arrangements and actual provider costs |
| Existing numbers/coexistence |No production coexistence or history import |Capability/version fields and distinct event provenance; never force deregistration |Eligibility/migration/echo/history tests and explicit activation approval |
| Offboarding; NM-023/028/039 |Status/permission revisions, protected UNKNOWN and inert restore |Disconnect state invalidates future work without erasing original facts; fake revoked/moved binding tests |Meta-supported unsubscribe/revocation, business export/deletion workflow |
| Customer-name confirmation |Conservative parser only; local residual accepted |Keep the real-pilot gate explicit and design transactional confirmation binding |**Mandatory implementation/review before any real WhatsApp pilot/B2** |

These contracts fit ADR-005's modular core, sealer and gateway. B1 needs explicit
interfaces/identity/data boundaries, not commercial onboarding screens or one
cloud project per subscriber. No assertion that synthetic routing proves real
ownership, permissions, billing, coexistence or revocation. Claude must review
both this design and its unverified first-party detail before downstream approval.
