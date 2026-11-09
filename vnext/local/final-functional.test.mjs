import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {localFixture,httpClient} from './test-fixture.mjs';
import {connection} from './fixture.mjs';
import {start,stopWorker} from './runtime.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms)),overview=/Tu cita actual|Tus próximas citas|Cita registrada/;
const body=state=>[...(state.replies.at(-1).payload.precedingTexts??[]),state.replies.at(-1).payload.text].join('\n');

test('Final three corrections through authenticated TCP HTTP: safe names, explicit summaries, durable quiet human mode',{timeout:660000},async t=>{
 const {s,running}=await localFixture(t);let c=await httpClient(s,running);
 const send=async(session,value,kind='TEXT',id=randomUUID(),reply=true)=>{
  const admitted=await c.call('/api/message',{requestId:id,payload:{kind,value}},session);
  for(let i=0;i<200;i++){const state=await c.call('/api/state',undefined,session),input=state.inputs.find(i=>i.id===admitted.inputId);if(input?.state==='DONE'&&(!reply||state.replies.some(r=>r.sequence===input.sequence)))return {admitted,state};await wait(50);}throw Error('final_http_wait');
 };
 const latest=state=>state.replies.at(-1).payload,choose=async(session,state,index=0)=>send(session,latest(state).choices[index].id,'ACTION');
 // Two real existing appointments, created through the accepted fake-calendar path.
 let state=(await send(c.session,'cita')).state;state=(await choose(c.session,state)).state;assert.equal(latest(state).outcome,'CONFIRMED');
 state=(await send(c.session,'agendar')).state;state=(await choose(c.session,state,2)).state;state=(await choose(c.session,state,1)).state;assert.equal(latest(state).outcome,'CONFIRMED',JSON.stringify({reply:latest(state),diagnostics:state.diagnostics}));assert.doesNotMatch(body(state),overview);assert.equal(state.appointments.length,2);
 for(const command of ['menu','Hola!','cita','agendar']){state=(await send(c.session,command)).state;assert.equal((body(state).match(/^\d+\. /gm)??[]).length,2,command);}
 state=(await send(c.session,'menu')).state;state=(await choose(c.session,state)).state;assert.doesNotMatch(body(state),overview);state=(await choose(c.session,state,2)).state;assert.doesNotMatch(body(state),overview);state=(await choose(c.session,state,2)).state;assert.equal(latest(state).presentation,'LIST');assert.doesNotMatch(body(state),overview);state=(await choose(c.session,state)).state;assert.doesNotMatch(body(state),overview);state=(await send(c.session,'31 nov')).state;assert.doesNotMatch(body(state),overview);
 // Command and real menu action enter human mode without an overview.
 for(const kind of ['TEXT','ACTION']){
  state=(await send(c.session,'menu')).state;state=(await send(c.session,kind==='TEXT'?'humano':latest(state).choices[2].id,kind)).state;assert.equal(latest(state).outcome,'HUMAN_HANDOFF');assert.doesNotMatch(body(state),overview);const n=state.replies.length;await send(c.session,'necesito ayuda','TEXT',undefined,false);
  const db=new pg.Client(connection(s));await db.connect();let queued;try{queued=(await db.query('SELECT * FROM core.local_support_message ORDER BY input_id')).rows;}finally{await db.end();}
  await stopWorker(s);const restarted=await start(s,Number(new URL(running.url).port));c=await httpClient(s,restarted);state=(await send(c.session,'agendar','TEXT',undefined,false)).state;assert.equal(state.replies.length,n);assert.equal(state.appointments.length,2);const check=new pg.Client(connection(s));await check.connect();try{const after=(await check.query('SELECT * FROM core.local_support_message ORDER BY input_id')).rows;for(const row of queued)assert.deepEqual(after.find(x=>x.input_id===row.input_id),row);}finally{await check.end();}
  state=(await send(c.session,'menu')).state;assert.equal((body(state).match(/^\d+\. /gm)??[]).length,2);
 }
 const newSession=await c.call('/api/session',{businessId:'synthetic-a',persona:'new'}),namePrompt=async()=>{await send(newSession,'menu');const offered=(await send(newSession,'cita')).state;const selected=await choose(newSession,offered);assert.equal(latest(selected.state).outcome,'NAME_REQUIRED');};
 await namePrompt();state=(await send(newSession,'hablar con alguien')).state;assert.equal(latest(state).outcome,'HUMAN_HANDOFF');assert.equal(state.appointments.length,0);assert.doesNotMatch(body(state),overview);
 await namePrompt();const baseline=new pg.Client(connection(s));await baseline.connect();const totals=async()=>{const r={};for(const table of ['appointment','operation','attempt','protection','mutation_guard','local_booking_intent'])r[table]=Number((await baseline.query('SELECT count(*) n FROM core.'+table)).rows[0].n);return r;};
 try{const before=await totals();for(const value of ['quiero cancelar','ok gracias','mañana','Ana@example.com','Ana-cancelar','M.']){state=(await send(newSession,value)).state;assert.equal(latest(state).outcome,'NAME_REQUIRED');assert.match(body(state),/ambos apellidos/);assert.equal((await baseline.query('SELECT count(*)::int n FROM core.customer WHERE business_id=$1 AND subject=$2',['synthetic-a',newSession.subject])).rows[0].n,0);assert.deepEqual(await totals(),before);}
  for(const value of ['','   ','\t\n'])await assert.rejects(c.call('/api/message',{requestId:randomUUID(),payload:{kind:'TEXT',value}},newSession),/400/);
 }finally{await baseline.end();}
 const requestId=randomUUID(),valid=await send(newSession,'María Fernández','TEXT',requestId);assert.equal(latest(valid.state).outcome,'CONFIRMED');assert.equal(valid.state.appointments.length,1);assert.equal(valid.state.calendar.length,3);const retry=await send(newSession,'María Fernández','TEXT',requestId);assert.equal(retry.admitted.inputId,valid.admitted.inputId);assert.equal(retry.state.calendar.length,3);const foreign=await c.call('/api/session',{businessId:'synthetic-b',persona:'known'});assert.equal((await c.call('/api/state',undefined,foreign)).calendar.length,0);
 console.log(JSON.stringify({finalFunctional:'PASS',platform:process.platform,node:process.version,postgres:s.observed.serverVersion,realHttp:true,existingBookings:2,invalidNameEffects:0,directCitaAgendarAll:true,menuBookingNoRepeat:true,humanEntryNoSummary:true,quietQueueRestart:true,validNameDirectBooking:true,stableRequestReplay:true,tenantIsolation:true,ownerProfileAccessed:false,nativeWindows:process.platform==='win32'?'EXECUTED':'NOT RUN'}));
});
