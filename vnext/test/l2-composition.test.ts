import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,admission,raw,plan} from './support/helpers.js';
import {text,object} from '../src/domain/protocol.js';
import {l1Config,FakeAvailabilityCalendar} from './support/l1-calendar.js';
import {searchAvailability,type CalendarEvent} from '../src/domain/availability.js';
import {protectedCalendar,prepareBookingSelection,type BookingBindings,type AvailabilitySignal} from '../src/application/booking-composition.js';
import {AvailabilityOracle} from '../src/application/availability-oracle.js';
import {whatsappPresentation} from '../src/domain/whatsapp-presentation.js';
const now='2030-01-01T14:00:00Z',b='synthetic-a';
async function setup(t:Parameters<typeof fixture>[0]){const f=await fixture(t),config=l1Config('UTC'),source=new FakeAvailabilityCalendar(),signals:AvailabilitySignal[]=[],bindings:BookingBindings={businessId:b,calendar:{id:config.calendarId,coreId:f.id('calendar')},employees:new Map([['employee-a',f.id('resource')]])};config.service={id:'implicit-p0',durationMinutes:60,bufferMinutes:15};const reader=()=>protectedCalendar({config,source,bindings,reducer:f.role('reducer'),now:f.clock.now().toISOString(),signal:s=>signals.push(s)});return {f,config,source,signals,bindings,reader};}
test('L1-C1 selected service buffer reaches SQL protection; booking at its unbuffered end is refused',async t=>{
 const s=await setup(t),inputId=text((await admission(s.f)).inputs[0]!['inputId']),slot=(await searchAvailability(s.config,s.reader(),s.f.clock.now().toISOString()))[0]!,prepared=await prepareBookingSelection({...s,clock:s.f.clock,inputId,customerId:s.f.id('customer'),reducer:s.f.role('reducer'),sealer:s.f.role('sealer'),archive:s.f.archive.scope(b),slot,signal:x=>s.signals.push(x)});
 assert.equal(prepared.plan.body['bufferMinutes'],15);assert.equal((await s.f.rows('appointment'))[0]!['buffer_minutes'],15);const upper=await s.f.role('reducer').tx(b,async db=>(await db.query('SELECT upper(protected_range) AS finish FROM core.protection WHERE business_id=$1',[b])).rows[0]!.finish);assert.equal(upper,new Date(Date.parse(slot.endAt)+900000).toISOString());
 const customerId=randomUUID(),subject='second';await s.f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',[b,customerId,subject]);const secondId=text((await admission(s.f,raw(s.f,'synthetic fixed command',b,randomUUID(),subject))).inputs[0]!['inputId']);
 await assert.rejects(plan(s.f,{inputId:secondId,customerId,startAt:slot.endAt,endAt:new Date(Date.parse(slot.endAt)+3600000).toISOString(),bufferMinutes:15}),/terminal_plan_conflict/);assert.equal((await s.f.rows('appointment')).length,1);
});
test('L1-C2 PREPARED protections are busy before the calendar is written, with no double buffer',async t=>{
 const s=await setup(t);s.config.startIntervalMinutes=15;await plan(s.f,{startAt:'2030-01-02T10:00:00Z',endAt:'2030-01-02T11:00:00Z',bufferMinutes:15});assert.equal(s.source.events.length,0);const slots=await searchAvailability(s.config,s.reader(),s.f.clock.now().toISOString(),{date:'2030-01-02'});assert.ok(!slots.some(x=>Date.parse(x.startAt)===Date.parse('2030-01-02T11:00:00Z')));assert.ok(slots.some(x=>Date.parse(x.startAt)===Date.parse('2030-01-02T11:15:00Z')));assert.equal(s.source.events.length,0);
});
test('L1-C3 customer-selected time can move to another qualified free employee and maps its core UUID',async t=>{
 const s=await setup(t);s.config.employees=[...s.config.employees,{...s.config.employees[0]!,id:'employee-b'}];s.bindings={...s.bindings,employees:new Map([['employee-a',s.f.id('resource')],['employee-b',s.f.id('otherResource')]])};const slot=(await searchAvailability(s.config,s.source,s.f.clock.now().toISOString()))[0]!;
 s.source.events=[{businessId:b,calendarId:s.config.calendarId,id:'a-now-busy',resourceId:'employee-a',start:slot.startAt,end:slot.endAt}];const inputId=text((await admission(s.f)).inputs[0]!['inputId']);const prepared=await prepareBookingSelection({...s,clock:s.f.clock,inputId,customerId:s.f.id('customer'),reducer:s.f.role('reducer'),sealer:s.f.role('sealer'),archive:s.f.archive.scope(b),slot,signal:x=>s.signals.push(x)});assert.equal(prepared.slot.resourceId,'employee-b');assert.equal(prepared.plan.body['resourceId'],s.f.id('otherResource'));assert.equal(Date.parse(prepared.slot.startAt),Date.parse(slot.startAt));assert.equal(prepared.plan.body['bufferMinutes'],15);
});
test('L1-C4 each displayed view has a fresh 15-minute expiry; prior revision actions stay invalid',async()=>{
 let clock=now;const o=new AvailabilityOracle(l1Config(),new FakeAvailabilityCalendar(),()=>clock),first=await o.open();clock='2030-01-01T14:14:00Z';const second=await o.action(first.choices[2]!.id,true),dates=await o.action(second.choices[2]!.id,true);assert.equal(dates.expiresAt,'2030-01-01T14:29:00.000Z');assert.ok(dates.viewRevision>first.viewRevision);clock='2030-01-01T14:15:30Z';assert.equal((await o.action(dates.choices[0]!.id,true)).outcome,'OFFER');await assert.rejects(o.action(first.choices[0]!.id,true),/stale_or_foreign/);
});
test('L1-C5 unknown calendar resources block everyone only in that interval and emit an operator signal',async t=>{
 const s=await setup(t);s.source.events=[{businessId:b,calendarId:s.config.calendarId,id:'former-staff',resourceId:'former',start:'2030-01-02T10:00:00Z',end:'2030-01-02T11:00:00Z'}];const slots=await searchAvailability(s.config,s.reader(),s.f.clock.now().toISOString(),{date:'2030-01-02'});assert.ok(slots.length);assert.ok(!slots.some(x=>Date.parse(x.startAt)===Date.parse('2030-01-02T10:00:00Z')));assert.equal(s.signals.length,1);assert.equal(s.signals[0]!.code,'UNKNOWN_CALENDAR_RESOURCE');
});
test('L1-C5 an unmapped local protection remains blocking-all and is signaled, never interpreted as free',async t=>{
 const s=await setup(t);await plan(s.f,{resourceId:s.f.id('otherResource'),startAt:'2030-01-02T10:00:00Z',endAt:'2030-01-02T11:00:00Z',bufferMinutes:15});const slots=await searchAvailability(s.config,s.reader(),s.f.clock.now().toISOString(),{date:'2030-01-02'});assert.ok(!slots.some(x=>Date.parse(x.startAt)===Date.parse('2030-01-02T10:00:00Z')));assert.equal(s.signals[0]!.code,'UNKNOWN_LOCAL_PROTECTION_RESOURCE');
});
test('L1-C6 five-choice dates render as a WhatsApp list; suggestions remain at most three reply buttons',async()=>{
 const o=new AvailabilityOracle(l1Config(),new FakeAvailabilityCalendar(),()=>now),first=await o.open();assert.equal(object(whatsappPresentation(first)['interactive'])['type'],'button');const second=await o.action(first.choices[2]!.id,true),dates=await o.action(second.choices[2]!.id,true),next=await o.action(dates.choices.find(x=>x.title==='Más fechas')!.id,true);assert.equal(next.choices.length,5);assert.equal(next.presentation,'LIST');assert.equal(object(whatsappPresentation(next)['interactive'])['type'],'list');assert.throws(()=>whatsappPresentation({...next,presentation:'REPLY_BUTTONS'}),/reply_buttons_denied/);const times=await o.action(next.choices[0]!.id,true),intent=await o.action(times.choices[0]!.id,true);assert.equal(intent.outcome,'BOOK_REQUEST');assert.throws(()=>whatsappPresentation(intent),/text_payload_denied/);
});
test('L2 composition rejects foreign/missing/ambiguous bindings before reservation',async t=>{
 const s=await setup(t);for(const bindings of [{...s.bindings,businessId:'synthetic-b'},{...s.bindings,calendar:{id:s.config.calendarId,coreId:'not-uuid'}},{...s.bindings,employees:new Map<string,string>()}])assert.throws(()=>protectedCalendar({...s,bindings,reducer:s.f.role('reducer'),now:s.f.clock.now().toISOString(),signal:()=>{}}));assert.equal((await s.f.rows('appointment')).length,0);
});
test('L2 unknown normalization cannot hide a foreign event or failed calendar read',async t=>{
 const s=await setup(t),read=s.source.read.bind(s.source);s.source.read=async(r,c)=>({...await read(r,c),events:[{businessId:'synthetic-b',calendarId:s.config.calendarId,id:'foreign',resourceId:'unknown',start:'2030-01-02T10:00:00Z',end:'2030-01-02T11:00:00Z'} as CalendarEvent]});await assert.rejects(searchAvailability(s.config,s.reader(),s.f.clock.now().toISOString()),/EVENT_SCOPE/);assert.equal(s.signals.length,0);
});
