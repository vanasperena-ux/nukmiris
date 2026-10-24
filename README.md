# NukMiris

WhatsApp appointment-management prototype for small businesses.

- `index.html` and `privacy.html`: the static public website.
- [`backend/`](backend/README.md): the reconstructed v6A.4 support-only development baseline, with offline tests. Appointment actions remain disabled.
- [`docs/handoffs/`](docs/handoffs/README.md): the dated engineering handoff and historical source snapshots.

To work on the backend, use Node 24.19.0, then run `npm ci --ignore-scripts` and `npm test` from `backend/`. No real accounts or database are needed for the tests. Read the backend's documented limitations before any manual live launch.
