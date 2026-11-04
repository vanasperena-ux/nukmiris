import {UnitOfWork} from '../../src/infrastructure/postgres/unit-of-work.js';
import {FakeArchive} from './fake-archive.js';
import {FakeProviderClient} from './fake-provider.js';
import {armAttempt,dispatchOnce} from '../../src/application/dispatch-once.js';
import {recordResult} from '../../src/application/record-result.js';
import {admitInput} from '../../src/application/admit-input.js';
import type {Route} from '../../src/application/admit-input.js';
import type {Faults} from '../../src/domain/protocol.js';

export interface WorkerConfig {
  mode:'dispatch'|'admit'; socket:string; database:string; archive:string;
  businessId:string; attemptId:string; ownerId:string; providerUrl:string; now:string;
  pauseAt:string; raw?:string; signature?:string; secret?:string; routes?:Route[];
}
async function checkpoint(point:string,pauseAt:string):Promise<void> {
  if(point!==pauseAt)return;
  process.send?.({type:'point',point});
  await new Promise<void>(resolve=>{
    const listener=(message:unknown)=>{if((message as {resume?:unknown}).resume===point){process.off('message',listener);resolve();}};
    process.on('message',listener);
  });
}
process.once('message',(config:WorkerConfig)=>{void(async()=>{
  const roles:UnitOfWork[]=[];
  const role=(name:string)=>{const u=new UnitOfWork({host:config.socket,database:config.database,user:'wp1_'+name});roles.push(u);return u;};
  try {
    const archive=new FakeArchive(config.archive),sealer=role('sealer');
    const clock={now:()=>new Date(config.now)},faults:Faults={hit:p=>checkpoint(p,config.pauseAt)};
    if(config.mode==='admit') {
      const result=await admitInput({raw:Buffer.from(config.raw!,'base64'),signature:config.signature!,secret:Buffer.from(config.secret!,'base64'),routes:config.routes!,
        ingress:role('ingress'),sealer,archive,clock,faults});process.send?.({type:'done',result});
    } else {
      const dispatcher=role('dispatch');
      const common={businessId:config.businessId,attemptId:config.attemptId,ownerId:config.ownerId,dispatcher,archive};
      await checkpoint('worker.beforeArm',config.pauseAt);
      const armed=await armAttempt({...common,sealer});
      if(!armed){process.send?.({type:'done',result:{state:'HELD'}});return;}
      await checkpoint('worker.afterArm',config.pauseAt);
      const result=await dispatchOnce({...common,provider:new FakeProviderClient(config.providerUrl),clock,faults});
      if(result.state==='APPLIED')await recordResult({proof:result.proof,result:role('result'),sealer,archive});
      await checkpoint('worker.afterResult',config.pauseAt);process.send?.({type:'done',result});
    }
  } catch(error){process.send?.({type:'error',message:(error as Error).message});process.exitCode=1;}
  finally {await Promise.all(roles.map(u=>u.close()));process.disconnect();}
})().catch(error=>{process.send?.({type:'error',message:String(error)});process.exitCode=1;process.disconnect();});});
