// Actual browser interaction through Chromium/Edge CDP. No external page/provider.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {localFixture} from './test-fixture.mjs';
import {freeLoopbackPort} from './command-lock.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('L2 real browser: known/new customer direct booking, calendar and isolated business selector',{timeout:660000},async t=>{
 const {s,running,parent}=await localFixture(t),port=await freeLoopbackPort();const executable=process.argv[2]??'chromium';
 const browser=spawn(executable,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--disable-default-apps','--no-first-run','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(parent,'browser'),'about:blank'],{stdio:'ignore',windowsHide:true});
 const closed=new Promise((r,j)=>{browser.once('error',j);browser.once('exit',r);});t.after(async()=>{browser.kill();await Promise.race([closed,wait(3000)]);});
 let target;for(let i=0;i<100;i++){try{target=await(await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent(running.url),{method:'PUT'})).json();break;}catch{await wait(50);}}assert.ok(target?.webSocketDebuggerUrl,'browser CDP endpoint');
 const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let sequence=0;
 ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result);}};t.after(()=>ws.close());
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 await call('Emulation.setDeviceMetricsOverride',{width:1320,height:930,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error('browser evaluation failed');return r.result?.value;};
 const until=async expression=>{for(let i=0;i<200;i++){try{if(await evaluate(expression))return;}catch{}await wait(50);}throw Error('browser condition timed out: '+expression+' status='+await evaluate("document.getElementById('status')?.textContent"));};
 const send=value=>evaluate("document.getElementById('message').value="+JSON.stringify(value)+";document.getElementById('composer').requestSubmit();true");
 await until("document.getElementById('status').textContent.includes('Conectado')");await send('cita');await until("document.querySelectorAll('.choices button:not(:disabled)').length===3");await evaluate("document.querySelector('.choices button:not(:disabled)').click();true");await until("document.querySelector('.confirmed') && document.querySelectorAll('.appointment').length===1");
 await evaluate("document.getElementById('persona').value='new';document.getElementById('persona').dispatchEvent(new Event('change'));true");await until("!document.querySelector('.message.customer')");await send('menu');await until("document.querySelectorAll('.choices button:not(:disabled)').length===3");await evaluate("document.querySelector('.choices button:not(:disabled)').click();true");await until("document.getElementById('messages').textContent.includes('nombre completo')");await send('María Ejemplo');await until("document.querySelector('.confirmed') && document.querySelectorAll('.appointment').length===2");
 await evaluate("document.getElementById('messages').scrollTop=document.getElementById('messages').scrollHeight;true");await wait(200);
 const screenshot=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile(process.argv[3]??path.join(parent,'browser.png'),Buffer.from(screenshot.data,'base64'));
 await evaluate("document.getElementById('business').value='synthetic-b';document.getElementById('business').dispatchEvent(new Event('change'));true");await until("document.getElementById('business-name').textContent.includes('Bernard') && document.querySelectorAll('.appointment').length===0");assert.equal(await evaluate("document.getElementById('messages').textContent.includes('María Ejemplo')"),false);
 console.log(JSON.stringify({browser:'Chromium/Edge CDP',platform:process.platform,knownBooking:'PASS',newNameAfterSlot:'PASS',directSelection:'PASS',calendarBookings:2,businessIsolation:'PASS',loopbackOnly:true,postgres:s.observed.serverVersion,nativeWindows:process.platform==='win32'?'EXECUTED':'NOT RUN'}));
});
