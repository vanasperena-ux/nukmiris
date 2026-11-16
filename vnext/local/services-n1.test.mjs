// N1-only migration proof. All databases/profiles are disposable synthetic fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {localFixture,httpClient} from './test-fixture.mjs';
import {connection} from './fixture.mjs';
import {start,stopWorker,workerState,locked} from './runtime.mjs';
import {upgrade} from './upgrade.mjs';
import {verifyBundle} from './coherent-backup.mjs';
import {UnitOfWork} from '../dist/src/infrastructure/postgres/unit-of-work.js';
import {ServiceCatalog} from '../dist/src/application/service-catalog.js';
const migration='011-solo-qualification-creation-only.sql',wait=ms=>new Promise(r=>setTimeout(r,ms));
test('N1 original010 profile upgrades through CLI once; rollback, all rows, ACLs, ACTIVE and UNKNOWN identities preserved',{timeout:240000},async t=>{
 const {s,running}=await localFixture(t),db=new pg.Client(connection(s));await db.connect();let reader,operator;try{
 const metadata=async()=>(await db.query("SELECT oid::text,proowner::regrole::text owner,proacl::text acl,obj_description(oid,'pg_proc') version,pg_get_functiondef(oid) definition FROM pg_proc WHERE oid='core.catalog_save(text,uuid,bigint,text,jsonb)'::regprocedure")).rows[0];
 assert.equal((await metadata()).version,'SE1_N1_CREATE_ONLY_V1','fresh TCP bootstrap includes011');
 const c=await httpClient(s,running);
 await c.send({kind:'TEXT',value:'cita'});let state=await c.until(x=>x.replies.at(-1)?.payload.outcome==='OFFER');await c.send({kind:'ACTION',value:state.replies.at(-1).payload.choices[0].id});await c.until(x=>x.replies.at(-1)?.payload.outcome==='CONFIRMED');
 const b=await c.call('/api/session',{businessId:'synthetic-b',persona:'known'});
 async function untilB(predicate){for(let i=0;i<150;i++){const state=await c.call('/api/state',undefined,b);if(predicate(state))return state;await wait(50);}throw Error('N1_unknown_wait');}
 await c.call('/api/message',{requestId:randomUUID(),payload:{kind:'TEXT',value:'cita'}},b);state=await untilB(x=>x.replies.at(-1)?.payload.outcome==='OFFER');await c.call('/api/fault',{mode:'BEFORE_APPLY'},b);await c.call('/api/message',{requestId:randomUUID(),payload:{kind:'ACTION',value:state.replies.at(-1).payload.choices[0].id}},b);await untilB(x=>x.diagnostics.some(d=>d.code==='UNKNOWN_OUTCOME_HELD'));
 reader=new UnitOfWork(connection(s,'wp1_reducer'));operator=new UnitOfWork(connection(s,'wp1_operator'));
 const catalog=new ServiceCatalog('synthetic-a',reader,operator),save=async(kind,value)=>catalog.save(randomUUID(),(await catalog.load()).revision,kind,value);
 await save('service',{id:'n1-history',name:'Configuración conservada',description:'Precio informativo',durationMinutes:40,bufferMinutes:10,priceMinor:12345,currency:'MXN',active:false});
 const employee=(await catalog.load()).employees[0];await save('employee',{...employee,serviceIds:[...employee.serviceIds,'n1-history']});
 await stopWorker(s);
 const snapshot=async()=>{const out={};for(const {tablename} of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='core' ORDER BY tablename")).rows)out[tablename]=(await db.query('SELECT to_jsonb(t) row FROM core.'+pg.escapeIdentifier(tablename)+' t ORDER BY to_jsonb(t)::text')).rows;return out;};
 const original=await fs.readFile(new URL('../src/infrastructure/postgres/migrations/010-services-employees.sql',import.meta.url),'utf8');
 // Restore only the original function in this disposable DB, keeping all schema/data.
 await db.query(original.slice(original.indexOf('CREATE FUNCTION core.catalog_save('),original.indexOf('\n-- A catalog edit')).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
 await db.query("COMMENT ON FUNCTION core.catalog_save(text,uuid,bigint,text,jsonb) IS NULL");
 const old=await metadata();assert.equal(old.version,null);
 await assert.rejects(start(s,Number(new URL(running.url).port)),/se1_n1_upgrade_required/);
 const before=await snapshot();assert.equal(before.attempt.filter(a=>a.row.state==='UNKNOWN').length,1);assert.equal(before.appointment.filter(a=>a.row.state==='ACTIVE').length,1);
 const sql=await fs.readFile(new URL('../src/infrastructure/postgres/migrations/'+migration,import.meta.url),'utf8');
 await db.query('BEGIN');await db.query(sql);await db.query('ROLLBACK');assert.deepEqual(await metadata(),old,'interrupted function replacement rolls back');assert.deepEqual(await snapshot(),before);
 await assert.rejects(upgrade(s,'wrong'),/exact_instance_id/);
 const cli=fileURLToPath(new URL('./cli.mjs',import.meta.url));const {stdout}=await promisify(execFile)(process.execPath,[cli,'upgrade','--state-dir',s.directory,'--confirm',s.id],{timeout:240000,windowsHide:true,maxBuffer:1024*1024});const result=JSON.parse(stdout);
 assert.deepEqual(result.appliedMigrations,[migration]);assert.equal(result.automaticActivation,false);assert.equal(await workerState(s),null);await verifyBundle(result.backup.directory,result.backup.manifestSha256);
 assert.deepEqual(await snapshot(),before,'upgrade does not rewrite any core table');const current=await metadata();assert.equal(current.version,'SE1_N1_CREATE_ONLY_V1');assert.equal(current.oid,old.oid);assert.equal(current.owner,old.owner);assert.equal(current.acl,old.acl);
 assert.equal((await locked(s,()=>upgrade(s,s.id))).alreadyCurrent,true);assert.deepEqual(await snapshot(),before);assert.equal(await workerState(s),null);
 // Reapplying011 itself is also repeatable, not just the CLI feature probe.
 await db.query('BEGIN');await db.query(sql);await db.query('COMMIT');assert.deepEqual(await metadata(),current);assert.deepEqual(await snapshot(),before);
 const after=await start(s,Number(new URL(running.url).port)),client=await httpClient(s,after);assert.equal((await client.state()).appointments.length,1);
 const restoredB=await client.call('/api/session',{businessId:'synthetic-b',persona:'known'});const unknown=await client.call('/api/state',undefined,restoredB);assert.equal(unknown.pendingEffects,1);assert.ok(unknown.diagnostics.some(d=>d.code==='UNKNOWN_OUTCOME_HELD'));
 for(const table of ['attempt','appointment','operation','protection','local_ledger','appointment_service','qualification'])assert.deepEqual((await snapshot())[table],before[table],table+' unchanged after restart');
 console.log(JSON.stringify({N1Upgrade:'PASS',postgres:s.observed.serverVersion,platform:process.platform,nativeWindows:process.platform==='win32'?'EXECUTED':'NOT_EXECUTED',applied:[migration],allCoreTablesPreserved:Object.keys(before).length,functionIdentityOwnerAclPreserved:true,ddlRollback:'PASS',repeatUpgrade:'NO_OP',reapplyMigration:'NO_DATA_CHANGE',activeBooking:'PRESERVED',unknownBooking:'PROTECTED',automaticActivation:false}));
 }finally{await reader?.close();await operator?.close();await db.end();}
});
