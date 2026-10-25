# NukMiris

WhatsApp appointment-management prototype for small businesses.

- `index.html` and `privacy.html`: the static public website.
- [`backend/`](backend/README.md): calendar availability through signed WhatsApp webhooks, [short appointment choices with date selection](backend/BOOKING_UX.md), booking, and optional rescheduling/cancellation. The [current UX](backend/UX_CHECKPOINT.md) commits operations when customers select the target and shows upcoming appointments in the menu. Read-only [PC setup](backend/PC_SETUP.md) remains available.
- [`docs/handoffs/`](docs/handoffs/README.md): the dated engineering handoff and historical source snapshots.
- [Verified UX checkpoint](backend/UX_CHECKPOINT.md) and [saved project roadmap](docs/ROADMAP.md): accepted behavior and the authorized reliability work.
- [PC-verified v0.4.0 reliability checkpoint](backend/RELIABILITY_CHECKPOINT.md): saved incoming messages/replies, restart recovery, verified backup creation, and an isolated restore test.
- [PC-verified v0.4.1 dynamic availability](backend/DYNAMIC_AVAILABILITY.md): search 30 days, extend by 15 for three available dates, capped at 365 days for booking and rescheduling. The current two-plus-two UX is retained. The owner reported all testing-guide checks successful.
- [PC-verified v0.5.0 Spanish intent recognition](backend/INTENT_RECOGNITION.md): natural booking/rescheduling/cancellation phrases, negation/conflict handling, and context-aware clarification while preserving existing workflows and feature gates. All 347 offline tests pass, and the owner reported PC testing successful.
- [PC-verified v0.6.0 natural Spanish dates](backend/NATURAL_DATES.md): flexible date input in the existing booking/rescheduling flow, including numerical/month dates, relative expressions and weekdays, with business-local timezone and horizon checks. All 460 offline tests pass, and the owner reported manual testing successful.
- [PC-verified v0.7.0 simple menu instructions](backend/MENU_UX.md): shorter appointment prompts, one standard useful escape instruction and global `menu` navigation before every session handler. All 484 offline tests pass, and the owner confirmed successful PC testing; this is the current working baseline. Immediate booking and saved-request recovery are retained.

To work on the backend, use Node 24.19.0, then run `npm ci --ignore-scripts` and `npm test` from `backend/`. No real accounts or database are needed for the tests. Read the backend's documented limitations before any manual live launch.

For the owner's Windows PowerShell setup, use `npm.cmd` instead: `npm.cmd ci --ignore-scripts`, `npm.cmd test`, and `npm.cmd start`. This preference is saved in the [project continuity notes](docs/ROADMAP.md#windows-pc-command-preference) for future release/testing rounds.
