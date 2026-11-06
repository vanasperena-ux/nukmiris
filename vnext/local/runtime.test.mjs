import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import net from 'node:net';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomInt} from 'node:crypto';
import {provision,readState,destroy,connection,owned,verifyBackup,ready,assertPrivate} from './fixture.mjs';
import {start,stop,stopWorker,workerState,request,backup,reset} from './runtime.mjs';
import {childProcess} from './child.mjs';
import {smoke} from './smoke.mjs';
import {UnitOfWork} from '../dist/src/infrastructure/postgres/unit-of-work.js';

// Bind directly and retain the listener: probing/closing a free port would leave
// a race before the collision assertion. Setup retries do not permit runtime fallback.
async function occupiedSupportedPort(){
 for(let attempt=0;attempt<100;attempt++){
  const server=net.createServer();
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port:randomInt(20000,40000),exclusive:true},resolve);});return server;}
  catch(error){if(!['EADDRINUSE','EACCES'].includes(error.code))throw error;}
 }
 throw Error('test_supported_service_port_unavailable');
}

test('W8 high service ports are rejected before database or worker access',async()=>{
 const noResources=new Proxy({}, {get(_target,key){if(key==='application')return undefined;throw Error('unexpected_runtime_resource_access:'+String(key));}});
 for(const port of [49152,55432,65535])await assert.rejects(start(noResources,port),{message:'runtime_port_must_be_below_49152'});
});

test('Windows-targeted local runtime over isolated TCP PostgreSQL17.11 (host execution recorded)',async t=>{
 const parent=await mkdtemp(path.join(tmpdir(),'nukmiris-vnext- salón space-'));let s;
 t.after(async()=>{if(s){await stop(s).catch(()=>{});await destroy(s).catch(()=>{});}await rm(parent,{recursive:true,force:true});});
 s=await provision(path.join(parent,'.local-demo'),{port:0});
 await t.test('fresh isolated resources use loopback only, SCRAM, UTC and inert businesses',async()=>{
  assert.equal((await readState(s.directory)).id,s.id);const info=await owned(s);assert.equal(info.NetworkSettings.Ports['5432/tcp'][0].HostIp,'127.0.0.1');
  const db=new pg.Client(connection(s));await db.connect();try{const z=(await db.query("SELECT current_setting('TimeZone') z,current_setting('server_version') v")).rows[0];assert.equal(z.z,'UTC');assert.match(z.v,/^17\.11 /);assert.equal((await db.query('SELECT count(*)::int n FROM core.business WHERE dispatch_enabled')).rows[0].n,0);assert.equal((await db.query("SELECT bool_and(rolpassword LIKE 'SCRAM-SHA-256%') ok FROM pg_authid WHERE rolname LIKE 'wp1_%' AND rolcanlogin")).rows[0].ok,true);}finally{await db.end();}
  if(process.platform!=='win32')assert.equal((await stat(path.join(s.directory,'state.json'))).mode&0o777,0o600);else{await assertPrivate(s.directory,{directory:true});await assertPrivate(path.join(s.directory,'state.json'));}
 });
 await t.test('E1 every runtime connection overrides a Mexico City role default with UTC',async()=>{
   const db=new pg.Client(connection(s));await db.connect();try{await db.query("ALTER ROLE wp1_tenant_a SET TimeZone='America/Mexico_City'");}finally{await db.end();}
  const u=new UnitOfWork(connection(s,'wp1_tenant_a'));try{await u.tx('synthetic-a',async d=>{assert.equal((await d.query('SHOW TimeZone')).rows[0].TimeZone,'UTC');assert.equal((await d.query("SELECT '2030-01-02T10:00:00Z'::timestamptz t")).rows[0].t,'2030-01-02T10:00:00.000Z');});}finally{await u.close();}
  assert.throws(()=>new UnitOfWork({host:'127.0.0.1',database:s.database,user:'wp1_reducer'}),/synthetic_database_only/);
  assert.throws(()=>new UnitOfWork({host:s.host,port:s.port,database:s.database,user:'wp1_reducer'}),/synthetic_database_only/);assert.throws(()=>connection(s,'unexpected-role'),/local_role_denied/);
  const file=path.join(s.directory,'state.json'),bytes=await readFile(file);const invalid=JSON.parse(bytes);delete invalid.passwords.wp1_reducer;await writeFile(file,JSON.stringify(invalid));try{await assert.rejects(readState(s.directory),/credentials_missing_or_invalid/);}finally{await writeFile(file,bytes);}
 });
 await t.test('W4 loopback connections ignore inherited PGSSLMODE require/verify-full',async()=>{
  const original=process.env.PGSSLMODE;
  try{for(const mode of ['require','verify-full']){process.env.PGSSLMODE=mode;const db=new pg.Client(connection(s));await db.connect();await db.end();const u=new UnitOfWork({host:s.host,port:s.port,database:s.database,user:'wp1_reducer',password:s.passwords.wp1_reducer});try{assert.equal(await u.tx('synthetic-a',async d=>(await d.query('SHOW TimeZone')).rows[0].TimeZone),'UTC');}finally{await u.close();}}}
  finally{if(original===undefined)delete process.env.PGSSLMODE;else process.env.PGSSLMODE=original;}
 });
 await t.test('path/identity checks and occupied DB port fail without fallback or touching the existing fixture',async()=>{
  await assert.rejects(provision(path.join(parent,'accepted-v081'),{port:0}),/target_denied/);await assert.rejects(provision(s.directory,{port:0}),/EEXIST/);
  await assert.rejects(destroy({...s,id:'0'.repeat(32)}),/identity_mismatch/);
  await assert.rejects(provision(path.join(parent,'nukmiris-vnext-collision'),{port:s.port}),/local_docker_start_failed/);assert.equal((await owned(s)).State.Running,true);
 });
 await t.test('portable child startup, cooperative stop and owned-handle crash need no POSIX signals',async()=>{
  const file=fileURLToPath(new URL('./health-worker.mjs',import.meta.url));
  const a=childProcess(file,{directory:s.directory,port:0});try{const ready=await a.message('ready');assert.equal((await request(s,ready)).interactiveBookingEnabled,false);await a.stop();assert.equal((await a.closed).code,0);}finally{await a.crash();}
  const b=childProcess(file,{directory:s.directory,port:0});await b.message('ready');await b.crash();assert.equal((await owned(s)).State.Running,true);
 });
 await t.test('start/health/authenticated stop/crash/restart keep the original DB and refuse an occupied service port',async()=>{
  const ready=await start(s,0),w=await workerState(s);assert.equal(ready.instance,s.id);assert.equal(ready.timezone,'UTC');
  await assert.rejects(request({...s,controlToken:'wrong'},w,'stop'),/identity_mismatch/);
  await request(s,w,'crash');await new Promise(r=>setTimeout(r,150));const restarted=await start(s,0);assert.equal(restarted.database,s.database);assert.equal(restarted.mode,'SYNTHETIC_INERT');await stop(s);assert.equal((await owned(s)).State.Running,false);await start(s,0);await stopWorker(s);
  const occupied=await occupiedSupportedPort();
  try{
   const address=occupied.address();assert.equal(address.address,'127.0.0.1');assert.ok(address.port>=20000&&address.port<40000);
   await assert.rejects(start(s,address.port),error=>/local_child_failed/.test(error.message)&&/listen (?:EADDRINUSE|EACCES)/.test(error.message));
   assert.equal(occupied.listening,true);assert.equal(occupied.address().port,address.port);assert.equal(await workerState(s),null);
   assert.equal((await owned(s)).State.Running,true);assert.equal((await readState(s.directory)).database,s.database);
  }finally{await new Promise(r=>occupied.close(r));}await start(s,0);
 });
 await t.test('real indexed-custody/core booking smoke and C1 work over TCP without mutating persistent demo data',async()=>{const result=await smoke(s);assert.equal(result.result,'PASS');assert.equal(result.fakeProviderCalls,2);assert.equal(result.c1Supersession,true);assert.equal(result.persistentDemoDatabaseMutated,false);});
 await t.test('private backup restores to a separate inert database; corruption fails closed',async()=>{
  const b=await backup(s);assert.ok(b.bytes>0);assert.equal((await verifyBackup(s,b.directory)).dispatchEnabled,false);
  const file=path.join(b.directory,'database.dump'),original=await readFile(file);await writeFile(file,Buffer.from('corrupt'));try{await assert.rejects(verifyBackup(s,b.directory),/integrity_denied/);}finally{await writeFile(file,original);}
 });
 await t.test('reset requires exact identity, retains backup and creates fresh isolated IDs',async()=>{
  await assert.rejects(reset(s,'nukmiris_vnext_demo'),/exact_instance_id/);const old=s.id,changed=await reset(s,old);assert.equal(changed.previousInstance,old);s=await readState(s.directory);assert.notEqual(s.id,old);assert.equal(changed.backupsRetained,true);
 });
 const measured=await ready(s);console.log(JSON.stringify({platform:process.platform,node:process.version,postgres:measured.v,tcp:true,utc:true,nativeWindows:process.platform==='win32'?'EXECUTED':'NOT RUN',generatedStatePublished:false}));
});

test('published CLI prepare/start/smoke/backup/stop/reset commands execute with spaces and Unicode paths',async t=>{
 const parent=await mkdtemp(path.join(tmpdir(),'nukmiris-vnext- CLI salón ')),directory=path.join(parent,'.local-demo');let s;
 t.after(async()=>{try{s=await readState(directory);await stop(s);await destroy(s);}catch{}await rm(parent,{recursive:true,force:true});});
 const exec=promisify(execFile),cli=fileURLToPath(new URL('./cli.mjs',import.meta.url));
 const run=async(command,args=[])=>{const {stdout}=await exec(process.execPath,[cli,command,'--state-dir',directory,...args],{timeout:660000,maxBuffer:1024*1024,windowsHide:true});return JSON.parse(stdout);};
 const prepared=await run('prepare',['--db-port','0']);s=await readState(directory);assert.equal(prepared.instance,s.id);
 assert.equal((await run('start',['--port','0'])).interactiveBookingEnabled,false);assert.equal((await run('smoke')).result,'PASS');assert.ok((await run('backup')).bytes>0);assert.equal((await run('stop')).stopped,true);
 const resetResult=await run('reset',['--confirm',s.id]);assert.notEqual(resetResult.instance,s.id);s=await readState(directory);
});
