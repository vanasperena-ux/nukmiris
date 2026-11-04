import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,plan,provider,arm,admission,raw,signature,status,evidence} from './support/helpers.js';
import {worker} from './support/process-driver.js';
import type {WorkerConfig} from './support/worker-process.js';
import type {Fixture} from './support/postgres-fixture.js';
import {text,object} from '../src/domain/protocol.js';
import type {Seal,Envelope} from '../src/ports.js';
import {dispatchOnce,reconcileReadOnly} from '../src/application/dispatch-once.js';
import {recordResult} from '../src/application/record-result.js';

function config(f:Fixture,p:Seal,url:string,pauseAt:string):WorkerConfig {
  return {mode:'dispatch',socket:f.socket,database:f.dbname,archive:f.archive.directory,businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId:randomUUID(),providerUrl:url,now:f.clock.now().toISOString(),pauseAt};
}
const posix={skip:process.platform==='win32'?'SIGSTOP/SIGKILL evidence requires POSIX; Windows is NOT VERIFIED':false};

test('F04/F06 process crash after staged SQL retains the original archived input through restart',posix,async t=>{
  const f=await fixture(t),body=raw(f),c:WorkerConfig={mode:'admit',socket:f.socket,database:f.dbname,archive:f.archive.directory,businessId:'synthetic-a',attemptId:randomUUID(),ownerId:randomUUID(),providerUrl:'http://127.0.0.1:1',now:f.clock.now().toISOString(),pauseAt:'A2.afterCommit',raw:body.toString('base64'),signature:signature(f,body),secret:f.secret.toString('base64'),routes:f.routes};
  const child=worker(t,c);await child.wait('point',c.pauseAt);const original=(await f.rows('input'))[0]!['id'];await child.kill();
  const retry=await admission(f,body);assert.equal(retry.inputs[0]!['inputId'],original);assert.equal((await f.rows('input')).length,1);
});

test('F11 before-arm freeze: later arm wins once and the stale resumed process cannot submit',posix,async t=>{
  const f=await fixture(t),p=await plan(f),{server,client}=await provider(t,f),c=config(f,p,server.url,'worker.beforeArm');
  const child=worker(t,c);await child.wait('point',c.pauseAt);child.child.kill('SIGSTOP');
  const owner=await arm(f,p);const result=await dispatchOnce({businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId:owner,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock});assert.equal(result.state,'APPLIED');
  child.resume(c.pauseAt);const done=await child.wait('done');assert.equal(object(done['result'])['state'],'HELD');await child.closed;assert.equal((await server.calls()).length,1);
});

test('F11 armed-process death never transfers possible dispatch authority to a restart',posix,async t=>{
  const f=await fixture(t),p=await plan(f),{server}=await provider(t,f),c=config(f,p,server.url,'worker.afterArm');
  const child=worker(t,c);await child.wait('point',c.pauseAt);await child.kill();
  const next=worker(t,{...c,ownerId:randomUUID(),pauseAt:''});const done=await next.wait('done');await next.closed;
  assert.equal(object(done['result'])['state'],'HELD');assert.equal((await server.calls()).length,0);assert.equal((await f.rows('mutation_guard')).length,1);
});

test('F13 residual counterexample: a frozen process admitted BEFORE suspension can physically invoke later; no successor can',posix,async t=>{
  const f=await fixture(t),p=await plan(f),{server}=await provider(t,f),c=config(f,p,server.url,'dispatch.afterGate');
  const child=worker(t,c);await child.wait('point',c.pauseAt);child.child.kill('SIGSTOP');await status(f,'SUSPENDED',1);
  const next=worker(t,{...c,ownerId:randomUUID(),pauseAt:''});assert.equal(object((await next.wait('done'))['result'])['state'],'HELD');await next.closed;
  assert.equal((await server.calls()).length,0);child.resume(c.pauseAt);await child.wait('done');await child.closed;
  assert.equal((await server.calls()).length,1);assert.equal((await f.rows('business'))[0]!['status'],'SUSPENDED');
  await evidence('F13-RESIDUAL-LATE-SUBMISSION',{result:'REPRODUCED; production physical cutoff NOT PROVEN',calls:await server.calls(),business:await f.rows('business'),attempts:await f.rows('attempt'),requiredGate:'OPS01 deployed egress containment before activation'});
});

test('F14/16 process death after actual fake-provider acceptance reconciles read-only without another invocation',posix,async t=>{
  const f=await fixture(t),p=await plan(f),{server,client}=await provider(t,f),c=config(f,p,server.url,'dispatch.afterProvider');
  const child=worker(t,c);await child.wait('point',c.pauseAt);assert.equal((await server.calls()).length,1);await child.kill();
  const next=worker(t,{...c,ownerId:randomUUID(),pauseAt:''});assert.equal(object((await next.wait('done'))['result'])['state'],'HELD');await next.closed;
  const proof=await reconcileReadOnly({envelope:object(p.body['envelope']) as Envelope,provider:client});assert(proof);
  await recordResult({proof,result:f.role('result'),sealer:f.role('sealer'),archive:f.archive});assert.equal((await server.calls()).length,1);assert.equal((await f.rows('mutation_guard')).length,0);
});
