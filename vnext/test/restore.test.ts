import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fixture,plan,grant,suppress,admission,raw,arm,provider,evidence} from './support/helpers.js';
import {restoreInert} from '../src/application/restore-inert.js';
import {dispatchOnce} from '../src/application/dispatch-once.js';
import {text,object} from '../src/domain/protocol.js';

test('F09/24/28 REC01: destructive SQL loss preserves original IDs as inert recovery evidence and never revives consent',async t=>{
  const f=await fixture(t);await grant(f);const snapshot=await f.snapshot();
  await suppress(f);await admission(f,raw(f,'STOP','synthetic-a',randomUUID(),'unknown-after-snapshot'));
  const p=await plan(f),owner=await arm(f,p),{server,client}=await provider(t,f);server.loseResponse=true;
  await dispatchOnce({businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId:owner,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock});
  const before=await f.archive.records();await f.close(); // Destroy ONLY this fixture database.
  const target=await fixture(t,false);
  const report=await restoreInert({snapshot,recovery:target.role('recovery'),archive:f.archive});
  assert.equal(report.complete,true);assert.equal(report.dispatchEnabled,false);
  assert.equal((await target.rows('business'))[0]!['dispatch_enabled'],false);
  assert((await target.rows('permission_head')).every(h=>h['suppressed']===true));
  assert((await target.rows('permission_head')).some(h=>h['subject']==='unknown-after-snapshot'));
  const cases=await target.rows('recovery_case');
  assert(cases.some(c=>object(object(c['original_evidence'])['body'])['attemptId']===p.body['attemptId']));
  assert.equal((await target.rows('operation')).length,0,'lost plans are retained for review, never effectfully reconstructed');
  const held=await dispatchOnce({businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId:randomUUID(),dispatcher:target.role('dispatch'),archive:f.archive,provider:client,clock:f.clock});
  assert.equal(held.state,'HELD');assert.equal((await server.calls()).length,1);
  assert.equal((await f.archive.records()).length,before.length,'restore must not allocate any identity/effect/evidence');
  await evidence('REC01-complete',{report,originalAttemptId:p.body['attemptId']!,cases,permissions:await target.rows('permission_head'),providerCalls:1});
});

for(const corruption of ['prefix','tail','head','witness','key','format']) {
  test(`F08/26/29: ${corruption} evidence loss restores inertly with global uncertainty`,async t=>{
    const f=await fixture(t),p=await plan(f);await arm(f,p);const snapshot=await f.snapshot();
    const entries=await f.archive.records();
    if(corruption==='prefix')await fs.unlink(path.join(f.archive.directory,'objects/1.json'));
    if(corruption==='tail')await fs.unlink(path.join(f.archive.directory,`objects/${entries.length}.json`));
    if(corruption==='head')await fs.writeFile(path.join(f.archive.directory,'head.json'),JSON.stringify({sequence:0,hash:'0'.repeat(64),mac:'forged'}));
    if(corruption==='witness')await fs.unlink(path.join(f.archive.directory,'custody/witness.json'));
    if(corruption==='key')await fs.writeFile(path.join(f.archive.directory,'custody/keys.json'),'{}');
    if(corruption==='format'){
      const objectPath=path.join(f.archive.directory,'objects/1.json'),o=JSON.parse(await fs.readFile(objectPath,'utf8'));o.keyVersion='unknown-format';await fs.writeFile(objectPath,JSON.stringify(o));
    }
    const target=await fixture(t,false),report=await restoreInert({snapshot,recovery:target.role('recovery'),archive:f.archive});
    assert.equal(report.complete,false);assert.equal(report.dispatchEnabled,false);
    assert.equal((await target.rows('attempt'))[0]!['id'],p.body['attemptId']);assert.equal((await target.rows('attempt'))[0]!['state'],'UNKNOWN');
    assert.equal((await target.rows('mutation_guard')).length,1);assert.equal((await target.rows('business'))[0]!['dispatch_enabled'],false);
    await evidence('REC01-'+corruption,{report,attempts:await target.rows('attempt'),protections:await target.rows('protection')});
  });
}

test('F26: retained old key version remains readable; absent snapshot format refuses restore before writes',async t=>{
  const f=await fixture(t);await admission(f);
  const file=path.join(f.archive.directory,'custody/keys.json'),keys=JSON.parse(await fs.readFile(file,'utf8')) as Record<string,string>;
  keys['v2']='1'.repeat(64);await fs.writeFile(file,JSON.stringify(keys));assert((await f.archive.records()).length>0);
  const target=await fixture(t,false),snapshot=await f.snapshot();
  await assert.rejects(restoreInert({snapshot:{...snapshot,format:99 as 1},recovery:target.role('recovery'),archive:f.archive}),/snapshot_format_unknown/);
  assert.equal((await target.rows('business')).length,0);
});
