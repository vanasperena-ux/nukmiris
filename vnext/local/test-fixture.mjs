import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {provision,destroy} from './fixture.mjs';
import {start,stop} from './runtime.mjs';
import {enableInteractive} from './interactive-profile.mjs';
import {freeLoopbackPort} from './command-lock.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function localFixture(t){const parent=await fs.mkdtemp(path.join(os.tmpdir(),'nukmiris-vnext-l2-')),directory=path.join(parent,'nukmiris-vnext-profile');const s=await provision(directory,{port:0});t.after(async()=>{await stop(s).catch(()=>{});await destroy(s);await fs.rm(parent,{recursive:true,force:true});});await enableInteractive(s);const running=await start(s,await freeLoopbackPort());return {s,running,parent};}
export async function httpClient(s,running){
 const origin=new URL(running.url).origin;const auth=await fetch(origin+'/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:s.application.uiToken})});assert.equal(auth.status,200);const cookie=auth.headers.get('set-cookie').split(';')[0];
 const call=async(route,body,session)=>{const r=await fetch(origin+route,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{Origin:origin,'Content-Type':'application/json'}:{}),...(session?{'x-local-session':session.token}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok)throw Error(r.status+':'+JSON.stringify(value));return value;};
 const session=await call('/api/session',{businessId:'synthetic-a',persona:'known'});
 const state=()=>call('/api/state',undefined,session),send=payload=>call('/api/message',{requestId:randomUUID(),payload},session);
 const until=async predicate=>{let current;for(let i=0;i<150;i++){current=await state();if(predicate(current))return current;await wait(100);}throw Error('interactive_wait_timeout:'+JSON.stringify({inputs:current.inputs,diagnostics:current.diagnostics}));};
 return {origin,cookie,call,session,state,send,until};
}
