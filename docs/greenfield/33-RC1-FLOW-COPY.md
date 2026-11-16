# RC-1 local flow and copy matrix

Authorization: Issue [#26](https://github.com/vanasperena-ux/nukmiris/issues/26#issuecomment-6922799623), corrected SE-1/N1 source `95b122771b0958c0bc9bda07db1dab14f35aeb67`. Register v1.4 at `59cde023d2dff088161c1d01bd76c1099386e13f` (local immutable reference: `references/FEATURE_REGISTER_v1.4_59cde02.md`). This is an implementation copy matrix for owner acceptance, not another planning/authorization gate.

| Trigger | Customer / WhatsApp copy and flow | Owner / synthetic employee calendar |
|---|---|---|
| `menu` / `hola` | Existing all-upcoming summary, then **Agendar una cita / Reagendar / cancelar / Hablar con alguien**. No appointment picker here. | No mutation. |
| Direct `cita` / `agendar`, menu booking and intermediate dates | Preserve NM-031/032 trigger table: summary only on approved direct commands, no repeated summary on buttons/date continuation. | Existing booking behavior unchanged. |
| Menu **Reagendar / cancelar** | “¿Qué te gustaría hacer con tu cita?” → **Reagendar / Cancelar**. Then the exact appointment picker; always, including one appointment. | No mutation. |
| Direct `reagendar` / `cancelar` | Picker: “Selecciona la cita que deseas reagendar.” / “Selecciona la cita que deseas cancelar. Se cancelará al seleccionarla.” Date/service/employee distinguish appointments; paginated lists respect Meta limits. No extra cancellation confirmation or obsolete menu suffix. | No mutation until exact selection. |
| No upcoming appointment | “No encontré citas próximas. Si deseas agendar una nueva cita, escribe \"cita\".” | History remains available. |
| Reschedule appointment selected | Two replacement suggestions, more options/date selection, original employee only. Preserve booked service identity, snapshot, duration and buffer. Selecting replacement performs the change directly. | Hold old and proposed ranges until proof; update the same fake event, never create a second appointment. |
| Move proven | “¡Tu cita está reagendada!” + service, **Antes / Ahora**, employee and business. | Current status **Confirmada**; append old/new time, request/applied timestamps and **Cliente (WhatsApp)** origin to history. |
| Cancellation proven | “Tu cita de [servicio] del [fecha/hora] con [empleado] está cancelada.” | Delete the exact fake event, release protection only on proven finalization. Keep appointment/history. Cancelled entries hidden in owner calendar by default; toggle shows grey **Cancelada** at its last reserved date/time. |
| Stale/expired/competing change | Explain the option/cita changed or expired, refresh safe appointment choices; no success assertion. | No additional effect. |
| Employee inactive/unqualified, held operation or missing old snapshot | Honest no-safe-change message; **Hablar con alguien / Elegir otra cita**, with Needs Attention. Never silently allocate a different employee. | Preserve original appointment/protections. |
| Pending / uncertain outcome | Local conversation status: “Tu cambio sigue en verificación. Consulta su estado antes de solicitar otro cambio o reserva.” Clarify original appointment/slot remains protected. It is derived from durable operation state, not an additional external send. No success or blind retry. | Visible protected/Needs Attention status; reconcile only from the same attempt's evidence. |

The legacy reference is `backend/lib/management-menu.js` and `appointment-messages.js`. The approved RC-1 contract supersedes legacy single-appointment auto-selection and its extra confirmation/retry mechanics; those mutation mechanisms are not transplanted.

Owner clarification during RC-1: **an existing appointment for an inactive service may reschedule** with the original eligible employee and preserved service snapshot. Service deactivation still prevents new bookings. Cancellation remains available irrespective of service/employee active status. An inactive/unqualified original employee cannot be replaced automatically. Older appointments with no trustworthy service snapshot go to Needs Attention instead of inventing metadata.

This increment changes synthetic calendars only. Exact Google Calendar deletion/move, provider reconciliation limitations and actual Meta sends remain separately authorized real-provider gates. No employee accounts, invitations or notifications, real integrations, protected-profile upgrades, cloud work or merges.
