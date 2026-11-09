import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {DateTime} from 'luxon';
import {fixture,cut,plan,apply} from './support/helpers.js';
import {l1Config} from './support/l1-calendar.js';
import {InteractiveBooking,type LocalScope} from '../src/application/interactive-booking.js';
import {object,text,type ObjectValue,type Faults} from '../src/domain/protocol.js';
import {bookingCustomerName,NAME_REPROMPT} from '../src/domain/customer-name.js';
import {localRoutingDecision,normalizedText} from '../src/domain/classification.js';
import {appointmentOverview} from '../src/domain/appointment-summary.js';
import {parseAppointmentDate,explainDate} from '../src/domain/appointment-date.js';
import {shortDate} from '../src/domain/short-date.js';
const b='synthetic-a',known='customer-'+b;
async function setup(t:TestContext,faults?:Faults){
 const f=await fixture(t),scopes:LocalScope[]=[];
 for(const id of [b,'synthetic-b']){const config={...l1Config('UTC'),businessId:id,calendarId:'calendar-'+id};await f.admin.query('INSERT INTO core.local_customer VALUES($1,$2,$3)',[id,f.id('customer',id),'Ana Ejemplo']);scopes.push({businessName:id===b?'Juanita':'Bernard',config,bindings:{businessId:id,calendar:{id:config.calendarId,coreId:f.id('calendar',id)},employees:new Map([['employee-a',f.id('resource',id)]])},channelId:f.id('channel',id),employeeNames:new Map([['employee-a','Lucía']]),archive:f.archive.scope(id),ingress:f.role('ingress'),reducer:f.role('reducer'),sealer:f.role('sealer'),dispatcher:f.role('dispatch'),result:f.role('result')});}
 const app=new InteractiveBooking(scopes,faults);t.after(()=>app.stop());const tick=async()=>{for(let i=0;i<4;i++)await app.tick();};const send=async(value:string,subject=known,kind:'TEXT'|'ACTION'='TEXT',business=b)=>{await app.submit(business,subject,randomUUID(),{kind,value});await tick();return app.snapshot(business,subject);};
 const customer=async(subject:string)=>{const id=randomUUID();await f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',[b,id,subject]);await f.admin.query('INSERT INTO core.local_customer VALUES($1,$2,$3)',[b,id,'Cliente '+subject]);};
 const twoEmployees=()=>{const s=scopes[0]!;s.config.employees=[...s.config.employees,{...s.config.employees[0]!,id:'employee-b'}];s.bindings.employees=new Map([...s.bindings.employees,['employee-b',f.id('otherResource')]]);s.employeeNames=new Map([...s.employeeNames,['employee-b','Sofía']]);};return {f,app,scopes,tick,send,customer,twoEmployees};
}
const last=(s:ObjectValue)=>object((s['replies'] as ObjectValue[]).at(-1)!['payload']);
const choices=(s:ObjectValue)=>last(s)['choices'] as ObjectValue[];
const replyText=(s:ObjectValue)=>[...((last(s)['precedingTexts']??[]) as string[]),text(last(s)['text'])].join('\n');

for(const value of ['hola','Hola!','HORARIOS','gracias','¡Muchas gracias!','gracias por todo','hola buenas tardes','Hola, soy Carlos','Sí, gracias','buenos días','ok','de acuerdo','quiero una cita','necesito ayuda','hola ½','horarios por favor','cita mañana','menu por favor'])test('PR16 C1 conversational name input cannot create a customer/booking: '+value,async t=>{
 const s=await setup(t),subject='new-name',offer=await s.send('cita',subject);await s.send(text(choices(offer)[0]!['id']),subject,'ACTION');const state=await s.send(value,subject);
 assert.equal((await s.f.rows('customer')).some(r=>r['subject']===subject),false);for(const table of ['appointment','operation','attempt','protection','mutation_guard','local_booking_intent'])assert.equal((await s.f.rows(table)).length,0,table);
 assert.equal((await s.f.archive.records()).some(r=>r.key.startsWith('local-name/')),false);
 const outcome=normalizedText(value)==='hola'?'MENU':normalizedText(value)==='horarios'?'OFFER':'NAME_REQUIRED';assert.equal(last(state)['outcome'],outcome);if(outcome==='NAME_REQUIRED')assert.equal(last(state)['text'],NAME_REPROMPT);
});
for(const name of ['Ana','Sol','Luz','María Fernández','José Ángel de la Cruz',"D’Arcy O’Connor",'Jean-Luc Picard','Graciela Gracias'])test('PR16 C1 valid name retains direct booking: '+name,async t=>{const s=await setup(t),subject='valid-name',offer=await s.send('cita',subject);await s.send(text(choices(offer)[0]!['id']),subject,'ACTION');const done=await s.send(name,subject);assert.equal(last(done)['outcome'],'CONFIRMED');assert.equal(last(done)['customer'],name);assert.equal((done['appointments'] as ObjectValue[]).length,1);});
for(const command of ['menu','hola','horarios','cita','agendar','reagendar','cancelar','humano'])test('PR16 C1 explicit command after expired name prompt still routes safely: '+command,async t=>{const s=await setup(t),subject='expired-name',offer=await s.send('cita',subject);await s.send(text(choices(offer)[0]!['id']),subject,'ACTION');s.f.clock.instant+=900001;const state=await s.send(command,subject);assert.equal((await s.f.rows('customer')).some(r=>r['subject']===subject),false);assert.equal((await s.f.rows('appointment')).length,0);assert.equal(last(state)['outcome'],['menu','hola','reagendar','cancelar'].includes(command)?'MENU':command==='humano'?'HUMAN_HANDOFF':'OFFER');});
test('PR16 C1 bounded conversational validation accepts names without requiring two surnames',()=>{for(const x of ['gracias😊','María¹','12345','x','<María>','a'.repeat(121)])assert.equal(bookingCustomerName(x),null);assert.equal(bookingCustomerName(' María   de la Luz '),'María de la Luz');});

test('PR16 C2 P3b Unicode support messages remain quiet and all reach the queue with sealed routing',async t=>{
 const s=await setup(t),entry=await s.send('humano'),n=(entry['replies'] as ObjectValue[]).length;
 for(const value of ['menu ½','Menu¹','½ menu','menu²','me½nu','Necesito ayuda','hola','horarios']){const id=randomUUID(),one=await s.app.submit(b,known,id,{kind:'TEXT',value});await s.tick();await s.app.submit(b,known,id,{kind:'TEXT',value});await s.tick();const state=await s.app.snapshot(b,known);assert.equal((state['replies'] as ObjectValue[]).length,n);assert.equal((await s.f.rows('local_support_message')).some(q=>q['input_id']===one.inputId),true);const receipt=await s.f.archive.scope(b).lookup(`local-input/${b}/${id}`);assert.deepEqual(receipt!.body['routing'],localRoutingDecision({kind:'TEXT',value}));}
 assert.equal((await s.f.rows('local_support_message')).length,9);assert.equal((await s.f.rows('appointment')).length,0);assert.equal(last(await s.send('MENÚ!'))['outcome'],'MENU');assert.equal((await s.f.rows('local_support_message')).length,9);
});

test('PR16 C2 Unicode property: actual INSERT/UPDATE queue trigger agrees with application authority over numeric/mark/letter corpus',async t=>{
 const s=await setup(t);await s.send('humano');const corpus=new Set<string>(['menu','MENÚ!',' Menu ','menu ½','Menu¹','½ menu','menu²']);
 for(let cp=0x20;cp<=0x10ffff;cp++){
  if(cp>=0xd800&&cp<=0xdfff)continue;const ch=String.fromCodePoint(cp);
  if(/\p{N}/u.test(ch)||(cp>=0x300&&cp<=0x36f)||(cp>=0x00a0&&cp<=0x024f))for(const value of ['menu'+ch,ch+'menu','me'+ch+'nu'])corpus.add(value);
 }
 const input=object((await s.f.rows('input'))[0]),classification=object((await s.f.rows('input_classification'))[0]);const records=[...corpus].map((value,index)=>({id:randomUUID(),key:'unicode-'+index,value,routing:localRoutingDecision({kind:'TEXT',value}),sequence:100+index}));
 const expected=records.filter(r=>normalizedText(r.value)!=='menu').map(r=>r.id).sort();
 await s.f.admin.query("INSERT INTO core.role_scope VALUES('postgres',$1) ON CONFLICT DO NOTHING",[b]);const bulk=await s.f.admin.connect();try{await bulk.query('BEGIN');await bulk.query("SELECT set_config('wp1.business_id',$1,true)",[b]);
 for(let from=0;from<records.length;from+=500){const chunk=records.slice(from,from+500);await bulk.query(`INSERT INTO core.input SELECT (jsonb_populate_record(NULL::core.input,$2::jsonb||jsonb_build_object('id',x->>'id','provider_id',x->>'id','sequence',(x->>'sequence')::bigint,'event',jsonb_build_object('type','text','text',jsonb_build_object('body',x->>'value'))))).* FROM jsonb_array_elements($1::jsonb) x`,[JSON.stringify(chunk),input]);
  await bulk.query(`INSERT INTO core.seal(business_id,stable_key,kind,digest,receipt) SELECT $2,x->>'key','LOCAL_INPUT',repeat('a',64),jsonb_build_object('body',jsonb_build_object('routing',x->'routing')) FROM jsonb_array_elements($1::jsonb) x`,[JSON.stringify(chunk),b]);
  await bulk.query(`INSERT INTO core.input_classification SELECT (jsonb_populate_record(NULL::core.input_classification,$2::jsonb||jsonb_build_object('input_id',x->>'id','seal_key',x->>'key'))).* FROM jsonb_array_elements($1::jsonb) x`,[JSON.stringify(chunk),classification]);
  await bulk.query(`INSERT INTO core.local_message SELECT $2,(x->>'id')::uuid,(x->>'id')::uuid,jsonb_build_object('kind','TEXT','value',x->>'value'),'QUEUED',NULL,NULL FROM jsonb_array_elements($1::jsonb) x`,[JSON.stringify(chunk),b]);
 }
 await bulk.query('COMMIT');
 const ids=new Set<string>(records.map(r=>r.id));assert.deepEqual((await s.f.rows('local_support_message')).map(r=>text(r['input_id'])).filter(id=>ids.has(id)).sort(),expected);
 // A second, not-yet-human conversation admits the same corpus without queueing.
 // Only its later authoritative HUMAN_HANDOFF results may append references.
 const deferredConversation=randomUUID(),deferred=records.map((r,i)=>({...r,id:randomUUID(),key:'deferred-'+i}));
 const deferredIds=new Set<string>(deferred.map(r=>r.id)),deferredExpected=deferred.filter(r=>normalizedText(r.value)!=='menu').map(r=>r.id).sort();
 await bulk.query('BEGIN');await bulk.query("SELECT set_config('wp1.business_id',$1,true)",[b]);
 await bulk.query('INSERT INTO core.conversation VALUES($1,$2,$3,$4,1)',[b,deferredConversation,s.f.id('channel'),'pending-human-property']);
 await bulk.query('INSERT INTO core.local_session(business_id,conversation_id) VALUES($1,$2)',[b,deferredConversation]);
 for(let from=0;from<deferred.length;from+=500){const chunk=deferred.slice(from,from+500);await bulk.query(`INSERT INTO core.input SELECT (jsonb_populate_record(NULL::core.input,$2::jsonb||jsonb_build_object('id',x->>'id','provider_id',x->>'id','sequence',(x->>'sequence')::bigint,'event',jsonb_build_object('type','text','text',jsonb_build_object('body',x->>'value'))))).* FROM jsonb_array_elements($1::jsonb) x`,[JSON.stringify(chunk),{...input,conversation_id:deferredConversation,subject:'pending-human-property'}]);
  await bulk.query(`INSERT INTO core.seal(business_id,stable_key,kind,digest,receipt) SELECT $2,x->>'key','LOCAL_INPUT',repeat('a',64),jsonb_build_object('body',jsonb_build_object('routing',x->'routing')) FROM jsonb_array_elements($1::jsonb) x`,[JSON.stringify(chunk),b]);
  await bulk.query(`INSERT INTO core.input_classification SELECT (jsonb_populate_record(NULL::core.input_classification,$2::jsonb||jsonb_build_object('input_id',x->>'id','seal_key',x->>'key'))).* FROM jsonb_array_elements($1::jsonb) x`,[JSON.stringify(chunk),classification]);
  await bulk.query(`INSERT INTO core.local_message SELECT $2,(x->>'id')::uuid,(x->>'id')::uuid,jsonb_build_object('kind','TEXT','value',x->>'value'),'QUEUED',NULL,NULL FROM jsonb_array_elements($1::jsonb) x`,[JSON.stringify(chunk),b]);
 }

 await bulk.query('COMMIT');assert.equal((await s.f.rows('local_support_message')).some(q=>deferredIds.has(text(q['input_id']))),false);
 await bulk.query('BEGIN');await bulk.query("SELECT set_config('wp1.business_id',$1,true)",[b]);
 for(let from=0;from<deferred.length;from+=500)await bulk.query(`UPDATE core.local_message m SET state='DONE',result=jsonb_build_object('state',jsonb_build_object('outcome',CASE WHEN x->'routing'->>'outcome'='NAVIGATION' THEN 'MENU' ELSE 'HUMAN_HANDOFF' END)) FROM jsonb_array_elements($1::jsonb) x WHERE m.business_id=$2 AND m.input_id=(x->>'id')::uuid`,[JSON.stringify(deferred.slice(from,from+500)),b]);
 await bulk.query('COMMIT');
 assert.deepEqual((await s.f.rows('local_support_message')).map(r=>text(r['input_id'])).filter(id=>deferredIds.has(id)).sort(),deferredExpected);assert.equal((await s.f.rows('appointment')).length,0);assert.ok(records.length>5000);
 console.log(JSON.stringify({supportUnicodeProperty:{candidates:records.length,admissions:records.length+deferred.length,queuedPerPath:expected.length,mismatches:0,actualTriggers:['INSERT','DEFERRED_UPDATE'],allUnicodeNumericCodePoints:true,unicode:process.versions.unicode,platform:process.platform}}));
 }finally{await bulk.query('ROLLBACK').catch(()=>{});bulk.release();}
});

test('PR16 C2 application outcome is authoritative on completion of legacy routing-free admission',async t=>{
 const s=await setup(t);await s.send('humano');const id=randomUUID(),subject=known,payload={kind:'TEXT',value:'Menu¹'};const conv=(await s.f.rows('conversation'))[0]!,seal=await s.f.archive.scope(b).ensure(`local-input/${b}/${id}`,'LOCAL_INPUT',{version:1,businessId:b,requestId:id,channelId:s.f.id('channel'),subject,payload},()=>({inputId:randomUUID(),conversationId:conv['id']!,receivedAt:s.f.clock.now().toISOString()}));
 const before=(await s.f.rows('local_support_message')).length;const res=await s.app.submit(b,subject,id,{kind:'TEXT',value:'Menu¹'});assert.equal(res.inputId,seal.body['inputId']);await s.tick();assert.equal((await s.f.rows('local_support_message')).length,before+1);assert.deepEqual((await s.f.archive.scope(b).lookup(`local-input/${b}/${id}`))!.body,seal.body);
});

test('PR16 C2 human burst before Menu survives restart; post-Menu input stays out of the old queue',async t=>{
 const s=await setup(t);await s.send('humano');const ids=[];for(const value of ['menu ½','Menu¹','tercero'])ids.push((await s.app.submit(b,known,randomUUID(),{kind:'TEXT',value})).inputId);await s.app.submit(b,known,randomUUID(),{kind:'TEXT',value:'menu'});const after=await s.app.submit(b,known,randomUUID(),{kind:'TEXT',value:'después del menú'});const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());for(let i=0;i<5;i++)await next.tick();const queue=(await s.f.rows('local_support_message')).map(q=>q['input_id']);assert.ok(ids.every(id=>queue.includes(id)));assert.equal(queue.includes(after.inputId),false);assert.equal(last(await next.snapshot(b,known))['outcome'],'MENU');
});

for(const point of ['local-claim.afterCommit','local-view.beforeCommit','local-view.afterCommit'])test('PR16 C1/C2 conversational rejection/Unicode queue survives '+point,async t=>{const s=await setup(t),entry=await s.send('humano'),worker=new InteractiveBooking(s.scopes,cut(point));t.after(()=>worker.stop());const id=randomUUID(),one=await worker.submit(b,known,id,{kind:'TEXT',value:'menu ½'});await worker.tick();await s.tick();assert.equal((await s.f.rows('local_support_message')).filter(q=>q['input_id']===one.inputId).length,1);assert.equal((await s.app.snapshot(b,known))['replies'] instanceof Array,true);assert.equal(((await s.app.snapshot(b,known))['replies'] as ObjectValue[]).length,(entry['replies'] as ObjectValue[]).length);});

for(const request of ['cita','horarios','menu'])test('PR16 C3 past delivered appointments are omitted from '+request+' replies',async t=>{const s=await setup(t),offer=await s.send('cita');await s.send(text(choices(offer)[0]!['id']),known,'ACTION');const appointment=(await s.f.rows('appointment'))[0]!;s.f.clock.instant=Date.parse(text(appointment['end_at']))+3*86400000;const view=await s.send(request);assert.doesNotMatch(replyText(view),/Tu cita actual|Tus próximas citas|Cita registrada/);assert.equal((view['appointments'] as ObjectValue[]).length,1);});
test('PR16 C3 delayed expired confirmation remains visible as a historical fact, not current/upcoming',async t=>{const s=await setup(t),p=await plan(s.f);await apply(t,s.f,p);s.f.clock.instant=Date.parse(text(p.body['endAt']))+3*86400000;await s.app.recovery.tick();const view=await s.send('cita');assert.match(replyText(view),/Cita registrada para el/);assert.match(replyText(view),/entrega.*no está verificada/);assert.doesNotMatch(replyText(view),/Tu cita actual|Tus próximas citas/);assert.equal((view['appointments'] as ObjectValue[]).length,1);});

test('PR16 C4 upcoming overview matches approved v0.8.1 exactly for0/1/2/many and business zones',()=>{
 const module={exports:{} as {appointmentOverview:(rows:{start:string;end:string}[],zone:string)=>string}};new vm.Script(readFileSync(fileURLToPath(new URL('../../../backend/lib/appointment-messages.js',import.meta.url)),'utf8')).runInNewContext({module,require:(id:string)=>{assert.equal(id,'luxon');return {DateTime};}});
 for(const zone of ['UTC','America/Mexico_City','Europe/Madrid'])for(const count of [0,1,2,90]){const rows=Array.from({length:count},(_,i)=>({start:DateTime.fromISO('2030-01-02T01:00:00Z').plus({days:i}).toISO()!,end:DateTime.fromISO('2030-01-02T02:00:00Z').plus({days:i}).toISO()!}));assert.equal(appointmentOverview(rows,zone),module.exports.appointmentOverview(rows,zone));}
});
test('PR16 C4 useful menu instructions are explicit, management remains unavailable, and no generic escalation invitation appears',async t=>{const s=await setup(t),state=await s.send('menu');for(const word of ['"cita"','"agendar"','"horarios"','"menu"','"humano"'])assert.ok(replyText(state).includes(word));assert.match(replyText(state),/aún no están disponibles/);assert.doesNotMatch(replyText(state),/O escribe tu mensaje para hablar/);const after=await s.send('quiero hablar con Juanita');assert.equal(last(after)['outcome'],'MENU');assert.equal((await s.f.rows('local_support_message')).length,0);});

for(const [value,outcome,iso]of [['mié 11 nov',true,'2026-11-11'],['Mié, 11 nov.',true,'2026-11-11'],['sáb 7 nov',true,'2026-11-07'],['lunes 2 de noviembre',false,'PAST'],['lun 2 nov',false,'PAST'],['jueves 1 de enero',false,'INVALID'],['miércoles 31 de noviembre',false,'INVALID'],['mié 11 nov 09:00',false,'INVALID']] as const)test('PR16 C5 own short label and past-date safety: '+value,()=>{
 const options={now:value==='jueves 1 de enero'?'2026-12-31T12:00:00Z':'2026-11-07T05:30:00Z',timeZone:'America/Mexico_City'},r=parseAppointmentDate(value,options);assert.equal(r.success,outcome);assert.equal(outcome?r.date:r.error,iso);if(r.error==='PAST')assert.match(explainDate(value,r),/ya pasó/);
});
test('PR16 C5 every emitted date-only label round-trips in its active year without weakening horizon/weekday checks',()=>{const now='2026-11-07T05:30:00Z',zone='America/Mexico_City';for(let offset=0;offset<180;offset++){const day=DateTime.fromISO(now).setZone(zone).startOf('day').plus({days:offset}),r=parseAppointmentDate(shortDate(day.toISO()!,zone,false),{now,timeZone:zone});assert.equal(r.date,day.toISODate());}assert.equal(parseAppointmentDate('mié 11 nov 2027',{now,timeZone:zone}).success,false);assert.equal(parseAppointmentDate('mar 29 feb 2028',{now,timeZone:zone}).error,'OUT_OF_HORIZON');});

test('PR16 C6 Ana UNKNOWN remains unchanged under conversational commands and queue fixes',async t=>{const s=await setup(t),offer=await s.send('cita');s.app.providers.get(b)!.failure='BEFORE_APPLY';await s.send(text(choices(offer)[0]!['id']),known,'ACTION');const before=await Promise.all(['appointment','attempt','operation','protection','mutation_guard','local_ledger'].map(table=>s.f.rows(table)));const replies=(await s.app.snapshot(b,known))['replies'];for(const value of ['menu','humano','hola','horarios'])await s.app.submit(b,known,randomUUID(),{kind:'TEXT',value});await s.tick();assert.deepEqual(await Promise.all(['appointment','attempt','operation','protection','mutation_guard','local_ledger'].map(table=>s.f.rows(table))),before);assert.deepEqual((await s.app.snapshot(b,known))['replies'],replies);});

for(const point of ['local-claim.afterCommit','local-view.beforeCommit','local-view.afterCommit'])test('PR16 C1 greeting rejection remains non-mutating across '+point,async t=>{const s=await setup(t),subject='restart-name',offer=await s.send('cita',subject);await s.send(text(choices(offer)[0]!['id']),subject,'ACTION');const worker=new InteractiveBooking(s.scopes,cut(point));t.after(()=>worker.stop());await worker.submit(b,subject,randomUUID(),{kind:'TEXT',value:'muchas gracias'});await worker.tick();await s.tick();assert.equal((await s.f.rows('customer')).some(r=>r['subject']===subject),false);assert.equal((await s.f.rows('appointment')).length,0);assert.equal(last(await s.app.snapshot(b,subject))['text'],NAME_REPROMPT);});

test('PR16 C2 migration009 repairs omitted Unicode queue references and rolls back atomically without touching Ana/history',async t=>{
 const s=await setup(t);await s.f.admin.query('DROP TRIGGER local_support_route ON core.local_message; DROP FUNCTION core.local_support_route_v2(); CREATE TRIGGER local_support_route AFTER INSERT OR UPDATE OF state ON core.local_message FOR EACH ROW EXECUTE FUNCTION core.local_support_route();');
 const ana=await s.send('cita');s.app.providers.get(b)!.failure='BEFORE_APPLY';await s.send(text(choices(ana)[0]!['id']),known,'ACTION');s.app.providers.get(b)!.failure='NONE';await s.send('humano','Pedro');await s.send('menu ½','Pedro');await s.send('Menu¹','Pedro');
 const before=await s.f.snapshot(),missing=(await s.f.rows('local_message')).filter(m=>['menu ½','Menu¹'].includes(text(object(m['payload'])['value']))).map(m=>m['input_id']);assert.equal((await s.f.rows('local_support_message')).some(q=>missing.includes(q['input_id'])),false);
 const sql=readFileSync(fileURLToPath(new URL('../../src/infrastructure/postgres/migrations/009-local-review-corrections.sql',import.meta.url)),'utf8');
 await s.f.admin.query('BEGIN');await assert.rejects(s.f.admin.query(sql.replace('-- Recover omitted queue references','SELECT 1/0;\n-- Recover omitted queue references')),/division by zero/);await s.f.admin.query('ROLLBACK');assert.deepEqual(await s.f.snapshot(),before);assert.equal((await s.f.admin.query("SELECT to_regprocedure('core.local_support_route_v2()') v")).rows[0].v,null);
 await s.f.admin.query('BEGIN');await s.f.admin.query(sql);await s.f.admin.query('COMMIT');const after=await s.f.snapshot();for(const table of Object.keys(before.tables))if(table!=='local_support_message')assert.deepEqual(after.tables[table],before.tables[table],table);assert.ok(missing.every(id=>after.tables['local_support_message']!.some(q=>q['input_id']===id)));assert.equal((await s.f.rows('attempt')).filter(a=>a['state']==='UNKNOWN').length,1);
});

test('PR16 C5 short date labels work only in active date flow and past weekday dates explain recovery',async t=>{const s=await setup(t);s.f.clock.instant=Date.parse('2026-11-07T05:30:00Z');s.scopes[0]!.config.timeZone='America/Mexico_City';const idle=await s.send('mié 11 nov');assert.equal(last(idle)['outcome'],'MENU');await s.send('cita');const active=await s.send('mié 11 nov');assert.equal(last(active)['outcome'],'OFFER');assert.match(text(choices(active)[0]!['title']),/^mié 11 nov /);const past=await s.send('lunes 2 de noviembre');assert.match(replyText(past),/ya pasó/);assert.equal((await s.f.rows('appointment')).length,0);});

for(const routing of [{version:2,outcome:'NO_EFFECT'},{version:1,outcome:'UNSUPPORTED'}])test('PR16 C2 unsupported frozen routing is held without a replacement input identity: '+JSON.stringify(routing),async t=>{const s=await setup(t);await s.send('humano');const requestId=randomUUID(),conversation=(await s.f.rows('conversation'))[0]!,payload={kind:'TEXT',value:'menu ½'},seal=await s.f.archive.scope(b).ensure(`local-input/${b}/${requestId}`,'LOCAL_INPUT',{version:1,businessId:b,requestId,channelId:s.f.id('channel'),subject:known,payload},()=>({inputId:randomUUID(),conversationId:conversation['id']!,receivedAt:s.f.clock.now().toISOString(),routing}));for(let i=0;i<2;i++)await assert.rejects(s.app.submit(b,known,requestId,{kind:'TEXT',value:'menu ½'}),/local_routing_version_denied/);assert.deepEqual((await s.f.archive.scope(b).lookup(`local-input/${b}/${requestId}`))!.body,seal.body);assert.equal((await s.f.rows('input')).length,1);assert.equal((await s.f.rows('local_support_message')).length,1);assert.equal((await s.f.rows('appointment')).length,0);});
