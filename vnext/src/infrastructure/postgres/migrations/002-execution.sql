CREATE TABLE core.appointment (
 business_id text NOT NULL, id uuid NOT NULL CHECK(id<>'00000000-0000-0000-0000-000000000000'::uuid), calendar_id uuid NOT NULL,
 customer_id uuid NOT NULL, resource_id uuid NOT NULL, event_id text NOT NULL,
 origin text NOT NULL CHECK(origin='APP_CREATED'), state text NOT NULL CHECK(state IN ('PLANNED','ACTIVE','CANCELLED')),
 revision bigint NOT NULL DEFAULT 1, schedule_revision bigint NOT NULL DEFAULT 1,
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, buffer_minutes integer NOT NULL,
 PRIMARY KEY(business_id,id), UNIQUE(business_id,calendar_id,event_id),
 FOREIGN KEY(business_id,calendar_id) REFERENCES core.calendar(business_id,id),
 FOREIGN KEY(business_id,customer_id) REFERENCES core.customer(business_id,id),
 FOREIGN KEY(business_id,resource_id) REFERENCES core.resource(business_id,id),
 CHECK(isfinite(start_at) AND isfinite(end_at) AND start_at<end_at), CHECK(buffer_minutes BETWEEN 0 AND 1440)
);
CREATE TABLE core.operation (
 business_id text NOT NULL, id uuid NOT NULL CHECK(id<>'00000000-0000-0000-0000-000000000000'::uuid), input_id uuid NOT NULL, appointment_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('CREATE','MOVE','CANCEL','ATTENDANCE')),
 plan jsonb NOT NULL, plan_digest text NOT NULL, expected_revision bigint NOT NULL,
 PRIMARY KEY(business_id,id), UNIQUE(business_id,input_id), UNIQUE(business_id,id,appointment_id),
 FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id),
 FOREIGN KEY(business_id,appointment_id) REFERENCES core.appointment(business_id,id)
);
-- Keep output identities reserved even before finalization or after abandonment.
CREATE UNIQUE INDEX operation_output_identity ON core.operation(business_id,((plan->>'outputId')::uuid));

CREATE TABLE core.mutation_guard (
 business_id text NOT NULL, appointment_id uuid NOT NULL, operation_id uuid NOT NULL,
 PRIMARY KEY(business_id,appointment_id),
 FOREIGN KEY(business_id,operation_id,appointment_id) REFERENCES core.operation(business_id,id,appointment_id)
);
CREATE TABLE core.protection (
 business_id text NOT NULL, appointment_id uuid NOT NULL, operation_id uuid NOT NULL, resource_id uuid NOT NULL,
 protected_range tstzrange NOT NULL,
 FOREIGN KEY(business_id,operation_id,appointment_id) REFERENCES core.operation(business_id,id,appointment_id),
 FOREIGN KEY(business_id,resource_id) REFERENCES core.resource(business_id,id),
 CHECK(NOT isempty(protected_range) AND NOT lower_inf(protected_range) AND NOT upper_inf(protected_range)
   AND isfinite(lower(protected_range)) AND isfinite(upper(protected_range))
   AND lower_inc(protected_range) AND NOT upper_inc(protected_range)),
 EXCLUDE USING gist(business_id WITH =,resource_id WITH =,protected_range WITH &&)
 DEFERRABLE INITIALLY IMMEDIATE
);
CREATE TABLE core.output_intent (
 business_id text NOT NULL, id uuid NOT NULL CHECK(id<>'00000000-0000-0000-0000-000000000000'::uuid), parent_operation_id uuid NOT NULL,
 input_id uuid NOT NULL, appointment_id uuid NOT NULL, conversation_id uuid NOT NULL,
 sequence bigint NOT NULL, ordinal integer NOT NULL CHECK(ordinal>=0), recipient text NOT NULL,
 payload jsonb NOT NULL, payload_digest text NOT NULL, schedule_revision bigint NOT NULL,
 purpose text NOT NULL CHECK(purpose IN ('CUSTOMER_REQUEST','REMINDER')),
 due_at timestamptz NOT NULL, deadline_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('PENDING','ARMED','SUBMISSION_ENTERED','UNKNOWN','ACCEPTED','EXPIRED')),
 PRIMARY KEY(business_id,id), UNIQUE(business_id,conversation_id,sequence,ordinal),
 FOREIGN KEY(business_id,parent_operation_id,appointment_id) REFERENCES core.operation(business_id,id,appointment_id),
 FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id),
 FOREIGN KEY(business_id,conversation_id) REFERENCES core.conversation(business_id,id),
 CHECK(isfinite(due_at) AND isfinite(deadline_at) AND due_at<deadline_at)
);
CREATE TABLE core.attempt (
 business_id text NOT NULL, id uuid NOT NULL CHECK(id<>'00000000-0000-0000-0000-000000000000'::uuid), operation_id uuid, output_id uuid,
 state text NOT NULL CHECK(state IN ('PREPARED','ARMED','SUBMISSION_ENTERED','UNKNOWN','VERIFIED_APPLIED','ABANDONED')),
 owner_id uuid CHECK(owner_id IS NULL OR owner_id<>'00000000-0000-0000-0000-000000000000'::uuid), envelope jsonb NOT NULL, payload_digest text NOT NULL,
 arm_seal text, meta_message_id text, meta_status text,
 PRIMARY KEY(business_id,id), UNIQUE(business_id,operation_id), UNIQUE(business_id,output_id),
 FOREIGN KEY(business_id,operation_id) REFERENCES core.operation(business_id,id),
 FOREIGN KEY(business_id,output_id) REFERENCES core.output_intent(business_id,id),
 FOREIGN KEY(business_id,arm_seal) REFERENCES core.seal(business_id,stable_key),
 CHECK((operation_id IS NULL)<>(output_id IS NULL)),
 CHECK((state='PREPARED' AND owner_id IS NULL) OR (state NOT IN ('PREPARED','ABANDONED') AND owner_id IS NOT NULL) OR state='ABANDONED'),
 CHECK(envelope ?& ARRAY['formatVersion','businessId','attemptId','payloadDigest','recipient','channelId','channelRevision','waba','numberId','calendarId','calendarRevision','grantId','conversationId','businessRevision','recoveryEpoch','permissionRevision','purpose','dueAt','deadlineAt','windowEnd','budgetSeconds','remoteId','payload']),
 CHECK(coalesce(envelope->>'formatVersion'='1' AND envelope->>'businessId'=business_id AND envelope->>'attemptId'=id::text AND envelope->>'payloadDigest'=payload_digest AND envelope->>'purpose' IN ('CUSTOMER_REQUEST','REMINDER'),false)),
 CHECK(coalesce((envelope->>'businessRevision')::bigint>0 AND (envelope->>'channelRevision')::bigint>0
   AND (envelope->>'calendarRevision')::bigint>0 AND (envelope->>'recoveryEpoch')::bigint>0
   AND (envelope->>'permissionRevision')::bigint>=0 AND (envelope->>'budgetSeconds')::integer BETWEEN 1 AND 3600
   AND length(envelope->>'recipient')>0 AND length(envelope->>'grantId')>0
   AND isfinite((envelope->>'dueAt')::timestamptz) AND isfinite((envelope->>'deadlineAt')::timestamptz)
   AND isfinite((envelope->>'windowEnd')::timestamptz),false)),
 CHECK(meta_status IS NULL OR meta_status IN ('sent','delivered','read','failed'))
);
CREATE TABLE core.receipt (
 business_id text NOT NULL REFERENCES core.business, input_id uuid NOT NULL,
 attempt_id uuid, message_id text NOT NULL, status text NOT NULL,
 correlated boolean NOT NULL, PRIMARY KEY(business_id,input_id),
 FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id),
 FOREIGN KEY(business_id,attempt_id) REFERENCES core.attempt(business_id,id)
);

CREATE FUNCTION core.immutable_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,core AS $$
BEGIN
 IF TG_TABLE_NAME='attempt' THEN
  IF (to_jsonb(NEW)-ARRAY['state','owner_id','arm_seal','meta_message_id','meta_status'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','owner_id','arm_seal','meta_message_id','meta_status'])
    OR (OLD.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM OLD.owner_id)
    THEN RAISE EXCEPTION 'immutable_attempt'; END IF;
 ELSIF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'immutable_record'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_operation BEFORE UPDATE ON core.operation FOR EACH ROW EXECUTE FUNCTION core.immutable_fields();
CREATE TRIGGER immutable_attempt BEFORE UPDATE ON core.attempt FOR EACH ROW EXECUTE FUNCTION core.immutable_fields();
CREATE TRIGGER immutable_seal BEFORE UPDATE ON core.seal FOR EACH ROW EXECUTE FUNCTION core.immutable_fields();

-- Internal-only shared final output INSERT. roles.sql revokes PUBLIC and grants
-- no runtime role direct EXECUTE. Both preparation preflight and finalization
-- exercise the real table's types, NOT NULL, CHECK, UNIQUE and composite FKs.
CREATE FUNCTION core.insert_operation_output(b text,p jsonb,operation_key uuid,source_input core.input,appointment_value core.appointment) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 PERFORM core.assert_scope(b);
 INSERT INTO core.output_intent VALUES(b,(p->>'outputId')::uuid,operation_key,source_input.id,appointment_value.id,
 source_input.conversation_id,source_input.sequence,0,source_input.subject,p->'outputPayload',p->>'outputDigest',
 appointment_value.schedule_revision,p->>'outputPurpose',(p->>'outputDueAt')::timestamptz,(p->>'outputDeadlineAt')::timestamptz,'PENDING');
END $$;

CREATE FUNCTION core.prepare_operation(b text,p jsonb,p_digest text,seal_key text) RETURNS uuid
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

CREATE FUNCTION core.prepare_output(b text,o_id uuid,a_id uuid,e jsonb,d text,seal_key text,seal_digest text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE o core.output_intent; prior core.attempt; ap core.appointment;
BEGIN
 IF b IS NULL OR o_id IS NULL OR a_id IS NULL OR e IS NULL OR d IS NULL OR seal_key IS NULL OR seal_digest IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 PERFORM 1 FROM core.business WHERE business_id=b AND status='ACTIVE' AND dispatch_enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'business_paused'; END IF;
 IF NOT EXISTS(SELECT 1 FROM core.seal s WHERE s.business_id=b AND s.stable_key=seal_key AND s.kind='OUTPUT_PLAN' AND s.digest=seal_digest
   AND s.receipt->'body'->>'attemptId'=a_id::text AND s.receipt->'body'->>'outputId'=o_id::text AND s.receipt->'body'->'envelope'=e)
 THEN RAISE EXCEPTION 'unsealed_output'; END IF;
 SELECT * INTO o FROM core.output_intent WHERE business_id=b AND id=o_id FOR UPDATE;
 IF o.id IS NULL OR e->>'outputId' IS DISTINCT FROM o.id::text OR e->>'payloadDigest' IS DISTINCT FROM o.payload_digest OR d<>o.payload_digest
 OR e->>'recipient'<>o.recipient THEN RAISE EXCEPTION 'output_denied'; END IF;
 SELECT * INTO ap FROM core.appointment WHERE business_id=b AND id=o.appointment_id;
 IF core.envelope_context(b,e,o.input_id,ap.calendar_id,o.purpose,o.due_at,o.deadline_at) IS NOT TRUE
 OR e->'payload' IS DISTINCT FROM o.payload OR e->>'attemptId' IS DISTINCT FROM a_id::text
 OR e->>'remoteId' IS DISTINCT FROM 'fake-message-'||a_id::text
 THEN RAISE EXCEPTION 'output_envelope_denied'; END IF;
 SELECT * INTO prior FROM core.attempt WHERE business_id=b AND output_id=o_id;
 IF prior.id IS NOT NULL THEN
  IF prior.id<>a_id OR prior.envelope<>e THEN RAISE EXCEPTION 'output_conflict'; END IF; RETURN prior.id;
 END IF;
 INSERT INTO core.attempt(business_id,id,output_id,state,envelope,payload_digest) VALUES(b,a_id,o_id,'PREPARED',e,d);
 RETURN a_id;
END $$;

CREATE FUNCTION core.arm(b text,a_id uuid,owner uuid,seal_key text,seal_digest text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF b IS NULL OR a_id IS NULL OR owner IS NULL OR seal_key IS NULL OR seal_digest IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 PERFORM 1 FROM core.business bh JOIN core.attempt a ON a.business_id=bh.business_id WHERE bh.business_id=b AND a.id=a_id
   AND bh.status='ACTIVE' AND bh.dispatch_enabled AND bh.recovery_epoch=(a.envelope->>'recoveryEpoch')::bigint AND bh.revision=(a.envelope->>'businessRevision')::bigint FOR SHARE OF bh;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM core.seal s JOIN core.attempt a ON a.business_id=s.business_id AND a.id=a_id
   WHERE s.business_id=b AND s.stable_key=seal_key AND s.kind='ARM' AND s.digest=seal_digest
   AND s.receipt->'body'->>'attemptId'=a.id::text AND s.receipt->'body'->>'ownerId'=owner::text
   AND s.receipt->'body'->>'payloadDigest'=a.payload_digest AND s.receipt->'body'->'envelope'=a.envelope)
 THEN RAISE EXCEPTION 'unsealed_arm'; END IF;
 UPDATE core.attempt SET state='ARMED',owner_id=owner,arm_seal=seal_key
 WHERE business_id=b AND id=a_id AND state='PREPARED';
 IF FOUND THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM core.attempt WHERE business_id=b AND id=a_id AND state='ARMED' AND owner_id=owner AND arm_seal=seal_key);
END $$;

-- Only a successful CAS within a known committed transaction may create the
-- process-local invocation permit. There is no token lookup/reissue function.
CREATE FUNCTION core.enter_submission(b text,a_id uuid,owner uuid,at_time timestamptz) RETURNS boolean
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
 IF a.output_id IS NOT NULL THEN
  SELECT * INTO o FROM core.output_intent WHERE business_id=b AND id=a.output_id FOR UPDATE;
  IF o.id IS NULL OR o.state NOT IN ('PENDING','ARMED') OR o.recipient IS DISTINCT FROM e->>'recipient' THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM core.output_intent prev WHERE prev.business_id=b AND prev.conversation_id=o.conversation_id
    AND (prev.sequence,prev.ordinal)<(o.sequence,o.ordinal) AND prev.state NOT IN ('ACCEPTED','EXPIRED')) THEN RETURN false; END IF;
  purpose_value=o.purpose;
  IF e->>'purpose' IS DISTINCT FROM o.purpose OR e->'payload' IS DISTINCT FROM o.payload OR e->>'payloadDigest' IS DISTINCT FROM o.payload_digest THEN RETURN false; END IF;
  SELECT * INTO source_input FROM core.input WHERE business_id=b AND id=o.input_id;
  SELECT * INTO ap FROM core.appointment WHERE business_id=b AND id=o.appointment_id FOR UPDATE;
  IF ap.state<>'ACTIVE' OR ap.schedule_revision<>o.schedule_revision THEN RETURN false; END IF;
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

CREATE FUNCTION core.mark_unknown(b text,a_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF b IS NULL OR a_id IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 UPDATE core.attempt SET state='UNKNOWN' WHERE business_id=b AND id=a_id AND state='SUBMISSION_ENTERED';
 UPDATE core.output_intent SET state='UNKNOWN' WHERE business_id=b AND id IN
   (SELECT output_id FROM core.attempt WHERE business_id=b AND id=a_id AND state='UNKNOWN') AND state='SUBMISSION_ENTERED';
END $$;

CREATE FUNCTION core.apply_result(b text,a_id uuid,proof jsonb,seal_key text,seal_digest text,fail_at text DEFAULT '') RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE a core.attempt; op core.operation; ap core.appointment; p jsonb; i core.input;
BEGIN
 IF b IS NULL OR a_id IS NULL OR proof IS NULL OR seal_key IS NULL OR seal_digest IS NULL OR fail_at IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 IF NOT EXISTS(SELECT 1 FROM core.seal s WHERE s.business_id=b AND s.stable_key=seal_key AND s.kind='RESULT' AND s.digest=seal_digest AND s.receipt->'body'=proof)
 THEN RAISE EXCEPTION 'unsealed_result'; END IF;
 SELECT * INTO a FROM core.attempt WHERE business_id=b AND id=a_id;
 IF jsonb_typeof(proof) IS DISTINCT FROM 'object' OR proof->>'remoteId' IS NULL OR proof->>'remoteId'='' THEN RAISE EXCEPTION 'foreign_proof'; END IF;
 IF a.id IS NULL OR proof->>'attemptId' IS DISTINCT FROM a.id::text OR proof->>'businessId' IS DISTINCT FROM b OR proof->>'payloadDigest' IS DISTINCT FROM a.payload_digest THEN RAISE EXCEPTION 'foreign_proof'; END IF;
 IF a.operation_id IS NOT NULL THEN
  SELECT * INTO op FROM core.operation WHERE business_id=b AND id=a.operation_id;
  SELECT * INTO i FROM core.input WHERE business_id=b AND id=op.input_id;
  PERFORM 1 FROM core.conversation WHERE business_id=b AND id=i.conversation_id FOR UPDATE;
  SELECT * INTO ap FROM core.appointment WHERE business_id=b AND id=op.appointment_id FOR UPDATE;
 END IF;
 SELECT * INTO a FROM core.attempt WHERE business_id=b AND id=a_id FOR UPDATE;
 IF a.state='VERIFIED_APPLIED' THEN RETURN false; END IF;
 IF a.state NOT IN ('SUBMISSION_ENTERED','UNKNOWN') THEN RAISE EXCEPTION 'not_submitted'; END IF;
 IF a.operation_id IS NOT NULL THEN
  IF ap.revision<>op.expected_revision OR proof->>'remoteId' IS DISTINCT FROM ap.event_id
   OR NOT EXISTS(SELECT 1 FROM core.mutation_guard WHERE business_id=b AND appointment_id=ap.id AND operation_id=op.id)
  THEN RAISE EXCEPTION 'stale_finalizer'; END IF;
  p=op.plan;
  UPDATE core.appointment SET state=CASE WHEN op.kind='CANCEL' THEN 'CANCELLED' ELSE 'ACTIVE' END,
   revision=revision+1,schedule_revision=schedule_revision+CASE WHEN op.kind IN ('CREATE','MOVE','CANCEL') THEN 1 ELSE 0 END,
   start_at=CASE WHEN op.kind IN ('CREATE','MOVE') THEN (p->>'startAt')::timestamptz ELSE start_at END,
   end_at=CASE WHEN op.kind IN ('CREATE','MOVE') THEN (p->>'endAt')::timestamptz ELSE end_at END,
   resource_id=CASE WHEN op.kind IN ('CREATE','MOVE') THEN (p->>'resourceId')::uuid ELSE resource_id END
   WHERE business_id=b AND id=ap.id RETURNING * INTO ap;
  IF fail_at='appointment' THEN RAISE EXCEPTION 'injected_finalizer_appointment'; END IF;
  DELETE FROM core.protection WHERE business_id=b AND appointment_id=ap.id;
  IF op.kind<>'CANCEL' THEN INSERT INTO core.protection VALUES(b,ap.id,op.id,ap.resource_id,tstzrange(ap.start_at,ap.end_at+ap.buffer_minutes*interval '1 minute','[)')); END IF;
  IF fail_at='protection' THEN RAISE EXCEPTION 'injected_finalizer_protection'; END IF;
  SELECT * INTO i FROM core.input WHERE business_id=b AND id=op.input_id;
  PERFORM core.insert_operation_output(b,p,op.id,i,ap);
  IF fail_at='output' THEN RAISE EXCEPTION 'injected_finalizer_output'; END IF;
  DELETE FROM core.mutation_guard WHERE business_id=b AND appointment_id=ap.id AND operation_id=op.id;
  IF fail_at='guard' THEN RAISE EXCEPTION 'injected_finalizer_guard'; END IF;
 ELSE
  IF a.meta_message_id IS NOT NULL AND a.meta_message_id IS DISTINCT FROM proof->>'remoteId' THEN RAISE EXCEPTION 'message_id_conflict'; END IF;
  UPDATE core.output_intent SET state='ACCEPTED' WHERE business_id=b AND id=a.output_id;
 END IF;
 UPDATE core.attempt SET state='VERIFIED_APPLIED',meta_message_id=CASE WHEN output_id IS NOT NULL THEN proof->>'remoteId' ELSE NULL END WHERE business_id=b AND id=a_id;
 RETURN true;
END $$;

CREATE FUNCTION core.accept_receipt(b text,input_key uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; a core.attempt; event jsonb; matched boolean=false;
BEGIN
 IF b IS NULL OR input_key IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 SELECT * INTO i FROM core.input WHERE business_id=b AND id=input_key AND state='ELIGIBLE';
 IF i.id IS NULL OR i.event->>'type' IS DISTINCT FROM 'receipt' THEN RAISE EXCEPTION 'unsealed_receipt'; END IF;
 event=i.event;
 SELECT * INTO a FROM core.attempt WHERE business_id=b AND id=(event->>'attemptId')::uuid AND output_id IS NOT NULL FOR UPDATE;
 IF a.id IS NOT NULL AND a.envelope->>'recipient'=event->>'recipient'
  AND (a.envelope->>'channelId')::uuid=i.channel_id
  AND a.state IN ('SUBMISSION_ENTERED','UNKNOWN','VERIFIED_APPLIED')
  AND (a.meta_message_id IS NULL OR a.meta_message_id=event->>'messageId') THEN
  matched=true;
  IF event->>'status' IN ('sent','delivered','read') THEN
   UPDATE core.attempt SET state='VERIFIED_APPLIED',meta_message_id=event->>'messageId',
    meta_status=CASE WHEN array_position(ARRAY['sent','failed','delivered','read'],coalesce(meta_status,'sent'))
      <=array_position(ARRAY['sent','failed','delivered','read'],event->>'status') THEN event->>'status' ELSE meta_status END
    WHERE business_id=b AND id=a.id;
   UPDATE core.output_intent SET state='ACCEPTED' WHERE business_id=b AND id=a.output_id;
  ELSIF event->>'status'='failed' AND a.meta_status IS DISTINCT FROM 'delivered' AND a.meta_status IS DISTINCT FROM 'read' THEN
   UPDATE core.attempt SET meta_message_id=event->>'messageId',meta_status='failed' WHERE business_id=b AND id=a.id;
   -- Delivery failure is evidence, never permission to resend or advance an unknown head.
  END IF;
 END IF;
 INSERT INTO core.receipt VALUES(b,i.id,CASE WHEN matched THEN a.id ELSE NULL END,event->>'messageId',event->>'status',matched)
 ON CONFLICT DO NOTHING;
 RETURN matched;
END $$;

CREATE FUNCTION core.expire_unsent(b text,o_id uuid,at_time timestamptz) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF b IS NULL OR o_id IS NULL OR at_time IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 IF NOT coalesce(isfinite(at_time),false) OR abs(extract(epoch FROM at_time-core.authoritative_time()))>5 THEN RETURN false; END IF;
 at_time=core.authoritative_time();
 UPDATE core.output_intent o SET state='EXPIRED' WHERE o.business_id=b AND o.id=o_id AND o.state='PENDING' AND o.deadline_at<at_time
 AND NOT EXISTS(SELECT 1 FROM core.attempt a WHERE a.business_id=b AND a.output_id=o.id AND a.state<>'PREPARED');
 RETURN FOUND;
END $$;
