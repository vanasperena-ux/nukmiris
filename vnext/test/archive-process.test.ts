import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveFixture } from './support/archive-fixture.js';
import { archiveWorker } from './support/archive-driver.js';
import { IndexedArchive } from '../src/infrastructure/archive/indexed-archive.js';
import type { Seal } from '../src/ports.js';

const posix={skip:process.platform==='win32'?'SIGKILL evidence requires POSIX; Windows remains unverified':false};
for(const point of ['archive.beforeDataCommit','archive.afterDataCommit','archive.afterWitnessCommit','archive.afterConfirm'])test(`017 actual process death at ${point} and explicit restart recovery`,posix,async t=>{
  const f=await archiveFixture(t),w=archiveWorker(t,f.config,'original-arm',point);
  await w.wait('point');await w.kill();
  if(point==='archive.beforeDataCommit')assert.equal(await f.scope.lookup('original-arm'),null);
  else {
    if(point!=='archive.afterConfirm')await assert.rejects(f.open(),/held/);
    const r=await f.repair(),original=await r.archive.scope('synthetic-a').lookup('original-arm');assert.ok(original);
    assert.deepEqual(await r.archive.scope('synthetic-a').ensure('original-arm','ARM',{businessId:'synthetic-a'},()=>({ownerId:'replacement'})),original);
    assert.equal(original.sequence,1);assert.equal((await r.archive.scope('synthetic-a').records()).length,1);
  }
});

test('017 concurrent independent processes converge on one original ARM identity',posix,async t=>{
  const f=await archiveFixture(t),workers=Array.from({length:6},()=>archiveWorker(t,f.config,'same-arm','worker.ready'));
  await Promise.all(workers.map(w=>w.wait('point')));for(const w of workers)w.resume();await Promise.all(workers.map(w=>w.closed));
  const record=await f.scope.lookup('same-arm');assert.ok(record);assert.equal((await f.scope.records()).length,1);
  for(let i=0;i<6;i++)assert.deepEqual(await f.scope.ensure('same-arm','ARM',{businessId:'synthetic-a'},()=>({ownerId:'replacement'})),record);
});

test('017 concurrent distinct appenders hold during pending checkpoint; caller can retry only after known completion',async t=>{
  const f=await archiveFixture(t);let arrived!:()=>void,release!:()=>void;
  const atPoint=new Promise<void>(r=>{arrived=r;}),paused=new Promise<void>(r=>{release=r;});
  const a=await f.open({...f.config,faults:{async hit(p){if(p==='archive.afterDataCommit'){arrived();await paused;}}}}),b=await f.open();
  const first=a.scope('synthetic-a').ensure('one','ARM',{});await atPoint;
  await assert.rejects(b.scope('synthetic-a').ensure('two','ARM',{}),/held/);await assert.rejects(b.scope('synthetic-a').lookup('one'),/held/);
  release();const original=await first;const second=await b.scope('synthetic-a').ensure('two','ARM',{});
  assert.equal(original.sequence,1);assert.equal(second.sequence,2);
});

test('017 operator cannot steal a live SQL lock; fence persists until writer is terminated',posix,async t=>{
  const f=await archiveFixture(t),w=archiveWorker(t,f.config,'arm','archive.beforeDataCommit');await w.wait('point');
  const permit=f.witness.beginRepair();await assert.rejects(IndexedArchive.repair(f.config,permit),/locked|busy/);
  await assert.rejects(f.scope.lookup('arm'),/held/);await w.kill();
  const r=await IndexedArchive.repair(f.config,f.witness.beginRepair());try{assert.equal(await r.archive.scope('synthetic-a').lookup('arm'),null);}finally{r.archive.close();}
});

test('017 a stale process cannot publish after an independently committed repair fence',posix,async t=>{
  const f=await archiveFixture(t),w=archiveWorker(t,f.config,'arm','archive.afterDataCommit');await w.wait('point');
  const permit=f.witness.beginRepair();w.resume();assert.match(String((await w.wait('failed'))['message']),/cas_conflict/);await w.closed;
  const r=await IndexedArchive.repair(f.config,permit);try{
    const seal=await r.archive.scope('synthetic-a').lookup('arm') as Seal;assert.ok(seal.body['ownerId']);assert.equal(seal.sequence,1);
  }finally{r.archive.close();}
});
