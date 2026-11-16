-- SE-1 local product catalog. Existing evidence, SQL protocols and history remain intact.
CREATE TABLE core.catalog_head (business_id text PRIMARY KEY REFERENCES core.business, revision bigint NOT NULL DEFAULT 1 CHECK(revision>0), time_zone text NOT NULL DEFAULT 'UTC');
CREATE TABLE core.service (
 business_id text NOT NULL REFERENCES core.catalog_head, id text NOT NULL CHECK(id ~ '^[A-Za-z0-9_-]{1,100}$'),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120), description text NOT NULL CHECK(length(description)<=1000),
 duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 1 AND 1440), buffer_minutes integer NOT NULL CHECK(buffer_minutes BETWEEN 0 AND 1440),
 price_minor bigint NOT NULL CHECK(price_minor BETWEEN 0 AND 999999999), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), active boolean NOT NULL,
 PRIMARY KEY(business_id,id));
CREATE TABLE core.employee (
 business_id text NOT NULL REFERENCES core.catalog_head, id uuid NOT NULL, calendar_id uuid NOT NULL,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120), active boolean NOT NULL, hours jsonb NOT NULL CHECK(jsonb_typeof(hours)='object'),
 PRIMARY KEY(business_id,id), FOREIGN KEY(business_id,id) REFERENCES core.resource(business_id,id),
 FOREIGN KEY(business_id,calendar_id) REFERENCES core.calendar(business_id,id));
CREATE TABLE core.qualification (business_id text NOT NULL, employee_id uuid NOT NULL, service_id text NOT NULL,
 PRIMARY KEY(business_id,employee_id,service_id), FOREIGN KEY(business_id,employee_id) REFERENCES core.employee(business_id,id),
 FOREIGN KEY(business_id,service_id) REFERENCES core.service(business_id,id));
CREATE TABLE core.catalog_edit (business_id text NOT NULL REFERENCES core.catalog_head, request_id uuid NOT NULL, body jsonb NOT NULL, revision bigint NOT NULL, actor name NOT NULL DEFAULT session_user,
 PRIMARY KEY(business_id,request_id));
CREATE TABLE core.appointment_service (business_id text NOT NULL, appointment_id uuid NOT NULL, service_id text NOT NULL, snapshot jsonb NOT NULL, catalog_revision bigint NOT NULL,
 PRIMARY KEY(business_id,appointment_id), FOREIGN KEY(business_id,appointment_id) REFERENCES core.appointment(business_id,id), FOREIGN KEY(business_id,service_id) REFERENCES core.service(business_id,id));

CREATE FUNCTION core.catalog_hours(h jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d record; w jsonb; prior_end text;
BEGIN
 IF h IS NULL OR jsonb_typeof(h)<>'object' THEN RETURN false; END IF;
 FOR d IN SELECT * FROM jsonb_each(h) LOOP
  IF d.key !~ '^[1-7]$' OR jsonb_typeof(d.value)<>'array' THEN RETURN false; END IF; prior_end=NULL;
  FOR w IN SELECT value FROM jsonb_array_elements(d.value) LOOP
   IF jsonb_typeof(w)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(w))<>2 OR NOT(w ?& ARRAY['start','end'])
    OR jsonb_typeof(w->'start') IS DISTINCT FROM 'string' OR jsonb_typeof(w->'end') IS DISTINCT FROM 'string'
    OR w->>'start' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR w->>'end' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR w->>'start'>=w->>'end' OR (prior_end IS NOT NULL AND w->>'start'<prior_end) THEN RETURN false; END IF;
   prior_end=w->>'end';
  END LOOP;
 END LOOP; RETURN true;
END $$;
ALTER TABLE core.employee ADD CHECK(core.catalog_hours(hours));
CREATE FUNCTION core.service_snapshot(s core.service) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'durationMinutes',s.duration_minutes,'bufferMinutes',s.buffer_minutes,'priceMinor',s.price_minor,'currency',s.currency)
$$;
CREATE FUNCTION core.catalog_save(b text,request uuid,expected bigint,kind text,v jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE head bigint; previous core.catalog_edit; body jsonb; item jsonb; sid text;
BEGIN
 IF b IS NULL OR request IS NULL OR expected IS NULL OR kind IS NULL OR v IS NULL THEN RAISE EXCEPTION 'null_argument'; END IF;
 PERFORM core.assert_scope(b);
 IF NOT core.valid_tenant_bindings(v,b) THEN RAISE EXCEPTION 'catalog_invalid'; END IF;
 SELECT revision INTO head FROM core.catalog_head WHERE business_id=b FOR UPDATE;
 IF head IS NULL THEN RAISE EXCEPTION 'catalog_not_initialized'; END IF;
 body=jsonb_build_object('expected',expected,'kind',kind,'value',v);
 SELECT * INTO previous FROM core.catalog_edit WHERE business_id=b AND request_id=request;
 IF previous.request_id IS NOT NULL THEN IF previous.body IS DISTINCT FROM body THEN RAISE EXCEPTION 'catalog_request_conflict'; END IF;RETURN previous.revision; END IF;
 IF head<>expected THEN RAISE EXCEPTION 'catalog_revision_conflict' USING ERRCODE='P7601'; END IF;
 IF kind='service' THEN
  IF jsonb_typeof(v)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(v))<>8 OR NOT(v ?& ARRAY['id','name','description','durationMinutes','bufferMinutes','priceMinor','currency','active'])
   OR jsonb_typeof(v->'active')<>'boolean' OR jsonb_typeof(v->'name')<>'string' OR jsonb_typeof(v->'description')<>'string'
   OR jsonb_typeof(v->'id')<>'string' OR jsonb_typeof(v->'currency')<>'string'
   OR jsonb_typeof(v->'durationMinutes')<>'number' OR v->>'durationMinutes' !~ '^[0-9]+$'
   OR jsonb_typeof(v->'bufferMinutes')<>'number' OR v->>'bufferMinutes' !~ '^[0-9]+$'
   OR jsonb_typeof(v->'priceMinor')<>'number' OR v->>'priceMinor' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'catalog_service_invalid'; END IF;
  INSERT INTO core.service VALUES(b,v->>'id',v->>'name',v->>'description',(v->>'durationMinutes')::integer,(v->>'bufferMinutes')::integer,(v->>'priceMinor')::bigint,v->>'currency',(v->>'active')::boolean)
   ON CONFLICT(business_id,id) DO UPDATE SET name=excluded.name,description=excluded.description,duration_minutes=excluded.duration_minutes,buffer_minutes=excluded.buffer_minutes,price_minor=excluded.price_minor,currency=excluded.currency,active=excluded.active;
  -- Solo operation needs no employee setup. Its existing default resource qualifies.
  IF (SELECT count(*) FROM core.employee WHERE business_id=b)=1 THEN
   INSERT INTO core.qualification SELECT b,e.id,v->>'id' FROM core.employee e JOIN core.resource r ON r.business_id=b AND r.id=e.id WHERE e.business_id=b AND r.is_default ON CONFLICT DO NOTHING;
  END IF;
 ELSIF kind='employee' THEN
  IF jsonb_typeof(v)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(v))<>6 OR NOT(v ?& ARRAY['id','name','active','hours','serviceIds','calendarId'])
   OR jsonb_typeof(v->'id')<>'string' OR jsonb_typeof(v->'name')<>'string' OR jsonb_typeof(v->'active')<>'boolean'
   OR jsonb_typeof(v->'serviceIds')<>'array' OR NOT core.catalog_hours(v->'hours') THEN RAISE EXCEPTION 'catalog_employee_invalid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM core.calendar WHERE business_id=b AND id=(v->>'calendarId')::uuid) THEN RAISE EXCEPTION 'catalog_calendar_denied'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(v->'serviceIds') LOOP
   IF jsonb_typeof(item)<>'string' OR NOT EXISTS(SELECT 1 FROM core.service WHERE business_id=b AND id=item#>>'{}') THEN RAISE EXCEPTION 'catalog_qualification_denied'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM core.resource WHERE business_id=b AND id=(v->>'id')::uuid AND calendar_id<>(v->>'calendarId')::uuid) THEN RAISE EXCEPTION 'catalog_resource_immutable'; END IF;
  INSERT INTO core.resource VALUES(b,(v->>'id')::uuid,(v->>'calendarId')::uuid,false) ON CONFLICT DO NOTHING;
  INSERT INTO core.employee VALUES(b,(v->>'id')::uuid,(v->>'calendarId')::uuid,v->>'name',(v->>'active')::boolean,v->'hours') ON CONFLICT(business_id,id) DO UPDATE SET name=excluded.name,active=excluded.active,hours=excluded.hours;
  DELETE FROM core.qualification WHERE business_id=b AND employee_id=(v->>'id')::uuid;
  FOR sid IN SELECT DISTINCT value FROM jsonb_array_elements_text(v->'serviceIds') LOOP INSERT INTO core.qualification VALUES(b,(v->>'id')::uuid,sid); END LOOP;
 ELSE RAISE EXCEPTION 'catalog_kind_denied'; END IF;
 UPDATE core.catalog_head SET revision=revision+1 WHERE business_id=b RETURNING revision INTO head;
 INSERT INTO core.catalog_edit(business_id,request_id,body,revision) VALUES(b,request,body,head);RETURN head;
END $$;

-- A catalog edit and new preparation serialize on this same row. A committed
-- plan keeps its sealed snapshot; an edit that wins first rejects stale work.
CREATE FUNCTION core.catalog_plan_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE revision_value bigint; zone_value text; start_local timestamp; end_local timestamp; day_value text; li core.local_booking_intent; s core.service; employee_value core.employee;
BEGIN
 SELECT revision,time_zone INTO revision_value,zone_value FROM core.catalog_head WHERE business_id=NEW.business_id FOR SHARE;
 IF revision_value IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO li FROM core.local_booking_intent WHERE business_id=NEW.business_id AND input_id=NEW.input_id;
 -- Retain the existing synthetic protocol test selector; real local chat always binds catalog.
 IF li.input_id IS NULL AND EXISTS(SELECT 1 FROM core.input WHERE business_id=NEW.business_id AND id=NEW.input_id AND event->'text'->>'body'='synthetic fixed command') AND NOT EXISTS(SELECT 1 FROM core.local_message WHERE business_id=NEW.business_id AND input_id=NEW.input_id) THEN RETURN NEW; END IF;
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
CREATE TRIGGER catalog_plan_guard BEFORE INSERT ON core.operation FOR EACH ROW EXECUTE FUNCTION core.catalog_plan_guard();
CREATE FUNCTION core.catalog_appointment_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
 IF NEW.plan ? 'serviceSnapshot' THEN
  INSERT INTO core.appointment_service VALUES(NEW.business_id,NEW.appointment_id,NEW.plan->'serviceSnapshot'->>'id',NEW.plan->'serviceSnapshot',(NEW.plan->>'catalogRevision')::bigint);
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER catalog_appointment_snapshot AFTER INSERT ON core.operation FOR EACH ROW EXECUTE FUNCTION core.catalog_appointment_snapshot();
CREATE FUNCTION core.catalog_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'catalog_history_append_only'; END $$;
CREATE TRIGGER catalog_edit_immutable BEFORE UPDATE OR DELETE ON core.catalog_edit FOR EACH ROW EXECUTE FUNCTION core.catalog_immutable();
CREATE TRIGGER appointment_service_immutable BEFORE UPDATE OR DELETE ON core.appointment_service FOR EACH ROW EXECUTE FUNCTION core.catalog_immutable();
DO $$ DECLARE n text; f record; BEGIN
 FOR n IN SELECT unnest(ARRAY['catalog_head','service','employee','qualification','catalog_edit','appointment_service']) LOOP
  EXECUTE format('ALTER TABLE core.%I OWNER TO wp1_owner',n);EXECUTE format('GRANT ALL ON core.%I TO wp1_definer',n);
  EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('ALTER TABLE core.%I FORCE ROW LEVEL SECURITY',n);
  EXECUTE format('CREATE POLICY scoped ON core.%I USING(core.scope_allowed(business_id)) WITH CHECK(core.scope_allowed(business_id))',n);
  EXECUTE format('GRANT SELECT ON core.%I TO wp1_reducer,wp1_operator,wp1_tenant_a,wp1_tenant_b',n);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='core' AND p.proname LIKE 'catalog_%' OR ns.nspname='core' AND p.proname='service_snapshot' LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO wp1_definer',f.signature);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION core.catalog_save(text,uuid,bigint,text,jsonb) TO wp1_operator;
