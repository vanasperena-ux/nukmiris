import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {l0b} from './support/l0b.js';
import {raw,signature,cut} from './support/helpers.js';
import {admitInput} from '../src/application/admit-input.js';
import {prepareOutput} from '../src/application/prepare-operation.js';
import {ConversationHeldError,PlanConflictError} from '../src/application/plan-conflict.js';
import {reconcileReadOnly} from '../src/application/dispatch-once.js';
import {recordResult} from '../src/application/record-result.js';
import {drainOrdinary} from '../src/application/reduce-input.js';
import {ArchiveBusyError} from '../src/infrastructure/archive/availability.js';
import {object,text,digest,type ObjectValue} from '../src/domain/protocol.js';

function forkPlan(base:ObjectValue,input:ObjectValue,extra:ObjectValue={}):ObjectValue {
 const p=structuredClone(base),operationId=randomUUID(),attemptId=randomUUID(),appointmentId=randomUUID(),eventId=randomUUID(),outputId=randomUUID();
 Object.assign(p,{inputId:input['inputId'],operationId,attemptId,appointmentId,eventId,outputId,...extra});
 p['intent']={...object(p['intent']),inputId:input['inputId']!,...(extra['customerId']?{customerId:extra['customerId']}:{})};
 p['outputPayload']={synthetic:'WP1_ONLY',operationId,appointmentId};p['outputDigest']=digest(p['outputPayload']);
 const e=object(p['envelope']),payload={...object(e['payload']),appointmentId,eventId,...(extra['customerId']?{customerId:extra['customerId']}:{})};
 p['payloadDigest']=digest(payload);p['envelope']={...e,attemptId,remoteId:eventId,conversationId:input['conversationId']!,recipient:input['subject']!,payload,payloadDigest:p['payloadDigest']};return p;
}
async function counts(s:Awaited<ReturnType<typeof l0b>>){return Promise.all(['appointment','operation','mutation_guard','protection','attempt'].map(n=>s.f.rows(n).then(x=>x.length)));}

test('W2-RP01 sequence two cannot reserve first through either application or direct SQL',async t=>{
 const s=await l0b(t),one=(await s.admit()).inputs[0]!,two=(await s.admit()).inputs[0]!;
 await assert.rejects(s.prepare(text(two['inputId'])),ConversationHeldError);assert.deepEqual(await counts(s),[0,0,0,0,0]);
 const first=await s.prepare(text(one['inputId'])),before=await counts(s),body=forkPlan(first.body,two),seal=await s.archive.ensure('adversarial-later-plan','OPERATION_PLAN',body);await s.f.role('sealer').seal('synthetic-a',s.archive,seal);
 await assert.rejects(s.f.role('reducer').tx('synthetic-a',db=>db.query('SELECT core.prepare_operation($1,$2,$3,$4)',['synthetic-a',seal.body,seal.digest,seal.key])),e=>(e as {code?:string}).code==='P7502');
 assert.deepEqual(await counts(s),before);assert.equal((await s.f.rows('operation'))[0]!['input_id'],one['inputId']);
});

test('W2-RP02 concurrent workers preserve the lower sequence before reservation',async t=>{
 const s=await l0b(t),one=(await s.admit()).inputs[0]!,two=(await s.admit()).inputs[0]!;
 const result=await Promise.allSettled([s.prepare(text(two['inputId'])),s.prepare(text(one['inputId']))]);
 assert.equal(result[0]!.status,'rejected');assert.equal(result[1]!.status,'fulfilled');assert.deepEqual(await counts(s),[1,1,1,1,1]);
});

test('W2-RP02 an earlier STAGED input survives crash cuts and bars later reservation until original activation',async t=>{
 const s=await l0b(t),body=raw(s.f),args={raw:body,signature:signature(s.f,body),secret:s.f.secret,routes:s.f.routes,ingress:s.f.role('ingress'),sealer:s.f.role('sealer'),reducer:s.f.role('reducer'),custody:s.custody,clock:s.f.clock};
 await assert.rejects(admitInput({...args,faults:cut('A2.afterCommit')}));const original=(await s.f.rows('input'))[0]!;
 const next=(await s.admit()).inputs[0]!;await assert.rejects(s.prepare(text(next['inputId'])),ConversationHeldError);assert.deepEqual(await counts(s),[0,0,0,0,0]);
 const recovered=await admitInput(args);assert.equal(recovered.inputs[0]!['inputId'],original['id']);assert.equal((await s.f.rows('input'))[0]!['sequence'],'1');await s.prepare(text(original['id']));
});

test('W2-RP02 eligible but unreduced ordinary input bars reservation until the normal reducer drains it',async t=>{
 const s=await l0b(t),admitCut=async(message:string)=>{const body=raw(s.f,message);await assert.rejects(admitInput({raw:body,signature:signature(s.f,body),secret:s.f.secret,routes:s.f.routes,ingress:s.f.role('ingress'),sealer:s.f.role('sealer'),reducer:s.f.role('reducer'),custody:s.custody,clock:s.f.clock,faults:cut('A4.afterCommit')}));};
 await admitCut('ordinary conversation');await admitCut('synthetic fixed command');
 const inputs=(await s.f.rows('input')).sort((a,b)=>Number(a['sequence'])-Number(b['sequence']));assert.equal(inputs[0]!['state'],'ELIGIBLE');
 await assert.rejects(s.prepare(text(inputs[1]!['id'])),ConversationHeldError);assert.deepEqual(await counts(s),[0,0,0,0,0]);
 const reduced=await drainOrdinary({businessId:'synthetic-a',conversationId:text(inputs[0]!['conversation_id']),reducer:s.f.role('reducer'),sealer:s.f.role('sealer'),archive:s.archive});
 assert.equal(reduced[0]!['outcome'],'NO_EFFECT');assert.equal(reduced[1]!['state'],'OPERATION_REQUIRED');await s.prepare(text(inputs[1]!['id']));assert.deepEqual(await counts(s),[1,1,1,1,1]);
});

test('W2-RP03 UNKNOWN holds same/different later slots; Menu never releases it; read-only proof and ordered confirmation advance',async t=>{
 const s=await l0b(t),one=(await s.admit()).inputs[0]!,first=await s.prepare(text(one['inputId']));s.server.loseResponse=true;
 assert.equal((await s.dispatch(first)).out.state,'UNKNOWN');const original=await s.f.rows('protection');
 const two=(await s.admit()).inputs[0]!;
 for(const startAt of ['2030-01-02T10:00:00Z','2030-01-03T10:00:00Z'])await assert.rejects(s.prepare(text(two['inputId']),{startAt,endAt:new Date(Date.parse(startAt)+3600000).toISOString()}),ConversationHeldError);
 assert.equal((await s.admit('Menu')).reductions[0]!['outcome'],'NAVIGATION');assert.deepEqual(await s.f.rows('protection'),original);assert.equal((await s.server.calls()).length,1);
 const proof=await reconcileReadOnly({envelope:object(first.body['envelope']) as never,provider:s.client});assert.ok(proof);await recordResult({proof,result:s.f.role('result'),sealer:s.f.role('sealer'),archive:s.archive});
 await assert.rejects(s.prepare(text(two['inputId'])),ConversationHeldError);
 s.server.loseResponse=false;const output=await prepareOutput({businessId:'synthetic-a',outputId:text(first.body['outputId']),reducer:s.f.role('reducer'),sealer:s.f.role('sealer'),archive:s.archive,clock:s.f.clock});assert.equal((await s.dispatch(output)).out.state,'APPLIED');
 await s.prepare(text(two['inputId']),{startAt:'2030-01-03T10:00:00Z',endAt:'2030-01-03T11:00:00Z'});assert.equal((await s.server.calls()).length,2);
});

test('W2-RP cancellation finalizes once, sends its scoped confirmation and releases the slot for a new input',async t=>{
 const s=await l0b(t),first=await s.prepare(text((await s.admit()).inputs[0]!['inputId']));await s.finish(first);
 const cancel=await s.prepare(text((await s.admit()).inputs[0]!['inputId']),{kind:'CANCEL',appointmentId:text(first.body['appointmentId']),eventId:text(first.body['eventId']),expectedRevision:2});await s.finish(cancel);
 assert.equal((await s.f.rows('appointment'))[0]!['state'],'CANCELLED');assert.equal((await s.f.rows('protection')).length,0);assert.equal((await s.f.rows('mutation_guard')).length,0);
 await s.prepare(text((await s.admit()).inputs[0]!['inputId']));assert.equal((await s.f.rows('protection')).length,1);assert.equal((await s.server.calls()).length,4);
});

test('O1 unique-output conflict is a terminal original-plan outcome, not a same-plan retry',async t=>{
 const s=await l0b(t),first=await s.prepare(text((await s.admit()).inputs[0]!['inputId'])),customerId=randomUUID();
 await s.f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',['synthetic-a',customerId,'other']);
 const second=(await s.admit('synthetic fixed command','synthetic-a',randomUUID(),'other')).inputs[0]!,body=forkPlan(first.body,second,{customerId,outputId:first.body['outputId']!});
 const seal=await s.archive.ensure(`operation/synthetic-a/${second['inputId']}`,'OPERATION_PLAN',{intent:body['intent']!},()=>{const {intent,...rest}=body;void intent;return rest;});assert.equal(seal.body['outputId'],first.body['outputId']);
 await assert.rejects(s.prepare(text(second['inputId']),{customerId}),e=>e instanceof PlanConflictError&&e.terminalRecorded);
 assert.deepEqual(await counts(s),[1,1,1,1,1]);assert.equal((await s.f.rows('plan_rejection')).length,1);assert.equal((await s.f.rows('input_reduction')).find(x=>x['input_id']===second['inputId'])?.['outcome'],'PLAN_CONFLICT');
 await assert.rejects(s.prepare(text(second['inputId']),{customerId}),/input_terminal/);assert.equal((await s.server.calls()).length,0);
});

test('O1 real lock timeout rolls back reservations, records a terminal conflict, and permits a new request without retrying the old plan',async t=>{
 const s=await l0b(t),input=(await s.admit()).inputs[0]!,u=s.f.role('reducer'),original=u.tx.bind(u);
 u.tx=async(...args)=>original(args[0],async db=>{await db.query("SET LOCAL lock_timeout='50ms'");return args[1](db);},args[2],args[3]) as never;
 const blocker=await s.f.admin.connect();await blocker.query('BEGIN');await blocker.query('SELECT * FROM core.resource WHERE business_id=$1 AND id=$2 FOR UPDATE',['synthetic-a',s.f.id('resource')]);
 try{await assert.rejects(s.prepare(text(input['inputId'])),e=>e instanceof PlanConflictError&&e.sqlState==='55P03'&&e.terminalRecorded);}finally{await blocker.query('ROLLBACK');blocker.release();u.tx=original;}
 assert.deepEqual(await counts(s),[0,0,0,0,0]);await assert.rejects(s.prepare(text(input['inputId'])),/input_terminal/);
 await s.prepare(text((await s.admit()).inputs[0]!['inputId']));assert.deepEqual(await counts(s),[1,1,1,1,1]);
});

test('O1 a committed conflict marker survives reduction-custody failure and drains without replaying the rejected plan',async t=>{
 const s=await l0b(t),first=await s.prepare(text((await s.admit()).inputs[0]!['inputId'])),customerId=randomUUID();
 await s.f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',['synthetic-a',customerId,'conflict-recovery']);
 const input=(await s.admit('synthetic fixed command','synthetic-a',randomUUID(),'conflict-recovery')).inputs[0]!,body=forkPlan(first.body,input,{customerId,outputId:first.body['outputId']!});
 await s.archive.ensure(`operation/synthetic-a/${input['inputId']}`,'OPERATION_PLAN',{intent:body['intent']!},()=>{const {intent,...rest}=body;void intent;return rest;});
 const sealer=s.f.role('sealer'),seal=sealer.seal.bind(sealer);sealer.seal=async(...args)=>{if(args[2].kind==='INPUT_REDUCTION')throw new ArchiveBusyError('SQLITE_BUSY');return seal(...args);};
 try{await assert.rejects(s.prepare(text(input['inputId']),{customerId}),e=>e instanceof PlanConflictError&&!e.terminalRecorded);}finally{sealer.seal=seal;}
 assert.equal((await s.f.rows('plan_rejection')).length,1);assert.equal((await s.f.rows('input_reduction')).filter(x=>x['input_id']===input['inputId']).length,0);assert.deepEqual(await counts(s),[1,1,1,1,1]);
 const reduced=await drainOrdinary({businessId:'synthetic-a',conversationId:text(input['conversationId']),reducer:s.f.role('reducer'),sealer:s.f.role('sealer'),archive:s.archive});assert.equal(reduced[0]!['outcome'],'PLAN_CONFLICT');
 await assert.rejects(s.prepare(text(input['inputId']),{customerId}),/input_terminal/);assert.deepEqual(await counts(s),[1,1,1,1,1]);assert.equal((await s.server.calls()).length,0);
});

test('A1 SQL seal registration independently rejects nested tenant aliases even with a recomputed digest',async t=>{
 const s=await l0b(t),b='synthetic-a';
 for(const key of ['tenantId','tenant_id','BusinessId','business_id']){
  const body={businessId:b,nested:[{[key]:b}]},seal={key:'alias-'+key,kind:'INPUT_REDUCTION',digest:digest(body),body};
  await assert.rejects(s.f.role('sealer').tx(b,db=>db.query('SELECT core.register_seal($1,$2,$3,$4,$5)',[b,seal.key,seal.kind,seal.digest,seal])),/tenant_binding_denied/);
 }
 assert.equal((await s.f.rows('seal')).length,0);
});

test('O3 constraint migration refuses any existing input/in-flight state without modifying the database',async t=>{
 const s=await l0b(t);await s.admit('hello');const before=await s.f.snapshot();
 const migration=await readFile(new URL('../../src/infrastructure/postgres/migrations/004-classification-and-ordering.sql',import.meta.url),'utf8').catch(()=>readFile('src/infrastructure/postgres/migrations/004-classification-and-ordering.sql','utf8'));
 await assert.rejects(s.f.admin.query(migration),/l0b_migration_requires_empty_inert_fixture/);assert.deepEqual(await s.f.snapshot(),before);
});

test('reduction custody survives SQL rollback and a later human-priority context without overwriting the newer context',async t=>{
 const s=await l0b(t),body=raw(s.f,'hello'),args={raw:body,signature:signature(s.f,body),secret:s.f.secret,routes:s.f.routes,ingress:s.f.role('ingress'),sealer:s.f.role('sealer'),reducer:s.f.role('reducer'),custody:s.custody,clock:s.f.clock};
 await assert.rejects(admitInput({...args,faults:cut('reduce.beforeCommit')}));await s.admit('hablar con una persona');
 const done=await admitInput(args);assert.equal(done.reductions[0]!['outcome'],'NO_EFFECT');assert.equal((await s.f.rows('conversation_context'))[0]!['mode'],'HUMAN');assert.equal((await s.f.rows('appointment')).length,0);
});
