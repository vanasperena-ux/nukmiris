import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,plan,arm,apply,admission,raw,cut,suppress,status,abandon,holdInput,evidence} from './support/helpers.js';
import type {Fixture} from './support/postgres-fixture.js';
import {prepareOutput} from '../src/application/prepare-operation.js';
import {armAttempt} from '../src/application/dispatch-once.js';
import {restoreInert} from '../src/application/restore-inert.js';
import {digest,text,object} from '../src/domain/protocol.js';
import type {ObjectValue,Json} from '../src/domain/protocol.js';
import type {Seal} from '../src/ports.js';
const b='synthetic-a';
async function gate(f:Fixture,p:Seal,o:string,at:unknown=f.clock.now().toISOString()):Promise<boolean> {
 return f.role('dispatch').tx(b,async db=>(await db.query<{v:boolean}>('SELECT core.enter_submission($1,$2,$3,$4) v',[b,p.body['attemptId'],o,at])).rows[0]!.v);
}
async function unprepared(f:Fixture):Promise<ObjectValue> {
 await assert.rejects(plan(f,{},cut('prepare.afterArchive')),/injected/);
 return structuredClone((await f.archive.records()).find(r=>r.kind==='OPERATION_PLAN')!.body);
}
async function prepareBad(f:Fixture,p:ObjectValue):Promise<void> {
 const s=await f.archive.ensure('attack/'+randomUUID(),'OPERATION_PLAN',p);await f.role('sealer').seal(b,f.archive,s);
 await f.role('reducer').tx(b,db=>db.query('SELECT core.prepare_operation($1,$2,$3,$4)',[b,p,s.digest,s.key]));
}

test('R002: sealed batch rejects extension, wrong manifest/count, missing/extra membership and NULL item fields',async t=>{
 const f=await fixture(t),a=await admission(f),batch=(await f.rows('batch'))[0]!,item=a.inputs[0]!;
 const extra={...item,inputId:randomUUID(),providerId:'unarchived-extra'};
 await assert.rejects(f.role('ingress').tx(b,db=>db.query('SELECT core.stage_batch($1,$2,$3,$4)',[b,batch['id'],batch['digest'],JSON.stringify([item,extra])])));
 await assert.rejects(f.admin.query('INSERT INTO core.batch_input VALUES($1,$2,$3)',[b,batch['id'],randomUUID()]),/sealed_membership/);
 await assert.rejects(f.admin.query('DELETE FROM core.batch_input WHERE business_id=$1',[b]),/sealed_membership/);
 assert.equal((await f.rows('input')).length,1);
 const stagedRaw=raw(f);await assert.rejects(admission(f,stagedRaw,cut('A2.afterCommit')));
 const staged=(await f.rows('batch')).find(x=>x['state']==='STAGED')!,items=staged['items'] as ObjectValue[];
 for(const changes of [{count:2},{membershipDigest:'0'.repeat(64)},{count:null},{membershipDigest:null}]) {
  const s=await f.archive.ensure('bad-members/'+randomUUID(),'BATCH_COMMIT',{businessId:b,batchId:staged['id']!,batchDigest:staged['digest']!,membershipDigest:digest(items),count:items.length,...changes});
  await f.role('sealer').seal(b,f.archive,s);
  await assert.rejects(f.role('ingress').tx(b,db=>db.query('SELECT core.activate_batch($1,$2,$3,$4)',[b,staged['id'],s.key,s.digest])),/unsealed_batch/);
 }
 const good=await f.archive.ensure('exact-members','BATCH_COMMIT',{businessId:b,batchId:staged['id']!,batchDigest:staged['digest']!,membershipDigest:digest(items),count:items.length});await f.role('sealer').seal(b,f.archive,good);
 // Privileged fixture corruption before activation: SQL must re-check stored links.
 await f.admin.query('DELETE FROM core.batch_input WHERE business_id=$1 AND batch_id=$2',[b,staged['id']]);
 await assert.rejects(f.role('ingress').tx(b,db=>db.query('SELECT core.activate_batch($1,$2,$3,$4)',[b,staged['id'],good.key,good.digest])),/unsealed_batch/);
 await f.admin.query('INSERT INTO core.batch_input VALUES($1,$2,$3)',[b,staged['id'],items[0]!['inputId']]);
 await f.admin.query('INSERT INTO core.batch_input VALUES($1,$2,$3)',[b,staged['id'],item['inputId']]);
 await assert.rejects(f.role('ingress').tx(b,db=>db.query('SELECT core.activate_batch($1,$2,$3,$4)',[b,staged['id'],good.key,good.digest])),/unsealed_batch/);
 for(const field of ['inputId','channelRevision','waba','numberId','digest','event','subject','conversationId','receivedAt']) {
  const malformed={...extra,[field]:null};await assert.rejects(f.role('ingress').tx(b,db=>db.query('SELECT core.stage_batch($1,$2,$3,$4)',[b,randomUUID(),digest([malformed]),JSON.stringify([malformed])])));
 }
 await evidence('R002',{inputs:await f.rows('input'),batches:await f.rows('batch'),unarchivedEligible:false});
});

test('R003/R012: NULL, infinities and wrong caller clocks never authorize submission or future grants',async t=>{
 const f=await fixture(t),p=await plan(f),o=await arm(f,p),results:ObjectValue[]=[];
 for(const at of [null,'infinity','-infinity','2030-01-01T12:00:00Z','2020-01-01T00:00:00Z']) {
  try{assert.equal(await gate(f,p,o,at),false);results.push({at,result:false});}catch(error){assert.match(String(error),/null_argument/);results.push({at,error:String(error)});}
 }
 assert.equal((await f.rows('attempt'))[0]!['state'],'ARMED');
 const occurredAt='2031-06-01T00:00:00Z',evidenceId=randomUUID(),s=await f.archive.ensure('future-grant','GRANT',{businessId:b,subject:'customer-'+b,evidenceId,expected:0,occurredAt});await f.role('sealer').seal(b,f.archive,s);
 for(const now of [null,'infinity','-infinity',occurredAt,f.clock.now().toISOString()])await assert.rejects(f.role('operator').tx(b,db=>db.query('SELECT core.grant_permission($1,$2,$3,$4,$5,$6,$7,$8)',[b,'customer-'+b,evidenceId,s.digest,0,occurredAt,now,s.key])));
 assert.equal((await f.rows('permission_event')).length,0);
 f.clock.instant+=16*60000;assert.equal(await gate(f,p,o),false);assert.equal((await f.rows('attempt'))[0]!['state'],'ARMED');
 await evidence('R003-R012',{results,attempts:await f.rows('attempt'),grants:await f.rows('permission_event')});
});

test('R006: operation envelope and digests must match the protected authoritative plan and input',async t=>{
 const f=await fixture(t),base=await unprepared(f),results:ObjectValue[]=[];
 const mutations:Record<string,(p:ObjectValue,e:ObjectValue)=>void>={
  payload:(p,e)=>{e['payload']={kind:'CREATE'};e['payloadDigest']=p['payloadDigest']=digest(e['payload']);},
  digest:(p,e)=>{p['payloadDigest']=e['payloadDigest']='0'.repeat(64);},
  recipient:(_p,e)=>{e['recipient']='another-subject';},channel:(_p,e)=>{e['channelId']=f.id('channel','synthetic-b');},
  calendar:(_p,e)=>{e['calendarId']=f.id('calendar','synthetic-b');},conversation:(_p,e)=>{e['conversationId']=randomUUID();},
  event:(_p,e)=>{e['remoteId']='other-event';},purpose:(_p,e)=>{e['purpose']='REMINDER';},
  due:(_p,e)=>{e['dueAt']='2030-01-01T08:00:00Z';},deadline:(_p,e)=>{e['deadlineAt']='2030-01-01T12:00:00Z';},window:(_p,e)=>{e['windowEnd']='2031-01-01T00:00:00Z';},
  outputDigest:p=>{p['outputDigest']='0'.repeat(64);}
 };
 for(const key of ['startAt','endAt','resourceId','eventId','calendarId','appointmentId','customerId','businessId','bufferMinutes','kind'])mutations['payload.'+key]=(p,e)=>{const payload=object(e['payload']);payload[key]=key==='bufferMinutes'?99:'wrong';e['payloadDigest']=p['payloadDigest']=digest(payload);};
 for(const key of ['businessId','inputId','channelId','customerId','calendarId','resourceId','kind','appointmentId','eventId','expectedRevision','startAt','endAt','bufferMinutes','operationId','attemptId','outputId','payloadDigest','outputPayload','outputDigest','outputPurpose','outputDueAt','outputDeadlineAt','envelope'])mutations['null.'+key]=p=>{p[key]=null;};
 for(const key of ['recipient','channelId','calendarId','conversationId','purpose','dueAt','deadlineAt','windowEnd','payload','permissionRevision','businessRevision','recoveryEpoch','attemptId'])mutations['envelope.null.'+key]=(_p,e)=>{e[key]=null;};
 for(const [field,mutate] of Object.entries(mutations)) {const p=structuredClone(base);mutate(p,object(p['envelope']));await assert.rejects(prepareBad(f,p),field);results.push({field,denied:true});}
 assert.equal((await f.rows('operation')).length,0);assert.equal((await f.rows('protection')).length,0);
 await evidence('R006',{results,operations:await f.rows('operation'),protections:await f.rows('protection')});
});

test('R004/R006: output row purpose, payload and complete context defeat false CUSTOMER_REQUEST after STOP',async t=>{
 const f=await fixture(t),p=await plan(f,{outputPurpose:'REMINDER'});await apply(t,f,p);await suppress(f);
 const out=await prepareOutput({businessId:b,outputId:text(p.body['outputId']),reducer:f.role('reducer'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock});
 // Remove only the never-armed fixture attempt to expose preparation validation;
 // retaining it would make output-conflict a false positive for this test.
 await f.admin.query('DELETE FROM core.attempt WHERE id=$1',[out.body['attemptId']]);
 const results:ObjectValue[]=[];
 for(const field of ['outputId','purpose','recipient','conversationId','channelId','calendarId','dueAt','deadlineAt','windowEnd','permissionRevision','channelRevision','calendarRevision','grantId','waba','numberId','payload','payloadDigest','remoteId','attemptId'])for(const nul of [false,true]) {
  const e=structuredClone(object(out.body['envelope']));
  e[field]=nul?null:field==='purpose'?'CUSTOMER_REQUEST':field.endsWith('Revision')?999:field==='payload'?{wrong:1}:field.endsWith('Id')?randomUUID():field.endsWith('At')||field==='windowEnd'?'2030-01-01T12:00:00Z':'wrong';
  const s=await f.archive.ensure('bad-out/'+randomUUID(),'OUTPUT_PLAN',{businessId:b,outputId:p.body['outputId']!,attemptId:out.body['attemptId']!,envelope:e});await f.role('sealer').seal(b,f.archive,s);
  await assert.rejects(f.role('reducer').tx(b,db=>db.query('SELECT core.prepare_output($1,$2,$3,$4,$5,$6,$7)',[b,p.body['outputId'],out.body['attemptId'],e,out.body['payloadDigest'],s.key,s.digest])));
  results.push({field,null:nul,denied:true});
 }
 // Correct reminder still prepares, but final row-derived consent denies it.
 const e=object(out.body['envelope']);await f.role('reducer').tx(b,db=>db.query('SELECT core.prepare_output($1,$2,$3,$4,$5,$6,$7)',[b,p.body['outputId'],out.body['attemptId'],e,e['payloadDigest'],out.key,out.digest]));
 assert.equal(await gate(f,out,await arm(f,out)),false);
 await evidence('R004',{results,outputs:await f.rows('output_intent'),permissions:await f.rows('permission_head'),attempts:await f.rows('attempt')});
});

for(const earlier of ['STAGED','PREPARED','SUBMISSION_ENTERED','UNKNOWN'] as const)test('R007: earlier '+earlier+' command blocks later conversation execution',async t=>{
 const f=await fixture(t);let first:Seal|undefined;
 if(earlier==='STAGED')await assert.rejects(admission(f,raw(f),cut('A2.afterCommit')));
 else {first=await plan(f);if(earlier!=='PREPARED'){const owner=await arm(f,first);assert.equal(await gate(f,first,owner),true);if(earlier==='UNKNOWN')await f.role('dispatch').tx(b,db=>db.query('SELECT core.mark_unknown($1,$2)',[b,first!.body['attemptId']]));}}
 const next=await plan(f,{startAt:'2030-01-03T10:00:00Z',endAt:'2030-01-03T11:00:00Z'}),owner=await arm(f,next);
 assert.equal(await gate(f,next,owner),false);assert.equal((await f.rows('output_intent')).length,0);
 await evidence('R007-'+earlier,{attempts:await f.rows('attempt'),inputs:await f.rows('input'),outputs:await f.rows('output_intent'),laterEntered:false});
});

test('R008: post-snapshot suspension and lost archive restore SUSPENDED with dispatch disabled',async t=>{
 const f=await fixture(t),snapshot=await f.snapshot();await status(f,'SUSPENDED',1);
 assert((await f.archive.records()).some(s=>s.kind==='SUSPEND'));
 const target=await fixture(t,false);await target.role('recovery').tx('',db=>db.query('SELECT core.restore_snapshot($1,$2,$3)',[snapshot,'[]', 'tail unavailable']));
 for(const row of await target.rows('business')){assert.equal(row['status'],'SUSPENDED');assert.equal(row['dispatch_enabled'],false);assert.equal(row['recovery_epoch'],'2');assert.equal(row['revision'],'2');}
 const target2=await fixture(t,false);await restoreInert({snapshot,recovery:target2.role('recovery'),archive:f.archive});assert.equal((await target2.rows('business'))[0]!['status'],'SUSPENDED');
 await evidence('R008',{withoutTail:await target.rows('business'),withTail:await target2.rows('business'),cases:await target2.rows('recovery_case')});
});

test('R005: signed mixed-tenant STOP partitions durably, a failing tenant never rolls it back and ACK waits for all',async t=>{
 const f=await fixture(t);const a=JSON.parse(raw(f,'STOP').toString()) as {entry:Json[]},bb=JSON.parse(raw(f,'synthetic fixed command','synthetic-b').toString()) as {entry:Json[]};
 const mixed=Buffer.from(JSON.stringify({entry:[...a.entry,...bb.entry]}));
 // Break B only after authenticated parsing; A must still commit its STOP and input.
 await f.admin.query("UPDATE core.channel SET revision=2 WHERE business_id='synthetic-b'");
 await assert.rejects(admission(f,mixed),/channel_denied/);
 assert.equal((await f.rows('permission_head'))[0]!['suppressed'],true);assert.equal((await f.rows('input'))[0]!['state'],'ELIGIBLE');assert.equal((await f.rows('input','synthetic-b')).length,0);
 await f.admin.query("UPDATE core.channel SET revision=1 WHERE business_id='synthetic-b'");
 const admitted=await admission(f,mixed);assert.equal(admitted.acknowledged,true);assert.equal(admitted.inputs.length,2);assert.equal((await f.rows('input','synthetic-b'))[0]!['state'],'ELIGIBLE');
 assert.equal((await f.rows('permission_head','synthetic-b')).length,0);
 const records=await f.archive.records(),root=records.find(r=>r.kind==='RAW_BATCH')!;
 assert.equal(Buffer.from(text(root.body['rawBase64']),'base64').equals(mixed),true);
 for(const part of records.filter(r=>r.kind==='BATCH_PREPARE')){assert.equal(part.body['rawBatchKey'],root.key);assert.equal(part.body['rawBatchDigest'],root.digest);}
 await evidence('R005',{a:await f.rows('input'),b:await f.rows('input','synthetic-b'),permissions:await f.rows('permission_head'),acknowledged:admitted.acknowledged});
});

for(const state of ['PREPARED','ARMED'] as const)test('R010: sealed abandonment of never-entered '+state+' releases slot and head without rearming old work',async t=>{
 const f=await fixture(t),p=await plan(f);if(state==='ARMED')await arm(f,p);
 await status(f,'SUSPENDED',1);await status(f,'ACTIVE',2);
 await abandon(f,text(p.body['attemptId']));assert.equal((await f.rows('attempt'))[0]!['state'],'ABANDONED');
 assert.equal((await f.rows('mutation_guard')).length,0);assert.equal((await f.rows('protection')).length,0);assert.equal((await f.rows('appointment'))[0]!['state'],'CANCELLED');
 assert.equal(await armAttempt({businessId:b,attemptId:text(p.body['attemptId']),ownerId:randomUUID(),dispatcher:f.role('dispatch'),sealer:f.role('sealer'),archive:f.archive}),false);
 const next=await plan(f);await apply(t,f,next);assert.equal((await f.rows('attempt')).find(a=>a['id']===next.body['attemptId'])!['state'],'VERIFIED_APPLIED');
 assert((await f.rows('audit')).some(a=>a['action']==='ABANDON_UNSENT'));
 await evidence('R010-'+state,{attempts:await f.rows('attempt'),audit:await f.rows('audit'),protections:await f.rows('protection')});
});

test('R010: UNKNOWN/entered cannot be abandoned; rollback cannot release any protection',async t=>{
 const f=await fixture(t),p=await plan(f),owner=await arm(f,p);assert.equal(await gate(f,p,owner),true);
 const before=await f.rows('protection');await assert.rejects(abandon(f,text(p.body['attemptId'])),/possibly_submitted_abandon_denied/);
 await f.role('dispatch').tx(b,db=>db.query('SELECT core.mark_unknown($1,$2)',[b,p.body['attemptId']]));
 await assert.rejects(abandon(f,text(p.body['attemptId'])),/possibly_submitted_abandon_denied/);assert.deepEqual(await f.rows('protection'),before);assert.equal((await f.rows('mutation_guard')).length,1);
});

test('R007/R010: sealed input hold resolves a poison head and permanently denies future operation preparation',async t=>{
 const f=await fixture(t),a=await admission(f,raw(f,'unsupported synthetic command'));
 const p=await plan(f),o=await arm(f,p);assert.equal(await gate(f,p,o),false);
 await holdInput(f,text(a.inputs[0]!['inputId']));assert.equal(await gate(f,p,o),true);
 await assert.rejects(plan(f,{inputId:text(a.inputs[0]!['inputId'])}),/input_not_eligible/);
});

test('R009/R014/R015: forged digest, crossed privileges, conflicting status replay and direct evidence DML are refused',async t=>{
 const f=await fixture(t),d='0'.repeat(64),r={key:'forged',kind:'RESULT',digest:d,body:{anything:1}};
 await assert.rejects(f.role('sealer').tx(b,db=>db.query('SELECT core.register_seal($1,$2,$3,$4,$5)',[b,r.key,r.kind,d,r])),/malformed_seal/);
 await assert.rejects(f.role('dispatch').tx(b,db=>db.query('SELECT core.register_seal($1,$2,$3,$4,$5)',[b,r.key,r.kind,d,r])),/permission denied/);
 await assert.rejects(f.role('sealer').tx(b,db=>db.query('SELECT core.enter_submission($1,$2,$3,$4)',[b,randomUUID(),randomUUID(),f.clock.now().toISOString()])),/permission denied/);
 await assert.rejects(f.role('dispatch').tx(b,db=>db.query("UPDATE fixture_private.clock SET at_time='2090-01-01'")),/permission denied/);
 await assert.rejects(f.role('dispatch').tx(b,db=>db.query("CREATE OR REPLACE FUNCTION core.authoritative_time() RETURNS timestamptz LANGUAGE sql AS 'SELECT clock_timestamp()'")),/permission denied|must be owner/);
 const e=randomUUID();await f.role('operator').tx(b,db=>db.query('SELECT core.set_status($1,$2,$3,$4,$5,$6)',[b,'SUSPENDED',e,'digest',1,'']));
 await assert.rejects(f.role('operator').tx(b,db=>db.query('SELECT core.set_status($1,$2,$3,$4,$5,$6)',[b,'ACTIVE',e,'digest',1,''])),/status_conflict/);
 for(const [table,column] of [['status_event','digest'],['audit','evidence']])await assert.rejects(f.admin.query(`UPDATE core.${table} SET ${column}='tampered'`),/append_only_record/);
 await assert.rejects(f.admin.query('DELETE FROM core.status_event'),/append_only_record/);
 await evidence('R009-R014-R015',{status:await f.rows('business'),events:await f.rows('status_event'),seals:await f.rows('seal')});
});

test('R003/R012/SEC: every exposed mutating SQL argument rejects NULL before any state change',async t=>{
 const f=await fixture(t),roles=['ingress','sealer','reducer','dispatch','result','operator','recovery'];
 const functions=(await f.admin.query(`SELECT p.proname,p.proargnames,array(SELECT format_type(x,NULL) FROM unnest(p.proargtypes) x) types,
 array(SELECT r FROM unnest($1::text[]) r WHERE has_function_privilege('wp1_'||r,p.oid,'EXECUTE')) roles
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='core' AND p.proname<>'scope_allowed'
 AND EXISTS(SELECT 1 FROM unnest($1::text[]) r WHERE has_function_privilege('wp1_'||r,p.oid,'EXECUTE'))`,[roles])).rows as {proname:string;proargnames:string[];types:string[];roles:string[]}[];
 const before=await f.snapshot(),results:ObjectValue[]=[];
 for(const fn of functions)for(let pos=0;pos<fn.types.length;pos++) {
  const args=fn.types.map(type=>type==='uuid'?randomUUID():type==='jsonb'?'{}':type==='bigint'?1:type==='timestamp with time zone'?f.clock.now().toISOString():b);args[pos]=null as unknown as string;
  await assert.rejects(f.role(fn.roles[0]!).tx(b,db=>db.query(`SELECT core.${fn.proname}(${fn.types.map((_,i)=>'$'+(i+1)).join(',')})`,args)),/null_argument/,fn.proname+':'+fn.proargnames[pos]);
  results.push({function:fn.proname,argument:fn.proargnames[pos]!,denied:true});
 }
 for(const fn of functions)for(let pos=0;pos<fn.types.length;pos++) {
  const type=fn.types[pos]!,variants=type==='uuid'?['00000000-0000-0000-0000-000000000000']:type==='timestamp with time zone'?['infinity','-infinity']:type==='bigint'?[0,-1]:type==='jsonb'?['null','[]','false']:[''];
  for(const malformed of variants){
   const args:unknown[]=fn.types.map(t=>t==='uuid'?randomUUID():t==='jsonb'?'{}':t==='bigint'?1:t==='timestamp with time zone'?f.clock.now().toISOString():b);args[pos]=malformed;
   let outcome='no_effect';try{await f.role(fn.roles[0]!).tx(b,db=>db.query(`SELECT core.${fn.proname}(${fn.types.map((_,i)=>'$'+(i+1)).join(',')})`,args));}catch{outcome='denied';}
   assert.deepEqual(await f.snapshot(),before,fn.proname+':'+fn.proargnames[pos]);results.push({function:fn.proname,argument:fn.proargnames[pos]!,value:malformed,outcome});
  }
 }
 assert.deepEqual(await f.snapshot(),before);assert(functions.length>=15);await evidence('R-NULL-privileged-matrix',{functions:functions.length,cases:results.length,results,stateUnchanged:true});
});

test('R010: abandoning an unsubmitted MOVE restores source protection exactly and retains source identity',async t=>{
 const f=await fixture(t),p=await plan(f,{bufferMinutes:15});await apply(t,f,p);const before=await f.rows('protection');
 const move=await plan(f,{kind:'MOVE',appointmentId:text(p.body['appointmentId']),eventId:text(p.body['eventId']),expectedRevision:2,startAt:'2030-01-02T12:00:00Z',endAt:'2030-01-02T13:00:00Z',bufferMinutes:15});await arm(f,move);
 await abandon(f,text(move.body['attemptId']));assert.deepEqual(await f.rows('protection'),before);
 assert.equal((await f.rows('appointment'))[0]!['event_id'],p.body['eventId']);assert.equal((await f.rows('appointment'))[0]!['state'],'ACTIVE');
});

test('R005: archive outage after mixed-business STOPs leaves both SQL withdrawals durable',async t=>{
 let fail=false;const f=await fixture(t,true,{async hit(point){if(fail&&point==='archive.beforePut')throw new Error('archive_offline');}});
 const a=JSON.parse(raw(f,'STOP').toString()) as {entry:Json[]},bb=JSON.parse(raw(f,'STOP','synthetic-b').toString()) as {entry:Json[]};fail=true;
 await assert.rejects(admission(f,Buffer.from(JSON.stringify({entry:[...a.entry,...bb.entry]}))),/archive_offline/);
 for(const business of [b,'synthetic-b'])assert.equal((await f.rows('permission_head',business))[0]!['suppressed'],true);
 assert.equal((await f.rows('input')).length,0);
});

test('R015: all eight evidence tables reject owner payload UPDATE and DELETE even with valid RLS scope',async t=>{
 const f=await fixture(t),p=await plan(f);await apply(t,f,p);await suppress(f);await status(f,'SUSPENDED',1);
 const input=(await f.rows('input'))[0]!;
 await f.admin.query('INSERT INTO core.receipt VALUES($1,$2,NULL,$3,$4,false)',[b,input['id'],'synthetic-orphan','sent']);
 // SET ROLE retains session_user=postgres. Explicit fixture-only scope grants
 // let the owner reach the trigger instead of passing via an earlier RLS error.
 await f.admin.query('INSERT INTO core.role_scope VALUES($1,$2)',['postgres',b]);
 await f.admin.query('GRANT EXECUTE ON FUNCTION core.scope_allowed(text) TO wp1_owner');
 const targets:Record<string,string>={input:"event='{}'",output_intent:"payload='{}'",permission_event:"digest='tamper'",status_event:"digest='tamper'",receipt:"message_id='tamper'",audit:"evidence='tamper'",operation:"plan='{}'",seal:"receipt='{}'"};
 const before=await f.snapshot();
 for(const [table,set] of Object.entries(targets))for(const sql of [`UPDATE core.${table} SET ${set}`,`DELETE FROM core.${table}`]) {
  const db=await f.admin.connect();try{await db.query('BEGIN');await db.query('SET LOCAL ROLE wp1_owner');await db.query("SELECT set_config('wp1.business_id',$1,true)",[b]);await assert.rejects(db.query(sql),/append_only_record|immutable_record/);}finally{await db.query('ROLLBACK');db.release();}
 }
 assert.deepEqual(await f.snapshot(),before);
});

test('R009: SQL/TypeScript canonical digests agree for nested Unicode, escapes, arrays and safe integers',async t=>{
 const f=await fixture(t);
 for(const body of [{z:[null,true,false,0,-1,9007199254740991],a:{'é':'línea\n"\\','\u{1f600}':'x','\ue000':'y'}},{value:-0}]) {
  const r=(await f.admin.query<{d:string}>('SELECT core.json_digest($1) d',[body])).rows[0]!;assert.equal(r.d,digest(body));
 }
 await assert.rejects(f.admin.query("SELECT core.json_digest('{\"value\":1.5}')"),/unsupported_json_number/);
 await assert.rejects(f.admin.query("SELECT core.json_digest('{\"value\":9007199254740992}')"),/unsupported_json_number/);
});

test('R010-ATOMIC: an abandonment transaction failure restores attempt, appointment, guard, protection and audit together',async t=>{
 const f=await fixture(t),p=await plan(f),a=(await f.rows('attempt'))[0]!;
 const s=await f.archive.ensure('abandon-rollback','ABANDON',{businessId:b,attemptId:p.body['attemptId']!,payloadDigest:a['payload_digest']!,reason:'Reviewed never submitted'});await f.role('sealer').seal(b,f.archive,s);
 const before=await f.snapshot();
 await assert.rejects(f.role('operator').tx(b,db=>db.query('SELECT core.abandon_unsent($1,$2,$3,$4)',[b,p.body['attemptId'],s.key,s.digest]),'abandon',cut('abandon.beforeCommit')),/injected/);
 assert.deepEqual(await f.snapshot(),before);
 const run=()=>f.role('operator').tx(b,async db=>(await db.query<{v:boolean}>('SELECT core.abandon_unsent($1,$2,$3,$4) v',[b,p.body['attemptId'],s.key,s.digest])).rows[0]!.v);
 assert.equal(await run(),true);assert.equal(await run(),false);assert.equal((await f.rows('audit')).filter(a=>a['action']==='ABANDON_UNSENT').length,1);
});
