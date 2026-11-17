# NM-068 — exact copy and scenario traceability

Original exact-copy authority: **Feature Register v1.12** and **Customer-Facing Text Review v1.3**, both at **0ad6d508868b4f6a879825426b3b02509fc9e40c**, paths `docs/product/NUKMIRIS_FEATURE_REGISTER.md` and `docs/product/CUSTOMER_FACING_TEXT_REVIEW.md`. The definitive v1.12 table is unchanged in the now-controlling **v1.13**, commit **6c1cdf67fe49b677a6ba16d964badcbc7318b303**; copy review remains v1.3. This is implementation-branch evidence; the authoritative documentation branch is untouched.

Tests: [`vnext/test/l2-rm1-copy.test.ts`](../../../vnext/test/l2-rm1-copy.test.ts), **15 focused cases passed**. Exact literals are transcribed independently of production constants. Final full/runtime results and tested SHA belong to [evidence](../../../vnext/evidence/rm1/README.md); native Windows acceptance is pending.

| CX ID | Existing scenario / actual implementation | Exact expected output | Focused test / result |
|---|---|---|---|
| CX-001 | `availability-oracle.ts` → `timesOrSuggestions`, first offer | `Elige un horario` | CX001/CX002/CX004: PASS; no punctuation |
| CX-002 | Same → more general suggestions | `Te muestro más opciones. Elige un horario:` | CX001/CX002/CX004: PASS |
| CX-004 | Same → next time page on selected day | `Te muestro más opciones. Elige un horario:` | CX001/CX002/CX004: PASS; CX003 unchanged |
| CX-008 | `availability-oracle.ts` → `services`, existing empty active-service page | `No encontré horarios disponibles por ahora. Puedes llamar al negocio para consultar más opciones.` | CX008: PASS; SERVICES state/zero actions retained; no operation/customer/booking allocation |
| CX-012 | `appointment-date.ts` → `dateErrorMessage`, PAST | `Esa fecha ya pasó. Elige otra fecha o escríbela.` | CX012: PASS through conversation handler |
| CX-013 | Same → OUT_OF_HORIZON; `interactive-booking.ts` passes `bookingHorizonDays(config)` to parser and feedback | `Por ahora solo podemos agendar citas dentro de los próximos {n} días. Elige otra fecha o escríbela.` | CX013: PASS with default 365, configured 30 and 90; actual numerals/no braces; parser/search use same value |
| CX-014 | Same → WEEKDAY_MISMATCH | `El día de la semana no coincide con la fecha. Elige otra fecha o escríbela.` | CX014: PASS; previous choices retained |
| CX-015 | Same → IMPOSSIBLE | `Esa fecha no existe en el calendario. Elige otra fecha o escríbela.` | CX015: PASS; no overflow/booking |
| CX-021 | `interactive-booking.ts` → menu greeting prefix | `Hola {nombre}, bienvenido a {negocio}. Soy un bot que te ayuda a agendar, reagendar o cancelar una cita.` | CX021/CX022: PASS known/unknown, business isolation; no name yields `Hola, bienvenido a …` |
| CX-022 | `availability-oracle.ts` → `menu` body | Exact block below | CX021/CX022: PASS; same three menu choices; 0/1/many separate overview retained |
| CX-024 | Same → `humano` entry | Exact block below | CX024: PASS; no overview, saved subsequent message, silence and menu exit |
| CX-039 | `interactive-booking.ts` → stale/unavailable appointment picker choice | `La cita ya no está disponible. Elige de nuevo.` | CX039: PASS; exact prefix before the unchanged recovery picker; no mutation |
| CX-040 | Same → `ensureSelected`, selected appointment changes before continued availability | `La cita ya no está disponible. Elige de nuevo.` | CX040: PASS; exact prefix before recovery picker; original protected booking retained |

CX-022 body (two actual blank lines separating three paragraphs):

```text
¿En qué podemos ayudarte?

Escribe "cita" o "agendar" para agendar una cita nueva. Escribe "reagendar" o "cancelar" para gestionar una cita.

Escribe "menu" para volver al menú principal. Para solicitar apoyo, escribe "humano" o elige "Hablar con alguien".
```

CX-024 body:

```text
Escribe tu mensaje. El bot ya no está activo.

Escribe "menu" para activar el bot y volver al menú principal.
```

The application may prepend the existing appointment overview and CX021 greeting to the menu, or split the prefix into the existing bounded ordered message batch when required by presentation limits. The body remains exact. The historical no-catalog test harness retains its separate unsupported-management notice (CX023); the actual catalog-enabled RC-1 application does not display it. Human entry never includes an appointment overview.

The availability configuration now has optional `maxBookingHorizonDays` with the accepted default **365**, valid integers **1–365**, shared across availability search, date-page navigation, parser and feedback. No owner setting/UI, persisted catalog schema, booking reservation authorization or SQL protection is changed. The protected-calendar reader retains its conservative existing 365-day protection-read range; a shorter offer horizon does not remove protections. Neither default allocation nor the accepted date grammar changes.

The historical legacy date acceptance corpus is still used. Its single obsolete CX012 editorial expectation is explicitly adapted in `l2-date-parity.test.ts`; all parser, invalid-zone, configured-horizon and other assertions remain. No legacy file is edited. Existing old-copy assertions in the L1 offer and SE-1 no-services tests are updated to the approved strings without removing their safety assertions. CX006/007, menu choices, name prompts, date prompts, booking confirmations, expiry/catalog-conflict messages and other CX IDs remain unchanged.

These statuses mean **implemented, automated local tests passed; owner acceptance pending**. They do not close R0 or authorize later roadmap releases.
