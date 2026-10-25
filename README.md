# NukMiris

WhatsApp appointment-management prototype for small businesses.

- `index.html` and `privacy.html`: the static public website.
- [`backend/`](backend/README.md): calendar availability through signed WhatsApp webhooks, [short appointment choices with date selection](backend/BOOKING_UX.md), booking, and optional rescheduling/cancellation. The [current UX](backend/UX_CHECKPOINT.md) commits operations when customers select the target and shows upcoming appointments in the menu. Read-only [PC setup](backend/PC_SETUP.md) remains available.
- [`docs/handoffs/`](docs/handoffs/README.md): the dated engineering handoff and historical source snapshots.
- [Current UX checkpoint](backend/UX_CHECKPOINT.md) and [saved project roadmap](docs/ROADMAP.md): the requested improvements now, reliability/restart recovery next.

To work on the backend, use Node 24.19.0, then run `npm ci --ignore-scripts` and `npm test` from `backend/`. No real accounts or database are needed for the tests. Read the backend's documented limitations before any manual live launch.

For the owner's Windows PowerShell setup, use `npm.cmd` instead: `npm.cmd ci --ignore-scripts`, `npm.cmd test`, and `npm.cmd start`. This preference is saved in the [project continuity notes](docs/ROADMAP.md#windows-pc-command-preference) for future release/testing rounds.
