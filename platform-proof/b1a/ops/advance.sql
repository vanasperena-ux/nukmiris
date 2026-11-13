-- PRINTED FOR FUTURE AUTHORIZED OPERATOR. psql service must verify-full pinned CA
-- and actual Cloud SQL DNS name; controller only, never superuser/runtime role.
\set ON_ERROR_STOP on
BEGIN;
SELECT proof.control_hold(:'session'::uuid,'FENCE_INCOMPLETE');
SELECT proof.control_advance(:'session'::uuid,1,2,'nmb1a-gateway-e000002-r1');
COMMIT;
SELECT proof.control_read(:'session'::uuid);
