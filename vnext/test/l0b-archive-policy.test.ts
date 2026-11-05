import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as turn} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {archiveFixture,corrupt} from './support/archive-fixture.js';
import {archiveRead,boundedArchive} from '../src/application/archive-policy.js';
import {ArchiveBusyError,ArchivePendingError,ArchiveHeldError,ArchiveDeadlineError,ArchiveIncompatibleError} from '../src/infrastructure/archive/availability.js';
import {tenantId} from '../src/domain/tenant.js';
import {IndexedArchive} from '../src/infrastructure/archive/indexed-archive.js';

test('N1 bounded read retries revalidate transient state but never convert failure to authenticated absence',async()=>{
 let n=0;assert.equal(await archiveRead(async()=>{if(++n<3)throw new ArchivePendingError();return 'original';}), 'original');assert.equal(n,3);
 n=0;await assert.rejects(archiveRead(async()=>{n++;throw new ArchiveBusyError('SQLITE_BUSY');}),ArchiveBusyError);assert.equal(n,5);
 n=0;await assert.rejects(archiveRead(async()=>{n++;throw new Error('archive_record_authentication');}),/authentication/);assert.equal(n,1);
 n=0;await assert.rejects(archiveRead(async()=>{n++;throw new ArchiveHeldError('REPAIR_FENCE');}),ArchiveHeldError);assert.equal(n,1);
});
test('N1 whole facade call, including mutex queue wait, has a caller deadline',async()=>{
 let calls=0;const start=performance.now();await assert.rejects(archiveRead(()=>{calls++;return new Promise<never>(()=>{});},15),e=>e instanceof ArchiveDeadlineError&&e.phase==='CALLER');
 assert.equal(calls,1);assert.ok(performance.now()-start<2000);
});
test('N1 composing bounded facades does not multiply the five-read bound',async t=>{
 const f=await archiveFixture(t);let calls=0;
 const failing={...f.scope,lookup:async()=>{calls++;throw new ArchiveBusyError('SQLITE_BUSY');}};
 await assert.rejects(boundedArchive(boundedArchive(failing)).lookup('key'),ArchiveBusyError);assert.equal(calls,5);
});
test('A3 a never-answering witness read fails by deadline without allocating or changing archive data',async t=>{
 const f=await archiveFixture(t);await f.scope.ensure('original','ARM',{ownerId:'original'});
 await assert.rejects(f.open({...f.config,witnessTimeoutMs:20,witness:{read:()=>new Promise(()=>{}),advance:(e,h)=>f.config.witness.advance(e,h)}}),e=>e instanceof ArchiveDeadlineError&&e.phase==='WITNESS_READ');
 assert.equal((await f.scope.records()).length,1);assert.equal((await f.scope.lookup('original'))?.body['ownerId'],'original');
});
test('A3 never-answering witness advance releases the mutex, leaves pending state and preserves the original identity on repair',async t=>{
 const f=await archiveFixture(t),a=await f.open({...f.config,witnessTimeoutMs:20,witness:{read:()=>f.config.witness.read(),advance:()=>new Promise(()=>{})}}),s=a.scope('synthetic-a');let allocated=0;
 await assert.rejects(s.ensure('timed','ARM',{},()=>({ownerId:`original-${++allocated}`})),e=>e instanceof ArchiveDeadlineError&&e.phase==='WITNESS_ADVANCE');
 await assert.rejects(s.lookup('timed'),ArchivePendingError);await assert.rejects(s.ensure('timed','ARM',{},()=>({ownerId:`new-${++allocated}`})),ArchivePendingError);assert.equal(allocated,1);
 a.close();const r=await f.repair();assert.equal((await r.archive.scope('synthetic-a').lookup('timed'))?.body['ownerId'],'original-1');
});
test('A3 a witness response arriving after its deadline cannot run confirmation or allocate a replacement owner',async t=>{
 const f=await archiveFixture(t);let complete!:()=>Promise<void>;
 const a=await f.open({...f.config,witnessTimeoutMs:20,witness:{read:()=>f.config.witness.read(),advance:(expected,head)=>new Promise(resolve=>{complete=async()=>{resolve(await f.config.witness.advance(expected,head));};})}}),s=a.scope('synthetic-a');
 await assert.rejects(s.ensure('late','ARM',{ownerId:'original'}),ArchiveDeadlineError);await complete();await turn();
 await assert.rejects(s.lookup('late'),ArchivePendingError);const r=await f.repair();assert.equal((await r.archive.scope('synthetic-a').ensure('late','ARM',{},()=>({ownerId:'replacement'}))).body['ownerId'],'original');
});
test('A3 expired queued writes never run their allocation callback and do not steal active ownership',async t=>{
 const f=await archiveFixture(t);let arrived!:()=>void,release!:()=>void;
 const reached=new Promise<void>(r=>{arrived=r;}),paused=new Promise<void>(r=>{release=r;});
 const a=await f.open({...f.config,queueTimeoutMs:20,faults:{async hit(p){if(p==='archive.afterDataCommit'){arrived();await paused;}}}}),s=a.scope('synthetic-a');
 const first=s.ensure('first','ARM',{});await reached;let allocations=0;
 try{await assert.rejects(s.ensure('expired','ARM',{},()=>({id:++allocations})),e=>e instanceof ArchiveDeadlineError&&e.phase==='QUEUE');}
 finally{release();}
 await first;await turn();assert.equal(allocations,0);assert.equal(await s.lookup('expired'),null);a.close();
});
test('A3 timed-out repair witness completion releases the mutex while its epoch and data remain held',async t=>{
 const f=await archiveFixture(t);await f.scope.ensure('original','ARM',{ownerId:'original'});
 const a=await f.open({...f.config,witnessTimeoutMs:20}),permit=f.witness.beginRepair();
 await assert.rejects(a.repair({...permit,finish:()=>new Promise(()=>{})}),e=>e instanceof ArchiveDeadlineError&&e.phase==='WITNESS_FINISH');
 await assert.rejects(a.scope('synthetic-a').lookup('original'),ArchiveHeldError);a.close();
 const r=await f.repair();assert.equal((await r.archive.scope('synthetic-a').lookup('original'))?.body['ownerId'],'original');
});
for(const key of ['BusinessId','business_id','BUSINESS__ID','tenantId','tenant_id','Tenant_ID'])test('N4/A1 rejects unsupported tenant-binding key '+key,async t=>{
 const f=await archiveFixture(t);await assert.rejects(f.scope.ensure('alias','HISTORY',{nested:[{[key]:'synthetic-a'}]}),/tenant_binding_key_unsupported/);assert.deepEqual(await f.scope.records(),[]);
});
for(const value of ['Synthetic-a','synthetic_a',' synthetic-a','synthetic-a\n','a--b','a-','á','', 'a'.repeat(65)])test('N4/A1 rejects noncanonical tenant identifier '+JSON.stringify(value),()=>{assert.throws(()=>tenantId(value),/tenant_identifier_noncanonical/);});
test('A2 older archive policy is quarantined without repair, normalization or original-data deletion',async t=>{
 const f=await archiveFixture(t);await f.scope.ensure('original','ARM',{ownerId:'original'});const db=new DatabaseSync(f.config.file);const before=db.prepare('SELECT value FROM records').get();db.close();
 corrupt(f.config.file,"UPDATE meta SET value=json_remove(value,'$.tenantPolicy')");
 await assert.rejects(f.open(),ArchiveIncompatibleError);await assert.rejects(f.scope.records(),ArchiveIncompatibleError);await assert.rejects(f.repair(),ArchiveIncompatibleError);
 const check=new DatabaseSync(f.config.file);assert.deepEqual(check.prepare('SELECT value FROM records').get(),before);check.close();
 const fresh=await archiveFixture(t);assert.equal(await fresh.scope.lookup('original'),null);await assert.rejects(IndexedArchive.create(f.config),/EEXIST/);
});
