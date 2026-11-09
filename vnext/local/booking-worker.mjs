import http from 'node:http';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readState} from './fixture.mjs';
import {openInteractive} from './interactive-profile.mjs';
import {assertCapacity,capacityReport} from './capacity-fixture.mjs';
let server,state,opened,closing=false;
const same=(a,b)=>{const x=Buffer.from(String(a??'')),y=Buffer.from(String(b??''));return x.length===y.length&&timingSafeEqual(x,y);};
async function stop(){if(closing)return;closing=true;await new Promise(r=>server?server.close(r):r());await opened?.close();if(state)await fs.unlink(path.join(state.directory,'worker.json')).catch(()=>{});if(process.connected)process.disconnect();}
async function body(req){let value='';for await(const c of req){value+=c;if(value.length>8192)throw Error('request_too_large');}return JSON.parse(value);}
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
process.once('message',config=>{void(async()=>{
 state=await readState(config.directory);if(state.capacityFixture)assertCapacity(state);opened=await openInteractive(state);const cookie='nukmiris_'+state.id;
 const sign=payload=>createHmac('sha256',state.application.uiToken).update(payload).digest('base64url');
 const session=req=>{const raw=String(req.headers['x-local-session']??''),parts=raw.split('.');if(parts.length!==2||!same(sign(parts[0]),parts[1]))throw Error('session_denied');const v=JSON.parse(Buffer.from(parts[0],'base64url'));if(!opened.profile.scopes.some(s=>s.businessId===v.businessId)||!['customer-','new-','new2-','new3-'].some(prefix=>v.subject===prefix+v.businessId))throw Error('session_denied');return v;};
 server=http.createServer((req,res)=>{void(async()=>{
  const origin='http://127.0.0.1:'+server.address().port;
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  if(req.headers.host!=='127.0.0.1:'+server.address().port){json(403,{error:'loopback_host_required'});return;}
  if(req.method==='POST'&&['/stop','/crash'].includes(req.url)&&same(req.headers['x-nukmiris-control'],state.controlToken)){json(200,{instance:state.id,stopping:true});if(req.url==='/crash')setImmediate(()=>process.exit(137));else setImmediate(()=>void stop());return;}
  if(req.method==='GET'&&req.url==='/health'){json(200,{instance:state.id,mode:'L2_SYNTHETIC_ONLY',interactiveBookingEnabled:true,loopback:true,recoveryWorker:true,postgres:state.observed.serverVersion,timezone:'UTC'});return;}
  if(req.method==='GET'&&['/','/app.js','/app.css'].includes(req.url)){
   const file=req.url==='/'?'index.html':req.url.slice(1),content=await fs.readFile(fileURLToPath(new URL((state.capacityFixture?'./capacity-web/':'./web/')+file,import.meta.url)));res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'});res.end(content);return;
  }
  if(req.method==='POST'&&req.headers.origin!==origin){json(403,{error:'same_origin_required'});return;}
  if(req.method==='POST'&&req.url==='/api/auth'){const p=await body(req);if(!exact(p,['token'])||!same(p.token,state.application.uiToken)){json(403,{error:'local_auth_denied'});return;}res.setHeader('Set-Cookie',cookie+'='+state.application.uiToken+'; HttpOnly; SameSite=Strict; Path=/');json(200,{authenticated:true});return;}
  const cookies=String(req.headers.cookie??'').split(';').map(s=>s.trim());if(!cookies.some(c=>same(c,cookie+'='+state.application.uiToken))){json(401,{error:'open_the_private_URL_from_demo_book'});return;}
  if(req.method==='GET'&&req.url==='/api/businesses'){json(200,{businesses:opened.profile.scopes.map(s=>({id:s.businessId,title:s.title,employees:s.employees,timeZone:s.config.timeZone}))});return;}
  if(req.method==='POST'&&req.url==='/api/session'){const p=await body(req);if(!exact(p,['businessId','persona'])||!opened.profile.scopes.some(s=>s.businessId===p.businessId)||!['known','new','new2','new3'].includes(p.persona)){json(400,{error:'local_route_denied'});return;}const v={businessId:p.businessId,subject:({'known':'customer-','new':'new-','new2':'new2-','new3':'new3-'})[p.persona]+p.businessId},payload=Buffer.from(JSON.stringify(v)).toString('base64url');json(200,{...v,token:payload+'.'+sign(payload)});return;}
  const bound=session(req);
  if(state.capacityFixture&&req.method==='GET'&&req.url==='/api/capacity'){json(200,await capacityReport(state,bound.businessId));return;}
  if(req.method==='GET'&&req.url==='/api/state'){json(200,await opened.app.snapshot(bound.businessId,bound.subject));return;}
  if(req.method==='POST'&&req.url==='/api/appointment'){const p=await body(req);if(!exact(p,['eventId'])||typeof p.eventId!=='string'){json(400,{error:'local_event_schema'});return;}const detail=await opened.app.appointmentDetail(bound.businessId,p.eventId);json(detail?200:404,detail??{error:'appointment_not_found'});return;}
  if(req.method==='POST'&&req.url==='/api/message'){const p=await body(req);if(!exact(p,['requestId','payload'])){json(400,{error:'local_input_schema'});return;}json(202,await opened.app.submit(bound.businessId,bound.subject,p.requestId,p.payload));void opened.app.tick().catch(()=>{});return;}
  if(req.method==='POST'&&req.url==='/api/fault'){const p=await body(req);if(!exact(p,['mode'])||!['NONE','BEFORE_APPLY','AFTER_APPLY'].includes(p.mode)){json(400,{error:'fake_failure_schema'});return;}opened.app.providers.get(bound.businessId).failure=p.mode;json(200,{synthetic:true,mode:p.mode});return;}
  json(404,{error:'local_route_missing'});
 })().catch(e=>{if(!res.headersSent){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message==='session_denied'?'session_denied':'request_held_or_invalid'}));}else res.end();});});
 await new Promise((r,j)=>{server.once('error',j);server.listen(config.port,'127.0.0.1',r);});opened.app.start();process.on('message',m=>{if(m.stop)void stop();});process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());process.send?.({type:'ready',port:server.address().port,pid:process.pid,instance:state.id});
})().catch(async e=>{process.send?.({type:'error',message:e.message});await stop();process.exitCode=1;});});
