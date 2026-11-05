import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {IMAGE,IMAGE_PULL_TIMEOUT_MS,ensurePinnedImage,dockerRunner,windowsPrivacy,assertPrivate} from './platform.mjs';
import {provision} from './fixture.mjs';
import {childOptions} from './child.mjs';
const sid='S-1-5-21-100-200-300-1001';
const privateAcl={protected:true,rules:[{sid,type:'Allow',rights:2032127,inherited:false,inheritance:3,propagation:0}]};
function windowsMock(acl=privateAcl){const calls=[];const run=async(exe,args,options)=>{calls.push({exe,args,options});return {stdout:exe==='whoami.exe'?`"Synthetic","${sid}"`:exe==='powershell.exe'?JSON.stringify(acl):'processed 1 files; failed 0'};};return {run,calls};}
test('W1 numeric SID uses wildcard prefix; icacls and SID-normalized ACL are read back; every native process hidden',async()=>{
 const m=windowsMock();assert.equal((await windowsPrivacy(m.run).protect('C:\\Synthetic salón\\.local-demo')).aceCount,1);assert.deepEqual(m.calls.find(c=>c.args.includes('/grant:r')).args,['C:\\Synthetic salón\\.local-demo','/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F']);assert.ok(m.calls.some(c=>c.exe==='icacls.exe'&&c.args.length===1));assert.ok(m.calls.every(c=>c.options.windowsHide));
});
for(const [name,acl] of [['extra ACE',{...privateAcl,rules:[...privateAcl.rules,{...privateAcl.rules[0],sid:'S-1-1-0'}]}],['wrong SID',{...privateAcl,rules:[{...privateAcl.rules[0],sid:'S-1-1-0'}]}],['inherited root',{...privateAcl,rules:[{...privateAcl.rules[0],inherited:true}]}],['unprotected root',{...privateAcl,protected:false}]])test('W1 refuses a successful grant with invalid ACL: '+name,async()=>{await assert.rejects(windowsPrivacy(windowsMock(acl).run).protect('C:\\Synthetic'),/acl_verification_failed/);});
test('W1 failed protection/pull removes only the empty root it created and permits a fresh retry',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nukmiris-vnext-failed-'));try{
  const directory=path.join(root,'.local-demo');await assert.rejects(provision(directory,{port:0},{protect:async()=>{throw Error('ACL rejected');},command:async()=>{throw Error('must not reach Docker');}}),/ACL rejected/);await assert.rejects(fs.stat(directory),{code:'ENOENT'});
  const calls=[];const command=async args=>{calls.push(args[0]);if(args[0]==='info')return {stdout:'linux'};throw Error('pull refused');};await assert.rejects(provision(directory,{port:0},{command}),/pull refused/);assert.deepEqual(calls,['info','pull']);await assert.rejects(fs.stat(directory),{code:'ENOENT'});
  await fs.mkdir(directory);await fs.writeFile(path.join(directory,'do-not-delete'),'owned outside failed provisioning');await assert.rejects(provision(directory,{port:0}),/EEXIST/);assert.equal(await fs.readFile(path.join(directory,'do-not-delete'),'utf8'),'owned outside failed provisioning');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('W2 explicit digest pull has a ten-minute budget and rejects a different reported image',async()=>{
 const calls=[];const command=async(args,options)=>{calls.push({args,options});return {stdout:JSON.stringify([IMAGE])};};assert.equal((await ensurePinnedImage(command)).verified,true);assert.deepEqual(calls[0],{args:['pull',IMAGE],options:{timeout:600000}});assert.ok(IMAGE_PULL_TIMEOUT_MS>=600000);assert.equal(calls[1].args[0],'image');await assert.rejects(ensurePinnedImage(async()=>({stdout:'["postgres@sha256:wrong"]'})),/digest_mismatch/);
});
for(const [name,failure,pattern] of [['port',{stderr:'port is already allocated'},/occupied/],['desktop',{stderr:'open \\\\.\\pipe\\docker_engine: pipe not found'},/Docker Desktop/],['timeout',{killed:true,stderr:'read timed out'},/timed out after 600000ms/],['missing binary',{code:'ENOENT'},/Install Docker Desktop/]])test('W2 actionable sanitized Docker error: '+name,async()=>{
 const secret='fixture-secret-never-log',run=async()=>{throw {...failure,stderr:(failure.stderr??'')+' POSTGRES_PASSWORD='+secret+' https://proxy-user:proxy-pass@proxy.invalid',message:'argv '+secret};};try{await dockerRunner(run,'win32')(['pull','POSTGRES_PASSWORD='+secret],{timeout:600000});assert.fail();}catch(e){assert.match(e.message,pattern);assert.ok(!JSON.stringify(e).includes(secret));assert.ok(!e.message.includes(secret));assert.ok(!e.message.includes('proxy-pass'));assert.ok(!e.message.includes('argv'));}
});
test('W5 Docker endpoint selection and child creation force hidden windows',async()=>{let seen;await dockerRunner(async(exe,args,options)=>{seen={exe,args,options};return {stdout:''};},'win32')(['info']);assert.equal(seen.exe,'docker.exe');assert.match(seen.args[0],/npipe:/);assert.equal(seen.options.windowsHide,true);assert.equal(childOptions().windowsHide,true);});
test('W1 native Windows directory, child file and persisted state privacy', {skip:process.platform!=='win32'?'Native Windows ACL execution unavailable on this host':false},async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nukmiris-vnext-acl-'));try{await windowsPrivacy().protect(root);const sub=path.join(root,'sub');await fs.mkdir(sub);const file=path.join(sub,'probe.json');await fs.writeFile(file,'synthetic',{mode:0o600});const a=await assertPrivate(root,{directory:true}),b=await assertPrivate(file);assert.equal(a.aceCount,1);assert.equal(b.aceCount,1);console.log(JSON.stringify({nativeWindowsAcl:'EXECUTED',principal:'CURRENT_USER',onlySelfAce:true,icaclsReadBack:true}));}finally{await fs.rm(root,{recursive:true,force:true});}
});

test('W1 Azure AD numeric SID is supported without account-name resolution',async()=>{
 const aad='S-1-12-1-100-200-300-400',m=windowsMock({...privateAcl,rules:[{...privateAcl.rules[0],sid:aad}]});const run=async(exe,args,opts)=>exe==='whoami.exe'?{stdout:aad}:m.run(exe,args,opts);await windowsPrivacy(run).protect('C:\\Synthetic');assert.ok(m.calls.some(c=>c.args.includes('*'+aad+':(OI)(CI)F')));
});
