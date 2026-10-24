# Known audit limitations

These findings come from the 2026-10-24 read-only audit of the supplied v6A.4 snapshot. The packaging checkpoint preserves its support-only behavior and does not resolve these findings. Booking must stay disabled.

| Priority | Finding | Current implication |
| --- | --- | --- |
| High | POST webhook requests do not verify Meta's signature. | A forged request for a known test sender can alter support/session state if the endpoint is exposed without separate protection. The GET subscription challenge is not POST authentication. |
| High before real onboarding | Routing uses the customer's sender number and one global outbound sender. | It ignores the receiving business phone ID; a customer cannot use two real businesses correctly through this routing model. |
| High before reconnecting Calendar | The internal cancellation function lacks its own unconditional Calendar-disable check. | Incoming appointment messages and old sessions are blocked, but a direct internal call can reach deletion if a Calendar client is supplied. Legacy code still uses `primary` and customer-phone ownership rather than business-specific calendar/event ownership. |
| Medium | A second concurrent message can be marked processed and then dropped. | Busy-customer handling discards work; deduplication and locks are in-memory and not explicitly business-scoped. |
| Medium | A support conversation can reference another business's customer ID. | Normal callers use a scoped lookup, but the database does not enforce a matching business/customer pair. |
| Medium | The proposed 6B.1 discovery script requests full calendar permission. | Its shown API calls only list calendars; it needs a separate least-permission review before execution. |

Offline audit fixtures confirmed scoped customer/session/support queries and normal incoming appointment guards. They also confirmed useful safeguards in the proposed 6B.1 transaction: distinct calendar selection, repeatability, conflict rejection, and rollback. These results do not verify the real PC database, OAuth access, calendar IDs, or real message delivery.

The regression suite covers this checkpoint's support-only contract. It does not claim signed business routing, safe live cancellation, multi-worker booking protection, or cross-business production authorization. Future changes must add acceptance tests for those capabilities before enabling them.

Missing product settings remain unspecified: Juanita's closing time and Bernard's buffer/break configuration have not been supplied. Do not substitute historical hardcoded slot times for the future configurable scheduling engine.
