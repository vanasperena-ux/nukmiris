import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, readFile, rename } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { archiveFixture, corrupt } from './support/archive-fixture.js';
import { IndexedArchive } from '../src/infrastructure/archive/indexed-archive.js';
import { headDigest } from '../src/infrastructure/archive/protocol.js';
import { cut } from './support/helpers.js';

test('017 indexed presence, authenticated absence, idempotence and tenant-scoped identities',async t=>{
  const f=await archiveFixture(t);let allocations=0;
  const a=await f.scope.ensure('same','ARM',{businessId:'synthetic-a'},()=>({ownerId:String(++allocations)}));
  assert.deepEqual(await f.scope.lookup('same'),a);assert.equal(await f.scope.lookup('absent'),null);
  assert.deepEqual(await f.scope.ensure('same','ARM',{businessId:'synthetic-a'},()=>({ownerId:String(++allocations)})),a);
  const b=await f.archive.scope('synthetic-b').ensure('same','ARM',{businessId:'synthetic-b'},()=>({ownerId:'b'}));
  assert.notEqual(a.hash,b.hash);assert.equal(allocations,1);
  assert.deepEqual(await f.scope.records(),[a]);assert.deepEqual(await f.archive.scope('synthetic-b').records(),[b]);
  assert.throws(()=>f.archive.scope('ungranted'),/tenant_denied/);
  await assert.rejects(f.scope.ensure('foreign','ARM',{businessId:'synthetic-b'}),/foreign_body/);
  await assert.rejects(f.scope.ensure('foreign','ARM',{},()=>({businessId:'synthetic-b'})),/foreign_body/);
  await assert.rejects(f.scope.ensure('same','OTHER',{}),/identity_conflict/);
  await assert.rejects(f.scope.ensure('new','ARM',{ownerId:'original'},()=>({ownerId:'replacement'})),/allocation_conflict/);
  await assert.rejects(f.archive.scope('synthetic-b').verify(a),/unverified/);
  await assert.rejects(f.scope.verify({...a,body:{ownerId:'forged'}}),/unverified/);
});

test('017 large archive uses bounded keyed reads; no normal-path full scan or historical decryption',async t=>{
  const f=await archiveFixture(t);
  for(let offset=0;offset<10_000;offset+=1000)await f.scope.ensureBatch(Array.from({length:1000},(_,i)=>({key:`record/${offset+i}`,kind:'HISTORY',match:{businessId:'synthetic-a',ordinal:offset+i,originalId:`id-${offset+i}`}})));
  const before={...f.archive.metrics};
  for(const i of [0,1,999,5000,9999])assert.equal((await f.scope.lookup(`record/${i}`))?.body['originalId'],`id-${i}`);
  assert.equal(await f.scope.lookup('missing'),null);
  assert.equal(f.archive.metrics.fullAudits,0);assert.equal(f.archive.metrics.decryptions-before.decryptions,5);
  assert.ok(f.archive.metrics.nodeReads-before.nodeReads<=6*32);
  const reopened=await f.open();assert.equal((await reopened.scope('synthetic-a').lookup('record/0'))?.sequence,1);
});

for(const mutation of [
  {name:'deleted record',sql:'DROP TRIGGER records_no_delete; DELETE FROM records WHERE sequence=1',error:/record_missing/},
  {name:'changed ciphertext',sql:`DROP TRIGGER records_no_update; UPDATE records SET value=json_set(value,'$.ciphertext','00') WHERE sequence=1`,error:/authentication/},
  {name:'missing index node',sql:'DELETE FROM nodes',error:/index_missing/},
  {name:'forged empty child',sql:`UPDATE nodes SET value=json_set(value,'$.left',NULL,'$.right',NULL)`,error:/index_invalid/},
  {name:'changed index sequence',sql:`UPDATE nodes SET value=json_set(value,'$.sequence',999)`,error:/index_invalid/}
])test(`017 ${mutation.name} fails closed without reallocating an identity`,async t=>{
  const f=await archiveFixture(t);await f.scope.ensure('stable','ARM',{businessId:'synthetic-a',ownerId:'original'});
  await f.scope.ensure('second','ARM',{});corrupt(f.config.file,mutation.sql);let allocations=0;
  await assert.rejects(f.scope.lookup('stable'),mutation.error);
  await assert.rejects(f.scope.ensure('stable','ARM',{},()=>({ownerId:String(++allocations)})),mutation.error);assert.equal(allocations,0);
});

test('017 corrupted off-path data is detected on targeted read/full audit; lookup does not claim global health',async t=>{
  const f=await archiveFixture(t);await f.scope.ensureBatch(Array.from({length:20},(_,i)=>({key:`r${i}`,kind:'HISTORY',match:{i}})));
  corrupt(f.config.file,`DROP TRIGGER records_no_update; UPDATE records SET value=json_set(value,'$.mac','bad') WHERE sequence=20`);
  assert.equal((await f.scope.lookup('r0'))?.sequence,1);
  await assert.rejects(f.scope.lookup('r19'),/authentication/);await assert.rejects(f.scope.records(),/authentication/);
  await assert.rejects(f.repair(),/authentication/);
});

test('017 explicit capacity hold never allocates, evicts or overwrites history',async t=>{
  const f=await archiveFixture(t,2);await f.scope.ensure('a','HISTORY',{});await f.scope.ensure('b','HISTORY',{});let allocated=false;
  await assert.rejects(f.scope.ensure('c','HISTORY',{},()=>{allocated=true;return {};}),/capacity_hold/);
  assert.equal(allocated,false);assert.equal((await f.scope.records()).length,2);assert.equal((await f.scope.ensure('a','HISTORY',{})).sequence,1);
});

test('017 old encryption keys remain necessary after rotation; missing keys and wrong authentication keys hold',async t=>{
  const f=await archiveFixture(t);const first=await f.scope.ensure('old','ARM',{});
  const rotated=await f.open({...f.config,activeKey:'v2'});await rotated.scope('synthetic-a').ensure('new','ARM',{});
  assert.deepEqual(await rotated.scope('synthetic-a').lookup('old'),first);
  const lost=await f.open({...f.config,encryptionKeys:new Map([['v2',f.config.encryptionKeys.get('v2')!]]),activeKey:'v2'});
  await assert.rejects(lost.scope('synthetic-a').lookup('old'),/key_missing/);
  await assert.rejects(f.repair({...f.config,encryptionKeys:new Map([['v2',f.config.encryptionKeys.get('v2')!]])}),/key_missing/);
  // Resume with retained keys; the failed repair keeps the explicit witness fence.
  const repaired=await f.repair();assert.deepEqual(await repaired.archive.scope('synthetic-a').lookup('old'),first);
  await assert.rejects(f.open({...f.config,authenticationKey:Buffer.alloc(32)}),/authentication/);
});

test('017 archive and witness identity/signature mismatches hold',async t=>{
  const f=await archiveFixture(t);
  await assert.rejects(f.open({...f.config,archiveId:'other'}),/witness_invalid/);
  await assert.rejects(f.open({...f.config,witness:{...f.config.witness,read:async()=>({...f.witness.read(),signature:'bad'})}}),/signature/);
});

test('017 missing archive does not silently reinitialize; duplicate creation refuses existing data',async t=>{
  const f=await archiveFixture(t);await f.scope.ensure('original','ARM',{});
  await assert.rejects(IndexedArchive.open({...f.config,file:f.config.file+'.missing'}),/ENOENT/);
  await assert.rejects(IndexedArchive.create(f.config),/EEXIST/);
});

test('017 independently retained checkpoint detects database rollback and paired rollback on reopen',async t=>{
  const f=await archiveFixture(t);await f.scope.ensure('first','ARM',{});
  // SQLite backup API is unnecessary here: checkpoint, then copy only while no writer runs.
  corrupt(f.config.file,'PRAGMA wal_checkpoint(TRUNCATE)');await copyFile(f.config.file,f.config.file+'.backup');
  const prior=f.witness.read();await f.scope.ensure('second','ARM',{});const floor=f.witness.read().value;
  f.archive.close();await rename(f.config.file+'.backup',f.config.file);
  await assert.rejects(f.open(),/held/);
  await assert.rejects(f.repair(),/repair_rollback/);
  await assert.rejects(f.open({...f.config,minimumCheckpoint:floor,witness:{...f.config.witness,read:async()=>prior}}),/witness_rollback/);
});

for(const point of ['archive.beforeDataCommit','archive.afterDataCommit','archive.afterWitnessCommit','archive.afterConfirm'])test(`017 interrupted append ${point} preserves original identity or rolls back before commit`,async t=>{
  const f=await archiveFixture(t);const writer=await f.open({...f.config,faults:cut(point)});
  await assert.rejects(writer.scope('synthetic-a').ensure('arm','ARM',{},()=>({ownerId:'original'})),/injected/);
  if(point==='archive.beforeDataCommit')assert.equal(await f.scope.lookup('arm'),null);
  else if(point==='archive.afterConfirm')assert.equal((await f.scope.lookup('arm'))?.body['ownerId'],'original');
  else {
    let allocations=0;await assert.rejects(f.scope.ensure('arm','ARM',{},()=>({ownerId:String(++allocations)})),/held/);assert.equal(allocations,0);
    const repaired=await f.repair();assert.equal((await repaired.archive.scope('synthetic-a').lookup('arm'))?.body['ownerId'],'original');
    assert.equal((await repaired.archive.scope('synthetic-a').ensure('arm','ARM',{},()=>({ownerId:'replacement'}))).body['ownerId'],'original');
  }
});

test('017 authenticated index repair rebuilds cache without changing immutable appointment/ARM history',async t=>{
  const f=await archiveFixture(t);const original=await f.scope.ensureBatch(Array.from({length:200},(_,i)=>({key:`appointment/${i}`,kind:'HISTORY',match:{originalId:`id${i}`,revision:i}})));
  const checkpoint=headDigest(f.witness.read().value.head);corrupt(f.config.file,'DELETE FROM nodes');
  await assert.rejects(f.scope.lookup('appointment/0'),/index_missing/);
  const r=await f.repair();assert.equal(r.repaired,200);assert.equal(headDigest(f.witness.read().value.head),checkpoint);
  assert.deepEqual(await r.archive.scope('synthetic-a').records(),original);
  const db=new DatabaseSync(f.config.file);try {
    assert.equal((db.prepare('SELECT count(*) AS n FROM repair_case').get() as {n:number}).n,1);
    assert.throws(()=>db.exec("UPDATE repair_case SET value='{}'"),/append_only/);
    assert.throws(()=>db.exec('DELETE FROM repair_case'),/append_only/);
    assert.throws(()=>db.exec('DELETE FROM records'),/append_only/);
  }finally{db.close();}
  assert.ok((await readFile(f.config.file)).length>0);
});

for(const point of ['archive.beforeRepairCommit','archive.afterRepairCommit','archive.afterRepairWitness'])test(`017 interrupted repair ${point} remains held and resumes under a new explicit fence`,async t=>{
  const f=await archiveFixture(t);await f.scope.ensure('arm','ARM',{ownerId:'original'});corrupt(f.config.file,'DELETE FROM nodes');
  await assert.rejects(f.repair({...f.config,faults:cut(point)}),/injected/);await assert.rejects(f.scope.lookup('arm'),/held/);
  const r=await f.repair();assert.equal((await r.archive.scope('synthetic-a').lookup('arm'))?.body['ownerId'],'original');
});

test('017 an operator fence defeats a stale append continuation; no timed takeover exists',async t=>{
  const f=await archiveFixture(t);let release!:()=>void;
  const paused=new Promise<void>(resolve=>{release=resolve;});let reached!:()=>void;const atPoint=new Promise<void>(resolve=>{reached=resolve;});
  const writer=await f.open({...f.config,faults:{async hit(p){if(p==='archive.afterDataCommit'){reached();await paused;}}}});
  const pending=writer.scope('synthetic-a').ensure('arm','ARM',{ownerId:'original'});await atPoint;
  const permit=f.witness.beginRepair();release();await assert.rejects(pending,/cas_conflict/);
  await assert.rejects(f.scope.lookup('arm'),/held/);
  const r=await IndexedArchive.repair(f.config,permit);try{assert.equal((await r.archive.scope('synthetic-a').lookup('arm'))?.body['ownerId'],'original');}finally{r.archive.close();}
});

test('017 lost/corrupted checkpoint service fails closed; a pending corrupted tail is never adopted',async t=>{
  const f=await archiveFixture(t),writer=await f.open({...f.config,faults:cut('archive.afterDataCommit')});
  await assert.rejects(writer.scope('synthetic-a').ensure('tail','ARM',{}),/injected/);
  corrupt(f.config.file,`DROP TRIGGER records_no_update; UPDATE records SET value=json_set(value,'$.mac','corrupt') WHERE sequence=1`);
  await assert.rejects(f.repair(),/authentication/);assert.equal(f.witness.read().value.head.size,0);
  await assert.rejects(f.scope.lookup('tail'),/held/);
  await assert.rejects(f.open({...f.config,witness:{...f.config.witness,async read(){throw new Error('custody_unavailable');}}}),/custody_unavailable/);
});

test('017 missing tail and changed meta cannot masquerade as authenticated absence',async t=>{
  const f=await archiveFixture(t);await f.scope.ensureBatch([{key:'first',kind:'ARM',match:{}},{key:'tail',kind:'ARM',match:{}}]);
  corrupt(f.config.file,'DROP TRIGGER records_no_delete; DELETE FROM records WHERE sequence=2');
  await assert.rejects(f.scope.lookup('tail'),/record_missing/);await assert.rejects(f.scope.records(),/record_missing/);await assert.rejects(f.repair(),/record_missing/);
  const other=await archiveFixture(t);await other.scope.ensure('first','ARM',{});
  corrupt(other.config.file,`UPDATE meta SET value=json_set(value,'$.head.size',0,'$.head.tip','${'0'.repeat(64)}','$.head.root',NULL)`);
  await assert.rejects(other.scope.lookup('first'),/held/);
});

test('017 repair decisions are authenticated and witnessed, including interrupted repair history',async t=>{
  const f=await archiveFixture(t);await f.scope.ensure('arm','ARM',{});await f.repair();await f.repair();
  corrupt(f.config.file,'DROP TRIGGER repair_no_delete; DELETE FROM repair_case WHERE id=1');
  await assert.rejects(f.scope.records(),/audit_chain/);await assert.rejects(f.repair(),/audit_chain/);
  const other=await archiveFixture(t);await other.scope.ensure('arm','ARM',{});await other.repair();
  corrupt(other.config.file,'DROP TRIGGER repair_no_delete; DELETE FROM repair_case');
  await assert.rejects(other.scope.lookup('arm'),/audit_head/);await assert.rejects(other.repair(),/audit_missing/);
});
