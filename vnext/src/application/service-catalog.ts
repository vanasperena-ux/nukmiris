import {object,uuid,type ObjectValue} from '../domain/protocol.js';
import type {AvailabilityConfig,Week} from '../domain/availability.js';
import type {UnitOfWork} from '../infrastructure/postgres/unit-of-work.js';
export interface CatalogService {id:string;name:string;description:string;durationMinutes:number;bufferMinutes:number;priceMinor:number;currency:string;active:boolean}
export interface CatalogEmployee {id:string;calendarId:string;name:string;active:boolean;hours:Week;serviceIds:string[]}
export interface Catalog {revision:number;services:CatalogService[];employees:CatalogEmployee[]}
const exact=(v:ObjectValue,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const label=(v:unknown,min=1,max=120)=>typeof v==='string'&&v.trim()===v&&[...v].length>=min&&[...v].length<=max&&!/[\p{Cc}\p{Cf}]/u.test(v);
export function validateCatalogItem(kind:string,value:ObjectValue):void{
 if(kind==='service'){
  if(!exact(value,['id','name','description','durationMinutes','bufferMinutes','priceMinor','currency','active'])||typeof value['id']!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value['id'])||!label(value['name'])||(typeof value['description']!=='string'||[...value['description']].length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value['description']))||typeof value['active']!=='boolean'||typeof value['currency']!=='string'||!/^[A-Z]{3}$/.test(value['currency']))throw Error('catalog_service_invalid');
  for(const [field,min,max] of [['durationMinutes',1,1440],['bufferMinutes',0,1440],['priceMinor',0,999999999]] as const){const n=value[field];if(typeof n!=='number'||!Number.isSafeInteger(n)||n<min||n>max)throw Error('catalog_service_invalid');}
 }else if(kind==='employee'){
  if(!exact(value,['id','calendarId','name','active','hours','serviceIds'])||!label(value['name'])||typeof value['active']!=='boolean'||!Array.isArray(value['serviceIds'])||value['serviceIds'].some(id=>typeof id!=='string')||new Set(value['serviceIds']).size!==value['serviceIds'].length)throw Error('catalog_employee_invalid');
  uuid(value['id']);uuid(value['calendarId']);const hours=object(value['hours']);for(const [day,windows] of Object.entries(hours)){if(!/^[1-7]$/.test(day)||!Array.isArray(windows))throw Error('catalog_hours_invalid');let prior='';for(const w of windows){const x=object(w);if(!exact(x,['start','end'])||typeof x['start']!=='string'||typeof x['end']!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x['start'])||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x['end'])||x['start']>=x['end']||x['start']<prior)throw Error('catalog_hours_invalid');prior=x['end'];}}
 }else throw Error('catalog_kind_denied');
}
export function serviceSnapshot(s:CatalogService):ObjectValue{const {active,...snapshot}=s;void active;return object(snapshot);}
export class ServiceCatalog {
 constructor(readonly businessId:string,private readonly reader:UnitOfWork,private readonly operator:UnitOfWork){}
 async load():Promise<Catalog>{return this.reader.tx(this.businessId,async db=>{
  // One statement snapshot keeps the revision and both collections coherent.
  const row=(await db.query(`SELECT h.revision,
   coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'durationMinutes',s.duration_minutes,'bufferMinutes',s.buffer_minutes,'priceMinor',s.price_minor,'currency',s.currency,'active',s.active) ORDER BY s.id) FROM core.service s WHERE s.business_id=h.business_id),'[]') AS services,
   coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'calendarId',e.calendar_id,'name',e.name,'active',e.active,'hours',e.hours,'serviceIds',coalesce((SELECT jsonb_agg(q.service_id ORDER BY q.service_id) FROM core.qualification q WHERE q.business_id=h.business_id AND q.employee_id=e.id),'[]')) ORDER BY e.id) FROM core.employee e WHERE e.business_id=h.business_id),'[]') AS employees
   FROM core.catalog_head h WHERE h.business_id=$1`,[this.businessId])).rows[0];
  if(!row)throw Error('catalog_not_initialized');return {revision:Number(row.revision),services:row.services as CatalogService[],employees:row.employees as CatalogEmployee[]};
 });}

 async save(requestId:string,expected:number,kind:string,value:ObjectValue):Promise<number>{uuid(requestId);if(!Number.isSafeInteger(expected)||expected<1)throw Error('catalog_revision_invalid');validateCatalogItem(kind,value);return this.operator.tx(this.businessId,async db=>Number((await db.query('SELECT core.catalog_save($1,$2,$3,$4,$5) v',[this.businessId,requestId,expected,kind,value])).rows[0].v));}
 async appointments():Promise<ObjectValue[]>{return this.reader.tx(this.businessId,async db=>(await db.query(`SELECT a.id,a.start_at AS "startAt",a.end_at AS "endAt",a.state AS status,a.buffer_minutes AS "bufferMinutes",lc.name AS customer,cs.service_id AS "serviceId",cs.snapshot AS service,coalesce(cs.snapshot->>'employeeName',e.name) AS employee,(extract(epoch FROM(a.end_at-a.start_at))/60)::float8 AS "durationMinutes",EXISTS(SELECT 1 FROM core.operation co JOIN core.attempt ca ON ca.business_id=co.business_id AND ca.operation_id=co.id WHERE co.business_id=a.business_id AND co.appointment_id=a.id AND co.kind='CANCEL' AND ca.state='VERIFIED_APPLIED') AS "cancellationProven",coalesce((SELECT jsonb_agg(jsonb_build_object('operationId',h.operation_id,'kind',h.kind,'origin',h.origin,'requestedAt',h.requested_at,'appliedAt',h.applied_at,'before',h.before_value,'after',h.after_value) ORDER BY (h.after_value->>'revision')::bigint) FROM core.rc1_history h WHERE h.business_id=a.business_id AND h.appointment_id=a.id),'[]') history,coalesce((SELECT jsonb_agg(jsonb_build_object('kind',op.kind,'state',atp.state)) FROM core.operation op JOIN core.attempt atp ON atp.business_id=op.business_id AND atp.operation_id=op.id WHERE op.business_id=a.business_id AND op.appointment_id=a.id AND op.kind IN ('MOVE','CANCEL') AND atp.state NOT IN ('VERIFIED_APPLIED','ABANDONED')),'[]') pending FROM core.appointment a LEFT JOIN core.local_customer lc ON lc.business_id=a.business_id AND lc.customer_id=a.customer_id LEFT JOIN core.appointment_service cs ON cs.business_id=a.business_id AND cs.appointment_id=a.id LEFT JOIN core.employee e ON e.business_id=a.business_id AND e.id=a.resource_id WHERE a.business_id=$1 ORDER BY a.start_at,a.id`,[this.businessId])).rows as ObjectValue[]);}
 config(base:AvailabilityConfig,catalog:Catalog,serviceId?:string):AvailabilityConfig{
  const service=catalog.services.find(s=>s.id===serviceId&&s.active)??catalog.services.find(s=>s.active);
  // No active service => no bookable employee. Retain every known resource for busy history.
  return {...base,catalogRevision:catalog.revision,service:service??{id:'catalog-empty',durationMinutes:60,bufferMinutes:0},employees:catalog.employees.map(e=>({id:e.id,serviceIds:e.active&&service?e.serviceIds:[],hours:e.hours,absences:base.employees.find(old=>old.id===e.id)?.absences??[]}))};
 }
}
