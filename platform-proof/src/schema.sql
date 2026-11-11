-- INC1 only. Separate schema: no core/application migration or BYPASSRLS.
CREATE ROLE inc1_owner NOLOGIN;
CREATE ROLE inc1_worker LOGIN;
CREATE ROLE inc1_gateway LOGIN;
CREATE SCHEMA proof AUTHORIZATION inc1_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA proof FROM PUBLIC;
GRANT USAGE ON SCHEMA proof TO inc1_worker,inc1_gateway;
SET ROLE inc1_owner;
CREATE TABLE proof.authority(scope_id uuid PRIMARY KEY,epoch bigint NOT NULL CHECK(epoch>0),revision text NOT NULL,enabled boolean NOT NULL DEFAULT true,changed_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE proof.attempt(
 id uuid PRIMARY KEY,scope_id uuid NOT NULL REFERENCES proof.authority,operation_id uuid NOT NULL UNIQUE,
 epoch bigint NOT NULL,revision text NOT NULL,payload_digest text NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),payload jsonb NOT NULL,
 deadline_at timestamptz NOT NULL,inbound_timeout_at timestamptz NOT NULL CHECK(inbound_timeout_at>deadline_at),
 state text NOT NULL CHECK(state IN ('ARMED','ENTERED','APPLIED','UNKNOWN','EXPIRED')) DEFAULT 'ARMED',
 owner_id uuid,entered_at timestamptz,completed_at timestamptz,
 CHECK((owner_id IS NULL)=(entered_at IS NULL))
);
CREATE FUNCTION proof.immutable_binding() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,proof AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'proof_append_only_identity'; END IF;
 IF ROW(NEW.id,NEW.scope_id,NEW.operation_id,NEW.epoch,NEW.revision,NEW.payload_digest,NEW.payload,NEW.deadline_at,NEW.inbound_timeout_at)
 IS DISTINCT FROM ROW(OLD.id,OLD.scope_id,OLD.operation_id,OLD.epoch,OLD.revision,OLD.payload_digest,OLD.payload,OLD.deadline_at,OLD.inbound_timeout_at)
 THEN RAISE EXCEPTION 'proof_immutable_binding'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER immutable_binding BEFORE UPDATE OR DELETE ON proof.attempt FOR EACH ROW EXECUTE FUNCTION proof.immutable_binding();
CREATE FUNCTION proof.plan(s uuid,a uuid,op uuid,e bigint,r text,d text,p jsonb,deadline timestamptz,inbound timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
DECLARE h proof.authority;old proof.attempt;
BEGIN
 IF s IS NULL OR a IS NULL OR op IS NULL OR e IS NULL OR r IS NULL OR d IS NULL OR p IS NULL OR deadline IS NULL OR inbound IS NULL THEN RAISE EXCEPTION 'proof_null';END IF;
 SELECT * INTO h FROM proof.authority WHERE scope_id=s FOR SHARE;
 IF h.scope_id IS NULL OR NOT h.enabled OR h.epoch<>e OR h.revision<>r OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>4096 OR inbound<=deadline OR inbound>clock_timestamp()+interval '60 seconds' THEN RAISE EXCEPTION 'plan_denied';END IF;
 SELECT * INTO old FROM proof.attempt WHERE id=a;
 IF old.id IS NOT NULL THEN
  IF ROW(old.scope_id,old.operation_id,old.epoch,old.revision,old.payload_digest,old.payload,old.deadline_at,old.inbound_timeout_at) IS DISTINCT FROM ROW(s,op,e,r,d,p,deadline,inbound) THEN RAISE EXCEPTION 'immutable_plan_conflict';END IF;RETURN;
 END IF;
 INSERT INTO proof.attempt(id,scope_id,operation_id,epoch,revision,payload_digest,payload,deadline_at,inbound_timeout_at) VALUES(a,s,op,e,r,d,p,deadline,inbound);
END $$;
CREATE FUNCTION proof.enter(s uuid,a uuid,o uuid,e bigint,r text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
DECLARE h proof.authority;v proof.attempt;
BEGIN
 IF s IS NULL OR a IS NULL OR o IS NULL OR e IS NULL OR r IS NULL THEN RAISE EXCEPTION 'proof_null'; END IF;
 SELECT * INTO h FROM proof.authority WHERE scope_id=s FOR SHARE;
 SELECT * INTO v FROM proof.attempt WHERE id=a AND scope_id=s FOR UPDATE;
 IF v.id IS NULL THEN RETURN jsonb_build_object('entered',false,'state','DENIED');END IF;
 IF v.state<>'ARMED' THEN RETURN jsonb_build_object('entered',false,'state',v.state);END IF;
 IF NOT h.enabled OR h.epoch<>e OR h.revision<>r OR v.epoch<>e OR v.revision<>r THEN RETURN jsonb_build_object('entered',false,'state','DENIED');END IF;
 IF clock_timestamp()>=v.deadline_at THEN UPDATE proof.attempt SET state='EXPIRED' WHERE id=a;RETURN jsonb_build_object('entered',false,'state','EXPIRED');END IF;
 UPDATE proof.attempt SET state='ENTERED',owner_id=o,entered_at=clock_timestamp() WHERE id=a;
 RETURN jsonb_build_object('entered',true,'attemptId',a,'scopeId',s,'operationId',v.operation_id,'epoch',v.epoch,'revision',v.revision,'payloadDigest',v.payload_digest,'payload',v.payload,'deadlineAt',v.deadline_at,'inboundTimeoutAt',v.inbound_timeout_at);
END $$;
CREATE FUNCTION proof.finish(a uuid,o uuid,success boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,proof AS $$
DECLARE v text;
BEGIN
 UPDATE proof.attempt SET state=CASE WHEN success THEN 'APPLIED' ELSE 'UNKNOWN' END,completed_at=clock_timestamp()
 WHERE id=a AND owner_id=o AND state='ENTERED' RETURNING state INTO v;
 RETURN coalesce(v,'HELD');
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA proof FROM PUBLIC,inc1_worker,inc1_gateway;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA proof FROM PUBLIC;
GRANT EXECUTE ON FUNCTION proof.enter(uuid,uuid,uuid,bigint,text),proof.finish(uuid,uuid,boolean) TO inc1_gateway;
GRANT EXECUTE ON FUNCTION proof.plan(uuid,uuid,uuid,bigint,text,text,jsonb,timestamptz,timestamptz) TO inc1_worker;
-- Disposable operator creates each scenario authority. Only worker can plan;
-- gateway has no plan/rearm grant and worker cannot enter or finish.
RESET ROLE;
