import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,plan,apply,arm,provider,grant,suppress,status,admission,raw,evidence} from './support/helpers.js';
import {prepareOutput} from '../src/application/prepare-operation.js';
import {dispatchOnce} from '../src/application/dispatch-once.js';
import {text} from '../src/domain/protocol.js';

async function reminder(t:Parameters<typeof fixture>[0]) {
  const f=await fixture(t),p=await plan(f,{outputPurpose:'REMINDER'});await apply(t,f,p);await grant(f);
  const out=await prepareOutput({businessId:'synthetic-a',outputId:text(p.body['outputId']),reducer:f.role('reducer'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock});
  const ownerId=await arm(f,out),remote=await provider(t,f);
  const args={businessId:'synthetic-a',attemptId:text(out.body['attemptId']),ownerId,dispatcher:f.role('dispatch'),archive:f.archive,provider:remote.client,clock:f.clock};
  return {f,p,out,...remote,args};
}

test('F07/F23 DB07: unknown sender STOP persists a real head even with archive unavailable',async t=>{
  let fail=false;const f=await fixture(t,true,{async hit(p){if(fail&&p==='archive.beforePut')throw new Error('archive_outage');}});fail=true;
  await assert.rejects(admission(f,raw(f,'STOP','synthetic-a',randomUUID(),'unknown-subject')),/archive_outage/);
  const h=(await f.rows('permission_head'))[0]!;assert.equal(h['subject'],'unknown-subject');assert.equal(h['suppressed'],true);
  assert.equal((await f.rows('customer')).some(c=>c['subject']==='unknown-subject'),false);assert.equal((await f.rows('input')).length,0);
});

test('F12/23: STOP during slow preflight defeats the last send admission',async t=>{
  const {f,args,server}=await reminder(t);
  let release!:()=>void,arrive!:()=>void;
  const arrived=new Promise<void>(r=>{arrive=r;}),gate=new Promise<void>(r=>{release=r;});
  const running=dispatchOnce({...args,faults:{async hit(p){if(p==='dispatch.beforeGate'){arrive();await gate;}}}});
  await arrived;await suppress(f);release();assert.equal((await running).state,'HELD');assert.equal((await server.calls()).length,0);
  await evidence('F12-STOP-first',{calls:0,permissions:await f.rows('permission_head'),attempts:await f.rows('attempt')});
});

test('DB07: READ COMMITTED final admission observes the withdrawal revision after a real row-lock wait',async t=>{
  const {f,args,server}=await reminder(t);
  let release!:()=>void,arrive!:()=>void;
  const arrived=new Promise<void>(r=>{arrive=r;}),gate=new Promise<void>(r=>{release=r;});
  const stop=f.role('operator').tx('synthetic-a',async db=>{await db.query('SELECT core.suppress($1,$2,$3,$4,$5)',
    ['synthetic-a','customer-synthetic-a',randomUUID(),'synthetic-lock-race-evidence',f.clock.now().toISOString()]);},'stop',{
      async hit(point){if(point==='stop.beforeCommit'){arrive();await gate;}}
    });
  await arrived;
  const running=dispatchOnce(args);let waiting=false;
  for(let i=0;i<200;i++){
    const r=await f.admin.query("SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND usename='wp1_dispatch' AND wait_event_type='Lock'",[f.dbname]);
    if(r.rowCount){waiting=true;break;}await delay(10);
  }
  assert(waiting,'dispatcher must really wait, not just run after a sequential test');
  release();await stop;
  assert.equal((await running).state,'HELD');assert.equal((await server.calls()).length,0);
});

test('F25: duplicate old grant, same-time tie, stale revision and future evidence cannot revive withdrawal',async t=>{
  const f=await fixture(t),evidenceId=randomUUID(),first=f.clock.now().toISOString();await grant(f,undefined,undefined,0,first,evidenceId);
  await suppress(f);await grant(f,undefined,undefined,0,first,evidenceId);
  assert.equal((await f.rows('permission_head'))[0]!['suppressed'],true);
  await assert.rejects(grant(f,undefined,undefined,2,first),/stale_grant/);
  f.clock.instant+=1000;
  await assert.rejects(grant(f,undefined,undefined,1),/stale_grant/);
  await assert.rejects(grant(f,undefined,undefined,2,'2090-01-01T00:00:00Z'),/stale_grant/);
  await grant(f,undefined,undefined,2);assert.equal((await f.rows('permission_head'))[0]!['suppressed'],false);
});

test('DB08/F12/F27: suspension blocks queued calendar and message admissions; reactivation never replays stale work',async t=>{
  const {f,args,server}=await reminder(t),queued=await plan(f,{startAt:'2030-01-03T10:00:00Z',endAt:'2030-01-03T11:00:00Z'}),calendarOwner=await arm(f,queued);
  await status(f,'SUSPENDED',1);
  assert.equal((await dispatchOnce(args)).state,'HELD');
  assert.equal((await dispatchOnce({...args,attemptId:text(queued.body['attemptId']),ownerId:calendarOwner})).state,'HELD');
  await assert.rejects(plan(f,{startAt:'2030-01-04T10:00:00Z',endAt:'2030-01-04T11:00:00Z'}),/business_paused/);
  assert.equal((await f.rows('appointment')).length,2);assert.equal((await f.rows('customer')).length,1);
  await status(f,'ACTIVE',2);f.clock.instant+=16*60000;
  assert.equal((await dispatchOnce(args)).state,'HELD');assert.equal((await server.calls()).length,0);
  const future=await plan(f,{startAt:'2030-01-05T10:00:00Z',endAt:'2030-01-05T11:00:00Z'});await apply(t,f,future);
  assert.equal((await f.rows('attempt')).find(a=>a['id']===future.body['attemptId'])!['state'],'VERIFIED_APPLIED');
  assert.equal((await f.rows('business'))[0]!['revision'],'3');
  const other=await plan(f,{businessId:'synthetic-b'});await apply(t,f,other);
});

test('P0 safety boundary: reminder STOP does not cancel appointments or prevent ordinary customer-request execution',async t=>{
  const f=await fixture(t);await suppress(f);const p=await plan(f);await apply(t,f,p);
  assert.equal((await f.rows('appointment'))[0]!['state'],'ACTIVE');assert.equal((await f.rows('permission_head'))[0]!['suppressed'],true);
});
