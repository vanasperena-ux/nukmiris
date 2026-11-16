-- SE-1 N1: forward-only, repeatable function replacement. No data rewrite.
CREATE OR REPLACE FUNCTION core.catalog_save(b text,request uuid,expected bigint,kind text,v jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE head bigint; previous core.catalog_edit; body jsonb; item jsonb; sid text; new_service boolean;
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
  -- catalog_head is already locked: creation is based on service existence,
  -- never on whether the owner has left any qualifications.
  SELECT NOT EXISTS(SELECT 1 FROM core.service WHERE business_id=b AND id=v->>'id') INTO new_service;
  INSERT INTO core.service VALUES(b,v->>'id',v->>'name',v->>'description',(v->>'durationMinutes')::integer,(v->>'bufferMinutes')::integer,(v->>'priceMinor')::bigint,v->>'currency',(v->>'active')::boolean)
   ON CONFLICT(business_id,id) DO UPDATE SET name=excluded.name,description=excluded.description,duration_minutes=excluded.duration_minutes,buffer_minutes=excluded.buffer_minutes,price_minor=excluded.price_minor,currency=excluded.currency,active=excluded.active;
  -- Only initial creation qualifies the solo default resource. Edits preserve owner choices.
  IF new_service AND (SELECT count(*) FROM core.employee WHERE business_id=b)=1 THEN
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

COMMENT ON FUNCTION core.catalog_save(text,uuid,bigint,text,jsonb) IS 'SE1_N1_CREATE_ONLY_V1';
