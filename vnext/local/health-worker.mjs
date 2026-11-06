import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {readState,connection} from './fixture.mjs';
let closing=false,server,pool,state;
async function stop(){if(closing)return;closing=true;await new Promise(r=>server?server.close(r):r());await pool?.end();if(state)await fs.unlink(path.join(state.directory,'worker.json')).catch(()=>{});if(process.connected)process.disconnect();}
process.once('message',config=>{void(async()=>{
 state=await readState(config.directory);pool=new pg.Pool(connection(state,'wp1_tenant_a'));
 server=http.createServer((req,res)=>{void(async()=>{
  if(req.headers.host!=='127.0.0.1:'+server.address().port){res.writeHead(403).end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  if(req.method==='GET'&&req.url==='/health'){
   const row=(await pool.query("SELECT current_setting('TimeZone') zone,current_setting('server_version') version")).rows[0];res.end(JSON.stringify({instance:state.id,mode:'SYNTHETIC_INERT',database:state.database,timezone:row.zone,postgres:row.version,interactiveBookingEnabled:false}));return;
  }
  const supplied=Buffer.from(String(req.headers['x-nukmiris-control']??'')),expected=Buffer.from(state.controlToken);
  if(req.method==='POST'&&['/stop','/crash'].includes(req.url)&&supplied.length===expected.length&&timingSafeEqual(supplied,expected)){
   res.end(JSON.stringify({instance:state.id,stopping:true}));if(req.url==='/crash')setImmediate(()=>process.exit(137));else setImmediate(()=>{void stop();});return;
  }
  res.writeHead(404).end(JSON.stringify({error:'local_runtime_health_only'}));
 })().catch(()=>{res.writeHead(503).end(JSON.stringify({error:'fixture_unavailable'}));});});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,'127.0.0.1',resolve);});
 process.on('message',m=>{if(m.stop)void stop();});process.send?.({type:'ready',port:server.address().port,pid:process.pid,instance:state.id});
})().catch(async e=>{process.send?.({type:'error',message:e.message});await stop();process.exitCode=1;});});
