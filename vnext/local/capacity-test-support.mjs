import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {freeLoopbackPort,locked} from './command-lock.mjs';
import {readState,destroy} from './fixture.mjs';
import {stop,request,workerState,stopWorker} from './runtime.mjs';
import {prepareCapacity,startCapacity,PERSONAS} from './capacity-fixture.mjs';
import {httpClient} from './test-fixture.mjs';
export const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function crashCapacity(s){
 const worker=await workerState(s);await request(s,worker,'crash').catch(e=>{if(!['ECONNRESET','EPIPE'].includes(e.code))throw e;});
 for(let i=0;i<100;i++){
  try{await request(s,worker);}catch(e){if(e.code==='ECONNREFUSED'){await stopWorker(s);return;}if(e.code!=='ECONNRESET')throw e;}
  await wait(50);
 }
 throw Error('capacity_crash_exit_not_observed');
}
export async function capacityFixture(t,{cliPrepare=false}={}){
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'nukmiris-capacity-'));
 const directory=path.join(parent,'Espacios y María','nukmiris-vnext-capacity-test');await fs.mkdir(path.dirname(directory));
 const dbPort=await freeLoopbackPort(),uiPort=await freeLoopbackPort();let s;
 if(cliPrepare){await promisify(execFile)(process.execPath,[fileURLToPath(new URL('./capacity-cli.mjs',import.meta.url)),'prepare','--state-dir',directory,'--db-port',String(dbPort),'--port',String(uiPort)],{windowsHide:true,timeout:660000,maxBuffer:1024*1024});s=await readState(directory);}
 else s=await prepareCapacity(directory,{dbPort,uiPort});
 t.after(async()=>{const current=await readState(directory);await stop(current).catch(()=>{});await destroy(current);await fs.rm(parent,{recursive:true});});
 const running=await locked(s,()=>startCapacity(s));return {s,running,parent,directory};
}
export async function capacityClient(s,running,businessId='synthetic-a'){
 const c=await httpClient(s,running),sessions=Object.fromEntries(await Promise.all(PERSONAS.map(async persona=>[persona,await c.call('/api/session',{businessId,persona})])));
 const report=()=>c.call('/api/capacity',undefined,sessions.known),state=p=>c.call('/api/state',undefined,sessions[p]);
 async function until(predicate){let r;for(let i=0;i<200;i++){r=await report();if(predicate(r))return r;await wait(50);}throw Error('capacity_wait:'+JSON.stringify(r));}
 async function send(p,value,kind='TEXT',requestId=randomUUID()){
  const admission=await c.call('/api/message',{requestId,payload:{kind,value}},sessions[p]);let snapshot;
  for(let i=0;i<200;i++){snapshot=await state(p);const input=snapshot.inputs.find(x=>x.id===admission.inputId);if(input?.state==='DONE'&&snapshot.replies.some(r=>r.sequence===input.sequence))return {admission,state:snapshot};await wait(50);}throw Error('capacity_input_not_terminal');
 }
 const offer=async p=>{const sent=await send(p,'cita'),r=await report(),view=r.currentOffers.find(x=>x.subject===sessions[p].subject);assert.ok(view.slots.length>=2);return {sent,view,first:view.slots[0]};};
 const book=async p=>{const o=await offer(p);assert.equal(Date.parse(o.first.slot.startAt),Date.parse(s.capacityFixture.startAt));const result=await send(p,o.first.actionId,'ACTION');await until(r=>r.appointments.some(a=>a.subject===sessions[p].subject&&a.state==='ACTIVE')&&r.counts.pendingAttempts===0);return result;};
 return {...c,sessions,report,state,until,send,offer,book};
}
