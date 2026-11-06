import {fork} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
export function childOptions({detached=false,stdio=['ignore','pipe','pipe','ipc']}={}){return {detached,stdio,windowsHide:true};}
export function childProcess(file,config,options={}){
 const child=fork(file,[],childOptions(options)),messages=[],listeners=new Set();let exited=false,stderr='';
 child.stderr?.on('data',x=>{stderr=(stderr+String(x)).slice(-2000);});
 child.on('message',m=>{messages.push(m);for(const f of listeners)f();});
 const closed=new Promise(resolve=>{child.once('exit',(code,signal)=>{exited=true;for(const f of listeners)f();resolve({code,signal});});});
 const message=(type,timeout=10000)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{listeners.delete(wake);reject(Error('local_child_timeout:'+type));},timeout);
  const wake=()=>{const m=messages.find(x=>x.type===type),e=messages.find(x=>x.type==='error');if(m||e||exited){clearTimeout(timer);listeners.delete(wake);if(m)resolve(m);else reject(Error('local_child_failed:'+String(e?.message??stderr)));}};listeners.add(wake);wake();
 });
 child.send(config);
 return {child,closed,message,release(point){child.send({resume:point});},detach(){child.disconnect();child.unref();},async crash(){if(!exited)child.kill();await closed;},async stop(){if(!exited&&child.connected)child.send({stop:true});for(let i=0;!exited&&i<100;i++)await wait(20);if(!exited)throw Error('local_child_stop_timeout');await closed;}};
}
