import type {TestContext} from 'node:test';
import {randomUUID} from 'node:crypto';
import {fixture,raw,signature,provider} from './helpers.js';
import {archiveFixture} from './archive-fixture.js';
import {fixtureCustody} from './custody.js';
import {admitInput} from '../../src/application/admit-input.js';
import {prepareOperation,prepareOutput} from '../../src/application/prepare-operation.js';
import {armAttempt,dispatchOnce} from '../../src/application/dispatch-once.js';
import {recordResult} from '../../src/application/record-result.js';
import {text} from '../../src/domain/protocol.js';
import type {Seal} from '../../src/ports.js';
export async function l0b(t:TestContext){
 const f=await fixture(t),a=await archiveFixture(t),archive=a.scope,custody=fixtureCustody(a.archive);
 const admit=(message='synthetic fixed command',b='synthetic-a',id=randomUUID(),subject='customer-'+b)=>{
  const body=raw(f,message,b,id,subject);return admitInput({raw:body,signature:signature(f,body),secret:f.secret,routes:f.routes,ingress:f.role('ingress'),sealer:f.role('sealer'),reducer:f.role('reducer'),custody,clock:f.clock});
 };
 const prepare=(inputId:string,extra:Partial<Parameters<typeof prepareOperation>[0]['request']>={})=>prepareOperation({request:{businessId:'synthetic-a',inputId,customerId:f.id('customer'),calendarId:f.id('calendar'),resourceId:f.id('resource'),startAt:'2030-01-02T10:00:00Z',endAt:'2030-01-02T11:00:00Z',...extra},reducer:f.role('reducer'),sealer:f.role('sealer'),archive,clock:f.clock});
 const fake=await provider(t,f);
 const dispatch=async(p:Seal)=>{
  const common={businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId:randomUUID(),dispatcher:f.role('dispatch'),archive};
  if(!await armAttempt({...common,sealer:f.role('sealer')}))throw new Error('expected_arm');
  const out=await dispatchOnce({...common,provider:fake.client,clock:f.clock});if(out.state==='APPLIED')await recordResult({proof:out.proof,result:f.role('result'),sealer:f.role('sealer'),archive});return {out,common};
 };
 const finish=async(p:Seal,withOutput=true)=>{
  const r=await dispatch(p);if(r.out.state!=='APPLIED')throw new Error('expected_applied:'+r.out.state);
  if(withOutput){const o=await prepareOutput({businessId:'synthetic-a',outputId:text(p.body['outputId']),reducer:f.role('reducer'),sealer:f.role('sealer'),archive,clock:f.clock});const sent=await dispatch(o);if(sent.out.state!=='APPLIED')throw new Error('expected_confirmation');}
 };
 return {f,a,archive,custody,admit,prepare,dispatch,finish,...fake};
}
