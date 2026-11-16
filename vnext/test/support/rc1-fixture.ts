import {randomUUID} from 'node:crypto';
import {fixture} from './helpers.js';
import {l1Config} from './l1-calendar.js';
import {InteractiveBooking,type LocalScope} from '../../src/application/interactive-booking.js';
import {ServiceCatalog,type CatalogService} from '../../src/application/service-catalog.js';
import {object,text,type ObjectValue,type Faults} from '../../src/domain/protocol.js';
const b='synthetic-a',subject='customer-'+b;
const last=(s:ObjectValue)=>object((s['replies'] as ObjectValue[]).at(-1)!['payload']);
const choices=(s:ObjectValue)=>last(s)['choices'] as ObjectValue[];
export async function rc1Setup(t:Parameters<typeof fixture>[0],faults?:Faults,solo=false,allocator?:(count:number)=>number){
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
 const app=new InteractiveBooking(scopes,faults,allocator??(()=>0));t.after(()=>app.stop());const catalog=scopes[0]!.catalog!;
 const tick=async()=>{for(let i=0;i<4;i++)await app.tick();};
 const send=async(value:string,who=subject,kind:'TEXT'|'ACTION'='TEXT')=>{await app.submit(b,who,randomUUID(),{kind,value});await tick();return app.snapshot(b,who);};
 const choose=async(s:ObjectValue,index=0,who=subject)=>send(text(choices(s)[index]!['id']),who,'ACTION');
 const save=async(kind:string,value:ObjectValue)=>catalog.save(randomUUID(),(await catalog.load()).revision,kind,value);
 const service=(id='manicura',duration=30):CatalogService=>({id,name:id==='manicura'?'Manicura':'Pedicura',description:'Servicio de prueba',durationMinutes:duration,bufferMinutes:10,priceMinor:25000,currency:'MXN',active:true});
 return {f,app,scopes,catalog,tick,send,choose,save,service,last,choices,b,subject};
}
