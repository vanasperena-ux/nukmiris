// Local synthetic composition boundary. Never accepts a database URL/provider mode.
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as wait} from 'node:timers/promises';
import pg from 'pg';
import {freeLoopbackPort,commandPort} from './command-lock.mjs';
import {IMAGE,docker,protect,assertPrivate,ensurePinnedImage} from './platform.mjs';
export {IMAGE,docker,protect,assertPrivate};
export const ROOT=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
export const ROLES=['ingress','sealer','reducer','dispatch','result','operator','recovery','tenant_a','tenant_b'];
const label='nukmiris.vnext.instance';
export async function privateJson(file,value){const h=await fs.open(file,'wx',0o600);let complete=false;try{await h.writeFile(JSON.stringify(value,null,2)+'\n');await h.sync();complete=true;}finally{await h.close();if(!complete)await fs.unlink(file).catch(()=>{});}}
export async function readState(directory){
 const resolved=path.resolve(directory),st=await fs.lstat(resolved);if(st.isSymbolicLink()||!st.isDirectory())throw Error('local_state_directory_denied');
 const file=path.join(resolved,'state.json');if((await fs.lstat(file)).isSymbolicLink())throw Error('local_state_symlink_denied');
 const s=JSON.parse(await fs.readFile(file,'utf8'));
 if(s.format!==1||s.mode!=='SYNTHETIC_INERT'||s.directory!==resolved||!/^([a-f0-9]{32})$/.test(s.id)||s.database!=='nukmiris_vnext_'+s.id||s.container!=='nukmiris-vnext-'+s.id||s.network!==s.container||s.volume!==s.container+'-data'||s.host!=='127.0.0.1'||!Number.isInteger(s.port)||s.port<1024||s.port>65535)throw Error('local_state_invalid');
 if(!/^[a-f0-9]{64}$/.test(s.adminPassword??'')||!/^[a-f0-9]{64}$/.test(s.controlToken??'')||ROLES.some(r=>!/^[a-f0-9]{64}$/.test(s.passwords?.['wp1_'+r]??'')))throw Error('local_credentials_missing_or_invalid');
 commandPort(s);return s;
}
export async function owned(s,kind='container'){
 const name=kind==='container'?s.container:kind==='network'?s.network:s.volume;
 const {stdout}=await docker([kind==='container'?'inspect':kind, ...(kind==='container'?[]:['inspect']),name]);
 const x=JSON.parse(stdout)[0],labels=kind==='container'?x.Config.Labels:x.Labels;
 if(labels?.[label]!==s.id||labels?.['nukmiris.vnext.scope']!=='synthetic')throw Error('local_resource_identity_mismatch');return x;
}
export function connection(s,user='postgres',database=s.database){
 if(s.host!=='127.0.0.1'||!/^nukmiris_vnext_[a-f0-9]{32}(?:_test_[a-f0-9]{8})?$/.test(database))throw Error('local_connection_denied');
 if(user!=='postgres'&&!ROLES.some(r=>user==='wp1_'+r))throw Error('local_role_denied');
 if(typeof (user==='postgres'?s.adminPassword:s.passwords?.[user])!=='string'||!(user==='postgres'?s.adminPassword:s.passwords[user]))throw Error('local_credentials_required');
 return {host:s.host,port:s.port,database,user,password:user==='postgres'?s.adminPassword:s.passwords[user],options:'-c timezone=UTC',ssl:false,connectionTimeoutMillis:3000};
}
export async function ready(s){
 const deadline=performance.now()+25000;let last;
 do{const c=new pg.Client({...connection(s),database:'postgres'});try{await c.connect();const r=(await c.query('SELECT current_setting(\'server_version\') v,current_setting(\'TimeZone\') z')).rows[0];if(!r.v.startsWith('17.11 ')||r.z!=='UTC')throw Error('fixture_version_or_utc_mismatch');return r;}catch(e){last=e;await wait(100);}finally{await c.end().catch(()=>{});}}while(performance.now()<deadline);
 throw Error('local_postgres_not_ready',{cause:last});
}
export async function initializeDatabase(s,database=s.database,active=false){
 const admin=new pg.Client({...connection(s),database:'postgres'});await admin.connect();
 try{await admin.query('CREATE DATABASE '+pg.escapeIdentifier(database));await admin.query('ALTER DATABASE '+pg.escapeIdentifier(database)+" SET TimeZone TO 'UTC'");}finally{await admin.end();}
 const db=new pg.Pool(connection(s,'postgres',database));
 try{
  for(const f of ['migrations/001-foundation.sql','migrations/002-execution.sql','migrations/003-dispositions.sql','roles.sql','migrations/004-classification-and-ordering.sql','migrations/005-conversation-progress.sql'])await db.query(await fs.readFile(path.join(ROOT,'src/infrastructure/postgres',f),'utf8'));
  for(const role of ROLES){const user='wp1_'+role;await db.query('ALTER ROLE '+pg.escapeIdentifier(user)+' PASSWORD '+pg.escapeLiteral(s.passwords[user]));}
  const routes=[],ids={};
  for(const businessId of ['synthetic-a','synthetic-b']){
   for(const role of ROLES)if(!role.startsWith('tenant_')||role==='tenant_'+businessId.at(-1))await db.query('INSERT INTO core.role_scope VALUES($1,$2)',['wp1_'+role,businessId]);
   const channel=randomUUID(),calendar=randomUUID(),resource=randomUUID(),customer=randomUUID();ids[businessId]={channel,calendar,resource,customer};
   await db.query('INSERT INTO core.business VALUES($1,$2,1,1,$3)',[businessId,active?'ACTIVE':'SUSPENDED',active]);
   await db.query('INSERT INTO core.channel VALUES($1,$2,$3,$4,1,true)',[businessId,channel,'waba-'+businessId,'number-'+businessId]);
   await db.query('INSERT INTO core.calendar VALUES($1,$2,$3,$4,1)',[businessId,calendar,'calendar-'+businessId,'synthetic-grant-'+businessId]);
   await db.query('INSERT INTO core.resource VALUES($1,$2,$3,true)',[businessId,resource,calendar]);await db.query('INSERT INTO core.customer VALUES($1,$2,$3)',[businessId,customer,'customer-'+businessId]);
   routes.push({businessId,channelId:channel,waba:'waba-'+businessId,numberId:'number-'+businessId,channelRevision:1});
  }
  return {routes,ids};
 }finally{await db.end();}
}
export async function provision(directory,{port=55432,reuseRoot=false}={},dependencies={}){
 const command=dependencies.command??docker,protectDirectory=dependencies.protect??protect;
 const resolved=path.resolve(directory);if(!Number.isInteger(port)||port<0||port>65535||(port!==0&&port<1024)||/[\n\r,]/.test(resolved)||!(path.basename(resolved)==='.local-demo'||path.basename(resolved).startsWith('nukmiris-vnext-')))throw Error('local_fixture_target_denied');
 const id=randomUUID().replaceAll('-',''),container='nukmiris-vnext-'+id;
 const s={format:1,mode:'SYNTHETIC_INERT',directory:resolved,id,container,network:container,volume:container+'-data',database:'nukmiris_vnext_'+id,host:'127.0.0.1',port,adminPassword:randomBytes(32).toString('hex'),passwords:Object.fromEntries(ROLES.map(r=>['wp1_'+r,randomBytes(32).toString('hex')])),controlToken:randomBytes(32).toString('hex')};
 let network=false,volume=false,created=false,rootCreated=false,stateWritten=false;
 try{
 if(!reuseRoot){await fs.mkdir(resolved,{mode:0o700});rootCreated=true;}else if((await fs.lstat(resolved)).isSymbolicLink()||(await fs.readdir(resolved)).includes('state.json'))throw Error('reset_root_denied');
 if(port===0)port=await freeLoopbackPort(); // Bind races fail explicitly; no fallback/identity change.

  await protectDirectory(resolved);
  if(port===0)throw Error('local_fixture_port_unresolved');
  s.port=port;s.commandPort=await freeLoopbackPort();if([s.port,3000,3077].includes(s.commandPort))throw Error('command_guard_port_collision');
  const info=await command(['info','--format','{{.OSType}}']);if(info.stdout.trim()!=='linux')throw Error('docker_linux_containers_required');
  console.error('Pulling/verifying pinned PostgreSQL image (first download budget: 10 minutes).');await ensurePinnedImage(command);
  const labels=['--label',label+'='+id,'--label','nukmiris.vnext.scope=synthetic'];
  await command(['network','create',...labels,s.network]);network=true;await command(['volume','create',...labels,s.volume]);volume=true;
  await command(['create','--name',container,...labels,'--network',s.network,'--publish',`127.0.0.1:${port||''}:5432`,'--mount',`type=volume,src=${s.volume},dst=/var/lib/postgresql/data`,
   '-e','POSTGRES_PASSWORD='+s.adminPassword,'-e','POSTGRES_HOST_AUTH_METHOD=scram-sha-256','-e','POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256',IMAGE,'-c','timezone=UTC','-c','fsync=on','-c','synchronous_commit=on']);created=true;await command(['start',s.container]);
  const inspected=await owned(s),binding=inspected.NetworkSettings.Ports['5432/tcp'];if(!binding||binding.length!==1||binding[0].HostIp!=='127.0.0.1')throw Error('local_port_binding_denied:'+JSON.stringify({state:inspected.State.Status,ports:inspected.NetworkSettings.Ports,requested:inspected.HostConfig.PortBindings}));s.port=Number(binding[0].HostPort);
  const observed=await ready(s);s.observed={serverVersion:observed.v,timeZone:observed.z};s.seed=await initializeDatabase(s);await privateJson(path.join(resolved,'state.json'),s);stateWritten=true;await assertPrivate(path.join(resolved,'state.json'));return s;
 }catch(e){if(stateWritten)await fs.unlink(path.join(resolved,'state.json')).catch(()=>{});if(created)await command(['rm','--force',s.container]).catch(()=>{});if(volume)await command(['volume','rm',s.volume]).catch(()=>{});if(network)await command(['network','rm',s.network]).catch(()=>{});if(rootCreated)await fs.rmdir(resolved).catch(()=>{});throw e;}
}
export async function startDatabase(s){await owned(s);await docker(['start',s.container]);return ready(s);}
export async function stopDatabase(s){await owned(s);await docker(['stop','--time','10',s.container]);}
export async function destroy(s){for(const kind of ['container','volume','network'])await owned(s,kind);await docker(['rm','--force',s.container]);await docker(['volume','rm',s.volume]);await docker(['network','rm',s.network]);}
export async function backupDatabase(s){
 await owned(s);const dir=path.join(s.directory,'backups',new Date().toISOString().replace(/[:.]/g,'-'));await fs.mkdir(dir,{recursive:true,mode:0o700});await protect(dir);
 const result=await docker(['exec',s.container,'pg_dump','--username=postgres','--format=custom','--dbname='+s.database],{encoding:'buffer'});const bytes=result.stdout;
 await fs.writeFile(path.join(dir,'database.dump'),bytes,{flag:'wx',mode:0o600});
 const manifest={format:1,instance:s.id,database:s.database,mode:'INERT_FIXTURE_ONLY',timezone:'UTC',image:IMAGE,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,archiveAndProviderDataPresent:false,credentialsIncluded:false};await privateJson(path.join(dir,'manifest.json'),manifest);return {directory:dir,...manifest};
}
export async function verifyBackup(s,directory){
 await owned(s);const base=path.join(s.directory,'backups')+path.sep,location=path.resolve(directory);if(!location.startsWith(base))throw Error('backup_scope_denied');
 const manifest=JSON.parse(await fs.readFile(path.join(location,'manifest.json'),'utf8')),bytes=await fs.readFile(path.join(location,'database.dump'));
 if(manifest.instance!==s.id||manifest.mode!=='INERT_FIXTURE_ONLY'||manifest.sha256!==createHash('sha256').update(bytes).digest('hex'))throw Error('backup_integrity_denied');
 const database=s.database+'_test_'+randomBytes(4).toString('hex'),dest='/tmp/nukmiris-vnext-'+randomUUID()+'.dump',admin=new pg.Client({...connection(s),database:'postgres'});await admin.connect();
 try{
  await admin.query('CREATE DATABASE '+pg.escapeIdentifier(database));await docker(['cp',path.join(location,'database.dump'),s.container+':'+dest]);await docker(['exec',s.container,'pg_restore','--username=postgres','--exit-on-error','--dbname='+database,dest]);
  const check=new pg.Client(connection(s,'postgres',database));try{await check.connect();const row=(await check.query("SELECT count(*)::int n,bool_and(status='SUSPENDED' AND NOT dispatch_enabled) inert FROM core.business")).rows[0];if(row.n!==2||!row.inert)throw Error('backup_restore_not_inert');return {result:'PASS',separateTarget:true,businesses:row.n,dispatchEnabled:false,archiveRecoveryNotClaimed:true};}finally{await check.end();}
 }finally{await admin.query('DROP DATABASE IF EXISTS '+pg.escapeIdentifier(database));await admin.end();await docker(['exec',s.container,'rm','-f',dest]).catch(()=>{});}
}
