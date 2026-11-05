import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {locked,freeLoopbackPort,recoverLegacyLock} from './command-lock.mjs';
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
