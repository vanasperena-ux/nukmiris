-- Disposable synthetic proof only; deliberately outside all application migrations.
SET ROLE inc1_owner;
CREATE FUNCTION proof.runtime_ready(s uuid,scope uuid,e bigint,r text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
 SELECT coalesce((SELECT dispatch_enabled AND expires_at>clock_timestamp() AND scope_id=scope AND epoch=e AND revision=r FROM proof.experiment_control WHERE session_id=s),false)
$$;
CREATE FUNCTION proof.worker_pending(s uuid,scope uuid,e bigint,r text) RETURNS SETOF jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
 SELECT jsonb_build_object('scopeId',a.scope_id,'batchId',a.batch_id,'payload',a.payload) FROM proof.synthetic_admission a
 WHERE proof.runtime_ready(s,scope,e,r) AND a.scope_id=scope AND a.state='ELIGIBLE'
 AND NOT EXISTS(SELECT FROM proof.attempt w WHERE w.id=(a.payload->>'attemptId')::uuid AND w.state<>'ARMED') ORDER BY a.batch_id LIMIT 20
$$;
CREATE FUNCTION proof.worker_plan_b1a2(session uuid,scope uuid,b uuid,e bigint,r text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
DECLARE a proof.synthetic_admission;p jsonb;
BEGIN
 IF NOT proof.runtime_ready(session,scope,e,r) THEN RAISE EXCEPTION 'synthetic_dispatch_held';END IF;
 SELECT * INTO a FROM proof.synthetic_admission WHERE scope_id=scope AND batch_id=b AND state='ELIGIBLE';p:=a.payload;
 IF a.batch_id IS NULL OR p->>'synthetic'<>'true' OR (p->>'epoch')::bigint<>e OR p->>'revision'<>r THEN RAISE EXCEPTION 'sealed_binding_required';END IF;
 PERFORM proof.plan(scope,(p->>'attemptId')::uuid,(p->>'operationId')::uuid,e,r,p->>'payloadDigest',p->'payload',(p->>'deadlineAt')::timestamptz,(p->>'inboundTimeoutAt')::timestamptz);
 RETURN jsonb_build_object('scopeId',scope,'attemptId',p->>'attemptId');
END $$;
CREATE FUNCTION proof.enter_b1a2(session uuid,s uuid,a uuid,o uuid,e bigint,r text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
BEGIN
 IF NOT EXISTS(SELECT FROM proof.synthetic_admission WHERE scope_id=s AND state='ELIGIBLE' AND payload->>'attemptId'=a::text AND payload->>'epoch'=e::text AND payload->>'revision'=r) THEN RETURN jsonb_build_object('entered',false,'state','HELD');END IF;
 RETURN proof.enter_b1a(session,s,a,o,e,r);
END $$;
CREATE OR REPLACE FUNCTION proof.admission_sealer_read(s uuid,b uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
 SELECT jsonb_build_object('digest',digest,'payload',payload,'state',state,'sealDigest',seal_digest) FROM proof.synthetic_admission WHERE scope_id=s AND batch_id=b
$$;
-- Prevent a repeated seal from changing the committed archive identity.
CREATE OR REPLACE FUNCTION proof.admission_seal(s uuid,b uuid,d text,seal text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
BEGIN
 IF seal IS NULL OR seal!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'seal_digest_required';END IF;
 UPDATE proof.synthetic_admission SET state='ELIGIBLE',seal_digest=seal WHERE scope_id=s AND batch_id=b AND digest=d AND (seal_digest IS NULL OR seal_digest=seal);
 IF NOT FOUND THEN RAISE EXCEPTION 'committed_batch_or_seal_mismatch';END IF;
END $$;
REVOKE ALL ON FUNCTION proof.runtime_ready(uuid,uuid,bigint,text),proof.worker_pending(uuid,uuid,bigint,text),proof.worker_plan_b1a2(uuid,uuid,uuid,bigint,text),proof.enter_b1a2(uuid,uuid,uuid,uuid,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION proof.runtime_ready(uuid,uuid,bigint,text) TO inc1_gateway,inc1_worker,inc1_ingress,inc1_sealer;
GRANT EXECUTE ON FUNCTION proof.worker_pending(uuid,uuid,bigint,text),proof.worker_plan_b1a2(uuid,uuid,uuid,bigint,text) TO inc1_worker;
GRANT EXECUTE ON FUNCTION proof.enter_b1a2(uuid,uuid,uuid,uuid,bigint,text) TO inc1_gateway;
RESET ROLE;
-- Bounded controller authority: loss of the independent supervisor cannot leave
-- a six-hour dispatch=true row usable. Provisional LOCAL policy: five seconds.
SET ROLE inc1_owner;
ALTER TABLE proof.experiment_control ADD COLUMN lease_until timestamptz NOT NULL DEFAULT '-infinity';
CREATE FUNCTION proof.control_lease_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
BEGIN
 IF NEW.dispatch_enabled AND NOT OLD.dispatch_enabled THEN NEW.lease_until:=least(NEW.expires_at,clock_timestamp()+interval '5 seconds');END IF;
 IF NOT NEW.dispatch_enabled THEN NEW.lease_until:='-infinity';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b1a2_lease BEFORE UPDATE OF dispatch_enabled ON proof.experiment_control FOR EACH ROW EXECUTE FUNCTION proof.control_lease_trigger();
CREATE FUNCTION proof.control_renew(s uuid,e bigint,g bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
DECLARE c proof.experiment_control;
BEGIN
 SELECT * INTO c FROM proof.experiment_control WHERE session_id=s FOR UPDATE;
 IF c.session_id IS NULL OR NOT c.dispatch_enabled OR c.epoch<>e OR c.generation<>g OR c.expires_at<=clock_timestamp() OR c.lease_until<=clock_timestamp() THEN
  UPDATE proof.experiment_control SET dispatch_enabled=false,hold_reason='CONTROL_UNAVAILABLE',generation=generation+1 WHERE session_id=s AND dispatch_enabled;
  RETURN false;
 END IF;
 UPDATE proof.experiment_control SET lease_until=least(expires_at,clock_timestamp()+interval '5 seconds') WHERE session_id=s;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION proof.runtime_ready(s uuid,scope uuid,e bigint,r text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
 SELECT coalesce((SELECT dispatch_enabled AND expires_at>clock_timestamp() AND lease_until>clock_timestamp() AND scope_id=scope AND epoch=e AND revision=r FROM proof.experiment_control WHERE session_id=s),false)
$$;
CREATE OR REPLACE FUNCTION proof.enter_b1a2(session uuid,s uuid,a uuid,o uuid,e bigint,r text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
DECLARE c proof.experiment_control;v jsonb;
BEGIN
 SELECT * INTO c FROM proof.experiment_control WHERE session_id=session FOR SHARE;
 IF c.session_id IS NULL OR c.lease_until<=clock_timestamp() OR NOT EXISTS(SELECT FROM proof.synthetic_admission WHERE scope_id=s AND state='ELIGIBLE' AND payload->>'attemptId'=a::text AND payload->>'epoch'=e::text AND payload->>'revision'=r) THEN RETURN jsonb_build_object('entered',false,'state','HELD');END IF;
 v:=proof.enter_b1a(session,s,a,o,e,r);
 IF (v->>'entered')::boolean THEN v:=jsonb_set(v,'{deadlineAt}',to_jsonb(least((v->>'deadlineAt')::timestamptz,c.lease_until)));END IF;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION proof.control_renew(uuid,bigint,bigint),proof.control_lease_trigger() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION proof.control_renew(uuid,bigint,bigint) TO inc1_controller;
RESET ROLE;
-- B1a-2 runtime roles cannot select the older unsealed planning/entry paths.
REVOKE EXECUTE ON FUNCTION proof.enter_b1a(uuid,uuid,uuid,uuid,bigint,text) FROM inc1_gateway;
REVOKE EXECUTE ON FUNCTION proof.plan(uuid,uuid,uuid,bigint,text,text,jsonb,timestamptz,timestamptz) FROM inc1_worker;
