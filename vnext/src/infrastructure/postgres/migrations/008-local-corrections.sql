-- Additive local synthetic upgrade. Existing identities, seals, attempts, protections,
-- replies, ledger and appointment history are never rewritten or cleared.
CREATE TABLE core.local_support_message (
 business_id text NOT NULL, input_id uuid NOT NULL, conversation_id uuid NOT NULL,
 queued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(business_id,input_id),
 FOREIGN KEY(business_id,input_id) REFERENCES core.input(business_id,id),
 FOREIGN KEY(business_id,conversation_id) REFERENCES core.conversation(business_id,id)
);
ALTER TABLE core.local_support_message OWNER TO wp1_owner;
GRANT ALL ON core.local_support_message TO wp1_definer;
ALTER TABLE core.local_support_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.local_support_message FORCE ROW LEVEL SECURITY;
CREATE POLICY scoped ON core.local_support_message USING(core.scope_allowed(business_id)) WITH CHECK(core.scope_allowed(business_id));
GRANT SELECT ON core.local_support_message TO wp1_reducer,wp1_tenant_a,wp1_tenant_b;
-- Preserve already processed support messages from the earlier L2 implementation.
INSERT INTO core.local_support_message(business_id,input_id,conversation_id)
 SELECT m.business_id,m.input_id,i.conversation_id FROM core.local_message m
 JOIN core.input i ON i.business_id=m.business_id AND i.id=m.input_id
 WHERE m.result->'state'->>'outcome'='HUMAN_HANDOFF';

CREATE FUNCTION core.local_support_route() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE cv uuid; in_support boolean;
BEGIN
 PERFORM core.assert_scope(NEW.business_id);
 SELECT conversation_id INTO cv FROM core.input WHERE business_id=NEW.business_id AND id=NEW.input_id;
 IF TG_OP='INSERT' THEN
  SELECT (c.mode='HUMAN' OR (s.state->>'outcome'='HUMAN_HANDOFF' AND NOT EXISTS(
   SELECT 1 FROM core.input nav JOIN core.input_reduction red ON red.business_id=nav.business_id AND red.input_id=nav.id
   WHERE nav.business_id=NEW.business_id AND nav.conversation_id=cv AND red.outcome='NAVIGATION'
   AND nav.sequence>coalesce((SELECT max(hi.sequence) FROM core.local_message hm JOIN core.input hi ON hi.business_id=hm.business_id AND hi.id=hm.input_id WHERE hm.business_id=NEW.business_id AND hi.conversation_id=cv AND hm.result->'state'->>'outcome'='HUMAN_HANDOFF'),0)
  ))) INTO in_support
   FROM core.local_session s LEFT JOIN core.conversation_context c ON c.business_id=s.business_id AND c.conversation_id=s.conversation_id
   WHERE s.business_id=NEW.business_id AND s.conversation_id=cv;
 ELSE in_support=NEW.result->'state'->>'outcome'='HUMAN_HANDOFF'; END IF;
 IF in_support IS TRUE AND NOT (NEW.payload->>'kind'='TEXT' AND btrim(regexp_replace(translate(lower(NEW.payload->>'value'),'áéíóúüñ','aeiouun'),'[^[:alnum:]]+',' ','g'))='menu') THEN
  INSERT INTO core.local_support_message(business_id,input_id,conversation_id) VALUES(NEW.business_id,NEW.input_id,cv) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
-- Enforce outgoing bounds in SQL as well as the application constructor.
CREATE FUNCTION core.local_presentation_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,core AS $$
DECLARE p jsonb; kind text; n integer; x jsonb; cap integer;
BEGIN
 p=NEW.payload;
 IF TG_TABLE_NAME='output_intent' AND p->>'outcome' IS DISTINCT FROM 'CONFIRMED' THEN RETURN NEW; END IF;
 kind=coalesce(p->>'presentation','TEXT');
 IF jsonb_typeof(p->'text') IS DISTINCT FROM 'string' OR jsonb_typeof(p->'choices') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'local_presentation_denied'; END IF;
 n=jsonb_array_length(p->'choices');
 IF kind='TEXT' THEN
  IF n<>0 OR length(p->>'text') NOT BETWEEN 1 AND 4096 THEN RAISE EXCEPTION 'local_presentation_denied'; END IF;
 ELSIF kind IN ('LIST','REPLY_BUTTONS') THEN
  cap=CASE WHEN kind='LIST' THEN 24 ELSE 20 END;
  IF length(p->>'text') NOT BETWEEN 1 AND 1024 OR n NOT BETWEEN 1 AND (CASE WHEN kind='LIST' THEN 10 ELSE 3 END) THEN RAISE EXCEPTION 'local_presentation_denied'; END IF;
  IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p->'choices'))<>n THEN RAISE EXCEPTION 'local_presentation_denied'; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(p->'choices') LOOP
   IF jsonb_typeof(x->'id') IS DISTINCT FROM 'string' OR length(x->>'id') NOT BETWEEN 1 AND 200 OR jsonb_typeof(x->'title') IS DISTINCT FROM 'string' OR length(x->>'title') NOT BETWEEN 1 AND cap OR x->>'title' ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'local_presentation_denied'; END IF;
  END LOOP;
 ELSE RAISE EXCEPTION 'local_presentation_denied'; END IF;
 IF p ? 'precedingTexts' THEN
  IF jsonb_typeof(p->'precedingTexts') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'local_presentation_denied'; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(p->'precedingTexts') LOOP
   IF jsonb_typeof(x) IS DISTINCT FROM 'string' OR length(x#>>'{}') NOT BETWEEN 1 AND 4096 THEN RAISE EXCEPTION 'local_presentation_denied'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION core.local_support_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,core AS $$ BEGIN RAISE EXCEPTION 'append_only_local_support'; END $$;
ALTER FUNCTION core.local_support_route() OWNER TO wp1_definer;
ALTER FUNCTION core.local_presentation_guard() OWNER TO wp1_definer;
ALTER FUNCTION core.local_support_immutable() OWNER TO wp1_definer;
REVOKE ALL ON FUNCTION core.local_support_route(),core.local_presentation_guard(),core.local_support_immutable() FROM PUBLIC;
CREATE TRIGGER local_support_route AFTER INSERT OR UPDATE OF state ON core.local_message FOR EACH ROW EXECUTE FUNCTION core.local_support_route();
CREATE TRIGGER local_support_immutable BEFORE UPDATE OR DELETE ON core.local_support_message FOR EACH ROW EXECUTE FUNCTION core.local_support_immutable();
CREATE TRIGGER local_presentation_guard BEFORE INSERT ON core.local_reply FOR EACH ROW EXECUTE FUNCTION core.local_presentation_guard();
CREATE TRIGGER local_output_presentation_guard BEFORE INSERT ON core.output_intent FOR EACH ROW EXECUTE FUNCTION core.local_presentation_guard();
