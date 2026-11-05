import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {l0b} from './support/l0b.js';
import {raw,signature,cut} from './support/helpers.js';
import {admitInput} from '../src/application/admit-input.js';
import {admissionCustody,RAW_CUSTODY} from '../src/application/admission-custody.js';
import {object,text,digest} from '../src/domain/protocol.js';
import {reduceInput,drainOrdinary} from '../src/application/reduce-input.js';
import {ArchiveBusyError,ArchivePendingError} from '../src/infrastructure/archive/availability.js';
import {armAttempt,dispatchOnce} from '../src/application/dispatch-once.js';

test('W2-CL01 one sealed classification handles NFC/NFD/accent/space/punctuation withdrawals without poisoning the next head',async t=>{
 const s=await l0b(t);
 for(const value of ['STOP',' baja recordatorios ','No me envíes recordatorios.',' No  me envíes   recordatorios !!! ','dejar de recibir recordatorios']){
  const r=await s.admit(value),input=r.inputs[0]!,c=object(input['classification']);assert.equal(c['kind'],'WITHDRAWAL');assert.equal(c['ruleVersion'],'L0B-CLASS-1');
  const stored=(await s.f.rows('input_classification')).find(x=>x['input_id']===input['inputId']);assert.deepEqual(stored?.['value'],c);
  const reduction=(await s.f.rows('input_reduction')).find(x=>x['input_id']===input['inputId']);assert.equal(reduction?.['outcome'],'WITHDRAWAL');
 }
 assert.ok((await s.f.rows('permission_head')).every(x=>x['suppressed']===true));
 const next=await s.admit();await s.prepare(text(next.inputs[0]!['inputId']));assert.equal((await s.f.rows('protection')).length,1);
 const def=await s.f.admin.query("SELECT pg_get_functiondef('core.conversation_ready(text,uuid,bigint)'::regprocedure) AS d");assert.doesNotMatch(def.rows[0].d,/lower|trim|recordatorios|event/);
});

test('W2-CL02 ordinary chat, name/date context, human mode and Menu terminate durably with no fabricated appointment',async t=>{
 const s=await l0b(t);const chat=await s.admit('hola');assert.equal(chat.reductions[0]!['outcome'],'NO_EFFECT');
 const conv=chat.inputs[0]!['conversationId'];
 await s.f.admin.query("UPDATE core.conversation_context SET phase='NAME' WHERE business_id=$1 AND conversation_id=$2",['synthetic-a',conv]);
 const name=await s.admit('Juana de la Cruz');assert.equal(name.reductions[0]!['outcome'],'CONTEXT_INPUT');assert.equal(object(name.reductions[0]!['decision'])['previousPhase'],'NAME');
 const commandAsName=await s.admit();assert.equal(commandAsName.reductions[0]!['outcome'],'CONTEXT_INPUT');await assert.rejects(s.prepare(text(commandAsName.inputs[0]!['inputId'])),/context_input_not_mutation|input_terminal/);
 await s.f.admin.query("UPDATE core.conversation_context SET phase='DATE' WHERE business_id=$1 AND conversation_id=$2",['synthetic-a',conv]);
 const date=await s.admit('2030-01-04');assert.equal(date.reductions[0]!['outcome'],'CONTEXT_INPUT');assert.equal(object(date.reductions[0]!['decision'])['previousPhase'],'DATE');
 assert.equal((await s.admit('hablar con una persona')).reductions[0]!['outcome'],'HUMAN_HANDOFF');
 assert.equal((await s.admit()).reductions[0]!['outcome'],'HUMAN_HANDOFF');
 assert.equal((await s.admit('Menu')).reductions[0]!['outcome'],'NAVIGATION');
 assert.equal((await s.f.rows('conversation_context'))[0]!['mode'],'BOT');assert.equal((await s.f.rows('attempt')).length,0);assert.equal((await s.f.rows('appointment')).length,0);
 const next=await s.admit();assert.equal(next.reductions[0]!['state'],'OPERATION_REQUIRED');await s.prepare(text(next.inputs[0]!['inputId']));
});

test('W2-CL03 exact/repacked retries retain original class, IDs and terminal decision',async t=>{
 const s=await l0b(t),id=randomUUID(),first=await s.admit('hola','synthetic-a',id),body=Buffer.from(JSON.stringify(JSON.parse(raw(s.f,'hola','synthetic-a',id).toString()),null,2));
 const retry=await admitInput({raw:body,signature:signature(s.f,body),secret:s.f.secret,routes:s.f.routes,ingress:s.f.role('ingress'),sealer:s.f.role('sealer'),reducer:s.f.role('reducer'),custody:s.custody,clock:s.f.clock});
 assert.deepEqual(retry.inputs,first.inputs);assert.deepEqual(retry.reductions,first.reductions);assert.equal((await s.f.rows('input')).length,1);assert.equal((await s.f.rows('input_reduction')).length,1);assert.equal((await s.server.calls()).length,0);
 await assert.rejects(s.admit('changed','synthetic-a',id),/identity_conflict|input_conflict/);
});

for(const change of [{version:2},{version:'1'},{ruleVersion:'NEW-RULE'},{kind:'WITHDRAWAL'},{eventDigest:'0'.repeat(64)},{subject:'foreign'}])test('W2-CL03 altered frozen classification rejected '+JSON.stringify(change),async t=>{
 const s=await l0b(t),r=await s.admit('hello'),original=r.inputs[0]!,key='tampered/'+randomUUID(),body={...original,inputSealKey:key,classification:{...object(original['classification']),...change}};
 const seal=await s.archive.ensure(key,'INPUT',body);await s.f.role('sealer').seal('synthetic-a',s.archive,seal);
 const before=(await s.f.rows('input_classification'))[0];
 await assert.rejects(s.f.role('ingress').tx('synthetic-a',db=>db.query('SELECT core.stage_batch($1,$2,$3,$4)',['synthetic-a',randomUUID(),digest([body]),JSON.stringify([body])])),/classification_/);
 assert.deepEqual((await s.f.rows('input_classification'))[0],before);
});

test('W2-CL04 authenticated mixed tenants keep raw custody separate; failed binding never falls back and STOP is durable',async t=>{
 const s=await l0b(t),a=object(JSON.parse(raw(s.f,'STOP','synthetic-a').toString())),b=object(JSON.parse(raw(s.f,'STOP','synthetic-b').toString()));
 const body=Buffer.from(JSON.stringify({entry:[...(a['entry'] as []),...(b['entry'] as [])]}));
 const args={raw:body,signature:signature(s.f,body),secret:s.f.secret,routes:s.f.routes,ingress:s.f.role('ingress'),sealer:s.f.role('sealer'),reducer:s.f.role('reducer'),clock:s.f.clock};
 const missing=admissionCustody(s.a.archive.scope(RAW_CUSTODY),new Map([['synthetic-a',s.archive]]));
 await assert.rejects(admitInput({...args,custody:missing}),/tenant_archive_binding_missing/);
 assert.equal((await s.f.rows('permission_head','synthetic-a'))[0]!['suppressed'],true);assert.equal((await s.f.rows('permission_head','synthetic-b'))[0]!['suppressed'],true);
 assert.equal((await s.f.rows('input','synthetic-b')).length,0);
 const success=await admitInput({...args,custody:s.custody});assert.equal(success.inputs.length,2);
 assert.equal((await s.a.archive.scope(RAW_CUSTODY).records()).filter(x=>x.kind==='RAW_BATCH').length,1);
 for(const tenant of ['synthetic-a','synthetic-b']){const rows=await s.a.archive.scope(tenant).records();assert.ok(rows.every(x=>x.kind!=='RAW_BATCH'));assert.ok(rows.every(x=>x.body['businessId']===tenant));}
 const rawSeal=(await s.a.archive.scope(RAW_CUSTODY).records())[0]!;assert.equal(await s.archive.lookup(rawSeal.key),null);
});

test('W2-RP04 held ordinary input drains normally after a predecessor resolves, without operator HOLD',async t=>{
 const s=await l0b(t),first=await s.admit(),plan=await s.prepare(text(first.inputs[0]!['inputId']));
 const later=await s.admit('thanks');assert.equal(later.reductions[0]!['state'],'HELD');await s.finish(plan);
 const results=await drainOrdinary({businessId:'synthetic-a',conversationId:text(first.inputs[0]!['conversationId']),reducer:s.f.role('reducer'),sealer:s.f.role('sealer'),archive:s.archive});
 assert.ok(results.some(x=>x['inputId']===later.inputs[0]!['inputId']&&x['state']==='TERMINAL'));
 const repeat=await reduceInput({businessId:'synthetic-a',inputId:text(later.inputs[0]!['inputId']),reducer:s.f.role('reducer'),sealer:s.f.role('sealer'),archive:s.archive});assert.equal(repeat['outcome'],'NO_EFFECT');
 assert.ok((await s.f.rows('input')).every(x=>x['state']==='ELIGIBLE'));
});

test('W2-CL recovery after activation COMMIT loss reuses classification and completes the original reduction',async t=>{
 const s=await l0b(t),body=raw(s.f,'hello'),args={raw:body,signature:signature(s.f,body),secret:s.f.secret,routes:s.f.routes,ingress:s.f.role('ingress'),sealer:s.f.role('sealer'),reducer:s.f.role('reducer'),custody:s.custody,clock:s.f.clock};
 await assert.rejects(admitInput({...args,faults:cut('A4.afterCommit')}));const original=(await s.f.rows('input'))[0]!['id'];
 const r=await admitInput(args);assert.equal(r.inputs[0]!['inputId'],original);assert.equal((await s.f.rows('input_reduction')).length,1);assert.equal((await s.f.rows('appointment')).length,0);
});

test('N1 admission retries only bounded reads; failed custody leaves STOP durable and cannot ACK or allocate a second input',async t=>{
 const s=await l0b(t),id=randomUUID(),body=raw(s.f,'STOP','synthetic-a',id);let writes=0;
 const unavailable={...s.archive,ensure:async()=>{writes++;throw new ArchiveBusyError('SQLITE_BUSY');}};
 const custody={...s.custody,tenant:(b:string)=>b==='synthetic-a'?unavailable:s.custody.tenant(b)};
 const args={raw:body,signature:signature(s.f,body),secret:s.f.secret,routes:s.f.routes,ingress:s.f.role('ingress'),sealer:s.f.role('sealer'),reducer:s.f.role('reducer'),clock:s.f.clock};
 await assert.rejects(admitInput({...args,custody}));assert.equal((await s.f.rows('permission_head'))[0]!['suppressed'],true);assert.equal((await s.f.rows('input')).length,0);assert.equal(writes,2,'one suppression put and one conversation put, neither blindly retried');
 const recovered=await admitInput({...args,custody:s.custody}),retry=await admitInput({...args,custody:s.custody});assert.deepEqual(recovered.inputs,retry.inputs);assert.equal((await s.f.rows('input')).length,1);assert.equal((await s.server.calls()).length,0);
});

test('N1 dispatch retries only original ARM reads; exhaustion holds with zero provider calls and no new owner',async t=>{
 const s=await l0b(t),p=await s.prepare(text((await s.admit()).inputs[0]!['inputId'])),common={businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId:randomUUID(),dispatcher:s.f.role('dispatch')};
 await armAttempt({...common,sealer:s.f.role('sealer'),archive:s.archive});let reads=0;
 const unavailable={...s.archive,lookup:async()=>{reads++;throw new ArchivePendingError();}};
 assert.equal((await dispatchOnce({...common,archive:unavailable,provider:s.client,clock:s.f.clock})).state,'HELD');assert.equal(reads,5);assert.equal((await s.server.calls()).length,0);assert.equal((await s.f.rows('attempt'))[0]!['owner_id'],common.ownerId);
 let transient=0;const recovering={...s.archive,lookup:async(k:string)=>{if(++transient<3)throw new ArchivePendingError();return s.archive.lookup(k);}};
 assert.equal((await dispatchOnce({...common,archive:recovering,provider:s.client,clock:s.f.clock})).state,'APPLIED');assert.equal(transient,3);
 assert.equal((await dispatchOnce({...common,archive:s.archive,provider:s.client,clock:s.f.clock})).state,'HELD');assert.equal((await s.server.calls()).length,1);
});

test('N5/A1 untrusted tenant aliases cannot enter the normalized schema; JSON text stays opaque under its authenticated route',async t=>{
 const s=await l0b(t);
 for(const field of ['businessId','business_id','BusinessId','tenantId']){
  const value=JSON.parse(raw(s.f,'STOP').toString());value.entry[0].changes[0].value.messages[0][field]='synthetic-b';const body=Buffer.from(JSON.stringify(value));
  await assert.rejects(admitInput({raw:body,signature:signature(s.f,body),secret:s.f.secret,routes:s.f.routes,ingress:s.f.role('ingress'),sealer:s.f.role('sealer'),reducer:s.f.role('reducer'),custody:s.custody,clock:s.f.clock}),/message_schema/);
 }
 assert.equal((await s.f.rows('permission_head')).length,0);assert.equal((await s.f.rows('input')).length,0);
 const value=JSON.stringify({businessId:'synthetic-b',tenantId:'synthetic-b'}),r=await s.admit(value);assert.equal(r.inputs[0]!['businessId'],'synthetic-a');assert.equal(r.reductions[0]!['outcome'],'NO_EFFECT');assert.equal((await s.f.rows('input','synthetic-b')).length,0);
 assert.throws(()=>admissionCustody(s.archive,new Map([['synthetic-a',s.archive]])),/raw_custody_binding_required/);
 assert.throws(()=>admissionCustody(s.a.archive.scope(RAW_CUSTODY),new Map([['synthetic-b',s.archive]])),/tenant_archive_binding_required/);
});

test('N5 distinct authenticated receiving channels namespace withdrawal evidence even with the same provider message ID',async t=>{
 const s=await l0b(t),channel=randomUUID(),id=randomUUID();await s.admit('STOP','synthetic-a',id);
 await s.f.admin.query('INSERT INTO core.channel VALUES($1,$2,$3,$4,1,true)',['synthetic-a',channel,'waba-two','number-two']);
 const routes=[...s.f.routes,{businessId:'synthetic-a',channelId:channel,waba:'waba-two',numberId:'number-two',channelRevision:1}],body=Buffer.from(raw(s.f,'STOP','synthetic-a',id).toString().replace('waba-synthetic-a','waba-two').replace('number-synthetic-a','number-two'));
 await admitInput({raw:body,signature:signature(s.f,body),secret:s.f.secret,routes,ingress:s.f.role('ingress'),sealer:s.f.role('sealer'),reducer:s.f.role('reducer'),custody:s.custody,clock:s.f.clock});
 assert.equal((await s.f.rows('permission_event')).length,2);assert.equal((await s.f.rows('input')).length,2);assert.equal((await s.f.rows('input_reduction')).length,2);
});
