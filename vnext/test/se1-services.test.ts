import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fixture,cut} from './support/helpers.js';
import {l1Config} from './support/l1-calendar.js';
import {InteractiveBooking,type LocalScope} from '../src/application/interactive-booking.js';
import {ServiceCatalog,validateCatalogItem,type CatalogService} from '../src/application/service-catalog.js';
import {object,text,type ObjectValue,type Faults} from '../src/domain/protocol.js';
const b='synthetic-a',subject='customer-'+b;
const last=(s:ObjectValue)=>object((s['replies'] as ObjectValue[]).at(-1)!['payload']);
const choices=(s:ObjectValue)=>last(s)['choices'] as ObjectValue[];
async function setup(t:Parameters<typeof fixture>[0],faults?:Faults,solo=false,allocator?:(count:number)=>number){
 const f=await fixture(t),scopes:LocalScope[]=[];
 for(const id of [b,'synthetic-b']){
  const config={...l1Config('UTC'),businessId:id,calendarId:'calendar-'+id};await f.admin.query('INSERT INTO core.catalog_head(business_id) VALUES($1)',[id]);
  await f.admin.query("INSERT INTO core.service VALUES($1,'implicit-p0','Cita general','',60,15,0,'MXN',true)",[id]);
  for(const [key,name] of (solo?[['resource','Lucía']]:[['resource','Lucía'],['otherResource','Sofía']])){
   await f.admin.query('INSERT INTO core.employee VALUES($1,$2,$3,$4,true,$5)',[id,f.id(key!,id),f.id('calendar',id),name,config.hours]);await f.admin.query("INSERT INTO core.qualification VALUES($1,$2,'implicit-p0')",[id,f.id(key!,id)]);
  }
  await f.admin.query('INSERT INTO core.local_customer VALUES($1,$2,$3)',[id,f.id('customer',id),'Ana Ejemplo']);
  scopes.push({config,bindings:{businessId:id,calendar:{id:config.calendarId,coreId:f.id('calendar',id)},employees:new Map([['employee-a',f.id('resource',id)]])},employeeNames:new Map([['employee-a','Lucía']]),channelId:f.id('channel',id),catalog:new ServiceCatalog(id,f.role('reducer'),f.role('operator')),archive:f.archive.scope(id),ingress:f.role('ingress'),reducer:f.role('reducer'),sealer:f.role('sealer'),dispatcher:f.role('dispatch'),result:f.role('result')});
 }
 const app=new InteractiveBooking(scopes,faults,allocator);t.after(()=>app.stop());const catalog=scopes[0]!.catalog!;
 const tick=async()=>{for(let i=0;i<4;i++)await app.tick();};
 const send=async(value:string,who=subject,kind:'TEXT'|'ACTION'='TEXT')=>{await app.submit(b,who,randomUUID(),{kind,value});await tick();return app.snapshot(b,who);};
 const choose=async(s:ObjectValue,index=0,who=subject)=>send(text(choices(s)[index]!['id']),who,'ACTION');
 const save=async(kind:string,value:ObjectValue)=>catalog.save(randomUUID(),(await catalog.load()).revision,kind,value);
 const service=(id='manicura',duration=30):CatalogService=>({id,name:id==='manicura'?'Manicura':'Pedicura',description:'Servicio de prueba',durationMinutes:duration,bufferMinutes:10,priceMinor:25000,currency:'MXN',active:true});
 return {f,app,scopes,catalog,tick,send,choose,save,service};
}
test('SE1 configured service -> qualified employee -> immutable appointment snapshot and preserved confirmation',async t=>{
 const s=await setup(t);await s.save('service',object(s.service()));const c=await s.catalog.load(),employee=c.employees.find(e=>e.id===s.f.id('resource'))!;await s.save('employee',object({...employee,serviceIds:['manicura']}));
 const select=await s.send('cita');assert.equal(last(select)['outcome'],'SERVICES');assert.equal(last(select)['presentation'],'LIST');const index=choices(select).findIndex(x=>text(x['title']).includes('Manicura'));const slots=await s.choose(select,index);assert.equal(last(slots)['outcome'],'OFFER');const done=await s.choose(slots);assert.equal(last(done)['outcome'],'CONFIRMED');
 const appointments=await s.catalog.appointments();assert.equal(appointments.length,1);assert.equal(object(appointments[0]!['service'])['id'],'manicura');assert.equal(appointments[0]!['employee'],'Lucía');assert.equal(Number(appointments[0]!['durationMinutes']),30);assert.equal(appointments[0]!['bufferMinutes'],10);assert.equal((await s.f.rows('appointment'))[0]!['resource_id'],s.f.id('resource'));
 await s.save('service',object({...s.service(),name:'Nuevo nombre',priceMinor:99900,durationMinutes:90}));await s.save('employee',object({...employee,name:'Nuevo empleado',active:false,serviceIds:[]}));assert.deepEqual(await s.catalog.appointments(),appointments);
});
test('SE1 no qualified employee or inactive service cannot create appointments',async t=>{
 const s=await setup(t);await s.save('service',object(s.service()));const select=await s.send('cita'),i=choices(select).findIndex(x=>text(x['title']).includes('Manicura')),slots=await s.choose(select,i);assert.equal(choices(slots).length,0);assert.equal((await s.f.rows('appointment')).length,0);await s.save('service',object({...s.service(),active:false}));const next=await s.send('cita');assert.equal(last(next)['outcome'],'OFFER');assert.equal((await s.f.rows('appointment')).length,0);
});
test('SE1 revisions, replay identity and role/tenant isolation are enforced in SQL',async t=>{
 const s=await setup(t),before=(await s.catalog.load()).revision,id=randomUUID(),value=object(s.service());const first=await s.catalog.save(id,before,'service',value);assert.equal(await s.catalog.save(id,before,'service',value),first);await assert.rejects(s.catalog.save(id,before,'service',{...value,name:'Different'}),/request_conflict/);await assert.rejects(s.catalog.save(randomUUID(),before,'service',value),/revision_conflict/);
 const results=await Promise.allSettled([s.catalog.save(randomUUID(),first,'service',{...value,id:'one'}),s.catalog.save(randomUUID(),first,'service',{...value,id:'two'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await assert.rejects(s.f.role('reducer').tx(b,db=>db.query('SELECT core.catalog_save($1,$2,1,$3,$4)',[b,randomUUID(),'service',value])),/permission denied/);
 const foreign=new ServiceCatalog(b,s.f.role('tenant_b'),s.f.role('tenant_b'));await assert.rejects(foreign.load());await assert.rejects(foreign.save(randomUUID(),1,'service',value));assert.equal((await s.scopes[1]!.catalog!.load()).services.some(x=>x.id==='manicura'),false);
 const employee=(await s.catalog.load()).employees[0]!;await assert.rejects(s.save('employee',object({...employee,calendarId:s.f.id('calendar','synthetic-b')})));await assert.rejects(s.save('employee',object({...employee,serviceIds:['foreign-service']})));
});
test('SE1 owner edit invalidates displayed slots before name/customer/booking allocation',async t=>{
 const s=await setup(t),offered=await s.send('cita','new-person');await s.save('service',object({...(await s.catalog.load()).services[0]!,durationMinutes:30}));const again=await s.choose(offered,0,'new-person');assert.match(text(last(again)['text']),/cambiaron/);assert.equal((await s.f.rows('appointment')).length,0);assert.equal((await s.f.rows('customer')).length,1);
});
test('SE1 edit between recheck and SQL preparation rejects atomically and progresses without retry',async t=>{
 let enabled=false;const s=await setup(t,{async hit(point){if(enabled&&point==='prepare.afterArchive'){enabled=false;await s.save('service',object({...(await s.catalog.load()).services[0]!,active:false}));}}});const offer=await s.send('cita');enabled=true;const final=await s.choose(offer);assert.match(text(last(final)['text']),/Elige un horario de nuevo/);assert.equal((await s.f.rows('appointment')).length,0);assert.equal((await s.f.rows('attempt')).length,0);assert.equal((await s.f.rows('protection')).length,0);assert.equal((await s.f.rows('plan_rejection')).length,1);await s.send('menu');assert.equal(last(await s.send('menu'))['outcome'],'MENU');
});
test('SE1 committed prepared booking and UNKNOWN survive catalog edits and new app objects',async t=>{
 const s=await setup(t,cut('dispatch.afterGate'));const offer=await s.send('cita');await s.choose(offer);const before=await s.f.snapshot();assert.equal((await s.f.rows('attempt'))[0]!['state'],'SUBMISSION_ENTERED');await s.save('service',object({...(await s.catalog.load()).services[0]!,active:false}));for(const e of (await s.catalog.load()).employees)await s.save('employee',object({...e,active:false,serviceIds:[]}));const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());await next.tick();assert.deepEqual(await s.f.snapshot(),before);assert.equal((await s.catalog.appointments()).length,1);
});
test('SE1 solo default resource automatically qualifies for new services; weekly hours filter availability',async t=>{
 const s=await setup(t,undefined,true);await s.save('service',object(s.service()));const only=(await s.catalog.load()).employees[0]!;assert.equal(only.id,s.f.id('resource'));assert.ok(only.serviceIds.includes('manicura'));const hours=Object.fromEntries([1,2,3,4,5,6,7].map(day=>[day,[{start:'13:00',end:'14:00'}]]));await s.save('employee',object({...only,hours}));const menu=await s.send('cita'),i=choices(menu).findIndex(x=>text(x['title']).includes('Manicura')),offered=await s.choose(menu,i);assert.match(text(choices(offered)[0]!['title']),/13:00/);assert.equal((await s.catalog.load()).employees.length,1);
});
test('SE1 long catalogs paginate using valid lists and service selection survives restart',async t=>{
 const s=await setup(t,undefined,true);for(let i=0;i<9;i++)await s.save('service',object({...s.service('s'+i),name:'Servicio '+i+' '+ 'á'.repeat(80)}));let v=await s.send('cita');assert.equal(last(v)['outcome'],'SERVICES');assert.ok(choices(v).every(c=>[...text(c['title'])].length<=24));const more=choices(v).findIndex(c=>c['title']==='Más servicios');v=await s.choose(v,more);assert.ok(choices(v).some(c=>c['title']==='Servicios anteriores'));const next=new InteractiveBooking(s.scopes);t.after(()=>next.stop());await next.submit(b,subject,randomUUID(),{kind:'ACTION',value:text(choices(v)[0]!['id'])});for(let i=0;i<4;i++)await next.tick();assert.equal(last(await next.snapshot(b,subject))['outcome'],'OFFER');
});
test('SE1 validation rejects bundles, malformed hours, amounts, missing fields and alternate tenant binding',()=>{
 const service={id:'a',name:'Manicura',description:'Línea uno\nLínea dos',durationMinutes:30,bufferMinutes:10,priceMinor:29,currency:'MXN',active:true};validateCatalogItem('service',service);
 for(const value of [{...service,services:['a']},{...service,businessId:'foreign'},{...service,durationMinutes:0},{...service,priceMinor:0.29},{...service,active:'true'},{...service,id:'a:b'}])assert.throws(()=>validateCatalogItem('service',value));
 const employee={id:randomUUID(),calendarId:randomUUID(),name:'Lucía',active:true,hours:{1:[{start:'09:00',end:'17:00'}]},serviceIds:['a']};validateCatalogItem('employee',employee);for(const hours of [{1:[{start:'17:00',end:'09:00'}]},{1:[{start:'09:00',end:'12:00'},{start:'11:00',end:'13:00'}]},{0:[]},{1:[{start:null,end:null}]}])assert.throws(()=>validateCatalogItem('employee',object({...employee,hours})));
});

test('SE1 configured new-customer booking still asks name after slot; commands never become names',async t=>{
 const s=await setup(t,undefined,true);await s.save('service',object({...s.service(),id:'implicit-p0'}));const offer=await s.send('cita','brand-new'),name=await s.choose(offer,0,'brand-new');assert.equal(last(name)['outcome'],'NAME_REQUIRED');assert.equal((await s.f.rows('appointment')).length,0);assert.equal((await s.f.rows('customer')).length,1);await s.send('hablar con alguien','brand-new');assert.equal((await s.f.rows('customer')).length,1);await s.send('menu','brand-new');const again=await s.send('cita','brand-new');await s.choose(again,0,'brand-new');const done=await s.send('María Fernández','brand-new');assert.equal(last(done)['outcome'],'CONFIRMED');assert.equal(object((await s.catalog.appointments())[0]!['service'])['name'],'Manicura');
});
test('SE1 configured duration + post-service buffer excludes the same resource until the next valid grid slot',async t=>{
 const s=await setup(t,undefined,true);await s.save('service',object({...s.service(),id:'implicit-p0'}));const offer=await s.send('cita');await s.choose(offer);const first=(await s.catalog.appointments())[0]!;const id=randomUUID();await s.f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',[b,id,'other-known']);await s.f.admin.query('INSERT INTO core.local_customer VALUES($1,$2,$3)',[b,id,'Otra Persona']);const next=await s.send('cita','other-known');const local=(await s.f.rows('local_session')).find(r=>object(r['state'])['outcome']==='OFFER')!;const slots=object(object(local['state'])['oracle'])['slots'] as ObjectValue[];assert.ok(slots.length);assert.ok(Date.parse(text(slots[0]!['startAt']))>=Date.parse(text(first['endAt']))+10*60000);assert.equal((Date.parse(text(slots[0]!['startAt']))-Date.parse(text(first['startAt'])))/60000,60);assert.equal(last(next)['outcome'],'OFFER');
});
test('SE1 no active services renders honest text without invalid interactive lists or booking effects',async t=>{
 const s=await setup(t);await s.save('service',object({...(await s.catalog.load()).services[0]!,active:false}));const state=await s.send('cita');assert.equal(last(state)['outcome'],'SERVICES');assert.equal(last(state)['presentation'],'TEXT');assert.equal(choices(state).length,0);assert.match(text(last(state)['text']),/No hay servicios activos/);assert.equal((await s.f.rows('attempt')).length,0);assert.equal((await s.f.rows('appointment')).length,0);
});
test('SE1 SQL validates employee hours even when a corrupt writer omits the catalog revision increment',async t=>{
 let enabled=false;const s=await setup(t,{async hit(point){if(enabled&&point==='prepare.afterArchive'){enabled=false;await s.f.admin.query("UPDATE core.employee SET hours='{}' WHERE business_id=$1",[b]);}}});const offer=await s.send('cita');enabled=true;await s.choose(offer);assert.equal((await s.f.rows('appointment')).length,0);assert.equal((await s.f.rows('attempt')).length,0);assert.equal((await s.f.rows('protection')).length,0);assert.equal((await s.f.rows('plan_rejection')).length,1);
});
test('SE1 catalog change receipts and booked service snapshots are append-only',async t=>{
 const s=await setup(t);await s.save('service',object({...s.service(),id:'implicit-p0'}));const offer=await s.send('cita');await s.choose(offer);await assert.rejects(s.f.admin.query("UPDATE core.catalog_edit SET revision=revision+1 WHERE business_id=$1",[b]),/append_only/);await assert.rejects(s.f.admin.query('DELETE FROM core.appointment_service WHERE business_id=$1',[b]),/append_only/);
});


test('SE1 approved random allocation selects from every eligible employee and request replay never rerolls',async t=>{
 const counts:number[]=[];const s=await setup(t,undefined,false,count=>{counts.push(count);return count-1;});const offer=await s.send('cita'),request=randomUUID(),payload={kind:'ACTION' as const,value:text(choices(offer)[0]!['id'])};await s.app.submit(b,subject,request,payload);await s.tick();const appointments=await s.f.rows('appointment');assert.equal(appointments.length,1);assert.equal(appointments[0]!['resource_id'],[s.f.id('resource'),s.f.id('otherResource')].sort().at(-1));assert.deepEqual(counts,[2]);await s.app.submit(b,subject,request,payload);await s.tick();assert.equal((await s.f.rows('appointment')).length,1);assert.deepEqual(counts,[2]);
});
test('SE1 crash after independent employee allocation reuses that allocation without drawing again',async t=>{
 let draws=0;const s=await setup(t,cut('catalog.afterEmployeeAllocation'),false,count=>{draws++;return count-1;});const offer=await s.send('cita');await s.choose(offer);assert.equal((await s.f.rows('appointment')).length,0);assert.equal(draws,1);const next=new InteractiveBooking(s.scopes,undefined,()=>{throw Error('must_not_reroll');});t.after(()=>next.stop());for(let i=0;i<4;i++)await next.tick();assert.equal((await s.f.rows('appointment')).length,1);assert.equal((await s.f.rows('appointment'))[0]!['resource_id'],[s.f.id('resource'),s.f.id('otherResource')].sort().at(-1));assert.equal(draws,1);
});
test('SE1 concurrent customers at one time allocate remaining eligible capacity without overlap',async t=>{
 const s=await setup(t,undefined,false,()=>0),id=randomUUID();await s.f.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',[b,id,'second-known']);await s.f.admin.query('INSERT INTO core.local_customer VALUES($1,$2,$3)',[b,id,'Segunda Persona']);const a=await s.send('cita'),c=await s.send('cita','second-known');await Promise.all([s.app.submit(b,subject,randomUUID(),{kind:'ACTION',value:text(choices(a)[0]!['id'])}),s.app.submit(b,'second-known',randomUUID(),{kind:'ACTION',value:text(choices(c)[0]!['id'])})]);for(let i=0;i<6;i++)await s.app.tick();const appointments=await s.f.rows('appointment');assert.equal(appointments.length,2);assert.equal(new Set(appointments.map(a=>a['resource_id'])).size,2);assert.equal(new Set(appointments.map(a=>a['start_at'])).size,1);assert.equal((await s.f.rows('local_ledger')).filter(r=>r['kind']==='CORE').length,4);
});

test('SE1 dates before service selection request one service and Menu resets service pagination',async t=>{
 const s=await setup(t,undefined,true);for(let i=0;i<5;i++)await s.save('service',object({...s.service('s'+i),name:'Servicio '+i}));
 await s.send('cita');let v=await s.send('mañana');assert.equal(last(v)['outcome'],'SERVICES');assert.equal((await s.f.rows('appointment')).length,0);
 v=await s.choose(v,choices(v).findIndex(c=>c['title']==='Más servicios'));assert.ok(choices(v).some(c=>c['title']==='Servicios anteriores'));
 await s.send('menu');v=await s.send('cita');assert.equal(last(v)['outcome'],'SERVICES');assert.ok(!choices(v).some(c=>c['title']==='Servicios anteriores'));
});

test('N1 fresh solo service creation qualifies once; removal survives replay and every service edit',async t=>{
 const s=await setup(t,undefined,true),value=object(s.service()),expected=(await s.catalog.load()).revision,request=randomUUID();
 assert.equal((await s.f.admin.query("SELECT obj_description('core.catalog_save(text,uuid,bigint,text,jsonb)'::regprocedure,'pg_proc') version")).rows[0].version,'SE1_N1_CREATE_ONLY_V1');
 const created=await s.catalog.save(request,expected,'service',value);assert.ok((await s.catalog.load()).employees[0]!.serviceIds.includes('manicura'));
 await s.save('employee',object({...((await s.catalog.load()).employees[0]!),serviceIds:[]}));
 const revision=(await s.catalog.load()).revision;assert.equal(await s.catalog.save(request,expected,'service',value),created);assert.equal((await s.catalog.load()).revision,revision);
 let service={...s.service()};
 for(const patch of [{priceMinor:31025},{name:'Manicura corregida'},{description:'Descripción editada'},{durationMinutes:45},{bufferMinutes:20},{active:false},{active:true}]){
  service={...service,...patch};await s.save('service',object(service));assert.deepEqual((await s.catalog.load()).employees[0]!.serviceIds,[],JSON.stringify(patch));
 }
 const select=await s.send('cita'),i=choices(select).findIndex(c=>text(c['title']).includes('Manicura corregida'));assert.ok(i>=0);const offer=await s.choose(select,i);assert.equal(last(offer)['outcome'],'OFFER');assert.equal(choices(offer).length,0);
 assert.equal((await s.f.rows('appointment')).length,0);assert.equal((await s.f.rows('attempt')).length,0);assert.equal((await s.f.rows('protection')).length,0);
});
test('N1 one active plus one inactive employee record is still a team and receives no automatic qualification',async t=>{
 const s=await setup(t),other=(await s.catalog.load()).employees.find(e=>e.id===s.f.id('otherResource'))!;await s.save('employee',object({...other,active:false}));await s.save('service',object(s.service()));
 const catalog=await s.catalog.load();assert.equal(catalog.employees.length,2);assert.equal(catalog.employees.filter(e=>e.active).length,1);assert.ok(catalog.employees.every(e=>!e.serviceIds.includes('manicura')));
 const menu=await s.send('cita'),offer=await s.choose(menu,choices(menu).findIndex(c=>text(c['title']).includes('Manicura')));assert.equal(choices(offer).length,0);assert.equal((await s.f.rows('appointment')).length,0);
});
test('N1 a sole non-default resource never receives automatic qualification',async t=>{
 const s=await setup(t,undefined,true);await s.f.admin.query('UPDATE core.resource SET is_default=false WHERE business_id=$1 AND id=$2',[b,s.f.id('resource')]);await s.save('service',object(s.service()));assert.ok(!(await s.catalog.load()).employees[0]!.serviceIds.includes('manicura'));
});
test('N1 inactive solo default employee remains unbookable even when a new service grants qualification',async t=>{
 const s=await setup(t,undefined,true),employee=(await s.catalog.load()).employees[0]!;await s.save('employee',object({...employee,active:false}));await s.save('service',object(s.service()));assert.ok((await s.catalog.load()).employees[0]!.serviceIds.includes('manicura'));
 const menu=await s.send('cita'),offer=await s.choose(menu,choices(menu).findIndex(c=>text(c['title']).includes('Manicura')));assert.equal(choices(offer).length,0);assert.equal((await s.f.rows('appointment')).length,0);
});

test('N1 historical010 solo reproducer upgrades without deleting qualifications; future owner removal persists',async t=>{
 const s=await setup(t,undefined,true),original=await readFile(new URL('../../src/infrastructure/postgres/migrations/010-services-employees.sql',import.meta.url),'utf8');
 await s.f.admin.query(original.slice(original.indexOf('CREATE FUNCTION core.catalog_save('),original.indexOf('\n-- A catalog edit')).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
 await s.save('service',object(s.service()));await s.save('employee',object({...((await s.catalog.load()).employees[0]!),serviceIds:[]}));
 await s.save('service',object({...s.service(),priceMinor:31000}));assert.deepEqual((await s.catalog.load()).employees[0]!.serviceIds,['manicura'],'original010 reproduces N1');
 const before=await s.catalog.load();await s.f.admin.query(await readFile(new URL('../../src/infrastructure/postgres/migrations/011-solo-qualification-creation-only.sql',import.meta.url),'utf8'));assert.deepEqual(await s.catalog.load(),before,'011 preserves previously inserted qualifications and configuration');
 await s.save('employee',object({...before.employees[0]!,serviceIds:[]}));await s.save('service',object({...s.service(),name:'Manicura corregida'}));assert.deepEqual((await s.catalog.load()).employees[0]!.serviceIds,[]);
});
