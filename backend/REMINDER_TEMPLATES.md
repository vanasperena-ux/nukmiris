# Spanish reminder templates — v0.8.0

These are prepared definitions, **not submitted or approved templates**. The owner submits them through the correct account's WhatsApp Manager. The app uses templates for every proactive reminder, including inside the service window, and never falls back to an arbitrary free-form proactive message.

See the [v0.8.0 production compliance report](META_COMPLIANCE_REPORT.md) for the reviewed official excerpts, source/test references, TTL and permission corrections, and exact remaining live-verification boundary. The four names, Spanish bodies, variable order and buttons are unchanged.

## Names, language and variables

Initial language: **`es_MX`**. The language must match Meta's approved template exactly. A different supported Spanish code can be selected explicitly with `reminders:prepare -- --language es`; all four templates must then exist in that language. Names and future interval policy are stored per business, without a configuration UI.

| Kind | Exact template name | Quick replies | Maximum custom TTL |
| --- | --- | --- | --- |
| Seven-day reminder | `nukmiris_seven_day_v1` | None | 900 seconds |
| 24-hour attendance request | `nukmiris_confirmation_v1` | Sí, confirmo; Necesito reagendar | 900 seconds |
| 22-hour follow-up | `nukmiris_followup_v1` | Sí, confirmo; Necesito reagendar | 900 seconds |
| Two-hour reminder | `nukmiris_final_v1` | None | 300 seconds |

The export sets `message_send_ttl_seconds` on the creation definition. Official Utility guidance permits 30–43,200 seconds; its uncontrolled default is 30 days. The checker requires an explicit returned TTL between 30 seconds and the selected cap. It rejects missing/null TTL, the 30-day `-1` sentinel and longer values. This is template metadata, not an invented send-message field. Existing approved templates also need their TTL configured and checked; no external template update is automated.

Category **UTILITY**, positional parameters, no header/footer/promotion. Use these four body variables in exactly this order:

1. Customer's stored full name, from the business-scoped booking identity.
2. Business's current name.
3. Full Spanish appointment date in the business timezone, e.g. `miércoles 4 de noviembre de 2026`.
4. Start time in that timezone, e.g. `18:00`.

Explicit dates avoid a false “hoy”/“mañana” around midnight or after an allowed short delay. No technical identifiers appear in the visible message.

## Exact body text

`nukmiris_seven_day_v1`:

```text
Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. ¡Te esperamos!
```

`nukmiris_confirmation_v1`:

```text
Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. ¿Nos confirmas tu asistencia?
```

`nukmiris_followup_v1`:

```text
Hola {{1}}, todavía no recibimos tu confirmación para la cita en {{2}} el {{3}} a las {{4}}. ¿Nos confirmas si podrás asistir?
```

`nukmiris_final_v1`:

```text
Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. ¡Te esperamos!
```

The shared seven-day/final text is intentional; they have distinct job/template identities and schedules.

## Quick replies and webhook handling

For request/follow-up templates, configure exactly two `QUICK_REPLY` buttons in this order:

| Index | Visible title | Runtime payload |
| --- | --- | --- |
| 0 | Sí, confirmo | `reminder:<opaque UUID>:confirm` |
| 1 | Necesito reagendar | `reminder:<opaque UUID>:reschedule` |

The titles are **12 and 18 characters**, below WhatsApp's documented **25-character template quick-reply label** limit. There are two quick replies, within the documented maximum of ten, grouped together with no other button types. The app's separate 20-character ordinary interactive-button guard remains unchanged. Runtime payloads are 53/56 ASCII characters and contain no phone, customer name or Calendar ID. They are attached through template components with `type: button`, `sub_type: quick_reply`, string `index`, and a `type: payload` parameter. Customer action is identified by payload, not the button's displayed text. The supplied current components excerpt does not state the numeric payload-string ceiling; Messenger limits are not used as WhatsApp evidence.

Template replies use `messages[].type: button` with `button.payload`, corroborated by the official WhatsApp SDK; the app persists these in the same signed inbox as ordinary messages. Existing `interactive.button_reply.id` handling also supports reminder recovery/status buttons. Unknown, foreign, cancelled and old-schedule tokens cannot select a different appointment. Quoted text uses the exact `context.id` of its reminder and cannot fall back from a stale quote to a newer appointment. Generic Spanish confirmation needs an unambiguous current request without conflicting earlier request history, outside protected name/date input and human chat. The dependent 22-hour follow-up requires a `delivered`/`read` receipt for the 24-hour request, not just API acceptance.

## Submission and checking

Use PowerShell from `backend/`:

```powershell
npm.cmd run reminders:templates -- --business-id juanita-nails
```

The JSON contains all four definitions, example variable values and buttons. It is local output only; the command has no template creation/update request. Copy the exact body, category, language and buttons into WhatsApp Manager's template creation form, under the business account that owns its configured sending number. Supply meaningful synthetic sample variable values. Wait for Meta's approval; approval is external and cannot be promised by NukMiris.

After locally configuring that account's WABA ID using the preparation command described in [REMINDERS.md](REMINDERS.md), run:

```powershell
npm.cmd run reminders:templates -- --business-id juanita-nails --check
```

This makes read-only `GET /{WABA_ID}/phone_numbers` and `GET /{WABA_ID}/message_templates` requests. It verifies that the sending number belongs to that WABA, then checks the exact names, `APPROVED`, `UTILITY`, language, body variables/text, safe custom TTL and button types/order/titles. It reports returned quality information; approved low-quality templates remain eligible under Meta's supplied guidance until their status changes. The access token must have permission to inspect that WABA (normally `whatsapp_business_management`) as well as sending permission for actual reminders (`whatsapp_business_messaging`). No token or account ID is embedded in source code. An HTTP permission error or mismatched/unavailable template produces an explicit actionable error.

Live startup runs these checks before accepting bookings under live reminder mode. Every job reads sending-number membership and template status fresh; neither ownership nor positive approval is cached. Null TTL after automatic category changes, non-Utility category and any non-APPROVED/unavailable template prevent sending. Actual sends continue through the existing configured `/{PHONE_NUMBER_ID}/messages` Cloud API transport and shared `WHATSAPP_API_VERSION`, currently `v26.0`. A POST rejection for an unavailable template is recorded; there is no free-form fallback. Known transient failures retry only within the original deadline and bounded attempt count.

## Official references and verification boundary

Official Meta documentation to check before live activation:

- [Sending message templates](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/).
- [Template components and buttons](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components/).
- [Cloud API webhook components](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/).
- [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy).

Those official documentation sites returned proxy `403 Forbidden` from this cloud environment. During the compliance review, the owner supplied the current official fundamentals, Utility TTL, opt-in and correct WhatsApp template-component excerpts. Their concrete rules were checked against the code; the independently inspected official v26.0.2 Business SDK corroborates the configured API and TTL creation field. The report distinguishes those checks from the remaining live account/payload verification. The first supplied Messenger button page is explicitly excluded as evidence for WhatsApp limits.

As a fallback, the Meta-owned [WhatsApp API examples repository](https://github.com/fbsamples/whatsapp-api-examples/tree/de70ee908a67026e642aaee3703d20464e2a9466) was accessible and inspected at commit `de70ee908a67026e642aaee3703d20464e2a9466`. Its [template message helper](https://github.com/fbsamples/whatsapp-api-examples/blob/de70ee908a67026e642aaee3703d20464e2a9466/template-for-ecommerce-js/messageHelper.js) and [template controller](https://github.com/fbsamples/whatsapp-api-examples/blob/de70ee908a67026e642aaee3703d20464e2a9466/message-templates-js/complete-app/controller/messageTemplates.js) corroborate the general template/send/list endpoints and message structure. Some samples use old API versions; they do not establish current policy or button limits. Sample application code was not copied into NukMiris.

Offline tests verify the implemented payload/schema checks and webhook parsing. Actual Meta approval, real template delivery/button callbacks, and real Google attendance updates require the owner's PC test. No templates or live messages were submitted/sent by the cloud agent.
