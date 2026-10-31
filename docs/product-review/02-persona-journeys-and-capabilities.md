# NukMiris — Persona-Based User Journeys & Capability Validation
**Draft 1 — 2026-10-30; updated 2026-10-31** | **Status:** STEP 2A CLOSED — 37/37 scenarios owner-approved (2026-10-31)  
**Purpose:** End-to-end functional blueprint and review gate before commercial MVP implementation roadmap.  
**Companion:** [Decision reconciliation](01-decision-reconciliation.md).  
**Evidence:** Owner Decisions 1–178, with later amendments; v0.8.1 baseline in `main` and prior architecture challenge. **Design intent, not proof of implemented behavior.**  
**Review key:** ☐ Pending · ✓ Approved · Δ Revise · — Not applicable.  
**Stage:** P0 = preserved v0.8.1 customer UX and safety; MVP = new commercial capabilities.

## Personas and boundaries
| Persona | May do | Important boundary |
|---|---|---|
| Customer (Alberto) | Book one service per appointment, see/reschedule/cancel own appointments, manage per-business reminder consent, accept waitlist offers, use ordinary human chat | Never another customer's bookings; inbound phone identity scoped to business |
| Owner (Juanita) | Configure business, services/staff/working hours; book/edit/cancel in NukMiris or Google; handle customer permissions; view metrics and incidents | Manual overlap possible, never destructive automatic resolution |
| Manager | Manage operations under assigned role permissions | Sensitive changes audited; no automatic global platform access |
| Receptionist | Find customers, book/edit, authorize conflict override if booking permission | Access limited to business/location entitlements |
| Employee (María) | See assigned schedule in restricted view, existing Google access; may book if explicit permission | No unrestricted customer or billing administration |
| NukMiris Admin | Internal tenant support, operational monitoring, authorized recovery and billing support | Individual MFA, strong access/audit; no unauthorized silent fixes |

## Persona-based scenario inventory
| ID | Persona | Scenario | Stage | Decision refs | Review |
|---|---|---|---|---|---|
| C01 | Customer | New appointment via `cita`, one service; collect new customer's name after slot selection; ask reminder consent when unknown | P0+MVP | 19, 30/147, 140–146, 155–161 | ✓ Revised workflow approved 2026-10-31 |
| C02 | Customer | Existing appointment shown on `menu` | P0+MVP | 65, 148 | ✓ Approved 2026-10-30 |
| C03 | Customer | Reschedule existing appointment | P0+MVP | 63, 149 | ✓ Approved 2026-10-30 |
| C04 | Customer | Cancel existing appointment | P0+MVP | 64, 150 | ✓ Approved 2026-10-30 |
| C05 | Customer | All requested slots unavailable; more choices/waitlist | MVP | 31, 33, 68–73, 141 | ✓ Approved 2026-10-30 |
| C06 | Customer | Past employee preference vs available alternatives | MVP | 21, 142–146 | ✓ Approved 2026-10-30 |
| C07 | Customer | Appointment reminders and 1-day confirmation | P0+MVP | 36–38 | ✓ Approved 2026-10-30 |
| C08 | Customer | `permisos`: view, enable, disable, restore consent | MVP | 19, 158–161 | ✓ Approved 2026-10-30 |
| C09 | Customer | Imported customer's first inbound; migration-intro flag independent of consent; direct commands uninterrupted | MVP | 148, 158–161, 178 | ✓ Approved with revision 2026-10-30 |
| C10 | Customer | Normal chat and human assistance | P0+MVP | 41–45, 121 | ✓ Approved 2026-10-30 |
| C11 | Customer | Staff-initiated employee reassignment | MVP | 22–23 | ✓ Approved 2026-10-30 |
| C12 | Customer | Optional authorized attendance-and-feedback question; customer-reported attendance or absence; no reply leaves attendance unverified | MVP | 35, 75–77, 168 | ✓ Approved with revision 2026-10-30; template eligibility to verify |
| O01 | Owner | Create business, connect WhatsApp and Google Calendar | MVP | 52–54, 116 | ✓ Approved 2026-10-30 |
| O02 | Owner | Import calendar customer history 3/6/12 months | MVP | 20, 54, 178 | ✓ Approved 2026-10-30 |
| O03 | Owner | Configure services, employee qualifications/hours | MVP | 28–29, 133–139 | ✓ Revised workflow approved 2026-10-31 |
| O04 | Owner | Google Calendar-first manual booking; NukMiris alternative | MVP | 151–157, 177 | ✓ Revised workflow approved 2026-10-31 |
| O05 | Owner | Create event in Google without phone | MVP | 54, 93, 177 | ✓ Approved 2026-10-31 |
| O06 | Owner | Reschedule/modify service through dashboard | MVP | 154, 170–172 | ✓ Approved 2026-10-31 |
| O07 | Owner | Modify managed appointment in Google | MVP | 91, 173–174 | ✓ Approved 2026-10-31 |
| O08 | Owner | Delete managed Google Calendar event | MVP | 92; 175 withdrawn | ✓ Approved 2026-10-31 |
| O09 | Owner | Manually overlap employee appointments | MVP | 172, 176 | ✓ Approved 2026-10-31 |
| O10 | Owner | Manage no-show and auto-complete | MVP | 34–35, 168–169 | ✓ Approved 2026-10-31 |
| O11 | Owner | Daily combined calendar, filters, Needs Attention | MVP | 39, 153, 167 | ✓ Approved 2026-10-31 |
| O12 | Owner | Record consent in person and start authorized messaging | MVP | 155–157 | ✓ Revised workflow approved 2026-10-31 |
| O13 | Owner | Change customer's WhatsApp phone number | MVP | 162–165 | ✓ Approved 2026-10-31 |
| O14 | Owner | Closures, staff absences and breaks | MVP | 24–27, 134–138 | ✓ Approved 2026-10-31 |
| O15 | Owner | Business with multiple locations | MVP | 58–60 | ✓ Approved 2026-10-31 |
| O16 | Owner | Review reports, customer export and deletion | MVP | 77–81 | ✓ Approved 2026-10-31 |
| S01 | Manager/Receptionist | Search customer and manage bookings | MVP | 151–154, 164–165 | ✓ Approved 2026-10-31 |
| S02 | Employee | Restricted own schedule and permitted booking | MVP | 55–57, 176 | ✓ Approved 2026-10-31 |
| S03 | Owner | Invite/revoke staff and manage role | MVP | 55–57, 131–132 | ✓ Approved 2026-10-31 |
| A01 | Platform Admin | Integration down, alerts and safe recovery | P0+MVP | 83–90, 97–110 | ✓ Approved 2026-10-31 |
| A02 | Platform Admin | Human support tickets and knowledge base | MVP | 120–127 | ✓ Approved 2026-10-31 |
| A03 | Platform Admin | Tenant-level administrative access and audit | MVP | 127–130 | ✓ Approved 2026-10-31 |
| B01 | Owner | Trial, subscription, spend cap, failed payment | MVP | 47–51 | ✓ Approved 2026-10-31 |
| B02 | Owner | Subscription cancellation, export and retention | MVP | 12–13, 80–82 | ✓ Approved 2026-10-31 |
| P01 | Platform/Owner | Pre-pilot readiness, evidence and approval | MVP→pilot | 110–119 | ✓ Approved 2026-10-31 |

## Detailed review tables — core journeys

### C01. Customer books one appointment
| Step | Customer Alberto | NukMiris / integrations | Owner/employee |
|---|---|---|---|
| 1 | Sends `cita` or chooses existing booking command | Authenticate inbound WhatsApp business/customer; do not seize unrelated chats | No intervention |
| 2 | Chooses service where business has a service choice | Validate service and one-service-per-appointment rule; duration+buffer, qualified staff | Service catalog maintained in dashboard |
| 3 | For returning customer, may favor last completed same-service employee; first-time customer assigned randomly if no preference | Verify eligible employee and calendar blocks; preserve choice logic of Decisions 143–146 | No intervention |
| 4 | Sees next **two** available slots, requests more if needed; no unapproved date-first redesign | Compute per-employee availability, calendar busy intervals, hours, closure, buffer, horizon | Existing events block time |
| 5 | Chooses preferred date/time. **If new customer**, then provides their name after slot selection; returning customers skip name collection when verified | Use authenticated sender number, collect name only for new customer, preserve chosen slot context; do not commit before booking confirmation | None |
| 6 | Confirms the booking according to existing v0.8.1 flow | Protect chosen slot, safely write event to Google Calendar, reconcile uncertain outcome | Appointment visible on shared Google Calendar and NukMiris dashboard |
| 7 | Receives booking confirmation | Persist verified appointment identity/status. If reminder permission is valid, schedule enabled reminders; if declined, do not prompt again | Sees assigned employee and appointment |
| 8 | **Only when reminder permission is unknown:** sees an explicit optional Accept/Decline reminder-consent question after the booking confirmation; can also ignore it | Save affirmative consent durably before enabling still-eligible reminders. Decline/silence leaves appointment booked without reminders. Keep this distinct from permission for the current customer-initiated response | No extra task merely due to unknown consent |
**Owner review (2026-10-30):** C01 initially marked **Revise**. Explicit change request: *new customer name is requested only after customer selects the date/time; after successful booking confirmation, if reminder consent is unclear, ask for permission*. **Owner explicitly approved the updated flow 2026-10-31.** C02, C03 and C04 approved. **Exceptions:** slot taken after offer; calendar unavailable; uncertain create; duplicate inbound; declined/unknown consent; multiple existing bookings limit. Never claim success or release protected slot on uncertainty.

### C03. Customer reschedules
| Step | Customer | NukMiris | Owner |
|---|---|---|---|
| 1 | Sends `reagendar` / uses existing menu | Shows own future appointments using preserved v0.8.1 selector adapted for multiples | None |
| 2 | Chooses appointment and new offered slot | Availability + horizon + booking constraints; reschedule until start | None |
| 3 | Confirms the change | Safely mutate *same managed appointment*, suppress obsolete reminders, schedule new eligible ones | Updated calendar time |
| 4 | Receives response only after verified result | Quarantine uncertain state; no false success | Needs Attention if unresolved |

### C04. Customer cancels
| Step | Customer | NukMiris | Owner |
|---|---|---|---|
| 1 | Sends `cancelar` | Identifies customer's future appointments; preserve existing selector | None |
| 2 | Chooses and confirms cancellation | Safe Google change, suppress reminders, journal cancellation | Calendar freed only after verified completion |
| 3 | Receives verified confirmation | Optional waiting-list offers after confirmed release | Can inspect cancellation history |

### C08. Customer manages reminders
| Step | Customer | NukMiris | Owner |
|---|---|---|---|
| 1 | Types `permisos` or selects Administrar permisos | Displays **current consent for this business** | No action |
| 2 | Chooses Activar or Desactivar | Records scope/evidence/actor/time; never auto-restore prior opt-out | Permission view updated |
| 3 | Receives concise new-status confirmation | Opt-out suppresses all pending reminders immediately; opt-in schedules still-eligible future reminders for existing appointments | No unnecessary alert |
| 4 | Returns to menu | Preserve existing appointment UX | None |
**Exception:** failed permission commit means no false success; conservatively suppress disputed sends.

### C09 + O02. Imported existing customer first message
| Step | Juanita | NukMiris | Customer |
|---|---|---|---|
| 1 | Selects 3, 6 or 12 months of history; default six; future entries always included | Scans authorized Google events, detects name/phone patterns, normalizes numbers | None |
| 2 | Reviews ambiguous matches and import preview | Creates approved business-scoped candidate profiles; unverified event/number stays unmanaged | None |
| 3 | No mass outbound consent requests | Imported permissions are **unknown** unless evidenced; imported events still block availability | None |
| 4 | None | On first eligible customer-initiated chat after activation, greet once, explain `menu`/`cita` and offer reminder permission if unknown, without hijacking explicit commands | Sends `hola` or `cita` |
| 5 | No manual action unless ambiguity | Record explicit consent decision; if declined/no response continue booking/chat without reminders | May accept, decline, or book directly |
**Critical note:** Phone match from event text is not automatically verified WhatsApp identity. Never reveal past appointments on an ambiguous match.

**Current controlling O04 approval:** The consolidated 2026-10-31 Google Calendar-first journey below supersedes the original dashboard-first detailed example. The dashboard flow here is a supported *secondary* alternative, not the primary process.

### O04. Owner creates appointment through NukMiris calendar — secondary pathway
| Step | Owner/authorized staff | NukMiris | Customer |
|---|---|---|---|
| 1 | Open mobile daily or combined employee calendar; choose slot | Employee filters, visible statuses | None |
| 2 | Search existing customer by partial name/number or create profile; **WhatsApp number required** | Normalize and exact-match numbers within business | None |
| 3 | Select service, assigned employee | Validate duration/qualification/hours; show manual conflict warning but allow booked-role override | None |
| 4 | Confirm | Persist and safely synchronize; mark uncertain if provider outcome unknown | None |
| 5 | Where customer consent exists, send appointment details; if new permission verbally obtained, staff records consent and audit | Confirmation and reminders based on respective permission scopes | Receives authorized notice and optional reminder choice |
**Exception:** No phone → staff may instead create an unmanaged Google Calendar entry; never fabricate customer identity.

### O05. Google event without phone
| Step | Owner | NukMiris | Customer |
|---|---|---|---|
| 1 | Creates Google event e.g. "Carolina manicure", no phone | Read event as busy block for associated employee/calendar | None |
| 2 | Optionally edits event later | Remains **unmanaged** unless identity and details validated | No WhatsApp messages |
| 3 | Continues ordinary calendar work | Do not auto-create Needs Attention solely for missing number | None |

### O07. Owner changes appointment directly in Google
| Step | Owner | NukMiris | Customer |
|---|---|---|---|
| 1 | Edits time/date/service of managed event | Detect verified event version; recalculate availability promptly | No message yet |
| 2 | Makes another edit soon after | Short coalescing window (candidate 60 seconds) for **notifications only**, not availability | No duplicate interim notice |
| 3 | Stops editing | Once final verified state established, send authorized approved template for consequential change | Receives one accurate update |
| 4 | If changing employee | Must obtain customer approval before treating reassignment as final | Approves or retains original assignment |
**Exception:** ambiguous event changes or provider uncertainty → protect, Needs Attention, no misleading outbound notice.

### O08. Google Calendar deletion of managed event
| Step | Owner | NukMiris | Customer |
|---|---|---|---|
| 1 | Deletes managed event | Treat disappearance as uncertain until verified; protect slot and managed appointment | No cancellation message |
| 2 | Reviews Needs Attention | Ask cancel or restore; distinguish accidental/intentional deletion | Still has booked appointment pending determination |
| 3 | Explicitly confirms cancellation/restore | Perform verified outcome; notification only after confirmed cancellation where authorized | Receives accurate notice if cancelled |
**Authority:** Decision 92. Decision 175 was withdrawn.

### O09. Manual overlap
| Step | Staff | NukMiris | Customer |
|---|---|---|---|
| 1 | Books overlapping slot in Google Calendar | Accept as manual origin; keep both busy blocks | No auto cancellation |
| 2 | Or books overlap through dashboard | Display warning; all staff with booking permission may acknowledge and proceed | Receives notice only if authorized |
| 3 | Later customer requests same slot via WhatsApp | Do **not** offer occupied employee time | Cannot create competing automated booking |

### O10. No-show / automatic completion
| Step | Staff | NukMiris | Customer |
|---|---|---|---|
| 1 | Opens calendar quick action or appointment details | Permit marking No asistió after scheduled start | No automatic penalty |
| 2 | No action on ordinary appointment | After end mark Automatically Completed; **not verified attended** | No required action |
| 3 | Corrects mistaken No-show | Audit correction | No automatic unsolicited notice |

### O13. Change WhatsApp number
| Step | Staff Juanita | NukMiris | Customer Alberto |
|---|---|---|---|
| 1 | Enters new WhatsApp number on existing profile | Mark pending; avoid leaking appointment details | Opens QR/link on new number |
| 2 | Verifies customer's identity in person | Confirm inbound number control and staff approval; reject conflicting existing profile number | Confirms number-change intent |
| 3 | Approves change | Preserve existing appointments/history, stop old-number sends | Explicitly opts in/out for messages on new number |
| 4 | Finalize | Begin new-number messages only with valid permission; audit change | Gets final confirmation |
**Guard:** Old-number permission does not automatically transfer.

### A01. Integration disconnected/uncertain send
| Step | Platform/admin | NukMiris | Owner/customer |
|---|---|---|---|
| 1 | Detect Google or WhatsApp disconnection | Pause only affected automated effects; protect in-flight operations; alert owner | Owner sees actionable reconnect item |
| 2 | Investigate | Reconcile unknown Calendar outcomes **read-only**; unknown WhatsApp delivery must never be blindly resent | Customer never receives fabricated success |
| 3 | Reauthorize/recover | Validate permissions, token, durable journal, stale worker fencing and permission lock before resume | Owner receives meaningful recovery notice when warranted |

### B01. Trial / subscription
| Step | Owner | NukMiris | Admin |
|---|---|---|---|
| 1 | Starts 30-day trial without payment method | Enforce trial allowance and visibility | Can support setup |
| 2 | Selects monthly subscription | Count provider usage; included messages + disclosed overage + cap | Billing/provider configuration still to be decided |
| 3 | Payment fails | 7-day grace, reminders and controlled suspension without data loss | Handles support issues |
| 4 | Cancels | Controlled export/read-only period under approved retention policy | Audit offboarding |

## Core process diagrams

### Customer booking and calendar visibility
```mermaid
flowchart TD
  A["Customer sends cita"] --> B["Identify customer and business"]
  B --> C["Choose one service"]
  C --> D["Eligible employee and available slots"]
  D --> E["Show two options / more"]
  E --> F["Customer confirms"]
  F --> G{"Calendar result verified?"}
  G -->|Yes| H["Record managed booking"]
  G -->|Unknown| I["Protect slot / Needs Attention"]
  H --> J["Customer booking confirmation"]
  H --> K["Owner sees Google Calendar event"]
  H --> L{"Reminder permission?"}
  L -->|Valid| M["Schedule enabled reminders"]
  L -->|Unknown or declined| N["No reminder sends"]
```

### Customer import and first contact
```mermaid
flowchart TD
  A["Owner selects 3/6/12 month lookback"] --> B["Scan past and future Google events"]
  B --> C{"Reliable name + phone?"}
  C -->|No| D["Keep unmanaged busy block"]
  C -->|Candidate| E["Owner reviews ambiguous match"]
  E --> F["Create or reuse business customer profile"]
  F --> G["Reminder consent unknown unless evidenced"]
  G --> H{"Customer initiates WhatsApp chat?"}
  H -->|No| I["No unsolicited consent request"]
  H -->|Yes| J["One-time introduction; respect direct commands"]
  J --> K{"Explicit reminder opt-in?"}
  K -->|Yes| L["Enable future eligible reminders"]
  K -->|No or silence| M["Keep reminders disabled"]
```

### Google deletion: preserve Decision 92
```mermaid
flowchart TD
  A["Managed Google event disappears"] --> B["Verify source and preserve slot"]
  B --> C["Needs Attention: owner decision"]
  C --> D{"Owner confirms"}
  D -->|Cancel| E["Verified cancellation + authorized notice"]
  D -->|Restore| F["Safe controlled restoration"]
  D -->|No decision| G["Continue holding / investigation"]
```

## First-pass critical gaps to validate (NOT pre-approved)
| Gap ID | Observation | Needed later |
|---|---|---|
| G-01 | WhatsApp Business App/API coexistence, existing human chats and first-contact routing are provider-dependent | Real Meta feasibility/protocol tests before promising rollout |
| G-02 | Calendar-import pattern extraction may associate wrong names/numbers | Preview, provenance, identity validation, and privacy tests |
| G-03 | Some historical conversations may contain consent evidence but not be accessible/authoritative | Manual proof workflow, conservative unknown state |
| G-04 | Billing provider, invoice/tax treatment for initial LATAM market not yet selected | Commercial MVP owner/provider design decision |
| G-05 | End-to-end onboarding readiness checklist and failure-recovery UX not consolidated | Journey-level signoff before external onboarding |
| G-06 | External pilot thresholds and rollback/support staffing not numerically approved | Launch acceptance plan and owner approval |
| G-07 | Distinguish special calendar changes from customer-approved reassignment | Proof of safe policy and truthful messages |
| G-08 | Complete verification against every source decision and actual v0.8.1 UX remains | Decision-by-decision source crosscheck and regression inventory |

## Owner review rubric
For each scenario mark **Approved / Revise / Not applicable** and record: expected user-facing text; integration effects; what happens on uncertainty; customer permission; employee/resource impact; operational owner alerts; non-goals. Use the exact current v0.8.1 prompts/buttons for P0 parity. Do not add alternate booking selectors, multiple services per appointment, AI support workflow or speculative CRM fields.

## Gate and next actions
1. Owner reviews the scenario inventory by persona and signs off corrections in batches.
2. Reconcile every scenario with individual decisions and v0.8.1 accepted tests; convert ambiguous entries into traceable gap tickets rather than guessing.
3. Resolve launch-critical G-issues only; codify exact requirements and acceptance scenarios.
4. Codex proposes stages P0 → commercial MVP → pilot with estimates/test IDs.
5. Claude independently reviews implementation readiness, evidence and contradictions. **No code merge, deployment, provider activation or release without separate owner approval.**

## Approved owner refinements — Customer C09 and C12 (2026-10-30)

### C09 — Migration-introduction flag, distinct from consent
**Owner approved revision.** For customer profiles imported from Google Calendar history, record an explicit migration-introduction state (e.g. `migration_intro_pending`) separately from business-specific `reminder_consent` (unknown/granted/declined). When a **reliably matched** imported customer next initiates WhatsApp interaction, provide one concise introduction about `menu` and `cita`, plus an optional reminder opt-in **only if consent is unknown**. Customers not marked for migration introduction do not receive a new-feature explanation. Previously opted-out customers are not automatically re-solicited. Explicit commands such as `cita`, `reagendar`, `cancelar`, `menu`, `permisos` must be handled first, without hijacking or blocking the requested flow; any introduction is deferred to an appropriate moment. Normal human conversation must remain supported.

**Delivery invariant:** Do not mark the introduction completed merely because an outbound message was attempted; use safe verified result handling and avoid duplicate introduction sends. Customer profile import and existing WhatsApp-number matches are not evidence of consent.

| Step | Imported customer | NukMiris | Owner |
|---|---|---|---|
| 1 | Sends first WhatsApp message since migration | Checks reliable business-scoped identity and migration-intro flag | Can still chat naturally |
| 2 | If ordinary greeting, receives a one-time feature introduction; if explicit appointment command, runs requested flow first | Presents `menu`/`cita` introduction once when safe, without taking over human chat | No action |
| 3 | If consent unknown, accepts or declines reminders, or ignores question | Records explicit grant/decline only; silence stays unknown and no reminders | Consent view reflects evidence |
| 4 | Returns later | No repeated migration announcement after verified introduction; existing menu/commands work normally | No action |

### C12 — Optional post-appointment attendance and feedback
**Owner approved revision**, replacing the earlier assumption that an Automatically Completed appointment proves attendance. Following an automatically completed appointment, where a business has enabled this feature and relevant WhatsApp communication is permitted, NukMiris may send an appropriately approved transaction-specific post-appointment question such as: **“¿Qué te pareció tu servicio de [servicio]?”** with two choices **“Sí, quiero calificar”** and **“No asistí.”** Exact message type, copy and buttons require Meta eligibility/approval validation; do **not** send proactively based solely on a phone number, calendar event or an appointment's auto-completed status.

| Customer action | NukMiris action | Owner impact |
|---|---|---|
| “Sí, quiero calificar” | Records customer-*reported* attendance and opens optional 1–5 satisfaction response | Feedback appears in reports |
| “No asistí” | Records customer-*reported* nonattendance; does not request rating; marks discrepancy for staff review if needed, rather than silently overwriting verified conflicting staff state | Owner can review disagreement |
| Silence | Leaves Automatically Completed and attendance **unverified** | No fabricated attended status |
| No applicable permission/template | No proactive survey sent | No customer contact |

**Constraints:** no automatic sanctions; respect business-specific permissions and opt-outs, avoid survey spam, no selective public-review solicitation based on favorable scores. Survey content must not be bundled into an unauthorized Utility notification or inferred as covered by appointment-reminder consent without checking scope. Does not modify Decision 168's choice not to require staff positive attendance marks.

## Owner-review log
| Date | Scenario | Result | Clarification |
|---|---|---|---|
| 2026-10-30 | C01 | **Revise** | New customers: ask name after date/time selection; after confirmed booking, if reminder permission unknown, offer explicit opt-in/decline without blocking appointment |
| 2026-10-30 | C02 | **Approved** | Upcoming appointments + existing menu |
| 2026-10-30 | C03 | **Approved** | Reschedule using existing selection and safe Google synchronization |
| 2026-10-30 | C04 | **Approved** | Cancellation using existing selection and safe Google synchronization |

| 2026-10-30 | C05 | **Approved** | No availability / waiting list |
| 2026-10-30 | C06 | **Approved** | Preferred employee |
| 2026-10-30 | C07 | **Approved** | Reminders and confirmation |
| 2026-10-30 | C08 | **Approved** | Per-business reminder permission |

| 2026-10-30 | C09 | **Approved with revision** | One-time migration introduction only for flagged imported customers; consent state independent; preserve explicit commands and human chat |
| 2026-10-30 | C12 | **Approved with revision** | Optional permission-gated post-service attendance-and-feedback question; self-reported absent or rating; no reply remains unverified |

## Owner-review log — Business Owner O01–O04 and Customer C10–C11 (2026-10-30)

| Scenario | Owner review result | Detailed interpretation / next action |
|---|---|---|
| C10 | **Approved** | Preserve normal owner/customer chat, explicit command activation and return from automation. Meta coexistence feasibility remains an implementation gate, not evidence of functionality. |
| C11 | **Approved** | Employee reassignment customer-approval flow retained. |
| O01 | **Approved** | Onboarding journey approved as presented, with real provider compatibility check. |
| O02 | **Approved** | Google Calendar import with selectable 3/6/12 months plus future events, review and consent protection. |
| O03 | **Revision requested** | Employee management must be **optional/configurable**; many businesses are solo operators. Automatically support one implicit/default bookable resource for a solo business, without forcing setup of employee profiles. When staff mode enabled, use multi-employee qualifications and weekly hours. Owner review pending. |
| O04 | **Revision requested** | **Google Calendar is the owner's preferred/default manual appointment creation/editing interface.** NukMiris dashboard booking remains an alternative, per Decision 151. Owner can create a fresh event or copy a previous event, entering customer name, WhatsApp number and service as available. NukMiris should read the resulting event, normalize/standardize where reliable, detect managed identity/appointment details and safely enroll eligible reminders. Do not silently adopt copied IDs, stale names/numbers, wrong service, wrong employee or old consent; ambiguous data remains unmanaged or flagged contextually. Exact Google-event syntax, copied-event behavior, safe association, owner correction UX and notification timing must be tested/decided; **not yet approved as final O04**. |

### Proposed O03 clarified journey — solo-first
1. Owner enters business basics and chooses solo operation (default) or enables team/staff scheduling.
2. Solo mode uses a default internal employee/resource and one business calendar; no manual employee setup is required. Business still configures service duration/buffer, regular available hours and Google exceptions.
3. Team mode allows employee records, qualifications, schedules and shared-calendar resource allocation.
4. The customer sees eligible slots without unnecessary employee-selection prompts for solo business. Changing from solo to staff mode must preserve existing booked appointments and resource identity.

### Proposed O04 clarified journey — Google Calendar first
| Step | Owner (Juanita) | NukMiris | Customer |
|---|---|---|---|
| 1 | Opens Google Calendar; creates or copies an appointment | Watches calendar through authorized read/sync path | None |
| 2 | Adds/updates name, WhatsApp number and service where available; checks time | Parses event fields; safely normalizes numbers and services only when unambiguous; preserves original event | None |
| 3 | May leave number absent | Treats event as availability blocker, unmanaged for messaging | No messages |
| 4 | If number present, resolves profile and employee/service/duration | Link only when reliable identity, event ownership, resource, duration and consent evidence meet policy; copied outdated details are never silently trusted | None |
| 5 | For fully verified managed event and valid consent | Enrolls authorized notifications/reminders and updates dashboard. No unsolicited permission requests to unconsented numbers | Receives permitted notifications |
| 6 | May instead use NukMiris's calendar-first dashboard | Staff booking alternative with explicit conflict warning/override and WhatsApp number requirement | Can receive authorized confirmation |

**Design/proof gap:** Define reliable event fields and parsing conventions, copied-event detection, manual-correction UX, and whether/how a newly ingested calendar event produces a customer confirmation without duplicating messages. Do not automatically rewrite Juanita's event title/description unless explicitly approved. Never treat a typed telephone number as verified consent.


## Owner-review log — O05–O08 (2026-10-31)
| Date | Scenario | Result | Scope |
|---|---|---|---|
| 2026-10-31 | O05 | **Approved** | Google Calendar events with no phone remain unmanaged availability blockers, no automatic WhatsApp sends |
| 2026-10-31 | O06 | **Approved** | NukMiris appointment edit with controlled override, service checks and authorized notification; secondary to Google Calendar owner workflow |
| 2026-10-31 | O07 | **Approved** | Google Calendar verified edits, immediate availability sync, short notification consolidation and authorized updated message |
| 2026-10-31 | O08 | **Approved** | Preserve Decision 92; deletion triggers protected owner resolution, not auto cancellation |

**Pending owner reapproval remains: O03 (optional solo-first staff mode) and O04 (Google Calendar-first manual booking and safe parsing). Do not mark these approved based on O05–O08.**

## Owner-review log — O09–O12 (2026-10-31)
| Date | Scenario | Result | Scope |
|---|---|---|---|
| 2026-10-31 | O09 | **Approved** | Authorized manual overlaps with dashboard warning and confirmation; Google Calendar overlaps accepted as-is |
| 2026-10-31 | O10 | **Approved** | No-show quick action and automatic completion distinct from verified attendance |
| 2026-10-31 | O11 | **Approved** | Combined daily NukMiris calendar, employee/status filters, Needs Attention; Google Calendar remains preferred scheduling tool |
| 2026-10-31 | O12 | **Revision requested** | In-person consent workflow for appointments booked first in Google Calendar remains unresolved; do not assume a Google event constitutes consent |

**Open for later reapproval:** O03 solo-first employee configuration; O04 Google Calendar-first manual booking/parsing; O12 recording verbal consent without adding burdensome owner steps. This entry does not amend earlier approved consent protections.

## Owner-review log — O13–O16 (2026-10-31)
| Date | Scenario | Result | Scope |
|---|---|---|---|
| 2026-10-31 | O13 | **Approved** | Verified phone-number change, identity confirmation, new-number consent, preserve existing bookings/history |
| 2026-10-31 | O14 | **Approved** | Employee absences, busy blocks and business closures managed through Google Calendar |
| 2026-10-31 | O15 | **Approved** | Multi-location business with shared business customer scope and location-specific employee/calendar resources |
| 2026-10-31 | O16 | **Approved** | Reporting, authorized exports, basic customer management, distinguish auto-completed from attendance |

**Pending reapproval:** O03, O04, O12. Owner explicitly requested a consolidated Google Calendar-first workflow review before Staff personas. Do not treat subsequent proposals as already approved.

## Consolidated Business Owner reapproval — O03, O04, O12 (2026-10-31)

**Owner approval:** O03, O04 and O12 approved after integrated solo-first and Google Calendar-first workflow review. Earlier revision-request entries remain as history, not current status.

| Scenario | Approved behavior | Safeguards |
|---|---|---|
| O03 | Solo operation is the default and employee setup is optional; multi-employee mode can be enabled. | One default internal resource for solo; staff scheduling qualifications/hours for team; retain existing appointments on transition. |
| O04 | Google Calendar is the preferred first option for creating/copying manual appointments, with customer name, phone and service where available; NukMiris reads and internally normalizes reliable entries. NukMiris calendar stays a secondary booking option. | Treat copied events as untrusted until current fields match; preserve original event text, do not silently inherit old customer/consent/employee identity; unmanaged events block availability. |
| O12 | Record consent via demonstrable prior permission, customer-initiated WhatsApp `permisos`, or Juanita obtaining verbal permission and recording it in the NukMiris customer-profile checkbox with audit evidence. | Calendar title/description/number never establishes messaging consent itself. Unknown/declined permission blocks proactive WhatsApp messages, not appointment booking. |

### Consolidated approved owner journey
1. Juanita creates or copies an event through Google Calendar. Solo business needs no manual employee configuration; team businesses use mapped resources.
2. NukMiris observes event, extracts name/phone/service where reliable, normalizes internally, preserves original event content and evaluates copied-event freshness.
3. Busy calendar events block availability even when identity/phone details are absent. Unverified entries remain unmanaged for WhatsApp.
4. Where appointment association is reliable, match or link the customer using business-scoped identity; use existing valid consent or explicitly newly recorded customer permission.
5. Authorized messages may confirm a booked appointment; automatic reminders require valid specific reminder permission. Never send unsolicited permission requests simply because event has a number.
6. Dashboard calendar-first booking remains supported as a **secondary option**.

**Provider feasibility / tests remain required:** Google copied-event patterns, identity/employee/service parsing, change detection, Meta coexistence, suitable templates, consent capture and audit. Approval is not proof of technical implementation.

## Staff persona owner-review log — S01–S03 (2026-10-31)
| Date | Scenario | Result | Scope |
|---|---|---|---|
| 2026-10-31 | S01 | **Approved** | Receptionist searches customers, manages authorized bookings and No-shows, with booking-level overlap safeguards and audit |
| 2026-10-31 | S02 | **Approved** | Employee limited to permitted schedule, optional booking permission; Google Calendar permission is independent |
| 2026-10-31 | S03 | **Approved** | Owner invites, configures/revokes staff; solo-to-team transition preserves appointments; departed staff future bookings require review |

**Next review requested:** Platform A01–A03, commercial B01–B02, pilot readiness P01. All previously approved customer/owner scenarios remain unchanged. C01 remains pending reapproval of the requested first-time name collection and post-confirmation permission prompt.

## Final group review — Platform, Commercial and Pilot (2026-10-31)
| Date | Scenario | Result | Scope |
|---|---|---|---|
| 2026-10-31 | A01 | **Approved** | Integration incident detection, protected uncertainty and verified reconciliation; never blind retry uncertain sends |
| 2026-10-31 | A02 | **Approved** | Owner human-support case and knowledge base; AI support deferred |
| 2026-10-31 | A03 | **Approved** | MFA-protected platform administration, tenant-scoped audited actions |
| 2026-10-31 | B01 | **Approved** | 30-day no-card trial, monthly allowance/overage, cap, 7-day payment grace and controlled suspension |
| 2026-10-31 | B02 | **Approved** | Subscription cancellation, customer export, appropriate retention/deletion and safe integration revocation |
| 2026-10-31 | P01 | **Approved** | Commercial-MVP readiness evidence, independent Claude review and explicit pilot go/no-go |

**Inventory audit (2026-10-31):** 37 unique scenarios (C=12; O=16; S=3; A=3; B=2; P=1). **37 owner-approved; none pending.** Previous "pending" notes in the chronological review log are historical and superseded by later dated approvals. **Open engineering verification and design gaps do not equal unapproved owner journeys.** A separate closure report records them.

## Step 2A final signoff — C01 (2026-10-31)
| Date | Scenario | Result | Specific owner-approved flow |
|---|---|---|---|
| 2026-10-31 | C01 | **Approved with revision; closes Step 2A** | Preserve service selection and existing two-slots/more UX; only for new customers ask name *after* choosing time and before confirmation; complete verified booking and send confirmation; if reminder consent unknown, offer separate optional consent afterward; declined/silent leaves booking intact and sends no reminders. |

**STEP 2A CLOSED: 37/37 unique persona scenarios owner-approved.** This is functional signoff only; provider eligibility, design evidence, integration testing, billing/security proofs and pilot go/no-go remain in Step 2B and subsequent milestones. Draft PR #2 stays unmerged.
