import {DateTime} from 'luxon';
import {tenantId} from './tenant.js';
export interface Window {start:string;end:string}
export type Week=Readonly<Record<number,readonly Window[]>>;
export interface Service {id:string;durationMinutes:number;bufferMinutes:number}
export interface Employee {id:string;serviceIds:readonly string[];hours:Week;absences:readonly Window[]}
export interface AvailabilityConfig {businessId:string;calendarId:string;timeZone:string;hours:Week;breaks:Week;startIntervalMinutes:number;service:Service;employees:readonly Employee[]}
export interface CalendarEvent {businessId:string;calendarId:string;id:string;resourceId?:string;start:string;end:string;bufferMinutes?:number;state?:'ACTIVE'|'UNKNOWN'|'CANCELLED'}
export interface CalendarRange {businessId:string;calendarId:string;start:string;end:string}
export interface CalendarPage extends CalendarRange {snapshotId:string;events:readonly CalendarEvent[];nextCursor:string|null;complete:boolean}
export interface SyntheticCalendarReader {readonly mode:'L1_SYNTHETIC_ONLY';read(range:CalendarRange,cursor:string|null):Promise<CalendarPage>}
export interface Slot {businessId:string;calendarId:string;resourceId:string;serviceId:string;startAt:string;endAt:string;bufferMinutes:number;snapshotId:string}
export class AvailabilityHeldError extends Error {readonly code='AVAILABILITY_HELD';constructor(readonly reason:string,cause?:unknown){super('availability_held:'+reason,{cause});}}
const held=(s:string):never=>{throw new AvailabilityHeldError(s);};
export const minute=(s:string):number=>{if(!/^\d{2}:\d{2}$/.test(s))return held('INVALID_HOURS');const [h,m]=s.split(':').map(Number);if(h!>23||m!>59)return held('INVALID_HOURS');return h!*60+m!;};
const integer=(n:number,min:number)=>{if(!Number.isInteger(n)||n<min||n>1440)held('INVALID_MINUTES');};
function validateWeek(w:Week){if(!w||typeof w!=='object'||Array.isArray(w))held('INVALID_HOURS');for(const [key,list] of Object.entries(w)){if(!/^[1-7]$/.test(key)||!Array.isArray(list))held('INVALID_HOURS');for(const x of list)if(minute(x.start)>=minute(x.end))held('OVERNIGHT_UNSUPPORTED');}}
function instant(s:string):DateTime{if(typeof s!=='string'||!/(?:Z|[+-]\d\d:\d\d)$/.test(s))return held('INVALID_INSTANT');const d=DateTime.fromISO(s,{setZone:true});if(!d.isValid)return held('INVALID_INSTANT');return d;}
function local(day:DateTime,n:number):DateTime|null{const d=day.set({hour:Math.floor(n/60),minute:n%60,second:0,millisecond:0});return d.hour===Math.floor(n/60)&&d.minute===n%60?d:null;}
const overlap=(a:number,b:number,c:number,d:number)=>a<d&&b>c;
export function validateAvailability(c:AvailabilityConfig):void{
 tenantId(c.businessId);if(!c.calendarId||!DateTime.now().setZone(c.timeZone).isValid||!c.service?.id||'services' in c)held('INVALID_CONFIG');validateWeek(c.hours);validateWeek(c.breaks);integer(c.startIntervalMinutes,1);integer(c.service.durationMinutes,1);integer(c.service.bufferMinutes,0);
 if(!Array.isArray(c.employees)||new Set(c.employees.map(e=>e.id)).size!==c.employees.length)held('INVALID_EMPLOYEES');for(const e of c.employees){if(!e.id||!Array.isArray(e.serviceIds))held('INVALID_EMPLOYEES');validateWeek(e.hours);for(const a of e.absences)if(instant(a.start)>=instant(a.end))held('INVALID_ABSENCE');}
}
async function readComplete(reader:SyntheticCalendarReader,r:CalendarRange,deadline:number):Promise<{events:CalendarEvent[];snapshotId:string}>{
 if(reader.mode!=='L1_SYNTHETIC_ONLY')held('SYNTHETIC_READER_REQUIRED');let cursor:string|null=null,snapshotId:string|undefined;const seen=new Set<string>(),ids=new Map<string,string>(),events:CalendarEvent[]=[];
 for(let page=0;page<100;page++){
  let timer:ReturnType<typeof setTimeout>|undefined,p:CalendarPage;
  try{p=await Promise.race([reader.read(r,cursor),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AvailabilityHeldError('READ_DEADLINE')),Math.max(0,deadline-performance.now()));})]);}catch(e){if(e instanceof AvailabilityHeldError)throw e;throw new AvailabilityHeldError('READ_FAILED',e);}finally{clearTimeout(timer);}
  if(performance.now()>deadline)held('READ_DEADLINE');
  if(!p||p.businessId!==r.businessId||p.calendarId!==r.calendarId||p.start!==r.start||p.end!==r.end||typeof p.snapshotId!=='string'||!p.snapshotId||!Array.isArray(p.events)||typeof p.complete!=='boolean'||(p.nextCursor!==null&&(typeof p.nextCursor!=='string'||!p.nextCursor)))held('PAGE_SCOPE_OR_SCHEMA');
  if(snapshotId&&p.snapshotId!==snapshotId)held('SNAPSHOT_CHANGED');snapshotId=p.snapshotId;
  for(const e of p.events){if(!e||typeof e!=='object'||e.businessId!==r.businessId||e.calendarId!==r.calendarId||typeof e.id!=='string'||!e.id||instant(e.start)>=instant(e.end)||!['ACTIVE','UNKNOWN','CANCELLED',undefined].includes(e.state))held('EVENT_SCOPE_OR_SCHEMA');if(e.bufferMinutes!==undefined)integer(e.bufferMinutes,0);if(e.resourceId!==undefined&&(!e.resourceId||typeof e.resourceId!=='string'))held('EVENT_RESOURCE');const encoded=JSON.stringify(e);if(ids.has(e.id)&&ids.get(e.id)!==encoded)held('EVENT_CONFLICT');if(!ids.has(e.id)){ids.set(e.id,encoded);events.push(e);}}
  if(p.nextCursor===null){if(!p.complete)held('INCOMPLETE');return {events,snapshotId};}if(p.complete||seen.has(p.nextCursor))held('CURSOR_CONFLICT');seen.add(p.nextCursor);cursor=p.nextCursor;
 }
 return held('PAGE_LIMIT');
}
function candidates(c:AvailabilityConfig,events:readonly CalendarEvent[],now:DateTime,from:DateTime,to:DateTime,snapshotId:string):Slot[]{
 const out:Slot[]=[];for(let day=from.startOf('day');day<to;day=day.plus({days:1}))for(const w of c.hours[day.weekday]??[]){const open=minute(w.start),close=local(day,minute(w.end));if(!close)continue;
  for(let m=open;m<minute(w.end);m+=c.startIntervalMinutes){const start=local(day,m);if(!start||start<=now||start<from||start>=to)continue;const end=start.plus({minutes:c.service.durationMinutes}),occupied=end.plus({minutes:c.service.bufferMinutes});if(occupied>close||occupied>to)continue;
   const first=start.toMillis(),last=occupied.toMillis();if((c.breaks[day.weekday]??[]).some(x=>{const a=local(day,minute(x.start)),b=local(day,minute(x.end));return !a||!b||overlap(first,last,a.toMillis(),b.toMillis());}))continue;
   for(const employee of c.employees){if(!employee.serviceIds.includes(c.service.id))continue;
    if(!(employee.hours[day.weekday]??[]).some(x=>{const a=local(day,minute(x.start)),b=local(day,minute(x.end));return a&&b&&start>=a&&occupied<=b;}))continue;
    if(employee.absences.some(x=>overlap(first,last,instant(x.start).toMillis(),instant(x.end).toMillis())))continue;
    if(events.some(e=>e.state!=='CANCELLED'&&(!e.resourceId||e.resourceId===employee.id)&&overlap(first,last,instant(e.start).toMillis(),instant(e.end).plus({minutes:e.bufferMinutes??c.service.bufferMinutes}).toMillis())))continue;
    out.push({businessId:c.businessId,calendarId:c.calendarId,resourceId:employee.id,serviceId:c.service.id,startAt:start.toISO()!,endAt:end.toISO()!,bufferMinutes:c.service.bufferMinutes,snapshotId});
   }
  }
 }
 // P0 shows one slot per time, picking the deterministic first eligible resource.
 return out.sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)||a.resourceId.localeCompare(b.resourceId,'en')).filter((s,i,a)=>i===0||Date.parse(s.startAt)!==Date.parse(a[i-1]!.startAt));
}
export async function searchAvailability(c:AvailabilityConfig,reader:SyntheticCalendarReader,nowIso:string,query:{date?:string;afterDate?:string}={},budgetMs=1000):Promise<Slot[]>{
 validateAvailability(c);if(!Number.isInteger(budgetMs)||budgetMs<1||budgetMs>10000)held('INVALID_BUDGET');const deadline=performance.now()+budgetMs,now=instant(nowIso).setZone(c.timeZone),horizon=now.plus({days:365});
 const date=(s:string)=>{const d=DateTime.fromISO(s,{zone:c.timeZone});if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!d.isValid||d.toISODate()!==s||d<now.startOf('day')||d>=horizon)held('DATE_OUT_OF_RANGE');return d;};
 if(query.date&&query.afterDate)held('INVALID_QUERY');let start=query.date?DateTime.max(date(query.date),now):query.afterDate?DateTime.max(date(query.afterDate).plus({days:1}),now):now;
 let end=query.date?DateTime.min(start.startOf('day').plus({days:1}),horizon):DateTime.min(start.startOf('day').plus({days:30}),horizon);const history:CalendarEvent[]=[],slots:Slot[]=[];let snapshot:string|undefined;
 while(start<horizon){
  const r:CalendarRange={businessId:c.businessId,calendarId:c.calendarId,start:start.minus({minutes:1440}).toISO()!,end:end.toISO()!},read=await readComplete(reader,r,deadline);if(snapshot&&snapshot!==read.snapshotId)held('SNAPSHOT_CHANGED');if(read.events.some(e=>e.resourceId&&!c.employees.some(x=>x.id===e.resourceId)))held('EVENT_RESOURCE');snapshot=read.snapshotId;history.push(...read.events);
  slots.push(...candidates(c,history,now,start,end,snapshot));if(performance.now()>deadline)held('READ_DEADLINE');const dates=[...new Set(slots.map(s=>instant(s.startAt).setZone(c.timeZone).toISODate()))];
  if(query.date||dates.length>=3){const first=new Set(dates.slice(0,3));return slots.filter(s=>first.has(instant(s.startAt).setZone(c.timeZone).toISODate()));}
  start=end;end=DateTime.min(end.plus({days:15}),horizon);
 }
 return slots;
}
export async function recheckSlot(c:AvailabilityConfig,reader:SyntheticCalendarReader,now:string,slot:Slot):Promise<Slot>{
 if(slot.businessId!==c.businessId||slot.calendarId!==c.calendarId||slot.serviceId!==c.service.id)held('SLOT_SCOPE');const date=instant(slot.startAt).setZone(c.timeZone).toISODate()!;
 const fresh=await searchAvailability(c,reader,now,{date});const same=fresh.find(x=>x.resourceId===slot.resourceId&&Date.parse(x.startAt)===Date.parse(slot.startAt)&&Date.parse(x.endAt)===Date.parse(slot.endAt)&&x.bufferMinutes===slot.bufferMinutes);if(!same)return held('SLOT_UNAVAILABLE');return same;
}
