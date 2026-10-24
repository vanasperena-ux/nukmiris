# NukMiris support-only backend

This is a reconstructed development baseline based on the handoff's v6A.4 source snapshot. The owner reports running that version on their PC. The PC file and installed dependency versions have not been compared directly; see [BASELINE.md](BASELINE.md).

**Appointment booking, rescheduling, and cancellation remain disabled.** The current sender-based business routing is a development simulation. The known audit gaps remain documented in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md); this checkpoint does not make the webhook ready for public or production use.

## Install and test without real accounts

Use Node 24.19.0 (also recorded in `.nvmrc`) and npm 11. From this directory:

```sh
npm ci --ignore-scripts
npm test
```

The tests use the real Express, Luxon, and SQLite dependencies, temporary synthetic databases, loopback HTTP, and mocked outbound integrations. They skip `.env` loading, never read the real database or OAuth files, and do not contact WhatsApp or Google. Temporary files are removed after the tests.

No credentials, business calendars, migrations, tunnel, or running PC application are needed for `npm test`. Tests protect the current support-only behavior; known security gaps are recorded separately rather than treated as passing production acceptance criteria.

## Local launch with existing development configuration

Live startup is a separate, manual operation. Keep your existing PC app stopped before opening its database from another process. Do not start a tunnel or connect real accounts as part of installation or testing.

1. Copy `.env.example` to an ignored `.env` in this directory and enter your existing development configuration locally. Do not paste credentials into chat or commit them.
2. Set `NUKMIRIS_DB_PATH` to the existing database that already has the Phase 6A.3 tables. An absolute path is supported; a relative path resolves from `backend/`. No database or migration is created automatically. Do not copy the real database into Git.
3. Set `WHATSAPP_VERIFY_TOKEN` to the value you have configured for the Meta subscription challenge. It is separate from `WHATSAPP_TOKEN`. The archived hardcoded value has been removed from this runtime.
4. Start with `npm start`. The default bind address is `127.0.0.1`, port 3000. Stop with Ctrl+C.

The `.env` path is anchored to this directory. Missing WhatsApp configuration, a nonexistent database, or missing Phase 6A tables stops startup. Do not copy Google OAuth credentials for this checkpoint: the inherited Calendar connection is not called and appointment actions remain blocked.

`GET /webhook` supports the existing Meta subscription challenge. There is no owner dashboard or general web interface yet. The repository's root `index.html` and `privacy.html` remain the separate static website.

## Development boundaries

Preserve the Spanish commands and replies, including `Hola`, `Cita`, `Reagendar`, `Cancelar`, and `Menu`. Use synthetic fixtures for tests. Keep the v5C.5 rollback and original v6A.4 source in the dated archive; do not run the booking-enabled rollback against a multi-business database. Migrations and calendar activation require separate work and validation.
