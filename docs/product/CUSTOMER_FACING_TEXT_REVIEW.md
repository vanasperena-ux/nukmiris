# NukMiris — Customer-facing Spanish copy review

**Review draft:** 1.2 — 2026-11-16  
**Status:** OWNER-APPROVED COPY DECISIONS for R0, including editorial corrections; application code unchanged.  
**Source inspected:** `product/rc1-local-reschedule-cancel` (current RC-1 local/synthetic vNext development branch), using the linked TypeScript source below. This branch is **not** equivalent to approved production WhatsApp copy and should not be confused with the default branch or the legacy v0.8.1 runtime.
**Scope:** Strings emitted toward the *customer chat* by the vNext booking, appointment-management, date parser, name validation, appointment summary and WhatsApp interactive-presentation components. Simulator-only banners and owner-facing PWA UI are listed separately. Real Meta outbound templates/reminders are **not** wired into the reviewed vNext local synthetic flow; this audit is not a verification of approved Meta template bodies.

## Owner's reviewed wording — change register (2026-11-16)

**Target:** R0, feature NM-068. **Status:** OWNER-REQUESTED / DOCUMENTED, NOT IMPLEMENTED. The following table takes precedence over the historic “Current text” inventory below. The customer-facing replacements below include the owner's subsequently approved editorial corrections. Previous drafts preserve the original wording in Git history.

| CX ID | Owner-requested replacement | Scenario / implementation note |
|---|---|---|
| CX-001 | `Elige un horario` | Previously requested change to initial time options; confirm terminal punctuation only if necessary to avoid altering approved literal. |
| CX-002 | `Te muestro más opciones. Elige un horario:` | More available times (first set of extra slots). |
| CX-004 | `Te muestro más opciones. Elige un horario:` | More available times for a specifically selected date. |
| CX-008 | `No hay servicios activos disponibles. Contacta al negocio.` | **APPROVED DISTINCT SCENARIOS:** CX-008 applies when the business has no active services; preserve its existing service-specific wording. CX-007 already uses the owner's desired `No encontré horarios disponibles por ahora. Puedes llamar al negocio para consultar más opciones.` for the separate case of no available times. Do not display a time-availability explanation for missing services. |
| CX-012 | `Esa fecha ya pasó. Elige otra fecha o escríbela.` | Past date. |
| CX-013 | `Por ahora solo podemos agendar citas dentro de los próximos {n} días. Elige otra fecha o escríbela.` | Date beyond booking horizon. Keep {n} dynamic, not literal rendered braces. |
| CX-014 | `El día de la semana no coincide con la fecha. Elige otra fecha o escríbela.` | Weekday/date mismatch. |
| CX-015 | `Esa fecha no existe en el calendario. Elige otra fecha o escríbela.` | Impossible date. |
| CX-021 | `Hola {nombre, si se conoce}, bienvenido a {negocio}. Soy un bot que te ayuda a agendar, reagendar o cancelar una cita.` | Owner approved grammatical correction. Omit the optional name cleanly if unknown; placeholders are dynamic. |
| CX-022 | `¿En qué podemos ayudarte?\n\nEscribe "cita" o "agendar" para agendar una cita nueva. Escribe "reagendar" o "cancelar" para gestionar una cita.\n\nEscribe "menu" para volver al menú principal. Para solicitar apoyo, escribe "humano" o elige "Hablar con alguien".` | Owner approved removal of stray `n`, indentation and consistent paragraph breaks. |
| CX-024 | `Escribe tu mensaje. El bot ya no está activo.\n\nEscribe "menu" para activar el bot y volver al menú principal.` | Owner approved accent and spacing corrections. Existing human-mode silence and `menu` exit must remain unchanged. |
| CX-039 | `La cita ya no está disponible. Elige de nuevo.` | Appointment no longer valid for management. |
| CX-040 | `La cita ya no está disponible. Elige de nuevo.` | Appointment changed/invalid during manage action. |

**Editorial approval:** Owner confirmed on 2026-11-16 that the suggested grammatical, spelling and formatting corrections should be included. CX-008 remains a distinct no-active-services message while CX-007 covers no available time slots.\n\n**Acceptance criteria:** The correct text fires only for its CX scenario; variable values use business/customer context; customer messages display Spanish accents and actual paragraph breaks; old text is absent from its superseded context; dynamic and failure-safe booking logic stays unchanged. Test zero/one/multiple appointments, invalid dates, service-unavailable vs times-unavailable, human entry/exit, and stale/changed management choices.

**Scope:** This is a requirements/documentation update only. No source changes, tests or provider calls are authorized here. CX-008 scenario and CX-021/CX-022/CX-024 editorial questions are now resolved by owner approval. Other requested lines are ready for an explicitly authorized R0 copy-only change.

## Proposed edit from owner

**CX-001 — Initial and subsequent time-offer text (owner request)**

- Current initial: `Elige un horario que te funciona mejor:`
- **Proposed initial:** `Elige un horario` (user's requested exact text; punctuation to be confirmed)
- Current additional time slots: `Te muestro más opciones. Elige un horario que te funciona mejor:`
- **Proposed for discussion:** `Te muestro más opciones. Elige un horario.` or simply `Elige un horario`
- Current date-specific initial text: `¿Qué hora prefieres para el {fecha larga}?\n\nSelecciona el horario que prefieres. Para cambiar de día, escribe otra fecha.`
- **Proposed for discussion:** Keep date context but shorten/reduce duplicate instructions.
- The service-selection prompt `Elige un servicio para tu cita:` and rescheduling prompt `Elige otro horario para tu cita con {empleado}.` are distinct contexts and are **not** automatically changed.

Sources: [AvailabilityOracle](../../vnext/src/application/availability-oracle.ts), `timesOrSuggestions()`; [InteractiveBooking](../../vnext/src/application/interactive-booking.ts) rescheduling path.

## A. Booking and availability — customer chat

| ID | Scenario / trigger | Current text (literal or example template) | Type and notes |
|---|---|---|---|
| CX-001 | New appointment: initial time options; after selecting a service | **Elige un horario que te funciona mejor:** | **CHANGE REQUESTED** → `Elige un horario`. |
| CX-002 | Customer presses **Más opciones**; extra options after initial two | Te muestro más opciones. Elige un horario que te funciona mejor: | Candidate to shorten; not yet approved. |
| CX-003 | Customer has selected a specific date; initial times for that date | ¿Qué hora prefieres para el **{día completo}**? / Selecciona el horario que prefieres. Para cambiar de día, escribe otra fecha. | Two paragraphs; owner review suggested for brevity. |
| CX-004 | Further times for the selected date | Te muestro más opciones. Elige un horario que te funciona mejor: | Same source wording as CX-002, distinct context. |
| CX-005 | Customer selects **Elegir fecha** or enters date-choice path | ¿Para qué día te gustaría tu cita? Puedes escribir, por ejemplo: 13 oct, 13/10 o próximo lunes. | Date request + examples. |
| CX-006 | Date selected but no appointments available that day | No hay horarios disponibles para este día. Elige otra fecha o escríbela. | Date-specific no-availability fallback. |
| CX-007 | No available slots generally | No encontré horarios disponibles por ahora. Puedes llamar al negocio para consultar más opciones. | General no-availability fallback. |
| CX-008 | No active services configured | No hay servicios activos disponibles. Contacta al negocio. | Service catalog prerequisite absent. |
| CX-009 | Customer must choose from multiple configured services | Elige un servicio para tu cita:\n\n**{n}. {servicio} · {precio} {moneda} · {minutos} min** | Repeated service choices populated dynamically. |
| CX-010 | Customer selected a slot; not yet known to the business | Para reservar este horario, indícanos tu nombre completo. | New customer name prompt. |
| CX-011 | Customer supplied invalid/ambiguous name | Por favor, escribe tu nombre completo (máximo 120 caracteres), incluyendo ambos apellidos si los tienes.\n\nUsa mayúscula al inicio de cada nombre o escribe "Me llamo …" para aclararlo. | Potentially long for WhatsApp; source `NAME_REPROMPT`. |
| CX-012 | Date entered is past | Esa fecha ya pasó. ¿Qué otro día te gustaría? | Input error response. |
| CX-013 | Date is more than allowed 365-day horizon | Por ahora solo podemos agendar citas dentro de los próximos **{n}** días. ¿Qué otra fecha te gustaría? | Configured horizon value. |
| CX-014 | Typed weekday doesn't match calendar date | El día de la semana no coincide con la fecha. Revisa la fecha o elige otra opción. | Input error response. |
| CX-015 | Date doesn't exist in calendar (e.g., Nov 31) | Esa fecha no existe en el calendario. Escribe otra fecha o elige una opción. | Input error response. |
| CX-016 | Unrecognized or ambiguous date | No pude identificar bien la fecha. ¿Qué día te gustaría? Puedes escribir, por ejemplo: 13 oct, 13/10 o próximo lunes. | Generic date fallback. |
| CX-017 | Selected action expired or already used; booking flow | Esa opción venció o ya fue utilizada. Elige un horario de nuevo. | Prepended to fresh availability options. |
| CX-018 | Services or staff changed during booking flow | Los servicios o el equipo cambiaron. Elige de nuevo. | Prepended to refreshed options. |
| CX-019 | Selected slot no longer available / reservation timed out | Ese horario ya no está disponible o la reserva tardó demasiado. No se confirmó. Elige un horario de nuevo. | Prepended to new offers; no false confirmation. |
| CX-020 | Successful new booking | Tu cita está confirmada para **{fecha/hora corta}** con **{empleado}**.\n\n¡Te esperamos en **{negocio}**! | Confirmation after proven success. |

Source files: [availability-oracle.ts](../../vnext/src/application/availability-oracle.ts), [appointment-date.ts](../../vnext/src/domain/appointment-date.ts), [customer-name.ts](../../vnext/src/domain/customer-name.ts), [interactive-booking.ts](../../vnext/src/application/interactive-booking.ts).

## B. Menu, greeting and human support — customer chat

| ID | Scenario / trigger | Current text | Type and notes |
|---|---|---|---|
| CX-021 | Main menu, usually `menu` or `hola` | Hola **{nombre, si se conoce}**, bienvenido a **{negocio}**. | Greeting prepended to menu; check gender-neutral copy. |
| CX-022 | Main menu body | ¿En qué podemos ayudarte?\n\nEscribe "cita" o "agendar" para agendar una cita nueva, "horarios" para ver opciones y "menu" para volver al menú principal.\n\nPara solicitar apoyo, escribe "humano" o elige "Hablar con alguien".\n\nEscribe "reagendar" o "cancelar" para gestionar una cita. | Main menu also has buttons; potentially redundant/long. Last sentence conditional on catalog. |
| CX-023 | Main menu on a test profile without usable service catalog | "reagendar" y "cancelar" aún no están disponibles en esta prueba local. | **TEST-ONLY CONDITIONAL**, not appropriate for live customer. |
| CX-024 | Customer selects **Hablar con alguien** or types `humano` | Escribe tu mensaje.\n\nEscribe "menu" para volver al menú principal. | Entry-only acknowledgment. Subsequent messages in human mode are silent. |
| CX-025 | Internally available but ordinarily suppressed during human mode | Atención humana activa. | `ordinary()` contains text, but interactive-booking handles human-mode replies as silent; do **not** label as routinely sent. |
| CX-026 | Reschedule/cancel path in profile without supported catalog | Reagendar y cancelar aún no están disponibles en esta prueba local. No se modificó ninguna cita. | **TEST-ONLY CONDITIONAL**, followed by menu. |
| CX-027 | Non-human fallback internally | Menú | Internal view fallback; not necessarily a standalone delivered message. |
| CX-028 | Interactive main menu choices | Agendar una cita · Reagendar / cancelar · Hablar con alguien | WhatsApp reply-button labels, not prose. |

Source files: availability-oracle.ts, interactive-booking.ts, classification.ts. Main-menu output can also contain existing appointment summary (next table).

## C. Existing appointments, management, rescheduling, cancellation

| ID | Scenario / trigger | Current text | Type and notes |
|---|---|---|---|
| CX-029 | Menu or booking command; exactly one upcoming appointment | Tu cita actual es para el **{fecha larga}**, de **{inicio}** a **{fin}**. | Appointment summary; note “actual” means upcoming in this implementation. |
| CX-030 | Menu or booking command; multiple upcoming appointments | Tus próximas citas:\n**1. {fecha larga}, {inicio}–{fin}**\n**2. ...** | Summary contains all; split into bounded messages when needed. |
| CX-031 | Previously booked appointment where confirmation delivery could not be verified | Cita registrada para el **{fecha larga}**, de **{inicio}** a **{fin}**. La entrega de su confirmación no está verificada. | Important non-confirming status; register for separate tone review. |
| CX-032 | Customer selects **Reagendar / cancelar** | ¿Qué te gustaría hacer con tu cita? | Options **Reagendar**, **Cancelar**. |
| CX-033 | Customer chooses **Cancelar** and has upcoming appointments | Selecciona la cita que deseas cancelar. Se cancelará al seleccionarla.\n\n**{n}. {servicio} · {fecha/hora} · {empleado}** | Selecting the listed appointment directly cancels; no second confirmation step. |
| CX-034 | Customer chooses **Reagendar** and has upcoming appointments | Selecciona la cita que deseas reagendar.\n\n**{n}. {servicio} · {fecha/hora} · {empleado}** | Appointment selection required even if only one. |
| CX-035 | No eligible upcoming appointments for requested management action | No encontré citas próximas. Si deseas agendar una nueva cita, escribe "cita". | Applies to cancel or reschedule. |
| CX-036 | Reschedule selection completed; now choose replacement slot | Elige otro horario para tu cita con **{empleado}**.\n\n**{availability prompt}** | Keeps original employee. May double-up the prompt with “Elige un horario …”. |
| CX-037 | Reschedule successful | ¡Tu cita está reagendada!\n\n**{servicio}**\nAntes: **{fecha/hora anterior}**\nAhora: **{fecha/hora nueva}**\nCon **{empleado}**.\n\n¡Te esperamos en **{negocio}**! | Success confirmation once proven. |
| CX-038 | Cancellation successful | Tu cita de **{servicio}** del **{fecha/hora}** con **{empleado}** está cancelada. | Success after proven cancellation. |
| CX-039 | Selected appointment no longer exists/was changed | La cita cambió o ya no está disponible. Elige de nuevo. | Reopens appointment picker. |
| CX-040 | Selected appointment changes while in manage flow | La cita cambió o ya no está disponible para esta acción. Elige de nuevo. | Reopens appointment picker. |
| CX-041 | Management action was stale/used | Esa opción venció o ya fue utilizada. Elige de nuevo. | Reopens picker. |
| CX-042 | Services/staff changed during management | Los servicios o el equipo cambiaron. Elige de nuevo. | Reopens picker. |
| CX-043 | Could not safely offer a management action | No pude ofrecer un cambio seguro para esta cita. El negocio debe verificarla; no se confirmó ningún cambio de esta solicitud. | Needs Attention; offers **Elegir otra cita** / **Hablar con alguien**. |
| CX-044 | Management conflict/timeout | Esta solicitud no se confirmó. Revisa tus citas y elige de nuevo. | Reopens picker. |
| CX-045 | Management request is entered but unresolved | Tu cambio sigue en verificación. Consulta su estado antes de solicitar otro cambio o reserva. La cita y sus horarios siguen protegidos mientras el negocio verifica el resultado. | **LOCAL SNAPSHOT STATUS**, not automatically an outbound WhatsApp message. |
| CX-046 | Management request is prepared/armed | Estamos procesando tu solicitud. Aún no se ha confirmado ningún cambio. | **LOCAL SNAPSHOT STATUS**, not necessarily a sent customer message. |
| CX-047 | Management request expired before sending | La solicitud venció sin enviarse. No se realizó ese cambio. Escribe reagendar o cancelar para elegir de nuevo. | **LOCAL SNAPSHOT STATUS**, not necessarily sent. |

Source: [appointment-management.ts](../../vnext/src/application/appointment-management.ts), [interactive-booking.ts](../../vnext/src/application/interactive-booking.ts), [appointment-summary.ts](../../vnext/src/domain/appointment-summary.ts).

## D. Customer-facing interactive controls (WhatsApp presentation)

| ID | Context | Labels shown |
|---|---|---|
| CX-048 | Availability | Date/time formatted e.g. **sáb 7 nov 09:00**; **Más opciones**, **Elegir fecha**, **Más horarios**, **Elegir otra fecha** |
| CX-049 | Date selection | **Elegir fecha**, **Fechas disponibles**, date titles e.g. **sáb 7 nov**, **Fechas anteriores**, **Más fechas** |
| CX-050 | Service list | **Elegir servicio**, **Servicios**, listed service names (may be truncated) plus **Servicios anteriores**, **Más servicios** |
| CX-051 | Appointment management | **Elegir cita**, **Próximas citas**, choices **Reagendar**, **Cancelar**, appointment titles and **Citas anteriores**, **Más citas** |
| CX-052 | Human and held paths | **Hablar con alguien**, **Elegir otra cita** |
| CX-053 | Main menu | **Agendar una cita**, **Reagendar / cancelar**, **Hablar con alguien** |

Notes: WhatsApp presentation switches between text, reply buttons and interactive list as available; the actual Meta account's transport remains outside this local synthetic scope. The list titles `Elegir fecha`, `Elegir servicio`, and `Elegir cita` are generated in [whatsapp-presentation.ts](../../vnext/src/domain/whatsapp-presentation.ts).

## E. Simulator / owner UI, **not** real customer WhatsApp copy

The browser simulator has separate test-only text such as `Hola, ¿agendamos?`, `Escribe cita para ver dos horarios, o menu para el menú principal.`, `Tu próxima cita empieza aquí.`, `Conectado · solo datos sintéticos`, and its appointment/calendar/Needs Attention panels. These are **not messages emitted by the booking engine to real customers** and should not be mixed into the main copy-approval list. See [local simulator index](../../vnext/local/web/index.html) and [simulator app](../../vnext/local/web/app.js).

## F. Messages **not covered by the current vNext runtime audit**

- Approved Meta reminder templates (one-week, one-day confirmation, two-hour reminder) and opt-in/out text from the earlier v0.8.x app: **requires a separate legacy/Meta-template-source comparison** before saying the full production WhatsApp copy catalog is complete.
- Future owner-defined onboarding messages, waiting list, broadcast/marketing messages, imported-customer confirmation and automated exception notices not yet implemented in this inspected vNext branch.
- Customer-facing text that might be added on other active feature branches not merged into the inspected `product/rc1-local-reschedule-cancel` branch.
- Locale and dynamic substitution variants. The tables show structural templates, not every date/name/price combination.

## Review status\n\nPrior editorial questions concerning CX-008, CX-021, CX-022 and CX-024 were resolved by the owner. CX-001 remains the requested literal `Elige un horario`. No code has been changed.\n\n**Change policy:** This is a review document, not a code change or Codex authorization. Once owner approves specific CX IDs, update the Feature Register's copy requirement and implement via separately authorized change with regression tests.
