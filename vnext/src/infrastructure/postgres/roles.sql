DO $$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['wp1_owner','wp1_definer','wp1_ingress','wp1_sealer','wp1_reducer','wp1_dispatch','wp1_result','wp1_operator','wp1_recovery','wp1_tenant_a','wp1_tenant_b'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('CREATE ROLE %I %s',r,CASE WHEN r IN ('wp1_owner','wp1_definer') THEN 'NOLOGIN' ELSE 'LOGIN' END); END IF;
  IF r NOT IN ('wp1_owner','wp1_definer') THEN
   EXECUTE format('ALTER ROLE %I SET lock_timeout = %L',r,'3s');
   EXECUTE format('ALTER ROLE %I SET idle_in_transaction_session_timeout = %L',r,'10s');
   EXECUTE format('ALTER ROLE %I SET statement_timeout = %L',r,'10s');
  END IF;
 END LOOP;
 ALTER ROLE wp1_definer BYPASSRLS;
END $$;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO wp1_definer;
GRANT USAGE ON SCHEMA core TO wp1_owner,wp1_definer,wp1_ingress,wp1_sealer,wp1_reducer,wp1_dispatch,wp1_result,wp1_operator,wp1_recovery,wp1_tenant_a,wp1_tenant_b;
GRANT ALL ON ALL TABLES IN SCHEMA core TO wp1_definer;
GRANT ALL ON ALL SEQUENCES IN SCHEMA core TO wp1_definer;

-- Global restoration is available only to the dedicated fixture recovery role.
-- Destination must be empty. It has no authority to enable any dispatch head.
CREATE FUNCTION core.restore_snapshot(snap jsonb,evidence jsonb,reason_value text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE t text; item jsonb; b text; subject_value text;
BEGIN
 IF snap IS NULL OR evidence IS NULL OR reason_value IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 IF session_user<>'wp1_recovery' OR snap->>'format' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'recovery_denied'; END IF;
 IF EXISTS(SELECT 1 FROM core.business) THEN RAISE EXCEPTION 'recovery_destination_not_empty'; END IF;
 FOREACH t IN ARRAY ARRAY['business','channel','calendar','resource','customer','conversation','seal','batch','input','batch_input','permission_head','permission_event','status_event','appointment','operation','mutation_guard','protection','output_intent','attempt','receipt','recovery_case','audit'] LOOP
  -- Protection ranges are serialized by the fixture snapshot as their PG text.
  EXECUTE format('INSERT INTO core.%I OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_recordset(NULL::core.%I,$1)',t,t) USING coalesce(snap->'tables'->t,'[]'::jsonb);
 END LOOP;
 PERFORM setval(pg_get_serial_sequence('core.audit','id'),greatest(1,coalesce((SELECT max(id) FROM core.audit),0)),EXISTS(SELECT 1 FROM core.audit));
 UPDATE core.business SET status='SUSPENDED',revision=revision+1,dispatch_enabled=false,recovery_epoch=recovery_epoch+1;
 UPDATE core.permission_head SET suppressed=true,revision=revision+1;
 UPDATE core.attempt SET state='UNKNOWN' WHERE state IN ('ARMED','SUBMISSION_ENTERED');
 UPDATE core.output_intent SET state='UNKNOWN' WHERE state IN ('ARMED','SUBMISSION_ENTERED');
 FOR item IN SELECT value FROM jsonb_array_elements(evidence) LOOP
  b=item->'body'->>'businessId';
  IF b IS NULL THEN b=item->'body'->'intent'->>'businessId'; END IF;
  IF EXISTS(SELECT 1 FROM core.business WHERE business_id=b) THEN
   INSERT INTO core.recovery_case VALUES(b,item->>'key',reason_value,item) ON CONFLICT DO NOTHING;
   IF item->>'kind'='SUPPRESSION' THEN
    subject_value=item->'body'->>'subject';
    INSERT INTO core.permission_head(business_id,subject,purpose,revision,suppressed,last_revoke_at)
    VALUES(b,subject_value,'REMINDER',(item->'body'->>'revision')::bigint,true,(item->'body'->>'occurredAt')::timestamptz)
    ON CONFLICT(business_id,subject,purpose) DO UPDATE SET suppressed=true,
      revision=greatest(core.permission_head.revision,excluded.revision),last_revoke_at=greatest(core.permission_head.last_revoke_at,excluded.last_revoke_at);
   END IF;
  END IF;
 END LOOP;
END $$;

DO $$
DECLARE t record; f record;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='core' LOOP
  EXECUTE format('ALTER TABLE core.%I OWNER TO wp1_owner',t.tablename);
  IF t.tablename<>'role_scope' THEN
   EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY',t.tablename);
   EXECUTE format('ALTER TABLE core.%I FORCE ROW LEVEL SECURITY',t.tablename);
   EXECUTE format('CREATE POLICY scoped ON core.%I USING (core.scope_allowed(business_id)) WITH CHECK(core.scope_allowed(business_id))',t.tablename);
   EXECUTE format('GRANT SELECT ON core.%I TO wp1_ingress,wp1_sealer,wp1_reducer,wp1_dispatch,wp1_result,wp1_operator,wp1_recovery,wp1_tenant_a,wp1_tenant_b',t.tablename);
  END IF;
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='core' LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO wp1_definer',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION core.scope_allowed(text) TO wp1_ingress,wp1_sealer,wp1_reducer,wp1_dispatch,wp1_result,wp1_operator,wp1_recovery,wp1_tenant_a,wp1_tenant_b;
GRANT EXECUTE ON FUNCTION core.register_seal(text,text,text,text,jsonb) TO wp1_sealer;
GRANT EXECUTE ON FUNCTION core.stage_batch(text,text,text,jsonb),core.activate_batch(text,text,text,text),core.suppress(text,text,text,text,timestamptz) TO wp1_ingress;
GRANT EXECUTE ON FUNCTION core.prepare_operation(text,jsonb,text,text),core.prepare_output(text,uuid,uuid,jsonb,text,text,text) TO wp1_reducer;
GRANT EXECUTE ON FUNCTION core.arm(text,uuid,uuid,text,text),core.enter_submission(text,uuid,uuid,timestamptz),core.mark_unknown(text,uuid),core.expire_unsent(text,uuid,timestamptz) TO wp1_dispatch;
GRANT EXECUTE ON FUNCTION core.apply_result(text,uuid,jsonb,text,text,text),core.accept_receipt(text,uuid) TO wp1_result;
GRANT EXECUTE ON FUNCTION core.suppress(text,text,text,text,timestamptz),core.grant_permission(text,text,text,text,bigint,timestamptz,timestamptz,text),core.set_status(text,text,text,text,bigint,text) TO wp1_operator;
GRANT EXECUTE ON FUNCTION core.restore_snapshot(jsonb,jsonb,text) TO wp1_recovery;

GRANT EXECUTE ON FUNCTION core.abandon_unsent(text,uuid,text,text) TO wp1_operator;

GRANT EXECUTE ON FUNCTION core.hold_input(text,uuid,text,text) TO wp1_operator;
