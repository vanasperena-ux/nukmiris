// Disposable owner acceptance fixture. Never imports, clones or upgrades .local-demo.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DateTime} from 'luxon';
import pg from 'pg';
import {provision,readState,connection,privateJson,destroy} from './fixture.mjs';
import {enableInteractive,replaceState} from './interactive-profile.mjs';
import {start,stop,reset,locked} from './runtime.mjs';

export const CAPACITY_KIND='NM040_042_DISPOSABLE_V1';
export const PERSONAS=['known','new','new2','new3'];
export const subjectFor=(persona,b)=>['customer-','new-','new2-','new3-'][PERSONAS.indexOf(persona)]+b;

export async function capacityPath(directory){
 const resolved=path.resolve(directory);
 if(!/^nukmiris-vnext-capacity-[a-z0-9-]+$/i.test(path.basename(resolved))||resolved.split(path.sep).some(x=>x.toLowerCase()==='.local-demo'))throw Error('capacity_disposable_path_required');
 // Refuse symlinks/junctions at every existing ancestor, including missing-leaf setup.
 for(let p=resolved;;p=path.dirname(p)){
  try{const st=await fs.lstat(p);if(st.isSymbolicLink()||!st.isDirectory())throw Error('capacity_path_link_or_file_denied');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(path.dirname(p)===p)break;
 }
 return resolved;
}
export function assertCapacity(s){
 const f=s.capacityFixture;
 if(!f||f.kind!==CAPACITY_KIND||f.format!==1||f.instance!==s.id||s.application?.restored||!s.application||!/^nukmiris-vnext-capacity-/i.test(path.basename(s.directory))||s.directory.split(path.sep).some(x=>x.toLowerCase()==='.local-demo'))throw Error('capacity_profile_marker_required');
 if(!Number.isInteger(f.uiPort)||f.uiPort<1024||f.uiPort>=49152||s.port>=49152||s.commandPort>=49152||new Set([s.port,s.commandPort,f.uiPort]).size!==3)throw Error('capacity_distinct_low_ports_required');
 return f;
}
export async function readCapacity(directory){const s=await readState(await capacityPath(directory));assertCapacity(s);return s;}

async function configure(s,uiPort){
 await enableInteractive(s);
 const profile=JSON.parse(await fs.readFile(path.join(s.directory,'application.json'),'utf8'));
 const zone='America/Mexico_City';let day=DateTime.now().setZone(zone).startOf('day').plus({days:1});if(day.weekday===7)day=day.plus({days:1});
 const hours={[day.weekday]:[{start:'09:00',end:'17:00'}]},startAt=day.set({hour:9});
 const db=new pg.Client(connection(s));await db.connect();
 try{
  // This runs only after exclusive fresh provisioning/reset, before any admission.
  await db.query('BEGIN');
  if(Number((await db.query('SELECT count(*) n FROM core.input')).rows[0].n)!==0)throw Error('capacity_setup_requires_empty_inputs');
  for(const p of profile.scopes){
   p.title=p.businessId==='synthetic-a'?'CAPACIDAD · Negocio A':'CONTROL AISLADO · Negocio B';
   p.config.hours=hours;p.config.breaks={};p.config.employees=p.employees.map(e=>({id:e.id,serviceIds:[p.config.service.id],hours,absences:[]}));
   for(const [i,persona] of PERSONAS.entries()){
    const subject=subjectFor(persona,p.businessId);let id=(await db.query('SELECT id FROM core.customer WHERE business_id=$1 AND subject=$2',[p.businessId,subject])).rows[0]?.id;
    if(!id){id=randomUUID();await db.query('INSERT INTO core.customer VALUES($1,$2,$3)',[p.businessId,id,subject]);}
    await db.query('INSERT INTO core.local_customer VALUES($1,$2,$3) ON CONFLICT(business_id,customer_id) DO UPDATE SET name=excluded.name',[p.businessId,id,'Cliente '+(i+1)+' · capacidad']);
   }
  }
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
 const temp=path.join(s.directory,'capacity-application-'+randomUUID()+'.tmp');await privateJson(temp,profile);await fs.rename(temp,path.join(s.directory,'application.json'));
 s.capacityFixture={format:1,kind:CAPACITY_KIND,instance:s.id,uiPort,timeZone:zone,day:day.toISODate(),startAt:startAt.toUTC().toISO(),endAt:startAt.plus({minutes:60}).toUTC().toISO(),protectedUntil:startAt.plus({minutes:75}).toUTC().toISO(),durationMinutes:60,bufferMinutes:15,clock:'REAL_DATABASE_TIME',ownerBrowserAcceptance:'PENDING'};
 assertCapacity(s);await replaceState(s);return s;
}
export async function prepareCapacity(directory,{dbPort=15442,uiPort=3087}={}){
 directory=await capacityPath(directory);
 if(!Number.isInteger(dbPort)||dbPort<1024||dbPort>=49152||!Number.isInteger(uiPort)||uiPort<1024||uiPort>=49152||dbPort===uiPort||[15432,3077,3000].some(p=>[dbPort,uiPort].includes(p)))throw Error('capacity_separate_low_ports_required');
 // provision uses exclusive mkdir. Existing directories/profiles are never adopted.
 const s=await provision(directory,{port:dbPort});
 try{return await locked(s,()=>configure(s,uiPort));}
 catch(e){try{await stop(s);await destroy(s);await fs.rm(directory,{recursive:true});}catch{/* Retain private failed fixture if ownership-safe cleanup cannot complete. */}throw e;}
}
export async function startCapacity(s){const f=assertCapacity(s);const r=await start(s,f.uiPort);if(new URL(r.url).port!==String(f.uiPort))throw Error('capacity_worker_port_mismatch');return {...r,fixture:CAPACITY_KIND,directory:s.directory,database:s.database,dbPort:s.port,commandPort:s.commandPort,target:f,warning:'DISPOSABLE ONLY — never use .local-demo; private URL; owner acceptance pending'};}
export async function resetCapacity(s,confirmation){
 const f=assertCapacity(s);if(confirmation!==s.id)throw Error('capacity_reset_requires_exact_instance_id');
 const result=await reset(s,confirmation),fresh=await readState(s.directory);await configure(fresh,f.uiPort);
 return {...result,fixture:CAPACITY_KIND,directory:s.directory,stopped:true,backupAndPreviousStateRetained:true};
}

/** Read-only, repeatable tenant-scoped backend evidence. No booking/repair bypass. */
export async function capacityReport(s,businessId){
 const f=assertCapacity(s);if(!['synthetic-a','synthetic-b'].includes(businessId))throw Error('capacity_tenant_denied');
 const db=new pg.Client(connection(s,'wp1_reducer'));await db.connect();
 try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SELECT set_config('wp1.business_id',$1,true)",[businessId]);
  const appointments=(await db.query(`SELECT a.id,a.state,a.resource_id,a.start_at,a.end_at,a.buffer_minutes,c.subject,
   a.end_at+a.buffer_minutes*interval '1 minute' AS protected_until
   FROM core.appointment a JOIN core.customer c ON c.business_id=a.business_id AND c.id=a.customer_id WHERE a.business_id=$1 ORDER BY a.start_at,a.id`,[businessId])).rows;
  const calendar=(await db.query('SELECT * FROM core.local_calendar WHERE business_id=$1 ORDER BY start_at,id',[businessId])).rows;
  const protections=(await db.query('SELECT appointment_id,operation_id,resource_id,lower(protected_range) AS start_at,upper(protected_range) AS protected_until,lower_inc(protected_range) AS lower_inclusive,upper_inc(protected_range) AS upper_inclusive FROM core.protection WHERE business_id=$1 ORDER BY appointment_id',[businessId])).rows;
  const attempts=(await db.query(`SELECT a.envelope->>'recipient' AS subject,a.state,(a.operation_id IS NOT NULL) AS booking,count(*)::int AS n FROM core.attempt a
   WHERE a.business_id=$1 GROUP BY a.envelope->>'recipient',a.state,(a.operation_id IS NOT NULL)`,[businessId])).rows;
  const count=async(table,extra='')=>Number((await db.query('SELECT count(*)::int n FROM core.'+table+' WHERE business_id=$1 '+extra,[businessId])).rows[0].n);
  const counts={appointments:await count('appointment'),activeAppointments:await count('appointment',"AND state='ACTIVE'"),operations:await count('operation'),attempts:await count('attempt'),protections:await count('protection'),guards:await count('mutation_guard'),bookingIntents:await count('local_booking_intent'),coreLedger:await count('local_ledger',"AND kind='CORE'"),pendingAttempts:await count('attempt',"AND state NOT IN ('VERIFIED_APPLIED','ABANDONED')"),pendingInputs:await count('local_message',"AND state<>'DONE'")};
  // Retrieve the first actual delivered Customer4 target offer from original durable rows.
  const offered=(await db.query(`SELECT a.id AS "actionId",a.reply_id AS "replyId",a.revision,a.expires_at AS "expiresAt",a.consumed_by AS "consumedBy",a.value,m.result->'state'->'oracle' AS oracle
   FROM core.local_action a JOIN core.local_reply r ON r.business_id=a.business_id AND r.id=a.reply_id
   JOIN core.input i ON i.business_id=r.business_id AND i.id=r.input_id JOIN core.local_message m ON m.business_id=i.business_id AND m.input_id=i.id
   WHERE a.business_id=$1 AND i.subject=$2 AND r.state='DELIVERED' AND r.payload->>'outcome'='OFFER' AND a.value LIKE '%:slot:%' ORDER BY i.sequence,a.value`,[businessId,subjectFor('new3',businessId)])).rows;
  let savedOffer=null;for(const row of offered){const slot=row.oracle?.slots?.[Number(row.value.split(':').at(-1))];if(slot&&Date.parse(slot.startAt)===Date.parse(f.startAt)){const {oracle,value,...saved}=row;savedOffer={...saved,slot};break;}}
  const staleInputs=savedOffer?(await db.query(`SELECT i.id,m.state,coalesce(r.payload,o.payload) AS reply FROM core.local_message m JOIN core.input i ON i.business_id=m.business_id AND i.id=m.input_id
   LEFT JOIN core.local_reply r ON r.business_id=i.business_id AND r.input_id=i.id LEFT JOIN core.output_intent o ON o.business_id=i.business_id AND o.input_id=i.id
   WHERE m.business_id=$1 AND i.subject=$2 AND m.payload->>'kind'='ACTION' AND m.payload->>'value'=$3 ORDER BY i.sequence`,[businessId,subjectFor('new3',businessId),savedOffer.actionId])).rows:[];
  const currentOffers=(await db.query(`SELECT c.subject,s.state FROM core.local_session s JOIN core.conversation c ON c.business_id=s.business_id AND c.id=s.conversation_id WHERE s.business_id=$1`,[businessId])).rows.map(r=>({subject:r.subject,outcome:r.state.outcome,slots:(r.state.view?.choices??[]).filter(c=>c.action?.includes(':slot:')).map(c=>({actionId:c.id,title:c.title,slot:r.state.oracle?.slots?.[Number(c.action.split(':').at(-1))]}))}));
  const c4=subjectFor('new3',businessId),target=appointments.filter(a=>a.state==='ACTIVE'&&Date.parse(a.start_at)===Date.parse(f.startAt)),targetCalendar=calendar.filter(a=>Date.parse(a.start_at)===Date.parse(f.startAt));
  const c4Counts=(await db.query(`SELECT
   (SELECT count(*)::int FROM core.local_booking_intent li JOIN core.input i ON i.business_id=li.business_id AND i.id=li.input_id WHERE li.business_id=$1 AND i.subject=$2) intents,
   (SELECT count(*)::int FROM core.protection p JOIN core.operation o ON o.business_id=p.business_id AND o.id=p.operation_id JOIN core.input i ON i.business_id=o.business_id AND i.id=o.input_id WHERE p.business_id=$1 AND i.subject=$2) protections,
   (SELECT count(*)::int FROM core.local_ledger l JOIN core.attempt a ON a.business_id=l.business_id AND a.id=l.id WHERE l.business_id=$1 AND l.kind='CORE' AND a.envelope->>'recipient'=$2) ledger`,[businessId,c4])).rows[0];
  const c4BookingAttempts=attempts.filter(a=>a.subject===c4&&a.booking).reduce((n,a)=>n+a.n,0),c4ConfirmationAttempts=attempts.filter(a=>a.subject===c4&&!a.booking).reduce((n,a)=>n+a.n,0);
  await db.query('COMMIT');
  const profile=JSON.parse(await fs.readFile(path.join(s.directory,'application.json'),'utf8')),p=profile.scopes.find(p=>p.businessId===businessId);
  return {fixture:{...f,directory:s.directory,database:s.database,dbPort:s.port,commandPort:s.commandPort,isolated:true},businessId,channelId:p.channelId,calendarId:p.calendarId,availability:p.config,employees:p.employees,qualifiedEmployees:p.config.employees,customers:PERSONAS.map((persona,i)=>({persona,subject:subjectFor(persona,businessId),name:'Cliente '+(i+1)})),counts,appointments,calendar,protections,attempts,c4:{appointments:appointments.filter(a=>a.subject===c4).length,bookingAttempts:c4BookingAttempts,confirmationAttempts:c4ConfirmationAttempts,...c4Counts},savedOffer,staleInputs,currentOffers,checks:{twoTargetAppointments:target.length===2,twoDistinctEmployees:new Set(target.map(a=>a.resource_id)).size===2,twoTargetCalendarEvents:targetCalendar.length===2,targetUsesQualifiedEmployees:target.length===2&&target.every(a=>p.config.employees.some(e=>e.id===a.resource_id&&e.serviceIds.includes(p.config.service.id))),correctBuffers:target.length===2&&target.every(a=>a.buffer_minutes===15&&Date.parse(a.end_at)-Date.parse(a.start_at)===3600000&&Date.parse(a.protected_until)===Date.parse(f.protectedUntil)),exactProtectionRanges:target.length===2&&target.every(a=>protections.some(pr=>pr.appointment_id===a.id&&pr.resource_id===a.resource_id&&Date.parse(pr.start_at)===Date.parse(f.startAt)&&Date.parse(pr.protected_until)===Date.parse(f.protectedUntil)&&pr.lower_inclusive&&!pr.upper_inclusive)),c4HasNoBooking:!appointments.some(a=>a.subject===c4)&&c4BookingAttempts===0&&c4ConfirmationAttempts===0&&c4Counts.intents===0&&c4Counts.protections===0&&c4Counts.ledger===0,staleProcessed:staleInputs.some(i=>i.state==='DONE'),noFalseConfirmation:staleInputs.every(i=>i.reply?.outcome!=='CONFIRMED')},ownerBrowserAcceptance:'PENDING — only the owner can record browser acceptance'};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{await db.end();}
}
