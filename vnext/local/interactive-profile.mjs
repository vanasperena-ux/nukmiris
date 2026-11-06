import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {connection,privateJson,startDatabase} from './fixture.mjs';
import {openCustody} from './custody.mjs';
import {UnitOfWork} from '../dist/src/infrastructure/postgres/unit-of-work.js';
import {InteractiveBooking} from '../dist/src/application/interactive-booking.js';
export async function replaceState(s){const temp=path.join(s.directory,'state-'+randomUUID()+'.tmp');await privateJson(temp,s);await fs.rename(temp,path.join(s.directory,'state.json'));}
export async function enableInteractive(s){
 if(s.application?.restored)throw Error('restored_profile_is_inert_no_activation');
 if(s.port>=49152||s.commandPort>=49152)throw Error('W8_fresh_low_port_profile_required');
 await startDatabase(s);const admin=new pg.Client(connection(s));await admin.connect();let profile;
 try{
  if(!(await admin.query("SELECT to_regclass('core.local_session') v")).rows[0].v)throw Error('fresh_L2_checkout_profile_required');
  try{profile=JSON.parse(await fs.readFile(path.join(s.directory,'application.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;
   const hours=Object.fromEntries([1,2,3,4,5,6].map(d=>[d,[{start:'09:00',end:'17:00'}]]));
   profile={format:1,scopes:['synthetic-a','synthetic-b'].map(b=>({businessId:b,title:b==='synthetic-a'?"Juanita’s Nail Salon":"Bernard’s Grooming Salon",channelId:s.seed.ids[b].channel,calendarId:s.seed.ids[b].calendar,employees:[{id:s.seed.ids[b].resource,name:b==='synthetic-a'?'Lucía':'Alex'},{id:randomUUID(),name:b==='synthetic-a'?'Sofía':'Bruno'}],config:{businessId:b,calendarId:'calendar-'+b,timeZone:'America/Mexico_City',hours,breaks:{},startIntervalMinutes:30,service:{id:'implicit-p0',durationMinutes:60,bufferMinutes:15},employees:[]}}))};
   for(const p of profile.scopes)p.config.employees=p.employees.map(e=>({id:e.id,serviceIds:['implicit-p0'],hours,absences:[]}));
   await privateJson(path.join(s.directory,'application.json'),profile);
  }
  try{await fs.access(path.join(s.directory,'custody'));const c=await openCustody(s);c.close();}catch(e){if(e.code!=='ENOENT')throw e;const c=await openCustody(s,{create:true});c.close();}
  await admin.query('BEGIN');
  for(const p of profile.scopes){await admin.query('INSERT INTO core.resource VALUES($1,$2,$3,false) ON CONFLICT DO NOTHING',[p.businessId,p.employees[1].id,p.calendarId]);await admin.query('INSERT INTO core.local_customer VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[p.businessId,s.seed.ids[p.businessId].customer,'Ana Ejemplo']);}
  await admin.query("UPDATE core.business SET status='ACTIVE',dispatch_enabled=true");await admin.query('COMMIT');
  s.application={format:1,mode:'L2_SYNTHETIC_ONLY',restored:false,uiToken:s.application?.uiToken??randomBytes(32).toString('hex')};await replaceState(s);return s;
 }catch(e){await admin.query('ROLLBACK').catch(()=>{});throw e;}finally{await admin.end();}
}
export async function openInteractive(s){
 if(s.application?.mode!=='L2_SYNTHETIC_ONLY'||s.application.restored)throw Error('interactive_activation_required');
 const profile=JSON.parse(await fs.readFile(path.join(s.directory,'application.json'),'utf8'));if(profile.format!==1)throw Error('local_profile_schema');const custody=await openCustody(s),roles=new Map();
 const role=n=>{if(!roles.has(n))roles.set(n,new UnitOfWork(connection(s,'wp1_'+n)));return roles.get(n);};
 try{const scopes=profile.scopes.map(p=>({config:p.config,bindings:{businessId:p.businessId,calendar:{id:p.config.calendarId,coreId:p.calendarId},employees:new Map(p.employees.map(e=>[e.id,e.id]))},channelId:p.channelId,employeeNames:new Map(p.employees.map(e=>[e.id,e.name])),archive:custody.archive.scope(p.businessId),ingress:role('ingress'),sealer:role('sealer'),reducer:role('reducer'),dispatcher:role('dispatch'),result:role('result')}));
  const app=new InteractiveBooking(scopes);return {app,profile,async close(){await app.stop();await Promise.all([...roles.values()].map(r=>r.close()));custody.close();}};
 }catch(e){await Promise.all([...roles.values()].map(r=>r.close()));custody.close();throw e;}
}
