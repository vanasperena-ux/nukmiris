-- Fresh synthetic fixtures only; no live/in-flight schema tightening.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM core.input) OR EXISTS(SELECT 1 FROM core.attempt) THEN RAISE EXCEPTION 'progress_migration_requires_empty_fixture'; END IF;
END $$;

CREATE OR REPLACE FUNCTION core.valid_tenant_bindings(v jsonb,b text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,core AS $$
DECLARE k text; x jsonb;
BEGIN
 IF v IS NULL OR b IS NULL OR b !~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' OR b ~ '[^a-z0-9-]' OR length(b)>64 THEN RETURN false; END IF;
 IF jsonb_typeof(v)='array' THEN
  FOR x IN SELECT value FROM jsonb_array_elements(v) LOOP IF NOT core.valid_tenant_bindings(x,b) THEN RETURN false; END IF; END LOOP;
 ELSIF jsonb_typeof(v)='object' THEN
  FOR k,x IN SELECT key,value FROM jsonb_each(v) LOOP
   IF regexp_replace(lower(k),'[^a-z0-9]','','g') IN ('businessid','tenantid') AND (k<>'businessId' OR x IS DISTINCT FROM to_jsonb(b)) THEN RETURN false; END IF;
   IF NOT core.valid_tenant_bindings(x,b) THEN RETURN false; END IF;
  END LOOP;
 END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION core.prepare_operation(b text,p jsonb,p_digest text,seal_key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; a core.appointment; r core.resource; c core.customer;
 prior core.operation; resource_item uuid; ranges tstzmultirange; seg tstzrange; output_key uuid; projected core.appointment;
BEGIN
 IF b IS NULL OR p IS NULL OR p_digest IS NULL OR seal_key IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 PERFORM 1 FROM core.business WHERE business_id=b AND status='ACTIVE' AND dispatch_enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'business_paused'; END IF;
 IF p->>'businessId' IS DISTINCT FROM b OR NOT EXISTS(SELECT 1 FROM core.seal s WHERE s.business_id=b AND s.stable_key=seal_key AND s.digest=p_digest AND s.kind='OPERATION_PLAN' AND s.receipt->'body'=p)
 THEN RAISE EXCEPTION 'unsealed_plan'; END IF;
 SELECT * INTO i FROM core.input WHERE business_id=b AND id=(p->>'inputId')::uuid AND state='ELIGIBLE';
 IF i.id IS NULL OR i.channel_id IS DISTINCT FROM (p->>'channelId')::uuid THEN RAISE EXCEPTION 'input_not_eligible'; END IF;
 PERFORM 1 FROM core.conversation WHERE business_id=b AND id=i.conversation_id FOR UPDATE;
 SELECT * INTO i FROM core.input WHERE business_id=b AND id=(p->>'inputId')::uuid AND state='ELIGIBLE';
 IF i.id IS NULL THEN RAISE EXCEPTION 'input_not_eligible'; END IF;
 IF i.event->>'type' IS DISTINCT FROM 'text' OR i.event->'text'->>'body' IS DISTINCT FROM 'synthetic fixed command' THEN RAISE EXCEPTION 'synthetic_command_required'; END IF;
 SELECT * INTO prior FROM core.operation WHERE business_id=b AND input_id=i.id;
 IF prior.id IS NOT NULL THEN
  IF prior.plan_digest<>p_digest OR prior.plan<>p THEN RAISE EXCEPTION 'plan_conflict'; END IF;
  RETURN prior.id;
 END IF;
 IF EXISTS(SELECT 1 FROM core.input_reduction WHERE business_id=b AND input_id=i.id)
 OR EXISTS(SELECT 1 FROM core.plan_rejection WHERE business_id=b AND input_id=i.id) THEN RAISE EXCEPTION 'input_terminal'; END IF;
 IF NOT EXISTS(SELECT 1 FROM core.input_classification clv WHERE clv.business_id=b AND clv.input_id=i.id
  AND clv.value->>'kind'='ORDINARY' AND clv.value->>'operation'='SYNTHETIC_OPERATION') THEN RAISE EXCEPTION 'classification_denied'; END IF;
 IF EXISTS(SELECT 1 FROM core.conversation_context WHERE business_id=b AND conversation_id=i.conversation_id AND mode='HUMAN') THEN RAISE EXCEPTION 'human_mode'; END IF;
 IF EXISTS(SELECT 1 FROM core.conversation_context WHERE business_id=b AND conversation_id=i.conversation_id AND phase<>'NONE') THEN RAISE EXCEPTION 'context_input_not_mutation'; END IF;
 IF NOT core.conversation_ready(b,i.conversation_id,i.sequence) THEN RAISE EXCEPTION 'conversation_head_held' USING ERRCODE='P7502'; END IF;
 IF p->'envelope'->>'conversationRevision' IS DISTINCT FROM coalesce((SELECT revision::text FROM core.conversation_context WHERE business_id=b AND conversation_id=i.conversation_id),'0') THEN RAISE EXCEPTION 'conversation_context_changed' USING ERRCODE='P7503'; END IF;
 -- All required plan fields and payload values are bound before any reservation.
 IF NOT (p ?& ARRAY['businessId','inputId','channelId','customerId','calendarId','resourceId','kind','appointmentId','eventId','expectedRevision','startAt','endAt','bufferMinutes','operationId','attemptId','outputId','payloadDigest','outputPayload','outputDigest','outputPurpose','outputDueAt','outputDeadlineAt','envelope'])
 OR EXISTS(SELECT 1 FROM jsonb_each(p) WHERE value='null'::jsonb)
 OR core.envelope_context(b,p->'envelope',i.id,(p->>'calendarId')::uuid,'CUSTOMER_REQUEST',(p->>'outputDueAt')::timestamptz,(p->>'outputDeadlineAt')::timestamptz) IS NOT TRUE
 OR p->'envelope'->>'attemptId' IS DISTINCT FROM p->>'attemptId'
 OR p->'envelope'->>'remoteId' IS DISTINCT FROM p->>'eventId'
 OR p->'envelope'->>'payloadDigest' IS DISTINCT FROM p->>'payloadDigest'
 OR core.json_digest(p->'outputPayload') IS DISTINCT FROM p->>'outputDigest'
 OR p->'envelope'->'payload' IS DISTINCT FROM jsonb_build_object('kind',p->>'kind','businessId',b,'calendarId',p->>'calendarId',
 'appointmentId',p->>'appointmentId','eventId',p->>'eventId','customerId',p->>'customerId','resourceId',p->>'resourceId',
 'startAt',p->>'startAt','endAt',p->>'endAt','bufferMinutes',(p->>'bufferMinutes')::integer)
 THEN RAISE EXCEPTION 'plan_envelope_denied'; END IF;
 -- Reject future output failures before creating an appointment/guard/protection.
 IF jsonb_typeof(p->'outputPurpose') IS DISTINCT FROM 'string'
 OR p->>'outputPurpose' NOT IN ('CUSTOMER_REQUEST','REMINDER')
 OR jsonb_typeof(p->'outputId') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'plan_output_denied' USING ERRCODE='P7504'; END IF;
 BEGIN
  output_key=(p->>'outputId')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'plan_output_denied' USING ERRCODE='P7504';
 END;
 IF output_key='00000000-0000-0000-0000-000000000000'::uuid
 OR output_key=(p->>'operationId')::uuid OR output_key=(p->>'attemptId')::uuid
 THEN RAISE EXCEPTION 'plan_output_denied' USING ERRCODE='P7504'; END IF;
 IF EXISTS(SELECT 1 FROM core.output_intent WHERE business_id=b AND id=output_key)
 OR EXISTS(SELECT 1 FROM core.operation WHERE business_id=b AND (plan->>'outputId')::uuid=output_key)
 THEN RAISE EXCEPTION 'plan_output_denied' USING ERRCODE='P7505'; END IF;
 SELECT * INTO c FROM core.customer WHERE business_id=b AND subject=i.subject FOR UPDATE;
 IF c.id IS NULL OR c.id IS DISTINCT FROM (p->>'customerId')::uuid THEN RAISE EXCEPTION 'customer_denied'; END IF;
 SELECT * INTO r FROM core.resource WHERE business_id=b AND id=(p->>'resourceId')::uuid;
 IF r.id IS NULL OR r.calendar_id IS DISTINCT FROM (p->>'calendarId')::uuid THEN RAISE EXCEPTION 'resource_denied'; END IF;
 IF p->>'kind'='CREATE' THEN
  INSERT INTO core.appointment VALUES(b,(p->>'appointmentId')::uuid,r.calendar_id,c.id,r.id,p->>'eventId','APP_CREATED','PLANNED',1,1,
   (p->>'startAt')::timestamptz,(p->>'endAt')::timestamptz,(p->>'bufferMinutes')::integer);
 END IF;
 SELECT * INTO a FROM core.appointment WHERE business_id=b AND id=(p->>'appointmentId')::uuid FOR UPDATE;
 IF a.id IS NULL OR a.customer_id<>c.id OR a.calendar_id<>r.calendar_id OR a.event_id IS DISTINCT FROM p->>'eventId'
 OR a.origin<>'APP_CREATED' OR a.revision IS DISTINCT FROM (p->>'expectedRevision')::bigint
 OR (p->>'kind'<>'CREATE' AND a.state<>'ACTIVE') THEN RAISE EXCEPTION 'appointment_denied'; END IF;
 IF p->>'kind'='MOVE' AND ((p->>'bufferMinutes')::integer<>a.buffer_minutes
   OR (p->>'endAt')::timestamptz-(p->>'startAt')::timestamptz<>a.end_at-a.start_at) THEN RAISE EXCEPTION 'duration_buffer_changed'; END IF;
 -- Acquire resource rows in stable order; customer was locked above so distinct
 -- resources cannot double-book one customer through cooperating functions.
 FOR resource_item IN SELECT id FROM core.resource WHERE business_id=b AND id IN (a.resource_id,r.id) ORDER BY id LOOP
  PERFORM 1 FROM core.resource WHERE business_id=b AND id=resource_item FOR UPDATE;
 END LOOP;
 IF (p->>'startAt')::timestamptz >= (p->>'endAt')::timestamptz OR NOT isfinite((p->>'startAt')::timestamptz)
 OR NOT isfinite((p->>'endAt')::timestamptz) THEN RAISE EXCEPTION 'invalid_interval'; END IF;
 IF p->>'kind' IN ('CREATE','MOVE') AND EXISTS(SELECT 1 FROM core.protection pr JOIN core.appointment ap ON ap.business_id=pr.business_id AND ap.id=pr.appointment_id
   WHERE pr.business_id=b AND ap.customer_id=c.id AND ap.id<>a.id
   AND pr.protected_range && tstzrange((p->>'startAt')::timestamptz,(p->>'endAt')::timestamptz+((p->>'bufferMinutes')::integer)*interval '1 minute','[)'))
 THEN RAISE EXCEPTION 'customer_overlap'; END IF;
 INSERT INTO core.operation VALUES(b,(p->>'operationId')::uuid,i.id,a.id,p->>'kind',p,p_digest,a.revision);
 INSERT INTO core.mutation_guard VALUES(b,a.id,(p->>'operationId')::uuid);
 IF p->>'kind' IN ('CREATE','MOVE') THEN
  SELECT range_agg(x) INTO ranges FROM (
   SELECT protected_range x FROM core.protection WHERE business_id=b AND appointment_id=a.id AND resource_id=r.id
   UNION ALL SELECT tstzrange((p->>'startAt')::timestamptz,(p->>'endAt')::timestamptz+((p->>'bufferMinutes')::integer)*interval '1 minute','[)')
  ) all_ranges;
  DELETE FROM core.protection WHERE business_id=b AND appointment_id=a.id AND resource_id=r.id;
  FOR seg IN SELECT unnest(ranges) LOOP
   INSERT INTO core.protection VALUES(b,a.id,(p->>'operationId')::uuid,r.id,seg);
  END LOOP;
 END IF;
 INSERT INTO core.attempt(business_id,id,operation_id,state,envelope,payload_digest)
 VALUES(b,(p->>'attemptId')::uuid,(p->>'operationId')::uuid,'PREPARED',p->'envelope',p->>'payloadDigest');
 -- Validate every value destined for the final output using the same INSERT and
 -- actual schema. Only our successful dry-run sentinel is caught. Constraint
 -- failures propagate and roll back the entire preparation transaction.
 projected=a;
 projected.schedule_revision=a.schedule_revision+CASE WHEN p->>'kind' IN ('CREATE','MOVE','CANCEL') THEN 1 ELSE 0 END;
 BEGIN
  PERFORM core.insert_operation_output(b,p,(p->>'operationId')::uuid,i,projected);
  RAISE EXCEPTION 'output_preflight_rollback' USING ERRCODE='P7501';
 EXCEPTION WHEN SQLSTATE 'P7501' THEN NULL;
 END;
 RETURN (p->>'operationId')::uuid;
END $$;

CREATE OR REPLACE FUNCTION core.reject_plan(b text,input_key uuid,plan_digest text,seal_key text,reason_value text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; prior core.plan_rejection;
BEGIN
 IF b IS NULL OR input_key IS NULL OR plan_digest IS NULL OR seal_key IS NULL OR reason_value IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);SELECT * INTO i FROM core.input WHERE business_id=b AND id=input_key;
 IF i.id IS NULL THEN RAISE EXCEPTION 'input_missing'; END IF;
 PERFORM 1 FROM core.conversation WHERE business_id=b AND id=i.conversation_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM core.seal s WHERE s.business_id=b AND s.stable_key=seal_key AND s.kind='OPERATION_PLAN' AND s.digest=plan_digest AND s.receipt->'body'->>'inputId'=i.id::text)
  OR reason_value NOT IN ('UNIQUE_CONFLICT','LOCK_TIMEOUT','RESOURCE_CONFLICT','CONTEXT_CHANGED','PLAN_INVALID') THEN RAISE EXCEPTION 'rejection_denied'; END IF;
 IF EXISTS(SELECT 1 FROM core.operation WHERE business_id=b AND input_id=i.id) THEN RETURN false; END IF;
 INSERT INTO core.plan_rejection VALUES(b,i.id,plan_digest,reason_value) ON CONFLICT DO NOTHING;
 SELECT * INTO prior FROM core.plan_rejection WHERE business_id=b AND input_id=i.id;
 IF prior.plan_digest IS DISTINCT FROM plan_digest THEN RAISE EXCEPTION 'rejection_conflict'; END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION core.try_prepare_operation(b text,p jsonb,d text,k text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE result uuid; state_value text; message_value text; reason_value text;
BEGIN
 IF b IS NULL OR p IS NULL OR d IS NULL OR k IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 PERFORM core.lock_conversation(b,(p->'envelope'->>'conversationId')::uuid);
 BEGIN
  result=core.prepare_operation(b,p,d,k);
  RETURN jsonb_build_object('state','PREPARED','operationId',result);
 EXCEPTION WHEN unique_violation OR lock_not_available OR exclusion_violation OR SQLSTATE 'P7503' OR SQLSTATE 'P7504' OR SQLSTATE 'P7505' OR raise_exception THEN
  GET STACKED DIAGNOSTICS state_value=RETURNED_SQLSTATE,message_value=MESSAGE_TEXT;
  reason_value=CASE WHEN state_value='P7504' THEN 'PLAN_INVALID' WHEN state_value IN ('23505','P7505') THEN 'UNIQUE_CONFLICT'
    WHEN state_value='55P03' THEN 'LOCK_TIMEOUT' WHEN state_value='23P01' OR message_value='customer_overlap' THEN 'RESOURCE_CONFLICT'
    WHEN state_value='P7503' THEN 'CONTEXT_CHANGED' ELSE NULL END;
  IF reason_value IS NULL THEN RAISE; END IF;
 END;
 IF NOT core.reject_plan(b,(p->>'inputId')::uuid,d,k,reason_value) THEN RAISE EXCEPTION 'rejection_has_existing_operation'; END IF;
 RETURN jsonb_build_object('state','REJECTED','sqlState',state_value,'reason',reason_value);
END $$;

-- Priority context and all of its never-entered dispositions commit together.
-- Existing operator-only abandonment is reused internally, never granted to reducer.
ALTER FUNCTION core.reduce_input(text,uuid,jsonb,text,text) RENAME TO reduce_input_l0b;
CREATE FUNCTION core.reduce_input(b text,input_key uuid,decision jsonb,seal_key text,seal_digest text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; a core.attempt; prior boolean; revision_value bigint; outcome text; sk text; sd text;
BEGIN
 IF b IS NULL OR input_key IS NULL OR decision IS NULL OR seal_key IS NULL OR seal_digest IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 SELECT * INTO i FROM core.input WHERE business_id=b AND id=input_key;
 IF i.id IS NULL THEN RAISE EXCEPTION 'input_missing'; END IF;
 PERFORM core.lock_conversation(b,i.conversation_id);
 prior=EXISTS(SELECT 1 FROM core.input_reduction WHERE business_id=b AND input_id=i.id);
 SELECT coalesce((SELECT revision FROM core.conversation_context WHERE business_id=b AND conversation_id=i.conversation_id),0) INTO revision_value;
 outcome=core.reduce_input_l0b(b,input_key,decision,seal_key,seal_digest);
 IF NOT prior AND outcome IN ('NAVIGATION','HUMAN_HANDOFF') AND (decision->>'contextRevision')::bigint=revision_value THEN
  FOR a IN SELECT x.* FROM core.attempt x LEFT JOIN core.operation op ON op.business_id=b AND op.id=x.operation_id
   LEFT JOIN core.output_intent o ON o.business_id=b AND o.id=x.output_id
   JOIN core.input source ON source.business_id=b AND source.id=coalesce(op.input_id,o.input_id)
   WHERE x.business_id=b AND source.conversation_id=i.conversation_id AND source.sequence<i.sequence AND x.state IN ('PREPARED','ARMED') ORDER BY x.id LOOP
   sk='supersession/'||b||'/'||input_key::text||'/'||a.id::text;
   SELECT s.digest INTO sd FROM core.seal s WHERE s.business_id=b AND s.stable_key=sk AND s.kind='ABANDON'
    AND s.receipt->'body'=jsonb_build_object('businessId',b,'attemptId',a.id,'payloadDigest',a.payload_digest,
      'priorityInputId',input_key,'decisionDigest',seal_digest,'reason','CONTEXT_SUPERSEDED');
   IF sd IS NULL THEN RAISE EXCEPTION 'priority_supersession_unsealed'; END IF;
   PERFORM core.abandon_unsent(b,a.id,sk,sd);
  END LOOP;
 END IF;
 RETURN outcome;
END $$;

-- Serialize new output creation with priority changes/expiry using gate lock order.
ALTER FUNCTION core.prepare_output(text,uuid,uuid,jsonb,text,text,text) RENAME TO prepare_output_l0b;
CREATE FUNCTION core.prepare_output(b text,o_id uuid,a_id uuid,e jsonb,d text,seal_key text,seal_digest text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE c uuid;
BEGIN
 IF b IS NULL OR o_id IS NULL OR a_id IS NULL OR e IS NULL OR d IS NULL OR seal_key IS NULL OR seal_digest IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 SELECT conversation_id INTO c FROM core.output_intent WHERE business_id=b AND id=o_id;
 IF c IS NULL THEN RAISE EXCEPTION 'output_missing'; END IF;
 PERFORM core.lock_conversation(b,c);
 IF EXISTS(SELECT 1 FROM core.output_intent WHERE business_id=b AND id=o_id AND state='EXPIRED') THEN RAISE EXCEPTION 'output_terminal'; END IF;
 RETURN core.prepare_output_l0b(b,o_id,a_id,e,d,seal_key,seal_digest);
END $$;

-- DB time and the same conversation/output/attempt locks as entry. An ARMED
-- attempt is safe to expire only if the entry CAS has never committed.
CREATE OR REPLACE FUNCTION core.expire_unsent(b text,o_id uuid,at_time timestamptz) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE o core.output_intent; a core.attempt; db_time timestamptz;
BEGIN
 IF b IS NULL OR o_id IS NULL OR at_time IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);db_time=core.authoritative_time();
 IF NOT coalesce(isfinite(at_time),false) OR abs(extract(epoch FROM at_time-db_time))>5 THEN RETURN false; END IF;
 SELECT * INTO o FROM core.output_intent WHERE business_id=b AND id=o_id;
 IF o.id IS NULL THEN RETURN false; END IF;
 PERFORM core.lock_conversation(b,o.conversation_id);
 SELECT * INTO o FROM core.output_intent WHERE business_id=b AND id=o_id FOR UPDATE;
 SELECT * INTO a FROM core.attempt WHERE business_id=b AND output_id=o_id FOR UPDATE;
 db_time=core.authoritative_time();
 IF o.state NOT IN ('PENDING','ARMED') OR o.deadline_at>=db_time OR (a.id IS NOT NULL AND a.state NOT IN ('PREPARED','ARMED','ABANDONED')) THEN RETURN false; END IF;
 UPDATE core.attempt SET state='ABANDONED' WHERE business_id=b AND id=a.id AND state IN ('PREPARED','ARMED');
 UPDATE core.output_intent SET state='EXPIRED' WHERE business_id=b AND id=o_id AND state IN ('PENDING','ARMED');
 INSERT INTO core.audit(business_id,actor,action,evidence,detail) VALUES(b,session_user,'UNSENT_EXPIRED',o_id::text,jsonb_build_object('outputId',o_id,'attemptId',a.id,'deadline',o.deadline_at));
 RETURN true;
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='core'::regnamespace LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO wp1_definer',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION core.reduce_input_l0b(text,uuid,jsonb,text,text),core.prepare_output_l0b(text,uuid,uuid,jsonb,text,text,text) FROM wp1_reducer;
GRANT EXECUTE ON FUNCTION core.reduce_input(text,uuid,jsonb,text,text),core.prepare_output(text,uuid,uuid,jsonb,text,text,text) TO wp1_reducer;
