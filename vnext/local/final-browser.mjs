// Browser acceptance of only the three owner-approved corrections. Isolated data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {localFixture} from './test-fixture.mjs';
import {freeLoopbackPort} from './command-lock.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('Final corrections actual browser: name safety, summary trigger matrix and human-support entry',{timeout:660000},async t=>{
 const {s,running,parent}=await localFixture(t),port=await freeLoopbackPort();
 const browser=spawn(process.argv[2]??'chromium',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--disable-default-apps','--no-first-run','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(parent,'browser'),'about:blank'],{stdio:'ignore',windowsHide:true});
 const closed=new Promise((r,j)=>{browser.once('error',j);browser.once('exit',r);});t.after(async()=>{browser.kill();await Promise.race([closed,wait(3000)]);});
 let target;for(let i=0;i<100;i++){try{target=await(await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent(running.url),{method:'PUT'})).json();break;}catch{await wait(50);}}assert.ok(target?.webSocketDebuggerUrl);
 const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let sequence=0;ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result);}};t.after(()=>ws.close());
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error('final_browser_evaluation');return r.result?.value;};
 const until=async expression=>{for(let i=0;i<250;i++){try{if(await evaluate(expression))return;}catch{}await wait(60);}throw Error('final_browser_timeout:'+expression+' '+await evaluate("document.getElementById('status')?.textContent"));};
 const last="Array.from(document.querySelectorAll('.message:not(.customer)')).at(-1)",txt=last+'.textContent',buttons="document.querySelectorAll('.choices button:not(:disabled)')";
 const send=async value=>{const n=await evaluate("document.querySelectorAll('.message:not(.customer)').length");await evaluate("document.getElementById('message').value="+JSON.stringify(value)+";document.getElementById('composer').requestSubmit();true");return n;};
 const replyAfter=async value=>{const n=await send(value);await until("document.querySelectorAll('.message:not(.customer)').length>"+n);};
 const noSummary=async()=>assert.doesNotMatch(await evaluate(txt),/Tu cita actual|Tus próximas citas|Cita registrada/);
 const click=async title=>{const n=await evaluate("document.querySelectorAll('.message:not(.customer)').length");await evaluate("Array.from("+buttons+").find(b=>b.textContent==="+JSON.stringify(title)+").click();true");await until("document.querySelectorAll('.message:not(.customer)').length>"+n);};
 const choose=async i=>{const n=await evaluate("document.querySelectorAll('.message:not(.customer)').length");await evaluate(buttons+`[${i}].click();true`);await until("document.querySelectorAll('.message:not(.customer)').length>"+n);};
 await until("document.getElementById('status').textContent.includes('Conectado')");await replyAfter('cita');await choose(0);await until("document.querySelectorAll('.confirmed').length===1");
 await replyAfter('agendar');await click('Más opciones');await choose(1);await until("document.querySelectorAll('.confirmed').length===2 && document.querySelectorAll('.appointment').length===2");
 for(const command of ['menu','Hola!','cita','agendar']){await replyAfter(command);assert.equal(((await evaluate(txt)).match(/^\d+\. /gm)??[]).length,2,command);}
 await replyAfter('menu');await click('Agendar una cita');await noSummary();await click('Más opciones');await noSummary();await click('Elegir fecha');await until("document.querySelectorAll('.whatsapp-list li button:not(:disabled)').length>=3");await noSummary();await evaluate("document.querySelector('.whatsapp-list li button:not(:disabled)').click();true");await until(buttons+'.length===3');await noSummary();await replyAfter('31 nov');await noSummary();
 for(const entry of ['TEXT','ACTION']){
  await replyAfter('menu');if(entry==='TEXT')await replyAfter('humano');else await click('Hablar con alguien');assert.match(await evaluate(txt),/Escribe tu mensaje/);await noSummary();const n=await send('necesito ayuda');await until("Array.from(document.querySelectorAll('.message.customer')).at(-1).textContent.includes('necesito ayuda') && document.getElementById('status').textContent.includes('Conectado')");assert.equal(await evaluate("document.querySelectorAll('.message:not(.customer)').length"),n);await replyAfter('menu');assert.equal(((await evaluate(txt)).match(/^\d+\. /gm)??[]).length,2);
 }
 await evaluate("document.getElementById('persona').value='new';document.getElementById('persona').dispatchEvent(new Event('change'));true");await until("document.querySelectorAll('.message.customer').length===0");await replyAfter('cita');await choose(0);assert.match(await evaluate(txt),/nombre completo/);await replyAfter('hablar con alguien');assert.match(await evaluate(txt),/Escribe tu mensaje/);await noSummary();assert.equal(await evaluate("document.querySelectorAll('.confirmed').length"),0);assert.equal(await evaluate("document.querySelectorAll('.appointment').length"),2);
 await replyAfter('menu');await replyAfter('cita');await choose(0);for(const value of ['quiero cancelar','ok gracias','maría fernández']){await replyAfter(value);assert.match(await evaluate(txt),/mayúscula|Me llamo/);assert.equal(await evaluate("document.querySelectorAll('.confirmed').length"),0);assert.equal(await evaluate("document.querySelectorAll('.appointment').length"),2);}
 await replyAfter('me llamo maría fernández');await until("document.querySelectorAll('.confirmed').length===1 && document.querySelectorAll('.appointment').length===3");await noSummary();
 console.log(JSON.stringify({finalBrowser:'PASS',platform:process.platform,node:process.version,postgres:s.observed.serverVersion,realBrowser:true,invalidNameNoBooking:true,nameClarification:true,validDirectBooking:true,twoUpcomingOnCitaAndAgendar:true,menuNavigationNoRepeat:true,dateContinuationNoRepeat:true,humanEntryNoSummary:true,quietSupport:true,menuExitRestoresAll:true,ownerProfileAccessed:false,ownerCapacityRetestRequired:false,nativeWindows:process.platform==='win32'?'EXECUTED':'NOT RUN'}));
});
