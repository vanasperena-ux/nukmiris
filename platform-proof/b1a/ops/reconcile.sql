-- Controller is deliberately NOT granted worker or gateway mutation authority.
-- Reconciliation through original scoped worker identity; separate read-only
-- incident export and operator decision. No universal SQL UPDATE/rearm shortcut.
\set ON_ERROR_STOP on
SELECT proof.control_read(:'session'::uuid);
-- Worker calls proof.recover(scope,attempt) for each ORIGINAL attempt ID.
-- Entry state -> UNKNOWN; ARMED remains explicit-replay eligible. No new IDs.
