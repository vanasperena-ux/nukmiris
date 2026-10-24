# Short appointment choices — v0.2.1

This update changes how customers browse available appointments in both availability and booking modes. It preserves the calendar availability engine, business schedule/mappings, authorization, and confirmed-booking service from the verified v0.2.0 installation. On 2026-10-24 the owner accepted these changes (“Ok all good, the changes are accepted”); see [BASELINE.md](BASELINE.md). The subsequent optional rescheduling/cancellation update is documented in [MANAGEMENT_CHECKPOINT.md](MANAGEMENT_CHECKPOINT.md).

## Customer flow

1. **Cita**, **Horarios**, or the appointment menu button immediately offers the first two available appointments and **Más opciones**.
2. **Más opciones** offers the next two appointments and **Elegir fecha**.
3. **Elegir fecha** opens a list of available days. Customers can select a day or type a date as **DD/MM/AAAA**, including a date that is not on the first date list. The default search window remains 14 days; any existing configured window is retained.
4. After a day is selected, NukMiris checks the selected business's Google Calendar again and offers times for that day, two at a time. **Más horarios** continues within that day. At the end, **Elegir otra fecha** returns to dates. Customers can also type another date at any time during browsing.
5. Selecting an appointment follows the existing name/confirmation flow in booking mode. Only **Confirmar cita** creates the event. Availability mode continues to make no reservations.

If fewer appointments remain, only those choices are shown. With one or two total available appointments, the third step is reached directly through **Elegir fecha**. A fully booked or closed date offers another date; it never substitutes times from a different day. Invalid, past, and out-of-window dates receive guidance. **Menu** exits the flow.

The date list has up to eight days plus navigation, within WhatsApp's ten-row limit. Typing a date avoids paging through that list. This uses standard WhatsApp reply buttons and lists; date entry is text rather than a native calendar widget. Date/time labels use the selected business's time zone.

## Update the already working PC installation

Stop Node with Ctrl+C. From the repository folder:

```powershell
git pull --ff-only
cd backend
npm test
npm start
```

Keep the existing `.env`, database, Google tokens, and Meta/tunnel settings. No new packages, permissions, or database preparation are required after v0.2.0. If using a ZIP installation, update the public backend files, including `lib/availability-menu.js`, while keeping private configuration/data in place.

In WhatsApp, send **Menu**, then **Cita**. Try **Más opciones → Elegir fecha → a day → a time** and a typed date. In booking mode, verify that selection still leads to confirmation and that confirming creates exactly one appointment on the selected date in **Juanita's Nailsalon – Juanita**. Selecting a day/time alone must create no event. Use a test appointment. Rescheduling and cancellation require the separate v0.3.0 opt-in setup.

Old browsing buttons become invalid when another view is shown or a new flow begins. Browsing still expires after 15 minutes. An old availability menu from before the update asks the customer to send **Cita** again; existing booking confirmations retain their durable request identity.

## Automated validation

All 109 offline tests passed with no skipped tests. The suite covers the two-plus-two flow, date entry, date/time navigation, time-zone labels, fresh availability, fully booked/closed dates, limited availability, calendar errors, stale/expired actions, calendar changes, business isolation, and confirmed booking through both date selection and typed dates. It also retains the availability and durable-booking regression tests. These checks use synthetic data and simulated services; no live event is created by the cloud tests.
