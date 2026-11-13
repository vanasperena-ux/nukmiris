-- WRITE ONLY FOR A LATER SEPARATELY AUTHORIZED DISPOSABLE CLOUD SQL DATABASE.
-- Invoke as intended runtime IAM identity; repeat as separately approved owner.
-- Do not run against accepted app/owner data. No DDL/role grants/RLS disabling.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT current_database() ~ '^inc1_disposable_[a-z0-9]+$' AS disposable \gset
\if :disposable
SELECT version(),current_user,session_user,current_setting('TimeZone'),current_setting('max_connections');
SELECT ssl,version,cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid();
SELECT rolname,rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname IN(current_user,session_user,'cloudsqlsuperuser','inc1_owner','inc1_gateway','inc1_worker');
SELECT member::regrole,roleid::regrole,admin_option,inherit_option,set_option FROM pg_auth_members WHERE member IN(SELECT oid FROM pg_roles WHERE rolname IN(current_user,session_user));
SELECT n.nspname,c.relname,pg_get_userbyid(c.relowner) owner,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('core','proof');
SELECT * FROM pg_policies WHERE schemaname IN('core','proof');
SELECT p.oid::regprocedure,pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('core','proof');
SELECT datname,numbackends FROM pg_stat_database WHERE datname=current_database();
\else
\echo REFUSED: explicitly authorized disposable database required
\quit 3
\endif
ROLLBACK;
-- Catalog evidence alone does NOT close MB-01. Later B1b must independently test
-- SET ROLE/owner membership and function entry, actual IAM session_user strings,
-- negative cross-tenant RLS, connection saturation and restore under intended roles.
-- Keep writes/fixtures in a separately reviewed authorization; do not bypass RLS.
