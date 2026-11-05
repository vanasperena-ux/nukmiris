-- Fresh synthetic fixtures; no live schema tightening or automatic migration.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM core.input) OR EXISTS(SELECT 1 FROM core.attempt) THEN RAISE EXCEPTION 'deadline_migration_requires_empty_fixture'; END IF; END $$;
CREATE FUNCTION core.expired_operations(b text,c uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF b IS NULL OR c IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);PERFORM core.lock_conversation(b,c);
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('attemptId',a.id,'payloadDigest',a.payload_digest,'deadlineAt',a.envelope->>'deadlineAt') ORDER BY a.id)
 FROM core.attempt a JOIN core.operation op ON op.business_id=b AND op.id=a.operation_id JOIN core.input i ON i.business_id=b AND i.id=op.input_id
 WHERE a.business_id=b AND i.conversation_id=c AND a.state IN ('PREPARED','ARMED') AND (a.envelope->>'deadlineAt')::timestamptz<core.authoritative_time()),'[]'::jsonb);
END $$;
CREATE FUNCTION core.expire_operation(b text,a_id uuid,seal_key text,seal_digest text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE a core.attempt; op core.operation; i core.input; ap core.appointment; r uuid;
BEGIN
 IF b IS NULL OR a_id IS NULL OR seal_key IS NULL OR seal_digest IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 SELECT * INTO a FROM core.attempt WHERE business_id=b AND id=a_id;
 IF a.id IS NULL OR a.operation_id IS NULL THEN RETURN false; END IF;
 SELECT * INTO op FROM core.operation WHERE business_id=b AND id=a.operation_id;
 SELECT * INTO i FROM core.input WHERE business_id=b AND id=op.input_id;
 PERFORM core.lock_conversation(b,i.conversation_id);
 -- Match entry/abandon lock order and check DB time only after all waits.
 SELECT * INTO ap FROM core.appointment WHERE business_id=b AND id=op.appointment_id FOR UPDATE;
 SELECT * INTO a FROM core.attempt WHERE business_id=b AND id=a_id FOR UPDATE;
 IF a.state NOT IN ('PREPARED','ARMED') THEN RETURN false; END IF;
 FOR r IN SELECT id FROM core.resource WHERE business_id=b AND id IN (ap.resource_id,(op.plan->>'resourceId')::uuid) ORDER BY id LOOP PERFORM 1 FROM core.resource WHERE business_id=b AND id=r FOR UPDATE; END LOOP;
 IF (a.envelope->>'deadlineAt')::timestamptz>=core.authoritative_time() THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM core.seal s WHERE s.business_id=b AND s.stable_key=seal_key AND s.kind='ABANDON' AND s.digest=seal_digest
  AND s.receipt->'body'=jsonb_build_object('businessId',b,'attemptId',a.id,'payloadDigest',a.payload_digest,'reason','DEADLINE_EXPIRED','deadlineAt',a.envelope->>'deadlineAt')) THEN RAISE EXCEPTION 'deadline_expiry_unsealed'; END IF;
 RETURN core.abandon_unsent(b,a.id,seal_key,seal_digest);
END $$;
CREATE FUNCTION core.expire_conversation_outputs(b text,c uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE o core.output_intent; total integer=0;
BEGIN
 IF b IS NULL OR c IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);PERFORM core.lock_conversation(b,c);
 FOR o IN SELECT x.* FROM core.output_intent x WHERE x.business_id=b AND x.conversation_id=c AND x.state IN ('PENDING','ARMED') AND x.deadline_at<core.authoritative_time() ORDER BY x.id LOOP
  IF core.expire_unsent(b,o.id,core.authoritative_time()) THEN total=total+1; END IF;
 END LOOP;
 RETURN total;
END $$;
CREATE FUNCTION core.expired_conversations(b text,after_id text,page_limit bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF b IS NULL OR after_id IS NULL OR page_limit IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 IF page_limit NOT BETWEEN 1 AND 100 OR (after_id<>'' AND after_id !~ '^[0-9a-f-]{36}$') THEN RAISE EXCEPTION 'recovery_page_denied'; END IF;
 RETURN coalesce((SELECT jsonb_agg(x.id ORDER BY x.id) FROM (SELECT cv.id FROM core.conversation cv WHERE cv.business_id=b AND cv.id::text>after_id AND
 (EXISTS(SELECT 1 FROM core.input i JOIN core.operation op ON op.business_id=b AND op.input_id=i.id JOIN core.attempt a ON a.business_id=b AND a.operation_id=op.id WHERE i.business_id=b AND i.conversation_id=cv.id AND a.state IN ('PREPARED','ARMED') AND (a.envelope->>'deadlineAt')::timestamptz<core.authoritative_time())
 OR EXISTS(SELECT 1 FROM core.output_intent o WHERE o.business_id=b AND o.conversation_id=cv.id AND o.state IN ('PENDING','ARMED') AND o.deadline_at<core.authoritative_time()
  AND NOT EXISTS(SELECT 1 FROM core.attempt a WHERE a.business_id=b AND a.output_id=o.id AND a.state NOT IN ('PREPARED','ARMED','ABANDONED')))) ORDER BY cv.id LIMIT page_limit) x),'[]'::jsonb);
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='core'::regnamespace AND proname IN ('expired_operations','expire_operation','expire_conversation_outputs','expired_conversations') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO wp1_definer',f.signature);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO wp1_reducer',f.signature);
 END LOOP;
END $$;
