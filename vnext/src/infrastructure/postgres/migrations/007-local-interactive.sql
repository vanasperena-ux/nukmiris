-- Fresh local synthetic schema only. Never migrate an existing populated archive/profile.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM core.input) OR EXISTS(SELECT 1 FROM core.attempt) THEN RAISE EXCEPTION 'local_migration_requires_empty_fixture'; END IF; END $$;
CREATE TABLE core.local_session (
 business_id text NOT NULL, conversation_id uuid NOT NULL, revision bigint NOT NULL DEFAULT 0,
 state jsonb NOT NULL DEFAULT '{}'::jsonb, expires_at timestamptz NOT NULL DEFAULT '-infinity',
 PRIMARY KEY(business_id,conversation_id), FOREIGN KEY(business_id,conversation_id) REFERENCES core.conversation(business_id,id)
);
CREATE TABLE core.local_message (
 business_id text NOT NULL, input_id uuid NOT NULL, request_id uuid NOT NULL, payload jsonb NOT NULL,
 state text NOT NULL CHECK(state IN ('QUEUED','CLAIMED','DONE')), claim jsonb, result jsonb,
 PRIMARY KEY(business_id,input_id), UNIQUE(business_id,request_id), FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id)
);
CREATE TABLE core.local_reply (
 business_id text NOT NULL, id uuid NOT NULL, conversation_id uuid NOT NULL, input_id uuid NOT NULL,
 revision bigint NOT NULL, payload jsonb NOT NULL, digest text NOT NULL, deadline_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('PENDING','ENTERED','UNKNOWN','DELIVERED','EXPIRED')),
 PRIMARY KEY(business_id,id), UNIQUE(business_id,input_id), FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id),
 FOREIGN KEY(business_id,conversation_id) REFERENCES core.conversation(business_id,id)
);
CREATE TABLE core.local_action (
 business_id text NOT NULL, id uuid NOT NULL, conversation_id uuid NOT NULL, reply_id uuid NOT NULL,
 revision bigint NOT NULL, expires_at timestamptz NOT NULL, value text NOT NULL, consumed_by uuid,
 PRIMARY KEY(business_id,id), FOREIGN KEY(business_id,reply_id) REFERENCES core.local_reply(business_id,id),
 FOREIGN KEY(business_id,consumed_by) REFERENCES core.input(business_id,id)
);
CREATE TABLE core.local_customer (
 business_id text NOT NULL, customer_id uuid NOT NULL, name text NOT NULL,
 PRIMARY KEY(business_id,customer_id), FOREIGN KEY(business_id,customer_id) REFERENCES core.customer(business_id,id)
);
CREATE TABLE core.local_booking_intent (
 business_id text NOT NULL, input_id uuid NOT NULL, customer_id uuid NOT NULL, slot jsonb NOT NULL,
 calendar_id uuid NOT NULL, resource_id uuid NOT NULL, seal_key text NOT NULL,
 PRIMARY KEY(business_id,input_id), FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id),
 FOREIGN KEY(business_id,customer_id) REFERENCES core.customer(business_id,id), FOREIGN KEY(business_id,seal_key) REFERENCES core.seal(business_id,stable_key)
);
CREATE TABLE core.local_ledger (
 business_id text NOT NULL, id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('CORE','REPLY')),
 payload_digest text NOT NULL, payload jsonb NOT NULL, proof jsonb NOT NULL,
 PRIMARY KEY(business_id,id)
);
CREATE TABLE core.local_calendar (
 business_id text NOT NULL, id text NOT NULL, calendar_id uuid NOT NULL, resource_id uuid,
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, buffer_minutes integer NOT NULL,
 PRIMARY KEY(business_id,id), FOREIGN KEY(business_id,calendar_id) REFERENCES core.calendar(business_id,id)
);
CREATE TABLE core.local_diagnostic (
 business_id text NOT NULL, id text NOT NULL, code text NOT NULL, detail jsonb NOT NULL,
 PRIMARY KEY(business_id,id)
);

-- Authenticated local ingress: a separate sealed, versioned LOCAL_CHAT class.
-- The existing Meta v1 classifier and all its admission rules remain unchanged.
CREATE FUNCTION core.local_now(b text) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN IF b IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;PERFORM core.assert_scope(b);RETURN core.authoritative_time();END $$;
CREATE FUNCTION core.local_admit(b text,p jsonb,k text,d text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE ch core.channel; cv core.conversation; old core.local_message; ev jsonb; cl jsonb; at_time timestamptz;
BEGIN
 IF b IS NULL OR p IS NULL OR k IS NULL OR d IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 IF NOT core.valid_tenant_bindings(p,b) OR p->>'businessId' IS DISTINCT FROM b OR p->>'version' IS DISTINCT FROM '1'
 OR NOT EXISTS(SELECT 1 FROM core.seal s WHERE s.business_id=b AND s.stable_key=k AND s.digest=d AND s.kind='LOCAL_INPUT' AND s.receipt->'body'=p)
 OR jsonb_typeof(p->'payload') IS DISTINCT FROM 'object' OR jsonb_typeof(p->'payload'->'value') IS DISTINCT FROM 'string' OR p->'payload'->>'kind' IS NULL OR p->'payload'->>'kind' NOT IN ('TEXT','ACTION') OR length(coalesce(p->'payload'->>'value','')) NOT BETWEEN 1 AND 1024
 OR (p->'payload'->>'kind'='ACTION' AND p->'payload'->>'value' !~ '^[a-f0-9-]{36}$')
 OR coalesce(length(p->>'subject'),0) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'local_input_denied'; END IF;
 SELECT * INTO old FROM core.local_message WHERE business_id=b AND request_id=(p->>'requestId')::uuid;
 IF old.input_id IS NOT NULL THEN IF old.payload IS DISTINCT FROM p->'payload' OR old.input_id IS DISTINCT FROM (p->>'inputId')::uuid THEN RAISE EXCEPTION 'local_request_conflict'; END IF; RETURN old.input_id; END IF;
 SELECT * INTO ch FROM core.channel WHERE business_id=b AND id=(p->>'channelId')::uuid AND verified;
 IF ch.id IS NULL OR NOT EXISTS(SELECT 1 FROM core.business WHERE business_id=b AND status='ACTIVE' AND dispatch_enabled) THEN RAISE EXCEPTION 'local_route_denied'; END IF;
 INSERT INTO core.conversation VALUES(b,(p->>'conversationId')::uuid,ch.id,p->>'subject',1) ON CONFLICT DO NOTHING;
 PERFORM core.lock_conversation(b,(p->>'conversationId')::uuid);
 SELECT * INTO old FROM core.local_message WHERE business_id=b AND request_id=(p->>'requestId')::uuid;
 IF old.input_id IS NOT NULL THEN IF old.payload IS DISTINCT FROM p->'payload' OR old.input_id IS DISTINCT FROM (p->>'inputId')::uuid THEN RAISE EXCEPTION 'local_request_conflict'; END IF; RETURN old.input_id; END IF;
 SELECT * INTO cv FROM core.conversation WHERE business_id=b AND id=(p->>'conversationId')::uuid AND channel_id=ch.id AND subject=p->>'subject' FOR UPDATE;
 IF cv.id IS NULL THEN RAISE EXCEPTION 'local_route_denied'; END IF;
 at_time=(p->>'receivedAt')::timestamptz;
 IF NOT isfinite(at_time) OR at_time>core.authoritative_time()+interval '5 seconds' THEN RAISE EXCEPTION 'local_time_denied'; END IF;
 ev=jsonb_build_object('id',p->>'requestId','from',cv.subject,'type','text','text',jsonb_build_object('body',p->'payload'->>'value'));
 cl=jsonb_build_object('version',2,'ruleVersion','L2-LOCAL-1','businessId',b,'channelId',ch.id,'subject',cv.subject,'inputId',p->>'inputId','eventDigest',core.json_digest(ev),'kind','ORDINARY','operation','LOCAL_CHAT');
 INSERT INTO core.input VALUES(b,(p->>'inputId')::uuid,ch.id,cv.id,p->>'requestId',cv.subject,core.json_digest(ev),ev,cv.next_sequence,at_time,'ELIGIBLE');
 INSERT INTO core.input_classification VALUES(b,(p->>'inputId')::uuid,cl,core.json_digest(cl),k);
 UPDATE core.conversation SET next_sequence=next_sequence+1 WHERE business_id=b AND id=cv.id;
 INSERT INTO core.local_session(business_id,conversation_id) VALUES(b,cv.id) ON CONFLICT DO NOTHING;
 INSERT INTO core.local_message VALUES(b,(p->>'inputId')::uuid,(p->>'requestId')::uuid,p->'payload','QUEUED',NULL,NULL);
 RETURN (p->>'inputId')::uuid;
END $$;

CREATE FUNCTION core.local_claim(b text,i_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; m core.local_message; s core.local_session; a core.local_action; priority boolean; claim_value jsonb; error_value text='';
BEGIN
 IF b IS NULL OR i_id IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b); SELECT * INTO i FROM core.input WHERE business_id=b AND id=i_id;
 IF i.id IS NULL THEN RAISE EXCEPTION 'local_input_missing'; END IF;
 PERFORM core.lock_conversation(b,i.conversation_id);
 SELECT * INTO m FROM core.local_message WHERE business_id=b AND input_id=i.id FOR UPDATE;
 IF m.input_id IS NULL THEN RAISE EXCEPTION 'local_input_missing'; END IF;
 IF EXISTS(SELECT 1 FROM core.input later JOIN core.input_reduction red ON red.business_id=b AND red.input_id=later.id WHERE later.business_id=b AND later.conversation_id=i.conversation_id AND later.sequence>i.sequence AND red.outcome IN ('NAVIGATION','HUMAN_HANDOFF')) THEN RETURN jsonb_build_object('status','HELD'); END IF;
 IF m.state<>'QUEUED' THEN RETURN jsonb_build_object('status',m.state,'claim',m.claim,'result',m.result); END IF;
 SELECT * INTO s FROM core.local_session WHERE business_id=b AND conversation_id=i.conversation_id FOR UPDATE;
 priority=EXISTS(SELECT 1 FROM core.input_reduction WHERE business_id=b AND input_id=i.id AND outcome IN ('NAVIGATION','HUMAN_HANDOFF'));
 IF NOT priority AND (NOT core.head_ready(b,i.conversation_id,i.sequence)
 OR EXISTS(SELECT 1 FROM core.local_message x JOIN core.input xi ON xi.business_id=b AND xi.id=x.input_id WHERE x.business_id=b AND xi.conversation_id=i.conversation_id AND xi.sequence<i.sequence AND x.state<>'DONE')
 OR EXISTS(SELECT 1 FROM core.local_reply r WHERE r.business_id=b AND r.conversation_id=i.conversation_id AND r.state NOT IN ('DELIVERED','EXPIRED'))) THEN RETURN jsonb_build_object('status','HELD'); END IF;
 IF priority THEN
  UPDATE core.local_message x SET state='DONE',result='{"superseded":true}' WHERE x.business_id=b AND x.input_id<>i.id AND x.state<>'DONE' AND x.input_id IN (SELECT id FROM core.input WHERE business_id=b AND conversation_id=i.conversation_id AND sequence<i.sequence);
  UPDATE core.local_reply SET state='EXPIRED' WHERE business_id=b AND conversation_id=i.conversation_id AND state='PENDING';
 END IF;
 IF m.payload->>'kind'='ACTION' THEN
  SELECT * INTO a FROM core.local_action WHERE business_id=b AND id=(m.payload->>'value')::uuid AND conversation_id=i.conversation_id FOR UPDATE;
  IF a.id IS NULL OR a.revision<>s.revision OR a.expires_at<=core.authoritative_time() OR a.consumed_by IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM core.local_reply WHERE business_id=b AND id=a.reply_id AND state='DELIVERED') THEN error_value='STALE_ACTION';
  ELSE UPDATE core.local_action SET consumed_by=i.id WHERE business_id=b AND id=a.id; END IF;
 ELSIF s.state->>'outcome'='NAME_REQUIRED' AND s.expires_at<=core.authoritative_time() THEN error_value='STALE_ACTION'; END IF;
 claim_value=jsonb_build_object('inputId',i.id,'conversationId',i.conversation_id,'subject',i.subject,'sequence',i.sequence,'basis',s.state,'expiresAt',s.expires_at,'revision',s.revision,'payload',m.payload,'action',coalesce(a.value,''),'error',error_value,'now',core.authoritative_time());
 UPDATE core.local_message SET state='CLAIMED',claim=claim_value WHERE business_id=b AND input_id=i.id;
 RETURN jsonb_build_object('status','CLAIMED','claim',claim_value);
END $$;

CREATE FUNCTION core.local_finish(b text,p jsonb,k text,d text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; m core.local_message; s core.local_session; x jsonb; expiry timestamptz;
BEGIN
 IF b IS NULL OR p IS NULL OR k IS NULL OR d IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b); SELECT * INTO i FROM core.input WHERE business_id=b AND id=(p->>'inputId')::uuid;
 IF i.id IS NULL THEN RAISE EXCEPTION 'local_input_missing'; END IF;
 PERFORM core.lock_conversation(b,i.conversation_id);
 SELECT * INTO m FROM core.local_message WHERE business_id=b AND input_id=i.id FOR UPDATE;
 IF m.state='DONE' THEN RETURN m.result=p; END IF;
 SELECT * INTO s FROM core.local_session WHERE business_id=b AND conversation_id=i.conversation_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM core.input later JOIN core.input_reduction red ON red.business_id=b AND red.input_id=later.id WHERE later.business_id=b AND later.conversation_id=i.conversation_id AND later.sequence>i.sequence AND red.outcome IN ('NAVIGATION','HUMAN_HANDOFF')) OR m.input_id IS NULL OR s.conversation_id IS NULL OR m.state IS DISTINCT FROM 'CLAIMED' OR s.revision IS DISTINCT FROM (m.claim->>'revision')::bigint OR (p->>'revision')::bigint IS DISTINCT FROM s.revision+1 OR jsonb_typeof(p->'revision') IS DISTINCT FROM 'number' OR jsonb_typeof(p->'state') IS DISTINCT FROM 'object' OR NOT (p ?& ARRAY['businessId','inputId','revision','state','reply','replyId'])
 OR NOT core.valid_tenant_bindings(p,b) OR p->>'businessId' IS DISTINCT FROM b
 OR NOT EXISTS(SELECT 1 FROM core.seal WHERE business_id=b AND stable_key=k AND kind='LOCAL_VIEW' AND digest=d AND receipt->'body'=p) THEN RETURN false; END IF;
 expiry=core.authoritative_time()+interval '15 minutes';
 UPDATE core.local_session SET state=p->'state',revision=s.revision+1,expires_at=expiry WHERE business_id=b AND conversation_id=i.conversation_id;
 IF p->'reply'<>'null'::jsonb THEN
  IF length(coalesce(p->'reply'->>'text','')) NOT BETWEEN 1 AND 1024 OR jsonb_array_length(p->'reply'->'choices')>10 THEN RAISE EXCEPTION 'local_reply_schema'; END IF;
  INSERT INTO core.local_reply VALUES(b,(p->>'replyId')::uuid,i.conversation_id,i.id,s.revision+1,p->'reply',core.json_digest(p->'reply'),expiry,'PENDING');
  FOR x IN SELECT value FROM jsonb_array_elements(p->'reply'->'choices') LOOP
   INSERT INTO core.local_action VALUES(b,(x->>'id')::uuid,i.conversation_id,(p->>'replyId')::uuid,s.revision+1,expiry,x->>'action',NULL);
  END LOOP;
 END IF;
 UPDATE core.local_message SET state='DONE',result=p WHERE business_id=b AND input_id=i.id;
 RETURN true;
END $$;

CREATE FUNCTION core.local_intent(b text,p jsonb,k text,d text) RETURNS boolean
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
  OR (m.payload->>'kind'='TEXT' AND m.claim->'basis'->>'outcome'='NAME_REQUIRED'
  AND p->'slot'->>'startAt'=m.claim->'basis'->'oracle'->'selected'->>'startAt'
  AND p->'slot'->>'endAt'=m.claim->'basis'->'oracle'->'selected'->>'endAt')) IS NOT TRUE THEN RAISE EXCEPTION 'local_selection_binding_denied'; END IF;
 INSERT INTO core.local_booking_intent VALUES(b,i.id,(p->>'customerId')::uuid,p->'slot',(p->>'calendarId')::uuid,(p->>'resourceId')::uuid,k) ON CONFLICT DO NOTHING;
 SELECT * INTO prior FROM core.local_booking_intent WHERE business_id=b AND input_id=i.id;
 IF prior.seal_key<>k THEN RAISE EXCEPTION 'local_intent_conflict'; END IF;RETURN true;
END $$;

CREATE FUNCTION core.local_name(b text,i_id uuid,name_value text,customer_key uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE i core.input; m core.local_message; existing uuid;
BEGIN
 IF b IS NULL OR i_id IS NULL OR name_value IS NULL OR customer_key IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);SELECT * INTO i FROM core.input WHERE business_id=b AND id=i_id;IF i.id IS NULL THEN RAISE EXCEPTION 'local_input_missing'; END IF;
 PERFORM core.lock_conversation(b,i.conversation_id);SELECT * INTO m FROM core.local_message WHERE business_id=b AND input_id=i.id;
 IF m.input_id IS NULL OR m.state IS DISTINCT FROM 'CLAIMED' OR m.claim->>'error' IS DISTINCT FROM '' OR m.claim->'basis'->>'outcome' IS DISTINCT FROM 'NAME_REQUIRED'
 OR length(name_value) NOT BETWEEN 3 AND 120 OR name_value ~ '[0-9<>]' OR name_value !~ '[[:alpha:]]' THEN RAISE EXCEPTION 'local_name_denied'; END IF;
 INSERT INTO core.customer VALUES(b,customer_key,i.subject) ON CONFLICT DO NOTHING;
 SELECT id INTO existing FROM core.customer WHERE business_id=b AND subject=i.subject;
 INSERT INTO core.local_customer VALUES(b,existing,name_value) ON CONFLICT DO NOTHING;RETURN existing;
END $$;

CREATE FUNCTION core.local_reply_enter(b text,r_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE r core.local_reply;
BEGIN
 IF b IS NULL OR r_id IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);SELECT * INTO r FROM core.local_reply WHERE business_id=b AND id=r_id;
 IF r.id IS NULL THEN RETURN false; END IF;PERFORM core.lock_conversation(b,r.conversation_id);
 SELECT * INTO r FROM core.local_reply WHERE business_id=b AND id=r_id FOR UPDATE;
 IF r.state<>'PENDING' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM core.input later JOIN core.input_reduction red ON red.business_id=b AND red.input_id=later.id JOIN core.input original ON original.business_id=b AND original.id=r.input_id WHERE later.business_id=b AND later.conversation_id=r.conversation_id AND later.sequence>original.sequence AND red.outcome IN ('NAVIGATION','HUMAN_HANDOFF')) THEN UPDATE core.local_reply SET state='EXPIRED' WHERE business_id=b AND id=r_id;RETURN false;END IF;
 IF r.deadline_at<=core.authoritative_time() THEN UPDATE core.local_reply SET state='EXPIRED' WHERE business_id=b AND id=r_id;RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM core.local_reply prev JOIN core.input pi ON pi.business_id=b AND pi.id=prev.input_id JOIN core.input ci ON ci.business_id=b AND ci.id=r.input_id
 WHERE prev.business_id=b AND prev.conversation_id=r.conversation_id AND pi.sequence<ci.sequence AND prev.state NOT IN ('DELIVERED','EXPIRED')) THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM core.output_intent o JOIN core.input pi ON pi.business_id=b AND pi.id=o.input_id JOIN core.input ci ON ci.business_id=b AND ci.id=r.input_id WHERE o.business_id=b AND o.conversation_id=r.conversation_id AND pi.sequence<ci.sequence AND o.state NOT IN ('ACCEPTED','EXPIRED')) THEN RETURN false;END IF;
 UPDATE core.local_reply SET state='ENTERED' WHERE business_id=b AND id=r_id;RETURN true;
END $$;
CREATE FUNCTION core.local_reply_result(b text,r_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE r core.local_reply;
BEGIN
 IF b IS NULL OR r_id IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);SELECT * INTO r FROM core.local_reply WHERE business_id=b AND id=r_id FOR UPDATE;
 IF r.id IS NULL OR r.state NOT IN ('ENTERED','UNKNOWN','DELIVERED') THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM core.local_ledger WHERE business_id=b AND id=r_id AND kind='REPLY' AND payload_digest=r.digest) THEN UPDATE core.local_reply SET state='DELIVERED' WHERE business_id=b AND id=r_id;RETURN true;END IF;
 UPDATE core.local_reply SET state='UNKNOWN' WHERE business_id=b AND id=r_id;RETURN false;
END $$;

-- Fake effects only. SQL ledger is authoritative for read-only reconciliation.
CREATE FUNCTION core.local_provider_apply(b text,e jsonb,kind_value text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE old core.local_ledger; a core.attempt; r core.local_reply; proof_value jsonb; id_value uuid; payload_value jsonb; digest_value text;
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
  IF payload_value->>'kind'<>'CREATE' THEN RAISE EXCEPTION 'local_create_only'; END IF;
  INSERT INTO core.local_calendar VALUES(b,payload_value->>'eventId',(payload_value->>'calendarId')::uuid,(payload_value->>'resourceId')::uuid,(payload_value->>'startAt')::timestamptz,(payload_value->>'endAt')::timestamptz,(payload_value->>'bufferMinutes')::integer);
 END IF;RETURN proof_value;
END $$;
CREATE FUNCTION core.local_attention(b text,key_value text,code_value text,detail_value jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF b IS NULL OR key_value IS NULL OR code_value IS NULL OR detail_value IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);IF key_value='' OR code_value='' OR jsonb_typeof(detail_value) IS DISTINCT FROM 'object' OR NOT core.valid_tenant_bindings(detail_value,b) THEN RAISE EXCEPTION 'tenant_binding_denied'; END IF;
 INSERT INTO core.local_diagnostic VALUES(b,key_value,code_value,detail_value) ON CONFLICT DO NOTHING;
END $$;

DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['local_session','local_message','local_reply','local_action','local_customer','local_booking_intent','local_ledger','local_calendar','local_diagnostic'] LOOP
  EXECUTE format('ALTER TABLE core.%I OWNER TO wp1_owner',t);EXECUTE format('GRANT ALL ON core.%I TO wp1_definer',t);
  EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE core.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY scoped ON core.%I USING(core.scope_allowed(business_id)) WITH CHECK(core.scope_allowed(business_id))',t);
  EXECUTE format('GRANT SELECT ON core.%I TO wp1_reducer,wp1_dispatch,wp1_result,wp1_ingress,wp1_tenant_a,wp1_tenant_b',t);
 END LOOP;
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='core'::regnamespace AND proname LIKE 'local_%' LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO wp1_definer',f.signature);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION core.local_admit(text,jsonb,text,text) TO wp1_ingress;
GRANT EXECUTE ON FUNCTION core.local_claim(text,uuid),core.local_finish(text,jsonb,text,text),core.local_intent(text,jsonb,text,text),core.local_name(text,uuid,text,uuid),core.local_attention(text,text,text,jsonb) TO wp1_reducer;
GRANT EXECUTE ON FUNCTION core.local_now(text) TO wp1_reducer;
GRANT EXECUTE ON FUNCTION core.local_reply_enter(text,uuid) TO wp1_dispatch;
GRANT EXECUTE ON FUNCTION core.local_reply_result(text,uuid) TO wp1_result;
-- The local fake provider shares the result-role synthetic trust root; it has no HTTP adapter.
GRANT EXECUTE ON FUNCTION core.local_provider_apply(text,jsonb,text) TO wp1_result;

-- Accepted reservation body, with the two explicit L2 intent/class guards above.
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
 IF i.event->>'type' IS DISTINCT FROM 'text' THEN RAISE EXCEPTION 'synthetic_command_required'; END IF;
 IF i.event->'text'->>'body' IS DISTINCT FROM 'synthetic fixed command' AND NOT EXISTS(SELECT 1 FROM core.local_booking_intent li JOIN core.local_message lm ON lm.business_id=b AND lm.input_id=li.input_id JOIN core.local_session ls ON ls.business_id=b AND ls.conversation_id=i.conversation_id WHERE li.business_id=b AND li.input_id=i.id AND lm.state='CLAIMED' AND ls.revision=(lm.claim->>'revision')::bigint AND li.customer_id=(p->>'customerId')::uuid AND li.calendar_id=(p->>'calendarId')::uuid AND li.resource_id=(p->>'resourceId')::uuid AND (li.slot->>'startAt')::timestamptz=(p->>'startAt')::timestamptz AND (li.slot->>'endAt')::timestamptz=(p->>'endAt')::timestamptz AND li.slot->>'bufferMinutes'=p->>'bufferMinutes') THEN RAISE EXCEPTION 'local_intent_required'; END IF;
 IF EXISTS(SELECT 1 FROM core.local_message WHERE business_id=b AND input_id=i.id) AND EXISTS(SELECT 1 FROM core.input later JOIN core.input_reduction red ON red.business_id=b AND red.input_id=later.id WHERE later.business_id=b AND later.conversation_id=i.conversation_id AND later.sequence>i.sequence AND red.outcome IN ('NAVIGATION','HUMAN_HANDOFF')) THEN RAISE EXCEPTION 'conversation_context_changed' USING ERRCODE='P7503'; END IF;
 SELECT * INTO prior FROM core.operation WHERE business_id=b AND input_id=i.id;
 IF prior.id IS NOT NULL THEN
  IF prior.plan_digest<>p_digest OR prior.plan<>p THEN RAISE EXCEPTION 'plan_conflict'; END IF;
  RETURN prior.id;
 END IF;
 IF EXISTS(SELECT 1 FROM core.local_booking_intent li JOIN core.local_session ls ON ls.business_id=b AND ls.conversation_id=i.conversation_id WHERE li.business_id=b AND li.input_id=i.id AND ls.expires_at<=core.authoritative_time()) THEN RAISE EXCEPTION 'local_action_expired'; END IF;
 IF EXISTS(SELECT 1 FROM core.input_reduction WHERE business_id=b AND input_id=i.id)
 OR EXISTS(SELECT 1 FROM core.plan_rejection WHERE business_id=b AND input_id=i.id) THEN RAISE EXCEPTION 'input_terminal'; END IF;
 IF NOT EXISTS(SELECT 1 FROM core.input_classification clv WHERE clv.business_id=b AND clv.input_id=i.id
  AND clv.value->>'kind'='ORDINARY' AND (clv.value->>'operation'='SYNTHETIC_OPERATION' OR (clv.value->>'ruleVersion'='L2-LOCAL-1' AND clv.value->>'operation'='LOCAL_CHAT' AND EXISTS(SELECT 1 FROM core.local_booking_intent WHERE business_id=b AND input_id=i.id)))) THEN RAISE EXCEPTION 'classification_denied'; END IF;
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


CREATE FUNCTION core.local_ledger_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,core AS $$ BEGIN RAISE EXCEPTION 'append_only_local_ledger'; END $$;
ALTER FUNCTION core.local_ledger_immutable() OWNER TO wp1_definer;
REVOKE ALL ON FUNCTION core.local_ledger_immutable() FROM PUBLIC;
CREATE TRIGGER local_ledger_immutable BEFORE UPDATE OR DELETE ON core.local_ledger FOR EACH ROW EXECUTE FUNCTION core.local_ledger_immutable();
