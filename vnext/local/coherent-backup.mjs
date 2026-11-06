// Offline application writer + CLI guard are prerequisites. Same-host synthetic
// bundle only; this does not satisfy independent production custody/restore gates.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {docker,IMAGE,connection,privateJson,protect,provision,owned,destroy} from './fixture.mjs';
import {openCustody} from './custody.mjs';
import {replaceState} from './interactive-profile.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const files=['database.dump','application.json','custody/keys.json','custody/archive.sqlite','custody/witness.sqlite'];
export async function backupInteractive(s){
 await owned(s);if(await fs.stat(path.join(s.directory,'worker.json')).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}))throw Error('backup_requires_stopped_app');
 const custody=await openCustody(s);const archiveId=custody.archiveId;custody.close();
 for(const file of ['archive.sqlite','witness.sqlite']){const wal=path.join(s.directory,'custody',file+'-wal');const st=await fs.stat(wal).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(st?.size)throw Error('custody_checkpoint_required');}
 const dir=path.join(s.directory,'backups',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));await fs.mkdir(dir,{recursive:true,mode:0o700});await protect(dir);await fs.mkdir(path.join(dir,'custody'),{mode:0o700});await protect(path.join(dir,'custody'));
 try{
  const dump=await docker(['exec',s.container,'pg_dump','--username=postgres','--format=custom','--dbname='+s.database],{encoding:'buffer'});await fs.writeFile(path.join(dir,'database.dump'),dump.stdout,{flag:'wx',mode:0o600});
  for(const file of files.slice(1))await fs.writeFile(path.join(dir,file),await fs.readFile(path.join(s.directory,file)),{flag:'wx',mode:0o600});
  const entries=[];for(const file of files){const bytes=await fs.readFile(path.join(dir,file));entries.push({path:file,sha256:hash(bytes),bytes:bytes.length});}
  const manifest={format:2,scope:'L2_LOCAL_SYNTHETIC_ONLY',sourceInstance:s.id,sourceDatabase:s.database,archiveId,image:IMAGE,files:entries,sqlIncludes:'core, views, actions, replies, fake-calendar and append-only fake-ledger',writersStopped:true,restoreMustBeInert:true,containsPrivateCustodyKeys:true};await privateJson(path.join(dir,'manifest.json'),manifest);const manifestSha256=hash(await fs.readFile(path.join(dir,'manifest.json')));
  return {directory:dir,manifestSha256,coherent:true,private:true,scope:manifest.scope,restoreMustBeInert:true};
 }catch(e){await privateJson(path.join(dir,'INCOMPLETE.json'),{incomplete:true}).catch(()=>{});throw e;}
}
export async function verifyBundle(directory,expected){
 if(!/^[a-f0-9]{64}$/.test(expected??''))throw Error('restore_requires_recorded_manifest_sha256');const root=path.resolve(directory),st=await fs.lstat(root);if(st.isSymbolicLink()||!st.isDirectory())throw Error('backup_path_denied');const raw=await fs.readFile(path.join(root,'manifest.json'));if(hash(raw)!==expected)throw Error('backup_manifest_digest_mismatch');const m=JSON.parse(raw);if(m.format!==2||m.scope!=='L2_LOCAL_SYNTHETIC_ONLY'||m.image!==IMAGE||!m.writersStopped||!m.restoreMustBeInert||m.files.length!==files.length||m.files.some((e,i)=>e.path!==files[i]))throw Error('backup_manifest_denied');
 for(const file of m.files){const filename=path.join(root,file.path);if((await fs.lstat(filename)).isSymbolicLink())throw Error('backup_symlink_denied');const bytes=await fs.readFile(filename);if(hash(bytes)!==file.sha256||bytes.length!==file.bytes)throw Error('backup_file_digest_mismatch:'+file.path);}
 if(await fs.stat(path.join(root,'INCOMPLETE.json')).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}))throw Error('incomplete_backup_denied');return m;
}
export async function restoreInteractive(directory,expected,target,{port=15432}={}){
 const manifest=await verifyBundle(directory,expected);if(path.resolve(target).startsWith(path.resolve(directory)+path.sep)||path.resolve(target)===path.resolve(directory))throw Error('restore_destination_denied');
 let s;try{
  s=await provision(target,{port});s.application={format:1,mode:'L2_SYNTHETIC_ONLY',restored:true};await replaceState(s);const admin=new pg.Client({...connection(s),database:'postgres'});await admin.connect();try{await admin.query('DROP DATABASE '+pg.escapeIdentifier(s.database));await admin.query('CREATE DATABASE '+pg.escapeIdentifier(s.database));}finally{await admin.end();}
  const remote='/tmp/local-'+randomUUID()+'.dump';try{await docker(['cp',path.join(path.resolve(directory),'database.dump'),s.container+':'+remote]);await docker(['exec',s.container,'pg_restore','--username=postgres','--exit-on-error','--dbname='+s.database,remote]);}finally{await docker(['exec',s.container,'rm','-f',remote]).catch(()=>{});}
  const db=new pg.Client(connection(s));await db.connect();try{await db.query("UPDATE core.business SET status='SUSPENDED',dispatch_enabled=false,revision=revision+1,recovery_epoch=recovery_epoch+1");const row=(await db.query("SELECT bool_and(status='SUSPENDED' AND NOT dispatch_enabled) inert FROM core.business")).rows[0];if(!row.inert)throw Error('restore_not_inert');}finally{await db.end();}
  await fs.mkdir(path.join(s.directory,'custody'),{mode:0o700});await protect(path.join(s.directory,'custody'));for(const file of files.slice(1))await fs.writeFile(path.join(s.directory,file),await fs.readFile(path.join(directory,file)),{flag:'wx',mode:0o600});
  const custody=await openCustody(s);if(custody.archiveId!==manifest.archiveId)throw Error('restore_archive_identity_mismatch');custody.close();s.application={format:1,mode:'L2_SYNTHETIC_ONLY',restored:true};await replaceState(s);
  return {instance:s.id,directory:s.directory,coherentRestoreVerified:true,mode:'SYNTHETIC_INERT',dispatchEnabled:false,archiveAuthenticated:true,ledgerRestored:true,automaticActivation:false};
 }catch(e){if(s)await destroy(s).catch(()=>{});throw e;}
}
