import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,cut,plan,apply} from './support/helpers.js';
import {l1Config} from './support/l1-calendar.js';
import {InteractiveBooking,type LocalScope} from '../src/application/interactive-booking.js';
import {object,text,noFaults,type ObjectValue,type Faults} from '../src/domain/protocol.js';
import type {PoolClient} from 'pg';
const b='synthetic-a',known='customer-'+b;
async function setup(t:Parameters<typeof fixture>[0],faults?:Faults){
 const f=await fixture(t);const scopes:LocalScope[]=[];
 for(const id of [b,'synthetic-b']){const config={...l1Config('UTC'),businessId:id,calendarId:'calendar-'+id};await f.admin.query('INSERT INTO core.local_customer VALUES($1,$2,$3)',[id,f.id('customer',id),'Ana Ejemplo']);
  scopes.push({config,bindings:{businessId:id,calendar:{id:config.calendarId,coreId:f.id('calendar',id)},employees:new Map([['employee-a',f.id('resource',id)]])},channelId:f.id('channel',id),employeeNames:new Map([['employee-a','Lucía']]),archive:f.archive.scope(id),ingress:f.role('ingress'),reducer:f.role('reducer'),sealer:f.role('sealer'),dispatcher:f.role('dispatch'),result:f.role('result')});}
 const app=new InteractiveBooking(scopes,faults);t.after(()=>app.stop());
 const tick=async(n=3)=>{for(let i=0;i<n;i++)await app.tick();};
 const send=async(value:string,subject=known,id=b)=>{await app.submit(id,subject,randomUUID(),{kind:'TEXT',value});await tick();return app.snapshot(id,subject);};
 const choose=async(value:string,subject=known,id=b)=>{await app.submit(id,subject,randomUUID(),{kind:'ACTION',value});await tick();return app.snapshot(id,subject);};
 return {f,app,scopes,tick,send,choose};
}
function last(s:ObjectValue):ObjectValue{return object((s['replies'] as ObjectValue[]).at(-1)!['payload']);}
function choices(s:ObjectValue):ObjectValue[]{return last(s)['choices'] as ObjectValue[];}
test('L2 known customer: menu/cita, two slots, direct selection, confirmed employee and durable calendar',async t=>{
 const s=await setup(t),view=await s.send('menu');assert.equal(choices(view).length,3);assert.equal(last(view)['outcome'],'OFFER');const done=await s.choose(text(choices(view)[0]!['id']));assert.equal((done['appointments'] as ObjectValue[]).length,1);assert.equal(last(done)['outcome'],'CONFIRMED');assert.match(text(last(done)['text']),/Lucía/);assert.equal((done['calendar'] as ObjectValue[]).length,1);assert.equal((await s.f.rows('attempt')).length,2);assert.equal((done['diagnostics'] as ObjectValue[]).length,0);
});
test('L2 new customer: slot then valid name; no reservation before name, same rules as accepted v0.8.1',async t=>{
 const s=await setup(t),subject='new-customer',view=await s.send('cita',subject),named=await s.choose(text(choices(view)[0]!['id']),subject);assert.equal(last(named)['outcome'],'NAME_REQUIRED');assert.equal((await s.f.rows('appointment')).length,0);
 for(const invalid of ['123','<Ana>','a','x'.repeat(121)]){const state=await s.send(invalid,subject);assert.match(text(last(state)['text']),/nombre completo/);assert.equal((await s.f.rows('appointment')).length,0);}
 const done=await s.send(' María   López ',subject);assert.equal(last(done)['outcome'],'CONFIRMED');assert.equal((done['appointments'] as ObjectValue[]).length,1);assert.equal(last(done)['customer'],'María López');
});
test('L2 more options/date lists and natural dates persist through a new application object',async t=>{
 const s=await setup(t),initial=await s.send('cita'),more=await s.choose(text(choices(initial)[2]!['id'])),dates=await s.choose(text(choices(more)[2]!['id']));assert.equal(last(dates)['presentation'],'LIST');
 const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());await next.submit(b,known,randomUUID(),{kind:'TEXT',value:'mañana'});for(let i=0;i<3;i++)await next.tick();const day=await next.snapshot(b,known);assert.match(text(last(day)['text']),/2030/);await next.submit(b,known,randomUUID(),{kind:'ACTION',value:text(choices(day)[0]!['id'])});for(let i=0;i<4;i++)await next.tick();assert.equal(last(await next.snapshot(b,known))['outcome'],'CONFIRMED');
});
test('L2 duplicate action delivery, simultaneous different request IDs and prior revisions cannot double book',async t=>{
 const s=await setup(t),view=await s.send('cita'),value=text(choices(view)[0]!['id']);await Promise.all([s.app.submit(b,known,randomUUID(),{kind:'ACTION',value}),s.app.submit(b,known,randomUUID(),{kind:'ACTION',value})]);await s.tick(6);assert.equal((await s.f.rows('appointment')).length,1);assert.equal((await s.f.rows('local_action')).filter(a=>a['consumed_by']).length,1);assert.match(text(last(await s.app.snapshot(b,known))['text']),/Elige un horario de nuevo/);
});
test('L2 tenant and conversation binding: a foreign displayed action cannot be consumed or reserve',async t=>{
 const s=await setup(t),view=await s.send('cita'),value=text(choices(view)[0]!['id']);await s.choose(value,'other',b);await s.choose(value,'customer-synthetic-b','synthetic-b');assert.equal((await s.f.rows('appointment')).length,0);assert.equal((await s.f.rows('appointment','synthetic-b')).length,0);assert.equal((await s.f.rows('local_action')).filter(a=>a['consumed_by']).length,0);
 const foreign=await s.f.role('tenant_b').tx('synthetic-b',db=>db.query('SELECT * FROM core.local_action'));assert.equal(foreign.rows.some(a=>a.id===value),false);
});
test('L2 DB action expiration rejects old slots; choose-again is informative and releases no uncertainty',async t=>{
 const s=await setup(t),view=await s.send('cita');s.f.clock.instant+=900000;const again=await s.choose(text(choices(view)[0]!['id']));assert.match(text(last(again)['text']),/venció/);assert.equal((await s.f.rows('appointment')).length,0);
});
test('L2 human escalation owns ordinary text and action input until menu',async t=>{
 const s=await setup(t);await s.send('cita');const handoff=await s.send('humano');assert.equal(last(handoff)['outcome'],'HUMAN_HANDOFF');const held=await s.send('cita');assert.equal(last(held)['outcome'],'HUMAN_HANDOFF');assert.equal((await s.f.rows('appointment')).length,0);assert.equal(last(await s.send('menu'))['outcome'],'OFFER');
});
test('L2 concurrent customers compete safely; no employee/time/buffer overlap survives',async t=>{
 const s=await setup(t);const newId=randomUUID();await s.f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',[b,newId,'second']);await s.f.admin.query('INSERT INTO core.local_customer VALUES($1,$2,$3)',[b,newId,'Bea Ejemplo']);
 const first=await s.send('cita'),second=await s.send('cita','second');await Promise.all([s.app.submit(b,known,randomUUID(),{kind:'ACTION',value:text(choices(first)[0]!['id'])}),s.app.submit(b,'second',randomUUID(),{kind:'ACTION',value:text(choices(second)[0]!['id'])})]);await s.tick(5);assert.equal((await s.f.rows('appointment')).length,1);const states=await Promise.all([s.app.snapshot(b,known),s.app.snapshot(b,'second')]),loser=states.find(x=>(x['appointments'] as ObjectValue[]).length===0)!;assert.match(text(last(loser)['text']),/Elige un horario de nuevo/);
});
test('L2 fake effect with lost response reconciles read-only after restart, with one calendar mutation',async t=>{
 const s=await setup(t),v=await s.send('cita');s.app.providers.get(b)!.failure='AFTER_APPLY';await s.choose(text(choices(v)[0]!['id']));const restarted=new InteractiveBooking(s.scopes);t.after(()=>restarted.stop());for(let i=0;i<5;i++)await restarted.tick();const done=await restarted.snapshot(b,known);assert.equal((done['appointments'] as ObjectValue[]).length,1);assert.equal((done['calendar'] as ObjectValue[]).length,1);assert.equal(last(done)['outcome'],'CONFIRMED');assert.equal((await s.f.rows('local_ledger')).filter(x=>x['kind']==='CORE').length,2);
});
test('L2 unknown without fake proof stays held after time passes and app restart, visible in Needs Attention',async t=>{
 const s=await setup(t),v=await s.send('cita');s.app.providers.get(b)!.failure='BEFORE_APPLY';await s.choose(text(choices(v)[0]!['id']));s.f.clock.instant+=86400000;const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());await next.recovery.tick();await next.tick();const state=await next.snapshot(b,known);assert.equal((state['appointments'] as ObjectValue[]).length,0);assert.equal((await s.f.rows('protection')).length,1);assert.equal((state['diagnostics'] as ObjectValue[]).some(x=>x['code']==='UNKNOWN_OUTCOME_HELD'),true);assert.equal((state['calendar'] as ObjectValue[]).length,0);
});
for(const point of ['local-claim.afterCommit','local-view.beforeCommit','local-view.afterCommit','local-reply-entry.afterCommit','local-reply.afterEntry','local-reply.afterProvider'])test('L2 restart after '+point+' preserves original identities and never duplicates reply effects',async t=>{
 const s=await setup(t,cut(point));await s.app.submit(b,known,randomUUID(),{kind:'TEXT',value:'menu'});await s.app.tick();const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());for(let i=0;i<4;i++)await next.tick();const replies=await s.f.rows('local_reply'),ledger=await s.f.rows('local_ledger');assert.ok(replies.length<=1);assert.ok(ledger.length<=1);if(['local-reply-entry.afterCommit','local-reply.afterEntry'].includes(point)){assert.equal(replies[0]!['state'],'UNKNOWN');assert.equal(ledger.length,0);}else{assert.equal(replies[0]!['state'],'DELIVERED');assert.equal(ledger.length,1);}
});
test('L2 C3/R2: expired or menu-superseded confirmation leaves ACTIVE booking visible in next reply',async t=>{
 const s=await setup(t),p=await plan(s.f);await apply(t,s.f,p);s.f.clock.instant+=3600000;await s.app.recovery.tick();const view=await s.send('menu');assert.match(text(last(view)['text']),/Tienes una cita confirmada/);assert.equal((view['appointments'] as ObjectValue[]).length,1);
});
test('L2 Mexico City offsets survive intent/reservation canonicalization and confirmation',async t=>{
 const s=await setup(t);s.scopes[0]!.config.timeZone='America/Mexico_City';const v=await s.send('menu'),done=await s.choose(text(choices(v)[0]!['id']));assert.equal(last(done)['outcome'],'CONFIRMED');assert.equal((done['appointments'] as ObjectValue[]).length,1);
});
test('L2 selected time reassigns a qualified free employee before booking and reports that employee',async t=>{
 const s=await setup(t),scope=s.scopes[0]!;scope.config.employees=[...scope.config.employees,{...scope.config.employees[0]!,id:'employee-b'}];scope.bindings.employees=new Map([...scope.bindings.employees,['employee-b',s.f.id('otherResource')]]);scope.employeeNames=new Map([...scope.employeeNames,['employee-b','Sofía']]);const v=await s.send('cita');const slot=(await s.f.rows('local_session'))[0]!['state'] as ObjectValue,chosen=(object(slot['oracle'])['slots'] as ObjectValue[])[0]!;await s.f.admin.query('INSERT INTO core.local_calendar VALUES($1,$2,$3,$4,$5,$6,15)',[b,'outside',s.f.id('calendar'),s.f.id('resource'),chosen['startAt'],chosen['endAt']]);const done=await s.choose(text(choices(v)[0]!['id']));assert.equal(last(done)['employee'],'Sofía');assert.equal((done['appointments'] as ObjectValue[])[0]!['resource_id'],s.f.id('otherResource'));
});
test('L2 automatic runtime recovery opens another customer’s availability without original customer input',async t=>{
 const s=await setup(t),p=await plan(s.f);s.f.clock.instant+=3600000;s.app.start(25);for(let i=0;i<200&&(await s.f.rows('attempt')).find(a=>a['id']===p.body['attemptId'])?.['state']!=='ABANDONED';i++)await new Promise(r=>setTimeout(r,10));await s.app.stop();assert.equal((await s.f.rows('attempt')).find(a=>a['id']===p.body['attemptId'])!['state'],'ABANDONED');assert.equal((await s.f.rows('protection')).length,0);
});
for(const control of ['menu','MeNú!','humano'])test('L2 priority '+control+' racing consumed action before reservation cannot book superseded work',async t=>{
 let reached!:()=>void,release!:()=>void,enabled=false;const at=new Promise<void>(r=>reached=r),go=new Promise<void>(r=>release=r);const s=await setup(t,{async hit(p){if(enabled&&p==='prepare.afterArchive'){reached();await go;}}});const v=await s.send('cita');enabled=true;await s.app.submit(b,known,randomUUID(),{kind:'ACTION',value:text(choices(v)[0]!['id'])});const work=s.app.tick();await at;await s.app.submit(b,known,randomUUID(),{kind:'TEXT',value:control});release();await work;await s.tick(4);assert.equal((await s.f.rows('appointment')).length,0);assert.equal((await s.f.rows('local_calendar')).length,0);assert.equal(last(await s.app.snapshot(b,known))['outcome'],control==='humano'?'HUMAN_HANDOFF':'OFFER');
});
test('L2 consumed action whose worker dies before reservation expires automatically on restart',async t=>{
 const s=await setup(t,cut('local-claim.afterCommit'));await s.app.submit(b,known,randomUUID(),{kind:'TEXT',value:'menu'});const normal=new InteractiveBooking(s.scopes);t.after(()=>normal.stop());for(let i=0;i<3;i++)await normal.tick();const v=await normal.snapshot(b,known);await s.app.submit(b,known,randomUUID(),{kind:'ACTION',value:text(choices(v)[0]!['id'])});await s.app.tick();s.f.clock.instant+=900001;for(let i=0;i<4;i++)await normal.tick();assert.equal((await s.f.rows('appointment')).length,0);assert.match(text(last(await normal.snapshot(b,known))['text']),/venció/);
});
for(const mode of ['expired','menu'])test('L2 C3 exact '+mode+' confirmation schedule states ACTIVE booking in next customer reply',async t=>{
 let entries=0;const s=await setup(t,{async hit(p){if(p==='dispatch.beforeGate'&&++entries===2)throw Error('kill_confirmation_owner');}}),v=await s.send('cita');await s.choose(text(choices(v)[0]!['id']));assert.equal((await s.f.rows('appointment'))[0]!['state'],'ACTIVE');assert.equal((await s.f.rows('attempt')).find(a=>a['output_id'])!['state'],'ARMED');if(mode==='expired'){s.f.clock.instant+=3600000;await s.app.recovery.tick();}const next=await s.send(mode==='menu'?'menu':'hola');assert.match(text(last(next)['text']),/Tienes una cita confirmada/);assert.equal((await s.f.rows('output_intent'))[0]!['state'],'EXPIRED');
});
for(const point of ['prepare.afterArchive','prepare.beforeCommit','prepare.afterCommit'])test('L2 booking crash at '+point+' resumes original plan/attempt/confirmation identities',async t=>{
 let enabled=false;const s=await setup(t,{async hit(p){if(enabled)await cut(point).hit(p);}}),v=await s.send('cita');enabled=true;await s.app.submit(b,known,randomUUID(),{kind:'ACTION',value:text(choices(v)[0]!['id'])});await s.app.tick();const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());for(let i=0;i<5;i++)await next.tick();const done=await next.snapshot(b,known);assert.equal((done['appointments'] as ObjectValue[]).length,1);assert.equal((done['calendar'] as ObjectValue[]).length,1);assert.equal(last(done)['outcome'],'CONFIRMED');assert.equal((await s.f.archive.records()).filter(r=>r.key.startsWith('operation/')).length,1);
});
test('L2 C4 SQL lock timeout is terminal, tells customer to choose again and never retries that plan',async t=>{
 let hold:PoolClient|undefined,enabled=false;const s=await setup(t,{async hit(p){if(enabled&&p==='prepare.afterArchive'){hold=await s.f.admin.connect();await hold.query('BEGIN');await hold.query('SELECT 1 FROM core.resource WHERE business_id=$1 AND id=$2 FOR UPDATE',[b,s.f.id('resource')]);setTimeout(()=>{void hold!.query('ROLLBACK').finally(()=>hold!.release());},300);}}});
 const reducer=s.scopes[0]!.reducer,original=reducer.tx.bind(reducer);reducer.tx=async function<T>(business:string,body:(db:PoolClient)=>Promise<T>,point='',faults:Faults=noFaults):Promise<T>{return original(business,async db=>{await db.query("SET LOCAL lock_timeout='50ms'");return body(db);},point,faults);};const v=await s.send('cita');enabled=true;const again=await s.choose(text(choices(v)[0]!['id']));assert.match(text(last(again)['text']),/Elige un horario de nuevo/);assert.equal((await s.f.rows('appointment')).length,0);assert.equal((await s.f.rows('plan_rejection'))[0]!['reason'],'LOCK_TIMEOUT');await s.tick();assert.equal((await s.f.rows('attempt')).length,0);
});
test('L2 C4 resource conflict created after recheck is terminal and produces a fresh choose-again view',async t=>{
 let enabled=false;const s=await setup(t,{async hit(p){if(enabled&&p==='prepare.afterArchive'){enabled=false;const id=randomUUID();await s.f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',[b,id,'competitor']);const local=await s.f.rows('local_booking_intent'),slot=object(local[0]!['slot']);const {admission,raw}=await import('./support/helpers.js');const input=text((await admission(s.f,raw(s.f,'synthetic fixed command',b,randomUUID(),'competitor'))).inputs[0]!['inputId']);await plan(s.f,{inputId:input,customerId:id,startAt:text(slot['startAt']),endAt:text(slot['endAt']),bufferMinutes:15});}}});const offered=await s.send('cita');enabled=true;const again=await s.choose(text(choices(offered)[0]!['id']));assert.match(text(last(again)['text']),/Elige un horario de nuevo/);assert.equal((again['appointments'] as ObjectValue[]).length,0);assert.equal((await s.f.rows('plan_rejection'))[0]!['reason'],'RESOURCE_CONFLICT');
});
test('L2 local ingress seals one SQL-authoritative v2 class; request retries retain IDs and altered requests fail',async t=>{
 const s=await setup(t),id=randomUUID(),one=await s.app.submit(b,known,id,{kind:'TEXT',value:'menu'}),two=await s.app.submit(b,known,id,{kind:'TEXT',value:'menu'});assert.equal(one.inputId,two.inputId);await assert.rejects(s.app.submit(b,known,id,{kind:'TEXT',value:'cita'}));assert.equal((await s.f.rows('input')).length,1);const c=object((await s.f.rows('input_classification'))[0]!['value']);assert.equal(c['version'],2);assert.equal(c['ruleVersion'],'L2-LOCAL-1');await assert.rejects(s.app.submit(b,known,randomUUID(),{kind:'TEXT',value:'menu',tenant_id:'synthetic-b'} as never),/input_schema/);
});
test('L2 SQL rejects missing claim rows even with valid seals and an existing conversation session',async t=>{
 const s=await setup(t),{admission,raw}=await import('./support/helpers.js'),legacy=await admission(s.f,raw(s.f,'hola')),inputId=text(legacy.inputs[0]!['inputId']);await s.send('menu');const session=(await s.f.rows('local_session'))[0]!,view={businessId:b,inputId,revision:Number(session['revision'])+1,state:{oracle:{},outcome:'MENU'},replyId:randomUUID(),reply:{text:'una vista sin consumir',choices:[],outcome:'MENU'}};
 const seal=await s.f.archive.scope(b).ensure('invalid-local-view','LOCAL_VIEW',view);await s.f.role('sealer').seal(b,s.f.archive.scope(b),seal);const before=await s.f.snapshot();assert.equal(await s.f.role('reducer').tx(b,async db=>(await db.query('SELECT core.local_finish($1,$2,$3,$4) v',[b,seal.body,seal.key,seal.digest])).rows[0].v),false);await assert.rejects(s.f.role('reducer').tx(b,db=>db.query('SELECT core.local_name($1,$2,$3,$4)',[b,inputId,'Nombre Válido',randomUUID()])),/local_name_denied/);assert.deepEqual(await s.f.snapshot(),before);
});
test('L2 stale displayed action cannot leave human support; only Menu returns to booking',async t=>{
 const s=await setup(t),offered=await s.send('cita'),old=text(choices(offered)[0]!['id']);await s.send('humano');const human=await s.choose(old);assert.equal(last(human)['outcome'],'HUMAN_HANDOFF');assert.equal((await s.f.rows('appointment')).length,0);assert.equal(last(await s.send('cita'))['outcome'],'HUMAN_HANDOFF');assert.equal(last(await s.send('menu'))['outcome'],'OFFER');
});
test('L2 expired never-entered navigation reply expires safely without a false UNKNOWN diagnostic',async t=>{
 const s=await setup(t,cut('local-reply-entry.beforeCommit'));await s.app.submit(b,known,randomUUID(),{kind:'TEXT',value:'menu'});await s.app.tick();assert.equal((await s.f.rows('local_reply'))[0]!['state'],'PENDING');s.f.clock.instant+=900001;const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());await next.tick();const state=await next.snapshot(b,known);assert.equal((await s.f.rows('local_reply'))[0]!['state'],'EXPIRED');assert.equal((state['diagnostics'] as ObjectValue[]).some(d=>d['code']==='REPLY_UNKNOWN_HELD'),false);
});
