// CLI-only ownership. OS socket ownership dies with the process/reboot; files are
// diagnostics, never archive custody, dispatch authority or an age-based lease.
import net from 'node:net';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
export class CommandLockError extends Error {constructor(code,message){super(message);this.code=code;}}
export async function freeLoopbackPort(){const server=net.createServer();await new Promise((r,j)=>{server.once('error',j);server.listen({host:'127.0.0.1',port:0,exclusive:true},r);});const port=server.address().port;await new Promise(r=>server.close(r));return port;}
export function commandPort(s){
 if(s.commandPort!==undefined){if(!Number.isInteger(s.commandPort)||s.commandPort<1024||s.commandPort>65535||s.commandPort===s.port||[3000,3077].includes(s.commandPort))throw Error('command_guard_port_invalid');return s.commandPort;}
 // Existing profiles have a deterministic upgrade port; no random fallback.
 let port=40000+createHash('sha256').update(s.id).digest().readUInt32BE(0)%20000;if(port===s.port)port=port===59999?40000:port+1;return port;
}
async function record(file){try{const st=await fs.lstat(file);if(st.isSymbolicLink()||!st.isFile())throw Error('unsafe_lock_path');return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw new CommandLockError('CLI_LOCK_RECOVERY_REQUIRED','Legacy or damaged .command.lock: stop candidate CLI commands, then run demo:unlock -- --confirm <instance-id> using the exact instance ID shown in state/health. No automatic deletion was attempted.');}}
function valid(m,s){return m&&m.format===1&&m.instance===s.id&&Number.isInteger(m.pid)&&m.pid>0&&typeof m.startedAt==='string'&&Number.isFinite(Date.parse(m.startedAt))&&typeof m.owner==='string'&&m.port===commandPort(s);}
async function publish(file,m){const temp=file+'.'+m.owner+'.tmp';try{await fs.writeFile(temp,JSON.stringify(m)+'\n',{flag:'wx',mode:0o600});const h=await fs.open(temp,'r');try{await h.sync();}finally{await h.close();}await fs.rename(temp,file);}finally{await fs.unlink(temp).catch(()=>{});}}
export async function locked(s,work){
 const file=path.join(s.directory,'.command.lock'),guard=net.createServer(socket=>socket.destroy());
 try{await new Promise((resolve,reject)=>{guard.once('error',reject);guard.listen({host:'127.0.0.1',port:commandPort(s),exclusive:true},resolve);});}
 catch(e){throw new CommandLockError('CLI_LOCK_BUSY','Candidate command is active, or its dedicated loopback guard port '+commandPort(s)+' is occupied. Wait for it to finish; no PID was killed and no lock was stolen.');}
 let metadata;
 try{
  const old=await record(file);
  if(old&&!valid(old,s))throw new CommandLockError('CLI_LOCK_RECOVERY_REQUIRED','Unrecognized .command.lock. Stop candidate CLI commands, then use demo:unlock -- --confirm '+s.id+'. The file is preserved.');
  metadata={format:1,pid:process.pid,instance:s.id,startedAt:new Date().toISOString(),owner:randomUUID(),port:commandPort(s)};
  // Binding the same OS guard proves a compliant previous owner has exited or
  // released it, even if a reboot reused its PID. No elapsed-time inference.
  await publish(file,metadata);return await work({recovered:old!==null,previousPid:old?.pid});
 }finally{
  if(metadata){try{const current=await record(file);if(current?.owner===metadata.owner)await fs.unlink(file);}catch{}}
  await new Promise(r=>guard.close(r));
 }
}
export async function recoverLegacyLock(s,confirmation){
 if(confirmation!==s.id)throw Error('unlock_requires_exact_instance_id');const file=path.join(s.directory,'.command.lock');
 const guard=net.createServer(socket=>socket.destroy());try{await new Promise((r,j)=>{guard.once('error',j);guard.listen({host:'127.0.0.1',port:commandPort(s),exclusive:true},r);});}catch{throw new CommandLockError('CLI_LOCK_BUSY','A candidate command guard is active; recovery refused.');}
 try{
  const st=await fs.lstat(file);if(st.isSymbolicLink()||!st.isFile())throw Error('lock_recovery_path_denied');let old;try{old=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
  if(old?.format===1)throw Error('new_cli_locks_recover_automatically');
  const saved=path.join(s.directory,'legacy-command-lock-'+randomUUID()+'.json');await fs.rename(file,saved);return {instance:s.id,recovered:true,legacyRecordRetained:true};
 }finally{await new Promise(r=>guard.close(r));}
}
