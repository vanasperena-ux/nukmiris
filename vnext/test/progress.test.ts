import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,plan,provider,arm,admission,raw,cut,evidence} from './support/helpers.js';
import {prepareOutput} from '../src/application/prepare-operation.js';
import {armAttempt,dispatchOnce} from '../src/application/dispatch-once.js';
import {recordResult} from '../src/application/record-result.js';
import {PlanInvalidError,PlanConflictError} from '../src/application/plan-conflict.js';
import {tenantBindings} from '../src/domain/tenant.js';
import {text,object} from '../src/domain/protocol.js';
import {worker} from './support/process-driver.js';
import type {Fixture} from './support/postgres-fixture.js';
import type {Seal} from '../src/ports.js';

async function target(t:Parameters<typeof fixture>[0],kind:string){
 const f=await fixture(t),p=await plan(f),fake=await provider(t,f);let attempt=p;
 const send=async(s:Seal,ownerId?:string)=>dispatchOnce({businessId:'synthetic-a',attemptId:text(s.body['attemptId']),ownerId:ownerId??await arm(f,s),dispatcher:f.role('dispatch'),archive:f.archive,provider:fake.client,clock:f.clock});
 if(kind!=='booking'){const result=await send(p);assert.equal(result.state,'APPLIED');if(result.state==='APPLIED')await recordResult({proof:result.proof,result:f.role('result'),sealer:f.role('sealer'),archive:f.archive});if(kind==='confirmation')attempt=await prepareOutput({businessId:'synthetic-a',outputId:text(p.body['outputId']),reducer:f.role('reducer'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock});}
 return {f,p,attempt,send,...fake};
}
async function next(f:Fixture,priority:string){if(priority==='humano')await admission(f,raw(f,'Menu'));return plan(f,{startAt:'2030-01-03T10:00:00Z',endAt:'2030-01-03T11:00:00Z'});}
for(const priority of ['menu','humano'])for(const kind of ['booking','confirmation'])for(const stage of ['PREPARED','ARMED'])test(`C1 ${priority} supersedes ${stage} ${kind} without an operator; next booking progresses`,async t=>{
 const s=await target(t,kind),id=text(s.attempt.body['attemptId']),ownerId=stage==='ARMED'?await arm(s.f,s.attempt):randomUUID(),before=(await s.server.calls()).length;
 await admission(s.f,raw(s.f,priority));assert.equal((await s.f.rows('attempt')).find(a=>a['id']===id)?.['state'],'ABANDONED');
 assert.equal(await armAttempt({businessId:'synthetic-a',attemptId:id,ownerId,dispatcher:s.f.role('dispatch'),sealer:s.f.role('sealer'),archive:s.f.archive}),false);
 assert.equal((await s.send(s.attempt,ownerId)).state,'HELD');assert.equal((await s.server.calls()).length,before);assert.equal((await s.f.rows('mutation_guard')).length,0);
 if(kind==='booking'){assert.equal((await s.f.rows('appointment'))[0]!['state'],'CANCELLED');assert.equal((await s.f.rows('protection')).length,0);}else{assert.equal((await s.f.rows('appointment'))[0]!['state'],'ACTIVE');assert.equal((await s.f.rows('output_intent'))[0]!['state'],'EXPIRED');assert.equal((await s.f.rows('protection')).length,1);}
 await next(s.f,priority);assert.equal((await s.f.rows('operation')).length,2);assert.equal((await s.server.calls()).length,before);
});
for(const kind of ['booking','confirmation'])for(const state of ['SUBMISSION_ENTERED','UNKNOWN'])for(const priority of ['menu','humano'])test(`C1 ${priority} never releases ${state} ${kind}`,async t=>{
 const s=await target(t,kind),id=text(s.attempt.body['attemptId']),ownerId=await arm(s.f,s.attempt),args={businessId:'synthetic-a',attemptId:id,ownerId,dispatcher:s.f.role('dispatch'),archive:s.f.archive,provider:s.client,clock:s.f.clock};
 if(state==='SUBMISSION_ENTERED')await assert.rejects(dispatchOnce({...args,faults:cut('dispatch.afterGate')}));else{s.server.loseResponse=true;assert.equal((await dispatchOnce(args)).state,'UNKNOWN');}
 const protection=await s.f.rows('protection'),guards=await s.f.rows('mutation_guard');await admission(s.f,raw(s.f,priority));
 assert.equal((await s.f.rows('attempt')).find(a=>a['id']===id)?.['state'],state);assert.deepEqual(await s.f.rows('protection'),protection);assert.deepEqual(await s.f.rows('mutation_guard'),guards);
 if(priority==='humano')await admission(s.f,raw(s.f,'menu'));await assert.rejects(plan(s.f,{startAt:'2030-01-03T10:00:00Z',endAt:'2030-01-03T11:00:00Z'}),/conversation_head_held/);
 s.f.clock.instant+=3600000;if(kind==='confirmation')assert.equal((await s.f.role('dispatch').tx('synthetic-a',db=>db.query<{v:boolean}>('SELECT core.expire_unsent($1,$2,$3) v',['synthetic-a',s.p.body['outputId'],s.f.clock.now().toISOString()]))).rows[0]!.v,false);
});
for(const point of ['reduce.beforeCommit','reduce.afterCommit'])test('C1 priority crash cut '+point+' reuses sealed supersession and original identities',async t=>{
 const s=await target(t,'booking'),id=text(s.attempt.body['attemptId']);await arm(s.f,s.attempt);const body=raw(s.f,'menu');
 await assert.rejects(admission(s.f,body,cut(point)));assert.equal((await s.f.rows('attempt'))[0]!['state'],point.endsWith('beforeCommit')?'ARMED':'ABANDONED');
 await admission(s.f,body);await admission(s.f,body);assert.equal((await s.f.rows('attempt'))[0]!['id'],id);assert.equal((await s.f.rows('attempt'))[0]!['state'],'ABANDONED');
 assert.equal((await s.f.rows('audit')).filter(x=>x['action']==='ABANDON_UNSENT').length,1);assert.equal((await s.f.archive.records()).filter(x=>x.kind==='ABANDON').length,1);await next(s.f,'menu');assert.equal((await s.server.calls()).length,0);
});
test('C1 superseding a never-entered MOVE restores source protection, appointment history and frees only its target',async t=>{
 const s=await target(t,'confirmation');assert.equal((await s.send(s.attempt)).state,'APPLIED');
 // Finish the confirmation before a move can become head.
 const proof=await s.client.readOnly(object(s.attempt.body['envelope']) as never);assert.ok(proof);await recordResult({proof,result:s.f.role('result'),sealer:s.f.role('sealer'),archive:s.f.archive});
 const before=(await s.f.rows('appointment'))[0]!,move=await plan(s.f,{kind:'MOVE',appointmentId:text(s.p.body['appointmentId']),eventId:text(s.p.body['eventId']),expectedRevision:2,startAt:'2030-01-04T10:00:00Z',endAt:'2030-01-04T11:00:00Z'});await arm(s.f,move);await admission(s.f,raw(s.f,'menu'));
 const after=(await s.f.rows('appointment'))[0]!;assert.equal(after['start_at'],before['start_at']);assert.equal(after['state'],'ACTIVE');const held=await s.f.rows('protection');assert.equal(held.length,1);assert.equal(held[0]!['operation_id'],s.p.body['operationId']);assert.equal((await s.f.rows('mutation_guard')).length,0);
 await next(s.f,'menu');
});
for(const stage of ['PREPARED','ARMED','NONE'])test(`C1 normal deadline expiry closes ${stage} confirmation and cannot be rearmed`,async t=>{
 const s=await target(t,stage==='NONE'?'unprepared-confirmation':'confirmation');if(stage==='ARMED')await arm(s.f,s.attempt);
 s.f.clock.instant+=3600000;const expire=()=>s.f.role('dispatch').tx('synthetic-a',db=>db.query<{v:boolean}>('SELECT core.expire_unsent($1,$2,$3) v',['synthetic-a',s.p.body['outputId'],s.f.clock.now().toISOString()]));
 assert.equal((await expire()).rows[0]!.v,true);assert.equal((await expire()).rows[0]!.v,false);assert.equal((await s.f.rows('output_intent'))[0]!['state'],'EXPIRED');
 if(stage!=='NONE')assert.equal((await s.f.rows('attempt')).find(a=>a['id']===s.attempt.body['attemptId'])?.['state'],'ABANDONED');await next(s.f,'menu');assert.equal((await s.server.calls()).length,1);
});
function latch(){let release!:()=>void;const wait=new Promise<void>(r=>{release=r;});return {wait,release};}
test('C1 failed machine custody rolls back the priority context and all dispositions until original-key recovery',async t=>{
 const s=await target(t,'booking');await arm(s.f,s.attempt);const original=s.f.archive.ensure.bind(s.f.archive),body=raw(s.f,'menu');s.f.archive.ensure=async(...args)=>{if(args[1]==='ABANDON')throw new Error('supersession_custody_outage');return original(...args);};
 try{await assert.rejects(admission(s.f,body));}finally{s.f.archive.ensure=original;}
 assert.equal((await s.f.rows('attempt'))[0]!['state'],'ARMED');assert.equal((await s.f.rows('conversation_context')).length,0);assert.equal((await s.f.rows('mutation_guard')).length,1);
 await admission(s.f,body);assert.equal((await s.f.rows('attempt'))[0]!['state'],'ABANDONED');await next(s.f,'menu');assert.equal((await s.server.calls()).length,0);
});
for(const first of ['priority','entry'])test(`C1 concurrent ${first} wins the conversation lock; supersession and entry cannot both succeed`,async t=>{
 const s=await target(t,'booking'),id=text(s.attempt.body['attemptId']),ownerId=await arm(s.f,s.attempt),reached=latch(),resume=latch();
 const sendArgs={businessId:'synthetic-a',attemptId:id,ownerId,dispatcher:s.f.role('dispatch'),archive:s.f.archive,provider:s.client,clock:s.f.clock};
 let other:Promise<unknown>,winner:Promise<unknown>;
 if(first==='priority'){
  winner=admission(s.f,raw(s.f,'menu'),{async hit(p){if(p==='reduce.beforeCommit'){reached.release();await resume.wait;}}});await reached.wait;other=dispatchOnce(sendArgs);resume.release();await winner;assert.equal((await other as {state:string}).state,'HELD');assert.equal((await s.f.rows('attempt'))[0]!['state'],'ABANDONED');assert.equal((await s.server.calls()).length,0);
 }else{
  winner=dispatchOnce({...sendArgs,faults:{async hit(p){if(p==='entry.beforeCommit'){reached.release();await resume.wait;}}}});await reached.wait;other=admission(s.f,raw(s.f,'menu'));resume.release();const result=await winner as {state:string};await other;assert.equal(result.state,'APPLIED');assert.equal((await s.f.rows('attempt'))[0]!['state'],'SUBMISSION_ENTERED');assert.equal((await s.f.rows('mutation_guard')).length,1);assert.equal((await s.server.calls()).length,1);
 }
});
for(const first of ['expiry','entry'])test(`C1 ${first} vs confirmation expiry/entry CAS`,async t=>{
 const s=await target(t,'confirmation'),id=text(s.attempt.body['attemptId']),ownerId=await arm(s.f,s.attempt);
 const enter=()=>s.f.role('dispatch').tx('synthetic-a',db=>db.query<{v:boolean}>('SELECT core.enter_submission($1,$2,$3,$4) v',['synthetic-a',id,ownerId,s.f.clock.now().toISOString()]));
 if(first==='entry')assert.equal((await enter()).rows[0]!.v,true);s.f.clock.instant+=3600000;
 const expired=(await s.f.role('dispatch').tx('synthetic-a',db=>db.query<{v:boolean}>('SELECT core.expire_unsent($1,$2,$3) v',['synthetic-a',s.p.body['outputId'],s.f.clock.now().toISOString()]))).rows[0]!.v;
 assert.equal(expired,first==='expiry');if(first==='expiry')assert.equal((await enter()).rows[0]!.v,false);assert.equal((await s.f.rows('attempt')).find(a=>a['id']===id)?.['state'],first==='expiry'?'ABANDONED':'SUBMISSION_ENTERED');
});
const posix={skip:process.platform==='win32'?'Separate portable IPC/crash suite covers Windows; SIGSTOP needs POSIX':false};
for(const priority of ['menu','humano'])for(const pauseAt of ['worker.beforeArm','dispatch.beforeGate'])for(const kind of ['booking','confirmation'])for(const action of ['crash','freeze'])test(`C1 ${priority} after dispatcher ${action} at ${pauseAt} (${kind}) is safely superseded`,posix,async t=>{
 const s=await target(t,kind),id=text(s.attempt.body['attemptId']),c={mode:'dispatch' as const,socket:s.f.socket,database:s.f.dbname,archive:s.f.archive.directory,businessId:'synthetic-a',attemptId:id,ownerId:randomUUID(),providerUrl:s.server.url,now:s.f.clock.now().toISOString(),pauseAt},child=worker(t,c);await child.wait('point',c.pauseAt);
 if(action==='crash')await child.kill();else child.child.kill('SIGSTOP');await admission(s.f,raw(s.f,priority));
 if(action==='freeze'){child.resume(c.pauseAt);assert.equal(object((await child.wait('done'))['result'])['state'],'HELD');await child.closed;}
 assert.equal((await s.f.rows('attempt')).find(a=>a['id']===id)?.['state'],'ABANDONED');assert.equal((await s.server.calls()).length,kind==='booking'?0:1);await next(s.f,priority);
});
test('O2 malformed output purpose is PLAN_INVALID, never UNIQUE_CONFLICT; genuine conflicts stay distinct',async t=>{
 const f=await fixture(t);await assert.rejects(plan(f,{outputPurpose:'BOGUS' as never}),e=>e instanceof PlanInvalidError&&e.terminalRecorded);assert.equal((await f.rows('plan_rejection'))[0]!['reason'],'PLAN_INVALID');assert.equal((await f.rows('appointment')).length,0);assert.equal((await f.rows('attempt')).length,0);
 const decision=object((await f.rows('input_reduction'))[0]!['decision']);assert.equal(decision['planReason'],'PLAN_INVALID');await plan(f);
 const customerId=randomUUID(),subject='other-customer';await f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',['synthetic-a',customerId,subject]);const inputId=text((await admission(f,raw(f,'synthetic fixed command','synthetic-a',randomUUID(),subject))).inputs[0]!['inputId']);
 await assert.rejects(plan(f,{inputId,customerId}),e=>e instanceof PlanConflictError&&e.terminalRecorded);assert.equal((await f.rows('plan_rejection')).find(x=>x['input_id']===inputId)?.['reason'],'RESOURCE_CONFLICT');
});
for(const alias of ['business-id','business.id','business id','tenant-id','tenant.id','Tenant ID','business•id'])test('O4 alternate binding punctuation rejected: '+alias,()=>assert.throws(()=>tenantBindings({nested:[{[alias]:'synthetic-a'}]},'synthetic-a'),/tenant_binding_key_unsupported/));
test('O4 provider-shaped nonbinding field names remain valid, while punctuated aliases fail SQL independently',async t=>{
 const f=await fixture(t),body={businessId:'synthetic-a',metadata:{phone_number_id:'synthetic-number',display_phone_number:'synthetic'},contacts:[{wa_id:'synthetic',profile:{name:'Synthetic'}}],statuses:[{recipient_id:'synthetic',conversation:{id:'synthetic'},pricing:{category:'service'}}]};tenantBindings(body,'synthetic-a');const valid=await f.archive.ensure('provider-fields','HISTORY',body);await f.role('sealer').seal('synthetic-a',f.archive,valid);
 for(const k of ['business-id','business.id','business id','tenant.id'])await assert.rejects(f.role('sealer').tx('synthetic-a',db=>db.query('SELECT core.register_seal($1,$2,$3,$4,$5)',['synthetic-a','alias/'+k,'HISTORY','0'.repeat(64),{body:{businessId:'synthetic-a',[k]:'synthetic-a'}}])),/tenant_binding_denied/);
 await evidence('O4-provider-field-boundary',{syntheticRepresentativeFields:true,realMetaContractGate016:'NOT RUN'});
});
