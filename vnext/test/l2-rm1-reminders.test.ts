import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {InteractiveBooking} from '../src/application/interactive-booking.js';
import {recordResult} from '../src/application/record-result.js';
import type {Envelope} from '../src/ports.js';
import {object,text,type ObjectValue,type Faults} from '../src/domain/protocol.js';
import {rc1Setup} from './support/rc1-fixture.js';

async function setup(t:Parameters<typeof rc1Setup>[0],faults?:Faults){
 const s=await rc1Setup(t,faults);for(const scope of s.scopes)scope.operator=s.f.role('operator');
 const reminders=s.app.ownerReminders(s.b)!;await reminders.configure(randomUUID(),{action:'ENABLE',enabled:true});
 const grant=()=>reminders.grant(randomUUID(),s.subject,'SYNTHETIC_OWNER_EVIDENCE','Permiso sintético explícito para recordatorios de Juanita, registrado por el propietario.');
 const book=async(day=10)=>{await s.send('cita');const offer=await s.send(`${day} ene 2030`);await s.choose(offer);return (await s.f.rows('appointment'))[0]!;};
 const jobs=async()=> (await reminders.activity())['jobs'] as ObjectValue[];
 const at=async(kind:string)=>{const job=(await jobs()).filter(j=>j['kind']===kind&&!['SUPERSEDED','CANCELLED'].includes(String(j['attendance']))).sort((a,b)=>Number(b['scheduleRevision'])-Number(a['scheduleRevision']))[0]!;assert.ok(job,'scheduled '+kind);s.f.clock.instant=Date.parse(text(job['dueAt']));await s.tick();return (await jobs()).find(j=>j['id']===job['id'])!;};
 return {...s,reminders,grant,book,jobs,at};
}

test('NM069 disabled by default: no reminder adoption/backfill when activated after booking',async t=>{
 const s=await rc1Setup(t);s.scopes[0]!.operator=s.f.role('operator');await s.choose(await s.send('cita'));const r=s.app.ownerReminders(s.b)!;assert.equal((await r.activity())['enabled'],false);await r.configure(randomUUID(),{action:'ENABLE',enabled:true});assert.deepEqual((await r.activity())['jobs'],[]);
});

test('NM069 four thresholds use elapsed hours, future-only enrollment and durable unique identities',async t=>{
 const s=await setup(t);await s.grant();const ap=await s.book(),jobs=await s.jobs();assert.equal(jobs.length,4);for(const [kind,hours] of Object.entries({seven_day:168,confirmation:24,followup:22,final:2})){const j=jobs.find(j=>j['kind']===kind)!;assert.equal(Date.parse(text(ap['start_at']))-Date.parse(text(j['dueAt'])),hours*3600000);assert.equal(j['status'],'SCHEDULED');assert.equal(Date.parse(text(j['deadlineAt']))-Date.parse(text(j['dueAt'])),900000);}await s.tick();assert.deepEqual((await s.jobs()).map(j=>j['id']),jobs.map(j=>j['id']));
});

test('NM069 acceptance is not delivery: 22h follow-up requires exact correlated delivered/read receipt; final sends unconfirmed',async t=>{
 const s=await setup(t);await s.grant();await s.book();assert.equal((await s.at('seven_day'))['status'],'ACCEPTED');const confirmation=await s.at('confirmation');assert.equal(confirmation['status'],'ACCEPTED');assert.equal(confirmation['receipt'],null);
 const followup=await s.at('followup');assert.equal(followup['status'],'SKIPPED');assert.equal(followup['reason'],'CONFIRMATION_NOT_DELIVERED');
 assert.equal(await s.reminders.receipt(randomUUID(),text(confirmation['id']),'delivered',{messageId:'wrong-message'}),false);await s.tick();assert.equal((await s.jobs()).find(j=>j['id']===followup['id'])!['status'],'SKIPPED');
 assert.equal(await s.reminders.receipt(randomUUID(),text(confirmation['id']),'delivered'),true);await s.tick();assert.equal((await s.jobs()).find(j=>j['id']===followup['id'])!['status'],'SKIPPED');assert.equal((await s.at('final'))['status'],'ACCEPTED');assert.equal((await s.jobs())[0]!['attendance'],'PENDING');assert.equal((await s.f.rows('appointment'))[0]!['state'],'ACTIVE');
});

test('NM069 exact reminder button confirms once; confirmed attendance suppresses follow-up but not final',async t=>{
 const s=await setup(t);await s.grant();await s.book();const request=await s.at('confirmation'),state=await s.app.snapshot(s.b,s.subject),reminder=(state['replies'] as ObjectValue[]).find(r=>object(r['payload'])['jobId']===request['id'])!,button=text((object(reminder['payload'])['choices'] as ObjectValue[])[0]!['id']);
 await s.send(button,s.subject,'ACTION');assert.equal((await s.jobs()).find(j=>j['id']===request['id'])!['attendance'],'CONFIRMED');const confirmedAt=(await s.jobs())[0]!['confirmedAt'];await s.send(button,s.subject,'ACTION');assert.equal((await s.jobs())[0]!['confirmedAt'],confirmedAt);assert.equal((await s.f.rows('operation')).length,1);const followup=await s.at('followup');assert.equal(followup['reason'],'ATTENDANCE_ANSWERED');assert.equal((await s.at('final'))['status'],'ACCEPTED');
});

test('NM069 restart retains schedule identities and does not duplicate an accepted reminder',async t=>{
 const s=await setup(t);await s.grant();await s.book();await s.at('seven_day');const ids=(await s.jobs()).map(j=>j['id']),ledger=await s.f.rows('local_ledger');
 const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());for(let i=0;i<4;i++)await next.tick();assert.deepEqual((await s.jobs()).map(j=>j['id']),ids);assert.equal((await s.f.rows('local_ledger')).length,ledger.length);
});

for(const receipt of ['delivered','read'] as const)test('NM069 22h sends only after timely correlated '+receipt+' proof; duplicate/out-of-order receipts are monotonic',async t=>{
 const s=await setup(t);await s.grant();await s.book();const request=await s.at('confirmation'),id=randomUUID();assert.equal(await s.reminders.receipt(id,text(request['id']),receipt),true);assert.equal(await s.reminders.receipt(id,text(request['id']),receipt),true);await s.reminders.receipt(randomUUID(),text(request['id']),'sent');await s.reminders.receipt(randomUUID(),text(request['id']),'failed');assert.equal((await s.jobs()).find(j=>j['id']===request['id'])!['receipt'],receipt);assert.equal((await s.at('followup'))['status'],'ACCEPTED');
});

for(const minutes of [0,15,16])test(`NM069 late window ${minutes} minutes is measured from the original due time`,async t=>{
 const s=await setup(t);await s.grant();await s.book();const j=(await s.jobs()).find(j=>j['kind']==='seven_day')!;s.f.clock.instant=Date.parse(text(j['dueAt']))+minutes*60000;await s.tick();const after=(await s.jobs()).find(x=>x['id']===j['id'])!;assert.equal(after['status'],minutes<=15?'ACCEPTED':'SKIPPED');if(minutes>15)assert.equal(after['reason'],'REMINDER_EXPIRED');
});

test('NM069 short-lead bookings skip missed and exactly-now thresholds without catch-up',async t=>{
 const s=await setup(t);await s.grant();await s.book(2);const jobs=await s.jobs();for(const kind of ['seven_day','confirmation']){assert.equal(jobs.find(j=>j['kind']===kind)!['status'],'SKIPPED');assert.equal(jobs.find(j=>j['kind']===kind)!['reason'],'THRESHOLD_NOT_FUTURE');}assert.equal(jobs.find(j=>j['kind']==='final')!['status'],'SCHEDULED');
});

test('NM069 booking less than two hours away produces no reminder sends',async t=>{
 const s=await setup(t);await s.grant();await s.book(1);assert.ok((await s.jobs()).every(j=>j['status']==='SKIPPED'));await s.tick();assert.equal((await s.f.rows('output_intent')).filter(o=>o['purpose']==='REMINDER').length,0);
});

test('NM069 missing permission suppresses due reminder; booking never creates a grant',async t=>{
 const s=await setup(t);await s.book();const due=await s.at('seven_day');assert.equal(due['status'],'SUPPRESSED');assert.equal(due['reason'],'PERMISSION_MISSING_OR_WITHDRAWN');assert.equal((await s.f.rows('permission_event')).length,0);assert.equal((await s.f.rows('output_intent')).filter(o=>o['purpose']==='REMINDER').length,0);
});

test('NM069 withdrawal, reauthorization, duplicate input and restart affect only this business/customer and future thresholds',async t=>{
 const s=await setup(t);await s.grant();await s.book();await s.send('STOP');assert.ok((await s.jobs()).every(j=>j['status']==='SUPPRESSED'));s.f.clock.instant+=1000;
 const requestId=randomUUID();await s.app.submit(s.b,s.subject,requestId,{kind:'TEXT',value:'da mi permiso'});await s.tick();const events=await s.f.rows('permission_event');assert.equal(events.length,3);assert.equal(events.at(-1)!['decision'],'GRANT');await s.app.submit(s.b,s.subject,requestId,{kind:'TEXT',value:'da mi permiso'});await s.tick();assert.equal((await s.f.rows('permission_event')).length,3);assert.ok((await s.jobs()).every(j=>j['status']==='SCHEDULED'));
 const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());await next.tick();assert.equal((await s.f.rows('permission_event')).length,3);assert.equal((await s.f.rows('permission_event','synthetic-b')).length,0);assert.equal((await s.at('seven_day'))['status'],'ACCEPTED');
});

for(const status of ['MISSING','REJECTED','UNAVAILABLE'] as const)test('NM069 '+status+' account template holds dispatch without free-form fallback',async t=>{
 const s=await setup(t);await s.grant();await s.book();await s.reminders.configure(randomUUID(),{action:'TEMPLATE',kind:'seven_day',status});const j=await s.at('seven_day');assert.equal(j['status'],'HELD');assert.equal(j['reason'],'TEMPLATE_UNAVAILABLE');assert.equal((await s.f.rows('output_intent')).filter(o=>o['purpose']==='REMINDER').length,0);
});

test('NM069 failed delivery is auditable and never automatically resubmitted; 22h remains skipped',async t=>{
 const s=await setup(t);await s.grant();await s.book();const request=await s.at('confirmation');await s.reminders.receipt(randomUUID(),text(request['id']),'failed');const count=(await s.f.rows('local_ledger')).length;await s.tick();assert.equal((await s.jobs()).find(j=>j['id']===request['id'])!['status'],'FAILED');assert.equal((await s.f.rows('local_ledger')).length,count);assert.equal((await s.at('followup'))['status'],'SKIPPED');
});

test('NM069 reminder reschedule opens the exact RC1 appointment, retains it until proven move and invalidates old actions/history',async t=>{
 const s=await setup(t);await s.grant();const before=await s.book(),request=await s.at('confirmation');const state=await s.app.snapshot(s.b,s.subject),message=(state['replies'] as ObjectValue[]).find(r=>object(r['payload'])['jobId']===request['id'])!,buttons=object(message['payload'])['choices'] as ObjectValue[],oldConfirm=text(buttons[0]!['id']);
 let response=await s.send(text(buttons[1]!['id']),s.subject,'ACTION');assert.equal(s.last(response)['outcome'],'OFFER');assert.match(text(s.last(response)['text']),/Vamos a buscar otro horario/);assert.deepEqual((await s.f.rows('appointment'))[0],before);assert.equal((await s.f.rows('operation')).length,1);
 response=await s.send('20 ene 2030');response=await s.choose(response);assert.equal(s.last(response)['outcome'],'RESCHEDULED');const after=(await s.f.rows('appointment'))[0]!;assert.equal(after['id'],before['id']);assert.equal(after['resource_id'],before['resource_id']);assert.notEqual(after['start_at'],before['start_at']);const all=await s.jobs();assert.equal(all.length,8);assert.equal(all.filter(j=>j['scheduleRevision']===2).length,4);assert.equal(all.filter(j=>j['scheduleRevision']===3).length,4);assert.ok(all.filter(j=>j['scheduleRevision']===2).every(j=>j['attendance']==='SUPERSEDED'));assert.ok(all.filter(j=>j['scheduleRevision']===3).every(j=>j['attendance']==='PENDING'));assert.equal(all.find(j=>j['id']===request['id'])!['status'],'ACCEPTED');
 const stale=await s.send(oldConfirm,s.subject,'ACTION');assert.match(text(s.last(stale)['text']),/ya no está vigente/);assert.ok((await s.jobs()).filter(j=>j['scheduleRevision']===3).every(j=>j['attendance']==='PENDING'));assert.equal((await s.f.rows('operation')).length,2);
});

test('NM069 abandoned reminder reschedule restores prior attendance after 15 minutes without a misleading 22h follow-up',async t=>{
 const s=await setup(t);await s.grant();await s.book();const request=await s.at('confirmation'),snapshot=await s.app.snapshot(s.b,s.subject),payload=object((snapshot['replies'] as ObjectValue[]).find(r=>object(r['payload'])['jobId']===request['id'])!['payload']);await s.send(text((payload['choices'] as ObjectValue[])[1]!['id']),s.subject,'ACTION');assert.equal((await s.jobs())[0]!['attendance'],'RESCHEDULE_REQUESTED');s.f.clock.instant+=16*60000;await s.tick();assert.equal((await s.jobs())[0]!['attendance'],'PENDING');assert.equal((await s.at('followup'))['status'],'SKIPPED');assert.equal((await s.f.rows('appointment'))[0]!['state'],'ACTIVE');
});

test('NM069 proven cancellation after an earlier send retains that send and suppresses every remaining reminder',async t=>{
 const s=await setup(t);await s.grant();const before=await s.book(),sent=await s.at('seven_day');await s.choose(await s.send('cancelar'));const jobs=await s.jobs();assert.equal(jobs.find(j=>j['id']===sent['id'])!['status'],'ACCEPTED');assert.ok(jobs.filter(j=>j['id']!==sent['id']).every(j=>j['status']==='SUPPRESSED'));assert.ok(jobs.every(j=>j['attendance']==='CANCELLED'));s.f.clock.instant=Date.parse(text(before['start_at']))-3600000;await s.tick();assert.equal((await s.f.rows('output_intent')).filter(o=>o['purpose']==='REMINDER').length,1);
});

test('NM069 UNKNOWN move preserves the old schedule/history and blocks reminders without asserting a new time',async t=>{
 const s=await setup(t);await s.grant();const original=await s.book();let state=await s.send('reagendar');state=await s.choose(state);state=await s.send('20 ene 2030');s.app.providers.get(s.b)!.failure='BEFORE_APPLY';await s.choose(state);assert.deepEqual((await s.f.rows('appointment'))[0],original);assert.equal((await s.jobs()).length,4);const due=await s.at('seven_day');assert.equal(due['status'],'HELD');assert.equal(due['reason'],'APPOINTMENT_PROTECTED');assert.equal((await s.f.rows('output_intent')).filter(o=>o['purpose']==='REMINDER').length,0);assert.ok((await s.f.rows('mutation_guard')).length);
});

for(const point of ['dispatch.beforeGate','dispatch.afterGate','dispatch.afterProvider'])test('NM069 crash at '+point+' preserves original send identity and never reconstructs an invocation permit',async t=>{
 let enabled=false;const s=await setup(t,{async hit(p){if(enabled&&p===point)throw Error('rm1_synthetic_crash');}});await s.grant();await s.book();const j=(await s.jobs()).find(j=>j['kind']==='seven_day')!;s.f.clock.instant=Date.parse(text(j['dueAt']));enabled=true;
 if(point==='dispatch.afterProvider')s.app.providers.get(s.b)!.readOnly=async()=>{throw Error('simulated_process_unavailable');};
 await s.tick();const output=(await s.f.rows('output_intent')).find(o=>o['purpose']==='REMINDER')!,attempt=(await s.f.rows('attempt')).find(a=>a['output_id']===output['id'])!;assert.ok(attempt);const id=attempt['id'];
 const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());const provider=next.providers.get(s.b)!,originalSubmit=provider.submitOnce.bind(provider);provider.submitOnce=async e=>{if(e.purpose==='REMINDER')throw Error('unsafe_recovered_submit');return originalSubmit(e);};for(let i=0;i<4;i++)await next.tick();assert.equal((await s.f.rows('attempt')).filter(a=>a['output_id']===output['id']).length,1);assert.equal((await s.f.rows('attempt')).find(a=>a['id']===id)!['state'],point==='dispatch.beforeGate'?'ARMED':point==='dispatch.afterGate'?'SUBMISSION_ENTERED':'VERIFIED_APPLIED');assert.equal((await s.f.rows('local_ledger')).filter(l=>l['id']===id).length,point==='dispatch.afterProvider'?1:0);
 s.f.clock.instant+=16*60000;await next.recovery.tick();if(point==='dispatch.beforeGate')assert.equal((await s.f.rows('attempt')).find(a=>a['id']===id)!['state'],'ABANDONED');else if(point==='dispatch.afterGate')assert.equal((await s.f.rows('attempt')).find(a=>a['id']===id)!['state'],'SUBMISSION_ENTERED');
});

test('NM069 queued ordinary replies and UNKNOWN output hold reminders; no priority or alternate-channel bypass',async t=>{
 let enabled=false;const s=await setup(t,{async hit(p){if(enabled&&p==='local-reply.afterEntry')throw Error('reply_unknown');}});await s.grant();await s.book();enabled=true;await s.send('menu');const j=(await s.jobs()).find(j=>j['kind']==='seven_day')!;s.f.clock.instant=Date.parse(text(j['dueAt']));await s.tick();const due=(await s.jobs()).find(x=>x['id']===j['id'])!;assert.equal(due['status'],'HELD');assert.equal(due['reason'],'OUTBOUND_HEAD_HELD');assert.equal((await s.f.rows('output_intent')).filter(o=>o['purpose']==='REMINDER').length,0);
});

test('NM069 human mode holds reminder sends and keeps all customer support messages quiet',async t=>{
 const s=await setup(t);await s.grant();await s.book();await s.send('humano');const before=await s.app.snapshot(s.b,s.subject),due=await s.at('seven_day');assert.equal(due['reason'],'HUMAN_MODE');const after=await s.send('Sí, confirmo');assert.equal((after['replies'] as ObjectValue[]).length,(before['replies'] as ObjectValue[]).length);assert.equal((await s.jobs())[0]!['attendance'],'PENDING');assert.ok((await s.f.rows('local_support_message')).length);
});

test('NM069 source/time/evidence and template approvals cannot cross businesses or customer identities',async t=>{
 const s=await setup(t);await s.grant();await s.book();const other=s.app.ownerReminders('synthetic-b')!;assert.equal((await other.activity())['enabled'],false);assert.deepEqual((await other.activity())['templates'],[]);assert.deepEqual((await other.activity())['jobs'],[]);await assert.rejects(other.grant(randomUUID(),s.subject,'SYNTHETIC_OWNER_EVIDENCE','Evidencia falsa de otra empresa'),/unknown_customer/);
 const rows=await s.f.role('tenant_b').tx('synthetic-b',db=>db.query('SELECT * FROM core.rm1_job'));assert.equal(rows.rowCount,0);for(const table of ['rm1_job','rm1_response','rm1_receipt','rm1_event'])await assert.rejects(s.f.role('operator').tx(s.b,db=>db.query(`DELETE FROM core.${table} WHERE business_id=$1`,[s.b])),/permission denied/);
 const before=await s.at('confirmation'),state=await s.app.snapshot(s.b,s.subject),button=text((object((state['replies'] as ObjectValue[]).find(r=>object(r['payload'])['jobId']===before['id'])!['payload'])['choices'] as ObjectValue[])[0]!['id']);await s.send(button,'other-customer','ACTION');assert.equal((await s.jobs())[0]!['attendance'],'PENDING');
});

for(const [now,date] of [['2030-03-01T12:00Z','10 mar 2030'],['2030-10-25T12:00Z','3 nov 2030']] as const)test('NM069 elapsed thresholds and full Spanish labels across New York DST: '+date,async t=>{
 const s=await setup(t);s.f.clock.instant=Date.parse(now);s.scopes[0]!.config={...s.scopes[0]!.config,timeZone:'America/New_York'};await s.f.admin.query('UPDATE core.catalog_head SET time_zone=$2 WHERE business_id=$1',[s.b,'America/New_York']);await s.grant();await s.send('cita');await s.choose(await s.send(date));const ap=(await s.f.rows('appointment'))[0]!;for(const [kind,hours] of Object.entries({seven_day:168,confirmation:24,followup:22,final:2})){const j=(await s.jobs()).find(j=>j['kind']===kind)!;assert.equal(Date.parse(text(ap['start_at']))-Date.parse(text(j['dueAt'])),hours*3600000);}const request=await s.at('confirmation'),state=await s.app.snapshot(s.b,s.subject),body=text(object((state['replies'] as ObjectValue[]).find(r=>object(r['payload'])['jobId']===request['id'])!['payload'])['text']);assert.match(body,/domingo (10 de marzo|3 de noviembre) de 2030 a las 09:00/);assert.doesNotMatch(body,/hoy|mañana/);
});

test('NM069 exact two-hour enrollment threshold is skipped, never invented as immediate catch-up',async t=>{
 const s=await setup(t);await s.grant();for(const employee of (await s.catalog.load()).employees)await s.save('employee',object({...employee,hours:{2:[{start:'11:00',end:'17:00'}]}}));await s.book(1);const j=(await s.jobs()).find(j=>j['kind']==='final')!;assert.equal(j['status'],'SKIPPED');assert.equal(j['reason'],'THRESHOLD_NOT_FUTURE');
});

test('NM069 unmanaged/import-like calendar events are never adopted as contact, permission or reminders',async t=>{
 const s=await setup(t);await s.f.admin.query('INSERT INTO core.local_calendar VALUES($1,$2,$3,NULL,$4,$5,0)',[s.b,'manual-no-contact',s.f.id('calendar'),'2030-01-10T09:00Z','2030-01-10T10:00Z']);await s.tick();assert.deepEqual(await s.jobs(),[]);assert.equal((await s.f.rows('permission_event')).length,0);assert.equal((await s.f.rows('appointment')).length,0);
});

test('NM069 generic confirmation stays out of name/date inputs; stale quote never falls back to another schedule',async t=>{
 const s=await setup(t);await s.grant();await s.book();const request=await s.at('confirmation');await s.send('cita','new-customer');const offered=await s.app.snapshot(s.b,'new-customer');await s.choose(offered,0,'new-customer');const before=(await s.f.rows('customer')).length;await s.send('sí','new-customer');assert.equal((await s.f.rows('customer')).length,before);assert.equal((await s.jobs())[0]!['attendance'],'PENDING');
 await s.send('menu');await s.app.submit(s.b,s.subject,randomUUID(),{kind:'TEXT',value:'sí',replyTo:'not-the-request-message'});await s.tick();assert.equal((await s.jobs())[0]!['attendance'],'PENDING');assert.match(text(s.last(await s.app.snapshot(s.b,s.subject))['text']),/usa el botón/);
 await s.send('menu');await s.app.submit(s.b,s.subject,randomUUID(),{kind:'TEXT',value:'sí',replyTo:text(request['messageId'])});await s.tick();assert.equal((await s.jobs())[0]!['attendance'],'CONFIRMED');
});

test('NM069 multiple current requests make generic text ambiguous; exact button affects only its appointment',async t=>{
 const s=await setup(t);await s.grant();await s.book(10);await s.book(11);await s.at('confirmation');const nextRequest=(await s.jobs()).find(j=>j['kind']==='confirmation'&&j['status']==='SCHEDULED')!;s.f.clock.instant=Date.parse(text(nextRequest['dueAt']));await s.tick();await s.send('menu');await s.send('sí');assert.ok((await s.jobs()).every(j=>j['attendance']!=='CONFIRMED'));const state=await s.app.snapshot(s.b,s.subject),message=(state['replies'] as ObjectValue[]).find(r=>object(r['payload'])['jobId']===nextRequest['id'])!;await s.send(text((object(message['payload'])['choices'] as ObjectValue[])[0]!['id']),s.subject,'ACTION');assert.equal(new Set((await s.jobs()).filter(j=>j['attendance']==='CONFIRMED').map(j=>j['appointmentId'])).size,1);
});

test('NM069 concurrent schedulers produce one output/attempt/ledger effect for the same due reminder',async t=>{
 const s=await setup(t);await s.grant();await s.book();const j=(await s.jobs()).find(j=>j['kind']==='seven_day')!;s.f.clock.instant=Date.parse(text(j['dueAt']));const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());for(let i=0;i<6;i++)await Promise.all([s.app.tick(),next.tick()]);const outputs=(await s.f.rows('output_intent')).filter(o=>o['purpose']==='REMINDER');assert.equal(outputs.length,1);const attempts=(await s.f.rows('attempt')).filter(a=>a['output_id']===outputs[0]!['id']);assert.equal(attempts.length,1);assert.equal((await s.f.rows('local_ledger')).filter(l=>l['id']===attempts[0]!['id']).length,1);
});

for(const order of ['withdraw-first','entry-first'] as const)test('NM069 '+order+' race preserves final permission gate and existing in-flight boundary',async t=>{
 let enabled=false,done=false;let r:Awaited<ReturnType<typeof setup>>['reminders'];const s=await setup(t,{async hit(p){if(enabled&&!done&&p===(order==='withdraw-first'?'dispatch.beforeGate':'dispatch.afterGate')){done=true;await r.withdraw(randomUUID(),'customer-synthetic-a');}}});r=s.reminders;await s.grant();await s.book();enabled=true;const due=await s.at('seven_day');const sends=(await s.f.rows('output_intent')).filter(o=>o['purpose']==='REMINDER'),ids=new Set(sends.map(o=>o['id'])),attempts=(await s.f.rows('attempt')).filter(a=>ids.has(a['output_id']));assert.equal((await s.f.rows('local_ledger')).filter(l=>attempts.some(a=>a['id']===l['id'])).length,order==='withdraw-first'?0:1);assert.ok((await s.jobs()).filter(j=>j['kind']!=='seven_day').every(j=>j['status']==='SUPPRESSED'));if(order==='entry-first')assert.equal(due['status'],'ACCEPTED');
});

for(const point of ['rm1.afterOutputArchive','rm1-enqueue.beforeCommit','rm1-enqueue.afterCommit'])test('NM069 scheduling crash at '+point+' reuses the archived output identity',async t=>{
 let enabled=false;const s=await setup(t,{async hit(p){if(enabled&&p===point)throw Error('rm1_queue_crash');}});await s.grant();await s.book();const j=(await s.jobs()).find(j=>j['kind']==='seven_day')!;s.f.clock.instant=Date.parse(text(j['dueAt']));enabled=true;await s.app.tick();const original=await s.scopes[0]!.archive.lookup(`rm1-output/${s.b}/${j['id']}`);assert.ok(original);const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());for(let i=0;i<5;i++)await next.tick();const outputs=(await s.f.rows('output_intent')).filter(o=>o['purpose']==='REMINDER');assert.equal(outputs.length,1);assert.equal(outputs[0]!['id'],original.body['outputId']);const attempts=(await s.f.rows('attempt')).filter(a=>a['output_id']===outputs[0]!['id']);assert.equal(attempts.length,1);assert.equal((await s.f.rows('local_ledger')).filter(l=>l['id']===attempts[0]!['id']).length,1);
});

test('NM069 reminder schedule and event history roll back with every failed booking finalizer stage',async t=>{
 let enabled=false;const s=await setup(t,{async hit(p){if(enabled&&p==='dispatch.afterProvider')throw Error('lost_booking_result');}});await s.grant();const provider=s.app.providers.get(s.b)!,read=provider.readOnly.bind(provider);provider.readOnly=async()=>{if(enabled)throw Error('process_crashed');return null;};await s.send('cita');const offer=await s.send('10 ene 2030');enabled=true;await s.choose(offer);const attempt=(await s.f.rows('attempt')).find(a=>a['operation_id'])!;assert.ok(attempt);const proof=await read(attempt['envelope'] as unknown as Envelope);assert.ok(proof);assert.deepEqual(await s.jobs(),[]);
 for(const failAt of ['appointment','protection','output','guard']){await assert.rejects(recordResult({proof:proof!,result:s.scopes[0]!.result,sealer:s.scopes[0]!.sealer,archive:s.scopes[0]!.archive,failAt}),/injected_finalizer/);assert.deepEqual(await s.jobs(),[]);assert.equal((await s.f.admin.query('SELECT count(*)::int n FROM core.rm1_event')).rows[0].n,0);}
 await recordResult({proof:proof!,result:s.scopes[0]!.result,sealer:s.scopes[0]!.sealer,archive:s.scopes[0]!.archive});assert.equal((await s.jobs()).length,4);await recordResult({proof:proof!,result:s.scopes[0]!.result,sealer:s.scopes[0]!.sealer,archive:s.scopes[0]!.archive});assert.equal((await s.jobs()).length,4);
});

test('NM069 replaying old permission evidence never revives a later withdrawal or falsely reports current permission',async t=>{
 const s=await setup(t),id=randomUUID(),wording='Evidencia explícita sintética del permiso para Juanita';await s.reminders.grant(id,s.subject,'SYNTHETIC_OWNER_EVIDENCE',wording);await s.book();await s.reminders.withdraw(randomUUID(),s.subject);s.f.clock.instant+=1000;await assert.rejects(s.reminders.grant(id,s.subject,'SYNTHETIC_OWNER_EVIDENCE',wording),/permission_superseded/);assert.ok((await s.jobs()).every(j=>j['status']==='SUPPRESSED'));assert.equal((await s.f.rows('permission_event')).length,2);
});

test('NM069 receipt and response audit cannot be rewritten, and archive/template evidence contains only scoped synthetic data',async t=>{
 const s=await setup(t);await s.grant();await s.book();const request=await s.at('confirmation');await s.reminders.receipt(randomUUID(),text(request['id']),'read');await assert.rejects(s.f.admin.query('DELETE FROM core.rm1_receipt WHERE business_id=$1',[s.b]),/append_only/);await assert.rejects(s.f.admin.query('DELETE FROM core.rm1_event WHERE business_id=$1',[s.b]),/append_only/);
 const activity=await s.reminders.activity();assert.doesNotMatch(JSON.stringify(activity),/password|privateKey|controlToken|uiToken|arm_seal|payload_digest|rawPayload/);const packet=(await s.f.rows('output_intent')).find(o=>o['purpose']==='REMINDER')!;assert.equal(object(packet['payload'])['language'],'es_MX');assert.equal(object(object(packet['payload'])['templateMetadata'])['category'],'UTILITY');assert.equal(object(object(packet['payload'])['templateMetadata'])['message_send_ttl_seconds'],900);
});

test('NM069 late sent receipt cannot regress failed status, but a later delivered/read proof can supersede failure',async t=>{
 const s=await setup(t);await s.grant();await s.book();const j=await s.at('confirmation'),id=text(j['id']);await s.reminders.receipt(randomUUID(),id,'failed');await s.reminders.receipt(randomUUID(),id,'sent');assert.equal((await s.jobs()).find(x=>x['id']===id)!['status'],'FAILED');await s.reminders.receipt(randomUUID(),id,'delivered');assert.equal((await s.jobs()).find(x=>x['id']===id)!['status'],'DELIVERED');await s.reminders.receipt(randomUUID(),id,'read');await s.reminders.receipt(randomUUID(),id,'failed');assert.equal((await s.jobs()).find(x=>x['id']===id)!['receipt'],'read');
});

test('NM069 inbound arrival after reminder preparation vetoes send; existing deadline recovery restores progress without takeover',async t=>{
 let inject=false,submit:()=>Promise<void>=async()=>{};const s=await setup(t,{async hit(point){if(inject&&point==='dispatch.beforeGate'){inject=false;await submit();}}});await s.grant();await s.book();const request=await s.at('confirmation'),snapshot=await s.app.snapshot(s.b,s.subject),button=text((object((snapshot['replies'] as ObjectValue[]).find(r=>object(r['payload'])['jobId']===request['id'])!['payload'])['choices'] as ObjectValue[])[0]!['id']);await s.reminders.receipt(randomUUID(),text(request['id']),'delivered');
 submit=async()=>{await s.app.submit(s.b,s.subject,randomUUID(),{kind:'ACTION',value:button});};inject=true;const follow=await s.at('followup');assert.equal((await s.f.rows('output_intent')).filter(o=>object(o['payload'])['jobId']===follow['id']&&o['state']==='ACCEPTED').length,0);
 s.f.clock.instant+=16*60000;await s.app.recovery.tick();await s.tick();assert.equal((await s.jobs()).find(j=>j['id']===request['id'])!['attendance'],'CONFIRMED');assert.equal((await s.f.rows('appointment')).length,1);
});

test('NM069 two active businesses use independent permission and template fixtures at the same due time',async t=>{
 const s=await setup(t);s.scopes[0]!.businessName='Juanita';s.scopes[1]!.businessName='Bernard';await s.grant();await s.book();const r=s.app.ownerReminders('synthetic-b')!;await r.configure(randomUUID(),{action:'ENABLE',enabled:true});await r.grant(randomUUID(),'customer-synthetic-b','SYNTHETIC_OWNER_EVIDENCE','Permiso sintético para Bernard');
 const send=async(value:string,kind:'TEXT'|'ACTION'='TEXT')=>{await s.app.submit('synthetic-b','customer-synthetic-b',randomUUID(),{kind,value});await s.tick();return s.app.snapshot('synthetic-b','customer-synthetic-b');};await send('cita');let state=await send('10 ene 2030');await send(text(s.choices(state)[0]!['id']),'ACTION');await s.reminders.configure(randomUUID(),{action:'TEMPLATE',kind:'seven_day',status:'MISSING'});await s.at('seven_day');const a=(await s.jobs()).find(j=>j['kind']==='seven_day')!,b=((await r.activity())['jobs'] as ObjectValue[]).find(j=>j['kind']==='seven_day')!;assert.equal(a['status'],'HELD');assert.equal(b['status'],'ACCEPTED');state=await s.app.snapshot('synthetic-b','customer-synthetic-b');const message=object((state['replies'] as ObjectValue[]).find(row=>object(row['payload'])['jobId']===b['id'])!['payload']);assert.match(text(message['text']),/en Bernard/);assert.doesNotMatch(text(message['text']),/Juanita/);
});

for(const field of ['waba','number_id'] as const)test('NM069 stale synthetic approval cannot follow a changed '+field+' binding',async t=>{
 const s=await setup(t);await s.grant();await s.book();await s.f.admin.query(`UPDATE core.channel SET ${field}=$2,revision=revision+1 WHERE business_id=$1`,[s.b,'different-synthetic-account']);const j=await s.at('seven_day');assert.equal(j['reason'],'TEMPLATE_UNAVAILABLE');assert.equal((await s.f.rows('output_intent')).filter(o=>o['purpose']==='REMINDER').length,0);
});
