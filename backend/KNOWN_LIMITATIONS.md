# Current limitations and audit follow-up

Version 0.2.1 updates appointment browsing with short suggestions and date selection, preserving the owner-verified availability engine and v0.2.0 customer-confirmed new bookings. It does not enable rescheduling, cancellation, or production business onboarding.

| Original finding | Current status |
| --- | --- |
| Unsigned POST requests accepted | Fixed in this runtime: HMAC-SHA256 over the exact raw body, constant-time comparison, rejection before processing, and a required Meta App Secret. Offline signature tests pass; the owner confirmed real callback verification and delivery on the PC on 2026-10-24. |
| Customer-number routing | Default routing now uses the authenticated receiving phone-number ID and business database mapping. Sessions and outbound replies use that context. The old simulation requires explicit development mode. |
| Internal cancellation bypasses the disabled state | Legacy cancellation/selection and legacy Calendar connection fail closed. Availability mode remains read-only. The optional new booking service requires explicit confirmation, business/customer ownership, a durable request journal, and event permission; rescheduling/deletion remain disabled. |
| Concurrent messages dropped | Same-process messages are now queued per business/customer; deduplication and busy keys are business-scoped. Persistence/retry limitations remain below. |
| Cross-business support/customer foreign key | Still unresolved at the schema level. Normal application lookups are business-scoped, but the database does not enforce a matching business/customer pair. |
| Broad authorization for discovery | The new PC authorization helper requests calendar-list and free/busy scopes. The archived 6B.1 script is historical and is not used by the new setup flow. |

Remaining limits:

- The owner confirmed the v0.1.0 availability integration and subsequently reported the v0.2.0 automatic-booking PC checkpoint successful on 2026-10-24. The subsequent v0.2.1 menu update still needs a real PC WhatsApp check. The cloud agent has no direct PC access; its tests use synthetic data/simulated services. Separate live results for each concurrency and crash-recovery case were not supplied, so the limits below still apply.
- General message queues and deduplication remain in memory; a crash before work is journaled can lose a message. Booking requests and calendar locks now persist in SQLite and coordinate instances sharing that database, but there is no durable message-delivery queue or coordination between independent database copies.
- One shared test Meta token and Google account are used for this development checkpoint. Real owner onboarding, independent credentials, tenant authorization, and offboarding are not implemented.
- Availability authorization stays separate. Optional booking consent adds `calendar.events`, whose Google permission also permits edit/delete operations; this app enables only new-event insertion and verification reads. Old grants are not revoked.
- New bookings are disabled by default and require `NUKMIRIS_MODE=booking`, receiving-number routing, prepared journal tables, separate booking authorization, and explicit customer confirmation. Rescheduling and cancellation remain disabled in every mode.
- Google offers no atomic availability-check-and-insert operation. Local locks/journal checks prevent overlapping participating app requests, but a simultaneous manual edit or another app can race with insertion. This is not a production distributed booking guarantee.
- Ambiguous insert responses are never blindly retried. The app verifies the original event ID and ownership; unresolved outcomes keep the calendar protected until reconciliation/manual review. A missing event on the first recovery read is not enough to release that protection.
- Only same-day business hours are supported. The search window is configurable from 1 to 90 days; the default is 14. Employee calendars and staff allocation remain future design work.
- There is no owner dashboard/authentication or reminder worker yet. The architecture diagram remains a target, not a list of completed components.
- Bernard's unspecified buffer/break settings remain unspecified. Juanita's closing time, zero buffer, and hourly start interval were confirmed by the owner for this checkpoint.
