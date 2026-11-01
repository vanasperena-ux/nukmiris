# End-to-end requirements traceability

All 37 journeys are owner-approved design intent. No new feature is called implemented. Scenario IDs use `J.*`; the frozen parity namespace is `V081.*` in 05. Decision IDs `D001–D178` below refer only to the numbered interview, not historical F-series. Binding sources/commit pins and supersessions are in 01.

Evidence categories: **S** = latest signed scenario/closure/G06 stored in Git; **T** = thematic numbered-decision attribution; **B** = accepted source/test/PC record; **H** = superseded historical architecture proposal; **N** = unavailable original evidence. S/T establish review intent, not runtime/provider proof. Candidate test/evidence paths are future work, all NOT RUN; reviewer pending Claude. No original interview wording is reconstructed from T.

## 37-scenario acceptance matrix

The source column is the exact inventory and latest approval in product 02 at `1f4682c…`; approved chronology: C01 `248d07e…`, C09/C12 `6052e7d…`, O03/O04/O12 `fb8ceed…`, staff `8246fed…`, final group `2e25866…`; G06 `6ebc1ea…`. Assertions are concrete test obligations. Evidence target for each `MVP-ID` is `vnext/evidence/<candidate-commit>/MVP-ID.json` containing full journey input/output/effect/audit trace, with actual test result and independent reviewer disposition. These artifacts do not exist yet.

| Requirement / scenario | Owner-approved inventory | Numbered refs (thematic) | Stage / module seam | Acceptance assertion | Candidate tests | Evidence / result / reviewer |
|---|---|---|---|---|---|---|
| J.C01 | New appointment via `cita`, one service; collect new customer's name after slot selection; ask reminder consent when unknown (S; ✓ Revised workflow approved 2026-10-31) | 19, 30/147, 140–146, 155–161 (T) | P0→M1/M2; parity reducer/booking, later service/consent | Known slot selection commits; new name after slot; future optional unknown-only consent after verified confirmation, silence preserves booking | P-W03/W07/C04; MVP-C01 | `MVP-C01.json`; NOT RUN; pending Claude |
| J.C02 | Existing appointment shown on `menu` (S; ✓ Approved 2026-10-30) | 65, 148 (T) | P0; parity menu | Only own upcoming chronological appointments; lookup outage is not empty | P-W04/C06; MVP-C02 | `MVP-C02.json`; NOT RUN; pending Claude |
| J.C03 | Reschedule existing appointment (S; ✓ Approved 2026-10-30) | 63, 149 (T) | P0→M2; booking coordinator | One event direct replacement; multiple first choose target; original retained on failure/uncertainty | P-C07; MVP-C03 | `MVP-C03.json`; NOT RUN; pending Claude |
| J.C04 | Cancel existing appointment (S; ✓ Approved 2026-10-30) | 64, 150 (T) | P0→M7; booking coordinator | Always select exact owned cancel target; once; later release verified availability for waiting list | P-C08; MVP-C04 | `MVP-C04.json`; NOT RUN; pending Claude |
| J.C05 | All requested slots unavailable; more choices/waitlist (S; ✓ Approved 2026-10-30) | 31, 33, 68–73, 141 (T) | M7; availability/waitlist | No false availability; opt-in waiting list, one explicit accepted offer rechecks capacity | P-C03; MVP-C05 | `MVP-C05.json`; NOT RUN; pending Claude |
| J.C06 | Past employee preference vs available alternatives (S; ✓ Approved 2026-10-30) | 21, 142–146 (T) | M2; resource/service | Last completed same-service employee preference; eligible alternatives; no silent reassignment | DB03; MVP-C06 | `MVP-C06.json`; NOT RUN; pending Claude |
| J.C07 | Appointment reminders and 1-day confirmation (S; ✓ Approved 2026-10-30) | 36–38 (T) | P0→M1; reminders | Four current offsets and delivered-parent proof; later business controls and permission scope | P-R01–12; MVP-C07 | `MVP-C07.json`; NOT RUN; pending Claude |
| J.C08 | `permisos`: view, enable, disable, restore consent (S; ✓ Approved 2026-10-30) | 19, 158–161 (T) | M1; permissions | `permisos` view/enable/disable, current business; no stale regrant; future eligible jobs only | F23–25; MVP-C08 | `MVP-C08.json`; NOT RUN; pending Claude |
| J.C09 | Imported customer's first inbound; migration-intro flag independent of consent; direct commands uninterrupted (S; ✓ Approved with revision 2026-10-30) | 148, 158–161, 178 (T) | M4; participant/intro | Only reliable flagged import gets one verified intro; consent separate; explicit commands first; no retry on unknown | MVP-C09; F20/21 | `MVP-C09.json`; NOT RUN; pending Claude |
| J.C10 | Normal chat and human assistance (S; ✓ Approved 2026-10-30) | 41–45, 121 (T) | P0→M4; human routing | P0 recorded handoff/Menu priority; live add-on ordinary chat and owner echoes separately verified | P-W05; MVP-C10 | `MVP-C10.json`; NOT RUN; pending Claude |
| J.C11 | Staff-initiated employee reassignment (S; ✓ Approved 2026-10-30) | 22–23 (T) | M2; assignment/change | Customer accepts staff reassignment before finalization; hold both resources on uncertainty | DB04; MVP-C11 | `MVP-C11.json`; NOT RUN; pending Claude |
| J.C12 | Optional authorized attendance-and-feedback question; customer-reported attendance or absence; no reply leaves attendance unverified (S; ✓ Approved with revision 2026-10-30; template eligibility to verify) | 35, 75–77, 168 (T) | M7; attendance/reporting | Only provider/purpose-authorized optional survey; self-report and no-show distinct; silence unverified, no past cancellation | MVP-C12 | `MVP-C12.json`; NOT RUN; pending Claude |
| J.O01 | Create business, connect WhatsApp and Google Calendar (S; ✓ Approved 2026-10-30) | 52–54, 116 (T) | M0; onboarding | Verify business-owned channel/calendar/grants; failure pauses affected automation, no assumed coexistence | SEC02; MVP-O01 | `MVP-O01.json`; NOT RUN; pending Claude |
| J.O02 | Import calendar customer history 3/6/12 months (S; ✓ Approved 2026-10-30) | 20, 54, 178 (T) | M3/M4; calendar candidates | 3/6/12-month history (6 default) plus upcoming; preview ambiguities; no inferred consent/contact | MVP-O02 | `MVP-O02.json`; NOT RUN; pending Claude |
| J.O03 | Configure services, employee qualifications/hours (S; ✓ Revised workflow approved 2026-10-31) | 28–29, 133–139 (T) | P0 structure→M2; resource/service | Solo default identity persists when optional staff enabled; common service duration/buffer | DB03; MVP-O03 | `MVP-O03.json`; NOT RUN; pending Claude |
| J.O04 | Google Calendar-first manual booking; NukMiris alternative (S; ✓ Revised workflow approved 2026-10-31) | 151–157, 177 (T) | M3; manual association | Google primary fresh/copy entry; dashboard secondary; preserve original text; copied fields cannot authorize messages | F30; MVP-O04 | `MVP-O04.json`; NOT RUN; pending Claude |
| J.O05 | Create event in Google without phone (S; ✓ Approved 2026-10-31) | 54, 93, 177 (T) | M3; event observation | No-phone Google event remains ordinary unmanaged blocker; no messages or automatic missing-phone incident | MVP-O05 | `MVP-O05.json`; NOT RUN; pending Claude |
| J.O06 | Reschedule/modify service through dashboard (S; ✓ Approved 2026-10-31) | 154, 170–172 (T) | M3; staff booking/edit | Authorized dashboard override warning/audit; service/time checks; no individual duration extension | MVP-O06 | `MVP-O06.json`; NOT RUN; pending Claude |
| J.O07 | Modify managed appointment in Google (S; ✓ Approved 2026-10-31) | 91, 173–174 (T) | M3; calendar sync | Immediate verified availability update; notification-only coalesce candidate ~60s; consent and identity current | MVP-O07 | `MVP-O07.json`; NOT RUN; pending Claude |
| J.O08 | Delete managed Google Calendar event (S; ✓ Approved 2026-10-31) | 92; 175 withdrawn (T) | M3; deletion review | Decision 92: hold until owner cancel/restore; not API-outage/list omission; 175 withdrawn | MVP-O08 | `MVP-O08.json`; NOT RUN; pending Claude |
| J.O09 | Manually overlap employee appointments (S; ✓ Approved 2026-10-31) | 172, 176 (T) | M3; manual occupancy | Accept intentional Google overlaps; dashboard booker warning/confirmation; preserve both blocks, no automatic cancellation | DB03; MVP-O09 | `MVP-O09.json`; NOT RUN; pending Claude |
| J.O10 | Manage no-show and auto-complete (S; ✓ Approved 2026-10-31) | 34–35, 168–169 (T) | M7; attendance lifecycle | Staff no-show after start; auto-complete after end is not attended; corrections audited | MVP-O10 | `MVP-O10.json`; NOT RUN; pending Claude |
| J.O11 | Daily combined calendar, filters, Needs Attention (S; ✓ Approved 2026-10-31) | 39, 153, 167 (T) | M5; daily operations UI | Combined mobile daily view and status/staff filters; Needs Attention only actionable cases | MVP-O11 | `MVP-O11.json`; NOT RUN; pending Claude |
| J.O12 | Record consent in person and start authorized messaging (S; ✓ Revised workflow approved 2026-10-31) | 155–157 (T) | M1/M3; consent evidence UI | Prior demonstrable grant/customer permisos/audited verbal checkbox; typed calendar phone never consent | DB07; MVP-O12 | `MVP-O12.json`; NOT RUN; pending Claude |
| J.O13 | Change customer's WhatsApp phone number (S; ✓ Approved 2026-10-31) | 162–165 (T) | M5; customer identity | Customer inbound on new number + staff identity approval; stop old recipient; no permission transfer/leak | MVP-O13 | `MVP-O13.json`; NOT RUN; pending Claude |
| J.O14 | Closures, staff absences and breaks (S; ✓ Approved 2026-10-31) | 24–27, 134–138 (T) | M2/M3; resource busy mapping | Hours in NukMiris, exception/absence/closure Google blocks routed to proper resource/business scope | MVP-O14 | `MVP-O14.json`; NOT RUN; pending Claude |
| J.O15 | Business with multiple locations (S; ✓ Approved 2026-10-31) | 58–60 (T) | M5; location/calendar | Shared business customer scope, location-specific calendars/resources and access checks | SEC03; MVP-O15 | `MVP-O15.json`; NOT RUN; pending Claude |
| J.O16 | Review reports, customer export and deletion (S; ✓ Approved 2026-10-31) | 77–81 (T) | M7; reports/privacy | Authorized operational reports/export/deletion, no notes/extra CRM; provenance of attendance retained | MVP-O16 | `MVP-O16.json`; NOT RUN; pending Claude |
| J.S01 | Search customer and manage bookings (S; ✓ Approved 2026-10-31) | 151–154, 164–165 (T) | M5; staff/customer UI | Scoped partial-name/number search, authorized bookings/no-show/override and audit | MVP-S01 | `MVP-S01.json`; NOT RUN; pending Claude |
| J.S02 | Restricted own schedule and permitted booking (S; ✓ Approved 2026-10-31) | 55–57, 176 (T) | M5; roles | Own permitted schedule, explicit booking permission; Google permission independent | SEC03; MVP-S02 | `MVP-S02.json`; NOT RUN; pending Claude |
| J.S03 | Invite/revoke staff and manage role (S; ✓ Approved 2026-10-31) | 55–57, 131–132 (T) | M5; membership | Secure invite/revoke, departed future bookings reviewed; default resource IDs preserved | MVP-S03 | `MVP-S03.json`; NOT RUN; pending Claude |
| J.A01 | Integration down, alerts and safe recovery (S; ✓ Approved 2026-10-31) | 83–90, 97–110 (T) | P0→WP5; recovery/ops | Affected integration pause; read-only uncertain reconcile; verified resume, no blind resend | F14–29; MVP-A01 | `MVP-A01.json`; NOT RUN; pending Claude |
| J.A02 | Human support tickets and knowledge base (S; ✓ Approved 2026-10-31) | 120–127 (T) | M6; support | Human ticket/inbox and KB; AI support deferred | MVP-A02 | `MVP-A02.json`; NOT RUN; pending Claude |
| J.A03 | Tenant-level administrative access and audit (S; ✓ Approved 2026-10-31) | 127–130 (T) | WP5→M6; admin | Individual MFA, tenant grants, audited support/recovery; no silent cross-tenant fixes | SEC06; MVP-A03 | `MVP-A03.json`; NOT RUN; pending Claude |
| J.B01 | Trial, subscription, spend cap, failed payment (S; ✓ Approved 2026-10-31) | 47–51 (T) | M6; billing/execution gate | 30-day no-card trial, allowance/overage/cap, 7-day grace; G06 all-automation pause, warn/preserve/future-only resume | DB08/F27; MVP-B01 | `MVP-B01.json`; NOT RUN; pending Claude |
| J.B02 | Subscription cancellation, export and retention (S; ✓ Approved 2026-10-31) | 12–13, 80–82 (T) | M6/M7; offboarding/privacy | Cancel/export/read access, policy-based retention/deletion and safe revocation without deleting Calendar bookings | REC01; MVP-B02 | `MVP-B02.json`; NOT RUN; pending Claude |
| J.P01 | Pre-pilot readiness, evidence and approval (S; ✓ Approved 2026-10-31) | 110–119 (T) | M8; release acceptance | All agreed evidence, staffing/provider/PC/security/Claude checks and explicit owner pilot go/no-go | OPS01; MVP-P01 | `MVP-P01.json`; NOT RUN; pending Claude |


## Decision-by-decision evidence worksheet (178 rows)

**Original interview status for every row: SOURCE NOT AVAILABLE.** Repository complete trees and product-path history have been checked as described in 01. The thematic register and approved scenarios are accessible; the original numbered answers are not. A row with a thematic range is evidence that the register attributes that capability to the range, not that the exact answer was verified. Unmapped numbers remain unmapped. No missing row blocks inert documentation or reopens any signed journey.

`T01:L#` points to the exact capability-table line in pinned product 01; `S02` means inventory attribution in pinned product 02. Raw evidence can later replace N without changing approved S behavior. Candidate acceptance test comes from the explicit scenario attribution, or `COVERAGE-Dnnn` when original evidence is needed before an exact assertion is defensible. `COVERAGE` is a requirements reconciliation check, not fabricated executable coverage.

| Decision | Verifiable repository attribution | Scenario attribution | Candidate acceptance test | Original source | Test result / reviewer |
|---|---|---|---|---|---|
| D001 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D001 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D002 | T01:L19 Employee resources | Not verified | COVERAGE-D002 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D003 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D003 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D004 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D004 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D005 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D005 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D006 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D006 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D007 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D007 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D008 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D008 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D009 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D009 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D010 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D010 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D011 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D011 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D012 | T01:L18 Architecture / reviews | B02 | MVP-B02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D013 | T01:L18 Architecture / reviews | B02 | MVP-B02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D014 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D014 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D015 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D015 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D016 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D016 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D017 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D017 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D018 | T01:L18 Architecture / reviews | Not verified | COVERAGE-D018 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D019 | T01:L23 Reminder and consent | C01, C08 | MVP-C01, MVP-C08 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D020 | T01:L23 Reminder and consent; T01:L24 Manual booking | O02 | MVP-O02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D021 | T01:L19 Employee resources | C06 | MVP-C06 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D022 | T01:L19 Employee resources | C11 | MVP-C11 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D023 | T01:L19 Employee resources | C11 | MVP-C11 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D024 | T01:L19 Employee resources | O14 | MVP-O14 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D025 | T01:L19 Employee resources | O14 | MVP-O14 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D026 | T01:L19 Employee resources | O14 | MVP-O14 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D027 | T01:L19 Employee resources; T01:L26 Manual overlaps | O14 | MVP-O14 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D028 | T01:L19 Employee resources | O03 | MVP-O03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D029 | T01:L19 Employee resources | O03 | MVP-O03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D030 | T01:L20 Single service booking | C01 | MVP-C01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D031 | T01:L21 Slot UX | C05 | MVP-C05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D032 | T01:L21 Slot UX | Not verified | COVERAGE-D032 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D033 | S02 inventory only | C05 | MVP-C05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D034 | T01:L34 Reporting / review | O10 | MVP-O10 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D035 | T01:L34 Reporting / review | C12, O10 | MVP-C12, MVP-O10 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D036 | T01:L23 Reminder and consent | C07 | MVP-C07 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D037 | T01:L23 Reminder and consent | C07 | MVP-C07 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D038 | T01:L23 Reminder and consent | C07 | MVP-C07 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D039 | S02 inventory only | O11 | MVP-O11 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D040 | No individual attribution verified | Not verified | COVERAGE-D040 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D041 | T01:L22 WhatsApp menu and human support | C10 | MVP-C10 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D042 | T01:L22 WhatsApp menu and human support | C10 | MVP-C10 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D043 | T01:L22 WhatsApp menu and human support | C10 | MVP-C10 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D044 | T01:L22 WhatsApp menu and human support | C10 | MVP-C10 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D045 | T01:L22 WhatsApp menu and human support | C10 | MVP-C10 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D046 | T01:L22 WhatsApp menu and human support | Not verified | COVERAGE-D046 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D047 | T01:L35 Pricing / subscription | B01 | MVP-B01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D048 | T01:L35 Pricing / subscription | B01 | MVP-B01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D049 | T01:L35 Pricing / subscription | B01 | MVP-B01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D050 | T01:L35 Pricing / subscription | B01 | MVP-B01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D051 | T01:L35 Pricing / subscription | B01 | MVP-B01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D052 | T01:L35 Pricing / subscription | O01 | MVP-O01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D053 | T01:L24 Manual booking | O01 | MVP-O01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D054 | T01:L24 Manual booking | O01, O02, O05 | MVP-O01, MVP-O02, MVP-O05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D055 | T01:L27 Staff access | S02, S03 | MVP-S02, MVP-S03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D056 | T01:L27 Staff access | S02, S03 | MVP-S02, MVP-S03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D057 | T01:L19 Employee resources; T01:L27 Staff access | S02, S03 | MVP-S02, MVP-S03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D058 | T01:L28 Business and locations | O15 | MVP-O15 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D059 | T01:L28 Business and locations | O15 | MVP-O15 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D060 | T01:L28 Business and locations | O15 | MVP-O15 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D061 | T01:L29 Customer booking policies | Not verified | COVERAGE-D061 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D062 | T01:L29 Customer booking policies | Not verified | COVERAGE-D062 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D063 | T01:L21 Slot UX; T01:L29 Customer booking policies | C03 | MVP-C03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D064 | T01:L21 Slot UX; T01:L29 Customer booking policies | C04 | MVP-C04 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D065 | T01:L29 Customer booking policies | C02 | MVP-C02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D066 | T01:L29 Customer booking policies | Not verified | COVERAGE-D066 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D067 | T01:L29 Customer booking policies | Not verified | COVERAGE-D067 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D068 | T01:L29 Customer booking policies | C05 | MVP-C05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D069 | T01:L29 Customer booking policies | C05 | MVP-C05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D070 | T01:L29 Customer booking policies | C05 | MVP-C05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D071 | T01:L29 Customer booking policies | C05 | MVP-C05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D072 | T01:L29 Customer booking policies | C05 | MVP-C05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D073 | T01:L29 Customer booking policies | C05 | MVP-C05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D074 | T01:L29 Customer booking policies | Not verified | COVERAGE-D074 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D075 | T01:L23 Reminder and consent; T01:L34 Reporting / review | C12 | MVP-C12 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D076 | T01:L23 Reminder and consent; T01:L34 Reporting / review | C12 | MVP-C12 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D077 | T01:L23 Reminder and consent; T01:L34 Reporting / review | C12, O16 | MVP-C12, MVP-O16 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D078 | T01:L34 Reporting / review | O16 | MVP-O16 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D079 | T01:L34 Reporting / review | O16 | MVP-O16 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D080 | T01:L34 Reporting / review | O16, B02 | MVP-O16, MVP-B02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D081 | T01:L34 Reporting / review | O16, B02 | MVP-O16, MVP-B02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D082 | T01:L35 Pricing / subscription | B02 | MVP-B02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D083 | T01:L36 Support / administration | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D084 | T01:L36 Support / administration | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D085 | T01:L36 Support / administration; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D086 | T01:L36 Support / administration; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D087 | T01:L36 Support / administration; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D088 | T01:L36 Support / administration; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D089 | T01:L36 Support / administration; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D090 | T01:L26 Manual overlaps; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D091 | T01:L24 Manual booking; T01:L33 Change notifications; T01:L37 Safety operations | O07 | MVP-O07 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D092 | T01:L24 Manual booking; T01:L25 Calendar deletion; T01:L37 Safety operations | O08 | MVP-O08 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D093 | T01:L24 Manual booking; T01:L37 Safety operations | O05 | MVP-O05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D094 | T01:L18 Architecture / reviews; T01:L37 Safety operations | Not verified | COVERAGE-D094 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D095 | T01:L18 Architecture / reviews; T01:L37 Safety operations | Not verified | COVERAGE-D095 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D096 | T01:L18 Architecture / reviews; T01:L37 Safety operations | Not verified | COVERAGE-D096 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D097 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D098 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D099 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D100 | T01:L18 Architecture / reviews; T01:L23 Reminder and consent; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D101 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D102 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D103 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D104 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D105 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D106 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D107 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D108 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D109 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01 | MVP-A01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D110 | T01:L18 Architecture / reviews; T01:L37 Safety operations | A01, P01 | MVP-A01, MVP-P01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D111 | T01:L18 Architecture / reviews | P01 | MVP-P01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D112 | T01:L18 Architecture / reviews | P01 | MVP-P01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D113 | T01:L18 Architecture / reviews | P01 | MVP-P01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D114 | T01:L18 Architecture / reviews | P01 | MVP-P01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D115 | T01:L18 Architecture / reviews | P01 | MVP-P01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D116 | S02 inventory only | O01, P01 | MVP-O01, MVP-P01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D117 | T01:L34 Reporting / review | P01 | MVP-P01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D118 | T01:L34 Reporting / review | P01 | MVP-P01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D119 | T01:L34 Reporting / review | P01 | MVP-P01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D120 | T01:L36 Support / administration | A02 | MVP-A02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D121 | T01:L36 Support / administration | C10, A02 | MVP-C10, MVP-A02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D122 | T01:L36 Support / administration | A02 | MVP-A02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D123 | T01:L36 Support / administration | A02 | MVP-A02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D124 | T01:L36 Support / administration | A02 | MVP-A02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D125 | T01:L36 Support / administration | A02 | MVP-A02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D126 | T01:L36 Support / administration | A02 | MVP-A02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D127 | T01:L22 WhatsApp menu and human support; T01:L36 Support / administration | A02, A03 | MVP-A02, MVP-A03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D128 | T01:L27 Staff access; T01:L36 Support / administration | A03 | MVP-A03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D129 | T01:L27 Staff access; T01:L36 Support / administration | A03 | MVP-A03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D130 | T01:L27 Staff access | A03 | MVP-A03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D131 | T01:L27 Staff access; T01:L28 Business and locations | S03 | MVP-S03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D132 | T01:L27 Staff access | S03 | MVP-S03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D133 | T01:L20 Single service booking; T01:L28 Business and locations | O03 | MVP-O03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D134 | T01:L19 Employee resources; T01:L28 Business and locations | O03, O14 | MVP-O03, MVP-O14 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D135 | T01:L19 Employee resources; T01:L28 Business and locations | O03, O14 | MVP-O03, MVP-O14 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D136 | T01:L19 Employee resources; T01:L21 Slot UX; T01:L28 Business and locations | O03, O14 | MVP-O03, MVP-O14 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D137 | T01:L19 Employee resources; T01:L21 Slot UX; T01:L28 Business and locations | O03, O14 | MVP-O03, MVP-O14 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D138 | T01:L19 Employee resources; T01:L21 Slot UX; T01:L28 Business and locations | O03, O14 | MVP-O03, MVP-O14 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D139 | T01:L19 Employee resources; T01:L20 Single service booking; T01:L21 Slot UX | O03 | MVP-O03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D140 | T01:L21 Slot UX; T01:L22 WhatsApp menu and human support | C01 | MVP-C01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D141 | T01:L21 Slot UX | C01, C05 | MVP-C01, MVP-C05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D142 | T01:L19 Employee resources | C01, C06 | MVP-C01, MVP-C06 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D143 | T01:L19 Employee resources | C01, C06 | MVP-C01, MVP-C06 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D144 | T01:L19 Employee resources | C01, C06 | MVP-C01, MVP-C06 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D145 | T01:L19 Employee resources | C01, C06 | MVP-C01, MVP-C06 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D146 | T01:L19 Employee resources | C01, C06 | MVP-C01, MVP-C06 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D147 | T01:L20 Single service booking | C01 | MVP-C01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D148 | T01:L22 WhatsApp menu and human support | C02, C09 | MVP-C02, MVP-C09 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D149 | T01:L22 WhatsApp menu and human support | C03 | MVP-C03 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D150 | T01:L22 WhatsApp menu and human support | C04 | MVP-C04 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D151 | T01:L24 Manual booking; T01:L32 Daily operation | O04, S01 | MVP-O04, MVP-S01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D152 | T01:L24 Manual booking; T01:L32 Daily operation | O04, S01 | MVP-O04, MVP-S01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D153 | T01:L24 Manual booking; T01:L32 Daily operation | O04, O11, S01 | MVP-O04, MVP-O11, MVP-S01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D154 | T01:L24 Manual booking; T01:L32 Daily operation | O04, O06, S01 | MVP-O04, MVP-O06, MVP-S01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D155 | T01:L23 Reminder and consent; T01:L24 Manual booking | C01, O04, O12 | MVP-C01, MVP-O04, MVP-O12 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D156 | T01:L23 Reminder and consent; T01:L24 Manual booking | C01, O04, O12 | MVP-C01, MVP-O04, MVP-O12 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D157 | T01:L23 Reminder and consent; T01:L24 Manual booking | C01, O04, O12 | MVP-C01, MVP-O04, MVP-O12 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D158 | T01:L22 WhatsApp menu and human support; T01:L23 Reminder and consent | C01, C08, C09 | MVP-C01, MVP-C08, MVP-C09 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D159 | T01:L23 Reminder and consent | C01, C08, C09 | MVP-C01, MVP-C08, MVP-C09 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D160 | T01:L23 Reminder and consent | C01, C08, C09 | MVP-C01, MVP-C08, MVP-C09 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D161 | T01:L23 Reminder and consent | C01, C08, C09 | MVP-C01, MVP-C08, MVP-C09 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D162 | T01:L30 Customer lifecycle | O13 | MVP-O13 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D163 | T01:L24 Manual booking; T01:L30 Customer lifecycle | O13 | MVP-O13 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D164 | T01:L30 Customer lifecycle | O13, S01 | MVP-O13, MVP-S01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D165 | T01:L30 Customer lifecycle | O13, S01 | MVP-O13, MVP-S01 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D166 | T01:L30 Customer lifecycle | Not verified | COVERAGE-D166 (original evidence needed) | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D167 | T01:L32 Daily operation | O11 | MVP-O11 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D168 | T01:L32 Daily operation | C12, O10 | MVP-C12, MVP-O10 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D169 | T01:L32 Daily operation | O10 | MVP-O10 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D170 | T01:L32 Daily operation | O06 | MVP-O06 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D171 | T01:L32 Daily operation; T01:L33 Change notifications | O06 | MVP-O06 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D172 | T01:L24 Manual booking; T01:L26 Manual overlaps | O06, O09 | MVP-O06, MVP-O09 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D173 | T01:L24 Manual booking; T01:L33 Change notifications | O07 | MVP-O07 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D174 | T01:L24 Manual booking; T01:L33 Change notifications | O07 | MVP-O07 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D175 | T01:L25 Calendar deletion | O08 | MVP-O08 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D176 | T01:L26 Manual overlaps; T01:L27 Staff access | O09, S02 | MVP-O09, MVP-S02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D177 | T01:L24 Manual booking; T01:L30 Customer lifecycle | O04, O05 | MVP-O04, MVP-O05 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |
| D178 | T01:L30 Customer lifecycle; T01:L31 Customer import | C09, O02 | MVP-C09, MVP-O02 | SOURCE NOT AVAILABLE (N) | NOT RUN / pending Claude |


## Coverage and promotion rule

Coverage is 37/37 scenario rows, 178/178 numbered evidence-status rows and 49/49 V081 outcome rows. It is **not** 178/178 verified original decisions or implemented acceptance tests. Any exact requirement discovered in original evidence that materially conflicts with signed current scenarios must be logged as source A/source B/stage/proposed resolution/owner-needed, never silently inserted into P0. Commercial acceptance requires all affected MVP rows implemented, tested and independently reviewed, plus provider/legal/launch evidence. WP1 only proves the bounded foundation tests in 08; it cannot close commercial scenario rows.
