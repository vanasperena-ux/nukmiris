import {randomUUID} from 'node:crypto';
import {DateTime} from 'luxon';
import {digest,object,text,uuid,finiteDate,noFaults,type ObjectValue,type Faults} from '../domain/protocol.js';
import {normalizedText} from '../domain/classification.js';
import {whatsappMessages} from '../domain/whatsapp-presentation.js';
import {boundedArchive} from './archive-policy.js';
import type {EvidenceStore} from '../ports.js';
import type {UnitOfWork} from '../infrastructure/postgres/unit-of-work.js';

export const REMINDER_HOURS=Object.freeze({seven_day:168,confirmation:24,followup:22,final:2});
export type ReminderKind=keyof typeof REMINDER_HOURS;
export const REMINDER_BODIES=Object.freeze({
 seven_day:'Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. ¡Te esperamos!',
 confirmation:'Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. ¿Nos confirmas tu asistencia?',
 followup:'Hola {{1}}, todavía no recibimos tu confirmación para la cita en {{2}} el {{3}} a las {{4}}. ¿Nos confirmas si podrás asistir?',
 final:'Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. ¡Te esperamos!',
});
interface Scope {businessId:string;channelId:string;businessName:string;timeZone:string;archive:EvidenceStore;reducer:UnitOfWork;sealer:UnitOfWork;operator:UnitOfWork;faults?:Faults}
interface Job extends ObjectValue {id:string;kind:ReminderKind;appointment_id:string;schedule_revision:number;subject:string;customer_name:string;start_at:string;confirm_action:string;reschedule_action:string}
export interface ReminderDecision {outcome:string;jobId:string;appointmentId:string;customerName:string;startAt:string}
/** Local synthetic scheduling/fixture facade. Actual sends use the unchanged
 * sealed output/attempt/dispatch/result path, never a second transport. */
export class LocalReminders {
 private readonly archive:EvidenceStore;
 constructor(private readonly s:Scope){if(s.archive.businessId!==s.businessId)throw Error('rm1_archive_binding');this.archive=boundedArchive(s.archive);}
 private get b(){return this.s.businessId;}
 async now():Promise<string>{return this.s.reducer.tx(this.b,async db=>(await db.query<{v:string}>('SELECT core.local_now($1) v',[this.b])).rows[0]!.v);}
 private async job(id:string):Promise<Job|undefined>{uuid(id);return this.s.reducer.tx(this.b,async db=>(await db.query(`SELECT j.*,s.subject,s.customer_name,s.start_at FROM core.rm1_job j JOIN core.rm1_schedule s ON s.business_id=j.business_id AND s.appointment_id=j.appointment_id AND s.schedule_revision=j.schedule_revision WHERE j.business_id=$1 AND j.id=$2`,[this.b,id])).rows[0] as Job|undefined);}
 async configure(requestId:string,change:ObjectValue):Promise<void>{
  uuid(requestId);const valid=change['action']==='ENABLE'?Object.keys(change).sort().join(',')==='action,enabled'&&typeof change['enabled']==='boolean':change['action']==='TEMPLATE'&&Object.keys(change).sort().join(',')==='action,kind,status'&&Object.hasOwn(REMINDER_HOURS,String(change['kind']))&&['APPROVED','MISSING','REJECTED','UNAVAILABLE'].includes(String(change['status']));
  if(!valid)throw Error('rm1_config_invalid');
  const seal=await this.archive.ensure(`rm1-config/${this.b}/${requestId}`,'RM1_CONFIG',{businessId:this.b,channelId:this.s.channelId,requestId,...change});await this.s.sealer.seal(this.b,this.archive,seal);
  await this.s.operator.tx(this.b,db=>db.query('SELECT core.rm1_configure($1,$2,$3,$4)',[this.b,seal.body,seal.key,seal.digest]));
 }
 async grant(requestId:string,subject:string,source:'SYNTHETIC_OWNER_EVIDENCE'|'CUSTOMER_REAUTHORIZATION',wording:string):Promise<void>{
  uuid(requestId);if(!subject||subject.length>128||!wording.trim()||wording.length>500||!['SYNTHETIC_OWNER_EVIDENCE','CUSTOMER_REAUTHORIZATION'].includes(source))throw Error('rm1_permission_evidence_invalid');
  const observed=await this.s.reducer.tx(this.b,async db=>(await db.query<{revision:string}>('SELECT revision FROM core.permission_head WHERE business_id=$1 AND subject=$2 AND purpose=\'REMINDER\'',[this.b,subject])).rows[0]);
  const at=await this.now(),seal=await this.archive.ensure(`rm1-permission/${this.b}/${requestId}`,'GRANT',{businessId:this.b,subject,evidenceId:requestId,source,wording},()=>({expected:Number(observed?.revision??0),occurredAt:at,recordedAt:at}));
  await this.s.sealer.seal(this.b,this.archive,seal);
  const revision=await this.s.operator.tx(this.b,async db=>(await db.query<{v:string}>('SELECT core.grant_permission($1,$2,$3,$4,$5,$6,$7,$8) v',[this.b,subject,requestId,seal.digest,seal.body['expected'],seal.body['occurredAt'],at,seal.key])).rows[0]!.v);
  const current=await this.s.reducer.tx(this.b,async db=>(await db.query<{revision:string;suppressed:boolean}>('SELECT revision,suppressed FROM core.permission_head WHERE business_id=$1 AND subject=$2 AND purpose=\'REMINDER\'',[this.b,subject])).rows[0]);
  if(!current||current.suppressed||String(current.revision)!==String(revision))throw Error('rm1_permission_superseded');
 }
 async advance(at:string):Promise<string>{if(typeof at!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(at))throw Error('rm1_clock_requires_offset');return this.s.operator.tx(this.b,async db=>(await db.query<{v:string}>('SELECT core.rm1_advance($1,$2) v',[this.b,finiteDate(at)])).rows[0]!.v);}
 async withdraw(requestId:string,subject:string):Promise<void>{
  uuid(requestId);if(!subject||subject.length>128)throw Error('rm1_subject_invalid');const now=await this.now(),seal=await this.archive.ensure(`rm1-withdrawal/${this.b}/${requestId}`,'SUPPRESSION',{businessId:this.b,subject,evidenceId:requestId,source:'SYNTHETIC_OWNER_EVIDENCE'},()=>({occurredAt:now}));
  await this.s.sealer.seal(this.b,this.archive,seal);await this.s.operator.tx(this.b,db=>db.query('SELECT core.suppress($1,$2,$3,$4,$5)',[this.b,subject,requestId,seal.digest,seal.body['occurredAt']]));
 }
 async queue():Promise<void>{
  const ids=await this.s.reducer.tx(this.b,async db=>(await db.query<{v:string[]}>('SELECT core.rm1_due_jobs($1) v',[this.b])).rows[0]!.v);
  for(const id of ids){
   const j=await this.job(id);if(!j)throw Error('rm1_job_missing');const date=DateTime.fromISO(j.start_at,{setZone:true}).setZone(this.s.timeZone).setLocale('es');if(!date.isValid)throw Error('rm1_timezone_invalid');
   const values=[j.customer_name,this.s.businessName,date.toFormat("cccc d 'de' LLLL 'de' yyyy"),date.toFormat('HH:mm')];
   if(values.some(v=>typeof v!=='string'||!v.trim()))throw Error('rm1_template_parameters_invalid');
   const body=REMINDER_BODIES[j.kind].replace(/\{\{([1-4])\}\}/g,(_,n:string)=>values[Number(n)-1]!);
   const choices=['confirmation','followup'].includes(j.kind)?[{id:j.confirm_action,title:'Sí, confirmo'},{id:j.reschedule_action,title:'Necesito reagendar'}]:[];
   const payload=object({text:body,choices,outcome:'REMINDER',presentation:choices.length?'REPLY_BUTTONS':'TEXT',jobId:j.id,synthetic:true,template:'nukmiris_'+j.kind+'_v1',language:'es_MX',templateMetadata:{category:'UTILITY',message_send_ttl_seconds:j.kind==='final'?300:900}});
   whatsappMessages({text:body,choices,presentation:choices.length?'REPLY_BUTTONS':'TEXT'});
   const seal=await this.archive.ensure(`rm1-output/${this.b}/${j.id}`,'RM1_OUTPUT',{businessId:this.b,jobId:j.id,appointmentId:j.appointment_id,scheduleRevision:Number(j.schedule_revision),kind:j.kind,recipient:j.subject},()=>({outputId:randomUUID(),payload,payloadDigest:digest(payload)}));
   await this.s.faults?.hit('rm1.afterOutputArchive');
   await this.s.sealer.seal(this.b,this.archive,seal);
   await this.s.reducer.tx(this.b,db=>db.query('SELECT core.rm1_enqueue($1,$2,$3,$4)',[this.b,seal.body,seal.key,seal.digest]),'rm1-enqueue',this.s.faults??noFaults);
  }
 }
 async receipt(requestId:string,jobId:string,status:'sent'|'delivered'|'read'|'failed',overrides:ObjectValue={}):Promise<boolean>{
  uuid(requestId);uuid(jobId);if(!['sent','delivered','read','failed'].includes(status))throw Error('rm1_receipt_status');
  const a=await this.s.reducer.tx(this.b,async db=>(await db.query(`SELECT a.* FROM core.attempt a JOIN core.rm1_job j ON j.business_id=a.business_id AND j.output_id=a.output_id WHERE j.business_id=$1 AND j.id=$2`,[this.b,jobId])).rows[0]);if(!a)throw Error('rm1_message_not_submitted');
  const e=object(a.envelope),at=await this.now(),seal=await this.archive.ensure(`rm1-receipt/${this.b}/${requestId}`,'RM1_RECEIPT',{businessId:this.b,evidenceId:requestId,jobId,attemptId:text(a.id),messageId:text(e['remoteId']),recipient:text(e['recipient']),channelId:text(e['channelId']),waba:text(e['waba']),numberId:text(e['numberId']),status,...overrides},()=>({atTime:at}));
  await this.s.sealer.seal(this.b,this.archive,seal);
  return this.s.operator.tx(this.b,async db=>(await db.query<{v:boolean}>('SELECT core.rm1_record_receipt($1,$2,$3,$4) v',[this.b,seal.body,seal.key,seal.digest])).rows[0]!.v);
 }
 async response(inputId:string,payload:{kind:'TEXT'|'ACTION';value:string;replyTo?:string},basisOutcome:string):Promise<ReminderDecision|undefined>{
  const n=normalizedText(payload.value),confirm=['si','confirmo','confirmada','confirmado','si confirmo'].includes(n),reschedule=['reagendar','cambiar cita','necesito cambiar','otra fecha','necesito reagendar'].includes(n);
  if(payload.kind==='TEXT'&&(!confirm&&!reschedule||['NAME_REQUIRED','OFFER','DATES','SERVICES','HUMAN_HANDOFF'].includes(basisOutcome)))return undefined;
  const row=await this.s.reducer.tx(this.b,async db=>{
   if(payload.kind==='ACTION')return (await db.query('SELECT j.id,j.confirm_action,j.reschedule_action FROM core.rm1_job j JOIN core.rm1_schedule s USING(business_id,appointment_id,schedule_revision) JOIN core.input i ON i.business_id=s.business_id AND i.subject=s.subject AND i.channel_id=s.channel_id WHERE j.business_id=$1 AND i.id=$2 AND ($3=j.confirm_action OR $3=j.reschedule_action)',[this.b,inputId,payload.value])).rows[0];
   const rows=(await db.query(`SELECT j.id,j.confirm_action,j.reschedule_action FROM core.rm1_job j JOIN core.rm1_schedule s USING(business_id,appointment_id,schedule_revision) JOIN core.attempt a ON a.business_id=j.business_id AND a.output_id=j.output_id JOIN core.input i ON i.business_id=s.business_id AND i.subject=s.subject AND i.channel_id=s.channel_id WHERE j.business_id=$1 AND i.id=$2 AND j.kind IN ('confirmation','followup') AND a.state IN ('SUBMISSION_ENTERED','UNKNOWN','VERIFIED_APPLIED') AND ($3::text IS NULL OR a.meta_message_id=$3) ORDER BY j.due_at DESC`,[this.b,inputId,payload.replyTo??null])).rows;return rows[0];
  });
  if(!row)return confirm||payload.replyTo?{outcome:'USE_BUTTON',jobId:'',appointmentId:'',customerName:'',startAt:''}:undefined;
  const action=payload.kind==='ACTION'?(payload.value===row.confirm_action?'confirm':'reschedule'):confirm?'confirm':'reschedule',seal=await this.archive.ensure(`rm1-response/${this.b}/${inputId}`,'RM1_RESPONSE',{businessId:this.b,inputId,jobId:text(row.id),action,...(payload.kind==='TEXT'?{text:payload.value,...(payload.replyTo?{replyTo:payload.replyTo}:{})}:{})});
  await this.s.sealer.seal(this.b,this.archive,seal);let result:{outcome:string;jobId:string};
  try{result=await this.s.reducer.tx(this.b,async db=>(await db.query<{v:{outcome:string;jobId:string}}>('SELECT core.rm1_respond($1,$2,$3,$4) v',[this.b,seal.body,seal.key,seal.digest])).rows[0]!.v);}catch(e){if((e as Error).message==='rm1_response_ambiguous')return {outcome:'USE_BUTTON',jobId:'',appointmentId:'',customerName:'',startAt:''};throw e;}
  const j=await this.job(result.jobId);if(!j)throw Error('rm1_response_job_missing');return {...result,appointmentId:j.appointment_id,customerName:j.customer_name,startAt:j.start_at};
 }
 async activity():Promise<ObjectValue>{
  return this.s.reducer.tx(this.b,async db=>{
   const config=(await db.query('SELECT enabled FROM core.rm1_config WHERE business_id=$1',[this.b])).rows[0];
   const jobs=(await db.query(`SELECT j.id,j.appointment_id AS "appointmentId",j.schedule_revision::int AS "scheduleRevision",j.kind,j.due_at AS "dueAt",j.deadline_at AS "deadlineAt",j.queued_at AS "queuedAt",j.reason,s.customer_name AS "customerName",s.subject,s.start_at AS "startAt",s.attendance,s.confirmed_at AS "confirmedAt",a.id AS "attemptId",a.meta_message_id AS "messageId",a.meta_status AS receipt,t.template_name AS template,
    CASE WHEN a.state IN ('SUBMISSION_ENTERED','UNKNOWN') THEN 'HELD' WHEN a.meta_status IN ('delivered','read') THEN 'DELIVERED' WHEN a.meta_status='failed' THEN 'FAILED' WHEN a.state='VERIFIED_APPLIED' THEN 'ACCEPTED' WHEN o.state='EXPIRED' THEN 'SKIPPED' WHEN a.state='ARMED' AND j.reason<>'' THEN 'HELD' WHEN a.state IN ('PREPARED','ARMED') THEN 'QUEUED' WHEN j.state IN ('SUPPRESSED','SKIPPED') THEN j.state WHEN j.reason<>'' AND j.due_at<=core.local_now($1) THEN 'HELD' WHEN j.due_at<=core.local_now($1) THEN 'DUE' ELSE j.state END AS status
    FROM core.rm1_job j JOIN core.rm1_schedule s USING(business_id,appointment_id,schedule_revision) LEFT JOIN core.output_intent o ON o.business_id=j.business_id AND o.id=j.output_id LEFT JOIN core.attempt a ON a.business_id=j.business_id AND a.output_id=j.output_id LEFT JOIN core.rm1_template t ON t.business_id=j.business_id AND t.channel_id=s.channel_id AND t.kind=j.kind WHERE j.business_id=$1 ORDER BY j.due_at,j.id LIMIT 500`,[this.b])).rows;
   const customers=(await db.query(`SELECT c.subject,p.name,coalesce(h.suppressed,true) AS suppressed,coalesce(h.revision,0)::int AS revision FROM core.customer c JOIN core.local_customer p ON p.business_id=c.business_id AND p.customer_id=c.id LEFT JOIN core.permission_head h ON h.business_id=c.business_id AND h.subject=c.subject AND h.purpose='REMINDER' WHERE c.business_id=$1 ORDER BY p.name`,[this.b])).rows;
   const templates=(await db.query('SELECT kind,status FROM core.rm1_template WHERE business_id=$1 AND channel_id=$2 ORDER BY kind',[this.b,this.s.channelId])).rows;
   const events=(await db.query('SELECT job_id AS "jobId",at_time AS "atTime",category,attempt_id AS "attemptId",reason FROM core.rm1_event WHERE business_id=$1 ORDER BY id DESC LIMIT 1000',[this.b])).rows;
   return object({businessId:this.b,enabled:config?.enabled??false,synthetic:true,serverNow:await this.now(),jobs,customers,templates,events});
  });
 }
}
