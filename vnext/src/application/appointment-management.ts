import type {ObjectValue} from '../domain/protocol.js';
import {object} from '../domain/protocol.js';
import type {AvailabilityConfig} from '../domain/availability.js';
import type {OracleView} from './availability-oracle.js';
import type {Catalog} from './service-catalog.js';
import type {UnitOfWork} from '../infrastructure/postgres/unit-of-work.js';
import {shortDate} from '../domain/short-date.js';
export interface ManagedAppointment {
 id:string;revision:number;customerId:string;calendarId:string;resourceId:string;eventId:string;
 startAt:string;endAt:string;bufferMinutes:number;service:ObjectValue|null;held:boolean;
}
export interface ManagementState {mode:'CHOOSE'|'MOVE'|'CANCEL';page:number;appointments:ManagedAppointment[];selected?:ManagedAppointment}
export async function upcomingAppointments(db:UnitOfWork,business:string,subject:string):Promise<ManagedAppointment[]>{
 return db.tx(business,async client=>(await client.query(`SELECT a.id,a.revision::int,a.customer_id AS "customerId",a.calendar_id AS "calendarId",a.resource_id AS "resourceId",a.event_id AS "eventId",a.start_at AS "startAt",a.end_at AS "endAt",a.buffer_minutes AS "bufferMinutes",cs.snapshot AS service,EXISTS(SELECT 1 FROM core.mutation_guard g WHERE g.business_id=a.business_id AND g.appointment_id=a.id) held FROM core.appointment a JOIN core.customer c ON c.business_id=a.business_id AND c.id=a.customer_id LEFT JOIN core.appointment_service cs ON cs.business_id=a.business_id AND cs.appointment_id=a.id WHERE a.business_id=$1 AND c.subject=$2 AND a.state='ACTIVE' AND a.start_at>core.local_now($1) ORDER BY a.start_at,a.id`,[business,subject])).rows as ManagedAppointment[]);
}
export function managementView(business:string,revision:number,now:string,text:string,choices:{kind:string;value:string;title:string}[],outcome:OracleView['outcome']='MANAGE'):OracleView{
 return {text,choices:choices.map(c=>({id:`${business}:${revision}:${c.kind}:${c.value}`,title:c.title})),outcome,viewRevision:revision,expiresAt:new Date(Date.parse(now)+900000).toISOString(),presentation:outcome==='APPOINTMENTS'&&choices.length?'LIST':choices.length?'REPLY_BUTTONS':'TEXT'};
}
export function managementMenu(business:string,revision:number,now:string):OracleView{return managementView(business,revision,now,'¿Qué te gustaría hacer con tu cita?',[{kind:'rc1mode',value:'MOVE',title:'Reagendar'},{kind:'rc1mode',value:'CANCEL',title:'Cancelar'}]);}
export function appointmentPicker(business:string,revision:number,now:string,zone:string,mode:'MOVE'|'CANCEL',rows:ManagedAppointment[],page=0):{state:ManagementState;view:OracleView}{
 const p=Math.max(0,Math.min(page,Math.max(0,Math.ceil(rows.length/3)-1))),list=rows.slice(p*3,p*3+3);
 const prompt=mode==='CANCEL'?'Selecciona la cita que deseas cancelar. Se cancelará al seleccionarla.':'Selecciona la cita que deseas reagendar.';
 const detail=list.map((a,i)=>`${p*3+i+1}. ${a.service?.['name']??'Servicio no registrado'} · ${shortDate(a.startAt,zone)} · ${a.service?.['employeeName']??'Empleado asignado'}`).join('\n');
 const choices=list.map((a,i)=>({kind:mode==='MOVE'?'rc1move':'rc1cancel',value:a.id,title:[...`${p*3+i+1}. ${shortDate(a.startAt,zone)}`].slice(0,24).join('')}));
 if(p>0)choices.push({kind:'rc1page',value:String(p-1),title:'Citas anteriores'});if((p+1)*3<rows.length)choices.push({kind:'rc1page',value:String(p+1),title:'Más citas'});
 return {state:{mode,page:p,appointments:list},view:managementView(business,revision,now,rows.length?prompt+'\n\n'+detail:'No encontré citas próximas. Si deseas agendar una nueva cita, escribe "cita".',choices,'APPOINTMENTS')};
}
/** Use the immutable booked service and original employee; retain all known IDs
 * so unrelated calendar events never become unknown/unassigned blockers. */
export function rescheduleContext(base:AvailabilityConfig,catalog:Catalog,appointment:ManagedAppointment):{config:AvailabilityConfig;catalog:Catalog}|null{
 const service=appointment.service,employee=catalog.employees.find(e=>e.id===appointment.resourceId),current=catalog.services.find(s=>s.id===service?.['id']);
 if(!service||!current||!employee?.active||!employee.serviceIds.includes(current.id)||appointment.held)return null;
 const frozen={id:current.id,name:String(service['name']),description:String(service['description']),durationMinutes:(Date.parse(appointment.endAt)-Date.parse(appointment.startAt))/60000,bufferMinutes:appointment.bufferMinutes,priceMinor:Number(service['priceMinor']),currency:String(service['currency']),active:true};
 return {config:{...base,catalogRevision:catalog.revision,excludeStartAt:appointment.startAt,service:frozen,employees:base.employees.map(e=>({...e,serviceIds:e.id===employee.id?[current.id]:[]}))},catalog:{...catalog,services:[frozen]}};
}
export function managementIntent(mode:'MOVE'|'CANCEL',appointment:ManagedAppointment,expiresAt:string):ObjectValue{return object({kind:mode,appointment,expiresAt});}
