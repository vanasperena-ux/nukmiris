// Real browser proof of the isolated owner walkthrough, never an owner PASS claim.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {capacityFixture,wait,crashCapacity} from './capacity-test-support.mjs';
import {freeLoopbackPort,locked} from './command-lock.mjs';
import {startCapacity} from './capacity-fixture.mjs';

test('actual capacity browser: saved C4 offer, two bookings, clickable stale rejection, restart and fresh alternatives',{timeout:660000},async t=>{
 const {s,running,parent}=await capacityFixture(t),port=await freeLoopbackPort(),directory=process.argv[3]??path.join(parent,'screenshots');await fs.mkdir(directory,{recursive:true,mode:0o700});
 const browser=spawn(process.argv[2]??'chromium',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--disable-default-apps','--no-first-run','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(parent,'browser'),'about:blank'],{stdio:'ignore',windowsHide:true});
 const closed=new Promise((r,j)=>{browser.once('error',j);browser.once('exit',r);});t.after(async()=>{browser.kill();await Promise.race([closed,wait(3000)]);});
 let target;for(let i=0;i<100;i++){try{target=await(await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent(running.url),{method:'PUT'})).json();break;}catch{await wait(50);}}assert.ok(target?.webSocketDebuggerUrl);
 const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let sequence=0;
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result);}};t.after(()=>ws.close());
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 await call('Emulation.setDeviceMetricsOverride',{width:1480,height:1800,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error('capacity_browser_evaluation');return r.result?.value;};
 const until=async expression=>{for(let i=0;i<250;i++){try{if(await evaluate(expression))return;}catch{}await wait(70);}throw Error('capacity_browser_timeout:'+expression+' '+await evaluate("document.getElementById('status')?.textContent"));};
 const R="JSON.parse(document.getElementById('report').textContent)";
 const screenshot=async name=>{const size=await call('Page.getLayoutMetrics');const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1480,height:Math.ceil(size.cssContentSize.height),scale:1}});await fs.writeFile(path.join(directory,name+'.png'),Buffer.from(shot.data,'base64'));};
 const requestOffer=p=>evaluate(`document.querySelector('#card-${p} .request').click();true`);
 const chooseFirst=p=>evaluate(`document.querySelector('#card-${p} .choices button:not(:disabled)').click();true`);
 await until("document.getElementById('status').textContent.includes('Conectado')");assert.equal(await evaluate("document.querySelector('#card-known .request').disabled"),true);
 await requestOffer('new3');await until(R+'.savedOffer !== null');const saved=await evaluate(R+'.savedOffer');await screenshot('01-original-offer');
 await requestOffer('known');await until("document.querySelector('#card-known .choices button:not(:disabled)') !== null");await chooseFirst('known');await until(R+'.counts.activeAppointments===1 && '+R+'.counts.pendingAttempts===0');
 await requestOffer('new');await until("document.querySelector('#card-new .choices button:not(:disabled)') !== null");await chooseFirst('new');await until(R+'.checks.twoTargetAppointments && '+R+'.counts.pendingAttempts===0');
 assert.equal(await evaluate(`document.querySelector('#card-new3 [data-action="${saved.actionId}"]').disabled`),false,'old WhatsApp-style button still clickable after other customers book');await screenshot('02-full-capacity');
 await evaluate("document.getElementById('replay').click();true");await until(R+'.checks.staleProcessed && '+R+'.counts.pendingInputs===0');let report=await evaluate(R);assert.ok(Object.values(report.checks).every(Boolean));assert.equal(report.counts.attempts,4);assert.equal(report.c4.bookingAttempts,0);assert.equal(report.c4.appointments,0);await screenshot('03-stale-rejected');
 await evaluate("document.getElementById('replay').click();true");await until(R+'.staleInputs.length===2 && '+R+'.counts.pendingInputs===0');
 await crashCapacity(s);await locked(s,()=>startCapacity(s));await call('Page.reload');await until(R+'.savedOffer.actionId==='+JSON.stringify(saved.actionId));
 await evaluate("document.getElementById('replay').click();true");await until(R+'.staleInputs.length===3 && '+R+'.counts.pendingInputs===0');await requestOffer('new2');await until(R+`.currentOffers.some(o=>o.subject==='new2-synthetic-a'&&o.outcome==='OFFER')`);report=await evaluate(R);const fresh=report.currentOffers.find(o=>o.subject==='new2-synthetic-a');assert.ok(fresh.slots.every(x=>Date.parse(x.slot.startAt)!==Date.parse(saved.slot.startAt)));assert.equal(Date.parse(fresh.slots[0].slot.startAt),Date.parse(s.capacityFixture.startAt)+90*60000);assert.ok(Object.values(report.checks).every(Boolean));await screenshot('04-fresh-alternatives');
 await evaluate("document.getElementById('business').value='synthetic-b';document.getElementById('business').dispatchEvent(new Event('change'));true");await until(R+`.businessId==='synthetic-b' && `+R+'.counts.activeAppointments===0');await requestOffer('new2');await until(R+`.currentOffers.some(o=>o.subject==='new2-synthetic-b'&&o.outcome==='OFFER')`);
 console.log(JSON.stringify({capacityBrowser:'PASS',platform:process.platform,node:process.version,postgres:s.observed.serverVersion,realServerOffer:true,oldButtonStillClickable:true,targetAppointments:2,employees:2,durationMinutes:60,bufferMinutes:15,staleBookingRejected:true,c4Attempts:0,c4Appointments:0,replayAndCrashRestart:true,freshAlternativeOffsetMinutes:90,businessIsolation:true,screenshots:4,ownerBrowserAcceptance:'PENDING',nativeWindows:process.platform==='win32'?'EXECUTED':'NOT RUN'}));
});
