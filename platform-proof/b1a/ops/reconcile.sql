-- Future authorized independent controller only, after verified signed bundle.
-- retirement_digest binds the independently verified fence/canary/ledger bundle.
-- No worker/admin table UPDATE and no outcome invention or rearm.
\set ON_ERROR_STOP on
SELECT proof.control_read(:'session'::uuid);
SELECT proof.recover_retired(:'session'::uuid,:'original_attempt'::uuid,:'retirement_digest');
