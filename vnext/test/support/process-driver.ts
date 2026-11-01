import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import type {TestContext} from 'node:test';
import type {WorkerConfig} from './worker-process.js';
import {registerCleanup} from './cleanup.js';

export function worker(t:TestContext,config:WorkerConfig) {
  const child=fork(fileURLToPath(new URL('./worker-process.js',import.meta.url)),[],{stdio:['ignore','pipe','pipe','ipc']});
  const messages:Record<string,unknown>[]=[],waiters=new Set<()=>void>();let exited=false,stderr='';
  child.stderr?.on('data',chunk=>{stderr+=String(chunk).slice(0,4000);});
  child.on('message',message=>{messages.push(message as Record<string,unknown>);for(const wake of waiters)wake();});
  const closed=new Promise<void>(resolve=>{child.once('exit',()=>{exited=true;for(const wake of waiters)wake();resolve();});});
  registerCleanup(config.database,'workers',async()=>{if(!exited)child.kill('SIGKILL');await closed;});
  async function wait(type:string,point?:string):Promise<Record<string,unknown>> {
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{waiters.delete(wake);reject(new Error(`worker timeout ${type}/${point}: ${stderr}`));},10000);
      const wake=()=>{
        const message=messages.find(m=>m['type']===type&&(point===undefined||m['point']===point));
        const error=messages.find(m=>m['type']==='error');
        if(message){clearTimeout(timer);waiters.delete(wake);resolve(message);}
        else if(error||exited){clearTimeout(timer);waiters.delete(wake);reject(new Error('worker exited: '+JSON.stringify(error)+stderr));}
      };waiters.add(wake);wake();
    });
  }
  t.after(async()=>{if(!exited)child.kill('SIGKILL');await closed;});
  child.send(config);
  return {child,closed,wait,async kill(){child.kill('SIGKILL');await closed;},resume(point:string){child.kill('SIGCONT');child.send({resume:point});}};
}
