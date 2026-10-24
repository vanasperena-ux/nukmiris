# Current limitations and audit follow-up

Version 0.1.0 adds read-only calendar availability and addresses several findings from the v6A.4 audit. It does not activate Calendar event changes or constitute production business onboarding.

| Original finding | Current status |
| --- | --- |
| Unsigned POST requests accepted | Fixed in this runtime: HMAC-SHA256 over the exact raw body, constant-time comparison, rejection before processing, and a required Meta App Secret. Offline signature tests pass; the owner confirmed real callback verification and delivery on the PC on 2026-10-24. |
| Customer-number routing | Default routing now uses the authenticated receiving phone-number ID and business database mapping. Sessions and outbound replies use that context. The old simulation requires explicit development mode. |
| Internal cancellation bypasses the disabled state | Legacy cancellation/selection and legacy Calendar connection now fail closed. New availability uses a separate read-only service and narrower Google scopes. Event ownership and safe booking writes remain future work. |
| Concurrent messages dropped | Same-process messages are now queued per business/customer; deduplication and busy keys are business-scoped. Persistence/retry limitations remain below. |
| Cross-business support/customer foreign key | Still unresolved at the schema level. Normal application lookups are business-scoped, but the database does not enforce a matching business/customer pair. |
| Broad authorization for discovery | The new PC authorization helper requests calendar-list and free/busy scopes. The archived 6B.1 script is historical and is not used by the new setup flow. |

Remaining limits:

- The owner confirmed the real v0.1.0 PC integration on 2026-10-24, including both connection checks and busy-time filtering. The cloud agent has no direct access to the PC, live configuration, or database. New changes still need their own PC validation against this preserved baseline.
- Queues and deduplication are in memory. Requests are acknowledged before durable storage, so a crash or failed handler can lose work. There is no production retry queue or multi-worker idempotency/locking yet.
- One shared test Meta token and Google account are used for this development checkpoint. Real owner onboarding, independent credentials, tenant authorization, and offboarding are not implemented.
- The new Google authorization request uses read-only scopes; any older, broader account grants are not automatically revoked. This runtime still does not issue event-writing calls.
- Automatic booking, rescheduling, and cancellation stay disabled. No configurable mode can enable event writes. Rechecking a displayed time does not reserve it or prevent another system from booking it afterward.
- Only same-day business hours are supported. The search window is configurable from 1 to 90 days; the default is 14. Employee calendars and staff allocation remain future design work.
- There is no owner dashboard/authentication or reminder worker yet. The architecture diagram remains a target, not a list of completed components.
- Bernard's unspecified buffer/break settings remain unspecified. Juanita's closing time, zero buffer, and hourly start interval were confirmed by the owner for this checkpoint.
