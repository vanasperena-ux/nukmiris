# Spanish WhatsApp intent recognition — v0.5.0

Built on the owner-verified v0.4.1 availability/reliability baseline. **v0.5.0 is now owner-verified on the Windows PC.** After the GitHub update at `b6a9169` and testing instructions, the owner reported **“I tested v.0.5.0 and all good!”** See [BASELINE.md](BASELINE.md) for evidence and scope; the guide remains available for regression testing. This checkpoint improves understanding of messages, using deterministic local rules with no LLM, AI service, new dependency, schema migration, or feature flag.

## Supported requests

| Intent | Supported wording and examples |
| --- | --- |
| `BOOK` | `cita`, `horarios`, `agendar`, `reservar`, `hacer/sacar/pedir/programar/apartar cita`, `nueva cita`, `quiero/necesito una cita`, `disponibilidad`, `tienen espacio`; `sacar/pedir/reservar turno`, `sacar/pedir hora`; “Hola, quiero una cita”, “Me puedes agendar?”, “Quiero otra cita”, “Hay disponibilidad esta semana?” |
| `RESCHEDULE` | `reagendar`, `reprogramar`, `cambiar/mover/posponer/adelantar/modificar/pasar` an appointment; `cambiar hora/horario/fecha/día/turno`; “Necesito cambiar mi cita”, “Puedo pasar mi cita al jueves?”, “Quiero modificar el horario”, “Reprogramar hora” |
| `CANCEL` | `cancelar`, `cancélame`, `anular/eliminar/quitar cita`, `dar de baja mi cita`, `cancelar reserva/reservación`, `anular turno`; “Cancélame la cita por favor”, “Necesito anular mi cita” |

Articles, possessives, polite surrounding language, capitals, Spanish accents, punctuation, whitespace, emojis and WhatsApp emphasis are handled for comparison. The existing customer message is passed unchanged to the existing storage/name/date handlers; the comparison string is separate. The centralized patterns are in `lib/intent-recognition.js`; `test/intent-recognition.test.cjs` lists every required primary expression and example.

## Recognition and clarification

The pure `recognizeIntent(message, context)` function returns `{ intent, matchedPhrase }`, with optional `options`, `attendance`, or `needsAppointmentContext` fields. Intent is `BOOK`, `RESCHEDULE`, `CANCEL`, `AMBIGUOUS`, or `UNKNOWN`. Matched phrases use normalized comparison text.

- Matches use complete words and known phrases, never `cita` as an arbitrary substring.
- Explicit change/cancel verbs take precedence over generic appointment terms. “Cancelar otra cita” cancels an existing appointment; “Quiero otra cita” starts a new booking.
- Multiple explicit actions, including “Quiero cancelar mi cita y hacer otra”, ask **“¿Qué quieres hacer primero?”** with the relevant intent buttons. Selecting an intent enters the existing workflow; it does not select an appointment or perform a Calendar write.
- Negated requests such as “No quiero cancelar mi cita” and information requests such as “Necesito información sobre cancelaciones” do not initiate a calendar action. Negation handling is conservative and supports explicit contrasts such as “no cancelar, sino reagendar”.
- “Ya no puedo ir”, “No podré asistir”, “No voy a poder ir”, “No asistiré”, and “No puedo mañana” require context. Only when relevant, the router uses the existing business/customer-scoped future appointment lookup. With an owned upcoming appointment it asks **“¿Quieres reagendar o cancelar tu cita?”**. Without one it does not infer cancellation.
- “No puedo mañana, mejor el jueves” can start rescheduling when that lookup establishes an owned upcoming appointment. The recognizer does not extract/select Thursday or a time; the existing date/time workflow handles the choice.
- A failed context lookup returns a calendar-lookup error and does not assume that no appointments exist.

Otherwise idle unknown messages receive **“No entendí qué necesitas. ¿En qué puedo ayudarte?”**, with **Agendar una cita**, **Reagendar mi cita**, and **Cancelar mi cita** buttons. Unknown text in the active main menu continues the existing invitation to speak to a person. Valid replies in an active workflow retain that workflow's guidance.

Clarification buttons use the existing business-scoped SQLite session, a fresh UUID, the actual displayed action list, and the normal 15-minute lifetime. Old, guessed, expired, cross-customer, and cross-business actions fail closed. Persisted replies expire with their session; restart recovery retains the same pending interaction.

## Active workflow precedence

1. Human chat owns all messages until **Menu**, including natural appointment phrases and the exact legacy appointment commands. Original support text is retained.
2. **Menu** and **Hola** retain their existing menu behavior. Accent/case/punctuation variants are accepted for comparison.
3. The exact legacy commands `cita`, `horarios`, `reagendar`, and `cancelar` retain their existing ability to switch flows. They remain reserved controls.
4. New natural phrases may start a flow from idle/menu/clarification states or a completed operation result. Names, registration, date/time browsing, appointment selection, and pending confirmation states take precedence over new natural phrases. Use Menu or an exact legacy command to switch from those states.
5. A pending/uncertain booking or management result keeps its existing recovery state. Natural phrases do not replace its saved result or status interaction. Existing exact command and journal/lock behavior is preserved.

This protects names such as “Cita Reagendar Cancelar García” while a name is expected. Typed `DD/MM/AAAA` dates, selected time IDs, “otra fecha”, and existing confirmations/status buttons continue through the original handlers.

## Preserved behavior

Natural requests map to the same `cita`, `reagendar`, and `cancelar` routing paths. The availability engine, dynamic 30/15/3/365 policy, Google clients, event creation/patch/deletion services, identity and ownership checks, event metadata, ETags, journals, locks, receiving-number routing, signatures, and backup/recovery mechanisms remain in use.

No disabled operation is enabled. Support mode retains its paused-appointment message. Availability mode remains read-only. Booking mode with management off retains its unavailable-management response. New customers still supply their name once; slot selection commits booking/rescheduling and appointment selection commits cancellation according to the verified v0.4.1 UX. No extra booking confirmation is introduced.

## Changed files

| Files | Purpose |
| --- | --- |
| `lib/intent-recognition.js` (new) | Central normalization, phrases, priority, negation, conflicts, and appointment-context contract |
| `lib/intent-menu.js` (new) | Existing-style persisted clarification buttons and stale-action validation |
| `whatsapp-webhook.js` | State-aware recognition, optional existing appointment lookup, canonical workflow routing, human-chat precedence and idle fallback |
| `lib/reliable-delivery.js` | Apply existing prompt expiry to the new `intent:` buttons |
| `test/intent-recognition.test.cjs` (new) | Every required phrase/example, normalization, negation, priorities, collisions and contextual rules |
| Existing support, availability, booking and management HTTP tests | Feature gates, name/date protection, clarification, ownership, failures, and original message preservation |
| Existing reliability/recovery tests | Clarification expiry and process restarts before using the saved buttons |
| `package.json`, `package-lock.json` | Version 0.5.0, new tests; installed dependency versions unchanged |
| Root/backend READMEs, `BASELINE.md`, `KNOWN_LIMITATIONS.md`, `../docs/ROADMAP.md`, this guide | Behavior, release/testing instructions, verified baseline and remaining limitations |

## Validation and limitations

The complete offline suite covers existing booking, availability, rescheduling, cancellation, authorization, concurrency, backup/restore and real subprocess crash-recovery tests, plus the new intent/conversation tests. All Google/Meta integrations in that suite are synthetic; cloud validation sends no real WhatsApp messages or Calendar writes. The owner subsequently reported the PC checkpoint successful; individual per-case logs were not supplied.

**Result: all 347 tests passed, with zero failures or skipped tests.** This retains the 214 existing regressions and adds 133 cases: 116 classifier tests, 14 signed HTTP conversation cases, and three clarification-expiry/restart cases. No live integration tests were possible in the cloud workspace. `git diff --check` passed.

This is a bounded phrase recognizer, not a general Spanish parser. Unsupported conjugations, typos, complex negation and implicit requests can fall back to clarification or existing active-flow guidance. Date/time language is never extracted or automatically selected. An intent classification itself never creates, moves, or deletes an event. Existing Calendar race/transport and single-PC limits in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) remain.

## Windows PC update

Stop Node with Ctrl+C. From the existing `backend/` folder in PowerShell:

```powershell
npm.cmd run backup:create
git pull --ff-only
node -p "require('./package.json').version"
npm.cmd test
npm.cmd run connections:check:management
npm.cmd start
```

The version must print **0.5.0**, and `npm.cmd test` must report **347 passed**, with zero failures/skips. Keep the existing `.env`, database, Google credentials/tokens, Meta connection, feature flags and Cloudflare tunnel. No new OAuth or migration/preparation command is needed. Dependencies are unchanged.

## Manual WhatsApp checks

Use test appointments. Start a new scenario with **Menu** unless the scenario deliberately tests an active flow. Recognition opens the existing workflow; select an actual appointment/time only when you intend the usual Calendar operation.

| Check | Expected result |
| --- | --- |
| “Hola, quiero una cita”, “Me puedes agendar?”, “Quiero sacar turno” | Existing two-plus-two availability choices; no event until a slot is selected |
| “Necesito cambiar mi cita”, “Puedo pasar mi cita al jueves?” | Existing owned-appointment rescheduling flow; no automatic selection of Thursday |
| “Cancélame la cita por favor”, “Necesito anular mi cita” | Existing cancellation appointment choices; no deletion until the appointment is selected |
| “Quiero cancelar mi cita y hacer otra” | Ask what to do first; do not cancel or create anything just from the message |
| With an owned upcoming appointment: “No puedo mañana” | Two choices: reschedule or cancel |
| With an owned upcoming appointment: “No puedo mañana, mejor el jueves” | Existing rescheduling flow, without automatically choosing a date/time |
| “No quiero cancelar mi cita”, “No quiero agendar una cita”, “Necesito información sobre cancelaciones” | No appointment changes; preserve the main menu's human-chat invitation if it is active |
| Unknown first message with no active session, or after the main-menu session expires | Generic clarification with the three intent buttons |
| New customer: choose a slot, then supply “Cita Reagendar García” as the name | Keep the name and book the selected slot once |
| During date browsing, type `DD/MM/AAAA`, then “Quiero cancelar mi cita” | Date selection still works; the new phrase does not overwrite the active date flow. Menu or exact `cancelar` can switch flows |
| Open **Hablar con alguien**, then send “Quiero agendar” and `Cancelar` | Store both as support messages; Menu exits human chat |
| Restart Node while clarification buttons are visible, then choose one within 15 minutes | Resume the existing workflow without performing a write just from choosing the intent |
| Reuse an older clarification button after Menu, or after its expiry | Friendly stale-option response; no appointment changes |
| Repeat normal booking/rescheduling/cancellation and restart smoke checks | Verified lifecycle, identity and reliability behavior remains intact |

Feature-disabled behavior is covered offline; do not change the working PC's feature flags just to test recognition. The owner has reported this checkpoint successful; retain the existing configuration and technical limits.
