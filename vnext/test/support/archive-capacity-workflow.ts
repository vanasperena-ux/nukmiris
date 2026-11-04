import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { startCluster, Fixture } from './postgres-fixture.js';
import { raw, signature } from './helpers.js';
import { FakeProviderServer, FakeProviderClient } from './fake-provider.js';
import { admitInput } from '../../src/application/admit-input.js';
import { prepareOperation } from '../../src/application/prepare-operation.js';
import { armAttempt, dispatchOnce } from '../../src/application/dispatch-once.js';
import { recordResult } from '../../src/application/record-result.js';
import { text } from '../../src/domain/protocol.js';
import type { IndexedArchive } from '../../src/infrastructure/archive/indexed-archive.js';

/** Real guarded PG admission/dispatch at the capacity corpus, against loopback fake only. */
export async function capacityWorkflows(indexed:IndexedArchive) {
  const cluster=await startCluster(),f=new Fixture(cluster.socket),admissionMs:number[]=[],dispatchMs:number[]=[];
  let server:FakeProviderServer|undefined;
  try {
    await f.init();server=await new FakeProviderServer(join(f.directory,'capacity-provider')).start();const client=new FakeProviderClient(server.url),archive=indexed.scope('synthetic-a');
    for(let i=0;i<12;i++) {
      // Independent customers keep this a dispatch-capacity probe. It must not
      // bypass an unresolved prior conversation output to manufacture progress.
      const customerId=randomUUID(),subject='capacity-customer-'+i;
      await f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',['synthetic-a',customerId,subject]);
      const body=raw(f,'synthetic fixed command','synthetic-a',randomUUID(),subject),start=performance.now();
      const admitted=await admitInput({raw:body,signature:signature(f,body),secret:f.secret,routes:f.routes,ingress:f.role('ingress'),sealer:f.role('sealer'),archive,clock:f.clock});
      admissionMs.push(performance.now()-start);
      const startAt=new Date(Date.parse('2030-01-02T10:00:00Z')+i*7_200_000).toISOString(),endAt=new Date(Date.parse(startAt)+3_600_000).toISOString();
      const p=await prepareOperation({request:{businessId:'synthetic-a',inputId:text(admitted.inputs[0]!['inputId']),customerId,calendarId:f.id('calendar'),resourceId:f.id('resource'),startAt,endAt},reducer:f.role('reducer'),sealer:f.role('sealer'),archive,clock:f.clock});
      const common={businessId:'synthetic-a',attemptId:text(p.body['attemptId']),ownerId:randomUUID(),dispatcher:f.role('dispatch'),archive};
      assert.equal(await armAttempt({...common,sealer:f.role('sealer')}),true);
      const outcomes=await Promise.all([0,1].map(async()=>{const now=performance.now();const result=await dispatchOnce({...common,provider:client,clock:f.clock});dispatchMs.push(performance.now()-now);return result;}));
      assert.equal(outcomes.filter(o=>o.state==='HELD').length,1);const applied=outcomes.find(o=>o.state==='APPLIED');assert.equal(applied?.state,'APPLIED');
      if(applied?.state!=='APPLIED')throw new Error('expected_applied');
      await recordResult({proof:applied.proof,result:f.role('result'),sealer:f.role('sealer'),archive});
    }
    assert.equal((await server.calls()).length,12);assert.equal((await f.rows('appointment')).length,12);assert.equal(indexed.metrics.fullAudits,0);
    const distribution=(a:number[])=>{const ordered=[...a].sort((a,b)=>a-b);return {samples:a,p50:ordered[Math.floor(a.length*.5)],p95:ordered[Math.floor(a.length*.95)],p99:ordered[Math.min(a.length-1,Math.floor(a.length*.99))]};};
    return {postgres:cluster.version,admissionMs:distribution(admissionMs),dispatchMs:distribution(dispatchMs),concurrentDispatchers:2,attempts:12,providerInvocations:12,fullArchiveScans:0};
  }finally{await server?.close();await f.close();await cluster.stop();}
}
