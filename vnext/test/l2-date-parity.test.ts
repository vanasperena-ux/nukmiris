import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {DateTime} from 'luxon';
import assert from 'node:assert/strict';
import * as dates from '../src/domain/appointment-date.js';
// Run the accepted v0.8.1 date acceptance corpus unchanged against the new port.
// The running application never imports legacy code or legacy configuration/data.
const source=readFileSync(fileURLToPath(new URL('../../../backend/test/appointment-date.test.cjs',import.meta.url)),'utf8');
const context=vm.createContext({require:(id:string)=>{
 if(id==='node:test')return {test:(name:string,fn:()=>void)=>test('L2 date parity: '+name,fn)};
 if(id==='node:assert/strict')return assert;
 if(id==='luxon')return {DateTime};
 if(id==='../lib/appointment-date')return {...dates,parseAppointmentDate:(value:unknown,opts:{now:string|DateTime;timeZone:string;maxBookingHorizonDays?:number})=>vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(dates.parseAppointmentDate(value,{...opts,now:typeof opts.now==='string'?opts.now:opts.now.toISO()!})))+')',context)};
 throw Error('date_parity_import_denied:'+id);
}});
new vm.Script(source,{filename:'accepted-v0.8.1-date-tests.cjs'}).runInContext(context);
