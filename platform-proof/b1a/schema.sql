-- B1a disposable synthetic proof DB ONLY. Never an application migration.
CREATE ROLE inc1_controller LOGIN;
GRANT USAGE ON SCHEMA proof TO inc1_controller;
SET ROLE inc1_owner;
CREATE TABLE proof.experiment_control(
 session_id uuid PRIMARY KEY,scope_id uuid NOT NULL UNIQUE REFERENCES proof.authority(scope_id),
 epoch bigint NOT NULL CHECK(epoch>0),revision text NOT NULL,generation bigint NOT NULL DEFAULT 1,
 retired_epoch bigint,retired_revision text,
 dispatch_enabled boolean NOT NULL DEFAULT false,hold_reason text NOT NULL DEFAULT 'BOOTSTRAP',
 expires_at timestamptz NOT NULL,evidence_digest text,updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION proof.control_read(s uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
 SELECT jsonb_build_object('sessionId',session_id,'scopeId',scope_id,'epoch',epoch,'revision',revision,'generation',generation,'retiredEpoch',retired_epoch,'retiredRevision',retired_revision,'dispatchEnabled',dispatch_enabled AND expires_at>clock_timestamp(),'holdReason',CASE WHEN expires_at<=clock_timestamp() THEN 'SESSION_EXPIRED' ELSE hold_reason END,'expiresAt',expires_at)
 FROM proof.experiment_control WHERE session_id=s
$$;
CREATE FUNCTION proof.control_create(s uuid,scope uuid,e bigint,r text,expiry timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
BEGIN
 IF s IS NULL OR scope IS NULL OR e IS NULL OR r IS NULL OR expiry IS NULL OR expiry<=clock_timestamp() OR expiry>clock_timestamp()+interval '6 hours' THEN RAISE EXCEPTION 'invalid_synthetic_session';END IF;
 IF NOT EXISTS(SELECT FROM proof.authority WHERE scope_id=scope AND epoch=e AND revision=r) THEN RAISE EXCEPTION 'authority_scope_mismatch';END IF;
 INSERT INTO proof.experiment_control(session_id,scope_id,epoch,revision,expires_at) VALUES(s,scope,e,r,expiry);
END $$;
CREATE FUNCTION proof.control_hold(s uuid,reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
BEGIN
 IF reason IS NULL OR reason NOT IN('BUDGET_PAUSED','BUDGET_RESET','SESSION_EXPIRED','FENCE_INCOMPLETE','CONTROL_UNAVAILABLE','SEALER_UNAVAILABLE','OPERATOR_HOLD') THEN RAISE EXCEPTION 'invalid_hold_reason';END IF;
 UPDATE proof.experiment_control SET dispatch_enabled=false,hold_reason=reason,generation=generation+1,evidence_digest=NULL,updated_at=clock_timestamp() WHERE session_id=s;
 IF NOT FOUND THEN RAISE EXCEPTION 'unknown_synthetic_session';END IF;
END $$;
CREATE FUNCTION proof.control_advance(s uuid,old_e bigint,new_e bigint,new_r text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
DECLARE c proof.experiment_control;
BEGIN
 SELECT * INTO c FROM proof.experiment_control WHERE session_id=s FOR UPDATE;
 IF c.session_id IS NULL OR old_e IS NULL OR new_e IS NULL OR new_r IS NULL OR c.epoch<>old_e OR new_e<>old_e+1 OR c.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'epoch_advance_denied';END IF;
 UPDATE proof.experiment_control SET retired_epoch=epoch,retired_revision=revision,epoch=new_e,revision=new_r,dispatch_enabled=false,hold_reason='FENCE_INCOMPLETE',generation=generation+1,evidence_digest=NULL,updated_at=clock_timestamp() WHERE session_id=s;
 UPDATE proof.authority SET epoch=new_e,revision=new_r,changed_at=clock_timestamp() WHERE scope_id=c.scope_id;
END $$;
CREATE FUNCTION proof.control_promote(s uuid,e bigint,g bigint,digest text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
BEGIN
 -- Only the separate controller role may invoke this. Its source API requires
 -- independently authenticated complete fence evidence before calling SQL.
 IF digest IS NULL OR digest!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'promotion_evidence_required';END IF;
 UPDATE proof.experiment_control SET dispatch_enabled=true,hold_reason='NONE',evidence_digest=digest,generation=generation+1,updated_at=clock_timestamp()
 WHERE session_id=s AND epoch=e AND generation=g AND expires_at>clock_timestamp() AND NOT dispatch_enabled AND hold_reason IN('BOOTSTRAP','FENCE_INCOMPLETE');
 IF NOT FOUND THEN RAISE EXCEPTION 'promotion_compare_and_swap_denied';END IF;
END $$;
CREATE FUNCTION proof.enter_b1a(session uuid,s uuid,a uuid,o uuid,e bigint,r text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
DECLARE c proof.experiment_control;v jsonb;
BEGIN
 SELECT * INTO c FROM proof.experiment_control WHERE session_id=session FOR SHARE;
 IF c.session_id IS NULL OR NOT c.dispatch_enabled OR c.expires_at<=clock_timestamp() OR c.scope_id<>s OR c.epoch<>e OR c.revision<>r THEN RETURN jsonb_build_object('entered',false,'state','HELD');END IF;
 v:=proof.enter(s,a,o,e,r);
 IF (v->>'entered')::boolean THEN v:=jsonb_set(v,'{deadlineAt}',to_jsonb(least((v->>'deadlineAt')::timestamptz,c.expires_at)));END IF;
 RETURN v;
END $$;
REVOKE ALL ON proof.experiment_control FROM PUBLIC,inc1_worker,inc1_gateway,inc1_controller;
REVOKE ALL ON FUNCTION proof.control_read(uuid),proof.control_create(uuid,uuid,bigint,text,timestamptz),proof.control_hold(uuid,text),proof.control_advance(uuid,bigint,bigint,text),proof.control_promote(uuid,bigint,bigint,text),proof.enter_b1a(uuid,uuid,uuid,uuid,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION proof.control_read(uuid) TO inc1_worker,inc1_gateway,inc1_controller;
GRANT EXECUTE ON FUNCTION proof.control_create(uuid,uuid,bigint,text,timestamptz),proof.control_hold(uuid,text),proof.control_advance(uuid,bigint,bigint,text),proof.control_promote(uuid,bigint,bigint,text) TO inc1_controller;
GRANT EXECUTE ON FUNCTION proof.enter_b1a(uuid,uuid,uuid,uuid,bigint,text) TO inc1_gateway;
-- Cloud B1a must not bypass the durable dispatch gate through the legacy entry.
REVOKE EXECUTE ON FUNCTION proof.enter(uuid,uuid,uuid,bigint,text) FROM inc1_gateway;
RESET ROLE;
CREATE ROLE inc1_ingress LOGIN;
CREATE ROLE inc1_sealer LOGIN;
GRANT USAGE ON SCHEMA proof TO inc1_ingress,inc1_sealer;
SET ROLE inc1_owner;
CREATE TABLE proof.synthetic_admission(scope_id uuid NOT NULL REFERENCES proof.authority(scope_id),batch_id uuid NOT NULL,digest text NOT NULL CHECK(digest~'^[a-f0-9]{64}$'),payload jsonb NOT NULL,state text NOT NULL DEFAULT 'STAGED' CHECK(state IN('STAGED','ELIGIBLE')),seal_digest text,PRIMARY KEY(scope_id,batch_id));
CREATE FUNCTION proof.admission_stage(s uuid,b uuid,d text,p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
DECLARE v proof.synthetic_admission;
BEGIN
 IF s IS NULL OR b IS NULL OR d IS NULL OR p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>4096 THEN RAISE EXCEPTION 'invalid_synthetic_admission';END IF;
 INSERT INTO proof.synthetic_admission(scope_id,batch_id,digest,payload) VALUES(s,b,d,p) ON CONFLICT DO NOTHING;
 SELECT * INTO v FROM proof.synthetic_admission WHERE scope_id=s AND batch_id=b;
 IF v.digest<>d OR v.payload IS DISTINCT FROM p THEN RAISE EXCEPTION 'immutable_synthetic_batch_conflict';END IF;
END $$;
CREATE FUNCTION proof.admission_status(s uuid,b uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
 SELECT jsonb_build_object('digest',digest,'state',state,'sealDigest',seal_digest) FROM proof.synthetic_admission WHERE scope_id=s AND batch_id=b
$$;
CREATE FUNCTION proof.admission_sealer_read(s uuid,b uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
 SELECT jsonb_build_object('digest',digest,'payload',payload) FROM proof.synthetic_admission WHERE scope_id=s AND batch_id=b
$$;
CREATE FUNCTION proof.admission_seal(s uuid,b uuid,d text,seal text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
BEGIN
 IF seal IS NULL OR seal!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'seal_digest_required';END IF;
 UPDATE proof.synthetic_admission SET state='ELIGIBLE',seal_digest=seal WHERE scope_id=s AND batch_id=b AND digest=d;
 IF NOT FOUND THEN RAISE EXCEPTION 'committed_batch_mismatch';END IF;
END $$;
REVOKE ALL ON proof.synthetic_admission FROM PUBLIC,inc1_ingress,inc1_sealer,inc1_worker,inc1_gateway,inc1_controller;
REVOKE ALL ON FUNCTION proof.admission_stage(uuid,uuid,text,jsonb),proof.admission_status(uuid,uuid),proof.admission_sealer_read(uuid,uuid),proof.admission_seal(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION proof.admission_stage(uuid,uuid,text,jsonb),proof.admission_status(uuid,uuid) TO inc1_ingress;
GRANT EXECUTE ON FUNCTION proof.admission_sealer_read(uuid,uuid),proof.admission_seal(uuid,uuid,text,text) TO inc1_sealer;
RESET ROLE;

-- B1a aggregate role caps bound pools across revision overshoot. Connection
-- admission refusal holds work; never a reason to use an administrative role.
ALTER ROLE inc1_gateway CONNECTION LIMIT 4;
ALTER ROLE inc1_worker CONNECTION LIMIT 2;
ALTER ROLE inc1_ingress CONNECTION LIMIT 1;
ALTER ROLE inc1_sealer CONNECTION LIMIT 1;
ALTER ROLE inc1_controller CONNECTION LIMIT 2;

-- Controller can ONLY monotonically mark old entered work uncertain after a
-- verified retirement. No administrative UPDATE, rearm or new identity API.
SET ROLE inc1_owner;
CREATE FUNCTION proof.recover_retired(s uuid,a uuid,digest text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
DECLARE c proof.experiment_control;v proof.attempt;
BEGIN
 SELECT * INTO c FROM proof.experiment_control WHERE session_id=s FOR SHARE;
 IF c.session_id IS NULL OR c.dispatch_enabled OR c.hold_reason<>'FENCE_INCOMPLETE' OR c.retired_epoch IS NULL OR digest IS NULL OR digest!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'retirement_recovery_denied';END IF;
 SELECT * INTO v FROM proof.attempt WHERE id=a AND scope_id=c.scope_id AND epoch=c.retired_epoch AND revision=c.retired_revision FOR UPDATE;
 IF v.id IS NULL THEN RETURN 'DENIED';END IF;
 IF v.state='ENTERED' THEN UPDATE proof.attempt SET state='UNKNOWN',completed_at=clock_timestamp() WHERE id=a;RETURN 'UNKNOWN';END IF;
 RETURN v.state;
END $$;
REVOKE ALL ON FUNCTION proof.recover_retired(uuid,uuid,text) FROM PUBLIC,inc1_gateway,inc1_worker,inc1_ingress,inc1_sealer;
GRANT EXECUTE ON FUNCTION proof.recover_retired(uuid,uuid,text) TO inc1_controller;
RESET ROLE;
