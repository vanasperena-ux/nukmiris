import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AvailabilityOracle} from '../src/application/availability-oracle.js';
import {searchAvailability,bookingHorizonDays} from '../src/domain/availability.js';
import {whatsappPresentation} from '../src/domain/whatsapp-presentation.js';
import {object,text,type ObjectValue} from '../src/domain/protocol.js';
import {rc1Setup} from './support/rc1-fixture.js';
import {FakeAvailabilityCalendar,l1Config} from './support/l1-calendar.js';

// Literal expectations transcribed from Feature Register v1.12, commit 0ad6d50.
// Do not import application copy constants: these are independent acceptance strings.
const menuBody='¿En qué podemos ayudarte?\n\nEscribe "cita" o "agendar" para agendar una cita nueva. Escribe "reagendar" o "cancelar" para gestionar una cita.\n\nEscribe "menu" para volver al menú principal. Para solicitar apoyo, escribe "humano" o elige "Hablar con alguien".';
const humanBody='Escribe tu mensaje. El bot ya no está activo.\n\nEscribe "menu" para activar el bot y volver al menú principal.';
const unavailable='No encontré horarios disponibles por ahora. Puedes llamar al negocio para consultar más opciones.';
const stale='La cita ya no está disponible. Elige de nuevo.';
const oracle=()=>new AvailabilityOracle(l1Config('UTC'),new FakeAvailabilityCalendar(),()=> '2030-01-01T09:00:00Z');

test('NM068 CX001/CX002/CX004 exact initial and more-options copy; CX003 and interactive limits unchanged',async()=>{
 const o=oracle(),first=await o.open();assert.equal(first.text,'Elige un horario');assert.equal(first.choices.length,3);assert.equal(first.choices[2]!.title,'Más opciones');assert.ok(whatsappPresentation(first));
 const more=await o.action(first.choices[2]!.id,true);assert.equal(more.text,'Te muestro más opciones. Elige un horario:');assert.ok(whatsappPresentation(more));
 const date=await o.date('2030-01-02');assert.equal(date.text,'¿Qué hora prefieres para el miércoles 2 de enero 2030?\n\nSelecciona el horario que prefieres. Para cambiar de día, escribe otra fecha.');
 const times=await o.action(date.choices[2]!.id,true);assert.equal(times.text,'Te muestro más opciones. Elige un horario:');assert.ok(whatsappPresentation(times));
});

test('NM068 CX008 existing no-active-service trigger differs from CX007 only by state; CX006 unchanged',async t=>{
 const s=await rc1Setup(t);await s.save('service',object({...((await s.catalog.load()).services[0]!),active:false}));
 const inactive=await s.send('cita');assert.equal(s.last(inactive)['text'],unavailable);assert.equal(s.last(inactive)['outcome'],'SERVICES');assert.deepEqual(s.choices(inactive),[]);
 assert.equal((await s.f.rows('operation')).length,0);assert.equal((await s.f.rows('appointment')).length,0);
 const config={...l1Config('UTC'),employees:[]},o=new AvailabilityOracle(config,new FakeAvailabilityCalendar(),()=> '2030-01-01T09:00:00Z');
 assert.equal((await o.open()).text,unavailable);assert.equal((await o.date('2030-01-02')).text,'No hay horarios disponibles para este día. Elige otra fecha o escríbela.');
});

for(const [id,input,expected] of [
 ['CX012','ayer','Esa fecha ya pasó. Elige otra fecha o escríbela.'],
 ['CX013','en 366 días','Por ahora solo podemos agendar citas dentro de los próximos 365 días. Elige otra fecha o escríbela.'],
 ['CX014','martes 2 ene 2030','El día de la semana no coincide con la fecha. Elige otra fecha o escríbela.'],
 ['CX015','31 feb 2030','Esa fecha no existe en el calendario. Elige otra fecha o escríbela.'],
] as const)test(`NM068 ${id} exact date feedback preserves offers without booking`,async t=>{
 const s=await rc1Setup(t),offer=await s.send('cita'),state=await s.send(input);assert.equal(s.last(state)['text'],expected);assert.deepEqual(s.choices(state).map(c=>c['title']),s.choices(offer).map(c=>c['title']));assert.equal((await s.f.rows('appointment')).length,0);assert.equal((await s.f.rows('operation')).length,0);
});

for(const days of [30,90])test(`NM068 CX013 uses the actual ${days}-day horizon for parser, offers and copy`,async t=>{
 const s=await rc1Setup(t);s.scopes[0]!.config={...s.scopes[0]!.config,maxBookingHorizonDays:days};await s.send('cita');
 const state=await s.send(`en ${days+1} días`);assert.equal(s.last(state)['text'],`Por ahora solo podemos agendar citas dentro de los próximos ${days} días. Elige otra fecha o escríbela.`);assert.doesNotMatch(text(s.last(state)['text']),/[{}]/);
 const config={...l1Config('UTC'),maxBookingHorizonDays:days},reader=new FakeAvailabilityCalendar();await searchAvailability(config,reader,'2030-01-01T09:00Z');assert.ok(reader.reads.every(r=>Date.parse(r.end)<=Date.parse('2030-01-01T09:00Z')+days*86400000));
 await assert.rejects(searchAvailability(config,reader,'2030-01-01T09:00Z',{date:'2030-12-01'}),/DATE_OUT_OF_RANGE/);
});

test('NM068 CX013 retains the default and fails closed for unsupported horizon configuration',()=>{
 assert.equal(bookingHorizonDays(l1Config()),365);for(const value of [0,366,-1,1.5,NaN])assert.throws(()=>bookingHorizonDays({...l1Config(),maxBookingHorizonDays:value}),/INVALID_HORIZON/);
});

for(const known of [true,false])test(`NM068 CX021/CX022 exact ${known?'known':'unknown'} greeting, paragraphs and three choices`,async t=>{
 const s=await rc1Setup(t);s.scopes[0]!.businessName='Juanita\'s Nail Salon';s.scopes[1]!.businessName="Bernard's Grooming Salon";
 const state=await s.send('menu',known?s.subject:'new-customer'),payload=s.last(state),greeting=`Hola${known?' Ana Ejemplo':''}, bienvenido a Juanita's Nail Salon. Soy un bot que te ayuda a agendar, reagendar o cancelar una cita.`;
 assert.equal(payload['text'],greeting+'\n\n'+menuBody);assert.equal(payload['precedingTexts'],undefined);assert.doesNotMatch(JSON.stringify(payload),/\{nombre\}|\{negocio\}|Bernard/);assert.ok(text(payload['text']).includes('\n\n'));assert.ok(!text(payload['text']).includes('\\n'));
 assert.deepEqual(s.choices(state).map(c=>c['title']),['Agendar una cita','Reagendar / cancelar','Hablar con alguien']);
 await s.app.submit('synthetic-b','customer-synthetic-b',randomUUID(),{kind:'TEXT',value:'menu'});await s.tick();const other=s.last(await s.app.snapshot('synthetic-b','customer-synthetic-b'));assert.match(text(other['text']),/Bernard's Grooming Salon/);assert.doesNotMatch(text(other['text']),/Juanita/);
});

test('NM068 CX021/CX022 zero, one and multiple appointments preserve their separate overview',async t=>{
 const s=await rc1Setup(t);for(let count=0;count<3;count++){
  const menu=await s.send('menu'),payload=s.last(menu);assert.ok(text(payload['text']).endsWith(menuBody));assert.equal((await s.f.rows('appointment')).length,count);
  const combined=[...(payload['precedingTexts'] as string[]??[]),text(payload['text'])].join('\n\n');assert.ok(combined.startsWith('Hola Ana Ejemplo, bienvenido a el negocio. Soy un bot que te ayuda a agendar, reagendar o cancelar una cita.'));
  if(count===0)assert.doesNotMatch(combined,/Tu cita actual|Tus próximas citas/);else assert.match(combined,count===1?/Tu cita actual/:/Tus próximas citas/);
  if(count<2){await s.send('cita');if(count)await s.send('2 ene 2030');await s.choose(await s.app.snapshot(s.b,s.subject));}
 }
});

test('NM068 CX024 exact human entry has no overview, retains support messages, stays silent and exits on menu',async t=>{
 const s=await rc1Setup(t);await s.choose(await s.send('cita'));const entry=await s.send('humano');assert.equal(s.last(entry)['text'],humanBody);assert.equal(s.last(entry)['precedingTexts'],undefined);assert.deepEqual(s.choices(entry),[]);
 const saved=(await s.f.rows('local_support_message')).length,count=(entry['replies'] as ObjectValue[]).length,quiet=await s.send('Mi mensaje para el negocio');assert.equal((quiet['replies'] as ObjectValue[]).length,count);assert.equal((await s.f.rows('local_support_message')).length,saved+1);
 const exit=await s.send('menu');assert.equal(s.last(exit)['outcome'],'MENU');assert.ok(text(s.last(exit)['text']).endsWith(menuBody));assert.equal((await s.f.rows('appointment')).length,1);
});

test('NM068 CX039 disappeared appointment keeps exact recovery prefix; no cancellation claim or operation',async t=>{
 const s=await rc1Setup(t);await s.choose(await s.send('cita'));const before=(await s.f.rows('appointment'))[0]!;s.f.clock.instant=Date.parse(text(before['start_at']))-1000;const picker=await s.send('cancelar');
 // Independently controlled business clock makes the displayed appointment past.
 s.f.clock.instant=Date.parse(text(before['start_at']))+1000;const state=await s.choose(picker);
 assert.ok(text(s.last(state)['text']).startsWith(stale+'\n\n'));assert.match(text(s.last(state)['text']),/No encontré citas próximas/);assert.equal((await s.f.rows('operation')).length,1);assert.equal((await s.f.rows('appointment'))[0]!['state'],'ACTIVE');
});

test('NM068 CX040 selected appointment no longer current preserves original booking and recovers safely',async t=>{
 const s=await rc1Setup(t);await s.choose(await s.send('cita'));let state=await s.send('reagendar');state=await s.choose(state);const before=(await s.f.rows('appointment'))[0]!;
 // A concurrent proven calendar update is modeled in this isolated SQL fixture;
 // no customer action or accepted history is rewritten by application code.
 await s.f.admin.query('UPDATE core.appointment SET revision=revision+1 WHERE business_id=$1 AND id=$2',[s.b,before['id']]);
 state=await s.send('2 ene 2030');assert.ok(text(s.last(state)['text']).startsWith(stale+'\n\n'));assert.equal(s.last(state)['outcome'],'APPOINTMENTS');assert.equal((await s.f.rows('operation')).length,1);assert.equal((await s.f.rows('appointment'))[0]!['state'],'ACTIVE');assert.equal((await s.f.rows('protection')).length,1);
});
