import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {destroy,readState,connection} from './fixture.mjs';
import {start,stop,backup,workerState,request} from './runtime.mjs';
import {enableInteractive} from './interactive-profile.mjs';
import {restoreInteractive,verifyBundle} from './coherent-backup.mjs';
import {freeLoopbackPort,commandPort,guardError,moveGuardPort,locked} from './command-lock.mjs';
import net from 'node:net';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {dockerRunner} from './platform.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
import {localFixture,httpClient} from './test-fixture.mjs';
test('L2 TCP/browser HTTP: real indexed archive, known/new booking, tenant auth, crash/restart and coherent inert restore',{timeout:660000},async t=>{
 const {s,running,parent}=await localFixture(t),c=await httpClient(s,running);assert.ok(s.port<49152&&s.commandPort<49152);assert.equal((await fetch(c.origin+'/api/state')).status,401);assert.equal((await fetch(c.origin+'/api/auth',{method:'POST',headers:{Origin:'http://evil.invalid','Content-Type':'application/json'},body:JSON.stringify({token:s.application.uiToken})})).status,403);
 await c.send({kind:'TEXT',value:'cita'});const offered=await c.until(x=>x.replies.length===1);assert.equal(offered.replies[0].payload.choices.length,3);await c.send({kind:'ACTION',value:offered.replies[0].payload.choices[0].id});const confirmed=await c.until(x=>x.replies.some(r=>r.payload.outcome==='CONFIRMED'));assert.equal(confirmed.calendar.length,1);assert.equal(confirmed.appointments.length,1);assert.match(confirmed.replies.at(-1).payload.text,/Lucía|Sofía/);
 const newer=await c.call('/api/session',{businessId:'synthetic-a',persona:'new'});await c.call('/api/message',{requestId:randomUUID(),payload:{kind:'TEXT',value:'menu'}},newer);let fresh;for(let i=0;i<100;i++){fresh=await c.call('/api/state',undefined,newer);if(fresh.replies.length)break;await wait(100);}await c.call('/api/message',{requestId:randomUUID(),payload:{kind:'ACTION',value:fresh.replies[0].payload.choices[0].id}},newer);for(let i=0;i<100;i++){fresh=await c.call('/api/state',undefined,newer);if(fresh.replies.at(-1).payload.outcome==='NAME_REQUIRED')break;await wait(100);}assert.equal(fresh.appointments.length,0);await c.call('/api/message',{requestId:randomUUID(),payload:{kind:'TEXT',value:'María Ejemplo'}},newer);for(let i=0;i<100;i++){fresh=await c.call('/api/state',undefined,newer);if(fresh.replies.some(r=>r.payload.outcome==='CONFIRMED'))break;await wait(100);}assert.equal(fresh.appointments.length,1);assert.equal(fresh.calendar.length,2);
 const other=await c.call('/api/session',{businessId:'synthetic-b',persona:'known'});assert.equal((await c.call('/api/state',undefined,other)).calendar.length,0);
 await request(s,await workerState(s),'crash');await wait(250);const restarted=await start(s,running.url?Number(new URL(running.url).port):3077),after=await httpClient(s,restarted);const persisted=await after.state();assert.equal(persisted.calendar.length,2);assert.equal(persisted.appointments.length,1);assert.equal(persisted.replies.at(-1).payload.outcome,'CONFIRMED');
 const bundle=await backup(s);assert.equal(bundle.coherent,true);await verifyBundle(bundle.directory,bundle.manifestSha256);const restored=await restoreInteractive(bundle.directory,bundle.manifestSha256,path.join(parent,'nukmiris-vnext-restored'),{port:await freeLoopbackPort()}),target=await readState(restored.directory);t.after(async()=>{await destroy(target);});assert.equal(restored.dispatchEnabled,false);await assert.rejects(enableInteractive(target),/restored_profile_is_inert/);await assert.rejects(start(target,await freeLoopbackPort()),/restored_profile_is_inert/);
 const db=new pg.Client(connection(target));await db.connect();try{assert.equal((await db.query('SELECT count(*)::int n FROM core.local_calendar')).rows[0].n,2);assert.equal((await db.query("SELECT bool_and(status='SUSPENDED' AND NOT dispatch_enabled) v FROM core.business")).rows[0].v,true);}finally{await db.end();}
 const corrupt=path.join(parent,'corrupted-backup');await fs.cp(bundle.directory,corrupt,{recursive:true});await fs.appendFile(path.join(corrupt,'custody/archive.sqlite'),'corrupt');await assert.rejects(verifyBundle(corrupt,bundle.manifestSha256),/backup_file_digest_mismatch/);await assert.rejects(verifyBundle(bundle.directory,'0'.repeat(64)),/manifest_digest_mismatch/);
 console.log(JSON.stringify({interactiveLocal:'PASS',platform:process.platform,node:process.version,postgres:s.observed.serverVersion,tcp:true,restart:true,coherentBackup:true,inertRestore:true,bookings:2,realProviders:false,nativeWindows:process.platform==='win32'?'EXECUTED':'NOT RUN'}));
});
test('W8 low ports and confirmed guard relocation from EACCES preserve live-command exclusion',async t=>{
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'nukmiris-vnext-w8-'));t.after(()=>fs.rm(parent,{recursive:true,force:true}));const s={id:randomUUID().replaceAll('-',''),directory:parent,port:15432,commandPort:await freeLoopbackPort()};await fs.writeFile(path.join(parent,'state.json'),JSON.stringify(s));assert.ok(commandPort({...s,commandPort:undefined})<49152);assert.ok(s.commandPort<49152);assert.equal(guardError({code:'EACCES'},55432).code,'CLI_GUARD_PORT_RESERVED');assert.match(guardError({code:'EACCES'},55432).message,/netsh interface ipv4/);
 const port=await freeLoopbackPort();await assert.rejects(moveGuardPort(s,'wrong',port),/exact_instance/);const result=await moveGuardPort(s,s.id,port,{bind:async(server,p)=>{if(p===s.commandPort)throw Object.assign(Error('reserved'),{code:'EACCES'});await new Promise((r,j)=>{server.once('error',j);server.listen(p,'127.0.0.1',r);});}});assert.equal(result.commandPort,port);const updated=JSON.parse(await fs.readFile(path.join(parent,'state.json')));await locked(updated,async()=>{await assert.rejects(moveGuardPort(updated,updated.id,await freeLoopbackPort()),e=>e.code==='CLI_LOCK_BUSY');});
 const occupied=net.createServer();await new Promise(r=>occupied.listen(port,'127.0.0.1',r));await assert.rejects(locked(updated,async()=>{}),e=>e.code==='CLI_LOCK_BUSY');await new Promise(r=>occupied.close(r));
});
test('W8 Docker Windows bind-forbidden diagnostics identify the reserved port without daemon advice',async()=>{
 const run=dockerRunner(async()=>{throw {code:1,stderr:'Error response from daemon: ports are not available: bind: An attempt was made to access a socket in a way forbidden by its access permissions.'};},'win32');await assert.rejects(run(['start','synthetic']),e=>e.message.includes('port is occupied or reserved')&&e.message.includes('netsh')&&!e.message.includes('Start Docker Desktop'));
});
test('L2 published demo:book/start/stop CLI works with spaces/Unicode and reuses the original profile',{timeout:660000},async t=>{
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'nukmiris-vnext- chat salón Ω ')),directory=path.join(parent,'.local-demo');let s;t.after(async()=>{if(s){await stop(s).catch(()=>{});await destroy(s);}await fs.rm(parent,{recursive:true,force:true});});
 const exec=promisify(execFile),cli=fileURLToPath(new URL('./cli.mjs',import.meta.url)),run=async(command,args=[])=>{const {stdout}=await exec(process.execPath,[cli,command,'--state-dir',directory,...args],{windowsHide:true,timeout:660000,maxBuffer:1024*1024});return JSON.parse(stdout);};
 const started=await run('book',['--db-port','0','--port','0']);s=await readState(directory);assert.equal(started.interactiveBookingEnabled,true);assert.ok(Number(new URL(started.url).port)<49152);const again=await run('book');assert.equal(again.url,started.url);assert.equal(again.instance,s.id);
 const c=await httpClient(s,started);await c.send({kind:'TEXT',value:'menu'});const offered=await c.until(x=>x.replies.length===1);await c.send({kind:'ACTION',value:offered.replies[0].payload.choices[0].id});await c.until(x=>x.appointments.length===1&&x.replies.some(r=>r.payload.outcome==='CONFIRMED'));assert.equal((await run('stop')).stopped,true);const restarted=await run('start',['--port','0']);assert.equal(restarted.instance,s.id);assert.equal((await (await httpClient(s,restarted)).state()).calendar.length,1);
});
