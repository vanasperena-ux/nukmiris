import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DateTime} from 'luxon';
import {fixture,cut} from './support/helpers.js';
import {l1Config} from './support/l1-calendar.js';
import {InteractiveBooking,type LocalScope} from '../src/application/interactive-booking.js';
import {object,text,type ObjectValue,type Faults} from '../src/domain/protocol.js';
import {bookingCustomerName,NAME_REPROMPT} from '../src/domain/customer-name.js';
import {appointmentOverview} from '../src/domain/appointment-summary.js';
import {whatsappMessages} from '../src/domain/whatsapp-presentation.js';

const b='synthetic-a',known='customer-'+b;
async function setup(t:TestContext,faults?:Faults){
 const f=await fixture(t),scopes:LocalScope[]=[];
 for(const id of [b,'synthetic-b']){const config={...l1Config('UTC'),businessId:id,calendarId:'calendar-'+id};await f.admin.query('INSERT INTO core.local_customer VALUES($1,$2,$3)',[id,f.id('customer',id),'Ana Ejemplo']);scopes.push({businessName:id===b?'Juanita':'Bernard',config,bindings:{businessId:id,calendar:{id:config.calendarId,coreId:f.id('calendar',id)},employees:new Map([['employee-a',f.id('resource',id)]])},channelId:f.id('channel',id),employeeNames:new Map([['employee-a','Lucía']]),archive:f.archive.scope(id),ingress:f.role('ingress'),reducer:f.role('reducer'),sealer:f.role('sealer'),dispatcher:f.role('dispatch'),result:f.role('result')});}
 let app=new InteractiveBooking(scopes,faults);t.after(()=>app.stop());
 const tick=async()=>{for(let i=0;i<4;i++)await app.tick();};
 const send=async(value:string,subject=known,kind:'TEXT'|'ACTION'='TEXT',requestId=randomUUID(),business=b)=>{const admitted=await app.submit(business,subject,requestId,{kind,value});await tick();return {admitted,state:await app.snapshot(business,subject)};};
 const seed=async(count:number,subject=known,business=b)=>{let customer=(await f.admin.query('SELECT id FROM core.customer WHERE business_id=$1 AND subject=$2',[business,subject])).rows[0]?.id;if(!customer){customer=randomUUID();await f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',[business,customer,subject]);await f.admin.query('INSERT INTO core.local_customer VALUES($1,$2,$3)',[business,customer,'Otra Persona']);}const rows=[];
  for(let i=0;i<count;i++){const start=DateTime.fromISO('2030-01-02T09:00:00Z').plus({days:i}),end=start.plus({hours:1});await f.admin.query("INSERT INTO core.appointment VALUES($1,$2,$3,$4,$5,$6,'APP_CREATED','ACTIVE',2,2,$7,$8,15)",[business,randomUUID(),f.id('calendar',business),customer,f.id('resource',business),randomUUID(),start.toISO(),end.toISO()]);rows.push({start:start.toISO()!,end:end.toISO()!});}return rows;};
 const namePrompt=async(subject:string)=>{const offered=await send('cita',subject);const selected=await send(text(choices(offered.state)[0]!['id']),subject,'ACTION');assert.equal(last(selected.state)['outcome'],'NAME_REQUIRED');return selected;};
 return {f,scopes,get app(){return app;},send,tick,seed,namePrompt,async restart(){await app.stop();app=new InteractiveBooking(scopes);await tick();}};
}
const last=(s:ObjectValue)=>object((s['replies'] as ObjectValue[]).at(-1)!['payload']);
const choices=(s:ObjectValue)=>last(s)['choices'] as ObjectValue[];
const replyText=(s:ObjectValue)=>[...((last(s)['precedingTexts']??[]) as string[]),text(last(s)['text'])].join('\n');
const overview=/Tu cita actual|Tus próximas citas|Cita registrada/;
async function noNewCustomerOrEffects(s:Awaited<ReturnType<typeof setup>>,subject:string){
 assert.equal((await s.f.rows('customer')).some(r=>r['subject']===subject),false);
 for(const table of ['appointment','operation','attempt','protection','mutation_guard','local_booking_intent'])assert.equal((await s.f.rows(table)).length,0,table);
 assert.equal((await s.f.rows('local_ledger')).filter(r=>r['kind']==='CORE').length,0);
 assert.equal((await s.f.archive.records()).some(r=>r.key.startsWith('local-name/')||r.key.startsWith('local-intent/')||r.key.startsWith('operation/')),false);
}

// Retains Claude Q1's independent corpus; each string crosses the actual application boundary.
const notNames=['hola','Hola!','holaa','hola :)','buenas','buenas tardes, soy Ana','gracias','gracias!!','muchas gracias','ok','ok gracias','okey gracias','perfecto gracias','claro','sí claro','si, claro','entendido','está bien','esta bien','ya','listo gracias','espera','un momento','momento','cuánto cuesta','cuanto cuesta?','dónde están','quiero agendar','quiero otra hora','otro horario','más opciones','mas tarde','cambiar fecha','no puedo','mañana','lunes','el lunes','mié 11 nov','a las 10','jajaja','👍','ok 👍','sí','no','vale','genial','super','de nada','bien','me equivoqué','cancelar por favor','quiero cancelar','reagendar mi cita','horarios disponibles','menu principal','hablar con alguien','humano por favor','ayuda por favor','tengo una duda','?','...','hola soy nuevo','me llamo','nombre','mi nombre es','prefiero otro día','gracias, adiós','bye'];
for(const value of notNames)test('C1 final Claude68 corpus rejects without identity or booking: '+value,async t=>{
 const s=await setup(t),subject='invalid';await s.namePrompt(subject);const result=await s.send(value,subject);await noNewCustomerOrEffects(s,subject);assert.notEqual(last(result.state)['outcome'],'CONFIRMED',value);assert.equal(bookingCustomerName(value),null,value);
});
for(const [value,name] of [['Ana','Ana'],['Sol','Sol'],['Luz','Luz'],['me llamo maría fernández','maría fernández'],['José Ángel de la Cruz','José Ángel de la Cruz'],['Ana María O’Neil','Ana María O’Neil'],["D’Arcy O’Connor","D’Arcy O’Connor"],['Jean-Luc Picard','Jean-Luc Picard'],['Graciela Gracias','Graciela Gracias'],['Valentina Hola','Valentina Hola'],['Vale Gómez','Vale Gómez'],['Mar Pérez','Mar Pérez'],['Julio César','Julio César'],['Ma. del Carmen Pérez','Ma. del Carmen Pérez'],['Ana M.','Ana M.'],['Me llamo Ana López','Ana López'],['Soy Carlos Pérez','Carlos Pérez'],['Mi nombre es María López','María López'],['Mari\u0301a Lo\u0301pez','María López'],['Me llamo Julio','Julio'],['María\u00a0Fernández','María Fernández']] as const)test('C1 final valid name retains direct booking: '+value,async t=>{
 const s=await setup(t),subject='valid';await s.namePrompt(subject);const done=await s.send(value,subject);assert.equal(last(done.state)['outcome'],'CONFIRMED');assert.equal(last(done.state)['customer'],name);assert.equal((await s.f.rows('appointment')).length,1);assert.equal((await s.f.rows('customer')).find(c=>c['subject']===subject)!['id'],(await s.f.rows('local_customer')).find(c=>c['name']===name)!['customer_id']);
});
for(const value of ['humano','menu','cita','agendar','cancelar','reagendar','hablar con alguien'])test('C1 final supported command routes before name capture: '+value,async t=>{
 const s=await setup(t);await s.namePrompt('command');const state=(await s.send(value,'command')).state;await noNewCustomerOrEffects(s,'command');assert.equal(last(state)['outcome'],['humano','hablar con alguien'].includes(value)?'HUMAN_HANDOFF':['cita','agendar'].includes(value)?'OFFER':'MENU');
});
test('C1 final structural syntax/compatibility checks reject novel malformed names at actual boundary',async t=>{
 const s=await setup(t),subject='syntax';await s.namePrompt(subject);
 for(const v of ['María 99','Ana@example.com','Ana / María','Ana🙂','Ana\nMaría','Ana\u200bMaría','-María','María-','Ana..','M.','de la','María de','a b c','aaaaaaaa','quiero-cancelar','Ana-cancelar','ｍｅｎｕ','ｑｕｉｅｒｏ ａｇｅｎｄａｒ','Julio','Domingo','Cita Rodríguez','solo consultaba','busco atención','pido información','eso funciona','Estoy ocupado','Soy cliente','SOY CLIENTE','Soy empleado','Pido Información','Estoy Ocupado','Puedes Ayudarme','maría fernández']){const state=(await s.send(v,subject)).state;assert.equal(last(state)['outcome'],'NAME_REQUIRED',v);assert.equal(last(state)['text'],NAME_REPROMPT,v);await noNewCustomerOrEffects(s,subject);}
 for(const v of ['',' ','\t\n']){const before=await s.f.rows('input');await assert.rejects(s.app.submit(b,subject,randomUUID(),{kind:'TEXT',value:v}),/input_schema/);assert.deepEqual(await s.f.rows('input'),before);await noNewCustomerOrEffects(s,subject);}
 assert.equal(last((await s.send('María López',subject)).state)['outcome'],'CONFIRMED');
});
test('C1 final stale name replies, supersession, expiration and request replay never book another slot',async t=>{
 const s=await setup(t),subject='stale-name';await s.namePrompt(subject);const oldId=randomUUID(),old=await s.app.submit(b,subject,oldId,{kind:'TEXT',value:'María López'});await s.send('menu',subject);await s.namePrompt(subject);
 const retry=await s.app.submit(b,subject,oldId,{kind:'TEXT',value:'María López'});assert.equal(retry.inputId,old.inputId);await s.tick();await noNewCustomerOrEffects(s,subject);
 const invalidId=randomUUID();await s.send('quiero cancelar',subject,'TEXT',invalidId);await s.send('quiero cancelar',subject,'TEXT',invalidId);await s.send('quiero cancelar',subject);await noNewCustomerOrEffects(s,subject);
 await s.send('menu',subject);await s.send('María López',subject);await noNewCustomerOrEffects(s,subject);
 await s.namePrompt(subject);s.f.clock.instant+=900001;const expired=(await s.send('María López',subject)).state;assert.equal(last(expired)['outcome'],'OFFER');assert.match(replyText(expired),/venció/);await noNewCustomerOrEffects(s,subject);
 await s.namePrompt(subject);const id=randomUUID(),good=await s.send('María López',subject,'TEXT',id);assert.equal(last(good.state)['outcome'],'CONFIRMED');await s.restart();const repeated=await s.send('María López',subject,'TEXT',id);assert.equal(repeated.admitted.inputId,good.admitted.inputId);assert.equal((await s.f.rows('appointment')).length,1);assert.equal((await s.f.rows('attempt')).length,2);await assert.rejects(s.app.submit(b,subject,id,{kind:'TEXT',value:'Otro Nombre'}));
});
for(const point of ['local-claim.afterCommit','local-view.beforeCommit','local-view.afterCommit'])test('C1 final invalid name crash recovery cannot allocate booking at '+point,async t=>{
 const s=await setup(t);await s.namePrompt('crash-name');const crashing=new InteractiveBooking(s.scopes,cut(point));const input=await crashing.submit(b,'crash-name',randomUUID(),{kind:'TEXT',value:'quiero cancelar'});await crashing.tick();await crashing.stop();await s.restart();await noNewCustomerOrEffects(s,'crash-name');assert.equal((await s.f.rows('local_message')).find(m=>m['input_id']===input.inputId)!['state'],'DONE');assert.equal(last(await s.app.snapshot(b,'crash-name'))['text'],NAME_REPROMPT);
});

for(const count of [0,1,2,90])test('Summary59cde all '+count+' future appointments on menu/hola/direct cita/agendar, scoped and bounded',async t=>{
 const s=await setup(t),rows=await s.seed(count);await s.seed(1,'foreign-same-business');await s.seed(1,'customer-synthetic-b','synthetic-b');let cita:ObjectValue|undefined;
 for(const command of ['menu','Hola!','cita','AgEnDaR']){const result=(await s.send(command)).state,p=last(result),body=replyText(result);assert.equal(p['outcome'],['menu','Hola!'].includes(command)?'MENU':'OFFER');assert.equal(count===0?0:count===1?(body.match(/Tu cita actual es para el/g)??[]).length:(body.match(/^\d+\. /gm)??[]).length,count);if(count)assert.ok(body.includes(appointmentOverview(rows,'UTC')));else assert.doesNotMatch(body,overview);assert.ok(whatsappMessages(p as never));if(count===90)assert.ok((p['precedingTexts'] as unknown[]).length>0);if(command==='cita')cita=p;if(command==='AgEnDaR'){assert.equal(p['text'],cita!['text']);assert.deepEqual(p['precedingTexts'],cita!['precedingTexts']);assert.deepEqual((p['choices'] as ObjectValue[]).map(c=>c['title']),(cita!['choices'] as ObjectValue[]).map(c=>c['title']));}}
 assert.equal((await s.f.rows('operation')).length,0);assert.equal((await s.f.rows('attempt')).length,0);
});
for(const count of [2,90])test('Summary59cde interactive booking/date/recovery continuation never repeats '+count+' prior bookings',async t=>{
 const s=await setup(t);await s.seed(count);let state=(await s.send('menu')).state;
 const choose=async(index:number)=>{state=(await s.send(text(choices(state)[index]!['id']),known,'ACTION')).state;assert.doesNotMatch(replyText(state),overview);assert.equal(last(state)['precedingTexts'],undefined);};
 await choose(0);assert.equal(last(state)['outcome'],'OFFER');await choose(2);await choose(2);assert.equal(last(state)['outcome'],'DATES');await choose(0);await choose(2);assert.equal(last(state)['outcome'],'OFFER');
 for(const date of ['3 ene','31 nov']){state=(await s.send(date)).state;assert.doesNotMatch(replyText(state),overview);assert.equal(last(state)['precedingTexts'],undefined);}
 // Inherited long overview frames must not survive invalid-date reconstruction.
 await s.send('cita');state=(await s.send('31 nov')).state;assert.doesNotMatch(replyText(state),overview);assert.equal(last(state)['precedingTexts'],undefined);
 for(const command of ['cancelar','reagendar']){state=(await s.send(command)).state;assert.match(replyText(state),/aún no están disponibles/);assert.doesNotMatch(replyText(state),overview);}
 state=(await s.send('menu')).state;await choose(1);assert.doesNotMatch(replyText(state),overview);
 state=(await s.send('cita')).state;const old=text(choices(state)[0]!['id']);await s.send('menu');state=(await s.send(old,known,'ACTION')).state;assert.match(replyText(state),/venció|utilizada/);assert.doesNotMatch(replyText(state),overview);
});
for(const count of [0,1,2,90])test('NM045 support via command/button hides '+count+' appointments, quiet queue survives restart, Menu restores all',async t=>{
 const s=await setup(t);await s.seed(count);
 for(const kind of ['TEXT','ACTION'] as const){const menu=(await s.send('menu')).state;const entry=(await s.send(kind==='TEXT'?'humano':text(choices(menu)[2]!['id']),known,kind)).state;assert.equal(last(entry)['outcome'],'HUMAN_HANDOFF');assert.doesNotMatch(replyText(entry),overview);assert.equal(last(entry)['precedingTexts'],undefined);const n=(entry['replies'] as ObjectValue[]).length;await s.send('cita');await s.send('necesito ayuda');const before=await s.f.rows('local_support_message');await s.restart();const quiet=(await s.send('agendar')).state;assert.equal((quiet['replies'] as ObjectValue[]).length,n);const after=await s.f.rows('local_support_message');for(const row of before)assert.deepEqual(after.find(x=>x['input_id']===row['input_id']),row);const exit=(await s.send('menu')).state;assert.equal(count===0?0:count===1?(replyText(exit).match(/Tu cita actual es para el/g)??[]).length:(replyText(exit).match(/^\d+\. /gm)??[]).length,count);}
 assert.equal((await s.f.rows('operation')).length,0);
});
test('Summary59cde successful booking confirms only new appointment; alias display policy stays latest-only',async t=>{
 const s=await setup(t);await s.seed(2);for(const alias of ['reservar','horarios']){const state=(await s.send(alias)).state;assert.equal(last(state)['outcome'],'OFFER');assert.match(replyText(state),/Tu cita actual/);assert.doesNotMatch(replyText(state),/Tus próximas/);}
 const offer=(await s.send('cita')).state;const booked=(await s.send(text(choices(offer)[0]!['id']),known,'ACTION')).state;assert.equal(last(booked)['outcome'],'CONFIRMED');assert.doesNotMatch(replyText(booked),overview);assert.equal((booked['appointments'] as ObjectValue[]).length,3);assert.match(replyText(booked),/Tu cita está confirmada/);
});
test('Final correction leaves Ana UNKNOWN and literal invalid-name existing appointment/customer byte-identical',async t=>{
 const s=await setup(t),offer=(await s.send('cita')).state;s.app.providers.get(b)!.failure='BEFORE_APPLY';await s.send(text(choices(offer)[0]!['id']),known,'ACTION');const held=(await s.f.rows('attempt')).find(a=>a['state']==='UNKNOWN')!;assert.ok(held);
 await s.seed(1,'old-accidental');const bad=(await s.f.rows('customer')).find(c=>c['subject']==='old-accidental')!;await s.f.admin.query('UPDATE core.local_customer SET name=$1 WHERE business_id=$2 AND customer_id=$3',['hablar con alguien',b,bad['id']]);
 const tables=['appointment','customer','local_customer','operation','attempt','protection','mutation_guard'] as const,before=await Promise.all(tables.map(table=>s.f.rows(table)));const ledger=(await s.f.rows('local_ledger')).filter(r=>r['kind']==='CORE');
 for(const command of ['menu','humano','hablar con alguien','cita','agendar'])await s.app.submit(b,known,randomUUID(),{kind:'TEXT',value:command});await s.restart();await s.send('menu','old-accidental');
 assert.deepEqual(await Promise.all(tables.map(table=>s.f.rows(table))),before);assert.deepEqual((await s.f.rows('local_ledger')).filter(r=>r['kind']==='CORE'),ledger);assert.deepEqual((await s.f.rows('attempt')).find(a=>a['id']===held['id']),held);assert.equal((await s.f.rows('local_customer')).find(c=>c['customer_id']===bad['id'])!['name'],'hablar con alguien');
});
