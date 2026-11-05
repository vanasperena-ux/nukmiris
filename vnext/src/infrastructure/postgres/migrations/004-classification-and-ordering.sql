-- L0b is a fresh synthetic-schema increment. O3: never tighten constraints over
-- in-flight or previously classified data. Production migration/revalidation is gated.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM core.input) OR EXISTS(SELECT 1 FROM core.attempt) THEN
  RAISE EXCEPTION 'l0b_migration_requires_empty_inert_fixture';
 END IF;
END $$;

CREATE FUNCTION core.valid_tenant_bindings(v jsonb,b text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,core AS $$
DECLARE k text; x jsonb;
BEGIN
 IF v IS NULL OR b IS NULL OR b !~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' OR b ~ '[^a-z0-9-]' OR length(b)>64 THEN RETURN false; END IF;
 IF jsonb_typeof(v)='array' THEN
  FOR x IN SELECT value FROM jsonb_array_elements(v) LOOP IF NOT core.valid_tenant_bindings(x,b) THEN RETURN false; END IF; END LOOP;
 ELSIF jsonb_typeof(v)='object' THEN
  FOR k,x IN SELECT key,value FROM jsonb_each(v) LOOP
   IF replace(lower(k),'_','') IN ('businessid','tenantid') AND (k<>'businessId' OR x IS DISTINCT FROM to_jsonb(b)) THEN RETURN false; END IF;
   IF NOT core.valid_tenant_bindings(x,b) THEN RETURN false; END IF;
  END LOOP;
 END IF;
 RETURN true;
END $$;
ALTER FUNCTION core.register_seal(text,text,text,text,jsonb) RENAME TO register_seal_wp1;
CREATE FUNCTION core.register_seal(b text,k text,t text,d text,r jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF b IS NULL OR k IS NULL OR t IS NULL OR d IS NULL OR r IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 IF NOT core.valid_tenant_bindings(r->'body',b) THEN RAISE EXCEPTION 'tenant_binding_denied'; END IF;
 PERFORM core.register_seal_wp1(b,k,t,d,r);
END $$;

CREATE TABLE core.input_classification (
 business_id text NOT NULL, input_id uuid NOT NULL, value jsonb NOT NULL,
 digest text NOT NULL, seal_key text NOT NULL,
 PRIMARY KEY(business_id,input_id), FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id),
 FOREIGN KEY(business_id,seal_key) REFERENCES core.seal(business_id,stable_key)
);
CREATE TABLE core.conversation_context (
 business_id text NOT NULL, conversation_id uuid NOT NULL, revision bigint NOT NULL CHECK(revision>=0),
 mode text NOT NULL CHECK(mode IN ('BOT','HUMAN')), phase text NOT NULL CHECK(phase IN ('NONE','NAME','DATE')),
 PRIMARY KEY(business_id,conversation_id), FOREIGN KEY(business_id,conversation_id) REFERENCES core.conversation(business_id,id)
);
CREATE TABLE core.input_reduction (
 business_id text NOT NULL, input_id uuid NOT NULL, outcome text NOT NULL CHECK(outcome IN
 ('WITHDRAWAL','RECEIPT_CONTROL','NAVIGATION','HUMAN_HANDOFF','CONTEXT_INPUT','NO_EFFECT','PLAN_CONFLICT')),
 context_revision bigint NOT NULL CHECK(context_revision>=0), decision jsonb NOT NULL, seal_key text NOT NULL,
 PRIMARY KEY(business_id,input_id), FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id),
 FOREIGN KEY(business_id,seal_key) REFERENCES core.seal(business_id,stable_key)
);
CREATE TABLE core.plan_rejection (
 business_id text NOT NULL, input_id uuid NOT NULL, plan_digest text NOT NULL, reason text NOT NULL,
 PRIMARY KEY(business_id,input_id), FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id)
);

ALTER FUNCTION core.stage_batch(text,text,text,jsonb) RENAME TO stage_batch_wp1;
CREATE FUNCTION core.stage_batch(b text,batch_id text,batch_digest text,items jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE item jsonb; c jsonb; prior core.input_classification;
BEGIN
 IF b IS NULL OR batch_id IS NULL OR batch_digest IS NULL OR items IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'batch_shape'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
  c=item->'classification';
  IF item->>'businessId' IS DISTINCT FROM b OR NOT core.valid_tenant_bindings(item,b) OR NOT EXISTS(SELECT 1 FROM core.seal s WHERE s.business_id=b
    AND s.stable_key=item->>'inputSealKey' AND s.kind='INPUT' AND s.receipt->'body'=item)
   OR jsonb_typeof(c) IS DISTINCT FROM 'object' OR c->>'version' IS DISTINCT FROM '1'
   OR c->>'ruleVersion' IS DISTINCT FROM 'L0B-CLASS-1' OR c->>'businessId' IS DISTINCT FROM b
   OR c->>'channelId' IS DISTINCT FROM item->>'channelId' OR c->>'subject' IS DISTINCT FROM item->>'subject'
   OR c->>'inputId' IS DISTINCT FROM item->>'inputId' OR c->>'eventDigest' IS DISTINCT FROM item->>'digest'
   OR c IS DISTINCT FROM jsonb_build_object('version',1,'ruleVersion','L0B-CLASS-1','businessId',b,'channelId',item->'channelId','subject',item->'subject','inputId',item->'inputId','eventDigest',item->'digest','kind',c->'kind','operation',c->'operation')
   OR c->>'kind' IS NULL OR c->>'kind' NOT IN ('ORDINARY','WITHDRAWAL','RECEIPT')
   OR c->>'operation' IS NULL OR c->>'operation' NOT IN ('NONE','SYNTHETIC_OPERATION')
   OR (c->>'kind'='RECEIPT') IS DISTINCT FROM (item->'event'->>'type'='receipt')
   OR (c->>'kind'<>'ORDINARY' AND c->>'operation'<>'NONE') THEN RAISE EXCEPTION 'classification_denied'; END IF;
 END LOOP;
 PERFORM core.stage_batch_wp1(b,batch_id,batch_digest,items);
 FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
  INSERT INTO core.input_classification VALUES(b,(item->>'inputId')::uuid,item->'classification',core.json_digest(item->'classification'),item->>'inputSealKey') ON CONFLICT DO NOTHING;
  SELECT * INTO prior FROM core.input_classification WHERE business_id=b AND input_id=(item->>'inputId')::uuid;
  IF prior.value IS DISTINCT FROM item->'classification' OR prior.seal_key IS DISTINCT FROM item->>'inputSealKey' THEN RAISE EXCEPTION 'classification_conflict'; END IF;
 END LOOP;
END $$;

ALTER FUNCTION core.activate_batch(text,text,text,text) RENAME TO activate_batch_wp1;
CREATE OR REPLACE FUNCTION core.activate_batch_wp1(b text,batch_id text,seal_key text,seal_digest text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE batch_row core.batch; body jsonb;
BEGIN
 IF b IS NULL OR batch_id IS NULL OR seal_key IS NULL OR seal_digest IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 SELECT * INTO batch_row FROM core.batch WHERE business_id=b AND id=batch_id FOR UPDATE;
 SELECT receipt->'body' INTO body FROM core.seal WHERE business_id=b AND stable_key=seal_key AND kind='BATCH_COMMIT' AND digest=seal_digest;
 IF batch_row.id IS NULL OR body->>'businessId' IS DISTINCT FROM b OR body->>'batchId' IS DISTINCT FROM batch_id
 OR body->>'batchDigest' IS DISTINCT FROM batch_row.digest OR body->>'membershipDigest' IS DISTINCT FROM core.json_digest(batch_row.items)
 OR (body->>'count')::integer IS DISTINCT FROM jsonb_array_length(batch_row.items)
 OR (SELECT count(*) FROM core.batch_input bi WHERE bi.business_id=b AND bi.batch_id=activate_batch_wp1.batch_id)<>jsonb_array_length(batch_row.items)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(batch_row.items) item LEFT JOIN core.batch_input bi
 ON bi.business_id=b AND bi.batch_id=activate_batch_wp1.batch_id AND bi.input_id=(item->>'inputId')::uuid
 LEFT JOIN core.input i ON i.business_id=b AND i.id=bi.input_id
 WHERE i.id IS NULL OR i.digest IS DISTINCT FROM item->>'digest' OR i.event IS DISTINCT FROM item->'event'
 OR i.channel_id IS DISTINCT FROM (item->>'channelId')::uuid OR i.conversation_id IS DISTINCT FROM (item->>'conversationId')::uuid
 OR i.provider_id IS DISTINCT FROM item->>'providerId' OR i.subject IS DISTINCT FROM item->>'subject'
 OR i.received_at IS DISTINCT FROM (item->>'receivedAt')::timestamptz)
 THEN RAISE EXCEPTION 'unsealed_batch'; END IF;
 IF batch_row.state='ELIGIBLE' THEN
  IF batch_row.seal_key IS DISTINCT FROM seal_key THEN RAISE EXCEPTION 'batch_conflict'; END IF;
  RETURN;
 END IF;
 UPDATE core.input SET state='ELIGIBLE' WHERE business_id=b AND state='STAGED' AND id IN
 (SELECT input_id FROM core.batch_input WHERE business_id=b AND core.batch_input.batch_id=activate_batch_wp1.batch_id);
 UPDATE core.batch SET state='ELIGIBLE',seal_key=activate_batch_wp1.seal_key WHERE business_id=b AND id=batch_id;
END $$;
CREATE FUNCTION core.activate_batch(b text,batch_id text,seal_key text,seal_digest text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; c core.input_classification; kind text;
BEGIN
 IF b IS NULL OR batch_id IS NULL OR seal_key IS NULL OR seal_digest IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 PERFORM 1 FROM core.batch WHERE business_id=b AND id=batch_id FOR UPDATE;
 PERFORM 1 FROM core.conversation cv WHERE cv.business_id=b AND cv.id IN
  (SELECT x.conversation_id FROM core.input x JOIN core.batch_input bi ON bi.business_id=b AND bi.input_id=x.id WHERE bi.batch_id=activate_batch.batch_id AND x.business_id=b)
  ORDER BY cv.id FOR UPDATE;
 PERFORM core.activate_batch_wp1(b,batch_id,seal_key,seal_digest);
 FOR i IN SELECT x.* FROM core.input x JOIN core.batch_input bi ON bi.business_id=b AND bi.input_id=x.id
  WHERE bi.batch_id=activate_batch.batch_id AND x.business_id=b LOOP
  SELECT * INTO c FROM core.input_classification WHERE business_id=b AND input_id=i.id;
  IF c.input_id IS NULL THEN RAISE EXCEPTION 'classification_missing'; END IF;
  kind=c.value->>'kind';
  IF kind='WITHDRAWAL' AND NOT EXISTS(SELECT 1 FROM core.permission_event pe WHERE pe.business_id=b AND pe.evidence_id='inbound:'||i.channel_id::text||':'||i.provider_id
   AND pe.subject=i.subject AND pe.digest=i.digest AND pe.decision='REVOKE') THEN RAISE EXCEPTION 'withdrawal_not_durable'; END IF;
  IF kind IN ('WITHDRAWAL','RECEIPT') THEN
   INSERT INTO core.input_reduction VALUES(b,i.id,CASE WHEN kind='RECEIPT' THEN 'RECEIPT_CONTROL' ELSE kind END,0,
    jsonb_build_object('businessId',b,'inputId',i.id,'classificationDigest',c.digest,'eventDigest',i.digest,'outputDisposition','NONE'),c.seal_key) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
END $$;

-- A sealed terminal reduction is the only normal non-mutating head disposition.
CREATE OR REPLACE FUNCTION core.conversation_ready(b text,c uuid,n bigint) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
 SELECT NOT EXISTS(SELECT 1 FROM core.input i WHERE i.business_id=b AND i.conversation_id=c AND i.sequence<n AND i.state<>'HELD' AND
 (i.state<>'ELIGIBLE' OR (NOT EXISTS(SELECT 1 FROM core.input_reduction r WHERE r.business_id=b AND r.input_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM core.operation op JOIN core.attempt a ON a.business_id=b AND a.operation_id=op.id
 WHERE op.business_id=b AND op.input_id=i.id AND (a.state='ABANDONED' OR (a.state='VERIFIED_APPLIED'
 AND EXISTS(SELECT 1 FROM core.output_intent o WHERE o.business_id=b AND o.parent_operation_id=op.id)
 AND NOT EXISTS(SELECT 1 FROM core.output_intent o WHERE o.business_id=b AND o.parent_operation_id=op.id AND o.state NOT IN ('ACCEPTED','EXPIRED'))))))))
$$;

CREATE FUNCTION core.reduce_input(b text,input_key uuid,decision jsonb,seal_key text,seal_digest text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; c core.input_classification; ctx core.conversation_context; prior core.input_reduction; outcome text;
BEGIN
 IF b IS NULL OR input_key IS NULL OR decision IS NULL OR seal_key IS NULL OR seal_digest IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 SELECT * INTO i FROM core.input WHERE business_id=b AND id=input_key;
 IF i.id IS NULL OR i.state<>'ELIGIBLE' THEN RAISE EXCEPTION 'input_not_eligible'; END IF;
 PERFORM 1 FROM core.conversation WHERE business_id=b AND id=i.conversation_id FOR UPDATE;
 SELECT * INTO prior FROM core.input_reduction WHERE business_id=b AND input_id=i.id;
 IF prior.input_id IS NOT NULL THEN
  IF prior.decision IS DISTINCT FROM decision THEN RAISE EXCEPTION 'reduction_conflict'; END IF; RETURN prior.outcome;
 END IF;
 SELECT * INTO c FROM core.input_classification WHERE business_id=b AND input_id=i.id;
 INSERT INTO core.conversation_context VALUES(b,i.conversation_id,0,'BOT','NONE') ON CONFLICT DO NOTHING;
 SELECT * INTO ctx FROM core.conversation_context WHERE business_id=b AND conversation_id=i.conversation_id;
 outcome=decision->>'outcome';
 IF c.value->>'kind' IS DISTINCT FROM 'ORDINARY' OR EXISTS(SELECT 1 FROM core.operation WHERE business_id=b AND input_id=i.id)
  OR decision->>'businessId' IS DISTINCT FROM b OR decision->>'inputId' IS DISTINCT FROM i.id::text
  OR decision->>'eventDigest' IS DISTINCT FROM i.digest OR decision->>'classificationDigest' IS DISTINCT FROM c.digest
  OR jsonb_typeof(decision->'contextRevision') IS DISTINCT FROM 'number' OR (decision->>'contextRevision')::bigint NOT BETWEEN 0 AND ctx.revision
  OR ((decision->>'contextRevision')::bigint=ctx.revision AND (decision->>'previousMode' IS DISTINCT FROM ctx.mode OR decision->>'previousPhase' IS DISTINCT FROM ctx.phase))
  OR outcome IS NULL OR outcome NOT IN ('NAVIGATION','HUMAN_HANDOFF','CONTEXT_INPUT','NO_EFFECT','PLAN_CONFLICT')
  OR decision->>'outputDisposition' IS DISTINCT FROM 'LOCAL_ONLY'
  OR decision->>'mode' IS NULL OR decision->>'mode' NOT IN ('BOT','HUMAN') OR decision->>'phase' IS NULL OR decision->>'phase' NOT IN ('NONE','NAME','DATE')
  OR NOT EXISTS(SELECT 1 FROM core.seal s WHERE s.business_id=b AND s.stable_key=seal_key AND s.kind='INPUT_REDUCTION' AND s.digest=seal_digest AND s.receipt->'body'=decision)
  THEN RAISE EXCEPTION 'reduction_denied'; END IF;
 IF c.value->>'operation'='SYNTHETIC_OPERATION' AND ctx.mode='BOT' AND outcome NOT IN ('PLAN_CONFLICT','HUMAN_HANDOFF') AND NOT (outcome='CONTEXT_INPUT' AND decision->>'previousPhase' IN ('NAME','DATE')) THEN RAISE EXCEPTION 'operation_requires_plan'; END IF;
 IF outcome='PLAN_CONFLICT' AND NOT EXISTS(SELECT 1 FROM core.plan_rejection pr WHERE pr.business_id=b AND pr.input_id=i.id AND pr.plan_digest=decision->>'planDigest') THEN RAISE EXCEPTION 'plan_rejection_missing'; END IF;
 IF outcome NOT IN ('NAVIGATION','HUMAN_HANDOFF') AND NOT core.conversation_ready(b,i.conversation_id,i.sequence) THEN RAISE EXCEPTION 'conversation_head_held' USING ERRCODE='P7502'; END IF;
 INSERT INTO core.input_reduction VALUES(b,i.id,outcome,(decision->>'contextRevision')::bigint,decision,seal_key);
 UPDATE core.conversation_context SET revision=revision+1,mode=decision->>'mode',phase=decision->>'phase' WHERE business_id=b AND conversation_id=i.conversation_id AND revision=(decision->>'contextRevision')::bigint;
 INSERT INTO core.audit(business_id,actor,action,evidence,detail) VALUES(b,session_user,'INPUT_REDUCED',seal_key,decision);
 RETURN outcome;
END $$;

CREATE FUNCTION core.reject_plan(b text,input_key uuid,plan_digest text,seal_key text,reason_value text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; prior core.plan_rejection;
BEGIN
 IF b IS NULL OR input_key IS NULL OR plan_digest IS NULL OR seal_key IS NULL OR reason_value IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);SELECT * INTO i FROM core.input WHERE business_id=b AND id=input_key;
 IF i.id IS NULL THEN RAISE EXCEPTION 'input_missing'; END IF;
 PERFORM 1 FROM core.conversation WHERE business_id=b AND id=i.conversation_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM core.seal s WHERE s.business_id=b AND s.stable_key=seal_key AND s.kind='OPERATION_PLAN' AND s.digest=plan_digest AND s.receipt->'body'->>'inputId'=i.id::text)
  OR reason_value NOT IN ('UNIQUE_CONFLICT','LOCK_TIMEOUT','RESOURCE_CONFLICT','CONTEXT_CHANGED') THEN RAISE EXCEPTION 'rejection_denied'; END IF;
 IF EXISTS(SELECT 1 FROM core.operation WHERE business_id=b AND input_id=i.id) THEN RETURN false; END IF;
 INSERT INTO core.plan_rejection VALUES(b,i.id,plan_digest,reason_value) ON CONFLICT DO NOTHING;
 SELECT * INTO prior FROM core.plan_rejection WHERE business_id=b AND input_id=i.id;
 IF prior.plan_digest IS DISTINCT FROM plan_digest THEN RAISE EXCEPTION 'rejection_conflict'; END IF;
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
 OR jsonb_typeof(p->'outputId') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'plan_output_denied'; END IF;
 BEGIN
  output_key=(p->>'outputId')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'plan_output_denied';
 END;
 IF output_key='00000000-0000-0000-0000-000000000000'::uuid
 OR output_key=(p->>'operationId')::uuid OR output_key=(p->>'attemptId')::uuid
 OR EXISTS(SELECT 1 FROM core.output_intent WHERE business_id=b AND id=output_key)
 OR EXISTS(SELECT 1 FROM core.operation WHERE business_id=b AND (plan->>'outputId')::uuid=output_key)
 THEN RAISE EXCEPTION 'plan_output_denied'; END IF;
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

CREATE OR REPLACE FUNCTION core.enter_submission(b text,a_id uuid,owner uuid,at_time timestamptz) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE bh core.business; a core.attempt; ch core.channel; cal core.calendar; ph core.permission_head;
 ap core.appointment; o core.output_intent; op core.operation; e jsonb; source_input core.input; purpose_value text; db_time timestamptz;
BEGIN
 IF b IS NULL OR a_id IS NULL OR owner IS NULL OR at_time IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 db_time=core.authoritative_time();
 IF NOT coalesce(isfinite(at_time),false) OR abs(extract(epoch FROM at_time-db_time))>5 THEN RETURN false; END IF;
 at_time=db_time;
 SELECT * INTO bh FROM core.business WHERE business_id=b FOR SHARE;
 IF NOT bh.dispatch_enabled OR bh.status<>'ACTIVE' THEN RETURN false; END IF;
 SELECT * INTO a FROM core.attempt WHERE business_id=b AND id=a_id;
 IF a.id IS NULL THEN RETURN false; END IF;
 e=a.envelope;
 IF coalesce((e->>'formatVersion')::integer,0)<>1 THEN RETURN false; END IF;
 SELECT * INTO ch FROM core.channel WHERE business_id=b AND id=(e->>'channelId')::uuid FOR SHARE;
 SELECT * INTO cal FROM core.calendar WHERE business_id=b AND id=(e->>'calendarId')::uuid FOR SHARE;
 IF ch.id IS NULL OR NOT ch.verified OR ch.revision IS DISTINCT FROM (e->>'channelRevision')::bigint
 OR ch.waba IS DISTINCT FROM e->>'waba' OR ch.number_id IS DISTINCT FROM e->>'numberId'
 OR cal.id IS NULL OR cal.revision IS DISTINCT FROM (e->>'calendarRevision')::bigint OR cal.grant_id IS DISTINCT FROM e->>'grantId'
 OR bh.revision<>(e->>'businessRevision')::bigint OR bh.recovery_epoch<>(e->>'recoveryEpoch')::bigint THEN RETURN false; END IF;
 INSERT INTO core.permission_head(business_id,subject,purpose) VALUES(b,e->>'recipient','REMINDER') ON CONFLICT DO NOTHING;
 SELECT * INTO ph FROM core.permission_head WHERE business_id=b AND subject=e->>'recipient' AND purpose='REMINDER' FOR UPDATE;

 PERFORM 1 FROM core.conversation WHERE business_id=b AND id=(e->>'conversationId')::uuid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM core.conversation_context WHERE business_id=b AND conversation_id=(e->>'conversationId')::uuid AND mode='HUMAN') THEN RETURN false; END IF;
 IF e->>'conversationRevision' IS DISTINCT FROM coalesce((SELECT revision::text FROM core.conversation_context WHERE business_id=b AND conversation_id=(e->>'conversationId')::uuid),'0') THEN RETURN false; END IF;
 IF a.output_id IS NOT NULL THEN
  SELECT * INTO o FROM core.output_intent WHERE business_id=b AND id=a.output_id FOR UPDATE;
  IF o.id IS NULL OR o.state NOT IN ('PENDING','ARMED') OR o.recipient IS DISTINCT FROM e->>'recipient' THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM core.output_intent prev WHERE prev.business_id=b AND prev.conversation_id=o.conversation_id
    AND (prev.sequence,prev.ordinal)<(o.sequence,o.ordinal) AND prev.state NOT IN ('ACCEPTED','EXPIRED')) THEN RETURN false; END IF;
  purpose_value=o.purpose;
  IF e->>'purpose' IS DISTINCT FROM o.purpose OR e->'payload' IS DISTINCT FROM o.payload OR e->>'payloadDigest' IS DISTINCT FROM o.payload_digest THEN RETURN false; END IF;
  SELECT * INTO source_input FROM core.input WHERE business_id=b AND id=o.input_id;
  SELECT * INTO ap FROM core.appointment WHERE business_id=b AND id=o.appointment_id FOR UPDATE;
  IF ap.schedule_revision<>o.schedule_revision OR NOT (ap.state='ACTIVE' OR (ap.state='CANCELLED' AND o.purpose='CUSTOMER_REQUEST' AND EXISTS(SELECT 1 FROM core.operation co JOIN core.attempt ca ON ca.business_id=b AND ca.operation_id=co.id WHERE co.business_id=b AND co.id=o.parent_operation_id AND co.kind='CANCEL' AND ca.state='VERIFIED_APPLIED'))) THEN RETURN false; END IF;
 ELSE
  SELECT * INTO op FROM core.operation WHERE business_id=b AND id=a.operation_id;
  purpose_value='CUSTOMER_REQUEST';
  SELECT * INTO source_input FROM core.input WHERE business_id=b AND id=op.input_id;
  SELECT * INTO ap FROM core.appointment WHERE business_id=b AND id=op.appointment_id FOR UPDATE;
  IF ap.revision<>op.expected_revision OR NOT EXISTS(SELECT 1 FROM core.mutation_guard WHERE business_id=b AND appointment_id=ap.id AND operation_id=op.id) THEN RETURN false; END IF;
 END IF;
 IF purpose_value='REMINDER' AND (ph.suppressed OR ph.revision IS DISTINCT FROM (e->>'permissionRevision')::bigint) THEN RETURN false; END IF;
 IF core.conversation_ready(b,source_input.conversation_id,source_input.sequence) IS NOT TRUE THEN RETURN false; END IF;
 at_time=core.authoritative_time();
 IF isfinite(at_time) IS NOT TRUE OR at_time<(e->>'dueAt')::timestamptz OR at_time>(e->>'deadlineAt')::timestamptz
 OR at_time>=ap.start_at OR at_time+((e->>'budgetSeconds')::integer)*interval '1 second'>=ap.start_at
 OR (purpose_value='CUSTOMER_REQUEST' AND at_time>=(e->>'windowEnd')::timestamptz) THEN RETURN false; END IF;
 UPDATE core.attempt SET state='SUBMISSION_ENTERED' WHERE business_id=b AND id=a_id AND state='ARMED' AND owner_id=owner;
 IF NOT FOUND THEN RETURN false; END IF;
 IF o.id IS NOT NULL THEN UPDATE core.output_intent SET state='SUBMISSION_ENTERED' WHERE business_id=b AND id=o.id; END IF;
 INSERT INTO core.audit(business_id,actor,action,evidence,detail) VALUES(b,session_user,'SUBMISSION_ENTERED',a_id::text,jsonb_build_object('owner',owner));
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION core.restore_snapshot(snap jsonb,evidence jsonb,reason_value text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE t text; item jsonb; b text; subject_value text;
BEGIN
 IF snap IS NULL OR evidence IS NULL OR reason_value IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 IF session_user<>'wp1_recovery' OR snap->>'format' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'recovery_denied'; END IF;
 IF EXISTS(SELECT 1 FROM core.business) THEN RAISE EXCEPTION 'recovery_destination_not_empty'; END IF;
 FOREACH t IN ARRAY ARRAY['business','channel','calendar','resource','customer','conversation','seal','batch','input','input_classification','conversation_context','input_reduction','plan_rejection','batch_input','permission_head','permission_event','status_event','appointment','operation','mutation_guard','protection','output_intent','attempt','receipt','recovery_case','audit'] LOOP
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

DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['input_classification','conversation_context','input_reduction','plan_rejection'] LOOP
  EXECUTE format('ALTER TABLE core.%I OWNER TO wp1_owner',t);
  EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE core.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY scoped ON core.%I USING (core.scope_allowed(business_id)) WITH CHECK(core.scope_allowed(business_id))',t);
  EXECUTE format('GRANT ALL ON core.%I TO wp1_definer',t);
  EXECUTE format('GRANT SELECT ON core.%I TO wp1_ingress,wp1_sealer,wp1_reducer,wp1_dispatch,wp1_result,wp1_operator,wp1_recovery,wp1_tenant_a,wp1_tenant_b',t);
  IF t<>'conversation_context' THEN EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON core.%I FOR EACH ROW EXECUTE FUNCTION core.append_only_fields()',t); END IF;
 END LOOP;
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='core'::regnamespace LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO wp1_definer',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION core.stage_batch_wp1(text,text,text,jsonb),core.activate_batch_wp1(text,text,text,text) FROM wp1_ingress;
GRANT EXECUTE ON FUNCTION core.stage_batch(text,text,text,jsonb),core.activate_batch(text,text,text,text) TO wp1_ingress;
GRANT EXECUTE ON FUNCTION core.reduce_input(text,uuid,jsonb,text,text),core.reject_plan(text,uuid,text,text,text) TO wp1_reducer;

REVOKE ALL ON FUNCTION core.register_seal_wp1(text,text,text,text,jsonb) FROM wp1_sealer;
GRANT EXECUTE ON FUNCTION core.register_seal(text,text,text,text,jsonb) TO wp1_sealer;

CREATE OR REPLACE FUNCTION core.envelope_context(b text,e jsonb,input_key uuid,calendar_key uuid,purpose_value text,due timestamptz,deadline timestamptz) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
 SELECT coalesce(e->>'conversationRevision'=coalesce(ctx.revision,0)::text AND e->>'formatVersion'='1' AND e->>'businessId'=b
 AND e->>'recipient'=i.subject AND (e->>'channelId')::uuid=i.channel_id
 AND (e->>'conversationId')::uuid=i.conversation_id
 AND ch.verified AND e->>'waba'=ch.waba AND e->>'numberId'=ch.number_id
 AND (e->>'channelRevision')::bigint=ch.revision
 AND (e->>'calendarId')::uuid=cal.id AND (e->>'calendarRevision')::bigint=cal.revision AND e->>'grantId'=cal.grant_id
 AND (e->>'businessRevision')::bigint=bh.revision AND (e->>'recoveryEpoch')::bigint=bh.recovery_epoch
 AND (e->>'permissionRevision')::bigint=coalesce(ph.revision,0)
 AND e->>'purpose'=purpose_value AND (e->>'dueAt')::timestamptz=due AND (e->>'deadlineAt')::timestamptz=deadline
 AND isfinite(due) AND isfinite(deadline) AND due<deadline
 AND (e->>'windowEnd')::timestamptz=i.received_at+interval '24 hours'
 AND core.json_digest(e->'payload')=e->>'payloadDigest',false)
 FROM core.input i LEFT JOIN core.conversation_context ctx ON ctx.business_id=b AND ctx.conversation_id=i.conversation_id JOIN core.channel ch ON ch.business_id=b AND ch.id=i.channel_id
 JOIN core.calendar cal ON cal.business_id=b AND cal.id=calendar_key
 JOIN core.business bh ON bh.business_id=b LEFT JOIN core.permission_head ph ON ph.business_id=b AND ph.subject=i.subject AND ph.purpose='REMINDER'
 WHERE i.business_id=b AND i.id=input_key
$$;


CREATE FUNCTION core.lock_conversation(b text,c uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF b IS NULL OR c IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 PERFORM 1 FROM core.business WHERE business_id=b FOR SHARE;
 PERFORM 1 FROM core.conversation WHERE business_id=b AND id=c FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'conversation_missing'; END IF;
END $$;
ALTER FUNCTION core.lock_conversation(text,uuid) OWNER TO wp1_definer;
REVOKE ALL ON FUNCTION core.lock_conversation(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.lock_conversation(text,uuid) TO wp1_reducer;

CREATE FUNCTION core.head_ready(b text,c uuid,n bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF b IS NULL OR c IS NULL OR n IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 RETURN EXISTS(SELECT 1 FROM core.conversation WHERE business_id=b AND id=c) AND core.conversation_ready(b,c,n);
END $$;
ALTER FUNCTION core.head_ready(text,uuid,bigint) OWNER TO wp1_definer;
REVOKE ALL ON FUNCTION core.head_ready(text,uuid,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.head_ready(text,uuid,bigint) TO wp1_reducer;

-- O1: catch known preparation failures in a subtransaction. Their reservation
-- writes roll back, while the rejection marker commits in the surrounding tx.
CREATE FUNCTION core.try_prepare_operation(b text,p jsonb,d text,k text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE result uuid; state_value text; message_value text; reason_value text;
BEGIN
 IF b IS NULL OR p IS NULL OR d IS NULL OR k IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 PERFORM core.lock_conversation(b,(p->'envelope'->>'conversationId')::uuid);
 BEGIN
  result=core.prepare_operation(b,p,d,k);
  RETURN jsonb_build_object('state','PREPARED','operationId',result);
 EXCEPTION WHEN unique_violation OR lock_not_available OR exclusion_violation OR SQLSTATE 'P7503' OR raise_exception THEN
  GET STACKED DIAGNOSTICS state_value=RETURNED_SQLSTATE,message_value=MESSAGE_TEXT;
  reason_value=CASE WHEN state_value='23505' OR message_value='plan_output_denied' THEN 'UNIQUE_CONFLICT'
    WHEN state_value='55P03' THEN 'LOCK_TIMEOUT' WHEN state_value='23P01' OR message_value='customer_overlap' THEN 'RESOURCE_CONFLICT'
    WHEN state_value='P7503' THEN 'CONTEXT_CHANGED' ELSE NULL END;
  IF reason_value IS NULL THEN RAISE; END IF;
 END;
 IF NOT core.reject_plan(b,(p->>'inputId')::uuid,d,k,reason_value) THEN RAISE EXCEPTION 'rejection_has_existing_operation'; END IF;
 RETURN jsonb_build_object('state','REJECTED','sqlState',state_value,'reason',reason_value);
END $$;
ALTER FUNCTION core.try_prepare_operation(text,jsonb,text,text) OWNER TO wp1_definer;
REVOKE ALL ON FUNCTION core.try_prepare_operation(text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.try_prepare_operation(text,jsonb,text,text) TO wp1_reducer;
