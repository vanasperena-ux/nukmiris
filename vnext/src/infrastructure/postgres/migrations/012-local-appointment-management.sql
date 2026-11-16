-- RC-1: reuse the existing sealed operation/one-use dispatch/finalization protocol.
CREATE TABLE core.rc1_history (
 business_id text NOT NULL, operation_id uuid NOT NULL, appointment_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('CREATE','MOVE','CANCEL')),
 origin text NOT NULL CHECK(origin='CUSTOMER_WHATSAPP_SYNTHETIC'), requested_at timestamptz NOT NULL, applied_at timestamptz NOT NULL,
 before_value jsonb, after_value jsonb NOT NULL,
 PRIMARY KEY(business_id,operation_id), FOREIGN KEY(business_id,operation_id,appointment_id) REFERENCES core.operation(business_id,id,appointment_id));
ALTER TABLE core.rc1_history OWNER TO wp1_owner;
GRANT ALL ON core.rc1_history TO wp1_definer;
ALTER TABLE core.rc1_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.rc1_history FORCE ROW LEVEL SECURITY;
CREATE POLICY scoped ON core.rc1_history USING(core.scope_allowed(business_id)) WITH CHECK(core.scope_allowed(business_id));
GRANT SELECT ON core.rc1_history TO wp1_reducer,wp1_operator,wp1_tenant_a,wp1_tenant_b;
CREATE TRIGGER rc1_history_immutable BEFORE UPDATE OR DELETE ON core.rc1_history FOR EACH ROW EXECUTE FUNCTION core.catalog_immutable();

CREATE FUNCTION core.rc1_validate_operation(v core.operation) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE a core.appointment; li core.local_booking_intent; m core.local_message; target jsonb; intent jsonb; snapshot_value jsonb; catalog_value bigint; zone_value text; emp core.employee; service_value core.service; start_local timestamp; end_local timestamp;
BEGIN
 IF v IS NULL OR v.business_id IS NULL OR v.plan IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(v.business_id);
 SELECT * INTO a FROM core.appointment WHERE business_id=v.business_id AND id=v.appointment_id;
 SELECT * INTO li FROM core.local_booking_intent WHERE business_id=v.business_id AND input_id=v.input_id;
 SELECT * INTO m FROM core.local_message WHERE business_id=v.business_id AND input_id=v.input_id;
 intent=li.slot->'rc1';target=intent->'appointment';
 SELECT snapshot INTO snapshot_value FROM core.appointment_service WHERE business_id=v.business_id AND appointment_id=a.id;
 SELECT revision,time_zone INTO catalog_value,zone_value FROM core.catalog_head WHERE business_id=v.business_id;
 IF a.id IS NULL OR a.state<>'ACTIVE' OR a.start_at<=core.authoritative_time()+interval '2 seconds'
 OR intent IS NULL OR intent->>'kind' IS DISTINCT FROM v.kind OR v.plan->'management' IS DISTINCT FROM intent
 OR target->>'id' IS DISTINCT FROM a.id::text OR target->>'revision' IS DISTINCT FROM a.revision::text
 OR target->>'customerId' IS DISTINCT FROM a.customer_id::text OR target->>'calendarId' IS DISTINCT FROM a.calendar_id::text
 OR target->>'resourceId' IS DISTINCT FROM a.resource_id::text OR target->>'eventId' IS DISTINCT FROM a.event_id
 OR (target->>'startAt')::timestamptz IS DISTINCT FROM a.start_at OR (target->>'endAt')::timestamptz IS DISTINCT FROM a.end_at
 OR target->>'bufferMinutes' IS DISTINCT FROM a.buffer_minutes::text OR target->'held' IS DISTINCT FROM 'false'::jsonb
 OR snapshot_value IS NULL OR target->'service' IS DISTINCT FROM snapshot_value OR v.plan->'serviceSnapshot' IS DISTINCT FROM snapshot_value
 OR li.slot->'serviceSnapshot' IS DISTINCT FROM snapshot_value OR li.slot->>'serviceId' IS DISTINCT FROM snapshot_value->>'id'
 OR li.resource_id IS DISTINCT FROM a.resource_id OR li.customer_id IS DISTINCT FROM a.customer_id OR li.calendar_id IS DISTINCT FROM a.calendar_id
 OR v.plan->>'resourceId' IS DISTINCT FROM a.resource_id::text OR v.plan->>'catalogRevision' IS DISTINCT FROM catalog_value::text
 OR li.slot->>'catalogRevision' IS DISTINCT FROM catalog_value::text OR intent->>'expiresAt' IS DISTINCT FROM m.claim->>'expiresAt'
 OR m.state IS DISTINCT FROM 'CLAIMED' OR m.claim->>'error' IS DISTINCT FROM ''
 OR (v.plan->'envelope'->>'deadlineAt')::timestamptz>least((m.claim->>'expiresAt')::timestamptz,a.start_at-interval '2 seconds')
 OR EXISTS(SELECT 1 FROM core.mutation_guard WHERE business_id=v.business_id AND appointment_id=a.id)
 OR NOT EXISTS(SELECT 1 FROM core.customer c JOIN core.input i ON i.business_id=c.business_id AND i.subject=c.subject WHERE c.business_id=v.business_id AND c.id=a.customer_id AND i.id=v.input_id)
 THEN RAISE EXCEPTION 'rc1_stale_or_foreign_appointment' USING ERRCODE='P7503'; END IF;
 IF v.kind='CANCEL' THEN
  IF m.claim->'basis'->'management'->>'mode' IS DISTINCT FROM 'CANCEL'
   OR split_part(m.claim->>'action',':',3) IS DISTINCT FROM 'rc1cancel' OR split_part(m.claim->>'action',':',4) IS DISTINCT FROM a.id::text
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(m.claim->'basis'->'management'->'appointments','[]'::jsonb)) x WHERE x=target)
   OR (v.plan->>'startAt')::timestamptz IS DISTINCT FROM a.start_at OR (v.plan->>'endAt')::timestamptz IS DISTINCT FROM a.end_at
   OR v.plan->>'bufferMinutes' IS DISTINCT FROM a.buffer_minutes::text THEN RAISE EXCEPTION 'rc1_cancel_binding_denied' USING ERRCODE='P7503'; END IF;
  RETURN;
 END IF;
 IF v.kind<>'MOVE' OR m.claim->'basis'->'management'->>'mode' IS DISTINCT FROM 'MOVE'
 OR m.claim->'basis'->'management'->'selected' IS DISTINCT FROM target OR split_part(m.claim->>'action',':',3) IS DISTINCT FROM 'slot'
 OR (v.plan->>'startAt')::timestamptz<=core.authoritative_time()+interval '2 seconds' OR (v.plan->>'startAt')::timestamptz=a.start_at
 THEN RAISE EXCEPTION 'rc1_move_binding_denied' USING ERRCODE='P7503'; END IF;
 SELECT * INTO emp FROM core.employee WHERE business_id=v.business_id AND id=a.resource_id;
 SELECT * INTO service_value FROM core.service WHERE business_id=v.business_id AND id=snapshot_value->>'id';
 IF emp.id IS NULL OR NOT emp.active OR service_value.id IS NULL
 OR NOT EXISTS(SELECT 1 FROM core.qualification WHERE business_id=v.business_id AND employee_id=a.resource_id AND service_id=service_value.id)
 THEN RAISE EXCEPTION 'rc1_employee_ineligible' USING ERRCODE='P7503'; END IF;
 start_local=(v.plan->>'startAt')::timestamptz AT TIME ZONE zone_value;
 end_local=((v.plan->>'endAt')::timestamptz+a.buffer_minutes*interval '1 minute') AT TIME ZONE zone_value;
 IF start_local::date<>end_local::date OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(emp.hours->(extract(isodow FROM start_local)::int::text),'[]')) w WHERE to_char(start_local,'HH24:MI')>=w->>'start' AND to_char(end_local,'HH24:MI')<=w->>'end') THEN RAISE EXCEPTION 'rc1_employee_hours_changed' USING ERRCODE='P7503'; END IF;
END $$;
ALTER FUNCTION core.rc1_validate_operation(core.operation) OWNER TO wp1_definer;
REVOKE ALL ON FUNCTION core.rc1_validate_operation(core.operation) FROM PUBLIC;

CREATE OR REPLACE FUNCTION core.local_intent(b text,p jsonb,k text,d text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; m core.local_message; s core.local_session; prior core.local_booking_intent;
BEGIN
 IF b IS NULL OR p IS NULL OR k IS NULL OR d IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);SELECT * INTO i FROM core.input WHERE business_id=b AND id=(p->>'inputId')::uuid;
 IF i.id IS NULL THEN RAISE EXCEPTION 'local_input_missing'; END IF;
 PERFORM core.lock_conversation(b,i.conversation_id);
 SELECT * INTO m FROM core.local_message WHERE business_id=b AND input_id=i.id;
 SELECT * INTO s FROM core.local_session WHERE business_id=b AND conversation_id=i.conversation_id;
 IF s.expires_at<=core.authoritative_time() THEN RAISE EXCEPTION 'local_action_expired'; END IF;
 IF EXISTS(SELECT 1 FROM core.input later JOIN core.input_reduction red ON red.business_id=b AND red.input_id=later.id WHERE later.business_id=b AND later.conversation_id=i.conversation_id AND later.sequence>i.sequence AND red.outcome IN ('NAVIGATION','HUMAN_HANDOFF')) OR m.input_id IS NULL OR s.conversation_id IS NULL OR m.state IS DISTINCT FROM 'CLAIMED' OR s.revision IS DISTINCT FROM (m.claim->>'revision')::bigint OR m.claim->>'error' IS DISTINCT FROM ''
 OR NOT core.valid_tenant_bindings(p,b) OR p->>'businessId' IS DISTINCT FROM b
 OR NOT EXISTS(SELECT 1 FROM core.seal WHERE business_id=b AND stable_key=k AND kind='LOCAL_BOOKING_INTENT' AND digest=d AND receipt->'body'=p)
 OR NOT EXISTS(SELECT 1 FROM core.customer WHERE business_id=b AND id=(p->>'customerId')::uuid AND subject=i.subject) THEN RAISE EXCEPTION 'local_intent_denied'; END IF;
 IF ((m.payload->>'kind'='ACTION' AND m.claim->>'action' LIKE '%:slot:%'
  AND p->'slot'->>'startAt'=m.claim->'basis'->'oracle'->'slots'->(split_part(m.claim->>'action',':',4)::integer)->>'startAt'
  AND p->'slot'->>'endAt'=m.claim->'basis'->'oracle'->'slots'->(split_part(m.claim->>'action',':',4)::integer)->>'endAt')
  OR (m.payload->>'kind'='ACTION' AND m.claim->'basis'->'management'->>'mode'='CANCEL' AND split_part(m.claim->>'action',':',3)='rc1cancel' AND split_part(m.claim->>'action',':',4)=p->'slot'->'rc1'->'appointment'->>'id' AND p->'slot'->'rc1'->>'kind'='CANCEL' AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(m.claim->'basis'->'management'->'appointments','[]'::jsonb)) x WHERE x=p->'slot'->'rc1'->'appointment'))
  OR (m.payload->>'kind'='TEXT' AND m.claim->'basis'->>'outcome'='NAME_REQUIRED'
  AND p->'slot'->>'startAt'=m.claim->'basis'->'oracle'->'selected'->>'startAt'
  AND p->'slot'->>'endAt'=m.claim->'basis'->'oracle'->'selected'->>'endAt')) IS NOT TRUE THEN RAISE EXCEPTION 'local_selection_binding_denied'; END IF;
 INSERT INTO core.local_booking_intent VALUES(b,i.id,(p->>'customerId')::uuid,p->'slot',(p->>'calendarId')::uuid,(p->>'resourceId')::uuid,k) ON CONFLICT DO NOTHING;
 SELECT * INTO prior FROM core.local_booking_intent WHERE business_id=b AND input_id=i.id;
 IF prior.seal_key<>k THEN RAISE EXCEPTION 'local_intent_conflict'; END IF;RETURN true;
END $$;

CREATE OR REPLACE FUNCTION core.catalog_plan_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE revision_value bigint; zone_value text; start_local timestamp; end_local timestamp; day_value text; li core.local_booking_intent; s core.service; employee_value core.employee;
BEGIN
 SELECT revision,time_zone INTO revision_value,zone_value FROM core.catalog_head WHERE business_id=NEW.business_id FOR SHARE;
 IF revision_value IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO li FROM core.local_booking_intent WHERE business_id=NEW.business_id AND input_id=NEW.input_id;
 -- Retain the existing synthetic protocol test selector; real local chat always binds catalog.
 IF li.input_id IS NULL AND EXISTS(SELECT 1 FROM core.input WHERE business_id=NEW.business_id AND id=NEW.input_id AND event->'text'->>'body'='synthetic fixed command') AND NOT EXISTS(SELECT 1 FROM core.local_message WHERE business_id=NEW.business_id AND input_id=NEW.input_id) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM core.local_message WHERE business_id=NEW.business_id AND input_id=NEW.input_id) THEN
  IF NEW.kind IN ('MOVE','CANCEL') THEN PERFORM core.rc1_validate_operation(NEW);RETURN NEW;END IF;
  IF NEW.kind<>'CREATE' THEN RAISE EXCEPTION 'rc1_kind_denied' USING ERRCODE='P7504';END IF;
 END IF;
 SELECT * INTO s FROM core.service WHERE business_id=NEW.business_id AND id=li.slot->>'serviceId';
 SELECT * INTO employee_value FROM core.employee WHERE business_id=NEW.business_id AND id=li.resource_id;
 IF li.input_id IS NULL OR s.id IS NULL OR NOT s.active OR employee_value.id IS NULL OR NOT employee_value.active
  OR NOT EXISTS(SELECT 1 FROM core.qualification WHERE business_id=NEW.business_id AND employee_id=li.resource_id AND service_id=s.id)
  OR li.slot->>'serviceId' IS DISTINCT FROM (SELECT m.claim->'basis'->'oracle'->>'serviceId' FROM core.local_message m WHERE m.business_id=NEW.business_id AND m.input_id=NEW.input_id)
  OR li.slot->>'catalogRevision' IS DISTINCT FROM revision_value::text
  OR NEW.plan->>'catalogRevision' IS DISTINCT FROM revision_value::text
  OR li.slot->'serviceSnapshot' IS DISTINCT FROM core.service_snapshot(s)
  OR NEW.plan->'serviceSnapshot' IS DISTINCT FROM (li.slot->'serviceSnapshot')||jsonb_build_object('employeeName',employee_value.name)
  OR NEW.plan->>'bufferMinutes' IS DISTINCT FROM s.buffer_minutes::text
  OR (NEW.plan->>'endAt')::timestamptz-(NEW.plan->>'startAt')::timestamptz<>s.duration_minutes*interval '1 minute'
 THEN RAISE EXCEPTION 'catalog_changed_choose_again' USING ERRCODE='P7503'; END IF;
 start_local=(NEW.plan->>'startAt')::timestamptz AT TIME ZONE zone_value;
 end_local=((NEW.plan->>'endAt')::timestamptz+s.buffer_minutes*interval '1 minute') AT TIME ZONE zone_value;
 day_value=extract(isodow FROM start_local)::integer::text;
 IF start_local::date<>end_local::date OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(employee_value.hours->day_value,'[]')) w WHERE to_char(start_local,'HH24:MI')>=w->>'start' AND to_char(end_local,'HH24:MI')<=w->>'end') THEN RAISE EXCEPTION 'catalog_hours_changed' USING ERRCODE='P7503'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION core.catalog_appointment_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF NEW.kind='CREATE' AND NEW.plan ? 'serviceSnapshot' THEN
  INSERT INTO core.appointment_service VALUES(NEW.business_id,NEW.appointment_id,NEW.plan->'serviceSnapshot'->>'id',NEW.plan->'serviceSnapshot',(NEW.plan->>'catalogRevision')::bigint);
 END IF;RETURN NEW;
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
    WHEN state_value='P7503' OR (message_value='appointment_denied' AND p->>'kind' IN ('MOVE','CANCEL') AND p ? 'management') THEN 'CONTEXT_CHANGED' ELSE NULL END;
  IF reason_value IS NULL THEN RAISE; END IF;
 END;
 IF NOT core.reject_plan(b,(p->>'inputId')::uuid,d,k,reason_value) THEN RAISE EXCEPTION 'rejection_has_existing_operation'; END IF;
 RETURN jsonb_build_object('state','REJECTED','sqlState',state_value,'reason',reason_value);
END $$;

CREATE OR REPLACE FUNCTION core.local_provider_apply(b text,e jsonb,kind_value text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE old core.local_ledger; a core.attempt; r core.local_reply; proof_value jsonb; id_value uuid; payload_value jsonb; digest_value text; op core.operation; ap core.appointment; changed integer;
BEGIN
 IF b IS NULL OR e IS NULL OR kind_value IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);id_value=(e->>'attemptId')::uuid;
 IF kind_value='CORE' THEN
  SELECT * INTO a FROM core.attempt WHERE business_id=b AND id=id_value;
  IF a.id IS NULL OR a.state<>'SUBMISSION_ENTERED' OR a.envelope IS DISTINCT FROM e THEN RAISE EXCEPTION 'fake_permit_denied'; END IF;
  payload_value=e->'payload';digest_value=e->>'payloadDigest';
 ELSIF kind_value='REPLY' THEN
  SELECT * INTO r FROM core.local_reply WHERE business_id=b AND id=id_value;
  IF r.id IS NULL OR r.state<>'ENTERED' THEN RAISE EXCEPTION 'fake_permit_denied'; END IF;payload_value=r.payload;digest_value=r.digest;
 ELSE RAISE EXCEPTION 'fake_kind_denied'; END IF;
 SELECT * INTO old FROM core.local_ledger WHERE business_id=b AND id=id_value;
 IF old.id IS NOT NULL THEN RAISE EXCEPTION 'fake_duplicate_submit'; END IF;
 proof_value=jsonb_build_object('businessId',b,'attemptId',id_value,'payloadDigest',digest_value,'remoteId',coalesce(e->>'remoteId','local-reply-'||id_value::text));
 INSERT INTO core.local_ledger VALUES(b,id_value,kind_value,digest_value,payload_value,proof_value);
 IF kind_value='CORE' AND a.operation_id IS NOT NULL THEN
  IF payload_value->>'kind'='CREATE' THEN
   INSERT INTO core.local_calendar VALUES(b,payload_value->>'eventId',(payload_value->>'calendarId')::uuid,(payload_value->>'resourceId')::uuid,(payload_value->>'startAt')::timestamptz,(payload_value->>'endAt')::timestamptz,(payload_value->>'bufferMinutes')::integer);
  ELSIF payload_value->>'kind' IN ('MOVE','CANCEL') THEN
   SELECT * INTO op FROM core.operation WHERE business_id=b AND id=a.operation_id;
   SELECT * INTO ap FROM core.appointment WHERE business_id=b AND id=op.appointment_id FOR UPDATE;
   IF ap.state IS DISTINCT FROM 'ACTIVE' OR ap.revision IS DISTINCT FROM op.expected_revision OR ap.event_id IS DISTINCT FROM payload_value->>'eventId'
    OR ap.resource_id::text IS DISTINCT FROM payload_value->>'resourceId' OR NOT EXISTS(SELECT 1 FROM core.mutation_guard WHERE business_id=b AND appointment_id=ap.id AND operation_id=op.id) THEN RAISE EXCEPTION 'fake_mutation_precondition'; END IF;
   IF payload_value->>'kind'='MOVE' THEN
    UPDATE core.local_calendar SET start_at=(payload_value->>'startAt')::timestamptz,end_at=(payload_value->>'endAt')::timestamptz WHERE business_id=b AND id=ap.event_id AND calendar_id=ap.calendar_id AND resource_id=ap.resource_id AND start_at=ap.start_at AND end_at=ap.end_at AND buffer_minutes=ap.buffer_minutes;
   ELSE
    -- Event identity is exact. Absence alone is not proof of our cancellation.
    DELETE FROM core.local_calendar WHERE business_id=b AND id=ap.event_id AND calendar_id=ap.calendar_id AND resource_id=ap.resource_id AND start_at=ap.start_at AND end_at=ap.end_at AND buffer_minutes=ap.buffer_minutes;
   END IF;
   GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>1 THEN RAISE EXCEPTION 'fake_mutation_target_missing_or_changed';END IF;
  ELSE RAISE EXCEPTION 'fake_mutation_kind_denied';END IF;
 END IF;RETURN proof_value;
END $$;
CREATE FUNCTION core.rc1_record_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE op core.operation; requested timestamptz;
BEGIN
 SELECT o.* INTO op FROM core.mutation_guard g JOIN core.operation o ON o.business_id=g.business_id AND o.id=g.operation_id JOIN core.local_message m ON m.business_id=o.business_id AND m.input_id=o.input_id WHERE g.business_id=NEW.business_id AND g.appointment_id=NEW.id;
 IF op.id IS NULL OR op.kind NOT IN ('CREATE','MOVE','CANCEL') OR OLD.revision<>op.expected_revision OR NEW.revision<>OLD.revision+1 OR NOT EXISTS(SELECT 1 FROM core.attempt atp WHERE atp.business_id=NEW.business_id AND atp.operation_id=op.id AND atp.state IN ('SUBMISSION_ENTERED','UNKNOWN')) OR NEW.state IS DISTINCT FROM (CASE WHEN op.kind='CANCEL' THEN 'CANCELLED' ELSE 'ACTIVE' END) THEN RETURN NEW; END IF;
 SELECT received_at INTO requested FROM core.input WHERE business_id=NEW.business_id AND id=op.input_id;
 INSERT INTO core.rc1_history VALUES(NEW.business_id,op.id,NEW.id,op.kind,'CUSTOMER_WHATSAPP_SYNTHETIC',requested,core.authoritative_time(),CASE WHEN op.kind='CREATE' THEN NULL ELSE to_jsonb(OLD) END,to_jsonb(NEW));
 RETURN NEW;
END $$;
ALTER FUNCTION core.rc1_record_history() OWNER TO wp1_definer;
REVOKE ALL ON FUNCTION core.rc1_record_history() FROM PUBLIC;
CREATE TRIGGER rc1_record_history AFTER UPDATE ON core.appointment FOR EACH ROW EXECUTE FUNCTION core.rc1_record_history();
