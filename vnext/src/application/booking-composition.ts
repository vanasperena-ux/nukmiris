import {DateTime} from 'luxon';
import {digest,uuid,type Clock} from '../domain/protocol.js';
import {AvailabilityHeldError,recheckSlot,type AvailabilityConfig,type SyntheticCalendarReader,type CalendarEvent,type Slot} from '../domain/availability.js';
import type {UnitOfWork} from '../infrastructure/postgres/unit-of-work.js';
import type {EvidenceStore,Seal} from '../ports.js';
import {prepareOperation} from './prepare-operation.js';
export interface BookingBindings {businessId:string;calendar:{id:string;coreId:string};employees:ReadonlyMap<string,string>}
export interface AvailabilitySignal {code:'UNKNOWN_CALENDAR_RESOURCE'|'UNKNOWN_LOCAL_PROTECTION_RESOURCE';businessId:string;calendarId:string;eventId:string;resourceId:string}
interface Protection {appointmentId:string;operationId:string;resourceId:string;startAt:string;endAt:string}
function validate(c:AvailabilityConfig,b:BookingBindings):void{
 if(b.businessId!==c.businessId||b.calendar.id!==c.calendarId||c.employees.some(e=>!b.employees.has(e.id))||[...b.employees.keys()].some(id=>!c.employees.some(e=>e.id===id)))throw Error('booking_binding_denied');uuid(b.calendar.coreId);for(const id of b.employees.values())uuid(id);
 if(new Set(b.employees.values()).size!==b.employees.size)throw Error('booking_resource_binding_ambiguous');
}
/** Read observation only. SQL exclusion/guards remain the reservation authority. */
export function protectedCalendar(args:{config:AvailabilityConfig;source:SyntheticCalendarReader;bindings:BookingBindings;reducer:UnitOfWork;now:string;signal:(s:AvailabilitySignal)=>void}):SyntheticCalendarReader{
 const {config:c,source,bindings:b,reducer}=args;validate(c,b);if(source.mode!=='L1_SYNTHETIC_ONLY')throw Error('synthetic_calendar_required');const notices=new Set<string>(),reverse=new Map([...b.employees].map(([name,id])=>[id,name]));
 const now=DateTime.fromISO(args.now,{setZone:true}).setZone(c.timeZone);if(!now.isValid)throw Error('availability_clock_invalid');const from=now.minus({minutes:1440}).toISO()!,until=now.plus({days:365}).toISO()!;
 const notice=(code:AvailabilitySignal['code'],eventId:string,resourceId:string)=>{const key=code+'/'+eventId+'/'+resourceId;if(!notices.has(key)){notices.add(key);args.signal({code,businessId:c.businessId,calendarId:c.calendarId,eventId,resourceId});}};
 return {mode:'L1_SYNTHETIC_ONLY',async read(range,cursor){
  if(range.businessId!==c.businessId||range.calendarId!==c.calendarId)throw new AvailabilityHeldError('CALENDAR_SCOPE');
  const rows=await reducer.tx(c.businessId,async db=>(await db.query<Protection>(`SELECT pr.appointment_id::text AS "appointmentId",pr.operation_id::text AS "operationId",pr.resource_id::text AS "resourceId",lower(pr.protected_range) AS "startAt",upper(pr.protected_range) AS "endAt"
   FROM core.protection pr JOIN core.appointment a ON a.business_id=pr.business_id AND a.id=pr.appointment_id
   WHERE pr.business_id=$1 AND a.calendar_id=$2 AND pr.protected_range && tstzrange($3::timestamptz,$4::timestamptz,'[)')
   ORDER BY pr.resource_id,pr.appointment_id,lower(pr.protected_range)`,[c.businessId,b.calendar.coreId,from,until])).rows);
  const page=await source.read(range,cursor);if(page.businessId!==c.businessId||page.calendarId!==c.calendarId||!Array.isArray(page.events))throw new AvailabilityHeldError('CALENDAR_SCOPE');
  const events:CalendarEvent[]=page.events.map(e=>{if(e.businessId!==c.businessId||e.calendarId!==c.calendarId)throw new AvailabilityHeldError('EVENT_SCOPE_OR_SCHEMA');if(e.resourceId&&!c.employees.some(x=>x.id===e.resourceId)){notice('UNKNOWN_CALENDAR_RESOURCE',e.id,e.resourceId);const {resourceId,...unassigned}=e;void resourceId;return unassigned;}return e;});
  for(const p of rows){if(Date.parse(p.startAt)>=Date.parse(range.end)||Date.parse(p.endAt)<=Date.parse(range.start))continue;const id='local-protection/'+p.appointmentId+'/'+p.operationId+'/'+p.resourceId+'/'+p.startAt,resourceId=reverse.get(p.resourceId);if(!resourceId)notice('UNKNOWN_LOCAL_PROTECTION_RESOURCE',id,p.resourceId);
   // Range upper already includes the reservation's buffer: never add it twice.
   events.push({businessId:c.businessId,calendarId:c.calendarId,id,start:p.startAt,end:p.endAt,bufferMinutes:0,state:'UNKNOWN',...(resourceId?{resourceId}:{})});
  }
  return {...page,events,snapshotId:digest({calendar:page.snapshotId,protections:rows.map(p=>({...p}))})};
 }};
}
export async function prepareBookingSelection(args:{config:AvailabilityConfig;source:SyntheticCalendarReader;bindings:BookingBindings;reducer:UnitOfWork;sealer:UnitOfWork;archive:EvidenceStore;clock:Clock;inputId:string;customerId:string;slot:Slot;signal:(s:AvailabilitySignal)=>void}):Promise<{slot:Slot;plan:Seal}>{
 const c=args.config;if(args.archive.businessId!==c.businessId)throw Error('booking_tenant_archive_binding_required');const reader=protectedCalendar({...args,now:args.clock.now().toISOString()});const slot=await recheckSlot(c,reader,args.clock.now().toISOString(),args.slot),resourceId=args.bindings.employees.get(slot.resourceId);if(!resourceId)throw Error('booking_resource_binding_missing');
 const plan=await prepareOperation({request:{businessId:c.businessId,inputId:args.inputId,customerId:args.customerId,calendarId:args.bindings.calendar.coreId,resourceId,startAt:slot.startAt,endAt:slot.endAt,bufferMinutes:slot.bufferMinutes},reducer:args.reducer,sealer:args.sealer,archive:args.archive,clock:args.clock});return {slot,plan};
}
