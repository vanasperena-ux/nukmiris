import http from 'node:http';
import {promises as fs,openSync,closeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {readState,provision,owned,startDatabase,stopDatabase,backupDatabase,destroy} from './fixture.mjs';
import {childProcess} from './child.mjs';
export async function request(s,w,action='health'){
 if(w.instance!==s.id||!Number.isInteger(w.port)||w.port<1024||w.port>65535)throw Error('worker_identity_invalid');
 return new Promise((resolve,reject)=>{
  const r=http.request({host:'127.0.0.1',port:w.port,path:'/'+action,method:action==='health'?'GET':'POST',headers:action==='health'?{}:{'x-nukmiris-control':s.controlToken},timeout:2000},response=>{let body='';response.on('data',x=>{body+=x;if(body.length>8192)r.destroy(Error('control_response_oversized'));});response.on('end',()=>{try{const result=JSON.parse(body);if(response.statusCode!==200||result.instance!==s.id)throw Error('worker_identity_mismatch');resolve(result);}catch(e){reject(e);}});});r.on('timeout',()=>r.destroy(Error('control_deadline')));r.on('error',reject);r.end();
 });
}
export async function workerState(s){try{return JSON.parse(await fs.readFile(path.join(s.directory,'worker.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function start(s,port=3077){
 if(!Number.isInteger(port)||port<0||port>65535||(port&&port<1024))throw Error('runtime_port_invalid');await startDatabase(s);
 const prior=await workerState(s);if(prior){try{return await request(s,prior);}catch(e){if(e.code!=='ECONNREFUSED')throw e;await fs.unlink(path.join(s.directory,'worker.json'));}}
 const log=openSync(path.join(s.directory,'worker.log'),'a',0o600),worker=childProcess(fileURLToPath(new URL('./health-worker.mjs',import.meta.url)),{directory:s.directory,port},{detached:true,stdio:['ignore',log,log,'ipc']});closeSync(log);
 try{const ready=await worker.message('ready');await fs.writeFile(path.join(s.directory,'worker.json'),JSON.stringify(ready),{flag:'wx',mode:0o600});worker.detach();return await request(s,ready);}catch(e){await worker.crash();throw e;}
}
export async function stopWorker(s){const w=await workerState(s);if(!w)return;try{await request(s,w,'stop');}catch(e){if(e.code!=='ECONNREFUSED')throw e;await fs.unlink(path.join(s.directory,'worker.json'));return;}for(let i=0;i<100;i++){if(!await workerState(s))return;await wait(20);}throw Error('worker_stop_held');}
export async function stop(s){await stopWorker(s);await stopDatabase(s);return {instance:s.id,stopped:true};}
export async function backup(s){await stopWorker(s);await startDatabase(s);return backupDatabase(s);}
export async function reset(s,confirmation){
 if(confirmation!==s.id)throw Error('reset_requires_exact_instance_id');await backup(s);await stop(s);await destroy(s);
 const previous=path.join(s.directory,'previous-'+s.id);await fs.mkdir(previous,{mode:0o700});await fs.rename(path.join(s.directory,'state.json'),path.join(previous,'state.json'));
 // Keep previous diagnostics/backups private and use a new directory/identity.
 const fresh=await provision(s.directory,{port:s.port,reuseRoot:true});return {reset:true,previousInstance:s.id,instance:fresh.id,database:fresh.database,backupsRetained:true,mode:fresh.mode};
}
export async function locked(directory,work){const lock=path.join(directory,'.command.lock');const handle=await fs.open(lock,'wx',0o600);try{return await work();}finally{await handle.close();await fs.unlink(lock);}}
export {readState,provision,owned};
