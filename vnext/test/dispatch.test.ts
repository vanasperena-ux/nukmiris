import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,plan,arm,provider,apply,signature,raw,suppress,cut,evidence} from './support/helpers.js';
import {dispatchOnce,reconcileReadOnly,armAttempt} from '../src/application/dispatch-once.js';
import {recordResult} from '../src/application/record-result.js';
import {prepareOutput} from '../src/application/prepare-operation.js';
import {text,object} from '../src/domain/protocol.js';
import type {Envelope} from '../src/ports.js';
import {admitInput} from '../src/application/admit-input.js';

test('F11/14/15 DB06: duplicate loops, lost response and later owner never issue a second HTTP invocation',async t=>{
  const f=await fixture(t),p=await plan(f),owner=await arm(f,p),{server,client}=await provider(t,f);server.loseResponse=true;
  const args={businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId:owner,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock};
  const outcomes=await Promise.all([dispatchOnce(args),dispatchOnce(args)]);
  assert.equal((await server.calls()).length,1);assert.equal(outcomes.filter(o=>o.state==='UNKNOWN').length,1);
  assert.equal((await f.rows('mutation_guard')).length,1);assert.equal((await f.rows('attempt'))[0]!['state'],'UNKNOWN');
  assert.equal(await armAttempt({...args,sealer:f.role('sealer'),ownerId:randomUUID()}),false);
  f.clock.instant+=3600000;assert.equal((await dispatchOnce(args)).state,'HELD');assert.equal((await server.calls()).length,1);
  const proof=await reconcileReadOnly({envelope:object(p.body['envelope']) as Envelope,provider:client});assert(proof);
  await recordResult({proof,result:f.role('result'),sealer:f.role('sealer'),archive:f.archive});
  assert.equal((await f.rows('mutation_guard')).length,0);assert.equal((await server.calls()).length,1);
  await evidence('F11-F14',{outcomes,calls:await server.calls(),attempts:await f.rows('attempt'),guards:await f.rows('mutation_guard')});
});

test('F17: unknown entry COMMIT result returns no invocation permit and cannot be rearmed',async t=>{
  const f=await fixture(t),p=await plan(f),owner=await arm(f,p),{server,client}=await provider(t,f);
  const args={businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId:owner,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock};
  await assert.rejects(dispatchOnce({...args,faults:cut('entry.afterCommit')}),/injected/);
  assert.equal((await f.rows('attempt'))[0]!['state'],'SUBMISSION_ENTERED');assert.equal((await server.calls()).length,0);
  assert.equal((await dispatchOnce(args)).state,'HELD');assert.equal((await f.rows('mutation_guard')).length,1);
  assert.equal(await reconcileReadOnly({envelope:object(p.body['envelope']) as Envelope,provider:client}),null);
});

for(const failAt of ['appointment','protection','output','guard']) {
  test(`F18 DB05: finalizer ${failAt} failure rolls back every operational update and repeats only local finalization`,async t=>{
    const f=await fixture(t),p=await plan(f),owner=await arm(f,p),{server,client}=await provider(t,f);
    const outcome=await dispatchOnce({businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId:owner,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock});assert.equal(outcome.state,'APPLIED');if(outcome.state!=='APPLIED')return;
    const before={appointments:await f.rows('appointment'),guards:await f.rows('mutation_guard'),protections:await f.rows('protection'),attempts:await f.rows('attempt')};
    await assert.rejects(recordResult({proof:outcome.proof,result:f.role('result'),sealer:f.role('sealer'),archive:f.archive,failAt}),/injected_finalizer/);
    assert.deepEqual({appointments:await f.rows('appointment'),guards:await f.rows('mutation_guard'),protections:await f.rows('protection'),attempts:await f.rows('attempt')},before);
    assert.equal((await f.rows('output_intent')).length,0);
    await recordResult({proof:outcome.proof,result:f.role('result'),sealer:f.role('sealer'),archive:f.archive});
    assert.equal((await f.rows('output_intent')).length,1);assert.equal((await f.rows('mutation_guard')).length,0);assert.equal((await server.calls()).length,1);
    assert.equal(await recordResult({proof:outcome.proof,result:f.role('result'),sealer:f.role('sealer'),archive:f.archive}),false);
    await evidence('F18-'+failAt,{before,after:await f.rows('appointment'),outputs:await f.rows('output_intent'),providerCalls:(await server.calls()).length});
  });
}

test('F16: result archive failure keeps protection; a read-only proof finalizes after repair without re-sending',async t=>{
  let fail=false;const f=await fixture(t,true,{async hit(p){if(fail&&p==='archive.beforePut')throw new Error('archive_unavailable');}});
  const p=await plan(f),owner=await arm(f,p),{server,client}=await provider(t,f);
  const args={businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId:owner,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock};
  const outcome=await dispatchOnce(args);assert(outcome.state==='APPLIED');fail=true;
  await assert.rejects(recordResult({proof:outcome.proof,result:f.role('result'),sealer:f.role('sealer'),archive:f.archive}),/archive_unavailable/);
  assert.equal((await f.rows('mutation_guard')).length,1);assert.equal((await dispatchOnce(args)).state,'HELD');fail=false;
  const proof=await reconcileReadOnly({envelope:object(p.body['envelope']) as Envelope,provider:client});assert(proof);
  await recordResult({proof,result:f.role('result'),sealer:f.role('sealer'),archive:f.archive});assert.equal((await server.calls()).length,1);
});

test('F19: late result cannot release a newer appointment mutation guard',async t=>{
  const f=await fixture(t),p=await plan(f);await apply(t,f,p);
  const move=await plan(f,{kind:'MOVE',appointmentId:text(p.body['appointmentId']),eventId:text(p.body['eventId']),expectedRevision:2,startAt:'2030-01-02T12:00:00Z',endAt:'2030-01-02T13:00:00Z'});
  const proof={businessId:'synthetic-a',attemptId:text(p.body['attemptId']),payloadDigest:text(p.body['payloadDigest']),remoteId:text(p.body['eventId'])};
  assert.equal(await recordResult({proof,result:f.role('result'),sealer:f.role('sealer'),archive:f.archive}),false);
  assert.equal((await f.rows('mutation_guard'))[0]!['operation_id'],move.body['operationId']);
});

test('F20/21: exact sealed receipt before HTTP timeout wins; late failure cannot downgrade delivered/read',async t=>{
  const f=await fixture(t),p=await plan(f);await apply(t,f,p);
  const out=await prepareOutput({businessId:'synthetic-a',outputId:text(p.body['outputId']),reducer:f.role('reducer'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock});
  const {server,client}=await provider(t,f),owner=await arm(f,out);server.loseResponse=true;
  async function receipt(envelope:Envelope,status:string,recipient=envelope.recipient):Promise<boolean> {
    const value=JSON.parse(raw(f).toString()) as {entry:{changes:{value:{messages:unknown[]}}[]}[]};
    value.entry[0]!.changes[0]!.value.messages=[{id:randomUUID(),type:'receipt',attemptId:envelope.attemptId,messageId:envelope.remoteId,recipient,status}];
    const body=Buffer.from(JSON.stringify(value)),a=await admitInput({raw:body,signature:signature(f,body),secret:f.secret,routes:f.routes,ingress:f.role('ingress'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock});
    return f.role('result').tx('synthetic-a',async db=>(await db.query<{matched:boolean}>('SELECT core.accept_receipt($1,$2) matched',['synthetic-a',a.inputs[0]!['inputId']])).rows[0]!.matched);
  }
  server.beforeResponse=async envelope=>{assert.equal(await receipt(envelope,'read'),true);};
  const outcome=await dispatchOnce({businessId:'synthetic-a',attemptId:text(out.body['attemptId']),ownerId:owner,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock});assert.equal(outcome.state,'UNKNOWN');
  const e=object(out.body['envelope']) as Envelope;
  assert.equal(await receipt(e,'failed'),true);assert.equal(await receipt(e,'delivered'),true);assert.equal(await receipt(e,'read','wrong-person'),false);
  const row=(await f.rows('attempt')).find(r=>r['id']===out.body['attemptId'])!;
  assert.equal(row['state'],'VERIFIED_APPLIED');assert.equal(row['meta_status'],'read');assert.equal((await server.calls()).length,1);
  await assert.rejects(plan(f,{inputId:text((await f.rows('receipt'))[0]!['input_id']),startAt:'2030-01-04T10:00:00Z',endAt:'2030-01-04T11:00:00Z'}),/synthetic_command_required/);
  await evidence('F20',{attempt:row,receipts:await f.rows('receipt'),calls:await server.calls()});
});

test('F22: an uncertain output head never expires into unsent and blocks later output while STOP still works',async t=>{
  const f=await fixture(t),p=await plan(f);await apply(t,f,p);
  const out=await prepareOutput({businessId:'synthetic-a',outputId:text(p.body['outputId']),reducer:f.role('reducer'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock});
  const {server,client}=await provider(t,f);server.loseResponse=true;const owner=await arm(f,out);
  await dispatchOnce({businessId:'synthetic-a',attemptId:text(out.body['attemptId']),ownerId:owner,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock});
  const second=await plan(f,{startAt:'2030-01-03T10:00:00Z',endAt:'2030-01-03T11:00:00Z'});
  const owner2=await arm(f,second);
  assert.equal((await dispatchOnce({businessId:'synthetic-a',attemptId:text(second.body['attemptId']),ownerId:owner2,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock})).state,'HELD');
  assert.equal((await f.rows('output_intent')).length,1,'later operation is held before a later output can exist');
  const expired=await f.role('dispatch').tx('synthetic-a',async db=>(await db.query<{expired:boolean}>('SELECT core.expire_unsent($1,$2,$3) expired',['synthetic-a',out.body['outputId'],'2030-01-04T10:00:00Z'])).rows[0]!.expired);assert.equal(expired,false);
  await suppress(f);assert.equal((await f.rows('permission_head'))[0]!['suppressed'],true);
  assert.equal((await server.calls()).length,1);
});

for(const failure of ['socket-timeout','429','500','409','412']) {
  test(`F15 conservative fallback: ${failure} has one invocation, remains unknown and never automatically retries`,async t=>{
    const f=await fixture(t),p=await plan(f),ownerId=await arm(f,p);let calls=0;
    const synthetic={mode:'WP1_SYNTHETIC_ONLY' as const,async submitOnce(){calls++;throw new Error(failure);},async readOnly(){return null;}};
    const args={businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId,dispatcher:f.role('dispatch'),archive:f.archive,provider:synthetic,clock:f.clock};
    assert.equal((await dispatchOnce(args)).state,'UNKNOWN');assert.equal((await dispatchOnce(args)).state,'HELD');
    assert.equal(calls,1);assert.equal((await f.rows('mutation_guard')).length,1);
  });
}

test('F30: a mismatched remote proof cannot finalize or free a protected operation',async t=>{
  const f=await fixture(t),p=await plan(f),ownerId=await arm(f,p),{client}=await provider(t,f);
  const outcome=await dispatchOnce({businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock});assert(outcome.state==='APPLIED');
  await assert.rejects(recordResult({proof:{...outcome.proof,payloadDigest:'0'.repeat(64)},result:f.role('result'),sealer:f.role('sealer'),archive:f.archive}),/foreign_proof/);
  await assert.rejects(recordResult({proof:{...outcome.proof,remoteId:'copied-other-event'},result:f.role('result'),sealer:f.role('sealer'),archive:f.archive}),/stale_finalizer/);
  assert.equal((await f.rows('mutation_guard')).length,1);assert.equal((await f.rows('output_intent')).length,0);
});

for(const [label,offset,expected] of [['before due',-1,'HELD'],['at due',0,'APPLIED'],['after deadline',900001,'HELD']] as const) {
  test(`F27 synthetic eligibility: ${label}`,async t=>{
    const f=await fixture(t),p=await plan(f),ownerId=await arm(f,p),{server,client}=await provider(t,f);f.clock.instant+=offset;
    assert.equal((await dispatchOnce({businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock})).state,expected);
    assert.equal((await server.calls()).length,expected==='APPLIED'?1:0);
  });
}

test('F27 transport budget must fit strictly before appointment start even when the local deadline has not elapsed',async t=>{
  const f=await fixture(t),p=await plan(f,{startAt:'2030-01-01T09:00:05Z',endAt:'2030-01-01T10:00:05Z'}),ownerId=await arm(f,p),{server,client}=await provider(t,f);
  f.clock.instant+=3000;
  assert.equal((await dispatchOnce({businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock})).state,'HELD');assert.equal((await server.calls()).length,0);
});
