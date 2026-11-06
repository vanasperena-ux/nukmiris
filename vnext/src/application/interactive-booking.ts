import {randomUUID} from 'node:crypto';
import {DateTime} from 'luxon';
import {AvailabilityOracle,type OracleView} from './availability-oracle.js';
import {protectedCalendar,type BookingBindings,type AvailabilitySignal} from './booking-composition.js';
import {prepareOperation,prepareOutput} from './prepare-operation.js';
import {armAttempt,dispatchOnce,reconcileReadOnly} from './dispatch-once.js';
import {recordResult} from './record-result.js';
import {reduceInput} from './reduce-input.js';
import {RecoveryWorker} from './recover-expired.js';
import {PlanConflictError,ConversationHeldError} from './plan-conflict.js';
import {AvailabilityHeldError,recheckSlot,type AvailabilityConfig,type SyntheticCalendarReader} from '../domain/availability.js';
import {parseAppointmentDate,dateErrorMessage} from '../domain/appointment-date.js';
import {normalizedText,ordinaryDecision} from '../domain/classification.js';
import {whatsappPresentation} from '../domain/whatsapp-presentation.js';
import {digest,object,text,uuid,type ObjectValue,type Clock,type Faults,noFaults} from '../domain/protocol.js';
import type {UnitOfWork} from '../infrastructure/postgres/unit-of-work.js';
import type {EvidenceStore,Seal,Envelope,SyntheticProvider,AppliedProof} from '../ports.js';

export interface LocalScope {
 config:AvailabilityConfig;bindings:BookingBindings;channelId:string;employeeNames:ReadonlyMap<string,string>;
 archive:EvidenceStore;ingress:UnitOfWork;reducer:UnitOfWork;sealer:UnitOfWork;dispatcher:UnitOfWork;result:UnitOfWork;
}
export interface LocalInput {kind:'TEXT'|'ACTION';value:string}
type Claim={inputId:string;conversationId:string;subject:string;sequence:number;basis:ObjectValue;revision:number;payload:LocalInput;action:string;error:string;now:string;expiresAt:string};
/** Same-database fake calendar/ledger. It has no remote SDK, URL or provider fallback. */
export class LocalProvider implements SyntheticProvider {
 readonly mode='WP1_SYNTHETIC_ONLY' as const;
 failure:'NONE'|'BEFORE_APPLY'|'AFTER_APPLY'='NONE';
 constructor(readonly businessId:string,private readonly result:UnitOfWork){}
 async submitOnce(e:Envelope):Promise<AppliedProof>{if(e.businessId!==this.businessId)throw Error('local_provider_scope');if(this.failure==='BEFORE_APPLY')throw Error('synthetic_before_effect');const p=await this.result.tx(this.businessId,async db=>(await db.query<{v:AppliedProof}>('SELECT core.local_provider_apply($1,$2,$3) v',[this.businessId,e,'CORE'])).rows[0]!.v);if(this.failure==='AFTER_APPLY')throw Error('synthetic_lost_reply');return p;}
 async readOnly(e:Envelope):Promise<AppliedProof|null>{if(e.businessId!==this.businessId)throw Error('local_provider_scope');return this.result.tx(this.businessId,async db=>(await db.query<{proof:AppliedProof}>('SELECT proof FROM core.local_ledger WHERE business_id=$1 AND id=$2 AND kind=$3 AND payload_digest=$4',[this.businessId,e.attemptId,'CORE',e.payloadDigest])).rows[0]?.proof??null);}
}
export class InteractiveBooking {
 readonly providers=new Map<string,LocalProvider>();readonly recovery:RecoveryWorker;
 private readonly scopes=new Map<string,LocalScope>();private inFlight:Promise<void>|undefined;private timer:ReturnType<typeof setInterval>|undefined;
 constructor(scopes:readonly LocalScope[],private readonly faults:Faults=noFaults){
  for(const s of scopes){const b=s.config.businessId;if(this.scopes.has(b)||s.archive.businessId!==b||s.bindings.businessId!==b)throw Error('interactive_tenant_binding_required');this.scopes.set(b,s);this.providers.set(b,new LocalProvider(b,s.result));}
  this.recovery=new RecoveryWorker(scopes.map(s=>({businessId:s.config.businessId,archive:s.archive,reducer:s.reducer,sealer:s.sealer})));
 }
 private scope(b:string):LocalScope{const s=this.scopes.get(b);if(!s)throw Error('interactive_route_denied');return s;}
 private async now(s:LocalScope):Promise<string>{return s.reducer.tx(s.config.businessId,async db=>(await db.query<{v:string}>('SELECT core.local_now($1) v',[s.config.businessId])).rows[0]!.v);}
 private async attention(s:LocalScope,key:string,code:string,detail:ObjectValue={}):Promise<void>{await s.reducer.tx(s.config.businessId,async db=>{await db.query('SELECT core.local_attention($1,$2,$3,$4)',[s.config.businessId,key,code,detail]);});}
 private reader(s:LocalScope,now:string):SyntheticCalendarReader{
  const b=s.config.businessId,reverse=new Map([...s.bindings.employees].map(([k,v])=>[v,k]));
  const source:SyntheticCalendarReader={mode:'L1_SYNTHETIC_ONLY',read:async(range,cursor)=>{
   if(cursor!==null||range.businessId!==b||range.calendarId!==s.config.calendarId)throw Error('local_calendar_scope');
   const rows=await s.reducer.tx(b,async db=>(await db.query('SELECT * FROM core.local_calendar WHERE business_id=$1 AND calendar_id=$2 ORDER BY id',[b,s.bindings.calendar.coreId])).rows as ObjectValue[]);
   return {...range,snapshotId:digest(rows),complete:true,nextCursor:null,events:rows.map(r=>({businessId:b,calendarId:s.config.calendarId,id:text(r['id']),start:text(r['start_at']),end:text(r['end_at']),bufferMinutes:Number(r['buffer_minutes']),...(r['resource_id']?{resourceId:reverse.get(text(r['resource_id']))??text(r['resource_id'])}:{})}))};
  }};
  return protectedCalendar({config:s.config,bindings:s.bindings,source,reducer:s.reducer,now,signal:(signal:AvailabilitySignal)=>{void this.attention(s,signal.code+'/'+signal.eventId,signal.code,object(signal)).catch(()=>{});}});
 }
 async submit(b:string,subject:string,requestId:string,payload:LocalInput):Promise<{inputId:string}>{
  const s=this.scope(b);uuid(requestId);if(!subject||subject.length>128||!payload||!['TEXT','ACTION'].includes(payload.kind)||typeof payload.value!=='string'||!payload.value.trim()||payload.value.length>1024||Object.keys(payload).some(k=>!['kind','value'].includes(k)))throw Error('local_input_schema');if(payload.kind==='ACTION')uuid(payload.value);
  const existing=await s.reducer.tx(b,async db=>(await db.query<{id:string}>('SELECT id FROM core.conversation WHERE business_id=$1 AND channel_id=$2 AND subject=$3',[b,s.channelId,subject])).rows[0]);
  const conv=await s.archive.ensure(`local-conversation/${b}/${s.channelId}/${digest(subject)}`,'LOCAL_CONVERSATION',{businessId:b,channelId:s.channelId,subject},()=>({conversationId:existing?.id??randomUUID()}));
  const receivedAt=await this.now(s);
  const input=await s.archive.ensure(`local-input/${b}/${requestId}`,'LOCAL_INPUT',{version:1,businessId:b,requestId,channelId:s.channelId,subject,payload:object(payload)},()=>({inputId:randomUUID(),conversationId:conv.body['conversationId']!,receivedAt}));
  // Only the original admission time is frozen; SQL independently checks DB time.
  await s.sealer.seal(b,s.archive,input);const inputId=await s.ingress.tx(b,async db=>(await db.query<{v:string}>('SELECT core.local_admit($1,$2,$3,$4) v',[b,input.body,input.key,input.digest])).rows[0]!.v);
  if(payload.kind==='TEXT'&&['NAVIGATION','HUMAN_HANDOFF'].includes(ordinaryDecision({type:'text',text:{body:payload.value}},'BOT','NONE').outcome))await reduceInput({businessId:b,inputId,reducer:s.reducer,sealer:s.sealer,archive:s.archive});
  return {inputId};
 }
 async tick():Promise<void>{if(this.inFlight)return this.inFlight;const work=this.pass();this.inFlight=work;void work.finally(()=>{if(this.inFlight===work)this.inFlight=undefined;}).catch(()=>{});return work;}
 start(interval=250):void{if(this.timer)throw Error('interactive_already_started');this.recovery.start(interval,e=>{for(const s of this.scopes.values())void this.attention(s,'recovery-worker','RECOVERY_HELD',{reason:String(e).slice(0,256)}).catch(()=>{});});this.timer=setInterval(()=>{void this.tick().catch(()=>{});},interval);void this.tick().catch(()=>{});}
 async stop():Promise<void>{clearInterval(this.timer);this.timer=undefined;await this.recovery.stop();await this.inFlight;}
 private async pass():Promise<void>{
  for(const [b,s] of this.scopes){
   try{await this.effects(s);await this.replies(s);
    const pending=await s.reducer.tx(b,async db=>(await db.query<{input_id:string}>(`SELECT m.input_id FROM core.local_message m JOIN core.input i ON i.business_id=m.business_id AND i.id=m.input_id WHERE m.business_id=$1 AND m.state<>'DONE' ORDER BY CASE WHEN EXISTS(SELECT 1 FROM core.input_reduction red WHERE red.business_id=m.business_id AND red.input_id=m.input_id AND red.outcome IN ('NAVIGATION','HUMAN_HANDOFF')) THEN 0 ELSE 1 END,i.sequence,i.id LIMIT 100`,[b])).rows);
    for(const row of pending)try{await this.process(s,row.input_id);}catch(e){await this.attention(s,'input/'+row.input_id,'INPUT_HELD',{reason:String(e).slice(0,256)});}
    const completed=await s.reducer.tx(b,async db=>(await db.query<{input_id:string}>(`SELECT m.input_id FROM core.local_message m JOIN core.input i ON i.business_id=m.business_id AND i.id=m.input_id WHERE m.business_id=$1 AND m.state='DONE' AND NOT EXISTS(SELECT 1 FROM core.operation op WHERE op.business_id=$1 AND op.input_id=m.input_id) AND NOT EXISTS(SELECT 1 FROM core.input_reduction r WHERE r.business_id=$1 AND r.input_id=m.input_id) ORDER BY i.sequence LIMIT 100`,[b])).rows);
    for(const row of completed)await reduceInput({businessId:b,inputId:row.input_id,reducer:s.reducer,sealer:s.sealer,archive:s.archive});
    await this.effects(s);await this.replies(s);
   }catch(e){await this.attention(s,'runtime-pass','RUNTIME_HELD',{reason:String(e).slice(0,256)}).catch(()=>{});}
  }
 }
 private async process(s:LocalScope,inputId:string):Promise<void>{
  const b=s.config.businessId,claimed=await s.reducer.tx(b,async db=>(await db.query<{v:{status:string;claim:Claim}}>('SELECT core.local_claim($1,$2) v',[b,inputId])).rows[0]!.v,'local-claim',this.faults);if(claimed.status!=='CLAIMED')return;
  const c=claimed.claim,now=await this.now(s),clock:Clock={now:()=>new Date(now)},basis=c.basis??{},oracle=AvailabilityOracle.resume(s.config,this.reader(s,now),()=>now,object(basis['oracle']??{}),c.expiresAt);
  const previousView=()=>{const v=object(basis['view']);return {...v,choices:(v['choices'] as ObjectValue[]).map(x=>({id:text(x['action']??x['id']),title:text(x['title'])}))} as unknown as OracleView;};
  const prior=await s.archive.lookup(`local-view/${b}/${inputId}`);if(prior){await this.finish(s,prior);return;}
  let view:OracleView|undefined,book:Seal|undefined;const n=normalizedText(c.payload.value),customer=await s.reducer.tx(b,async db=>(await db.query<{id:string;name:string}>('SELECT cu.id,p.name FROM core.customer cu LEFT JOIN core.local_customer p ON p.business_id=$1 AND p.customer_id=cu.id WHERE cu.business_id=$1 AND cu.subject=$2',[b,c.subject])).rows[0]);
  const operation=await s.reducer.tx(b,async db=>(await db.query<{plan:ObjectValue}>('SELECT plan FROM core.operation WHERE business_id=$1 AND input_id=$2',[b,inputId])).rows[0]);
  if(operation){book=await s.archive.lookup(`operation/${b}/${inputId}`)??undefined;if(!book)throw Error('operation_custody_missing');}
  else try{
   if(basis['outcome']==='HUMAN_HANDOFF'&&!(c.payload.kind==='TEXT'&&n==='menu'))view=oracle.ordinary();
   else if(c.error||((c.payload.kind==='ACTION'||basis['outcome']==='NAME_REQUIRED')&&Date.parse(c.expiresAt)<=Date.parse(now))){oracle.menu();view=await oracle.open();view.text='Esa opción venció o ya fue utilizada. Elige un horario de nuevo.\n\n'+view.text;}
   else if(c.payload.kind==='TEXT'&&n==='menu'){oracle.menu();view=await oracle.open();}
   else if(c.payload.kind==='TEXT'&&ordinaryDecision({type:'text',text:{body:c.payload.value}},'BOT','NONE').outcome==='HUMAN_HANDOFF')view=oracle.humano();
   else if(basis['outcome']==='HUMAN_HANDOFF')view=oracle.ordinary();
   else if(c.payload.kind==='ACTION')view=await oracle.action(c.action,!!customer?.name);
   else if(basis['outcome']==='NAME_REQUIRED'){
    const name=c.payload.value.replace(/\s+/g,' ').trim();
    if(name.length<3||name.length>120||!/[\p{L}]/u.test(name)||/[0-9<>]/.test(name)){view={...previousView(),text:'Por favor, escribe tu nombre completo (máximo 120 caracteres).',choices:[]};}
    else{const identity=await s.archive.ensure(`local-name/${b}/${inputId}`,'LOCAL_CUSTOMER',{businessId:b,inputId,name},()=>({customerId:randomUUID()}));await s.reducer.tx(b,async db=>{await db.query('SELECT core.local_name($1,$2,$3,$4)',[b,inputId,name,identity.body['customerId']]);});view=await oracle.nameCaptured();}
   }
   else if(['cita','agendar','reservar'].includes(n)||!basis['outcome'])view=await oracle.open();
   else if(basis['outcome']==='BOOKING'||!basis['view'])view=oracle.ordinary();
   else{const parsed=parseAppointmentDate(c.payload.value,{now,timeZone:s.config.timeZone});if(parsed.success){view=await oracle.date(parsed.date!);if(view.choices.length===1&&parsed.fallback?.success)view=await oracle.date(parsed.fallback.date!);}else view={...previousView(),text:dateErrorMessage(parsed,365)};}
   if(view?.outcome==='BOOK_REQUEST'){
    const known=await s.reducer.tx(b,async db=>(await db.query<{id:string;name:string}>('SELECT cu.id,p.name FROM core.customer cu JOIN core.local_customer p ON p.business_id=$1 AND p.customer_id=cu.id WHERE cu.business_id=$1 AND cu.subject=$2',[b,c.subject])).rows[0]);if(!known)throw Error('local_customer_missing');
    const original=await s.archive.lookup(`operation/${b}/${inputId}`);
    if(original){await s.sealer.seal(b,s.archive,original);await s.reducer.tx(b,async db=>{const r=(await db.query<{v:{state:string}}>('SELECT core.try_prepare_operation($1,$2,$3,$4) v',[b,original.body,original.digest,original.key])).rows[0]!.v;if(r.state!=='PREPARED')throw new PlanConflictError('P0001',true,new Error('terminal_plan_conflict'));});book=original;}
    else{
     const slot=await recheckSlot(s.config,this.reader(s,now),now,view.slot!),resourceId=s.bindings.employees.get(slot.resourceId);if(!resourceId)throw Error('local_resource_mapping');
     const intent=await s.archive.ensure(`local-intent/${b}/${inputId}`,'LOCAL_BOOKING_INTENT',{businessId:b,inputId},()=>({customerId:known.id,calendarId:s.bindings.calendar.coreId,resourceId,slot:object(slot)}));if(intent.body['resourceId']!==resourceId)throw new AvailabilityHeldError('SLOT_UNAVAILABLE');await s.sealer.seal(b,s.archive,intent);await s.reducer.tx(b,async db=>{await db.query('SELECT core.local_intent($1,$2,$3,$4)',[b,intent.body,intent.key,intent.digest]);});
     const employeeName=s.employeeNames.get(slot.resourceId)??slot.resourceId,when=DateTime.fromISO(slot.startAt).setZone(s.config.timeZone).setLocale('es').toFormat('cccc d LLL, HH:mm');
     book=await prepareOperation({request:{businessId:b,inputId,customerId:known.id,calendarId:s.bindings.calendar.coreId,resourceId,startAt:slot.startAt,endAt:slot.endAt,bufferMinutes:slot.bufferMinutes,confirmation:{text:`Tu cita está confirmada para ${when} con ${employeeName}.`,choices:[],outcome:'CONFIRMED',employee:employeeName,customer:known.name,startAt:slot.startAt,endAt:slot.endAt}},reducer:s.reducer,sealer:s.sealer,archive:s.archive,clock,faults:this.faults});
    }
   }
  }catch(e){
   if(e instanceof ConversationHeldError)return;
   if(e instanceof PlanConflictError||(e instanceof AvailabilityHeldError&&e.reason==='SLOT_UNAVAILABLE')||(e instanceof Error&&e.message==='local_action_expired')){oracle.menu();view=await oracle.open();view.text='Ese horario ya no está disponible o la reserva tardó demasiado. No se confirmó. Elige un horario de nuevo.\n\n'+view.text;}
   else throw e;
  }
  if(!book&&!view)throw Error('local_view_missing');
  let reply:ObjectValue|null=null;
  if(!book){
   const active=await this.active(s,c.subject);if(active.length)view!.text=this.activeText(s,active)+'\n\n'+view!.text;
   // Reference view/action IDs are replaced by independently allocated displayed IDs.
   whatsappPresentation(view!);
   reply=object({...view!,choices:view!.choices.map(x=>({id:randomUUID(),title:x.title,action:x.id}))});
   await reduceInput({businessId:b,inputId,reducer:s.reducer,sealer:s.sealer,archive:s.archive});
  }
  const saved=await s.archive.ensure(`local-view/${b}/${inputId}`,'LOCAL_VIEW',{businessId:b,inputId},()=>({revision:c.revision+1,replyId:randomUUID(),reply,state:{oracle:oracle.snapshot(),outcome:book?'BOOKING':view!.outcome,view:reply},...(book?{attemptId:book.body['attemptId']!}:{})}));await this.finish(s,saved);
 }
 private async finish(s:LocalScope,seal:Seal):Promise<void>{await s.sealer.seal(s.config.businessId,s.archive,seal);await s.reducer.tx(s.config.businessId,async db=>{await db.query('SELECT core.local_finish($1,$2,$3,$4)',[s.config.businessId,seal.body,seal.key,seal.digest]);},'local-view',this.faults);}
 private async active(s:LocalScope,subject:string):Promise<ObjectValue[]>{return s.reducer.tx(s.config.businessId,async db=>(await db.query(`SELECT a.* FROM core.appointment a JOIN core.customer c ON c.business_id=a.business_id AND c.id=a.customer_id WHERE a.business_id=$1 AND c.subject=$2 AND a.state='ACTIVE' ORDER BY a.start_at`,[s.config.businessId,subject])).rows as ObjectValue[]);}
 private activeText(s:LocalScope,rows:ObjectValue[]):string{const reverse=new Map([...s.bindings.employees].map(([k,v])=>[v,s.employeeNames.get(k)??k]));return rows.map(a=>`Tienes una cita confirmada el ${DateTime.fromISO(text(a['start_at'])).setZone(s.config.timeZone).setLocale('es').toFormat('d LLL HH:mm')} con ${reverse.get(text(a['resource_id']))??'el equipo'}.`).join('\n');}
 private async effects(s:LocalScope):Promise<void>{
  const b=s.config.businessId,provider=this.providers.get(b)!,now=await this.now(s),clock={now:()=>new Date(now)};
  const attempts=await s.dispatcher.tx(b,async db=>(await db.query<{id:string;state:string;envelope:Envelope;owner_id:string|null}>("SELECT id,state,envelope,owner_id FROM core.attempt WHERE business_id=$1 AND state NOT IN ('VERIFIED_APPLIED','ABANDONED') ORDER BY id",[b])).rows);
  for(const a of attempts){if(a.state==='SUBMISSION_ENTERED'||a.state==='UNKNOWN'){
    const proof=await reconcileReadOnly({envelope:a.envelope,provider});if(proof)await recordResult({proof,result:s.result,sealer:s.sealer,archive:s.archive});else await this.attention(s,'attempt/'+a.id,'UNKNOWN_OUTCOME_HELD',{attemptId:a.id});continue;
   }
   // Never reconstruct another owner's COMMIT continuation or invocation permit.
   if(a.state==='ARMED')continue;
   const ownerId=randomUUID();if(await armAttempt({businessId:b,attemptId:a.id,ownerId,dispatcher:s.dispatcher,sealer:s.sealer,archive:s.archive})){const outcome=await dispatchOnce({businessId:b,attemptId:a.id,ownerId,dispatcher:s.dispatcher,archive:s.archive,provider,clock,faults:this.faults});if(outcome.state==='APPLIED')await recordResult({proof:outcome.proof,result:s.result,sealer:s.sealer,archive:s.archive});}
  }
  const outputs=await s.reducer.tx(b,async db=>(await db.query<{id:string}>("SELECT id FROM core.output_intent o WHERE business_id=$1 AND state='PENDING' AND NOT EXISTS(SELECT 1 FROM core.attempt a WHERE a.business_id=$1 AND a.output_id=o.id)",[b])).rows);
  for(const o of outputs)await prepareOutput({businessId:b,outputId:o.id,reducer:s.reducer,sealer:s.sealer,archive:s.archive,clock});
 }
 private async replies(s:LocalScope):Promise<void>{
  const b=s.config.businessId,rows=await s.dispatcher.tx(b,async db=>(await db.query<{id:string;state:string}>("SELECT r.id,r.state FROM core.local_reply r JOIN core.input i ON i.business_id=r.business_id AND i.id=r.input_id WHERE r.business_id=$1 AND r.state NOT IN ('DELIVERED','EXPIRED') ORDER BY i.sequence",[b])).rows);
  for(const r of rows){if(r.state==='PENDING'){
    const entered=await s.dispatcher.tx(b,async db=>(await db.query<{v:boolean}>('SELECT core.local_reply_enter($1,$2) v',[b,r.id])).rows[0]!.v,'local-reply-entry',this.faults);if(!entered)continue;if(entered){await this.faults.hit('local-reply.afterEntry');await s.result.tx(b,async db=>{await db.query('SELECT core.local_provider_apply($1,$2,$3)',[b,{attemptId:r.id},'REPLY']);});await this.faults.hit('local-reply.afterProvider');}
   }
   const delivered=await s.result.tx(b,async db=>(await db.query<{v:boolean}>('SELECT core.local_reply_result($1,$2) v',[b,r.id])).rows[0]!.v);if(!delivered)await this.attention(s,'reply/'+r.id,'REPLY_UNKNOWN_HELD',{replyId:r.id});
  }
 }
 async snapshot(b:string,subject:string):Promise<ObjectValue>{
  const s=this.scope(b);return s.reducer.tx(b,async db=>{
   const inputs=(await db.query(`SELECT i.id,i.sequence,m.payload,m.state FROM core.input i JOIN core.local_message m ON m.business_id=i.business_id AND m.input_id=i.id WHERE i.business_id=$1 AND i.subject=$2 ORDER BY i.sequence`,[b,subject])).rows;
   const replies=(await db.query(`SELECT r.id,i.sequence,r.payload,r.state,r.deadline_at AS "expiresAt",r.revision FROM core.local_reply r JOIN core.input i ON i.business_id=r.business_id AND i.id=r.input_id WHERE r.business_id=$1 AND i.subject=$2 AND r.state='DELIVERED' UNION ALL SELECT o.id,i.sequence,o.payload,o.state,o.deadline_at,0 FROM core.output_intent o JOIN core.input i ON i.business_id=o.business_id AND i.id=o.input_id WHERE o.business_id=$1 AND i.subject=$2 AND o.state='ACCEPTED' ORDER BY sequence`,[b,subject])).rows;
   const appointments=(await db.query(`SELECT a.*,p.name AS "customerName" FROM core.appointment a JOIN core.customer c ON c.business_id=a.business_id AND c.id=a.customer_id LEFT JOIN core.local_customer p ON p.business_id=c.business_id AND p.customer_id=c.id WHERE a.business_id=$1 AND c.subject=$2 AND a.state='ACTIVE' ORDER BY a.start_at`,[b,subject])).rows;
   const calendar=(await db.query('SELECT * FROM core.local_calendar WHERE business_id=$1 ORDER BY start_at',[b])).rows;
   const diagnostics=(await db.query('SELECT code,detail FROM core.local_diagnostic WHERE business_id=$1 ORDER BY id',[b])).rows;
   const session=(await db.query('SELECT ls.revision FROM core.local_session ls JOIN core.conversation c ON c.business_id=ls.business_id AND c.id=ls.conversation_id WHERE ls.business_id=$1 AND c.subject=$2 AND c.channel_id=$3',[b,subject,s.channelId])).rows[0];
   const pending=(await db.query("SELECT count(*)::int n FROM core.attempt WHERE business_id=$1 AND envelope->>'recipient'=$2 AND state NOT IN ('VERIFIED_APPLIED','ABANDONED')",[b,subject])).rows[0]!.n;
   const serverNow=(await db.query<{v:string}>('SELECT core.local_now($1) v',[b])).rows[0]!.v;
   return object({businessId:b,subject,inputs,replies,appointments,calendar,diagnostics,currentRevision:session?.revision??0,serverNow,pendingEffects:pending});
  });
 }
}
