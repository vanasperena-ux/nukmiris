CREATE EXTENSION btree_gist;
CREATE SCHEMA core;
REVOKE ALL ON SCHEMA core FROM PUBLIC;

CREATE TABLE core.role_scope (
  role_name name NOT NULL, business_id text NOT NULL,
  PRIMARY KEY(role_name,business_id)
);
CREATE TABLE core.business (
  business_id text PRIMARY KEY,
  status text NOT NULL CHECK(status IN ('ACTIVE','SUSPENDED')),
  revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
  recovery_epoch bigint NOT NULL DEFAULT 1 CHECK(recovery_epoch>0),
  dispatch_enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE core.channel (
  business_id text NOT NULL REFERENCES core.business, id uuid NOT NULL,
  waba text NOT NULL, number_id text NOT NULL, revision bigint NOT NULL DEFAULT 1,
  verified boolean NOT NULL DEFAULT false,
  PRIMARY KEY(business_id,id), UNIQUE(waba,number_id)
);
CREATE TABLE core.calendar (
  business_id text NOT NULL REFERENCES core.business, id uuid NOT NULL,
  external_id text NOT NULL UNIQUE CHECK(external_id<>'primary'),
  grant_id text NOT NULL, revision bigint NOT NULL DEFAULT 1,
  PRIMARY KEY(business_id,id)
);
CREATE TABLE core.resource (
  business_id text NOT NULL, id uuid NOT NULL, calendar_id uuid NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  PRIMARY KEY(business_id,id),
  FOREIGN KEY(business_id,calendar_id) REFERENCES core.calendar(business_id,id)
);
CREATE UNIQUE INDEX one_default_resource ON core.resource(business_id,calendar_id) WHERE is_default;
CREATE TABLE core.customer (
  business_id text NOT NULL REFERENCES core.business, id uuid NOT NULL,
  subject text NOT NULL, PRIMARY KEY(business_id,id), UNIQUE(business_id,subject)
);
CREATE TABLE core.conversation (
  business_id text NOT NULL, id uuid NOT NULL, channel_id uuid NOT NULL,
  subject text NOT NULL, next_sequence bigint NOT NULL DEFAULT 1,
  PRIMARY KEY(business_id,id), UNIQUE(business_id,channel_id,subject),
  FOREIGN KEY(business_id,channel_id) REFERENCES core.channel(business_id,id)
);
CREATE TABLE core.seal (
  business_id text NOT NULL REFERENCES core.business, stable_key text NOT NULL,
  kind text NOT NULL, digest text NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$'),
  receipt jsonb NOT NULL,
  PRIMARY KEY(business_id,stable_key)
);
CREATE TABLE core.batch (
  business_id text NOT NULL REFERENCES core.business, id text NOT NULL,
  digest text NOT NULL, state text NOT NULL CHECK(state IN ('STAGED','ELIGIBLE')),
  seal_key text, PRIMARY KEY(business_id,id),
  FOREIGN KEY(business_id,seal_key) REFERENCES core.seal(business_id,stable_key)
);
CREATE TABLE core.input (
  business_id text NOT NULL, id uuid NOT NULL, channel_id uuid NOT NULL,
  conversation_id uuid NOT NULL, provider_id text NOT NULL, subject text NOT NULL,
  digest text NOT NULL, event jsonb NOT NULL,
  sequence bigint NOT NULL CHECK(sequence>0), received_at timestamptz NOT NULL,
  state text NOT NULL CHECK(state IN ('STAGED','ELIGIBLE')),
  PRIMARY KEY(business_id,id), UNIQUE(business_id,channel_id,provider_id),
  UNIQUE(business_id,conversation_id,sequence),
  FOREIGN KEY(business_id,channel_id) REFERENCES core.channel(business_id,id),
  FOREIGN KEY(business_id,conversation_id) REFERENCES core.conversation(business_id,id)
);
CREATE TABLE core.batch_input (
  business_id text NOT NULL, batch_id text NOT NULL, input_id uuid NOT NULL,
  PRIMARY KEY(business_id,batch_id,input_id),
  FOREIGN KEY(business_id,batch_id) REFERENCES core.batch(business_id,id),
  FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id)
);
CREATE TABLE core.permission_head (
  business_id text NOT NULL REFERENCES core.business, subject text NOT NULL,
  purpose text NOT NULL CHECK(purpose='REMINDER'), revision bigint NOT NULL DEFAULT 0,
  suppressed boolean NOT NULL DEFAULT true, last_revoke_at timestamptz,
  PRIMARY KEY(business_id,subject,purpose)
);
CREATE TABLE core.permission_event (
  business_id text NOT NULL REFERENCES core.business, evidence_id text NOT NULL,
  subject text NOT NULL, decision text NOT NULL CHECK(decision IN ('GRANT','REVOKE')),
  occurred_at timestamptz NOT NULL, revision bigint NOT NULL, digest text NOT NULL,
  PRIMARY KEY(business_id,evidence_id)
);
CREATE TABLE core.status_event (
  business_id text NOT NULL REFERENCES core.business, evidence_id text NOT NULL,
  digest text NOT NULL, revision bigint NOT NULL, PRIMARY KEY(business_id,evidence_id)
);
CREATE TABLE core.audit (
  business_id text NOT NULL REFERENCES core.business,
  id bigint GENERATED ALWAYS AS IDENTITY, actor name NOT NULL,
  action text NOT NULL, evidence text NOT NULL, detail jsonb NOT NULL,
  PRIMARY KEY(business_id,id)
);
CREATE TABLE core.recovery_case (
  business_id text NOT NULL REFERENCES core.business, stable_key text NOT NULL,
  reason text NOT NULL, original_evidence jsonb NOT NULL,
  PRIMARY KEY(business_id,stable_key)
);

-- Deliberately authenticates a DB role grant AND checks transaction-local scope.
-- A shared service role granted A+B still has that explicitly documented blast radius.
CREATE FUNCTION core.scope_allowed(b text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,core AS $$
 SELECT b=current_setting('wp1.business_id',true)
 AND EXISTS(SELECT 1 FROM core.role_scope s WHERE s.role_name=session_user AND s.business_id=b)
$$;
CREATE FUNCTION core.assert_scope(b text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF NOT core.scope_allowed(b) THEN RAISE EXCEPTION 'scope_denied' USING ERRCODE='42501'; END IF;
END $$;

CREATE FUNCTION core.register_seal(b text,k text,t text,d text,r jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE old core.seal;
BEGIN
 PERFORM core.assert_scope(b);
 IF r->>'key'<>k OR r->>'kind'<>t OR r->>'digest'<>d OR r->'body' IS NULL THEN RAISE EXCEPTION 'malformed_seal'; END IF;
 INSERT INTO core.seal VALUES(b,k,t,d,r) ON CONFLICT DO NOTHING;
 SELECT * INTO old FROM core.seal WHERE business_id=b AND stable_key=k;
 IF old.kind<>t OR old.digest<>d OR old.receipt<>r THEN RAISE EXCEPTION 'seal_conflict'; END IF;
END $$;

CREATE FUNCTION core.stage_batch(b text,batch_id text,batch_digest text,items jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE item jsonb; ch core.channel; conv core.conversation; prior core.input; prior_batch core.batch;
BEGIN
 PERFORM core.assert_scope(b);
 IF jsonb_array_length(items)<1 OR jsonb_array_length(items)>100 THEN RAISE EXCEPTION 'batch_size'; END IF;
 INSERT INTO core.batch VALUES(b,batch_id,batch_digest,'STAGED',NULL) ON CONFLICT DO NOTHING;
 SELECT * INTO prior_batch FROM core.batch WHERE business_id=b AND id=batch_id FOR UPDATE;
 IF prior_batch.digest<>batch_digest THEN RAISE EXCEPTION 'batch_conflict'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
  SELECT * INTO ch FROM core.channel WHERE business_id=b AND id=(item->>'channelId')::uuid FOR SHARE;
  IF ch.id IS NULL OR NOT ch.verified OR ch.waba<>item->>'waba' OR ch.number_id<>item->>'numberId'
     OR ch.revision<>(item->>'channelRevision')::bigint THEN RAISE EXCEPTION 'channel_denied'; END IF;
  INSERT INTO core.conversation VALUES(b,(item->>'conversationId')::uuid,ch.id,item->>'subject',1) ON CONFLICT DO NOTHING;
  SELECT * INTO conv FROM core.conversation WHERE business_id=b AND channel_id=ch.id AND subject=item->>'subject' FOR UPDATE;
  SELECT * INTO prior FROM core.input WHERE business_id=b AND channel_id=ch.id AND provider_id=item->>'providerId';
  IF prior.id IS NOT NULL THEN
   IF prior.digest<>item->>'digest' OR prior.id<>(item->>'inputId')::uuid THEN RAISE EXCEPTION 'input_conflict'; END IF;
  ELSE
   INSERT INTO core.input VALUES(b,(item->>'inputId')::uuid,ch.id,conv.id,item->>'providerId',item->>'subject',
     item->>'digest',item->'event',conv.next_sequence,(item->>'receivedAt')::timestamptz,'STAGED');
   UPDATE core.conversation SET next_sequence=next_sequence+1 WHERE business_id=b AND id=conv.id;
  END IF;
  INSERT INTO core.batch_input VALUES(b,batch_id,(item->>'inputId')::uuid) ON CONFLICT DO NOTHING;
 END LOOP;
END $$;

CREATE FUNCTION core.activate_batch(b text,batch_id text,seal_key text,seal_digest text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 PERFORM core.assert_scope(b);
 IF NOT EXISTS(SELECT 1 FROM core.seal s WHERE s.business_id=b AND s.stable_key=seal_key
   AND s.kind='BATCH_COMMIT' AND s.digest=seal_digest AND s.receipt->'body'->>'batchId'=batch_id
   AND s.receipt->'body'->>'batchDigest'=(SELECT digest FROM core.batch WHERE business_id=b AND id=batch_id)) THEN RAISE EXCEPTION 'unsealed_batch'; END IF;
 UPDATE core.batch SET state='ELIGIBLE',seal_key=activate_batch.seal_key WHERE business_id=b AND id=batch_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'batch_missing'; END IF;
 UPDATE core.input SET state='ELIGIBLE' WHERE business_id=b AND id IN
   (SELECT input_id FROM core.batch_input WHERE business_id=b AND core.batch_input.batch_id=activate_batch.batch_id);
END $$;

CREATE FUNCTION core.suppress(b text,s text,e text,d text,at_time timestamptz) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE h core.permission_head; old core.permission_event;
BEGIN
 PERFORM core.assert_scope(b); PERFORM 1 FROM core.business WHERE business_id=b FOR SHARE;
 INSERT INTO core.permission_head(business_id,subject,purpose) VALUES(b,s,'REMINDER') ON CONFLICT DO NOTHING;
 SELECT * INTO h FROM core.permission_head WHERE business_id=b AND subject=s AND purpose='REMINDER' FOR UPDATE;
 SELECT * INTO old FROM core.permission_event WHERE business_id=b AND evidence_id=e;
 IF old.evidence_id IS NOT NULL THEN
  IF old.digest<>d OR old.subject<>s OR old.decision<>'REVOKE' THEN RAISE EXCEPTION 'permission_conflict'; END IF;
  RETURN old.revision;
 END IF;
 UPDATE core.permission_head SET suppressed=true,revision=revision+1,
   last_revoke_at=greatest(last_revoke_at,at_time) WHERE business_id=b AND subject=s AND purpose='REMINDER'
   RETURNING * INTO h;
 INSERT INTO core.permission_event VALUES(b,e,s,'REVOKE',at_time,h.revision,d);
 INSERT INTO core.audit(business_id,actor,action,evidence,detail) VALUES(b,session_user,'REVOKE',e,jsonb_build_object('revision',h.revision));
 RETURN h.revision;
END $$;

CREATE FUNCTION core.grant_permission(b text,s text,e text,d text,expected bigint,at_time timestamptz,now_time timestamptz,seal_key text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE h core.permission_head; old core.permission_event;
BEGIN
 PERFORM core.assert_scope(b); PERFORM 1 FROM core.business WHERE business_id=b FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM core.seal x WHERE x.business_id=b AND x.stable_key=seal_key AND x.kind='GRANT' AND x.digest=d
   AND x.receipt->'body'->>'businessId'=b AND x.receipt->'body'->>'subject'=s AND x.receipt->'body'->>'evidenceId'=e
   AND (x.receipt->'body'->>'expected')::bigint=expected AND (x.receipt->'body'->>'occurredAt')::timestamptz=at_time)
   THEN RAISE EXCEPTION 'unsealed_grant'; END IF;
 IF NOT EXISTS(SELECT 1 FROM core.customer WHERE business_id=b AND subject=s) THEN RAISE EXCEPTION 'unknown_customer'; END IF;
 INSERT INTO core.permission_head(business_id,subject,purpose) VALUES(b,s,'REMINDER') ON CONFLICT DO NOTHING;
 SELECT * INTO h FROM core.permission_head WHERE business_id=b AND subject=s AND purpose='REMINDER' FOR UPDATE;
 SELECT * INTO old FROM core.permission_event WHERE business_id=b AND evidence_id=e;
 IF old.evidence_id IS NOT NULL THEN
  IF old.digest<>d OR old.subject<>s OR old.decision<>'GRANT' THEN RAISE EXCEPTION 'permission_conflict'; END IF;
  RETURN old.revision;
 END IF;
 IF h.revision<>expected OR at_time>now_time OR NOT isfinite(at_time) OR at_time<=h.last_revoke_at THEN RAISE EXCEPTION 'stale_grant'; END IF;
 UPDATE core.permission_head SET suppressed=false,revision=revision+1 WHERE business_id=b AND subject=s AND purpose='REMINDER' RETURNING * INTO h;
 INSERT INTO core.permission_event VALUES(b,e,s,'GRANT',at_time,h.revision,d);
 INSERT INTO core.audit(business_id,actor,action,evidence,detail) VALUES(b,session_user,'GRANT',e,jsonb_build_object('revision',h.revision));
 RETURN h.revision;
END $$;

CREATE FUNCTION core.set_status(b text,status_value text,e text,d text,expected bigint,seal_key text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE h core.business; old core.status_event;
BEGIN
 PERFORM core.assert_scope(b);
 SELECT * INTO h FROM core.business WHERE business_id=b FOR UPDATE;
 SELECT * INTO old FROM core.status_event WHERE business_id=b AND evidence_id=e;
 IF old.evidence_id IS NOT NULL THEN
  IF old.digest<>d THEN RAISE EXCEPTION 'status_conflict'; END IF; RETURN old.revision;
 END IF;
 IF h.revision<>expected THEN RAISE EXCEPTION 'stale_status'; END IF;
 IF status_value='ACTIVE' AND NOT EXISTS(SELECT 1 FROM core.seal s WHERE s.business_id=b AND s.stable_key=seal_key AND s.kind='REACTIVATE' AND s.digest=d
   AND s.receipt->'body'->>'businessId'=b AND s.receipt->'body'->>'value'=status_value AND s.receipt->'body'->>'id'=e AND (s.receipt->'body'->>'expected')::bigint=expected)
 THEN RAISE EXCEPTION 'unsealed_reactivation'; END IF;
 UPDATE core.business SET status=status_value,revision=revision+1 WHERE business_id=b RETURNING * INTO h;
 INSERT INTO core.status_event VALUES(b,e,d,h.revision);
 INSERT INTO core.audit(business_id,actor,action,evidence,detail) VALUES(b,session_user,'STATUS',e,jsonb_build_object('status',status_value,'revision',h.revision));
 RETURN h.revision;
END $$;
