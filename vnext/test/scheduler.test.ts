import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,plan,apply,grant,arm,evidence} from './support/helpers.js';
import {prepareOutput} from '../src/application/prepare-operation.js';
import {text} from '../src/domain/protocol.js';
import type {ObjectValue} from '../src/domain/protocol.js';
import {shuffled} from './support/scheduler.js';

test('DB06/07/08: 1000 recorded seeded real-PostgreSQL admission/withdrawal/suspension schedules',async t=>{
  const f=await fixture(t),p=await plan(f,{outputPurpose:'REMINDER'});await apply(t,f,p);await grant(f);
  const out=await prepareOutput({businessId:'synthetic-a',outputId:text(p.body['outputId']),reducer:f.role('reducer'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock}),owner=await arm(f,out);
  const originalAttempt=await f.rows('attempt'),attemptId=text(out.body['attemptId']);
  const traces:ObjectValue[]=[];let claimsTotal=0;const distinct=new Set<string>();
  for(let seed=1;seed<=1000;seed++) {
    // Explicit independent-case reset of fixture state. Never reset within a
    // crash/recovery scenario. No provider is invoked by this gate exploration.
    await f.admin.query('BEGIN');
    await f.admin.query("UPDATE core.business SET status='ACTIVE',revision=1 WHERE business_id='synthetic-a'");
    await f.admin.query("UPDATE core.permission_head SET suppressed=false,revision=1,last_revoke_at=NULL WHERE business_id='synthetic-a'");
    await f.admin.query("DELETE FROM core.permission_event WHERE decision='REVOKE'");await f.admin.query('DELETE FROM core.status_event');
    await f.admin.query("UPDATE core.attempt SET state='ARMED' WHERE business_id='synthetic-a' AND id=$1",[attemptId]);
    await f.admin.query("UPDATE core.output_intent SET state='PENDING' WHERE business_id='synthetic-a' AND id=$1",[out.body['outputId']]);
    await f.admin.query('COMMIT');
    const order=shuffled(seed,['preflightA','preflightB','readHead','STOP','suspend','enterA','enterB','inspect','expireUnsent'] as const);
    distinct.add(order.join(','));let blocked=false,claims=0;const steps:ObjectValue[]=[];
    for(const action of order) {
      if(action==='STOP') {
        await f.role('operator').tx('synthetic-a',async db=>{await db.query('SELECT core.suppress($1,$2,$3,$4,$5)',['synthetic-a','customer-synthetic-a','seed-'+seed,'fixture-schedule-'+seed,f.clock.now().toISOString()]);});blocked=true;
      } else if(action==='suspend') {
        await f.role('operator').tx('synthetic-a',async db=>{await db.query('SELECT core.set_status($1,$2,$3,$4,$5,$6)',['synthetic-a','SUSPENDED','seed-'+seed,'fixture-schedule-'+seed,1,'']);});blocked=true;
      } else if(action==='enterA'||action==='enterB') {
        const entered=await f.role('dispatch').tx('synthetic-a',async db=>(await db.query<{entered:boolean}>('SELECT core.enter_submission($1,$2,$3,$4) entered',['synthetic-a',attemptId,owner,f.clock.now().toISOString()])).rows[0]!.entered);
        if(blocked)assert.equal(entered,false,`seed ${seed}: admission after STOP/suspension`);
        if(entered)claims++;
        steps.push({action,entered,blocked});
      } else if(action==='expireUnsent') {
        const expired=await f.role('dispatch').tx('synthetic-a',async db=>(await db.query<{expired:boolean}>('SELECT core.expire_unsent($1,$2,$3) expired',['synthetic-a',out.body['outputId'],'2030-01-04T00:00:00Z'])).rows[0]!.expired);assert.equal(expired,false);
      } else {await f.role('dispatch').tx('synthetic-a',async db=>{await db.query('SELECT state FROM core.attempt WHERE business_id=$1 AND id=$2',['synthetic-a',attemptId]);});}
    }
    assert(claims<=1,`seed ${seed}: duplicate admission`);claimsTotal+=claims;traces.push({seed,order,claims,steps});
  }
  assert(distinct.size>900,'schedules must vary, not repeat one race 1000 times');
  await evidence('DB06-1000-schedules',{cases:1000,distinctSchedules:distinct.size,claimsTotal,providerInvocations:0,
    scope:'real SQL gate exploration only; HTTP/process invocation and ingress sealing covered in separate tests',
    initialAttempts:originalAttempt,traces});
});
