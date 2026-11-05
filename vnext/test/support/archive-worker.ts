import { createPublicKey, randomUUID } from 'node:crypto';
import { IndexedArchive } from '../../src/infrastructure/archive/indexed-archive.js';
import type { Checkpoint, Head, SignedCheckpoint } from '../../src/infrastructure/archive/protocol.js';

export interface ArchiveWorkerConfig {
  file:string; archiveId:string; publicKey:string; authenticationKey:string; encryptionKey:string;
  pauseAt:string; key:string;
}
let serial=0;
function rpc(method:'read'|'advance',expected?:Checkpoint,head?:Head):Promise<SignedCheckpoint> {
  const id=++serial;
  return new Promise((resolve,reject)=>{
    const listener=(m:Record<string,unknown>)=>{if(m['reply']===id){process.off('message',listener);if(m['error'])reject(new Error(String(m['error'])));else resolve(m['value'] as SignedCheckpoint);}};
    process.on('message',listener);process.send?.({type:'rpc',id,method,expected,head});
  });
}
async function pause(point:string,expected:string):Promise<void> {
  if(point!==expected)return;
  process.send?.({type:'point',point});
  await new Promise<void>(resolve=>{const listener=(m:Record<string,unknown>)=>{if(m['resume']===point){process.off('message',listener);resolve();}};process.on('message',listener);});
}
process.once('message',(c:ArchiveWorkerConfig)=>{void(async()=>{
  let archive:IndexedArchive|undefined;
  try {
    archive=await IndexedArchive.open({file:c.file,archiveId:c.archiveId,witnessKey:createPublicKey(c.publicKey),
      witness:{read:()=>rpc('read'),advance:(expected,head)=>rpc('advance',expected,head)},
      authenticationKey:Buffer.from(c.authenticationKey,'base64'),encryptionKeys:new Map([['v1',Buffer.from(c.encryptionKey,'base64')]]),activeKey:'v1',tenants:['synthetic-a'],
      faults:{hit:p=>pause(p,c.pauseAt)}});
    await pause('worker.ready',c.pauseAt);
    const seal=await archive.scope('synthetic-a').ensure(c.key,'ARM',{businessId:'synthetic-a'},()=>({ownerId:randomUUID()}));
    process.send?.({type:'done',seal});
  }catch(e){process.send?.({type:'failed',message:(e as Error).message});}
  finally{archive?.close();process.disconnect();}
})().catch(()=>{process.exitCode=1;process.disconnect();});});
