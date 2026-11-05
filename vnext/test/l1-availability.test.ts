import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DateTime} from 'luxon';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {searchAvailability,recheckSlot,AvailabilityHeldError,type CalendarEvent} from '../src/domain/availability.js';
import {AvailabilityOracle,DATE_PROMPT} from '../src/application/availability-oracle.js';
import {l1Config,FakeAvailabilityCalendar} from './support/l1-calendar.js';
const now='2030-01-01T14:00:00Z';
const busy=(id:string,start:string,end:string,rest:Partial<CalendarEvent>={}):CalendarEvent=>({businessId:'synthetic-a',calendarId:'calendar-a',id,start,end,...rest});
test('L1 business hours, employee qualification/hours/absence, service duration and buffers restrict every suggested slot',async()=>{
 const c=l1Config(),f=new FakeAvailabilityCalendar();c.breaks={2:[{start:'12:00',end:'13:00'}]};c.employees=[{id:'employee-a',serviceIds:['implicit-p0'],hours:{2:[{start:'10:00',end:'16:00'}]},absences:[{start:'2030-01-01T20:15:00Z',end:'2030-01-01T21:00:00Z'}]},{id:'unqualified',serviceIds:['other-service'],hours:c.hours,absences:[]}];
 f.events=[busy('one','2030-01-01T16:00:00Z','2030-01-01T17:00:00Z')];const slots=await searchAvailability(c,f,now,{date:'2030-01-01'});assert.ok(slots.length);for(const s of slots){assert.equal(s.resourceId,'employee-a');assert.equal(Date.parse(s.endAt)-Date.parse(s.startAt),3600000);assert.equal(s.bufferMinutes,15);assert.ok(Date.parse(s.startAt)>=Date.parse('2030-01-01T17:30:00Z'));assert.ok(Date.parse(s.endAt)+900000<=Date.parse('2030-01-01T22:00:00Z'));assert.ok(!(Date.parse(s.startAt)<Date.parse('2030-01-01T19:00:00Z')&&Date.parse(s.endAt)+900000>Date.parse('2030-01-01T18:00:00Z')));}
});
test('L1 paginated shared-calendar events block only their resource; unassigned and UNKNOWN events remain conservative',async()=>{
 const c=l1Config(),f=new FakeAvailabilityCalendar();c.employees=[...c.employees,{...c.employees[0]!,id:'employee-b'}];f.pageSize=1;f.events=[busy('one','2030-01-01T15:00:00Z','2030-01-01T16:00:00Z',{resourceId:'employee-a'}),busy('unknown','2030-01-01T18:00:00Z','2030-01-01T19:00:00Z',{state:'UNKNOWN'}),busy('cancelled','2030-01-01T20:00:00Z','2030-01-01T21:00:00Z',{state:'CANCELLED'})];
 const slots=await searchAvailability(c,f,now,{date:'2030-01-01'});assert.equal(slots[0]!.resourceId,'employee-b');assert.ok(f.reads.length>=3);assert.ok(!slots.some(s=>Date.parse(s.startAt)===Date.parse('2030-01-01T18:00:00Z')));assert.ok(slots.some(s=>Date.parse(s.startAt)===Date.parse('2030-01-01T20:00:00Z')));
});
for(const days of [30,45,180,365])test(`L1 30 + 15 day search respects ${days}-day busy interval and 365-day horizon`,async()=>{
 const c=l1Config(),f=new FakeAvailabilityCalendar(),from=DateTime.fromISO(now).setZone(c.timeZone);f.events=[busy('full',from.startOf('day').toISO()!,from.startOf('day').plus({days}).toISO()!,{bufferMinutes:0})];const slots=await searchAvailability(c,f,now,{},10000);
 assert.ok(f.reads.every(r=>Date.parse(r.end)<=from.plus({days:365}).toMillis()));assert.equal(DateTime.fromISO(f.reads[0]!.end).toMillis(),from.startOf('day').plus({days:30}).toMillis());if(days<365)assert.ok(slots.length);else assert.ok(slots.every(s=>Date.parse(s.startAt)>=from.startOf('day').plus({days:365}).toMillis()));
 for(let i=1;i<f.reads.length;i++)assert.ok(Date.parse(f.reads[i]!.end)-Date.parse(f.reads[i-1]!.end)<=15*86400000+3600000);
});
for(const failure of ['exception','partial','foreign','changed','cursor','never','malformed'])test('L1 failed/incomplete calendar is HELD, never authenticated empty: '+failure,async()=>{
 const c=l1Config(),f=new FakeAvailabilityCalendar(),read=f.read.bind(f);let calls=0;
 f.read=async(r,cursor)=>{calls++;if(failure==='exception')throw Error('outage');if(failure==='never')return new Promise(()=>{});const p=await read(r,cursor);if(failure==='partial')p.complete=false;if(failure==='foreign')p.businessId='synthetic-b';if(failure==='malformed')p.events=[busy('bad','bad','bad')];if(['changed','cursor'].includes(failure)){p.nextCursor='again';p.complete=false;if(failure==='changed')p.snapshotId=String(calls);}return p;};
 await assert.rejects(searchAvailability(c,f,now,{},failure==='never'?15:1000),AvailabilityHeldError);if(failure==='never')assert.equal(calls,1);
});
for(const date of ['2029-12-31','2031-02-01','2030-02-31','31/01/2030'])test('L1 structured date selection rejects unsupported/out-of-range date '+date,async()=>{await assert.rejects(searchAvailability(l1Config(),new FakeAvailabilityCalendar(),now,{date}),AvailabilityHeldError);});
test('L1 buffers carry across a 30-day batch edge; exact half-open boundaries remain available',async()=>{
 const c=l1Config(),f=new FakeAvailabilityCalendar();f.events=[busy('month','2030-01-01T00:00:00-06:00','2030-01-31T09:00:00-06:00',{bufferMinutes:60})];const slots=await searchAvailability(c,f,now,{},10000);assert.equal(DateTime.fromISO(slots[0]!.startAt).setZone(c.timeZone).toFormat('HH:mm'),'10:00');
});
test('L1 stale selected slot rechecks all pages and returns held if newly busy or scope changes',async()=>{
 const c=l1Config(),f=new FakeAvailabilityCalendar(),slot=(await searchAvailability(c,f,now))[0]!;f.events=[busy('new',slot.startAt,slot.endAt)];f.version++;await assert.rejects(recheckSlot(c,f,now,slot),/SLOT_UNAVAILABLE/);await assert.rejects(recheckSlot(c,f,now,{...slot,businessId:'synthetic-b'}),/SLOT_SCOPE/);
});
test('L1 rejects multiple services, invalid minutes, overnight hours and invalid zone',async()=>{
 for(const extra of [{services:[l1Config().service]},{service:{id:'bad',durationMinutes:0,bufferMinutes:0}},{hours:{1:[{start:'23:00',end:'01:00'}]}},{timeZone:'not-a-zone'}])await assert.rejects(searchAvailability({...l1Config(),...extra},new FakeAvailabilityCalendar(),now),AvailabilityHeldError);
});
test('L1 accepted v0.8.1 engine differential across zones, DST, intervals, breaks and buffers',async()=>{
 const source=await readFile('../backend/lib/availability.js','utf8'),require=createRequire(import.meta.url),module={exports:{} as {findAvailableSlots:(a:unknown)=>{start:string;end:string}[]}};vm.runInNewContext(source,{module,require:(name:string)=>{if(name!=='luxon')throw Error('oracle_import_denied');return require('luxon');}});
 let cases=0;for(const zone of ['America/Mexico_City','America/New_York','Europe/Berlin','Asia/Tokyo','UTC'])for(const day of ['2030-01-02','2030-03-10','2030-11-03'])for(const duration of [30,60]){
  const c=l1Config(zone),f=new FakeAvailabilityCalendar();c.service={id:'implicit-p0',durationMinutes:duration,bufferMinutes:15};c.breaks=Object.fromEntries([1,2,3,4,5,6,7].map(d=>[d,[{start:'12:00',end:'13:00'}]]));const local=DateTime.fromISO(day,{zone}),current=local.minus({days:1}).toISO()!,events=[{start:local.set({hour:10}).toISO()!,end:local.set({hour:11}).toISO()!}];f.events=events.map((e,i)=>busy('event'+i,e.start,e.end));
  const actual=await searchAvailability(c,f,current,{date:day}),expected=module.exports.findAvailableSlots({settings:{timeZone:zone,workingDays:[1,2,3,4,5,6,7],openingTime:'09:00',closingTime:'17:00',durationMinutes:duration,bufferMinutes:15,startIntervalMinutes:30,breaks:[{start:'12:00',end:'13:00'}]},busyPeriods:events,now:current,lookaheadDays:365,rangeStart:local.toISO(),rangeEnd:local.plus({days:1}).toISO()});
  assert.deepEqual(actual.map(s=>[s.startAt,s.endAt]),JSON.parse(JSON.stringify(expected.map(s=>[s.start,s.end]))));cases++;
 }
 assert.equal(cases,30);
});
test('L1 oracle keeps two + two + date navigation, stale-action denial and direct known-customer booking intent',async()=>{
 const f=new FakeAvailabilityCalendar(),o=new AvailabilityOracle(l1Config(),f,()=>now),one=await o.open();assert.equal(one.text,'Elige un horario que te funciona mejor:');assert.equal(one.choices.length,3);assert.equal(one.choices[2]!.title,'Más opciones');const two=await o.action(one.choices[2]!.id,true);assert.equal(two.choices[2]!.title,'Elegir fecha');assert.equal(two.text,'Te muestro mas opciones. Elige un horario que te funciona mejor:');await assert.rejects(o.action(one.choices[0]!.id,true),/stale_or_foreign/);const dates=await o.action(two.choices[2]!.id,true);assert.equal(dates.text,DATE_PROMPT);assert.ok(dates.choices.some(x=>x.title==='Más fechas'));const times=await o.action(dates.choices[0]!.id,true);assert.equal(times.choices.length,3);assert.equal(times.choices[2]!.title,'Más horarios');const booked=await o.action(times.choices[0]!.id,true);assert.equal(booked.outcome,'BOOK_REQUEST');assert.deepEqual(booked.choices,[]);assert.equal(booked.text,'');
});
test('L1 oracle new customer requests name after slot; name capture rechecks; human owns pending ordinary text until Menu',async()=>{
 const f=new FakeAvailabilityCalendar(),o=new AvailabilityOracle(l1Config(),f,()=>now),offer=await o.open(),name=await o.action(offer.choices[0]!.id,false);assert.equal(name.outcome,'NAME_REQUIRED');assert.equal(name.text,'Para reservar este horario, indícanos tu nombre completo.');assert.equal((await o.nameCaptured()).outcome,'BOOK_REQUEST');o.humano();for(let i=0;i<5;i++)assert.equal(o.ordinary().outcome,'HUMAN_HANDOFF');assert.equal((await o.date('2030-01-02')).outcome,'HUMAN_HANDOFF');assert.equal((await o.open()).outcome,'HUMAN_HANDOFF');o.menu();assert.equal((await o.open()).outcome,'OFFER');
});
test('L1 oracle dates page forward/back, TTL and foreign tenant actions fail without booking effects',async()=>{
 let clock=now;const f=new FakeAvailabilityCalendar(),o=new AvailabilityOracle(l1Config(),f,()=>clock),one=await o.open(),two=await o.action(one.choices[2]!.id,true),dates=await o.action(two.choices[2]!.id,true),more=dates.choices.find(x=>x.title==='Más fechas')!,next=await o.action(more.id,true);assert.ok(next.choices.some(x=>x.title==='Fechas anteriores'));await assert.rejects(o.action(next.choices[0]!.id.replace('synthetic-a','synthetic-b'),true),/stale_or_foreign/);clock='2030-01-01T14:16:00Z';await assert.rejects(o.action(next.choices[0]!.id,true),/stale_or_foreign/);
});
test('L1 DST gap never shifts an offered nonexistent wall-clock time',async()=>{
 const c=l1Config('America/New_York');c.hours=Object.fromEntries([1,2,3,4,5,6,7].map(d=>[d,[{start:'01:00',end:'04:00'}]]));c.employees=[{...c.employees[0]!,hours:c.hours}];c.service={...c.service,durationMinutes:30,bufferMinutes:0};const slots=await searchAvailability(c,new FakeAvailabilityCalendar(),'2030-03-09T00:00:00Z',{date:'2030-03-10'});assert.ok(slots.length);assert.ok(slots.every(s=>DateTime.fromISO(s.startAt).setZone(c.timeZone).hour!==2));assert.ok(slots.every(s=>Date.parse(s.endAt)>Date.parse(s.startAt)));
});
