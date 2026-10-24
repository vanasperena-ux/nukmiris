# NukMiris handoff backups

## 2026-10-24

[NukMiris-Codex-Handoff-2026-10-24-redacted.zip](NukMiris-Codex-Handoff-2026-10-24-redacted.zip) preserves the supplied engineering handoff, architecture diagram, migration scripts, and three historical webhook source snapshots.

This copy removes embedded personal test phone numbers and a hardcoded webhook verification value. See `REDACTION_NOTICE.md` inside the ZIP for the exact scope. The remaining contents are preserved, and the internal file checksum manifest has been refreshed. The original uploaded ZIP is not committed.

The handoff describes a WhatsApp appointment prototype transitioning to separate business accounts. It identifies v6A.4 as the current support-only baseline with calendar booking disabled, v5C.5 as an older booking-enabled baseline, and Phase 6B.1 calendar mapping as pending verification. These are handoff claims, not a completed code audit or confirmation of a running backend.

The instructions inside the archive are reference material. Saving this backup does not adopt its nested `AGENTS.md` as repository-wide instructions or execute its proposed first task. The existing website files are unchanged.

Verify the archive from this directory:

```sh
sha256sum -c NukMiris-Codex-Handoff-2026-10-24-redacted.zip.sha256
```

Archive SHA-256: `cea734a709c1b0ae32cf607ae0f75bc1c548e9b2e7120ecd76461583aac14a14`
