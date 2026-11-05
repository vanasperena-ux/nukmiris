// Automated ephemeral smoke only; no interactive booking endpoint or real transport.
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pg from 'pg';
import {initializeDatabase,connection,startDatabase} from './fixture.mjs';
import {UnitOfWork} from '../dist/src/infrastructure/postgres/unit-of-work.js';
import {IndexedArchive} from '../dist/src/infrastructure/archive/indexed-archive.js';
import {FixtureWitness} from '../dist/test/support/archive-fixture.js';
import {admissionCustody} from '../dist/src/application/admission-custody.js';
import {admitInput} from '../dist/src/application/admit-input.js';
import {prepareOperation,prepareOutput} from '../dist/src/application/prepare-operation.js';
import {armAttempt,dispatchOnce} from '../dist/src/application/dispatch-once.js';
import {recordResult} from '../dist/src/application/record-result.js';
import {FakeProviderServer,FakeProviderClient} from '../dist/test/support/fake-provider.js';
export async function smoke(s){
 const measured=await startDatabase(s);const database=s.database+'_test_'+randomBytes(4).toString('hex'),directory=await fs.mkdtemp(path.join(os.tmpdir(),'nukmiris-wp1-tcp-smoke-'));const roles=[];let archive,witness,server;
 const role=name=>{const r=new UnitOfWork(connection(s,'wp1_'+name,database));roles.push(r);return r;};
 try{
  const {routes,ids}=await initializeDatabase(s,database,true),b='synthetic-a',seed=ids[b],clock={now:()=>new Date()},secret=randomBytes(32);
  const ingress=role('ingress'),sealer=role('sealer'),reducer=role('reducer'),dispatcher=role('dispatch'),result=role('result');witness=new FixtureWitness(path.join(directory,'witness.sqlite'),'tcp-smoke');
  archive=await IndexedArchive.create({file:path.join(directory,'archive.sqlite'),archiveId:'tcp-smoke',witness:witness.writer,witnessKey:witness.publicKey,authenticationKey:randomBytes(32),encryptionKeys:new Map([['v1',randomBytes(32)]]),activeKey:'v1',tenants:[b,'synthetic-b','ingress-custody']});
  const store=archive.scope(b),custody=admissionCustody(archive.scope('ingress-custody'),new Map([[b,store],['synthetic-b',archive.scope('synthetic-b')]]));
  const admit=async text=>{
   const event={entry:[{id:'waba-'+b,changes:[{value:{metadata:{phone_number_id:'number-'+b},messages:[{id:randomUUID(),from:'customer-'+b,type:'text',text:{body:text}}]}}]}]};
   const raw=Buffer.from(JSON.stringify(event));return admitInput({raw,signature:'sha256='+createHmac('sha256',secret).update(raw).digest('hex'),secret,routes,ingress,sealer,reducer,custody,clock});
  };
  const startAt=new Date(Date.now()+172800000).toISOString(),endAt=new Date(Date.parse(startAt)+3600000).toISOString();
  const prepare=async()=>{const inputId=(await admit('synthetic fixed command')).inputs[0].inputId;return prepareOperation({request:{businessId:b,inputId,customerId:seed.customer,calendarId:seed.calendar,resourceId:seed.resource,startAt,endAt},reducer,sealer,archive:store,clock});};
  server=await new FakeProviderServer(path.join(directory,'provider')).start();const provider=new FakeProviderClient(server.url);
  const send=async p=>{const common={businessId:b,attemptId:p.body.attemptId,ownerId:randomUUID(),dispatcher,sealer,archive:store};if(!await armAttempt(common))throw Error('smoke_arm_denied');const r=await dispatchOnce({...common,provider,clock});if(r.state!=='APPLIED')throw Error('smoke_dispatch_'+r.state);await recordResult({proof:r.proof,result,sealer,archive:store});};
  const superseded=await prepare();await armAttempt({businessId:b,attemptId:superseded.body.attemptId,ownerId:randomUUID(),dispatcher,sealer,archive:store});await admit('menu');
  const p=await prepare();await send(p);const output=await prepareOutput({businessId:b,outputId:p.body.outputId,reducer,sealer,archive:store,clock});await send(output);
  const rows=await reducer.tx(b,async db=>(await db.query('SELECT state,count(*)::int n FROM core.appointment WHERE business_id=$1 GROUP BY state',[b])).rows);
  if(rows.find(x=>x.state==='ACTIVE')?.n!==1||rows.find(x=>x.state==='CANCELLED')?.n!==1||(await server.calls()).length!==2)throw Error('smoke_effect_count');
  const zone=await reducer.tx(b,async db=>(await db.query('SHOW TimeZone')).rows[0].TimeZone);if(zone!=='UTC')throw Error('smoke_utc_required');
  return {result:'PASS',tcp:true,timezone:zone,postgres:measured.v,c1Supersession:true,activeBookings:1,supersededNeverEntered:1,fakeProviderCalls:2,persistentDemoDatabaseMutated:false,nativeWindows:process.platform==='win32'?'EXECUTED':'NOT RUN'};
 }finally{
  await server?.close();await Promise.all(roles.map(r=>r.close()));try{archive?.close();}catch{}witness?.close();
  const admin=new pg.Client({...connection(s),database:'postgres'});try{await admin.connect();await admin.query('DROP DATABASE IF EXISTS '+pg.escapeIdentifier(database));}finally{await admin.end();await fs.rm(directory,{recursive:true,force:true});}
 }
}
