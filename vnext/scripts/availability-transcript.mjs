import {AvailabilityOracle} from '../dist/src/application/availability-oracle.js';
import {l1Config,FakeAvailabilityCalendar} from '../dist/test/support/l1-calendar.js';
const now='2030-01-01T14:00:00Z',calendar=new FakeAvailabilityCalendar(),oracle=new AvailabilityOracle(l1Config(),calendar,()=>now);
const first=await oracle.open(),more=await oracle.action(first.choices[2].id,true),dates=await oracle.action(more.choices[2].id,true),times=await oracle.action(dates.choices[0].id,true),selected=await oracle.action(times.choices[0].id,true);
console.log(JSON.stringify({mode:'READ_ONLY_L1_TRANSCRIPT_ORACLE',clock:now,timeZone:'America/Mexico_City',steps:[first,more,dates,times,selected],calendarMutations:0,providerCalls:0,interactiveBookingEnabled:false},null,2));
