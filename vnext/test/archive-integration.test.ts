import {admissionCustody,RAW_CUSTODY} from '../src/application/admission-custody.js';
import {fixtureCustody} from './support/custody.js';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { archiveFixture, corrupt } from './support/archive-fixture.js';
import { fixture, provider, raw, signature } from './support/helpers.js';
import { admitInput } from '../src/application/admit-input.js';
import { prepareOperation } from '../src/application/prepare-operation.js';
import { armAttempt, dispatchOnce, reconcileReadOnly } from '../src/application/dispatch-once.js';
import { recordResult } from '../src/application/record-result.js';
import { restoreInert } from '../src/application/restore-inert.js';
import { setBusinessStatus } from '../src/application/set-business-status.js';
import { object, text } from '../src/domain/protocol.js';
import type { Envelope } from '../src/ports.js';
import { capacityWorkflows } from './support/archive-capacity-workflow.js';

async function setup(t:TestContext) {
  const f=await fixture(t),a=await archiveFixture(t),archive=a.scope,body=raw(f);
  const admitted=await admitInput({raw:body,signature:signature(f,body),secret:f.secret,routes:f.routes,ingress:f.role('ingress'),sealer:f.role('sealer'),reducer:f.role('reducer'),custody:fixtureCustody(a.archive),clock:f.clock});
  const p=await prepareOperation({request:{businessId:'synthetic-a',inputId:text(admitted.inputs[0]!['inputId']),customerId:f.id('customer'),calendarId:f.id('calendar'),resourceId:f.id('resource'),startAt:'2030-01-02T10:00:00Z',endAt:'2030-01-02T11:00:00Z'},reducer:f.role('reducer'),sealer:f.role('sealer'),archive,clock:f.clock});
  const ownerId=randomUUID(),attemptId=text(p.body['attemptId']);
  const common={businessId:'synthetic-a',attemptId,ownerId,dispatcher:f.role('dispatch'),archive};
  assert.equal(await armAttempt({...common,sealer:f.role('sealer')}),true);
  return {f,a,archive,p,common};
}
test('017 indexed archive retains UNKNOWN protections and reconciles without a second fake submission',async t=>{
  const {f,a,archive,p,common}=await setup(t),{server,client}=await provider(t,f);server.loseResponse=true;
  assert.equal((await dispatchOnce({...common,provider:client,clock:f.clock})).state,'UNKNOWN');
  assert.equal((await dispatchOnce({...common,provider:client,clock:f.clock})).state,'HELD');assert.equal((await server.calls()).length,1);
  assert.equal(a.archive.metrics.fullAudits,0);assert.equal((await f.rows('mutation_guard')).length,1);
  const proof=await reconcileReadOnly({envelope:object(p.body['envelope']) as Envelope,provider:client});assert.ok(proof);
  await recordResult({proof,result:f.role('result'),sealer:f.role('sealer'),archive});assert.equal((await server.calls()).length,1);
  assert.equal((await f.rows('appointment')).length,1);assert.equal((await f.rows('mutation_guard')).length,0);
  assert.equal((await f.rows('appointment','synthetic-b')).length,0);
});
test('017 missing ARM evidence cannot allocate a successor or enter submission',async t=>{
  const {f,a,archive,common}=await setup(t),{server,client}=await provider(t,f);
  const arm=await archive.lookup(`arm/synthetic-a/${common.attemptId}`);assert.ok(arm);
  corrupt(a.config.file,`DROP TRIGGER records_no_delete; DELETE FROM records WHERE sequence=${arm.sequence}`);
  await assert.rejects(dispatchOnce({...common,provider:client,clock:f.clock}),/record_missing/);
  await assert.rejects(armAttempt({...common,ownerId:randomUUID(),sealer:f.role('sealer')}),/record_missing/);
  assert.equal((await server.calls()).length,0);assert.equal((await f.rows('attempt'))[0]!['state'],'ARMED');assert.equal((await f.rows('mutation_guard')).length,1);
});
test('017 suspension still defeats an indexed ARM lookup before the final gate',async t=>{
  const {f,archive,common}=await setup(t),{server,client}=await provider(t,f);
  await setBusinessStatus({businessId:'synthetic-a',value:'SUSPENDED',expected:1,evidenceId:randomUUID(),operator:f.role('operator'),sealer:f.role('sealer'),archive});
  assert.equal((await dispatchOnce({...common,provider:client,clock:f.clock})).state,'HELD');assert.equal((await server.calls()).length,0);
});
test('017 cold restore keeps original archived identity and remains inert; broken archive creates a hold',async t=>{
  const f=await fixture(t),a=await archiveFixture(t),archive=a.scope,snapshot=await f.snapshot();
  const p=await archive.ensure('lost-arm','ARM',{businessId:'synthetic-a',attemptId:randomUUID(),ownerId:randomUUID(),payloadDigest:'a'.repeat(64),envelope:{}});
  const target=await fixture(t,false),restored=await restoreInert({snapshot,recovery:target.role('recovery'),archive});assert.equal(restored.complete,true);assert.equal(restored.dispatchEnabled,false);
  assert.equal((await target.rows('business'))[0]!['dispatch_enabled'],false);assert.equal((await archive.lookup('lost-arm'))?.hash,p.hash);
  assert.equal(object((await target.rows('recovery_case'))[0]!['original_evidence'])['hash'],p.hash);
  corrupt(a.config.file,'DELETE FROM nodes');const brokenTarget=await fixture(t,false),broken=await restoreInert({snapshot,recovery:brokenTarget.role('recovery'),archive});assert.equal(broken.complete,false);assert.equal(broken.newEffects,0);
});

test('017 missing tenant binding refuses ACK after preserving every validated immediate STOP',async t=>{
  const f=await fixture(t),a=await archiveFixture(t);
  const av=object(JSON.parse(raw(f,'STOP','synthetic-a').toString())),bv=object(JSON.parse(raw(f,'STOP','synthetic-b').toString()));
  const body=Buffer.from(JSON.stringify({entry:[...(av['entry'] as []),...(bv['entry'] as [])]}));
  await assert.rejects(admitInput({raw:body,signature:signature(f,body),secret:f.secret,routes:f.routes,ingress:f.role('ingress'),sealer:f.role('sealer'),reducer:f.role('reducer'),custody:admissionCustody(a.archive.scope(RAW_CUSTODY),new Map([['synthetic-a',a.scope]])),clock:f.clock}),/tenant_archive_binding_missing/);
  assert.equal((await f.rows('permission_head','synthetic-a'))[0]!['suppressed'],true);
  assert.equal((await f.rows('permission_head','synthetic-b'))[0]!['suppressed'],true);
  const records=await a.scope.records();assert.ok(records.length>0);assert.ok(records.every(s=>s.kind!=='RAW_BATCH'&&s.body['businessId']==='synthetic-a'));
  assert.equal((await f.rows('input')).length,1);assert.equal((await f.rows('input','synthetic-b')).length,0);
});

test('017 capacity workflow oracle measures guarded admission and competing dispatch without bypassing output heads',async t=>{
  const a=await archiveFixture(t),r=await capacityWorkflows(a.archive);
  assert.equal(r.attempts,12);assert.equal(r.providerInvocations,12);assert.equal(r.dispatchMs.samples.length,24);assert.equal(r.fullArchiveScans,0);
});
