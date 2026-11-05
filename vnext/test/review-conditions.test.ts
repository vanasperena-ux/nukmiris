import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,plan,cut,apply,arm,abandon,admission,raw,evidence} from './support/helpers.js';
import type {Fixture} from './support/postgres-fixture.js';
import {text} from '../src/domain/protocol.js';
import type {ObjectValue} from '../src/domain/protocol.js';
import type {Seal} from '../src/ports.js';
const b='synthetic-a',nil='00000000-0000-0000-0000-000000000000';
const reservationTables=['appointment','operation','mutation_guard','protection','attempt','output_intent'] as const;
async function reservationState(f:Fixture) {
 return Object.fromEntries(await Promise.all(reservationTables.map(async table=>[table,(await f.rows(table)).sort((a,z)=>JSON.stringify(a).localeCompare(JSON.stringify(z)))])));
}
async function candidate(f:Fixture,overrides:Parameters<typeof plan>[1]={}):Promise<ObjectValue> {
 await assert.rejects(plan(f,overrides,cut('prepare.afterArchive')),/injected/);
 const plans=(await f.archive.records()).filter(s=>s.kind==='OPERATION_PLAN');return structuredClone(plans.at(-1)!.body);
}
async function sealPlan(f:Fixture,p:ObjectValue):Promise<Seal> {
 const s=await f.archive.ensure('condition-plan/'+randomUUID(),'OPERATION_PLAN',p);await f.role('sealer').seal(b,f.archive,s);return s;
}
async function prepare(f:Fixture,p:ObjectValue,s?:Seal):Promise<void> {
 s??=await sealPlan(f,p);await f.role('reducer').tx(b,db=>db.query('SELECT core.prepare_operation($1,$2,$3,$4)',[b,p,s.digest,s.key]));
}

test('C1 NEW-1: invalid/missing/NULL output purpose or output identity is denied before any reservation',async t=>{
 const f=await fixture(t),base=await candidate(f),before=await reservationState(f),results:ObjectValue[]=[];
 const bad:Record<string,(p:ObjectValue)=>void>={};
 for(const value of ['BOGUS','','reminder','CUSTOMER_REQUEST ',true,1,{},[],null])bad['purpose.'+JSON.stringify(value)]=p=>{p['outputPurpose']=value;};
 bad['purpose.missing']=p=>{delete p['outputPurpose'];};
 for(const value of [nil,'','not-a-uuid',true,1,{},[],null])bad['id.'+JSON.stringify(value)]=p=>{p['outputId']=value;};
 bad['id.missing']=p=>{delete p['outputId'];};
 bad['id.operation']=p=>{p['outputId']=p['operationId']!;};
 bad['id.attempt']=p=>{p['outputId']=p['attemptId']!;};
 bad['id.uppercase-operation']=p=>{p['outputId']=text(p['operationId']).toUpperCase();};
 bad['id.uppercase-attempt']=p=>{p['outputId']=text(p['attemptId']).toUpperCase();};
 for(const [variant,change] of Object.entries(bad)) {
  const p=structuredClone(base);change(p);await assert.rejects(prepare(f,p),variant);
  assert.deepEqual(await reservationState(f),before,variant);results.push({variant,denied:true,newReservations:0});
 }
 await evidence('C1-output-values',{cases:results.length,results});
});

test('C1 NEW-1: an existing finalized output ID cannot create new reservations or an attempt',async t=>{
 const f=await fixture(t),first=await plan(f);await apply(t,f,first);
 f.clock.instant+=16*60000;
 await f.role('dispatch').tx(b,db=>db.query('SELECT core.expire_unsent($1,$2,$3)',[b,first.body['outputId'],f.clock.now().toISOString()]));
 const p=await candidate(f,{startAt:'2030-01-03T10:00:00Z',endAt:'2030-01-03T11:00:00Z'});p['outputId']=text(first.body['outputId']).toUpperCase();
 const before=await reservationState(f);await assert.rejects(prepare(f,p),/plan_output_denied/);
 assert.deepEqual(await reservationState(f),before);assert.equal((await f.rows('attempt')).length,1);
 await evidence('C1-existing-output',{rejectedBeforeReservation:true,newAttempts:0,newOperations:0});
});

test('C1 NEW-1: pending and abandoned operation plans retain exclusive output IDs, with exact replay allowed',async t=>{
 const f=await fixture(t),first=await plan(f),customer=randomUUID();
 await f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',[b,customer,'independent-c1']);
 const input=await admission(f,raw(f,'synthetic fixed command',b,randomUUID(),'independent-c1'));
 const base=await candidate(f,{inputId:text(input.inputs[0]!['inputId']),customerId:customer,startAt:'2030-01-03T10:00:00Z',endAt:'2030-01-03T11:00:00Z'});
 const p={...base,outputId:first.body['outputId']!},before=await reservationState(f);
 await assert.rejects(prepare(f,p),/plan_output_denied/);assert.deepEqual(await reservationState(f),before);
 await prepare(f,first.body,first);assert.deepEqual(await reservationState(f),before,'exact replay is idempotent');
 await abandon(f,text(first.body['attemptId']));const abandoned=await reservationState(f);
 await assert.rejects(prepare(f,p),/plan_output_denied/);assert.deepEqual(await reservationState(f),abandoned);
});

for(const purpose of ['CUSTOMER_REQUEST','REMINDER'] as const)test('C1 NEW-1: valid '+purpose+' finalizes once after an output-free preparation',async t=>{
 const f=await fixture(t),p=await plan(f,{outputPurpose:purpose});assert.equal((await f.rows('output_intent')).length,0,'preflight must leave no output');
 await apply(t,f,p);const outputs=await f.rows('output_intent');assert.equal(outputs.length,1);assert.equal(outputs[0]!['purpose'],purpose);assert.equal(outputs[0]!['id'],p.body['outputId']);assert.equal(outputs[0]!['schedule_revision'],'2');
 const before=await reservationState(f);await prepare(f,p.body,p);assert.deepEqual(await reservationState(f),before,'replay after finalization must remain idempotent');
});

test('C1 NEW-1: all plan-sourced final output values are validated by preparation',async t=>{
 const f=await fixture(t),base=await candidate(f),before=await reservationState(f);
 const changes:Record<string,ObjectValue>={
  payload:{outputPayload:null},digest:{outputDigest:'wrong'},due:{outputDueAt:'infinity'},deadline:{outputDeadlineAt:'-infinity'},interval:{outputDueAt:'2030-01-01T10:00:00Z'},business:{businessId:'synthetic-b'},input:{inputId:randomUUID()},appointment:{appointmentId:nil},operation:{operationId:nil},attempt:{attemptId:nil}
 };
 for(const [variant,change] of Object.entries(changes)){await assert.rejects(prepare(f,{...base,...change}),variant);assert.deepEqual(await reservationState(f),before,variant);}
});

test('C1 NEW-1: actual output-table constraint changes fail preparation, not post-provider finalization',async t=>{
 const f=await fixture(t),p=await candidate(f);
 // Exercise the real table schema, not a duplicate TS/SQL predicate. A new output
 // CHECK must be observed by preparation even when every existing plan guard passes.
 await f.admin.query("ALTER TABLE core.output_intent ADD CONSTRAINT review_required_marker CHECK(payload ? 'review_required_marker')");
 const before=await reservationState(f);await assert.rejects(prepare(f,p),/review_required_marker/);assert.deepEqual(await reservationState(f),before);
});

test('C1 NEW-1: simultaneous different-conversation plans cannot both reserve the same future output ID',async t=>{
 const f=await fixture(t),first=await candidate(f),customer=randomUUID();
 await f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',[b,customer,'condition-second-person']);
 const admitted=await admission(f,raw(f,'synthetic fixed command',b,randomUUID(),'condition-second-person'));
 const second=await candidate(f,{inputId:text(admitted.inputs[0]!['inputId']),customerId:customer,resourceId:f.id('otherResource')});second['outputId']=first['outputId']!;
 const seals=[await sealPlan(f,first),await sealPlan(f,second)],plans=[first,second];
 // Keep the first successful prepare uncommitted. The second cannot see its
 // operation in the precheck, so only the unique index can reject the collision.
 let release!:()=>void,arrive!:()=>void;const arrived=new Promise<void>(r=>{arrive=r;}),barrier=new Promise<void>(r=>{release=r;});
 const winning=f.role('reducer').tx(b,db=>db.query('SELECT core.prepare_operation($1,$2,$3,$4)',[b,plans[0],seals[0]!.digest,seals[0]!.key]),'contender',{async hit(point){if(point==='contender.beforeCommit'){arrive();await barrier;}}});
 await arrived;
 const losing=prepare(f,plans[1]!,seals[1]).then(()=> 'unexpectedly prepared',error=>String(error));
 let waiting=false;
 try {
  for(let n=0;n<100;n++){
   const rows=await f.admin.query("SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND usename='wp1_reducer' AND wait_event_type='Lock'",[f.dbname]);
   if(rows.rowCount){waiting=true;break;}await delay(10);
  }
 } finally {release();}
 await winning;const denied=await losing;
 assert.equal(waiting,true,'losing preparation must actually wait at the unique index');
 assert.match(denied,/operation_output_identity/);
 for(const table of ['appointment','operation','mutation_guard','protection','attempt'] as const)assert.equal((await f.rows(table)).length,1,table);
 assert.equal((await f.rows('output_intent')).length,0);
 await evidence('C1-output-id-race',{contenders:2,prepared:1,newAttempts:1,outputsBeforeResult:0,actualUniqueIndexWait:waiting});
});

async function owner(f:Fixture,sql:string|readonly string[]):Promise<number|null> {
 const db=await f.admin.connect();try {await db.query('BEGIN');await db.query('SET LOCAL ROLE wp1_owner');await db.query("SELECT set_config('wp1.business_id',$1,true)",[b]);let count:number|null=0;for(const statement of typeof sql==='string'?[sql]:sql)count=(await db.query(statement)).rowCount;return count;}finally{await db.query('ROLLBACK');db.release();}
}

test('C4 NEW-4: recovery_case payload UPDATE/DELETE denied under actual owner with valid RLS, INSERT retained',async t=>{
 const f=await fixture(t);await f.admin.query("INSERT INTO core.recovery_case VALUES($1,'condition-case','synthetic-review','{\"original\":true}')",[b]);
 await f.admin.query("INSERT INTO core.role_scope VALUES('postgres',$1)",[b]);await f.admin.query('GRANT EXECUTE ON FUNCTION core.scope_allowed(text) TO wp1_owner');
 const before=await f.rows('recovery_case');
 for(const sql of ["UPDATE core.recovery_case SET original_evidence='{}'","UPDATE core.recovery_case SET reason='changed'","DELETE FROM core.recovery_case"])await assert.rejects(owner(f,sql),/append_only_record/);
 assert.deepEqual(await f.rows('recovery_case'),before);
 await assert.rejects(f.role('recovery').tx(b,db=>db.query("UPDATE core.recovery_case SET original_evidence='{}'")),/permission denied/);
 await evidence('C4-recovery-case',{ownerPayloadDMLDenied:true,runtimeDirectDMLDenied:true,unchanged:true});
});

test('C4 NEW-4: owner remains NOLOGIN but can change lifecycle state and disable its triggers',async t=>{
 const f=await fixture(t),p=await plan(f);await arm(f,p);await abandon(f,text(p.body['attemptId']));
 await f.admin.query("INSERT INTO core.role_scope VALUES('postgres',$1)",[b]);await f.admin.query('GRANT EXECUTE ON FUNCTION core.scope_allowed(text) TO wp1_owner');
 await f.admin.query("INSERT INTO core.recovery_case VALUES($1,'condition-case','synthetic-review','{}')",[b]);
 const flags=(await f.admin.query<{rolcanlogin:boolean}>("SELECT rolcanlogin FROM pg_roles WHERE rolname='wp1_owner'")).rows[0]!;assert.equal(flags.rolcanlogin,false);
 assert.equal(await owner(f,"UPDATE core.attempt SET state='ARMED' WHERE state='ABANDONED'"),1);
 assert.equal(await owner(f,"UPDATE core.input SET state='STAGED'"),1);
 // This is deliberately permitted owner DDL, rolled back with the fixture tx.
 // It demonstrates why payload triggers are not protection from owner compromise.
 assert((await owner(f,["ALTER TABLE core.audit DISABLE TRIGGER append_only","UPDATE core.audit SET evidence='owner-ddl-probe'"]))!>0);
 assert.equal((await f.admin.query("SELECT tgenabled FROM pg_trigger WHERE tgrelid='core.audit'::regclass AND tgname='append_only'")).rows[0]['tgenabled'],'O');
 for(const role of ['ingress','sealer','reducer','dispatch','result','operator','recovery']) {
  await assert.rejects(f.role(role).tx(b,db=>db.query('SET ROLE wp1_owner')),/permission denied/);
  await assert.rejects(f.role(role).tx(b,db=>db.query('SELECT core.insert_operation_output($1,$2,$3,NULL::core.input,NULL::core.appointment)',[b,{},randomUUID()])),/permission denied/);
 }
 await evidence('C4-owner-boundary',{ownerNOLOGIN:true,ownerStateDMLPossible:true,ownerCanDisableTrigger:true,runtimeCannotAssumeOwner:true});
});
