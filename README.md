# NukMiris

WhatsApp appointment-management prototype for small businesses.

- `index.html` and `privacy.html`: the static public website.
- [`backend/`](backend/README.md): verified calendar availability through signed WhatsApp webhooks, plus [opt-in, confirmed new bookings](backend/BOOKING_CHECKPOINT.md) and [short appointment choices with date selection](backend/BOOKING_UX.md). Read-only [PC setup](backend/PC_SETUP.md) remains available; rescheduling and cancellation stay disabled.
- [`docs/handoffs/`](docs/handoffs/README.md): the dated engineering handoff and historical source snapshots.

To work on the backend, use Node 24.19.0, then run `npm ci --ignore-scripts` and `npm test` from `backend/`. No real accounts or database are needed for the tests. Read the backend's documented limitations before any manual live launch.
