import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir,platform,release,cpus,totalmem} from 'node:os';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {IndexedArchive} from '../dist/src/infrastructure/archive/indexed-archive.js';
import {FixtureWitness} from '../dist/test/support/archive-fixture.js';
import {archiveWorker} from '../dist/test/support/archive-driver.js';
import {capacityWorkflows} from '../dist/test/support/archive-capacity-workflow.js';

const directory=await mkdtemp(join(tmpdir(),'nukmiris-l0a-capacity-'));
const evidence=resolve('evidence/runs',new Date().toISOString().replaceAll(':','-')+'-archive-capacity');await mkdir(evidence,{recursive:true});
const witness=new FixtureWitness(join(directory,'witness.sqlite'),'synthetic-capacity');
const config={file:join(directory,'archive.sqlite'),forensicDirectory:evidence,archiveId:'synthetic-capacity',witness:witness.writer,witnessKey:witness.publicKey,
 authenticationKey:randomBytes(32),encryptionKeys:new Map([['v1',randomBytes(32)]]),activeKey:'v1',tenants:['synthetic-a','synthetic-b','ingress-custody']};
let archive=await IndexedArchive.create(config);const samples=[],start=performance.now();const cleanup=[];
console.log('Capacity evidence: '+evidence+'; raw fixture retained locally (no keys published).');
const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
try {
 let count=0;
 for(const target of [1000,10_000,100_000,1_000_000]) {
  const appendStart=performance.now();
  while(count<target) {
   const offset=count,n=Math.min(1000,target-count);
   await archive.scope('synthetic-a').ensureBatch(Array.from({length:n},(_,i)=>{
    const id=offset+i;return {key:`synthetic/${id}`,kind:['ARM','APPOINTMENT_HISTORY','PERMISSION','INPUT'][id%4],match:{businessId:'synthetic-a',originalId:`original-${id}`,revision:id,payloadDigest:'a'.repeat(64),purpose:'SYNTHETIC_ONLY'}};
   }));count+=n;
   if(count%100_000===0)console.log(JSON.stringify({progress:count,elapsedSeconds:Math.round((performance.now()-start)/1000)}));
  }
  const appendMs=performance.now()-appendStart;archive.close();archive=await IndexedArchive.open({...config,minimumCheckpoint:witness.read().value});
  const found=[],absent=[];let maxNodes=0;
  for(let i=0;i<100;i++) {
   const id=Math.floor(i*(target-1)/99),before={...archive.metrics},now=performance.now();
   const seal=await archive.scope('synthetic-a').lookup(`synthetic/${id}`);found.push(performance.now()-now);
   assert.equal(seal?.body.originalId,`original-${id}`);assert.equal(seal?.sequence,id+1);
   maxNodes=Math.max(maxNodes,archive.metrics.nodeReads-before.nodeReads);assert.equal(archive.metrics.decryptions-before.decryptions,1);
   const missBefore={...archive.metrics},missStart=performance.now();assert.equal(await archive.scope('synthetic-a').lookup(`absent/${i}`),null);absent.push(performance.now()-missStart);
   maxNodes=Math.max(maxNodes,archive.metrics.nodeReads-missBefore.nodeReads);assert.equal(archive.metrics.decryptions-missBefore.decryptions,0);
  }
  assert.equal(archive.metrics.fullAudits,0);assert.ok(maxNodes<=32);
  const size=(await stat(config.file)).size;
  const sample={records:target,appendMs:Math.round(appendMs),foundP50Ms:percentile(found,.5),foundP95Ms:percentile(found,.95),foundP99Ms:percentile(found,.99),absentP95Ms:percentile(absent,.95),maxAuthenticatedNodes:maxNodes,rootHeight:witness.read().value.head.root.height,fileBytes:size,rssBytes:process.memoryUsage().rss};
  samples.push(sample);console.log(JSON.stringify(sample));
 }
 const workflows=await capacityWorkflows(archive);console.log(JSON.stringify({workflows}));
 const expectedTail=witness.read().value.head.size+1;
 // Real process death after a durable tail beyond 1M, not a raw SQL preseed or thrown exception.
 const worker=archiveWorker({after:f=>cleanup.push(f)},config,'capacity-crash-arm','archive.afterDataCommit');
 await worker.wait('point');await worker.kill();await assert.rejects(archive.scope('synthetic-a').lookup('capacity-crash-arm'),/held/);
 archive.close();const repairStart=performance.now();
 const repaired=await IndexedArchive.repair(config,witness.beginRepair());archive=repaired.archive;
 const original=await archive.scope('synthetic-a').lookup('capacity-crash-arm');assert.ok(original?.body.ownerId);assert.equal(original.sequence,expectedTail);
 assert.deepEqual(await archive.scope('synthetic-a').ensure('capacity-crash-arm','ARM',{businessId:'synthetic-a'},()=>({ownerId:'forbidden-reallocation'})),original);
 for(const id of [0,999,9999,99_999,999_999])assert.equal((await archive.scope('synthetic-a').lookup(`synthetic/${id}`))?.body.originalId,`original-${id}`);
 const repair={records:repaired.repaired,repairMs:Math.round(performance.now()-repairStart),originalArmPreserved:true,automaticReplay:false,fenced:true,processPeakRssBytes:process.resourceUsage().maxRSS*1024};console.log(JSON.stringify({repair}));
 const db=new DatabaseSync(':memory:');const sqlite=db.prepare('SELECT sqlite_version() AS version').get().version;db.close();
 const report={result:'PASS',node:process.version,sqlite,platform:platform(),release:release(),cpus:cpus().length,totalMemoryBytes:totalmem(),samples,workflows,repair,elapsedMs:Math.round(performance.now()-start),limitations:['synthetic same-host witness; not custody gate 009','Linux SIGKILL/process-crash evidence; Windows and power-loss/filesystem guarantees unverified','latency measurements are observations, not an SLO'],rawFixturePublished:false};
 await writeFile(join(evidence,'capacity.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS capacity/repair; report '+join(evidence,'capacity.json'));
} finally {for(const f of cleanup)await f();archive.close();witness.close();}
