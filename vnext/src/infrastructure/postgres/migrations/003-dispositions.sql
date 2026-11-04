-- Strict conversation head: an earlier authenticated command remains a barrier
-- until its operation AND all resulting outputs are terminal. No polling/retry is
-- performed here. UNKNOWN retains its protections and requires read-only proof.
CREATE FUNCTION core.conversation_ready(b text,c uuid,n bigint) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
 SELECT NOT EXISTS(SELECT 1 FROM core.input i WHERE i.business_id=b AND i.conversation_id=c AND i.sequence<n AND i.state<>'HELD' AND
 (i.state<>'ELIGIBLE' OR (
 i.event->>'type'='text' AND lower(trim(i.event->'text'->>'body')) NOT IN
 ('stop','baja recordatorios','no quiero recordatorios','no me envies recordatorios','dejar de recibir recordatorios')
 AND NOT EXISTS(SELECT 1 FROM core.operation op JOIN core.attempt a ON a.business_id=b AND a.operation_id=op.id
 WHERE op.business_id=b AND op.input_id=i.id AND (a.state='ABANDONED' OR (a.state='VERIFIED_APPLIED'
 AND EXISTS(SELECT 1 FROM core.output_intent o WHERE o.business_id=b AND o.parent_operation_id=op.id)
 AND NOT EXISTS(SELECT 1 FROM core.output_intent o WHERE o.business_id=b AND o.parent_operation_id=op.id AND o.state NOT IN ('ACCEPTED','EXPIRED'))))))))
$$;

-- A sealed operator decision may abandon ONLY work that has never obtained the
-- known-commit continuation. State is checked under the same row locks/CAS as the
-- gate. A dead-owner assertion is not evidence of non-submission.
CREATE FUNCTION core.abandon_unsent(b text,a_id uuid,seal_key text,seal_digest text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE a core.attempt; op core.operation; ap core.appointment; i core.input; o core.output_intent; prior_op uuid; body jsonb; r uuid;
BEGIN
 IF b IS NULL OR a_id IS NULL OR seal_key IS NULL OR seal_digest IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 PERFORM 1 FROM core.business WHERE business_id=b FOR SHARE;
 SELECT * INTO a FROM core.attempt WHERE business_id=b AND id=a_id;
 IF a.id IS NULL THEN RAISE EXCEPTION 'attempt_missing'; END IF;
 SELECT receipt->'body' INTO body FROM core.seal WHERE business_id=b AND stable_key=seal_key AND kind='ABANDON' AND digest=seal_digest;
 IF body->>'businessId' IS DISTINCT FROM b OR body->>'attemptId' IS DISTINCT FROM a_id::text
 OR body->>'payloadDigest' IS DISTINCT FROM a.payload_digest OR coalesce(length(body->>'reason'),0)=0 THEN RAISE EXCEPTION 'unsealed_abandon'; END IF;
 IF a.operation_id IS NOT NULL THEN
  SELECT * INTO op FROM core.operation WHERE business_id=b AND id=a.operation_id;
  SELECT * INTO i FROM core.input WHERE business_id=b AND id=op.input_id;
 ELSE
  SELECT * INTO o FROM core.output_intent WHERE business_id=b AND id=a.output_id;
  SELECT * INTO i FROM core.input WHERE business_id=b AND id=o.input_id;
 END IF;
 PERFORM 1 FROM core.conversation WHERE business_id=b AND id=i.conversation_id FOR UPDATE;
 SELECT * INTO ap FROM core.appointment WHERE business_id=b AND id=coalesce(op.appointment_id,o.appointment_id) FOR UPDATE;
 SELECT * INTO a FROM core.attempt WHERE business_id=b AND id=a_id FOR UPDATE;
 IF a.state='ABANDONED' THEN RETURN false; END IF;
 IF a.state NOT IN ('PREPARED','ARMED') THEN RAISE EXCEPTION 'possibly_submitted_abandon_denied'; END IF;
 IF op.id IS NOT NULL THEN
  IF ap.revision IS DISTINCT FROM op.expected_revision OR NOT EXISTS(SELECT 1 FROM core.mutation_guard WHERE business_id=b AND appointment_id=ap.id AND operation_id=op.id) THEN RAISE EXCEPTION 'stale_abandon'; END IF;
  FOR r IN SELECT id FROM core.resource WHERE business_id=b AND id IN (ap.resource_id,(op.plan->>'resourceId')::uuid) ORDER BY id LOOP
   PERFORM 1 FROM core.resource WHERE business_id=b AND id=r FOR UPDATE;
  END LOOP;
  DELETE FROM core.protection WHERE business_id=b AND appointment_id=ap.id;
  IF op.kind='CREATE' THEN
   UPDATE core.appointment SET state='CANCELLED',revision=revision+1 WHERE business_id=b AND id=ap.id;
  ELSE
   SELECT prev.id INTO prior_op FROM core.operation prev JOIN core.attempt pa ON pa.business_id=b AND pa.operation_id=prev.id AND pa.state='VERIFIED_APPLIED'
   WHERE prev.business_id=b AND prev.appointment_id=ap.id AND prev.id<>op.id ORDER BY prev.expected_revision DESC LIMIT 1;
   IF prior_op IS NULL THEN RAISE EXCEPTION 'source_protection_unknown'; END IF;
   INSERT INTO core.protection VALUES(b,ap.id,prior_op,ap.resource_id,tstzrange(ap.start_at,ap.end_at+ap.buffer_minutes*interval '1 minute','[)'));
  END IF;
  DELETE FROM core.mutation_guard WHERE business_id=b AND appointment_id=ap.id AND operation_id=op.id;
 ELSE
  IF o.state NOT IN ('PENDING','ARMED') THEN RAISE EXCEPTION 'possibly_submitted_abandon_denied'; END IF;
  UPDATE core.output_intent SET state='EXPIRED' WHERE business_id=b AND id=o.id;
 END IF;
 UPDATE core.attempt SET state='ABANDONED' WHERE business_id=b AND id=a_id AND state IN ('PREPARED','ARMED');
 INSERT INTO core.audit(business_id,actor,action,evidence,detail) VALUES(b,session_user,'ABANDON_UNSENT',seal_key,body);
 RETURN true;
END $$;

-- Payload DML is denied while these triggers are enabled. A table owner can
-- change permitted state fields or disable triggers/alter DDL without superuser.
-- NOLOGIN ownership is migration-only; it is not a runtime security boundary.
CREATE FUNCTION core.append_only_fields() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,core AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'append_only_record'; END IF;
 IF (TG_TABLE_NAME='input' AND (to_jsonb(NEW)-'state') IS NOT DISTINCT FROM (to_jsonb(OLD)-'state'))
 OR (TG_TABLE_NAME='output_intent' AND (to_jsonb(NEW)-'state') IS NOT DISTINCT FROM (to_jsonb(OLD)-'state')) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'append_only_record';
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['input','output_intent','permission_event','status_event','receipt','audit','operation','seal','recovery_case'] LOOP
  EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON core.%I FOR EACH ROW EXECUTE FUNCTION core.append_only_fields()',t);
 END LOOP;
END $$;
CREATE FUNCTION core.frozen_membership() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,core AS $$
DECLARE b text; batch_key text;
BEGIN
 IF TG_OP='INSERT' AND session_user='wp1_recovery' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'immutable_membership'; END IF;
 IF TG_OP='DELETE' THEN b=OLD.business_id; batch_key=OLD.batch_id; ELSE b=NEW.business_id; batch_key=NEW.batch_id; END IF;
 -- The batch row lock serializes staging, activation and link changes.
 PERFORM 1 FROM core.batch WHERE business_id=b AND id=batch_key AND state='STAGED' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'sealed_membership'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER frozen_membership BEFORE INSERT OR UPDATE OR DELETE ON core.batch_input FOR EACH ROW EXECUTE FUNCTION core.frozen_membership();

CREATE FUNCTION core.hold_input(b text,input_key uuid,seal_key text,seal_digest text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; body jsonb;
BEGIN
 IF b IS NULL OR input_key IS NULL OR seal_key IS NULL OR seal_digest IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 SELECT * INTO i FROM core.input WHERE business_id=b AND id=input_key;
 IF i.id IS NULL THEN RAISE EXCEPTION 'input_missing'; END IF;
 PERFORM 1 FROM core.conversation WHERE business_id=b AND id=i.conversation_id FOR UPDATE;
 SELECT receipt->'body' INTO body FROM core.seal WHERE business_id=b AND stable_key=seal_key AND kind='HOLD_INPUT' AND digest=seal_digest;
 IF body->>'businessId' IS DISTINCT FROM b OR body->>'inputId' IS DISTINCT FROM input_key::text
 OR body->>'digest' IS DISTINCT FROM i.digest OR coalesce(length(body->>'reason'),0)=0
 OR EXISTS(SELECT 1 FROM core.operation WHERE business_id=b AND input_id=input_key) THEN RAISE EXCEPTION 'unsafe_input_hold'; END IF;
 UPDATE core.input SET state='HELD' WHERE business_id=b AND id=input_key AND state<>'HELD';
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO core.audit(business_id,actor,action,evidence,detail) VALUES(b,session_user,'INPUT_HELD',seal_key,body);
 RETURN true;
END $$;
