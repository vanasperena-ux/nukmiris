import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { archiveFixture } from './support/archive-fixture.js';
import { IndexedArchive } from '../src/infrastructure/archive/indexed-archive.js';
import type { Head } from '../src/infrastructure/archive/protocol.js';
import type { ObjectValue } from '../src/domain/protocol.js';

test('B2/X1 RESIDUAL REPRODUCED: writer capability plus writer keys can replace history without a signing key or repair fence',async t=>{
  // Adapted from Claude's independent X1, PR9 comment 6622229262. This test must
  // continue to demonstrate the production-blocking boundary, not claim a fix.
  const real=await archiveFixture(t),fork=await archiveFixture(t);
  const original=await real.scope.ensure('arm/attempt-1','ARM',{businessId:'synthetic-a',attemptId:'attempt-1'},()=>({ownerId:'ORIGINAL-OWNER'}));
  await real.scope.ensure('history/1','HISTORY',{businessId:'synthetic-a',originalId:'original-history'});
  const oldCheckpoint=real.witness.read().value;real.archive.close();fork.archive.close();
  await rm(fork.config.file); // Replace only this test's empty fixture with a writer-key fork.
  const forkConfig={...fork.config,authenticationKey:real.config.authenticationKey,encryptionKeys:real.config.encryptionKeys};
  const f=await IndexedArchive.create(forkConfig);
  try{
    const s=f.scope('synthetic-a');
    await s.ensure('arm/attempt-1','ARM',{businessId:'synthetic-a',attemptId:'attempt-1'},()=>({ownerId:'FORGED-OWNER'}));
    for(let i=0;i<oldCheckpoint.head.size;i++)await s.ensure(`filler/${i}`,'HISTORY',{businessId:'synthetic-a'});
  }finally{f.close();}
  const db=new DatabaseSync(fork.config.file);let forkHead:Head;
  try{forkHead=(JSON.parse((db.prepare('SELECT value FROM meta').get() as {value:string}).value) as {head:Head}).head;}finally{db.close();}
  // No original witness private key or operator permit is used. File access,
  // HMAC/AES keys and the NORMAL writer CAS capability suffice.
  for(const suffix of ['','-wal','-shm'])await rm(real.config.file+suffix,{force:true});
  await copyFile(fork.config.file,real.config.file);
  const signed=await real.config.witness.advance(oldCheckpoint,forkHead);
  assert.equal(signed.value.head.size,oldCheckpoint.head.size+1);assert.equal(signed.value.epoch,oldCheckpoint.epoch);
  const reopened=await real.open({...real.config,minimumCheckpoint:oldCheckpoint}),s=reopened.scope('synthetic-a');
  assert.equal(original.body['ownerId'],'ORIGINAL-OWNER');assert.equal((await s.lookup(original.key))?.body['ownerId'],'FORGED-OWNER');
  assert.equal(await s.lookup('history/1'),null);assert.equal((await s.records()).length,3);
  let reallocated=0;const replacement=await s.ensure('history/1','HISTORY',{businessId:'synthetic-a'},()=>({originalId:`replacement-${++reallocated}`}));
  assert.equal(reallocated,1);assert.equal(replacement.sequence,4);
  t.diagnostic('X1 REPRODUCED: signed larger fork, changed ARM owner, authenticated absence, passing audit and reallocation. Production 009/017 remain BLOCKED.');
});

for(const body of [
  {envelope:{businessId:'synthetic-b'}},
  {intent:{payload:{businessId:'synthetic-b'}}},
  {items:[{businessId:'synthetic-a'},{envelope:{businessId:'synthetic-b'}}]},
  {payload:{businessId:null}}
] as ObjectValue[])test('N4 recursive tenant validation rejects foreign/null businessId before sealing '+JSON.stringify(body),async t=>{
  const f=await archiveFixture(t);let allocated=0;
  await assert.rejects(f.scope.ensure('foreign','ARM',body,()=>({allocated:++allocated})),/foreign_body/);assert.equal(allocated,0);
  await assert.rejects(f.scope.ensure('foreign-allocation','ARM',{},()=>body),/foreign_body/);assert.equal(await f.scope.lookup('foreign-allocation'),null);
  assert.deepEqual(await f.scope.records(),[]);
});

test('N4 recursive tenant validation permits same-tenant nested envelopes, arrays and non-businessId text',async t=>{
  const f=await archiveFixture(t),body={businessId:'synthetic-a',envelope:{businessId:'synthetic-a',payload:{businessId:'synthetic-a'}},items:[{businessId:'synthetic-a'},{text:'synthetic-b'}]};
  const seal=await f.scope.ensure('same-tenant','ARM',body);assert.deepEqual((await f.scope.lookup(seal.key))?.body,body);
  const r=await f.repair();assert.deepEqual((await r.archive.scope('synthetic-a').lookup(seal.key))?.body,body);
});
