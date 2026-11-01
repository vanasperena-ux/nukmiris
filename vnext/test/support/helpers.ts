import {createHmac,randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import type {TestContext} from 'node:test';
import {Fixture} from './postgres-fixture.js';
import {admitInput} from '../../src/application/admit-input.js';
import {prepareOperation} from '../../src/application/prepare-operation.js';
import {armAttempt,dispatchOnce} from '../../src/application/dispatch-once.js';
import {recordResult} from '../../src/application/record-result.js';
import {digest,text} from '../../src/domain/protocol.js';
import type {Faults,ObjectValue} from '../../src/domain/protocol.js';
import type {Seal} from '../../src/ports.js';
import {FakeProviderServer,FakeProviderClient} from './fake-provider.js';
import {registerCleanup} from './cleanup.js';

export async function fixture(t:TestContext,seed=true,faults?:Faults):Promise<Fixture> {
  const f=new Fixture();t.after(async()=>{await f.close();});
  await f.init(seed,faults);return f;
}
export function raw(_f:Fixture,message='synthetic fixed command',b='synthetic-a',id=randomUUID(),subject='customer-'+b):Buffer {
  return Buffer.from(JSON.stringify({entry:[{id:'waba-'+b,changes:[{value:{metadata:{phone_number_id:'number-'+b},messages:[{id,from:subject,type:'text',text:{body:message}}]}}]}]}));
}
export function signature(f:Fixture,body:Buffer):string {return 'sha256='+createHmac('sha256',f.secret).update(body).digest('hex');}
export function admission(f:Fixture,body=raw(f),faults?:Faults) {
  return admitInput({raw:body,signature:signature(f,body),secret:f.secret,routes:f.routes,ingress:f.role('ingress'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock,...(faults?{faults}:{})});
}
export function cut(point:string):Faults {return {async hit(actual){if(actual===point)throw new Error('injected:'+point);}};}
export async function plan(f:Fixture,overrides:Partial<Parameters<typeof prepareOperation>[0]['request']>={},faults?:Faults):Promise<Seal> {
  const b=overrides.businessId??'synthetic-a';
  const inputId=overrides.inputId??text((await admission(f,raw(f,'synthetic fixed command',b))).inputs[0]!['inputId']);
  return prepareOperation({request:{businessId:b,inputId,customerId:f.id('customer',b),calendarId:f.id('calendar',b),resourceId:f.id('resource',b),startAt:'2030-01-02T10:00:00Z',endAt:'2030-01-02T11:00:00Z',...overrides},
    reducer:f.role('reducer'),sealer:f.role('sealer'),archive:f.archive,clock:f.clock,...(faults?{faults}:{})});
}
export async function provider(t:TestContext,f:Fixture):Promise<{server:FakeProviderServer;client:FakeProviderClient}> {
  const server=await new FakeProviderServer(path.join(f.directory,'provider-'+randomUUID())).start();t.after(async()=>{await server.close();});
  registerCleanup(f.dbname,'servers',()=>server.close());
  return {server,client:new FakeProviderClient(server.url)};
}
export async function arm(f:Fixture,p:Seal,ownerId=randomUUID()):Promise<string> {
  await armAttempt({businessId:text(p.body['businessId']),attemptId:text(p.body['attemptId']),ownerId,dispatcher:f.role('dispatch'),sealer:f.role('sealer'),archive:f.archive});return ownerId;
}
export async function apply(t:TestContext,f:Fixture,p:Seal):Promise<void> {
  const {client}=await provider(t,f),ownerId=await arm(f,p);
  const outcome=await dispatchOnce({businessId:text(p.body['businessId']),attemptId:text(p.body['attemptId']),ownerId,dispatcher:f.role('dispatch'),archive:f.archive,provider:client,clock:f.clock});
  if(outcome.state!=='APPLIED')throw new Error('fixture_expected_apply:'+outcome.state);
  await recordResult({proof:outcome.proof,result:f.role('result'),sealer:f.role('sealer'),archive:f.archive});
}
export async function grant(f:Fixture,subject='customer-synthetic-a',b='synthetic-a',expected=0,occurredAt=f.clock.now().toISOString(),evidenceId=randomUUID()):Promise<void> {
  const body={businessId:b,subject,evidenceId,expected,occurredAt,wording:'SYNTHETIC named-business reminder permission test only'},seal=await f.archive.ensure(`grant/${b}/${evidenceId}`,'GRANT',body);
  await f.role('sealer').seal(b,f.archive,seal);
  await f.role('operator').tx(b,async db=>{await db.query('SELECT core.grant_permission($1,$2,$3,$4,$5,$6,$7,$8)',[b,subject,evidenceId,seal.digest,expected,occurredAt,f.clock.now().toISOString(),seal.key]);});
}
export async function suppress(f:Fixture,b='synthetic-a',subject='customer-'+b):Promise<void> {await admission(f,raw(f,'STOP',b,randomUUID(),subject));}
export async function status(f:Fixture,value:'ACTIVE'|'SUSPENDED',expected:number,b='synthetic-a'):Promise<void> {
  const id=randomUUID(),body={businessId:b,value,expected,id},d=digest(body);
  let key='';
  if(value==='ACTIVE'){const seal=await f.archive.ensure('reactivate/'+id,'REACTIVATE',body);await f.role('sealer').seal(b,f.archive,seal);key=seal.key;}
  await f.role('operator').tx(b,async db=>{await db.query('SELECT core.set_status($1,$2,$3,$4,$5,$6)',[b,value,id,d,expected,key]);});
}
export async function evidence(id:string,data:ObjectValue):Promise<void> {
  const dir=process.env['WP1_EVIDENCE_DIRECTORY'];if(!dir)return;
  await fs.writeFile(path.join(dir,id+'.json'),JSON.stringify(data,null,2));
}
