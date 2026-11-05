import type {CalendarEvent,CalendarRange,CalendarPage,SyntheticCalendarReader,AvailabilityConfig} from '../../src/domain/availability.js';
export class FakeAvailabilityCalendar implements SyntheticCalendarReader {
 readonly mode='L1_SYNTHETIC_ONLY';version=1;readonly reads:CalendarRange[]=[];fail=false;partial=false;pageSize=2;events:CalendarEvent[]=[];
 async read(range:CalendarRange,cursor:string|null):Promise<CalendarPage>{
  this.reads.push({...range});if(this.fail)throw Error('synthetic_calendar_unavailable');const events=this.events.filter(e=>e.businessId===range.businessId&&e.calendarId===range.calendarId&&Date.parse(e.start)<Date.parse(range.end)&&Date.parse(e.end)>Date.parse(range.start)),offset=cursor?Number(cursor):0;
  return {...range,snapshotId:String(this.version),events:structuredClone(events.slice(offset,offset+this.pageSize)),nextCursor:offset+this.pageSize<events.length?String(offset+this.pageSize):null,complete:!this.partial&&offset+this.pageSize>=events.length};
 }
}
export function l1Config(zone='America/Mexico_City'):AvailabilityConfig {
 const hours=Object.fromEntries([1,2,3,4,5,6,7].map(d=>[d,[{start:'09:00',end:'17:00'}]]));return {businessId:'synthetic-a',calendarId:'calendar-a',timeZone:zone,hours,breaks:{},startIntervalMinutes:30,service:{id:'implicit-p0',durationMinutes:60,bufferMinutes:15},employees:[{id:'employee-a',serviceIds:['implicit-p0'],hours,absences:[]}]};
}
