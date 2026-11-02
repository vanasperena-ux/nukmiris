import { randomUUID } from 'node:crypto';
import { digest,finiteDate,noFaults,object,text,uuid } from '../domain/protocol.js';
import type { Clock,Faults,ObjectValue } from '../domain/protocol.js';
import type { EvidenceStore,Envelope,Seal } from '../ports.js';
import type { UnitOfWork } from '../infrastructure/postgres/unit-of-work.js';

export interface PlanRequest {
  businessId:string; inputId:string; customerId:string; calendarId:string; resourceId:string;
  startAt:string; endAt:string; kind?:'CREATE'|'MOVE'|'CANCEL'|'ATTENDANCE';
  appointmentId?:string; eventId?:string; expectedRevision?:number;
  outputPurpose?:'CUSTOMER_REQUEST'|'REMINDER'; bufferMinutes?:number;
}
/** Test-command plan only: no booking conversation, employee selection or Google adapter. */
export async function prepareOperation(args:{request:PlanRequest;reducer:UnitOfWork;sealer:UnitOfWork;archive:EvidenceStore;clock:Clock;faults?:Faults}):Promise<Seal> {
  const {request:r,reducer,sealer,archive,clock}=args,b=r.businessId;
  [r.inputId,r.customerId,r.calendarId,r.resourceId].forEach(uuid);
  const context=await reducer.tx(b,async db=>{
    const input=(await db.query('SELECT * FROM core.input WHERE business_id=$1 AND id=$2',[b,r.inputId])).rows[0] as ObjectValue|undefined;
    if(!input)throw new Error('input_missing');
    const bh=(await db.query('SELECT * FROM core.business WHERE business_id=$1',[b])).rows[0] as ObjectValue;
    if(!bh['dispatch_enabled']||bh['status']!=='ACTIVE')throw new Error('business_paused');
    const ch=(await db.query('SELECT * FROM core.channel WHERE business_id=$1 AND id=$2',[b,input['channel_id']])).rows[0] as ObjectValue;
    const calendar=(await db.query('SELECT * FROM core.calendar WHERE business_id=$1 AND id=$2',[b,r.calendarId])).rows[0] as ObjectValue|undefined;
    if(!calendar)throw new Error('calendar_denied');
    const ph=(await db.query("SELECT revision,suppressed FROM core.permission_head WHERE business_id=$1 AND subject=$2 AND purpose='REMINDER'",[b,input['subject']])).rows[0] as ObjectValue|undefined;
    return {input,bh,ch,ph,calendar};
  });
  const intent={businessId:b,inputId:r.inputId,customerId:r.customerId,calendarId:r.calendarId,resourceId:r.resourceId,
    startAt:finiteDate(r.startAt),endAt:finiteDate(r.endAt),kind:r.kind??'CREATE',
    appointmentId:r.appointmentId??null,eventId:r.eventId??null,expectedRevision:r.expectedRevision??1,
    bufferMinutes:r.bufferMinutes??0,outputPurpose:r.outputPurpose??'CUSTOMER_REQUEST'};
  if(Date.parse(intent.startAt)>=Date.parse(intent.endAt)||!Number.isInteger(intent.bufferMinutes)||intent.bufferMinutes<0||intent.bufferMinutes>1440)throw new Error('invalid_interval');
  const plan=await archive.ensure(`operation/${b}/${r.inputId}`,'OPERATION_PLAN',{intent},()=>{
    const attemptId=randomUUID(),operationId=randomUUID(),appointmentId=r.appointmentId??randomUUID(),eventId=r.eventId??randomUUID(),outputId=randomUUID();
    const payload={kind:intent.kind,businessId:b,calendarId:r.calendarId,appointmentId,eventId,customerId:r.customerId,resourceId:r.resourceId,startAt:intent.startAt,endAt:intent.endAt,bufferMinutes:intent.bufferMinutes};
    const outputPayload={synthetic:'WP1_ONLY',operationId,appointmentId};
    const now=clock.now().toISOString(),deadline=new Date(Math.min(clock.now().getTime()+900000,Date.parse(intent.startAt)-2000)).toISOString();
    const envelope:Envelope={formatVersion:1,businessId:b,attemptId,payloadDigest:digest(payload),recipient:text(context.input['subject']),
      channelId:text(context.ch['id']),channelRevision:Number(context.ch['revision']),conversationId:text(context.input['conversation_id']),
      waba:text(context.ch['waba']),numberId:text(context.ch['number_id']),calendarId:r.calendarId,calendarRevision:Number(context.calendar['revision']),grantId:text(context.calendar['grant_id']),
      businessRevision:Number(context.bh['revision']),recoveryEpoch:Number(context.bh['recovery_epoch']),permissionRevision:Number(context.ph?.['revision']??0),
      purpose:'CUSTOMER_REQUEST',dueAt:now,deadlineAt:deadline,windowEnd:new Date(Date.parse(text(context.input['received_at']))+86400000).toISOString(),
      budgetSeconds:2,remoteId:eventId,payload};
    return {...intent,attemptId,operationId,appointmentId,eventId,outputId,envelope,payloadDigest:envelope.payloadDigest,
      channelId:envelope.channelId,outputPayload,outputDigest:digest(outputPayload),outputDueAt:now,outputDeadlineAt:deadline};
  });
  // Intent is kept in evidence for exact repeat matching; SQL plan contains the
  // original allocated envelope, never a recalculated contemporary observation.
  await args.faults?.hit('prepare.afterArchive');await sealer.seal(b,archive,plan);
  await reducer.tx(b,async db=>{await db.query('SELECT core.prepare_operation($1,$2,$3,$4)',[b,plan.body,plan.digest,plan.key]);},'prepare',args.faults??noFaults);
  return plan;
}

export async function prepareOutput(args:{businessId:string;outputId:string;reducer:UnitOfWork;sealer:UnitOfWork;archive:EvidenceStore;clock:Clock}):Promise<Seal> {
  const {businessId:b,outputId,reducer,sealer,archive}=args;
  const row=await reducer.tx(b,async db=>{
    const o=(await db.query('SELECT * FROM core.output_intent WHERE business_id=$1 AND id=$2',[b,outputId])).rows[0] as ObjectValue|undefined;
    if(!o)throw new Error('output_missing');
    const ap=(await db.query('SELECT * FROM core.appointment WHERE business_id=$1 AND id=$2',[b,o['appointment_id']])).rows[0] as ObjectValue;
    const bh=(await db.query('SELECT * FROM core.business WHERE business_id=$1',[b])).rows[0] as ObjectValue;
    if(!bh['dispatch_enabled']||bh['status']!=='ACTIVE')throw new Error('business_paused');
    const i=(await db.query('SELECT * FROM core.input WHERE business_id=$1 AND id=$2',[b,o['input_id']])).rows[0] as ObjectValue;
    const ch=(await db.query('SELECT * FROM core.channel WHERE business_id=$1 AND id=$2',[b,i['channel_id']])).rows[0] as ObjectValue;
    const calendar=(await db.query('SELECT * FROM core.calendar WHERE business_id=$1 AND id=$2',[b,ap['calendar_id']])).rows[0] as ObjectValue;
    const ph=(await db.query("SELECT revision FROM core.permission_head WHERE business_id=$1 AND subject=$2 AND purpose='REMINDER'",[b,o['recipient']])).rows[0] as ObjectValue|undefined;
    return {o,ap,bh,i,ch,ph,calendar};
  });
  const seal=await archive.ensure(`output/${b}/${outputId}`,'OUTPUT_PLAN',{businessId:b,outputId,payloadDigest:row.o['payload_digest']!},()=>{
    const attemptId=randomUUID();
    const envelope:Envelope={formatVersion:1,businessId:b,attemptId,outputId,payloadDigest:text(row.o['payload_digest']),recipient:text(row.o['recipient']),
      channelId:text(row.ch['id']),channelRevision:Number(row.ch['revision']),conversationId:text(row.o['conversation_id']),
      waba:text(row.ch['waba']),numberId:text(row.ch['number_id']),calendarId:text(row.calendar['id']),calendarRevision:Number(row.calendar['revision']),grantId:text(row.calendar['grant_id']),
      businessRevision:Number(row.bh['revision']),recoveryEpoch:Number(row.bh['recovery_epoch']),permissionRevision:Number(row.ph?.['revision']??0),
      purpose:row.o['purpose'] as Envelope['purpose'],dueAt:text(row.o['due_at']),deadlineAt:text(row.o['deadline_at']),
      windowEnd:new Date(Date.parse(text(row.i['received_at']))+86400000).toISOString(),budgetSeconds:2,
      remoteId:'fake-message-'+attemptId,payload:row.o['payload']!};
    return {attemptId,envelope};
  });
  await sealer.seal(b,archive,seal);
  const envelope=object(seal.body['envelope']);
  await reducer.tx(b,async db=>{await db.query('SELECT core.prepare_output($1,$2,$3,$4,$5,$6,$7)',[b,outputId,seal.body['attemptId'],envelope,envelope['payloadDigest'],seal.key,seal.digest]);});
  return seal;
}
