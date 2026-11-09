import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {capacityPath,prepareCapacity,readCapacity,startCapacity} from './capacity-fixture.mjs';
import {locked} from './command-lock.mjs';
import {capacityFixture,capacityClient,crashCapacity} from './capacity-test-support.mjs';

test('capacity fixture refuses owner paths, existing directories, links and unsupported/shared ports before provisioning',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nukmiris-capacity-boundary-'));t.after(()=>fs.rm(root,{recursive:true}));
 const owner=path.join(root,'.local-demo');await fs.mkdir(owner);const file=path.join(owner,'Ana-protected.txt'),bytes=Buffer.from('UNKNOWN + hablar con alguien + existing appointments — unchanged');await fs.writeFile(file,bytes);const digest=()=>fs.readFile(file).then(b=>createHash('sha256').update(b).digest('hex')),before=await digest();
 await assert.rejects(capacityPath(owner),/disposable_path/);await assert.rejects(capacityPath(path.join(owner,'nukmiris-vnext-capacity-test')),/disposable_path/);
 const existing=path.join(root,'nukmiris-vnext-capacity-existing');await fs.mkdir(existing);await assert.rejects(prepareCapacity(existing),/EEXIST/);await assert.rejects(readCapacity(existing),/ENOENT/);
 const link=path.join(root,'nukmiris-vnext-capacity-link');await fs.symlink(owner,link,process.platform==='win32'?'junction':'dir');await assert.rejects(capacityPath(link),/link_or_file/);
 for(const ports of [{dbPort:15432,uiPort:3087},{dbPort:15442,uiPort:3077},{dbPort:50000,uiPort:3087},{dbPort:15442,uiPort:15442}])await assert.rejects(prepareCapacity(path.join(root,'nukmiris-vnext-capacity-never-created'),ports),/separate_low_ports/);
 assert.equal(await digest(),before);assert.deepEqual(await fs.readdir(owner),['Ana-protected.txt']);
});

test('NM040/042 Test17C: real stale C4 offer cannot exceed two employees; replay/restart, buffers and tenant control',{timeout:660000},async t=>{
 const {s,running}=await capacityFixture(t);let c=await capacityClient(s,running);
 let report=await c.report();assert.equal(report.counts.appointments,0);assert.equal(report.employees.length,2);assert.equal(new Set(report.customers.map(x=>x.subject)).size,4);assert.ok(report.qualifiedEmployees.every(e=>e.serviceIds.includes('implicit-p0')&&e.absences.length===0));
 await c.offer('new3');report=await c.until(r=>r.savedOffer!==null);const saved=report.savedOffer;assert.ok(saved.actionId&&saved.replyId&&saved.expiresAt);assert.equal(Date.parse(saved.slot.startAt),Date.parse(s.capacityFixture.startAt));
 await c.book('known');await c.book('new');report=await c.until(r=>r.checks.twoTargetCalendarEvents&&r.counts.pendingAttempts===0);
 for(const key of ['twoTargetAppointments','twoDistinctEmployees','twoTargetCalendarEvents','targetUsesQualifiedEmployees','correctBuffers'])assert.equal(report.checks[key],true,key);
 assert.equal(report.counts.attempts,4);assert.equal(report.counts.coreLedger,4);assert.equal(report.counts.operations,2);assert.equal(report.counts.protections,2);assert.equal(report.counts.guards,0);
 const before=report.counts,requestId=randomUUID();const first=await c.send('new3',saved.actionId,'ACTION',requestId);assert.match(first.state.replies.at(-1).payload.text,/No se confirmó/);assert.equal(first.state.replies.at(-1).payload.outcome,'OFFER');
 const duplicate=await c.send('new3',saved.actionId,'ACTION',requestId);assert.equal(duplicate.admission.inputId,first.admission.inputId);await c.send('new3',saved.actionId,'ACTION');
 await crashCapacity(s);const resumed=await locked(s,()=>startCapacity(s));c=await capacityClient(s,resumed);report=await c.report();assert.equal(report.savedOffer.actionId,saved.actionId);assert.equal(report.savedOffer.replyId,saved.replyId);assert.equal(report.savedOffer.revision,saved.revision);assert.equal(report.savedOffer.expiresAt,saved.expiresAt);
 await c.send('new3',saved.actionId,'ACTION');report=await c.until(r=>r.staleInputs.length===3&&r.counts.pendingInputs===0);
 for(const key of Object.keys(report.checks))assert.equal(report.checks[key],true,key);assert.deepEqual(report.c4,{appointments:0,bookingAttempts:0,confirmationAttempts:0,intents:0,protections:0,ledger:0});for(const field of ['appointments','operations','attempts','coreLedger','protections','guards','bookingIntents'])assert.equal(report.counts[field],before[field],field);
 const fresh=await c.offer('new2');assert.equal(fresh.view.slots.some(x=>Date.parse(x.slot.startAt)===Date.parse(saved.slot.startAt)),false);assert.equal(Date.parse(fresh.first.slot.startAt),Date.parse(s.capacityFixture.protectedUntil)+15*60000,'10:15 protection ends; next30-min-grid slot10:30');
 const other=await capacityClient(s,resumed,'synthetic-b');await other.send('new3',saved.actionId,'ACTION');assert.equal((await other.report()).counts.appointments,0);await other.book('known');assert.equal((await other.report()).counts.activeAppointments,1);assert.equal((await c.report()).counts.activeAppointments,2);
 // Unrelated customer can book a genuine later alternative in the original business.
 await c.send('new2',fresh.first.actionId,'ACTION');await c.until(r=>r.counts.activeAppointments===3&&r.counts.pendingAttempts===0);assert.equal((await c.report()).checks.c4HasNoBooking,true);
 console.log(JSON.stringify({capacity:'PASS',platform:process.platform,node:process.version,postgres:s.observed.serverVersion,savedServerAction:true,customers:4,employees:2,targetAppointments:2,staleAfterFull:'REJECTED',sameRequestIdentity:true,newRequestReplays:2,crashRestart:true,durationMinutes:60,bufferMinutes:15,nextGridOffsetMinutes:90,c4BookingAttempts:0,c4Appointments:0,otherBusinessOperational:true,unrelatedCustomerOperational:true,ownerBrowserAcceptance:'PENDING',nativeWindows:process.platform==='win32'?'EXECUTED':'NOT RUN'}));
});

test('capacity near-simultaneous three-customer admission to two places never overbooks',{timeout:660000},async t=>{
 const {s,running}=await capacityFixture(t),c=await capacityClient(s,running),offers=await Promise.all(['known','new','new3'].map(p=>c.offer(p)));
 const actions=await Promise.all(['known','new','new3'].map((p,i)=>c.send(p,offers[i].first.actionId,'ACTION')));assert.equal(actions.length,3);
 const report=await c.until(r=>r.counts.pendingInputs===0&&r.counts.pendingAttempts===0);assert.equal(report.counts.activeAppointments,2);assert.equal(report.calendar.length,2);assert.equal(new Set(report.calendar.map(a=>a.resource_id)).size,2);assert.equal(report.counts.coreLedger,4);assert.equal(report.counts.attempts,4);assert.equal(report.counts.protections,2);assert.equal(report.counts.guards,0);assert.equal(report.appointments.every(a=>Date.parse(a.start_at)===Date.parse(s.capacityFixture.startAt)),true);
});

test('capacity CLI status/stop/start/reset use only marked fixture, preserve prior evidence and work with Unicode/spaces',{timeout:660000},async t=>{
 const {s,directory}=await capacityFixture(t,{cliPrepare:true}),cli=fileURLToPath(new URL('./capacity-cli.mjs',import.meta.url)),exec=promisify(execFile);
 const call=async(command,extra=[])=>JSON.parse((await exec(process.execPath,[cli,command,'--state-dir',directory,...extra],{windowsHide:true,timeout:660000,maxBuffer:1024*1024})).stdout);
 const initial=await call('status');assert.equal(initial.fixture.instance,s.id);await assert.rejects(call('reset',['--confirm','wrong']),/exact_instance/);assert.equal((await call('status')).fixture.instance,s.id);
 await call('stop');const restarted=await call('start');assert.equal(restarted.instance,s.id);assert.equal(new URL(restarted.url).port,String(s.capacityFixture.uiPort));
 const reset=await call('reset',['--confirm',s.id]);assert.notEqual(reset.instance,s.id);assert.equal(reset.backupAndPreviousStateRetained,true);const fresh=await readCapacity(directory);assert.notEqual(fresh.database,s.database);assert.equal(fresh.capacityFixture.uiPort,s.capacityFixture.uiPort);assert.ok((await fs.readdir(path.join(directory,'previous-'+s.id))).includes('custody'));assert.ok((await fs.readdir(path.join(directory,'backups'))).length>0);assert.equal((await call('status')).counts.appointments,0);await call('start');await call('stop');
});
