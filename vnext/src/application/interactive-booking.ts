import {upcomingAppointments,managementMenu,managementView,appointmentPicker,rescheduleContext,managementIntent,type ManagedAppointment,type ManagementState} from './appointment-management.js';
import type {ServiceCatalog,Catalog} from './service-catalog.js';
import {randomUUID,randomInt} from 'node:crypto';
import {AvailabilityOracle,type OracleView} from './availability-oracle.js';
import {protectedCalendar,type BookingBindings,type AvailabilitySignal} from './booking-composition.js';
import {prepareOperation,prepareOutput} from './prepare-operation.js';
import {armAttempt,dispatchOnce,reconcileReadOnly} from './dispatch-once.js';
import {recordResult} from './record-result.js';
import {reduceInput} from './reduce-input.js';
import {RecoveryWorker} from './recover-expired.js';
import {PlanConflictError,ConversationHeldError} from './plan-conflict.js';
import {AvailabilityHeldError,recheckSlot,eligibleSlotResources,type AvailabilityConfig,type SyntheticCalendarReader} from '../domain/availability.js';
import {parseAppointmentDate,explainDate} from '../domain/appointment-date.js';
import {normalizedText,ordinaryDecision,localRoutingDecision} from '../domain/classification.js';
import {bookingCustomerName,NAME_REPROMPT} from '../domain/customer-name.js';
import {appointmentOverview,delayedConfirmationOverview,appointmentSummaryMode} from '../domain/appointment-summary.js';
import {whatsappMessages} from '../domain/whatsapp-presentation.js';
import {shortDate} from '../domain/short-date.js';
import {digest,object,text,uuid,type ObjectValue,type Clock,type Faults,noFaults} from '../domain/protocol.js';
import type {UnitOfWork} from '../infrastructure/postgres/unit-of-work.js';
import type {EvidenceStore,Seal,Envelope,SyntheticProvider,AppliedProof} from '../ports.js';

export interface LocalScope {
 businessName?:string;catalog?:ServiceCatalog;
 config:AvailabilityConfig;bindings:BookingBindings;channelId:string;employeeNames:ReadonlyMap<string,string>;
 archive:EvidenceStore;ingress:UnitOfWork;reducer:UnitOfWork;sealer:UnitOfWork;dispatcher:UnitOfWork;result:UnitOfWork;
}
function catalogScope(s:LocalScope,catalog:Catalog,selected?:string):LocalScope{return {...s,config:s.catalog!.config(s.config,catalog,selected),bindings:{...s.bindings,employees:new Map(catalog.employees.map(e=>[e.id,e.id]))},employeeNames:new Map(catalog.employees.map(e=>[e.id,e.name]))};}
export interface LocalInput {kind:'TEXT'|'ACTION';value:string}
const safeReason=(e:unknown):string=>{const code=(e as {code?:unknown})?.code;return typeof code==='string'&&/^[A-Z0-9_]{1,64}$/.test(code)?code:'LOCAL_OPERATION_HELD';};
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
 constructor(scopes:readonly LocalScope[],private readonly faults:Faults=noFaults,private readonly employeeIndex:(count:number)=>number=count=>randomInt(count)){
  for(const s of scopes){const b=s.config.businessId;if(this.scopes.has(b)||s.archive.businessId!==b||s.bindings.businessId!==b)throw Error('interactive_tenant_binding_required');this.scopes.set(b,s);this.providers.set(b,new LocalProvider(b,s.result));}
  this.recovery=new RecoveryWorker(scopes.map(s=>({businessId:s.config.businessId,archive:s.archive,reducer:s.reducer,sealer:s.sealer})));
 }
 private scope(b:string):LocalScope{const s=this.scopes.get(b);if(!s)throw Error('interactive_route_denied');return s;}
 private async now(s:LocalScope):Promise<string>{return s.reducer.tx(s.config.businessId,async db=>(await db.query<{v:string}>('SELECT core.local_now($1) v',[s.config.businessId])).rows[0]!.v);}
 private async attention(s:LocalScope,key:string,code:string,detail:ObjectValue={}):Promise<void>{await s.reducer.tx(s.config.businessId,async db=>{await db.query('SELECT core.local_attention($1,$2,$3,$4)',[s.config.businessId,key,code,detail]);});}
 private reader(s:LocalScope,now:string,exclude?:ManagedAppointment):SyntheticCalendarReader{
  const b=s.config.businessId,reverse=new Map([...s.bindings.employees].map(([k,v])=>[v,k]));
  const source:SyntheticCalendarReader={mode:'L1_SYNTHETIC_ONLY',read:async(range,cursor)=>{
   if(cursor!==null||range.businessId!==b||range.calendarId!==s.config.calendarId)throw Error('local_calendar_scope');
   const rows=await s.reducer.tx(b,async db=>(await db.query('SELECT * FROM core.local_calendar WHERE business_id=$1 AND calendar_id=$2 ORDER BY id',[b,s.bindings.calendar.coreId])).rows as ObjectValue[]);
   return {...range,snapshotId:digest(rows),complete:true,nextCursor:null,events:rows.filter(r=>r['id']!==exclude?.eventId).map(r=>({businessId:b,calendarId:s.config.calendarId,id:text(r['id']),start:text(r['start_at']),end:text(r['end_at']),bufferMinutes:Number(r['buffer_minutes']),...(r['resource_id']?{resourceId:reverse.get(text(r['resource_id']))??text(r['resource_id'])}:{})}))};
  }};
  return protectedCalendar({config:s.config,bindings:s.bindings,source,reducer:s.reducer,now,...(exclude?{excludeAppointmentId:exclude.id}:{}),signal:(signal:AvailabilitySignal)=>{void this.attention(s,signal.code+'/'+signal.eventId,signal.code,object(signal)).catch(()=>{});}});
 }
 async submit(b:string,subject:string,requestId:string,payload:LocalInput):Promise<{inputId:string}>{
  const s=this.scope(b);uuid(requestId);if(!subject||subject.length>128||!payload||!['TEXT','ACTION'].includes(payload.kind)||typeof payload.value!=='string'||!payload.value.trim()||payload.value.length>1024||Object.keys(payload).some(k=>!['kind','value'].includes(k)))throw Error('local_input_schema');if(payload.kind==='ACTION')uuid(payload.value);
  const existing=await s.reducer.tx(b,async db=>(await db.query<{id:string}>('SELECT id FROM core.conversation WHERE business_id=$1 AND channel_id=$2 AND subject=$3',[b,s.channelId,subject])).rows[0]);
  const conv=await s.archive.ensure(`local-conversation/${b}/${s.channelId}/${digest(subject)}`,'LOCAL_CONVERSATION',{businessId:b,channelId:s.channelId,subject},()=>({conversationId:existing?.id??randomUUID()}));
  const receivedAt=await this.now(s);
  const routing=localRoutingDecision(payload);
  // Routing is allocated metadata, not a new stable-key intent: old receipts can
  // be resumed byte-for-byte without replacing their original admission identity.
  const input=await s.archive.ensure(`local-input/${b}/${requestId}`,'LOCAL_INPUT',{version:1,businessId:b,requestId,channelId:s.channelId,subject,payload:object(payload)},()=>({inputId:randomUUID(),conversationId:conv.body['conversationId']!,receivedAt,routing}));
  // Only the original admission time is frozen; SQL independently checks DB time.
  await s.sealer.seal(b,s.archive,input);const inputId=await s.ingress.tx(b,async db=>(await db.query<{v:string}>('SELECT core.local_admit($1,$2,$3,$4) v',[b,input.body,input.key,input.digest])).rows[0]!.v);
  if(payload.kind==='TEXT'&&['NAVIGATION','HUMAN_HANDOFF'].includes(routing.outcome))await reduceInput({businessId:b,inputId,reducer:s.reducer,sealer:s.sealer,archive:s.archive});
  return {inputId};
 }
 async tick():Promise<void>{if(this.inFlight)return this.inFlight;const work=this.pass();this.inFlight=work;void work.finally(()=>{if(this.inFlight===work)this.inFlight=undefined;}).catch(()=>{});return work;}
 start(interval=250):void{if(this.timer)throw Error('interactive_already_started');this.recovery.start(interval,e=>{for(const s of this.scopes.values())void this.attention(s,'recovery-worker','RECOVERY_HELD',{reason:safeReason(e)}).catch(()=>{});});this.timer=setInterval(()=>{void this.tick().catch(()=>{});},interval);void this.tick().catch(()=>{});}
 async stop():Promise<void>{clearInterval(this.timer);this.timer=undefined;await this.recovery.stop();await this.inFlight;}
 private async pass():Promise<void>{
  for(const [b,s] of this.scopes){
   try{await this.effects(s);await this.replies(s);
    const pending=await s.reducer.tx(b,async db=>(await db.query<{input_id:string}>(`SELECT m.input_id FROM core.local_message m JOIN core.input i ON i.business_id=m.business_id AND i.id=m.input_id WHERE m.business_id=$1 AND m.state<>'DONE' ORDER BY CASE WHEN EXISTS(SELECT 1 FROM core.input_reduction red WHERE red.business_id=m.business_id AND red.input_id=m.input_id AND red.outcome IN ('NAVIGATION','HUMAN_HANDOFF')) THEN 0 ELSE 1 END,i.sequence,i.id LIMIT 100`,[b])).rows);
    for(const row of pending)try{await this.process(s,row.input_id);}catch(e){await this.attention(s,'input/'+row.input_id,'INPUT_HELD',{reason:safeReason(e)});}
    const completed=await s.reducer.tx(b,async db=>(await db.query<{input_id:string}>(`SELECT m.input_id FROM core.local_message m JOIN core.input i ON i.business_id=m.business_id AND i.id=m.input_id WHERE m.business_id=$1 AND m.state='DONE' AND NOT EXISTS(SELECT 1 FROM core.operation op WHERE op.business_id=$1 AND op.input_id=m.input_id) AND NOT EXISTS(SELECT 1 FROM core.input_reduction r WHERE r.business_id=$1 AND r.input_id=m.input_id) ORDER BY i.sequence LIMIT 100`,[b])).rows);
    for(const row of completed)await reduceInput({businessId:b,inputId:row.input_id,reducer:s.reducer,sealer:s.sealer,archive:s.archive});
    await this.effects(s);await this.replies(s);
   }catch(e){await this.attention(s,'runtime-pass','RUNTIME_HELD',{reason:safeReason(e)}).catch(()=>{});}
  }
 }
 private async process(s:LocalScope,inputId:string):Promise<void>{
  const baseScope=s,b=s.config.businessId,claimed=await s.reducer.tx(b,async db=>(await db.query<{v:{status:string;claim:Claim}}>('SELECT core.local_claim($1,$2) v',[b,inputId])).rows[0]!.v,'local-claim',this.faults);if(claimed.status!=='CLAIMED')return;
  const c=claimed.claim,basis=c.basis??{};let catalog=s.catalog?await s.catalog.load():undefined;
  if(catalog){const selected=object(basis['oracle']??{})['serviceId'];s=catalogScope(s,catalog,typeof selected==='string'?selected:undefined);}
  const now=await this.now(s),clock:Clock={now:()=>new Date(now)};let management=basis['management'] as unknown as ManagementState|undefined,effectiveCatalog=catalog;
  if(catalog&&management?.mode==='MOVE'&&management.selected){const context=rescheduleContext(s.config,catalog,management.selected);if(context){s={...s,config:context.config};effectiveCatalog=context.catalog;}}
  let oracle=AvailabilityOracle.resume(s.config,this.reader(s,now,management?.mode==='MOVE'?management.selected:undefined),()=>now,object(basis['oracle']??{}),c.expiresAt,effectiveCatalog);
  const previousView=()=>{const {precedingTexts,...v}=object(basis['view']);void precedingTexts;return {...v,choices:(v['choices'] as ObjectValue[]).map(x=>({id:text(x['action']??x['id']),title:text(x['title'])}))} as unknown as OracleView;};
  const prior=await s.archive.lookup(`local-view/${b}/${inputId}`);if(prior){await this.finish(s,prior);return;}
  let view:OracleView|undefined,book:Seal|undefined,silent=false,mutation:'MOVE'|'CANCEL'|undefined;
  const n=normalizedText(c.payload.value),customer=await s.reducer.tx(b,async db=>(await db.query<{id:string;name:string}>('SELECT cu.id,p.name FROM core.customer cu LEFT JOIN core.local_customer p ON p.business_id=$1 AND p.customer_id=cu.id WHERE cu.business_id=$1 AND cu.subject=$2',[b,c.subject])).rows[0]);
  const reset=()=>{management=undefined;if(catalog)s=catalogScope(baseScope,catalog);else s=baseScope;oracle=new AvailabilityOracle(s.config,this.reader(s,now),()=>now,catalog);};
  const chooseMode=()=>{reset();management={mode:'CHOOSE',page:0,appointments:[]};return managementMenu(b,c.revision+1,now);};
  const pick=async(mode:'MOVE'|'CANCEL',page=0,prefix='')=>{reset();const result=appointmentPicker(b,c.revision+1,now,s.config.timeZone,mode,await upcomingAppointments(s.reducer,b,c.subject),page);management=result.state;if(prefix)result.view.text=prefix+'\n\n'+result.view.text;return result.view;};
  const recover=async(prefix:string)=>management?.mode==='MOVE'||management?.mode==='CANCEL'?pick(management.mode,0,prefix):chooseMode();
  const held=async(target:ManagedAppointment,reason:string)=>{const mode=management?.mode==='CANCEL'?'CANCEL':'MOVE';management={mode,page:0,appointments:[target]};await this.attention(s,'rc1/'+target.id+'/'+target.revision+'/'+catalog?.revision,reason,{appointmentId:target.id});return managementView(b,c.revision+1,now,'No pude ofrecer un cambio seguro para esta cita. El negocio debe verificarla; no se confirmó ningún cambio de esta solicitud.',[{kind:'rc1mode',value:mode,title:'Elegir otra cita'},{kind:'human',value:'0',title:'Hablar con alguien'}],'MANAGEMENT_HELD');};
  const ensureSelected=async()=>{if(!management?.selected||!catalog)return true;const target=management.selected,current=(await upcomingAppointments(s.reducer,b,c.subject)).find(a=>a.id===target.id);if(!current||digest(object(current))!==digest(object(target))){view=await recover('La cita cambió o ya no está disponible para esta acción. Elige de nuevo.');return false;}if(!rescheduleContext(catalogScope(baseScope,catalog).config,catalog,current)){view=await held(current,current.held?'RC1_OPERATION_HELD':'RC1_EMPLOYEE_INELIGIBLE');return false;}return true;};
  const operation=await s.reducer.tx(b,async db=>(await db.query<{plan:ObjectValue}>('SELECT plan FROM core.operation WHERE business_id=$1 AND input_id=$2',[b,inputId])).rows[0]);
  if(operation){book=await s.archive.lookup(`operation/${b}/${inputId}`)??undefined;if(!book)throw Error('operation_custody_missing');if(operation.plan['management']){const m=object(operation.plan['management']);management={mode:m['kind'] as 'MOVE'|'CANCEL',page:0,appointments:[],selected:m['appointment'] as unknown as ManagedAppointment};}}
  else try{
   if(basis['outcome']==='HUMAN_HANDOFF'&&!(c.payload.kind==='TEXT'&&n==='menu')){view=oracle.ordinary();silent=true;}
   else if(c.payload.kind==='TEXT'&&['menu','hola'].includes(n)){reset();view=oracle.menu();}
   else if(c.payload.kind==='TEXT'&&ordinaryDecision({type:'text',text:{body:c.payload.value}},'BOT','NONE').outcome==='HUMAN_HANDOFF'){reset();view=oracle.humano();}
   else if(c.payload.kind==='TEXT'&&['cita','agendar','reservar','horarios'].includes(n)){reset();view=await oracle.open(true);}
   else if(c.payload.kind==='TEXT'&&['reagendar','cancelar'].includes(n))view=catalog?await pick(n==='reagendar'?'MOVE':'CANCEL'):oracle.management();
   else if(c.error||((c.payload.kind==='ACTION'||basis['outcome']==='NAME_REQUIRED')&&Date.parse(c.expiresAt)<=Date.parse(now))){if(management)view=await recover('Esa opción venció o ya fue utilizada. Elige de nuevo.');else{oracle.menu();view=await oracle.open();view.text='Esa opción venció o ya fue utilizada. Elige un horario de nuevo.\n\n'+view.text;}}
   else if(catalog&&(c.payload.kind==='ACTION'||basis['outcome']==='NAME_REQUIRED')&&Number(object(basis['oracle']??{})['catalogRevision'])!==catalog.revision){if(management)view=await recover('Los servicios o el equipo cambiaron. Elige de nuevo.');else{oracle.menu();view=await oracle.open();view.text='Los servicios o el equipo cambiaron. Elige de nuevo.\n\n'+view.text;}}
   else if(c.payload.kind==='ACTION'){
    const [, ,kind,value]=c.action.split(':');
    if(catalog&&kind==='manage')view=chooseMode();
    else if(catalog&&kind==='rc1mode'&&(value==='MOVE'||value==='CANCEL'))view=await pick(value);
    else if(catalog&&kind==='rc1page'&&management&&management.mode!=='CHOOSE')view=await pick(management.mode,Number(value));
    else if(catalog&&(kind==='rc1move'||kind==='rc1cancel')&&management&&management.mode!=='CHOOSE'){
     const chosen=management.appointments.find(a=>a.id===value),current=(await upcomingAppointments(s.reducer,b,c.subject)).find(a=>a.id===value);
     if(!chosen||!current||digest(object(current))!==digest(object(chosen)))view=await recover('La cita cambió o ya no está disponible. Elige de nuevo.');
     else if(current.held||!current.service)view=await held(current,current.held?'RC1_OPERATION_HELD':'RC1_SNAPSHOT_MISSING');
     else if(kind==='rc1cancel'){management.selected=current;mutation='CANCEL';}
     else{const context=rescheduleContext(catalogScope(baseScope,catalog).config,catalog,current);if(!context)view=await held(current,'RC1_EMPLOYEE_INELIGIBLE');else{management.selected=current;s={...catalogScope(baseScope,catalog),config:context.config};oracle=new AvailabilityOracle(s.config,this.reader(s,now,current),()=>now,context.catalog);view=await oracle.open();view.text='Elige otro horario para tu cita con '+String(current.service['employeeName'])+'.\n\n'+view.text;}}
    }else if(kind==='human'){reset();view=oracle.humano();}
    else if(kind==='book'){reset();view=await oracle.open(true);}
    else if(await ensureSelected()){view=await oracle.action(c.action,management?.selected?true:!!customer?.name);if(management?.selected&&view.outcome==='BOOK_REQUEST')mutation='MOVE';}
   }
   else if(basis['outcome']==='NAME_REQUIRED'){
    const name=bookingCustomerName(c.payload.value);
    if(!name){view={...previousView(),text:NAME_REPROMPT,choices:[]};}
    else{const identity=await s.archive.ensure(`local-name/${b}/${inputId}`,'LOCAL_CUSTOMER',{businessId:b,inputId,name},()=>({customerId:randomUUID()}));await s.reducer.tx(b,async db=>{await db.query('SELECT core.local_name($1,$2,$3,$4)',[b,inputId,name,identity.body['customerId']]);});view=await oracle.nameCaptured();}
   }
   else if(!['OFFER','DATES','SERVICES'].includes(String(basis['outcome']))){reset();view=oracle.menu();}
   else if(await ensureSelected()){const parsed=parseAppointmentDate(c.payload.value,{now,timeZone:s.config.timeZone});if(parsed.success){view=await oracle.date(parsed.date!);if(view.choices.length===1&&parsed.fallback?.success)view=await oracle.date(parsed.fallback.date!);}else view={...previousView(),text:explainDate(c.payload.value,parsed,365)};}
   if(mutation&&management?.selected)book=await this.prepareManagement(s,c,mutation,management.selected,view,now,catalog!.revision);
   if(view?.outcome==='BOOK_REQUEST'&&!mutation){
    const known=await s.reducer.tx(b,async db=>(await db.query<{id:string;name:string}>('SELECT cu.id,p.name FROM core.customer cu JOIN core.local_customer p ON p.business_id=$1 AND p.customer_id=cu.id WHERE cu.business_id=$1 AND cu.subject=$2',[b,c.subject])).rows[0]);if(!known)throw Error('local_customer_missing');
    const original=await s.archive.lookup(`operation/${b}/${inputId}`);
    if(original){await s.sealer.seal(b,s.archive,original);await s.reducer.tx(b,async db=>{const r=(await db.query<{v:{state:string}}>('SELECT core.try_prepare_operation($1,$2,$3,$4) v',[b,original.body,original.digest,original.key])).rows[0]!.v;if(r.state!=='PREPARED')throw new PlanConflictError('P0001',true,new Error('terminal_plan_conflict'));});book=original;}
    else{
     const available=catalog?await eligibleSlotResources(s.config,this.reader(s,now),now,view.slot!):[await recheckSlot(s.config,this.reader(s,now),now,view.slot!)];
     const selectedSnapshot=view.slot!.serviceSnapshot;
     const intent=await s.archive.ensure(`local-intent/${b}/${inputId}`,'LOCAL_BOOKING_INTENT',{businessId:b,inputId},()=>{
      const index=catalog?this.employeeIndex(available.length):0;if(!Number.isInteger(index)||index<0||index>=available.length)throw Error('employee_allocation_denied');
      const selected=available[index]!,resourceId=s.bindings.employees.get(selected.resourceId);if(!resourceId)throw Error('local_resource_mapping');
      const slot={...selected,...(selectedSnapshot?{serviceSnapshot:selectedSnapshot}:{})};
      return {customerId:known.id,calendarId:s.bindings.calendar.coreId,resourceId,slot:object(slot)};
     });
     if(catalog)await this.faults.hit('catalog.afterEmployeeAllocation');
     const slot=object(intent.body['slot']) as unknown as import('../domain/availability.js').Slot,resourceId=text(intent.body['resourceId']);
     if(!available.some(x=>s.bindings.employees.get(x.resourceId)===resourceId&&Date.parse(x.startAt)===Date.parse(slot.startAt)))throw new AvailabilityHeldError('SLOT_UNAVAILABLE');
     await s.sealer.seal(b,s.archive,intent);await s.reducer.tx(b,async db=>{await db.query('SELECT core.local_intent($1,$2,$3,$4)',[b,intent.body,intent.key,intent.digest]);});
     const employeeName=s.employeeNames.get(slot.resourceId)??slot.resourceId,when=shortDate(slot.startAt,s.config.timeZone);
     const confirmation={text:`Tu cita está confirmada para ${when} con ${employeeName}.\n\n¡Te esperamos en ${s.businessName??'el negocio'}!`,choices:[],presentation:'TEXT' as const,outcome:'CONFIRMED',employee:employeeName,customer:known.name,startAt:slot.startAt,endAt:slot.endAt};whatsappMessages(confirmation);
     book=await prepareOperation({request:{businessId:b,inputId,customerId:known.id,calendarId:s.bindings.calendar.coreId,resourceId,startAt:slot.startAt,endAt:slot.endAt,bufferMinutes:slot.bufferMinutes,confirmation,...(slot.serviceSnapshot?{catalogRevision:catalog!.revision,serviceSnapshot:{...slot.serviceSnapshot,employeeName}}:{})},reducer:s.reducer,sealer:s.sealer,archive:s.archive,clock,faults:this.faults});
    }
   }
  }catch(e){
   if(e instanceof ConversationHeldError)return;
   if(e instanceof AvailabilityHeldError&&e.reason==='APPOINTMENT_HELD'&&management?.selected)view=await held(management.selected,'RC1_OPERATION_HELD');
   else if(e instanceof PlanConflictError||(e instanceof AvailabilityHeldError&&e.reason==='SLOT_UNAVAILABLE')||(e instanceof Error&&e.message==='local_action_expired')){
    if(s.catalog)catalog=await s.catalog.load();
    if(management)view=await recover('Esta solicitud no se confirmó. Revisa tus citas y elige de nuevo.');
    else{reset();oracle.menu();view=await oracle.open();view.text='Ese horario ya no está disponible o la reserva tardó demasiado. No se confirmó. Elige un horario de nuevo.\n\n'+view.text;}
   }else throw e;
  }
  if(!book&&!view)throw Error('local_view_missing');
  let reply:ObjectValue|null=null;
  if(!book){
   const mode=appointmentSummaryMode(c.payload,view!.outcome,silent);
   const active=mode==='NONE'?[]:await this.active(s,c.subject,mode==='ALL');
   const greeting=view!.outcome==='MENU'?`Hola${customer?.name?' '+customer.name:''}, bienvenido a ${s.businessName??'el negocio'}.`:'';
   const prefix=[greeting,this.activeText(s,active)].filter(Boolean).join('\n\n');
   if(prefix){
    if([...prefix+'\n\n'+view!.text].length<=1024)view!.text=prefix+'\n\n'+view!.text;
    else{const chunks:string[]=[];let chunk='',size=0;for(const line of prefix.split('\n')){if(size+(chunk?1:0)+[...line].length>4000){if(chunk)chunks.push(chunk);chunk='';size=0;}for(const char of (chunk?'\n':'')+line){if(size===4000){chunks.push(chunk);chunk='';size=0;}chunk+=char;size++;}}if(chunk)chunks.push(chunk);view!.precedingTexts=chunks;}
   }
   // Reference view/action IDs are replaced by independently allocated displayed IDs.
   if(!silent){const displayed={...view!,choices:view!.choices.map(x=>({id:randomUUID(),title:x.title,action:x.id}))};whatsappMessages(displayed);reply=object(displayed);}
   await reduceInput({businessId:b,inputId,reducer:s.reducer,sealer:s.sealer,archive:s.archive});
  }
  const saved=await s.archive.ensure(`local-view/${b}/${inputId}`,'LOCAL_VIEW',{businessId:b,inputId},()=>({revision:c.revision+1,replyId:randomUUID(),reply,state:{oracle:oracle.snapshot(),outcome:book?'BOOKING':view!.outcome,view:reply,...(management?{management:object(management)}:{})},...(book?{attemptId:book.body['attemptId']!}:{})}));await this.finish(s,saved);
 }
 private async prepareManagement(s:LocalScope,c:Claim,kind:'MOVE'|'CANCEL',target:ManagedAppointment,view:OracleView|undefined,now:string,catalogRevision:number):Promise<Seal>{
  const b=s.config.businessId,deadlineLimit=new Date(Math.min(Date.parse(c.expiresAt),Date.parse(target.startAt)-2000)).toISOString();
  if(Date.parse(deadlineLimit)-Date.parse(now)<=2000)throw new AvailabilityHeldError('SLOT_UNAVAILABLE');
  const management=managementIntent(kind,target,c.expiresAt),fresh=kind==='MOVE'?await recheckSlot(s.config,this.reader(s,now,target),now,view!.slot!):{businessId:b,calendarId:s.config.calendarId,resourceId:target.resourceId,serviceId:String(target.service!['id']),startAt:target.startAt,endAt:target.endAt,bufferMinutes:target.bufferMinutes,snapshotId:'RC1_CANCEL'};
  const slot=object({...fresh,serviceSnapshot:target.service!,catalogRevision,rc1:management});
  const intent=await s.archive.ensure(`local-intent/${b}/${c.inputId}`,'LOCAL_BOOKING_INTENT',{businessId:b,inputId:c.inputId},()=>({customerId:target.customerId,calendarId:target.calendarId,resourceId:target.resourceId,slot}));
  await this.faults.hit('rc1.afterIntentArchive');await s.sealer.seal(b,s.archive,intent);await s.reducer.tx(b,async db=>{await db.query('SELECT core.local_intent($1,$2,$3,$4)',[b,intent.body,intent.key,intent.digest]);});
  const saved=object(intent.body['slot']),startAt=text(saved['startAt']),endAt=text(saved['endAt']),employee=String(target.service!['employeeName']),service=String(target.service!['name']);
  const confirmation={text:kind==='MOVE'?`¡Tu cita está reagendada!\n\n${service}\nAntes: ${shortDate(target.startAt,s.config.timeZone)}\nAhora: ${shortDate(startAt,s.config.timeZone)}\nCon ${employee}.\n\n¡Te esperamos en ${s.businessName??'el negocio'}!`:`Tu cita de ${service} del ${shortDate(target.startAt,s.config.timeZone)} con ${employee} está cancelada.`,choices:[],presentation:'TEXT' as const,outcome:kind==='MOVE'?'RESCHEDULED':'CANCELLED',appointmentId:target.id,employee,startAt,endAt,oldStartAt:target.startAt,oldEndAt:target.endAt};whatsappMessages(confirmation);
  return prepareOperation({request:{businessId:b,inputId:c.inputId,customerId:target.customerId,calendarId:target.calendarId,resourceId:target.resourceId,kind,appointmentId:target.id,eventId:target.eventId,expectedRevision:target.revision,startAt,endAt,bufferMinutes:target.bufferMinutes,confirmation,catalogRevision,serviceSnapshot:target.service!,management:object(saved['rc1']),deadlineLimit},reducer:s.reducer,sealer:s.sealer,archive:s.archive,clock:{now:()=>new Date(now)},faults:this.faults});
 }
 private async finish(s:LocalScope,seal:Seal):Promise<void>{await s.sealer.seal(s.config.businessId,s.archive,seal);await s.reducer.tx(s.config.businessId,async db=>{await db.query('SELECT core.local_finish($1,$2,$3,$4)',[s.config.businessId,seal.body,seal.key,seal.digest]);},'local-view',this.faults);}
 private async active(s:LocalScope,subject:string,all=false):Promise<ObjectValue[]>{return s.reducer.tx(s.config.businessId,async db=>(await db.query(`
  SELECT a.*,a.start_at>=core.local_now($1) AS upcoming,max(i.sequence) AS last_sequence
  FROM core.appointment a JOIN core.customer c ON c.business_id=a.business_id AND c.id=a.customer_id
  LEFT JOIN core.operation op ON op.business_id=a.business_id AND op.appointment_id=a.id
  LEFT JOIN core.input i ON i.business_id=op.business_id AND i.id=op.input_id
  WHERE a.business_id=$1 AND c.subject=$2 AND a.state='ACTIVE'
  AND (a.start_at>=core.local_now($1) OR EXISTS(
   SELECT 1 FROM core.output_intent oi JOIN core.operation oc ON oc.business_id=oi.business_id AND oc.id=oi.parent_operation_id
   WHERE oi.business_id=a.business_id AND oc.appointment_id=a.id AND oi.state<>'ACCEPTED'))
  GROUP BY a.business_id,a.id
  ORDER BY ${all?'a.start_at,a.id':'max(i.sequence) DESC NULLS LAST,a.start_at DESC LIMIT 1'}`,[s.config.businessId,subject])).rows as ObjectValue[]);}
 private activeText(s:LocalScope,rows:ObjectValue[]):string{
  const item=(r:ObjectValue)=>({start:text(r['start_at']),end:text(r['end_at'])});
  return [appointmentOverview(rows.filter(r=>r['upcoming']===true).map(item),s.config.timeZone),...rows.filter(r=>r['upcoming']!==true).map(r=>delayedConfirmationOverview(item(r),s.config.timeZone))].filter(Boolean).join('\n\n');
 }
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
 /** Local cookie authenticates the fixture owner; signed session selects tenant.
  * No customer-facing or real-provider authorization is implied by this viewer. */
 async appointmentDetail(b:string,eventId:string):Promise<ObjectValue|null>{
  const s=this.scope(b);if(!eventId||eventId.length>256)throw Error('local_event_schema');
  const row=await s.reducer.tx(b,async db=>(await db.query(`SELECT ev.*,a.id AS appointment_id,a.state AS booking_status,c.subject AS contact,p.name AS customer_name,li.slot->>'serviceId' AS service_id,cl.value->>'ruleVersion' AS source_rule
   FROM core.local_calendar ev LEFT JOIN core.appointment a ON a.business_id=ev.business_id AND a.event_id=ev.id
   LEFT JOIN core.customer c ON c.business_id=a.business_id AND c.id=a.customer_id
   LEFT JOIN core.local_customer p ON p.business_id=c.business_id AND p.customer_id=c.id
   LEFT JOIN LATERAL (SELECT op.input_id FROM core.operation op WHERE op.business_id=a.business_id AND op.appointment_id=a.id ORDER BY op.expected_revision DESC LIMIT 1) op ON true
   LEFT JOIN core.local_booking_intent li ON li.business_id=ev.business_id AND li.input_id=op.input_id
   LEFT JOIN core.input_classification cl ON cl.business_id=ev.business_id AND cl.input_id=op.input_id
   WHERE ev.business_id=$1 AND ev.id=$2`,[b,eventId])).rows[0]);
  if(!row)return null;
  const service=s.catalog?await s.reducer.tx(b,async db=>(await db.query('SELECT snapshot FROM core.appointment_service WHERE business_id=$1 AND appointment_id=$2',[b,row.appointment_id])).rows[0]?.snapshot):undefined;
  const reverse=new Map([...s.bindings.employees].map(([k,v])=>[v,s.employeeNames.get(k)??k]));
  return object({eventId:row.id,appointmentId:row.appointment_id??null,customerName:row.customer_name??null,syntheticContact:row.contact??null,whatsappNumber:null,serviceId:service?.id??row.service_id??null,serviceName:service?.name??null,employee:service?.employeeName??reverse.get(row.resource_id)??null,startAt:row.start_at,endAt:row.end_at,durationMinutes:(Date.parse(row.end_at)-Date.parse(row.start_at))/60000,bufferMinutes:row.buffer_minutes,status:row.booking_status??null,bookingSource:row.source_rule==='L2-LOCAL-1'?'L2_LOCAL_SYNTHETIC':null,missingMetadata:service?['whatsappNumber']:['whatsappNumber','serviceName']});
 }
 ownerCatalog(b:string):ServiceCatalog|undefined{return this.scope(b).catalog;}
 async snapshot(b:string,subject:string):Promise<ObjectValue>{
  const s=this.scope(b);return s.reducer.tx(b,async db=>{
   const inputs=(await db.query(`SELECT i.id,i.sequence,m.payload,m.state FROM core.input i JOIN core.local_message m ON m.business_id=i.business_id AND m.input_id=i.id WHERE i.business_id=$1 AND i.subject=$2 ORDER BY i.sequence`,[b,subject])).rows;
   const replies=(await db.query(`SELECT r.id,i.sequence,r.payload,r.state,r.deadline_at AS "expiresAt",r.revision FROM core.local_reply r JOIN core.input i ON i.business_id=r.business_id AND i.id=r.input_id WHERE r.business_id=$1 AND i.subject=$2 AND r.state='DELIVERED' UNION ALL SELECT o.id,i.sequence,o.payload,o.state,o.deadline_at,0 FROM core.output_intent o JOIN core.input i ON i.business_id=o.business_id AND i.id=o.input_id WHERE o.business_id=$1 AND i.subject=$2 AND o.state='ACCEPTED' ORDER BY sequence`,[b,subject])).rows;
   const appointments=(await db.query(`SELECT a.*,p.name AS "customerName" FROM core.appointment a JOIN core.customer c ON c.business_id=a.business_id AND c.id=a.customer_id LEFT JOIN core.local_customer p ON p.business_id=c.business_id AND p.customer_id=c.id WHERE a.business_id=$1 AND c.subject=$2 AND a.state='ACTIVE' ORDER BY a.start_at`,[b,subject])).rows;
   const calendar=(await db.query(s.catalog?`SELECT ev.*,cs.snapshot->>'name' AS service_name,cs.snapshot->>'employeeName' AS employee_name FROM core.local_calendar ev LEFT JOIN core.appointment a ON a.business_id=ev.business_id AND a.event_id=ev.id LEFT JOIN core.appointment_service cs ON cs.business_id=a.business_id AND cs.appointment_id=a.id WHERE ev.business_id=$1 ORDER BY ev.start_at`:'SELECT * FROM core.local_calendar WHERE business_id=$1 ORDER BY start_at',[b])).rows;
   const diagnostics=(await db.query('SELECT code,detail FROM core.local_diagnostic WHERE business_id=$1 ORDER BY id',[b])).rows;
   const session=(await db.query('SELECT ls.revision,ls.state FROM core.local_session ls JOIN core.conversation c ON c.business_id=ls.business_id AND c.id=ls.conversation_id WHERE ls.business_id=$1 AND c.subject=$2 AND c.channel_id=$3',[b,subject,s.channelId])).rows[0];
   const pending=(await db.query("SELECT count(*)::int n FROM core.attempt WHERE business_id=$1 AND envelope->>'recipient'=$2 AND state NOT IN ('VERIFIED_APPLIED','ABANDONED')",[b,subject])).rows[0]!.n;
   const managementAttempt=(await db.query(`SELECT op.kind,atp.state FROM core.operation op JOIN core.attempt atp ON atp.business_id=op.business_id AND atp.operation_id=op.id JOIN core.input i ON i.business_id=op.business_id AND i.id=op.input_id WHERE op.business_id=$1 AND i.subject=$2 AND op.plan ? 'management' ORDER BY i.sequence DESC LIMIT 1`,[b,subject])).rows[0];
   let managementNotice='';if(managementAttempt){const state=managementAttempt.state;if(state==='SUBMISSION_ENTERED'||state==='UNKNOWN')managementNotice='Tu cambio sigue en verificación. Consulta su estado antes de solicitar otro cambio o reserva. La cita y sus horarios siguen protegidos mientras el negocio verifica el resultado.';else if(state==='PREPARED'||state==='ARMED')managementNotice='Estamos procesando tu solicitud. Aún no se ha confirmado ningún cambio.';else if(state==='ABANDONED'&&session?.state?.outcome==='BOOKING'&&session?.state?.management)managementNotice='La solicitud venció sin enviarse. No se realizó ese cambio. Escribe reagendar o cancelar para elegir de nuevo.';}
   const serverNow=(await db.query<{v:string}>('SELECT core.local_now($1) v',[b])).rows[0]!.v;
   const supportMessages=(await db.query('SELECT count(*)::int n FROM core.local_support_message WHERE business_id=$1',[b])).rows[0]!.n;
   return object({businessId:b,subject,inputs,replies,appointments,calendar,diagnostics,supportMessages,currentRevision:session?.revision??0,serverNow,pendingEffects:pending,managementNotice});
  });
 }
}
