-- NM-069. Fresh isolated synthetic profiles only. No live provider adapter.
CREATE TABLE core.rm1_config (
 business_id text PRIMARY KEY REFERENCES core.business, enabled boolean NOT NULL DEFAULT false,
 activated_at timestamptz, CHECK(enabled=false OR activated_at IS NOT NULL));
CREATE TABLE core.rm1_template (
 business_id text NOT NULL, channel_id uuid NOT NULL, waba text NOT NULL, number_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('seven_day','confirmation','followup','final')),
 template_name text NOT NULL, language text NOT NULL CHECK(language='es_MX'),
 status text NOT NULL CHECK(status IN ('APPROVED','MISSING','REJECTED','UNAVAILABLE')),
 PRIMARY KEY(business_id,channel_id,kind), FOREIGN KEY(business_id,channel_id) REFERENCES core.channel(business_id,id));
CREATE TABLE core.rm1_schedule (
 business_id text NOT NULL, appointment_id uuid NOT NULL, schedule_revision bigint NOT NULL,
 operation_id uuid NOT NULL, input_id uuid NOT NULL, conversation_id uuid NOT NULL, channel_id uuid NOT NULL,
 subject text NOT NULL, customer_name text NOT NULL, start_at timestamptz NOT NULL,
 attendance text NOT NULL CHECK(attendance IN ('PENDING','CONFIRMED','RESCHEDULE_REQUESTED','CANCELLED','SUPERSEDED')),
 confirmed_at timestamptz, created_at timestamptz NOT NULL, responded_at timestamptz, reschedule_until timestamptz,
 PRIMARY KEY(business_id,appointment_id,schedule_revision),
 FOREIGN KEY(business_id,appointment_id) REFERENCES core.appointment(business_id,id),
 FOREIGN KEY(business_id,operation_id,appointment_id) REFERENCES core.operation(business_id,id,appointment_id),
 FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id));
CREATE TABLE core.rm1_job (
 business_id text NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), appointment_id uuid NOT NULL,
 schedule_revision bigint NOT NULL, kind text NOT NULL CHECK(kind IN ('seven_day','confirmation','followup','final')),
 due_at timestamptz NOT NULL, deadline_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('SCHEDULED','QUEUED','SKIPPED','SUPPRESSED')),
 reason text NOT NULL DEFAULT '', output_id uuid, confirm_action uuid NOT NULL DEFAULT gen_random_uuid(), reschedule_action uuid NOT NULL DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT core.authoritative_time(), queued_at timestamptz, after_sequence bigint,
 PRIMARY KEY(business_id,id), UNIQUE(business_id,appointment_id,schedule_revision,kind), UNIQUE(business_id,output_id),
 UNIQUE(business_id,confirm_action), UNIQUE(business_id,reschedule_action),
 FOREIGN KEY(business_id,appointment_id,schedule_revision) REFERENCES core.rm1_schedule(business_id,appointment_id,schedule_revision),
 FOREIGN KEY(business_id,output_id) REFERENCES core.output_intent(business_id,id), CHECK(due_at<deadline_at));
CREATE TABLE core.rm1_response (
 business_id text NOT NULL, input_id uuid NOT NULL, job_id uuid, action text NOT NULL,
 outcome text NOT NULL, at_time timestamptz NOT NULL,
 PRIMARY KEY(business_id,input_id), FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id),
 FOREIGN KEY(business_id,job_id) REFERENCES core.rm1_job(business_id,id));
CREATE TABLE core.rm1_receipt (
 business_id text NOT NULL, evidence_id uuid NOT NULL, job_id uuid NOT NULL,
 attempt_id uuid NOT NULL, message_id text NOT NULL, status text NOT NULL CHECK(status IN ('sent','delivered','read','failed')),
 at_time timestamptz NOT NULL, correlated boolean NOT NULL, seal_key text NOT NULL,
 PRIMARY KEY(business_id,evidence_id), FOREIGN KEY(business_id,job_id) REFERENCES core.rm1_job(business_id,id),
 FOREIGN KEY(business_id,attempt_id) REFERENCES core.attempt(business_id,id), FOREIGN KEY(business_id,seal_key) REFERENCES core.seal(business_id,stable_key));
CREATE TABLE core.rm1_event (
 business_id text NOT NULL, id bigint GENERATED ALWAYS AS IDENTITY, job_id uuid NOT NULL,
 at_time timestamptz NOT NULL, category text NOT NULL, attempt_id uuid, reason text NOT NULL DEFAULT '',
 PRIMARY KEY(business_id,id),FOREIGN KEY(business_id,job_id) REFERENCES core.rm1_job(business_id,id));
CREATE TRIGGER rm1_event_immutable BEFORE UPDATE OR DELETE ON core.rm1_event FOR EACH ROW EXECUTE FUNCTION core.catalog_immutable();
CREATE TRIGGER rm1_response_immutable BEFORE UPDATE OR DELETE ON core.rm1_response FOR EACH ROW EXECUTE FUNCTION core.catalog_immutable();
CREATE TRIGGER rm1_receipt_immutable BEFORE UPDATE OR DELETE ON core.rm1_receipt FOR EACH ROW EXECUTE FUNCTION core.catalog_immutable();

-- Global only within this disposable synthetic profile; no tenant data is read
-- from it. Operator-only, monotonic clock controls are not production time.
CREATE TABLE core.rm1_clock (singleton boolean PRIMARY KEY CHECK(singleton),at_time timestamptz NOT NULL CHECK(isfinite(at_time)));
CREATE OR REPLACE FUNCTION core.authoritative_time() RETURNS timestamptz LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,core AS $$
 SELECT coalesce((SELECT at_time FROM core.rm1_clock WHERE singleton),clock_timestamp())
$$;
CREATE FUNCTION core.rm1_advance(b text,at_value timestamptz) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF b IS NULL OR at_value IS NULL THEN RAISE EXCEPTION 'null_argument';END IF;
 PERFORM core.assert_scope(b);IF at_value IS NULL OR NOT isfinite(at_value) OR at_value<core.authoritative_time() THEN RAISE EXCEPTION 'rm1_clock_must_advance';END IF;
 INSERT INTO core.rm1_clock VALUES(true,at_value) ON CONFLICT(singleton) DO UPDATE SET at_time=excluded.at_time WHERE core.rm1_clock.at_time<=excluded.at_time;
 IF NOT FOUND THEN RAISE EXCEPTION 'rm1_clock_race';END IF;
 INSERT INTO core.audit(business_id,actor,action,evidence,detail) VALUES(b,session_user,'RM1_SYNTHETIC_CLOCK',at_value::text,'{}');RETURN at_value;
END $$;

CREATE FUNCTION core.rm1_schedule_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE ap core.appointment; i core.input; label text; hours_value integer; due_value timestamptz; now_value timestamptz=core.authoritative_time();
BEGIN
 SELECT * INTO ap FROM core.appointment WHERE business_id=NEW.business_id AND id=NEW.appointment_id;
 UPDATE core.rm1_schedule SET attendance=CASE WHEN NEW.kind='CANCEL' THEN 'CANCELLED' ELSE 'SUPERSEDED' END
 WHERE business_id=NEW.business_id AND appointment_id=ap.id AND attendance NOT IN ('CANCELLED','SUPERSEDED');
 UPDATE core.rm1_job SET state='SUPPRESSED',reason='SCHEDULE_CHANGED' WHERE business_id=NEW.business_id AND appointment_id=ap.id AND state='SCHEDULED';
 -- Never expire entered/UNKNOWN sends. Exact old output/attempt stays protected.
 UPDATE core.output_intent o SET state='EXPIRED' WHERE o.business_id=NEW.business_id AND o.id IN(SELECT output_id FROM core.rm1_job WHERE business_id=NEW.business_id AND appointment_id=ap.id)
 AND o.state IN ('PENDING','ARMED') AND NOT EXISTS(SELECT 1 FROM core.attempt a WHERE a.business_id=o.business_id AND a.output_id=o.id AND a.state NOT IN ('PREPARED','ARMED','ABANDONED'));
 UPDATE core.attempt a SET state='ABANDONED' WHERE a.business_id=NEW.business_id AND a.output_id IN(SELECT o.id FROM core.output_intent o JOIN core.rm1_job j ON j.business_id=o.business_id AND j.output_id=o.id WHERE o.business_id=NEW.business_id AND j.appointment_id=ap.id AND o.state='EXPIRED') AND a.state IN ('PREPARED','ARMED');
 IF NEW.kind='CANCEL' OR ap.state<>'ACTIVE' OR NOT EXISTS(SELECT 1 FROM core.rm1_config WHERE business_id=NEW.business_id AND enabled) THEN RETURN NEW;END IF;
 SELECT * INTO i FROM core.input WHERE business_id=NEW.business_id AND id=(SELECT input_id FROM core.operation WHERE business_id=NEW.business_id AND id=NEW.operation_id);
 SELECT p.name INTO label FROM core.local_customer p WHERE p.business_id=NEW.business_id AND p.customer_id=ap.customer_id;
 IF label IS NULL OR ap.origin<>'APP_CREATED' THEN RETURN NEW;END IF;
 INSERT INTO core.rm1_schedule(business_id,appointment_id,schedule_revision,operation_id,input_id,conversation_id,channel_id,subject,customer_name,start_at,attendance,confirmed_at,created_at) VALUES(NEW.business_id,ap.id,ap.schedule_revision,NEW.operation_id,i.id,i.conversation_id,i.channel_id,i.subject,label,ap.start_at,'PENDING',NULL,now_value);
 FOR label,hours_value IN SELECT * FROM (VALUES('seven_day',168),('confirmation',24),('followup',22),('final',2)) x(kind,hours) LOOP
  due_value=ap.start_at-hours_value*interval '1 hour';
  INSERT INTO core.rm1_job(business_id,appointment_id,schedule_revision,kind,due_at,deadline_at,state,reason)
  VALUES(NEW.business_id,ap.id,ap.schedule_revision,label,due_value,least(due_value+interval '15 minutes',ap.start_at),CASE WHEN due_value>now_value THEN 'SCHEDULED' ELSE 'SKIPPED' END,CASE WHEN due_value>now_value THEN '' ELSE 'THRESHOLD_NOT_FUTURE' END);
 END LOOP;RETURN NEW;
END $$;
CREATE TRIGGER rm1_schedule_changed AFTER INSERT ON core.rc1_history FOR EACH ROW EXECUTE FUNCTION core.rm1_schedule_changed();

-- A single guard is used before enqueue AND at the canonical entry CAS. Caller
-- observations cannot override SQL permission, schedule, template or custody.
CREATE FUNCTION core.rm1_eligibility(b text,jid uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE j core.rm1_job; s core.rm1_schedule; ap core.appointment; ch core.channel; ph core.permission_head; t core.rm1_template; now_value timestamptz=core.authoritative_time();
BEGIN
 IF b IS NULL OR jid IS NULL THEN RAISE EXCEPTION 'null_argument';END IF;
 PERFORM core.assert_scope(b);SELECT * INTO j FROM core.rm1_job WHERE business_id=b AND id=jid;IF j.id IS NULL THEN RETURN 'JOB_MISSING';END IF;
 SELECT * INTO s FROM core.rm1_schedule WHERE business_id=b AND appointment_id=j.appointment_id AND schedule_revision=j.schedule_revision;
 SELECT * INTO ap FROM core.appointment WHERE business_id=b AND id=j.appointment_id;
 IF ap.state<>'ACTIVE' OR ap.schedule_revision<>j.schedule_revision OR s.attendance IN ('CANCELLED','SUPERSEDED') THEN RETURN 'SCHEDULE_CHANGED';END IF;
 IF NOT EXISTS(SELECT 1 FROM core.rm1_config WHERE business_id=b AND enabled) THEN RETURN 'REMINDERS_DISABLED';END IF;
 IF EXISTS(SELECT 1 FROM core.mutation_guard WHERE business_id=b AND appointment_id=ap.id) THEN RETURN 'APPOINTMENT_PROTECTED';END IF;
 IF now_value<j.due_at THEN RETURN 'NOT_DUE';END IF;
 IF now_value>j.deadline_at OR now_value+interval '2 seconds'>=ap.start_at THEN RETURN 'REMINDER_EXPIRED';END IF;
 SELECT * INTO ph FROM core.permission_head WHERE business_id=b AND subject=s.subject AND purpose='REMINDER';
 IF ph.subject IS NULL OR ph.revision=0 OR ph.suppressed OR NOT EXISTS(SELECT 1 FROM core.permission_event WHERE business_id=b AND subject=s.subject AND revision=ph.revision AND decision='GRANT') THEN RETURN 'PERMISSION_MISSING_OR_WITHDRAWN';END IF;
 SELECT * INTO ch FROM core.channel WHERE business_id=b AND id=s.channel_id;
 SELECT * INTO t FROM core.rm1_template WHERE business_id=b AND channel_id=s.channel_id AND kind=j.kind;
 IF t.channel_id IS NULL OR t.waba IS DISTINCT FROM ch.waba OR t.number_id IS DISTINCT FROM ch.number_id OR t.template_name IS DISTINCT FROM 'nukmiris_'||j.kind||'_v1' OR t.status<>'APPROVED' THEN RETURN 'TEMPLATE_UNAVAILABLE';END IF;
 IF EXISTS(SELECT 1 FROM core.conversation_context WHERE business_id=b AND conversation_id=s.conversation_id AND mode='HUMAN') THEN RETURN 'HUMAN_MODE';END IF;
 IF EXISTS(SELECT 1 FROM core.local_message m JOIN core.input i ON i.business_id=m.business_id AND i.id=m.input_id WHERE m.business_id=b AND i.conversation_id=s.conversation_id AND m.state<>'DONE') THEN RETURN 'INBOUND_PENDING';END IF;
 IF EXISTS(SELECT 1 FROM core.local_reply WHERE business_id=b AND conversation_id=s.conversation_id AND state NOT IN ('DELIVERED','EXPIRED')) OR EXISTS(SELECT 1 FROM core.output_intent WHERE business_id=b AND conversation_id=s.conversation_id AND id IS DISTINCT FROM j.output_id AND state NOT IN ('ACCEPTED','EXPIRED')) THEN RETURN 'OUTBOUND_HEAD_HELD';END IF;
 IF j.kind='followup' THEN
  IF s.attendance<>'PENDING' OR s.responded_at IS NOT NULL THEN RETURN 'ATTENDANCE_ANSWERED';END IF;
  IF NOT EXISTS(SELECT 1 FROM core.rm1_job prior JOIN core.attempt a ON a.business_id=prior.business_id AND a.output_id=prior.output_id WHERE prior.business_id=b AND prior.appointment_id=ap.id AND prior.schedule_revision=j.schedule_revision AND prior.kind='confirmation' AND a.state='VERIFIED_APPLIED' AND a.meta_status IN ('delivered','read')) THEN RETURN 'CONFIRMATION_NOT_DELIVERED';END IF;
 END IF;RETURN '';
END $$;

CREATE FUNCTION core.rm1_entry_gate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE jid uuid; reason_value text;
BEGIN
 IF NEW.state='SUBMISSION_ENTERED' AND OLD.state='ARMED' AND NEW.output_id IS NOT NULL THEN
  SELECT id INTO jid FROM core.rm1_job WHERE business_id=NEW.business_id AND output_id=NEW.output_id;
  IF jid IS NOT NULL THEN reason_value=core.rm1_eligibility(NEW.business_id,jid);IF reason_value<>'' THEN UPDATE core.rm1_job SET reason=reason_value WHERE business_id=NEW.business_id AND id=jid;RETURN NULL;END IF;END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER rm1_entry_gate BEFORE UPDATE ON core.attempt FOR EACH ROW EXECUTE FUNCTION core.rm1_entry_gate();

CREATE FUNCTION core.rm1_permission_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF NEW.purpose<>'REMINDER' THEN RETURN NEW;END IF;
 IF NEW.suppressed THEN
  UPDATE core.rm1_job j SET state='SUPPRESSED',reason='PERMISSION_WITHDRAWN' FROM core.rm1_schedule s
  WHERE j.business_id=NEW.business_id AND s.business_id=j.business_id AND s.appointment_id=j.appointment_id AND s.schedule_revision=j.schedule_revision AND s.subject=NEW.subject AND j.state='SCHEDULED';
 ELSE
  UPDATE core.rm1_job j SET state='SCHEDULED',reason='' FROM core.rm1_schedule s
  WHERE j.business_id=NEW.business_id AND s.business_id=j.business_id AND s.appointment_id=j.appointment_id AND s.schedule_revision=j.schedule_revision AND s.subject=NEW.subject
  AND s.attendance NOT IN ('CANCELLED','SUPERSEDED') AND j.state='SUPPRESSED' AND j.reason='PERMISSION_WITHDRAWN' AND j.due_at>core.authoritative_time();
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER rm1_permission_changed AFTER INSERT OR UPDATE ON core.permission_head FOR EACH ROW EXECUTE FUNCTION core.rm1_permission_changed();

CREATE FUNCTION core.rm1_configure(b text,p jsonb,k text,d text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE ch core.channel; kind_value text;
BEGIN
 IF b IS NULL OR p IS NULL OR k IS NULL OR d IS NULL THEN RAISE EXCEPTION 'null_argument';END IF;
 PERFORM core.assert_scope(b);PERFORM 1 FROM core.business WHERE business_id=b FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM core.channel WHERE business_id=b AND id=(p->>'channelId')::uuid AND verified) THEN RAISE EXCEPTION 'rm1_sender_scope';END IF;
 IF NOT core.valid_tenant_bindings(p,b) OR p->>'businessId' IS DISTINCT FROM b OR NOT EXISTS(SELECT 1 FROM core.seal WHERE business_id=b AND stable_key=k AND digest=d AND kind='RM1_CONFIG' AND receipt->'body'=p) THEN RAISE EXCEPTION 'rm1_config_unsealed';END IF;
 IF p->>'action'='ENABLE' AND jsonb_typeof(p->'enabled')='boolean' THEN
  INSERT INTO core.rm1_config VALUES(b,(p->>'enabled')::boolean,core.authoritative_time()) ON CONFLICT(business_id) DO UPDATE SET enabled=excluded.enabled,activated_at=coalesce(core.rm1_config.activated_at,excluded.activated_at);
  FOR ch IN SELECT * FROM core.channel WHERE business_id=b AND id=(p->>'channelId')::uuid AND verified LOOP
   FOREACH kind_value IN ARRAY ARRAY['seven_day','confirmation','followup','final'] LOOP
    INSERT INTO core.rm1_template VALUES(b,ch.id,ch.waba,ch.number_id,kind_value,'nukmiris_'||kind_value||'_v1','es_MX','APPROVED') ON CONFLICT DO NOTHING;
   END LOOP;
  END LOOP;
 ELSIF p->>'action'='TEMPLATE' AND p->>'kind' IN ('seven_day','confirmation','followup','final') AND p->>'status' IN ('APPROVED','MISSING','REJECTED','UNAVAILABLE') THEN
  UPDATE core.rm1_template SET status=p->>'status' WHERE business_id=b AND channel_id=(p->>'channelId')::uuid AND kind=p->>'kind';IF NOT FOUND THEN RAISE EXCEPTION 'rm1_activate_fixture_first';END IF;
 ELSE RAISE EXCEPTION 'rm1_config_invalid';END IF;RETURN true;
END $$;

CREATE FUNCTION core.rm1_record_receipt(b text,p jsonb,k text,d text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE j core.rm1_job; s core.rm1_schedule; a core.attempt; old core.rm1_receipt; correlated_value boolean=false;
BEGIN
 IF b IS NULL OR p IS NULL OR k IS NULL OR d IS NULL THEN RAISE EXCEPTION 'null_argument';END IF;
 PERFORM core.assert_scope(b);IF NOT core.valid_tenant_bindings(p,b) OR p->>'businessId' IS DISTINCT FROM b OR NOT EXISTS(SELECT 1 FROM core.seal WHERE business_id=b AND stable_key=k AND digest=d AND kind='RM1_RECEIPT' AND receipt->'body'=p) THEN RAISE EXCEPTION 'rm1_receipt_unsealed';END IF;
 SELECT * INTO old FROM core.rm1_receipt WHERE business_id=b AND evidence_id=(p->>'evidenceId')::uuid;
 IF old.evidence_id IS NOT NULL THEN IF old.seal_key<>k THEN RAISE EXCEPTION 'rm1_receipt_conflict';END IF;RETURN old.correlated;END IF;
 SELECT * INTO j FROM core.rm1_job WHERE business_id=b AND id=(p->>'jobId')::uuid;
 SELECT * INTO s FROM core.rm1_schedule WHERE business_id=b AND appointment_id=j.appointment_id AND schedule_revision=j.schedule_revision;
 IF j.id IS NULL THEN RAISE EXCEPTION 'rm1_receipt_job_missing';END IF;
 PERFORM core.lock_conversation(b,s.conversation_id);
 SELECT * INTO a FROM core.attempt WHERE business_id=b AND id=(p->>'attemptId')::uuid FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'rm1_receipt_attempt_missing';END IF;
 IF (p->>'atTime')::timestamptz<j.queued_at OR NOT isfinite((p->>'atTime')::timestamptz) OR (p->>'atTime')::timestamptz>core.authoritative_time() OR p->>'status' NOT IN ('sent','delivered','read','failed') THEN RAISE EXCEPTION 'rm1_receipt_invalid';END IF;
 correlated_value=a.output_id=j.output_id AND a.state IN ('SUBMISSION_ENTERED','UNKNOWN','VERIFIED_APPLIED') AND a.envelope->>'remoteId'=p->>'messageId'
 AND a.envelope->>'recipient'=p->>'recipient' AND a.envelope->>'channelId'=p->>'channelId' AND a.envelope->>'waba'=p->>'waba' AND a.envelope->>'numberId'=p->>'numberId'
 AND EXISTS(SELECT 1 FROM core.local_ledger l WHERE l.business_id=b AND l.id=a.id AND l.kind='CORE' AND l.payload_digest=a.payload_digest AND l.proof->>'remoteId'=p->>'messageId');
 INSERT INTO core.rm1_receipt VALUES(b,(p->>'evidenceId')::uuid,j.id,a.id,p->>'messageId',p->>'status',(p->>'atTime')::timestamptz,coalesce(correlated_value,false),k);
 IF correlated_value THEN
  UPDATE core.attempt SET meta_status=CASE WHEN array_position(ARRAY['sent','failed','delivered','read'],coalesce(meta_status,'sent'))>array_position(ARRAY['sent','failed','delivered','read'],p->>'status') THEN meta_status ELSE p->>'status' END WHERE business_id=b AND id=a.id;
 END IF;RETURN coalesce(correlated_value,false);
END $$;

CREATE FUNCTION core.rm1_respond(b text,p jsonb,k text,d text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; m core.local_message; j core.rm1_job; s core.rm1_schedule; ap core.appointment; prior core.rm1_response; outcome_value text; action_value text=p->>'action';
BEGIN
 IF b IS NULL OR p IS NULL OR k IS NULL OR d IS NULL THEN RAISE EXCEPTION 'null_argument';END IF;
 PERFORM core.assert_scope(b);IF NOT core.valid_tenant_bindings(p,b) OR p->>'businessId' IS DISTINCT FROM b OR action_value IS NULL OR action_value NOT IN ('confirm','reschedule') OR NOT EXISTS(SELECT 1 FROM core.seal WHERE business_id=b AND stable_key=k AND digest=d AND kind='RM1_RESPONSE' AND receipt->'body'=p) THEN RAISE EXCEPTION 'rm1_response_unsealed';END IF;
 SELECT * INTO i FROM core.input WHERE business_id=b AND id=(p->>'inputId')::uuid;
 PERFORM core.lock_conversation(b,i.conversation_id);
 SELECT * INTO prior FROM core.rm1_response WHERE business_id=b AND input_id=i.id;
 IF prior.input_id IS NOT NULL THEN RETURN jsonb_build_object('outcome',prior.outcome,'jobId',prior.job_id);END IF;
 SELECT * INTO m FROM core.local_message WHERE business_id=b AND input_id=i.id;
 IF m.state IS DISTINCT FROM 'CLAIMED' OR EXISTS(SELECT 1 FROM core.conversation_context WHERE business_id=b AND conversation_id=i.conversation_id AND mode='HUMAN') THEN RAISE EXCEPTION 'rm1_response_context';END IF;
 SELECT * INTO j FROM core.rm1_job WHERE business_id=b AND id=(p->>'jobId')::uuid;
 SELECT * INTO s FROM core.rm1_schedule WHERE business_id=b AND appointment_id=j.appointment_id AND schedule_revision=j.schedule_revision;
 SELECT * INTO ap FROM core.appointment WHERE business_id=b AND id=j.appointment_id FOR UPDATE;
 IF j.id IS NULL OR j.kind NOT IN ('confirmation','followup') OR s.subject IS DISTINCT FROM i.subject OR s.channel_id IS DISTINCT FROM i.channel_id OR s.conversation_id IS DISTINCT FROM i.conversation_id THEN RAISE EXCEPTION 'rm1_response_scope';END IF;
 SELECT * INTO s FROM core.rm1_schedule WHERE business_id=b AND appointment_id=j.appointment_id AND schedule_revision=j.schedule_revision FOR UPDATE;
 IF m.payload->>'kind'='ACTION' THEN
  IF m.payload->>'value' IS DISTINCT FROM (CASE WHEN action_value='confirm' THEN j.confirm_action ELSE j.reschedule_action END)::text THEN RAISE EXCEPTION 'rm1_response_action';END IF;
 ELSE
  -- Application supplies the sealed semantic decision. SQL binds the exact text,
  -- input, protected phase and optional quote; it does not normalize Unicode again.
  IF m.payload->>'value' IS DISTINCT FROM p->>'text' OR m.claim->'basis'->>'outcome' IN ('NAME_REQUIRED','OFFER','DATES','SERVICES','HUMAN_HANDOFF') THEN RAISE EXCEPTION 'rm1_response_context';END IF;
  IF p->>'replyTo' IS NOT NULL THEN
   IF m.payload->>'replyTo' IS DISTINCT FROM p->>'replyTo' OR NOT EXISTS(SELECT 1 FROM core.attempt WHERE business_id=b AND output_id=j.output_id AND meta_message_id=p->>'replyTo') THEN RAISE EXCEPTION 'rm1_response_quote';END IF;
  ELSE
   IF (SELECT count(DISTINCT r.appointment_id::text||'/'||r.schedule_revision::text) FROM core.rm1_job r JOIN core.rm1_schedule rs ON rs.business_id=r.business_id AND rs.appointment_id=r.appointment_id AND rs.schedule_revision=r.schedule_revision JOIN core.attempt a ON a.business_id=r.business_id AND a.output_id=r.output_id WHERE r.business_id=b AND rs.subject=i.subject AND r.kind IN ('confirmation','followup') AND a.state IN ('SUBMISSION_ENTERED','UNKNOWN','VERIFIED_APPLIED'))<>1 THEN RAISE EXCEPTION 'rm1_response_ambiguous';END IF;
  END IF;
 END IF;
 IF ap.state<>'ACTIVE' OR ap.schedule_revision<>j.schedule_revision OR ap.start_at<=core.authoritative_time() OR s.attendance IN ('SUPERSEDED','CANCELLED') OR NOT EXISTS(SELECT 1 FROM core.attempt a WHERE a.business_id=b AND a.output_id=j.output_id AND a.state='VERIFIED_APPLIED') THEN outcome_value='EXPIRED';
 ELSIF EXISTS(SELECT 1 FROM core.mutation_guard WHERE business_id=b AND appointment_id=ap.id) THEN outcome_value='HELD';
 ELSIF s.attendance='CONFIRMED' AND action_value='confirm' THEN outcome_value='CONFIRMED';
 ELSIF action_value='confirm' THEN UPDATE core.rm1_schedule SET attendance='CONFIRMED',confirmed_at=coalesce(confirmed_at,core.authoritative_time()),responded_at=core.authoritative_time(),reschedule_until=NULL WHERE business_id=b AND appointment_id=ap.id AND schedule_revision=j.schedule_revision;outcome_value='CONFIRMED';
 ELSE UPDATE core.rm1_schedule SET attendance='RESCHEDULE_REQUESTED',responded_at=core.authoritative_time(),reschedule_until=core.authoritative_time()+interval '15 minutes' WHERE business_id=b AND appointment_id=ap.id AND schedule_revision=j.schedule_revision;outcome_value='RESCHEDULE';END IF;
 IF outcome_value IN ('CONFIRMED','RESCHEDULE') THEN UPDATE core.rm1_job SET state='SKIPPED',reason='ATTENDANCE_ANSWERED' WHERE business_id=b AND appointment_id=j.appointment_id AND schedule_revision=j.schedule_revision AND kind='followup' AND state='SCHEDULED';END IF;
 INSERT INTO core.rm1_response VALUES(b,i.id,j.id,action_value,outcome_value,core.authoritative_time());
 RETURN jsonb_build_object('outcome',outcome_value,'jobId',j.id);
END $$;

CREATE FUNCTION core.rm1_enqueue(b text,p jsonb,k text,d text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE j core.rm1_job; s core.rm1_schedule; i core.input; reason_value text;
BEGIN
 IF b IS NULL OR p IS NULL OR k IS NULL OR d IS NULL THEN RAISE EXCEPTION 'null_argument';END IF;
 PERFORM core.assert_scope(b);IF NOT core.valid_tenant_bindings(p,b) OR p->>'businessId' IS DISTINCT FROM b OR NOT EXISTS(SELECT 1 FROM core.seal WHERE business_id=b AND stable_key=k AND digest=d AND kind='RM1_OUTPUT' AND receipt->'body'=p) THEN RAISE EXCEPTION 'rm1_output_unsealed';END IF;
 SELECT * INTO j FROM core.rm1_job WHERE business_id=b AND id=(p->>'jobId')::uuid;
 SELECT * INTO s FROM core.rm1_schedule WHERE business_id=b AND appointment_id=j.appointment_id AND schedule_revision=j.schedule_revision;
 PERFORM core.lock_conversation(b,s.conversation_id);
 PERFORM 1 FROM core.appointment WHERE business_id=b AND id=j.appointment_id FOR UPDATE;
 SELECT * INTO j FROM core.rm1_job WHERE business_id=b AND id=j.id FOR UPDATE;
 IF j.output_id IS NOT NULL THEN IF j.output_id::text IS DISTINCT FROM p->>'outputId' THEN RAISE EXCEPTION 'rm1_output_conflict';END IF;RETURN true;END IF;
 IF j.state<>'SCHEDULED' THEN RETURN false;END IF;
 reason_value=core.rm1_eligibility(b,j.id);IF reason_value<>'' THEN UPDATE core.rm1_job SET reason=reason_value,state=CASE WHEN reason_value='REMINDER_EXPIRED' THEN 'SKIPPED' ELSE state END WHERE business_id=b AND id=j.id;RETURN false;END IF;
 IF p->>'appointmentId' IS DISTINCT FROM j.appointment_id::text OR p->>'scheduleRevision' IS DISTINCT FROM j.schedule_revision::text OR p->>'kind' IS DISTINCT FROM j.kind OR p->>'recipient' IS DISTINCT FROM s.subject
 OR p->'payload'->>'text' IS NULL OR p->'payload'->>'outcome' IS DISTINCT FROM 'REMINDER' OR p->'payload'->>'jobId' IS DISTINCT FROM j.id::text OR core.json_digest(p->'payload') IS DISTINCT FROM p->>'payloadDigest'
 OR (j.kind IN ('confirmation','followup') AND p->'payload'->'choices' IS DISTINCT FROM jsonb_build_array(jsonb_build_object('id',j.confirm_action,'title','Sí, confirmo'),jsonb_build_object('id',j.reschedule_action,'title','Necesito reagendar')))
 OR (j.kind IN ('seven_day','final') AND p->'payload'->'choices' IS DISTINCT FROM '[]'::jsonb) THEN RAISE EXCEPTION 'rm1_output_binding';END IF;
 SELECT * INTO i FROM core.input WHERE business_id=b AND id=s.input_id;
 INSERT INTO core.output_intent VALUES(b,(p->>'outputId')::uuid,s.operation_id,i.id,j.appointment_id,s.conversation_id,i.sequence,CASE j.kind WHEN 'seven_day' THEN 1 WHEN 'confirmation' THEN 2 WHEN 'followup' THEN 3 ELSE 4 END,s.subject,p->'payload',p->>'payloadDigest',j.schedule_revision,'REMINDER',j.due_at,j.deadline_at,'PENDING');
 UPDATE core.rm1_job SET output_id=(p->>'outputId')::uuid,state='QUEUED',reason='',queued_at=core.authoritative_time(),after_sequence=(SELECT next_sequence-1 FROM core.conversation WHERE business_id=b AND id=s.conversation_id) WHERE business_id=b AND id=j.id;RETURN true;
END $$;

CREATE FUNCTION core.rm1_due_jobs(b text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE j core.rm1_job; reason_value text; result jsonb='[]';
BEGIN
 IF b IS NULL THEN RAISE EXCEPTION 'null_argument';END IF;
 PERFORM core.assert_scope(b);IF NOT EXISTS(SELECT 1 FROM core.rm1_config WHERE business_id=b AND enabled) THEN RETURN result;END IF;
 UPDATE core.rm1_schedule s SET attendance=CASE WHEN confirmed_at IS NULL THEN 'PENDING' ELSE 'CONFIRMED' END,reschedule_until=NULL WHERE business_id=b AND attendance='RESCHEDULE_REQUESTED' AND reschedule_until<=core.authoritative_time() AND NOT EXISTS(SELECT 1 FROM core.mutation_guard g WHERE g.business_id=b AND g.appointment_id=s.appointment_id);
 FOR j IN SELECT * FROM core.rm1_job WHERE business_id=b AND state='SCHEDULED' AND due_at<=core.authoritative_time() ORDER BY due_at,id LIMIT 100 LOOP
  reason_value=core.rm1_eligibility(b,j.id);
  UPDATE core.rm1_job SET reason=reason_value,state=CASE WHEN reason_value IN ('REMINDER_EXPIRED','ATTENDANCE_ANSWERED','CONFIRMATION_NOT_DELIVERED') THEN 'SKIPPED' WHEN reason_value='PERMISSION_MISSING_OR_WITHDRAWN' THEN 'SUPPRESSED' ELSE state END WHERE business_id=b AND id=j.id AND state='SCHEDULED';
  IF reason_value='' THEN result=result||jsonb_build_array(j.id);END IF;
 END LOOP;RETURN result;
END $$;

CREATE FUNCTION core.rm1_job_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.state IS DISTINCT FROM OLD.state OR NEW.reason IS DISTINCT FROM OLD.reason THEN
  INSERT INTO core.rm1_event(business_id,job_id,at_time,category,reason) VALUES(NEW.business_id,NEW.id,core.authoritative_time(),NEW.state,NEW.reason);
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER rm1_job_event AFTER INSERT OR UPDATE ON core.rm1_job FOR EACH ROW EXECUTE FUNCTION core.rm1_job_event();
CREATE FUNCTION core.rm1_attempt_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE jid uuid;
BEGIN
 IF NEW.output_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.state IS DISTINCT FROM OLD.state OR NEW.meta_status IS DISTINCT FROM OLD.meta_status) THEN
  SELECT id INTO jid FROM core.rm1_job WHERE business_id=NEW.business_id AND output_id=NEW.output_id;
  IF jid IS NOT NULL THEN INSERT INTO core.rm1_event(business_id,job_id,at_time,category,attempt_id) VALUES(NEW.business_id,jid,core.authoritative_time(),coalesce(NEW.meta_status,NEW.state),NEW.id);END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER rm1_attempt_event AFTER INSERT OR UPDATE ON core.attempt FOR EACH ROW EXECUTE FUNCTION core.rm1_attempt_event();

DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['rm1_config','rm1_template','rm1_schedule','rm1_job','rm1_response','rm1_receipt','rm1_event'] LOOP
  EXECUTE format('ALTER TABLE core.%I OWNER TO wp1_owner',t);EXECUTE format('GRANT ALL ON core.%I TO wp1_definer',t);
  EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE core.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY scoped ON core.%I USING(core.scope_allowed(business_id)) WITH CHECK(core.scope_allowed(business_id))',t);
  EXECUTE format('GRANT SELECT ON core.%I TO wp1_reducer,wp1_dispatch,wp1_result,wp1_operator,wp1_tenant_a,wp1_tenant_b',t);
 END LOOP;
 ALTER TABLE core.rm1_clock OWNER TO wp1_owner;GRANT ALL ON core.rm1_clock TO wp1_definer;
 GRANT USAGE,SELECT ON SEQUENCE core.rm1_event_id_seq TO wp1_definer;
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='core'::regnamespace AND (proname LIKE 'rm1_%' OR proname='authoritative_time') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO wp1_definer',f.signature);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION core.rm1_enqueue(text,jsonb,text,text),core.rm1_eligibility(text,uuid),core.rm1_due_jobs(text) TO wp1_reducer;
GRANT EXECUTE ON FUNCTION core.rm1_advance(text,timestamptz) TO wp1_operator;
GRANT EXECUTE ON FUNCTION core.rm1_configure(text,jsonb,text,text),core.rm1_record_receipt(text,jsonb,text,text) TO wp1_operator;
GRANT EXECUTE ON FUNCTION core.rm1_respond(text,jsonb,text,text) TO wp1_reducer;
