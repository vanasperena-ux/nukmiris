import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {locked,freeLoopbackPort,recoverLegacyLock,publishCommandMetadata} from './command-lock.mjs';
import {childProcess} from './child.mjs';
import {ROLES} from './fixture.mjs';
async function profile(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nukmiris-vnext-lock-')),id=randomUUID().replaceAll('-',''),container='nukmiris-vnext-'+id;const s={format:1,mode:'SYNTHETIC_INERT',directory,id,container,network:container,volume:container+'-data',database:'nukmiris_vnext_'+id,host:'127.0.0.1',port:55432,commandPort:await freeLoopbackPort(),adminPassword:'a'.repeat(64),controlToken:'b'.repeat(64),passwords:Object.fromEntries(ROLES.map(r=>['wp1_'+r,'c'.repeat(64)]))};await fs.writeFile(path.join(directory,'state.json'),JSON.stringify(s),{mode:0o600});t.after(()=>fs.rm(directory,{recursive:true,force:true}));return s;}
test('W3 a live command remains exclusive; contender cannot alter metadata or execute',async t=>{
 const s=await profile(t);await locked(s,async()=>{const before=await fs.readFile(path.join(s.directory,'.command.lock'),'utf8');let ran=false;await assert.rejects(locked(s,async()=>{ran=true;}),e=>e.code==='CLI_LOCK_BUSY');assert.equal(ran,false);assert.equal(await fs.readFile(path.join(s.directory,'.command.lock'),'utf8'),before);const m=JSON.parse(before);assert.equal(m.pid,process.pid);assert.equal(m.instance,s.id);assert.ok(Number.isFinite(Date.parse(m.startedAt)));});
 await assert.rejects(fs.stat(path.join(s.directory,'.command.lock')),{code:'ENOENT'});
});
test('W3 a crashed real CLI child leaves diagnostic metadata and a new command recovers without PID killing',async t=>{
 const s=await profile(t),child=childProcess(fileURLToPath(new URL('./lock-worker.mjs',import.meta.url)),{directory:s.directory});t.after(()=>child.crash());await child.message('ready');const old=JSON.parse(await fs.readFile(path.join(s.directory,'.command.lock'),'utf8'));await child.crash();assert.equal((await locked(s,async recovery=>recovery)).recovered,true);assert.equal(old.pid,child.child.pid);
});
test('W3 reboot/PID reuse residue cannot brick commands; concurrent recovery has at most one owner',async t=>{
 const s=await profile(t);await fs.writeFile(path.join(s.directory,'.command.lock'),JSON.stringify({format:1,pid:process.pid,instance:s.id,startedAt:'2000-01-01T00:00:00Z',owner:randomUUID(),port:s.commandPort}));let active=0,max=0;
 const work=()=>locked(s,async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,20));active--;});const result=await Promise.allSettled([work(),work(),work()]);assert.equal(max,1);assert.ok(result.some(r=>r.status==='fulfilled'));for(const r of result)if(r.status==='rejected')assert.equal(r.reason.code,'CLI_LOCK_BUSY');
});
test('W3 legacy/corrupt lock is preserved with a recovery command; explicit instance confirmation is required',async t=>{
 const s=await profile(t),file=path.join(s.directory,'.command.lock');await fs.writeFile(file,'');await assert.rejects(locked(s,async()=>{}),e=>e.code==='CLI_LOCK_RECOVERY_REQUIRED'&&e.message.includes('demo:unlock'));assert.equal(await fs.readFile(file,'utf8'),'');await assert.rejects(recoverLegacyLock(s,'wrong'),/exact_instance_id/);assert.equal((await recoverLegacyLock(s,s.id)).legacyRecordRetained,true);assert.equal(await locked(s,async()=>true),true);
});
test('W9 Windows-shaped flush rejects the former read-only handle; metadata flushes its writable creator',async t=>{
 const s=await profile(t),file=path.join(s.directory,'metadata salón Ω.json'),metadata={owner:randomUUID(),instance:s.id},events=[];
 // Actual files/rename, with the Windows access-mode requirement modeled at sync.
 const io={...fs,async open(name,flags,mode){events.push('open:'+flags);const h=await fs.open(name,flags,mode);return {async writeFile(value){events.push('write');await h.writeFile(value);},async sync(){events.push('sync:'+flags);if(flags==='r')throw Object.assign(Error('EPERM: operation not permitted, fsync'),{code:'EPERM',syscall:'fsync'});await h.sync();},async close(){events.push('close');await h.close();}};},async rename(from,to){events.push('rename');assert.equal(await fs.readFile(from,'utf8'),JSON.stringify(metadata)+'\n');await fs.rename(from,to);}};
 await fs.writeFile(file,'old');const legacy=await io.open(file,'r');try{await assert.rejects(legacy.sync(),e=>e.code==='EPERM'&&e.syscall==='fsync');}finally{await legacy.close();}
 events.length=0;await publishCommandMetadata(file,metadata,io);assert.deepEqual(events,['open:wx','write','sync:wx','close','rename']);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),metadata);assert.equal((await fs.readdir(s.directory)).filter(n=>n.endsWith('.tmp')).length,0);
});
for(const failure of ['write','sync','close','rename'])test('W9 '+failure+' failure preserves prior metadata, cleans only its temporary file and propagates failure',async t=>{
 const s=await profile(t),file=path.join(s.directory,'.command.lock'),metadata={owner:randomUUID()},before='original diagnostic record';await fs.writeFile(file,before);const calls=[];
 const fail=()=>{throw Object.assign(Error('injected '+failure),{code:'EPERM'});};
 const io={...fs,async open(name,flags,mode){const h=await fs.open(name,flags,mode);return {async writeFile(value){calls.push('write');if(failure==='write')fail();await h.writeFile(value);},async sync(){calls.push('sync');if(failure==='sync')fail();await h.sync();},async close(){calls.push('close');await h.close();if(failure==='close')fail();}};},async rename(from,to){calls.push('rename');if(failure==='rename')fail();await fs.rename(from,to);}};
 await assert.rejects(publishCommandMetadata(file,metadata,io),e=>e.code==='EPERM');assert.equal(await fs.readFile(file,'utf8'),before);assert.equal((await fs.readdir(s.directory)).filter(n=>n.endsWith('.tmp')).length,0);assert.ok(calls.includes('close'));if(['write','sync','close'].includes(failure))assert.equal(calls.includes('rename'),false);
});
test('W9 exclusive-create collision never removes a pre-existing temporary file',async t=>{
 const s=await profile(t),file=path.join(s.directory,'.command.lock'),metadata={owner:randomUUID()},temp=file+'.'+metadata.owner+'.tmp';await fs.writeFile(temp,'unowned');await assert.rejects(publishCommandMetadata(file,metadata),e=>e.code==='EEXIST');assert.equal(await fs.readFile(temp,'utf8'),'unowned');
});
test('W9 native Windows rejects read-only fsync and publishes through a writable exclusive handle',{skip:process.platform!=='win32'},async t=>{
 const s=await profile(t),file=path.join(s.directory,'metadata salón Ω.json'),metadata={owner:randomUUID(),instance:s.id};await fs.writeFile(file,'old');const h=await fs.open(file,'r');try{await assert.rejects(h.sync(),e=>e.code==='EPERM');}finally{await h.close();}await publishCommandMetadata(file,metadata);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),metadata);console.log(JSON.stringify({nativeWindowsMetadataSync:'EXECUTED',platform:process.platform,node:process.version}));
});
