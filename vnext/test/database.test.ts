import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,plan,apply,admission,raw,evidence,arm,provider,holdInput} from './support/helpers.js';
import {text} from '../src/domain/protocol.js';
import {prepareOperation} from '../src/application/prepare-operation.js';
import {dispatchOnce} from '../src/application/dispatch-once.js';

test('DB02/03: competing same-resource bookings reject one; distinct resources on the same Calendar can both reserve',async t=>{
  const f=await fixture(t);await plan(f);
  await assert.rejects(plan(f),/exclusion|customer_overlap/);
  const customer=randomUUID();await f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',['synthetic-a',customer,'second-person']);
  const other=await admission(f,raw(f,'synthetic fixed command','synthetic-a',randomUUID(),'second-person'));
  const parallel=await plan(f,{inputId:text(other.inputs[0]!['inputId']),customerId:customer,resourceId:f.id('otherResource')});
  assert.equal((await f.rows('protection')).length,2);assert.notEqual(parallel.body['resourceId'],f.id('resource'));
  await evidence('DB03',{protections:await f.rows('protection'),sameCalendar:true});
});

test('DB02/04: same-event MOVE/CANCEL/ATTENDANCE cannot share the mutation guard; move protects merged source and target',async t=>{
  const f=await fixture(t),original=await plan(f);await apply(t,f,original);
  const move=await plan(f,{kind:'MOVE',appointmentId:text(original.body['appointmentId']),eventId:text(original.body['eventId']),expectedRevision:2,startAt:'2030-01-02T10:30:00Z',endAt:'2030-01-02T11:30:00Z'});
  const ranges=await f.rows('protection');assert.equal(ranges.length,1);assert.match(String(ranges[0]!['protected_range']),/10:00:00/);assert.match(String(ranges[0]!['protected_range']),/11:30:00/);
  for(const kind of ['MOVE','CANCEL','ATTENDANCE'] as const)await assert.rejects(plan(f,{kind,appointmentId:text(move.body['appointmentId']),eventId:text(move.body['eventId']),expectedRevision:2}),/mutation_guard|duplicate key/);
  assert.equal((await f.rows('mutation_guard')).length,1);
});

test('DB03: empty/infinite/bad-bound protections fail at PostgreSQL, zero-buffer touching appointments remain valid',async t=>{
  const f=await fixture(t),p=await plan(f);await apply(t,f,p);
  const values=['empty','(,2030-01-02 11:00:00+00)','[2030-01-02 10:00:00+00,infinity)','(2030-01-02 10:00:00+00,2030-01-02 11:00:00+00]'];
  for(const range of values)await assert.rejects(f.admin.query('INSERT INTO core.protection VALUES($1,$2,$3,$4,$5::tstzrange)',['synthetic-a',p.body['appointmentId'],p.body['operationId'],f.id('resource'),range]),/check constraint/);
  await plan(f,{startAt:'2030-01-02T11:00:00Z',endAt:'2030-01-02T12:00:00Z'});
  assert.equal((await f.rows('protection')).length,2);
});

test('SEC03: actual roles deny table writes, PUBLIC definer calls, forged scope and pooled scope reuse',async t=>{
  const f=await fixture(t),tenant=f.role('tenant_a');
  const result=await tenant.tx('synthetic-b',async db=>(await db.query('SELECT * FROM core.business')).rows);assert.equal(result.length,0);
  await assert.rejects(tenant.tx('synthetic-a',async db=>db.query("UPDATE core.business SET dispatch_enabled=true")),/permission denied/);
  await assert.rejects(tenant.tx('synthetic-a',async db=>db.query("SELECT core.set_status('synthetic-a','ACTIVE','x','x',1,'')")),/permission denied/);
  await assert.rejects(tenant.pool.query('SET ROLE wp1_definer'),/permission denied/);
  await assert.rejects(f.role('reducer').tx('synthetic-a',async db=>db.query("SELECT core.register_seal('synthetic-a','fake','RESULT',repeat('a',64),'{}')")),/permission denied/);
  await assert.rejects(tenant.tx('synthetic-b',async db=>db.query("SELECT core.scope_allowed('synthetic-b'),core.assert_scope('synthetic-b')")),/permission denied|scope_denied/);
  assert.equal((await tenant.pool.query('SELECT * FROM core.business')).rows.length,0);
  const publicCount=await f.admin.query("SELECT count(*)::integer n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE n.nspname='core' AND x.grantee=0 AND x.privilege_type='EXECUTE'");
  assert.equal(publicCount.rows[0]['n'],0);
});

test('SEC02/04/F30: cross-business FK and copied/foreign appointment tuple never authorize an operation',async t=>{
  const f=await fixture(t);await assert.rejects(plan(f,{customerId:f.id('customer','synthetic-b')}),/customer_denied/);
  await assert.rejects(plan(f,{resourceId:f.id('resource','synthetic-b')}),/resource_denied/);
  for(const i of await f.rows('input'))await holdInput(f,text(i['id']));
  const p=await plan(f);await apply(t,f,p);
  await assert.rejects(plan(f,{kind:'MOVE',appointmentId:text(p.body['appointmentId']),eventId:'copied-'+text(p.body['eventId']),expectedRevision:2}),/appointment_denied/);
  await assert.rejects(f.admin.query('INSERT INTO core.resource VALUES($1,$2,$3,false)',['synthetic-a',randomUUID(),f.id('calendar','synthetic-b')]),/foreign key/);
});

test('DB02/03: two actual sessions released together cannot both reserve the same resource interval',async t=>{
  const f=await fixture(t),customer=randomUUID();await f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',['synthetic-a',customer,'second-person']);
  const first=await admission(f),second=await admission(f,raw(f,'synthetic fixed command','synthetic-a',randomUUID(),'second-person'));
  let count=0,release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
  const one=(inputId:string,customerId:string)=>prepareOperation({request:{businessId:'synthetic-a',inputId,customerId,calendarId:f.id('calendar'),resourceId:f.id('resource'),startAt:'2030-01-02T10:00:00Z',endAt:'2030-01-02T11:00:00Z'},
    reducer:f.role('reducer'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock,faults:{async hit(p){if(p==='prepare.afterArchive'){count++;if(count===2)release();await gate;}}}});
  const result=await Promise.allSettled([one(text(first.inputs[0]!['inputId']),f.id('customer')),one(text(second.inputs[0]!['inputId']),customer)]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal((await f.rows('operation')).length,1);assert.equal((await f.rows('protection')).length,1);
});

test('F27/SEC02: changed calendar grant/revision and expired deadline stop final dispatch',async t=>{
  for(const changed of ['calendar','deadline']){
    const f=await fixture(t),p=await plan(f),ownerId=await arm(f,p),{server,client}=await provider(t,f);
    if(changed==='calendar')await f.admin.query("UPDATE core.calendar SET revision=revision+1,grant_id='changed-grant' WHERE business_id='synthetic-a'");
    else f.clock.instant+=16*60000;
    const outcome=await dispatchOnce({businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock});
    assert.equal(outcome.state,'HELD');assert.equal((await server.calls()).length,0);assert.equal((await f.rows('mutation_guard')).length,1);
  }
});

test('DB04: a failed move preparation rolls back its guard and union and cannot shorten the original duration/buffer',async t=>{
  const f=await fixture(t),p=await plan(f,{bufferMinutes:15});await apply(t,f,p);const before=await f.rows('protection');
  await assert.rejects(plan(f,{kind:'MOVE',appointmentId:text(p.body['appointmentId']),eventId:text(p.body['eventId']),expectedRevision:2,startAt:'2030-01-02T12:00:00Z',endAt:'2030-01-02T13:00:00Z',bufferMinutes:0}),/duration_buffer_changed/);
  assert.deepEqual(await f.rows('protection'),before);assert.equal((await f.rows('mutation_guard')).length,0);
});

test('DB06: JSON null versions cannot evade the final gate through SQL three-valued comparisons',async t=>{
  const f=await fixture(t),p=await plan(f),newId=randomUUID();
  await assert.rejects(f.admin.query(`INSERT INTO core.attempt(business_id,id,operation_id,state,envelope,payload_digest)
    SELECT business_id,$1::uuid,operation_id,'PREPARED',jsonb_set(jsonb_set(envelope,'{attemptId}',to_jsonb($1::text)),'{businessRevision}','null'::jsonb),payload_digest
    FROM core.attempt WHERE business_id='synthetic-a' AND id=$2`,[newId,p.body['attemptId']]),/check constraint/);
});
