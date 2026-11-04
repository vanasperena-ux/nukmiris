import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {admitInput} from '../src/application/admit-input.js';
import {prepareOperation} from '../src/application/prepare-operation.js';
import {fixture,raw,signature,admission,cut,evidence} from './support/helpers.js';

test('F01 SEC01/02: exact bytes, WABA and receiving number authenticate before any write',async t=>{
  const f=await fixture(t),body=raw(f);
  await assert.rejects(admitInput({raw:Buffer.concat([body,Buffer.from(' ')]),signature:signature(f,body),secret:f.secret,routes:f.routes,ingress:f.role('ingress'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock}),/signature_rejected/);
  await assert.rejects(admission(f,Buffer.from(body.toString().replace('waba-synthetic-a','waba-foreign'))),/route_rejected/);
  await assert.rejects(admission(f,Buffer.from(body.toString().replace('number-synthetic-a','number-foreign'))),/route_rejected/);
  await assert.rejects(admission(f,Buffer.from(body.toString().replace('"type":"text"','"type":"image"'))),/unsupported_message/);
  assert.equal((await f.rows('input')).length,0);assert.equal((await f.archive.records()).length,0);
});

test('F02: duplicate/repacked batch has one stable input; any original event change conflicts',async t=>{
  const f=await fixture(t),body=raw(f),first=await admission(f,body);
  const again=await admission(f,body),repacked=await admission(f,Buffer.from(JSON.stringify(JSON.parse(body.toString()),null,2)));
  assert.equal(first.inputs[0]!['inputId'],again.inputs[0]!['inputId']);assert.equal(first.inputs[0]!['inputId'],repacked.inputs[0]!['inputId']);
  await assert.rejects(admission(f,Buffer.from(body.toString().replace('synthetic fixed command','changed'))),/archive_identity_conflict/);
  assert.equal((await f.rows('input')).length,1);assert.equal((await f.rows('input'))[0]!['sequence'],'1');
});

for(const point of ['A1.afterPrepare','A2.beforeCommit','A2.afterCommit','A3.afterSeal','A4.beforeCommit','A4.afterCommit','A5.beforeAck']) {
  test(`F03–06 DB01: ${point} retains original identity and safe eligibility across retry`,async t=>{
    const f=await fixture(t),body=raw(f);
    await assert.rejects(admission(f,body,cut(point)),/injected/);
    const before=await f.rows('input'),eligible=before.filter(r=>r['state']==='ELIGIBLE');
    if(!['A4.afterCommit','A5.beforeAck'].includes(point))assert.equal(eligible.length,0);
    const original=(await f.archive.records()).find(r=>r.kind==='INPUT')!.body['inputId'];
    const result=await admission(f,body);
    assert.equal(result.acknowledged,true);assert.equal(result.inputs[0]!['inputId'],original);
    assert.equal((await f.rows('input')).length,1);assert.equal((await f.rows('input'))[0]!['state'],'ELIGIBLE');
    assert.equal((await f.rows('operation')).length,0);
    await evidence('F03-'+point,{point,originalId:original!,before,after:await f.rows('input'),effects:0});
  });
}

test('DB01: staged unsealed input cannot prepare an operation, including a direct guarded-function call',async t=>{
  const f=await fixture(t),body=raw(f);
  await assert.rejects(admission(f,body,cut('A2.afterCommit')));
  const input=(await f.rows('input'))[0]!;
  await assert.rejects(prepareOperation({request:{businessId:'synthetic-a',inputId:String(input['id']),customerId:f.id('customer'),calendarId:f.id('calendar'),resourceId:f.id('resource'),startAt:'2030-01-02T10:00:00Z',endAt:'2030-01-02T11:00:00Z'},reducer:f.role('reducer'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock}),/input_not_eligible/);
  assert.equal((await f.rows('operation')).length,0);assert.equal((await f.rows('attempt')).length,0);
});

test('F07: STOP suppresses immediately even when the conflicting batch cannot be acknowledged',async t=>{
  const f=await fixture(t),id=randomUUID(),body=raw(f,'original','synthetic-a',id);await admission(f,body);
  await assert.rejects(admission(f,raw(f,'STOP','synthetic-a',id)),/archive_identity_conflict/);
  assert.equal((await f.rows('permission_head'))[0]!['suppressed'],true);
  assert.equal((await f.rows('input')).length,1);
});

for(const point of ['archive.beforePut','archive.afterObject','archive.afterHead','archive.afterWitness']) {
  test(`F03/F08: ${point} cannot acknowledge or expose executable SQL`,async t=>{
    let active=true;const f=await fixture(t,true,{async hit(p){if(active&&p===point){active=false;throw new Error('archive_cut');}}});
    await assert.rejects(admission(f),/archive_cut/);
    assert.equal((await f.rows('input')).length,0);assert.equal((await f.rows('attempt')).length,0);
    if(point==='archive.afterHead')await assert.rejects(f.archive.records(),/archive_head_unknown/);
    else assert.equal((await admission(f)).acknowledged,true);
  });
}
