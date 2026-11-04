import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,plan,apply,grant,arm,evidence,abandon} from './support/helpers.js';
import {prepareOutput} from '../src/application/prepare-operation.js';
import {text} from '../src/domain/protocol.js';
import type {ObjectValue} from '../src/domain/protocol.js';
import {shuffled} from './support/scheduler.js';
const b='synthetic-a';
test('R-CONCURRENT: 256 seeded overlapping PostgreSQL STOP/suspension/submission schedules preserve linearized gates',async t=>{
 const f=await fixture(t),p=await plan(f,{outputPurpose:'REMINDER'});await apply(t,f,p);await grant(f);
 const out=await prepareOutput({businessId:b,outputId:text(p.body['outputId']),reducer:f.role('reducer'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock}),owner=await arm(f,out),traces:ObjectValue[]=[];
 for(let seed=1;seed<=256;seed++) {
  // Independent case reset under fixture postgres only. Durable audit/evidence
  // from prior schedules is preserved; no interrupted case state is reset.
  await f.admin.query("UPDATE core.business SET status='ACTIVE',revision=1 WHERE business_id=$1",[b]);
  await f.admin.query("UPDATE core.permission_head SET suppressed=false,revision=1,last_revoke_at=NULL WHERE business_id=$1",[b]);
  await f.admin.query("UPDATE core.attempt SET state='ARMED' WHERE business_id=$1 AND id=$2",[b,out.body['attemptId']]);
  await f.admin.query("UPDATE core.output_intent SET state='PENDING' WHERE business_id=$1 AND id=$2",[b,out.body['outputId']]);
  const lower=(await f.admin.query('SELECT coalesce(max(id),0)::text n FROM core.audit')).rows[0]['n'] as string;
  const order=shuffled(seed,['gate','STOP','suspend'] as const);
  let entered=false;
  await Promise.all(order.map(async(action,index)=>{
   await delay(index%3); // concurrently pending clients, not awaited sequentially
   if(action==='gate')entered=await f.role('dispatch').tx(b,async db=>(await db.query<{v:boolean}>('SELECT core.enter_submission($1,$2,$3,$4) v',[b,out.body['attemptId'],owner,f.clock.now().toISOString()])).rows[0]!.v);
   if(action==='STOP')await f.role('operator').tx(b,db=>db.query('SELECT core.suppress($1,$2,$3,$4,$5)',[b,'customer-'+b,'concurrent-'+seed,'synthetic-'+seed,f.clock.now().toISOString()]));
   if(action==='suspend')await f.role('operator').tx(b,db=>db.query('SELECT core.set_status($1,$2,$3,$4,$5,$6)',[b,'SUSPENDED','concurrent-'+seed,'synthetic-'+seed,1,'']));
  }));
  const audit=(await f.admin.query('SELECT * FROM core.audit WHERE id>$1 ORDER BY id',[lower])).rows as ObjectValue[];
  if(entered){assert.equal(audit[0]!['action'],'SUBMISSION_ENTERED');assert.equal(audit.filter(a=>a['action']==='SUBMISSION_ENTERED').length,1);}
  assert.equal((await f.rows('business'))[0]!['status'],'SUSPENDED');assert.equal((await f.rows('permission_head'))[0]!['suppressed'],true);
  traces.push({seed,launchOrder:order,entered,audit});
 }
 await evidence('R-CONCURRENT-256',{cases:256,providerInvocations:0,traces});
});

test('R010-RACE: submission committed before abandonment preserves the unresolved hold',async t=>{
 const f=await fixture(t),p=await plan(f),owner=await arm(f,p);
 let release!:()=>void,arrive!:()=>void;const arrived=new Promise<void>(r=>{arrive=r;}),barrier=new Promise<void>(r=>{release=r;});
 const entered=f.role('dispatch').tx(b,async db=>(await db.query<{v:boolean}>('SELECT core.enter_submission($1,$2,$3,$4) v',[b,p.body['attemptId'],owner,f.clock.now().toISOString()])).rows[0]!.v,'race',{async hit(point){if(point==='race.beforeCommit'){arrive();await barrier;}}});
 await arrived;const abandoned=abandon(f,text(p.body['attemptId']));
 // Start both before releasing the genuine PostgreSQL gate lock.
 release();assert.equal(await entered,true);await assert.rejects(abandoned,/possibly_submitted_abandon_denied/);
 assert.equal((await f.rows('mutation_guard')).length,1);assert.equal((await f.rows('attempt'))[0]!['state'],'SUBMISSION_ENTERED');
});

test('R007-RACE: a held input cannot execute through a preparation that waited on its conversation lock',async t=>{
 const f=await fixture(t);await assert.rejects(plan(f,{}, {async hit(point){if(point==='prepare.afterArchive')throw new Error('cut');}}));
 const p=(await f.archive.records()).find(r=>r.kind==='OPERATION_PLAN')!;await f.role('sealer').seal(b,f.archive,p);
 const hold=await f.archive.ensure('race-hold','HOLD_INPUT',{businessId:b,inputId:p.body['inputId']!,digest:(await f.rows('input'))[0]!['digest']!,reason:'operator reviewed never executed'});await f.role('sealer').seal(b,f.archive,hold);
 let release!:()=>void,arrive!:()=>void;const arrived=new Promise<void>(r=>{arrive=r;}),barrier=new Promise<void>(r=>{release=r;});
 const holding=f.role('operator').tx(b,db=>db.query('SELECT core.hold_input($1,$2,$3,$4)',[b,p.body['inputId'],hold.key,hold.digest]),'hold',{async hit(point){if(point==='hold.beforeCommit'){arrive();await barrier;}}});
 await arrived;
 const preparing=f.role('reducer').tx(b,db=>db.query('SELECT core.prepare_operation($1,$2,$3,$4)',[b,p.body,p.digest,p.key]));
 const denied=assert.rejects(preparing,/input_not_eligible/);
 release();await holding;await denied;assert.equal((await f.rows('operation')).length,0);
});
