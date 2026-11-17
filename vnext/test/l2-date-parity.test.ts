import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {DateTime} from 'luxon';
import assert from 'node:assert/strict';
import * as dates from '../src/domain/appointment-date.js';
// Keep the accepted v0.8.1 parser corpus. NM-068 deliberately supersedes one
// editorial expectation; adapt only that literal without modifying legacy files.
// The running application never imports legacy code or legacy configuration/data.
const legacySource=readFileSync(fileURLToPath(new URL('../../../backend/test/appointment-date.test.cjs',import.meta.url)),'utf8');
const oldPastCopy='"Esa fecha ya pasó. ¿Qué otro día te gustaría?"';
assert.equal(legacySource.split(oldPastCopy).length,2,'only the NM-068 CX012 copy expectation may be adapted');
const source=legacySource.replace(oldPastCopy,'"Esa fecha ya pasó. Elige otra fecha o escríbela."');
const context=vm.createContext({require:(id:string)=>{
 if(id==='node:test')return {test:(name:string,fn:()=>void)=>test('L2 date parity: '+name,fn)};
 if(id==='node:assert/strict')return assert;
 if(id==='luxon')return {DateTime};
 if(id==='../lib/appointment-date')return {...dates,parseAppointmentDate:(value:unknown,opts:{now:string|DateTime;timeZone:string;maxBookingHorizonDays?:number})=>vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(dates.parseAppointmentDate(value,{...opts,now:typeof opts.now==='string'?opts.now:opts.now.toISO()!})))+')',context)};
 throw Error('date_parity_import_denied:'+id);
}});
new vm.Script(source,{filename:'accepted-v0.8.1-date-tests.cjs'}).runInContext(context);
