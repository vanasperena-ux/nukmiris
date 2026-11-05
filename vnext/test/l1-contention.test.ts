import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,admission,raw,plan,evidence} from './support/helpers.js';
import {text} from '../src/domain/protocol.js';
import {PlanConflictError} from '../src/application/plan-conflict.js';

test('L1/O3 measured synthetic contention separates resource conflicts, head holds and terminal lock timeouts',async t=>{
 const f=await fixture(t),requests:{inputId:string;customerId:string;startAt:string;endAt:string}[]=[];
 for(let n=0;n<6;n++){const customerId=randomUUID(),subject='contention-'+n;await f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',['synthetic-a',customerId,subject]);const inputId=text((await admission(f,raw(f,'synthetic fixed command','synthetic-a',randomUUID(),subject))).inputs[0]!['inputId']),hour=10+(n%3)*2;requests.push({inputId,customerId,startAt:`2030-01-02T${hour}:00:00Z`,endAt:`2030-01-02T${hour+1}:00:00Z`});}
 const samples=await Promise.all(requests.map(async r=>{const start=performance.now();try{await plan(f,r);return {result:'PREPARED',elapsedMs:performance.now()-start};}catch(e){if(!(e instanceof PlanConflictError))throw e;return {result:e.sqlState==='55P03'?'LOCK_TIMEOUT':'RESOURCE_CONFLICT',elapsedMs:performance.now()-start};}}));
 assert.equal(samples.filter(s=>s.result==='PREPARED').length,3);assert.equal(samples.filter(s=>s.result==='RESOURCE_CONFLICT').length,3);assert.equal(samples.filter(s=>s.result==='LOCK_TIMEOUT').length,0);
 const times=samples.map(x=>x.elapsedMs).sort((a,b)=>a-b);
 await evidence('L1-O3-CONTENTION',{workers:6,competingSlots:3,defaultLockTimeoutMs:3000,lockTimeoutCount:0,terminalResourceConflicts:3,prepared:3,p50Ms:times[Math.floor(times.length*.5)]!,p95Ms:times[Math.floor(times.length*.95)]!,samples,claim:'Synthetic host observation, not a Windows SLO. Terminal LOCK_TIMEOUT requires a new customer choice; never retry the rejected plan.'});
});
for(const timeoutMs of [50,3000])test(`L1/O3 measured ${timeoutMs}ms lock timeout terminalizes only the original input and preserves reservations atomically`,async t=>{
 const f=await fixture(t),body=await admission(f),inputId=text(body.inputs[0]!['inputId']),u=f.role('reducer'),tx=u.tx.bind(u);u.tx=async(...args)=>tx(args[0],async db=>{await db.query(`SET LOCAL lock_timeout='${timeoutMs}ms'`);return args[1](db);},args[2],args[3]) as never;
 const blocker=await f.admin.connect();await blocker.query('BEGIN');await blocker.query('SELECT * FROM core.resource WHERE business_id=$1 AND id=$2 FOR UPDATE',['synthetic-a',f.id('resource')]);const start=performance.now();
 try{await assert.rejects(plan(f,{inputId}),e=>e instanceof PlanConflictError&&e.sqlState==='55P03'&&e.terminalRecorded);}finally{await blocker.query('ROLLBACK');blocker.release();u.tx=tx;}
 const elapsedMs=performance.now()-start;assert.ok(elapsedMs>=timeoutMs*.8);assert.equal((await f.rows('attempt')).length,0);assert.equal((await f.rows('protection')).length,0);assert.equal((await f.rows('plan_rejection'))[0]!['reason'],'LOCK_TIMEOUT');
 await assert.rejects(plan(f,{inputId}),/input_terminal/);await plan(f);await evidence('L1-O3-TIMEOUT-'+timeoutMs,{configuredTimeoutMs:timeoutMs,observedElapsedMs:elapsedMs,terminalReason:'LOCK_TIMEOUT',sameInputRetryDenied:true,newCustomerRequestCanProgress:true,operatorRequired:false});
});
