-- Focused local review correction; never rewrite migrations001–008 or sealed inputs.
-- Existing attempts, guards, protections, appointments, ledger and histories are untouched.
CREATE FUNCTION core.local_support_route_v2() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE cv uuid; in_support boolean; routing jsonb; navigation boolean=false;
BEGIN
 PERFORM core.assert_scope(NEW.business_id);
 SELECT conversation_id INTO cv FROM core.input WHERE business_id=NEW.business_id AND id=NEW.input_id;
 IF TG_OP='INSERT' THEN
  SELECT CASE WHEN c.mode='HUMAN' THEN true WHEN s.state->>'outcome' IS DISTINCT FROM 'HUMAN_HANDOFF' THEN false ELSE NOT EXISTS(
   SELECT 1 FROM core.input nav JOIN core.input_reduction red ON red.business_id=nav.business_id AND red.input_id=nav.id
   WHERE nav.business_id=NEW.business_id AND nav.conversation_id=cv AND red.outcome='NAVIGATION'
   AND nav.sequence>coalesce((SELECT max(hi.sequence) FROM core.local_message hm JOIN core.input hi ON hi.business_id=hm.business_id AND hi.id=hm.input_id WHERE hm.business_id=NEW.business_id AND hi.conversation_id=cv AND hm.result->'state'->>'outcome'='HUMAN_HANDOFF'),0)
  ) END INTO in_support
   FROM core.local_session s LEFT JOIN core.conversation_context c ON c.business_id=s.business_id AND c.conversation_id=s.conversation_id
   WHERE s.business_id=NEW.business_id AND s.conversation_id=cv;
  -- The registered LOCAL_INPUT seal carries the application's decision. Do not
  -- classify payload text again in SQL: Unicode categories/collation can differ.
  SELECT s.receipt->'body'->'routing' INTO routing FROM core.input_classification c
   JOIN core.seal s ON s.business_id=c.business_id AND s.stable_key=c.seal_key
   WHERE c.business_id=NEW.business_id AND c.input_id=NEW.input_id;
  IF routing IS NOT NULL THEN
   IF jsonb_typeof(routing) IS DISTINCT FROM 'object' OR routing->'version' IS DISTINCT FROM '1'::jsonb
    OR routing->>'outcome' IS NULL OR routing->>'outcome' NOT IN ('NAVIGATION','HUMAN_HANDOFF','NO_EFFECT') THEN RAISE EXCEPTION 'local_routing_version_denied'; END IF;
   navigation=routing->>'outcome'='NAVIGATION';
  END IF;
  -- Old allocated receipts have no routing metadata: preserve the reference
  -- conservatively. Their later NAVIGATION reduction records control semantics.
 ELSE
  -- The completed application's decision is authoritative, including legacy
  -- admissions. Never re-normalize and silently drop a HUMAN_HANDOFF result.
  in_support=NEW.result->'state'->>'outcome'='HUMAN_HANDOFF';
 END IF;
 IF in_support IS TRUE AND NOT navigation THEN
  INSERT INTO core.local_support_message(business_id,input_id,conversation_id) VALUES(NEW.business_id,NEW.input_id,cv) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION core.local_support_route_v2() OWNER TO wp1_definer;
REVOKE ALL ON FUNCTION core.local_support_route_v2() FROM PUBLIC;
DROP TRIGGER local_support_route ON core.local_message;
CREATE TRIGGER local_support_route AFTER INSERT OR UPDATE OF state ON core.local_message
 FOR EACH ROW EXECUTE FUNCTION core.local_support_route_v2();
-- Recover omitted queue references from already durable, authoritative app results.
-- Only append missing references; original inputs/results/queue records are not rewritten.
INSERT INTO core.local_support_message(business_id,input_id,conversation_id)
 SELECT m.business_id,m.input_id,i.conversation_id FROM core.local_message m
 JOIN core.input i ON i.business_id=m.business_id AND i.id=m.input_id
 WHERE m.result->'state'->>'outcome'='HUMAN_HANDOFF' ON CONFLICT DO NOTHING;
