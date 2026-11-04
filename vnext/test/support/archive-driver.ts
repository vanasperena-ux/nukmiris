import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TestContext } from 'node:test';
import type { ArchiveConfig } from '../../src/infrastructure/archive/indexed-archive.js';
import type { Checkpoint, Head } from '../../src/infrastructure/archive/protocol.js';
import type { ArchiveWorkerConfig } from './archive-worker.js';

export function archiveWorker(t:Pick<TestContext,'after'>,config:ArchiveConfig,key:string,pauseAt:string) {
  const child=fork(fileURLToPath(new URL('./archive-worker.js',import.meta.url)),[],{stdio:['ignore','ignore','pipe','ipc']});
  let exited=false,stderr='';const messages:Record<string,unknown>[]=[],waiters=new Set<()=>void>();
  child.stderr?.on('data',c=>{stderr+=String(c).slice(0,1000);});
  child.on('message',(m:Record<string,unknown>)=>{
    if(m['type']==='rpc') {
      const result=m['method']==='read'?config.witness.read():config.witness.advance(m['expected'] as Checkpoint,m['head'] as Head);
      void result.then(value=>{if(child.connected)child.send({reply:m['id'],value});},e=>{if(child.connected)child.send({reply:m['id'],error:(e as Error).message});});
    }else{messages.push(m);for(const wake of waiters)wake();}
  });
  const closed=new Promise<void>(resolve=>{child.once('exit',()=>{exited=true;for(const wake of waiters)wake();resolve();});});
  const kill=async()=>{if(!exited)child.kill('SIGKILL');await closed;};t.after(kill);
  const c:ArchiveWorkerConfig={file:config.file,archiveId:config.archiveId,publicKey:config.witnessKey.export({format:'pem',type:'spki'}).toString(),
    authenticationKey:config.authenticationKey.toString('base64'),encryptionKey:config.encryptionKeys.get('v1')!.toString('base64'),pauseAt,key};
  child.send(c);
  return {child,closed,kill,resume(){child.send({resume:pauseAt});},wait(type:string):Promise<Record<string,unknown>>{
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{waiters.delete(wake);reject(new Error('archive_worker_timeout '+stderr));},30_000);
      const wake=()=>{const m=messages.find(m=>m['type']===type);if(m){clearTimeout(timer);waiters.delete(wake);resolve(m);}else if(exited){clearTimeout(timer);waiters.delete(wake);reject(new Error('archive_worker_exited '+JSON.stringify(messages)+stderr));}};
      waiters.add(wake);wake();
    });
  }};
}
