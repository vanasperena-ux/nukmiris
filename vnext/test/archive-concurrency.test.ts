import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { archiveFixture } from './support/archive-fixture.js';
import { ArchiveBusyError, ArchiveHeldError, ArchivePendingError } from '../src/infrastructure/archive/availability.js';

function gate(point:string) {
  let arrived!:()=>void,release!:()=>void;
  const reached=new Promise<void>(r=>{arrived=r;}),paused=new Promise<void>(r=>{release=r;});
  return {reached,release,faults:{async hit(p:string){if(p===point){arrived();await paused;}}}};
}

test('B1/X4 sixteen distinct-key requests on one instance all commit and retain their identities',async t=>{
  const f=await archiveFixture(t),g=gate('archive.beforeDataCommit'),a=await f.open({...f.config,faults:g.faults}),s=a.scope('synthetic-a');
  let allocations=0;
  const result=Promise.all(Array.from({length:16},(_,i)=>s.ensure(`key/${i}`,'ARM',{ordinal:i},()=>({ownerId:`owner-${++allocations}`}))));
  await g.reached;
  try {await turn();assert.equal(allocations,1);assert.throws(()=>a.close(),e=>e instanceof ArchiveBusyError&&e.reason==='INSTANCE_ACTIVE');}
  finally{g.release();}
  const seals=await result;assert.equal(allocations,16);assert.equal(new Set(seals.map(s=>s.hash)).size,16);
  assert.deepEqual((await s.records()).map(s=>s.body['ordinal']),Array.from({length:16},(_,i)=>i));
  assert.deepEqual(await Promise.all(seals.map(seal=>s.lookup(seal.key))),seals);
});

test('B1 sixteen identical-key requests on one instance allocate exactly once',async t=>{
  const f=await archiveFixture(t),g=gate('archive.beforeDataCommit'),a=await f.open({...f.config,faults:g.faults}),s=a.scope('synthetic-a');let allocations=0;
  const result=Promise.all(Array.from({length:16},()=>s.ensure('same','ARM',{businessId:'synthetic-a'},()=>({ownerId:`owner-${++allocations}`}))));
  await g.reached;try{await turn();assert.equal(allocations,1);}finally{g.release();}
  const seals=await result;assert.equal(allocations,1);for(const seal of seals)assert.deepEqual(seal,seals[0]);assert.equal((await s.records()).length,1);
});

for(const point of ['archive.beforeDataCommit','archive.afterDataCommit','archive.afterWitnessCommit'])test(`B1 lookup, verify and records wait through ${point} on their own instance`,async t=>{
  const f=await archiveFixture(t),stable=await f.scope.ensure('stable','HISTORY',{originalId:'original'}),g=gate(point),a=await f.open({...f.config,faults:g.faults}),s=a.scope('synthetic-a');
  const write=s.ensure('new','ARM',{ownerId:'original-owner'});await g.reached;let finished=0;
  const reads=Promise.all([s.lookup('stable'),s.lookup('new'),s.records(),s.verify(stable)].map(async p=>{const v=await p;finished++;return v;}));
  try{await turn();assert.equal(finished,0);}finally{g.release();}
  const seal=await write,result=await reads;assert.deepEqual(result[0],stable);assert.deepEqual(result[1],seal);assert.deepEqual(result[2],[stable,seal]);assert.equal(finished,4);
});

test('B1 repair shares the instance mutex with append and all readers',async t=>{
  const f=await archiveFixture(t),stable=await f.scope.ensure('stable','ARM',{ownerId:'original'}),g=gate('archive.beforeRepairCommit'),a=await f.open({...f.config,faults:g.faults}),s=a.scope('synthetic-a');
  const repair=a.repair(f.witness.beginRepair());await g.reached;let finished=0;
  const queued=Promise.all([s.lookup('stable'),s.records(),s.verify(stable),s.ensure('after-repair','HISTORY',{})].map(async p=>{const v=await p;finished++;return v;}));
  try{await turn();assert.equal(finished,0);}finally{g.release();}
  assert.equal(await repair,1);const results=await queued;assert.deepEqual(results[0],stable);assert.deepEqual(results[1],[stable]);assert.equal((await s.records()).length,2);
});

test('B1 a rejected append releases its mutex and rolls back only its own transaction',async t=>{
  const f=await archiveFixture(t),stable=await f.scope.ensure('stable','ARM',{ownerId:'original'}),a=await f.open({...f.config,faults:{async hit(p){if(p==='archive.beforeDataCommit')throw new Error('synthetic rollback');}}}),s=a.scope('synthetic-a');
  const failed=assert.rejects(s.ensure('rolled-back','ARM',{}),/synthetic rollback/),reads=Promise.all([s.lookup('stable'),s.records()]);
  await failed;assert.deepEqual(await reads,[stable,[stable]]);assert.equal(await s.lookup('rolled-back'),null);
});

test('B1 a post-commit failure releases the mutex but pending writes still require an explicit repair',async t=>{
  const f=await archiveFixture(t),a=await f.open({...f.config,faults:{async hit(p){if(p==='archive.afterDataCommit')throw new Error('synthetic lost result');}}}),s=a.scope('synthetic-a');
  await assert.rejects(s.ensure('original','ARM',{ownerId:'original'}),/synthetic lost result/);
  await assert.rejects(s.lookup('original'),e=>e instanceof ArchivePendingError&&e.code==='ARCHIVE_PENDING_CONFIRMATION');
  assert.equal(await a.repair(f.witness.beginRepair()),1);assert.equal((await s.lookup('original'))?.body['ownerId'],'original');
});

test('B1 independent connections get typed SQLite contention without nested transactions or lock stealing',async t=>{
  const f=await archiveFixture(t),g=gate('archive.beforeDataCommit'),a=await f.open({...f.config,faults:g.faults}),b=await f.open();
  const first=a.scope('synthetic-a').ensure('first','ARM',{});await g.reached;let allocations=0;
  try{await assert.rejects(b.scope('synthetic-a').ensure('second','ARM',{},()=>({ownerId:String(++allocations)})),e=>e instanceof ArchiveBusyError&&e.code==='ARCHIVE_BUSY'&&e.reason==='SQLITE_BUSY');assert.equal(allocations,0);}
  finally{g.release();}
  await first;assert.equal((await b.scope('synthetic-a').ensure('second','ARM',{})).sequence,2);
});

test('B1 instance queue overload is typed, bounded and does not cancel or steal active ownership',async t=>{
  const f=await archiveFixture(t),g=gate('archive.beforeDataCommit'),a=await f.open({...f.config,faults:g.faults}),s=a.scope('synthetic-a');
  const write=s.ensure('original','ARM',{});await g.reached;
  const queued=Promise.all(Array.from({length:63},()=>s.lookup('original')));
  try{await assert.rejects(s.lookup('overflow'),e=>e instanceof ArchiveBusyError&&e.reason==='INSTANCE_QUEUE_FULL');}
  finally{g.release();}
  const original=await write;for(const seal of await queued)assert.deepEqual(seal,original);
  assert.deepEqual(await s.lookup('original'),original);
});

test('N1 pending confirmation is distinct from a repair fence; no pending age proves a crash',async t=>{
  const f=await archiveFixture(t),stable=await f.scope.ensure('stable','ARM',{}),g=gate('archive.afterDataCommit'),a=await f.open({...f.config,faults:g.faults});
  const pending=a.scope('synthetic-a').ensure('new','ARM',{});await g.reached;
  try{await assert.rejects(f.scope.lookup('stable'),e=>e instanceof ArchivePendingError&&e.code==='ARCHIVE_PENDING_CONFIRMATION');}
  finally{g.release();}
  await pending;assert.deepEqual(await f.scope.lookup('stable'),stable);
  f.witness.beginRepair();await assert.rejects(f.scope.lookup('stable'),e=>e instanceof ArchiveHeldError&&e.reason==='REPAIR_FENCE');
});

test('N3 fence stops witness advance; a pre-existing transaction can still commit an adoptable original tail',async t=>{
  const f=await archiveFixture(t),g=gate('archive.beforeDataCommit'),a=await f.open({...f.config,faults:g.faults});
  const rejected=assert.rejects(a.scope('synthetic-a').ensure('stale','ARM',{ownerId:'STALE-WRITER'}),/cas_conflict/);await g.reached;
  f.witness.beginRepair();g.release();await rejected;
  await assert.rejects(f.scope.lookup('stale'),ArchiveHeldError);
  const r=await f.repair();assert.equal((await r.archive.scope('synthetic-a').lookup('stale'))?.body['ownerId'],'STALE-WRITER');
});
