import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {promises as fs} from 'node:fs';
const exec=promisify(execFile);
export const IMAGE='postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5';
export const IMAGE_PULL_TIMEOUT_MS=600000;
export function sanitizeDockerDiagnostic(value,args=[]){
 let text=String(value??'');
 for(const arg of args){const m=String(arg).match(/^(?:POSTGRES_PASSWORD|PGPASSWORD|[^=]*(?:TOKEN|SECRET|PASSWORD))=(.+)$/i);if(m?.[1])text=text.split(m[1]).join('[REDACTED]');}
 return text.replace(/\b(POSTGRES_PASSWORD|PGPASSWORD|\w*(?:TOKEN|SECRET|PASSWORD))\s*=\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,'$1=[REDACTED]')
  .replace(/((?:https?|postgres(?:ql)?):\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi,'$1[REDACTED]@')
  .replace(/((?:proxy-)?authorization\s*:)\s*[^\r\n]+/gi,'$1 [REDACTED]').replace(/[\r\n]+/g,' ').slice(0,1200);
}
export class LocalDockerError extends Error {
 constructor(action,error,args,timeout){
  const detail=sanitizeDockerDiagnostic(error.stderr,args),timedOut=error.killed===true||error.code==='ETIMEDOUT';
  const hint=timedOut?'The command timed out after '+timeout+'ms. Check Docker Desktop/registry connectivity and retry; keep TLS verification enabled.':error.code==='ENOENT'?'Install Docker Desktop and ensure docker.exe is on PATH.':/port.*allocated|address already in use|bind.*failed/i.test(detail)?'That loopback port is occupied. Choose a separate candidate port; no fallback is used.':/pipe|daemon|cannot connect|connection refused/i.test(detail)?'Start Docker Desktop in Linux-container mode, then check docker info.':action==='pull'?'Check registry connectivity, proxy/CA trust or Docker Hub rate limits, then retry the pinned image pull.':'Check Docker Desktop Linux-container mode and the diagnostic below.';
  super('local_docker_'+action+'_failed: '+hint+(detail?' Diagnostic: '+detail:''));this.code=timedOut?'LOCAL_DOCKER_TIMEOUT':'LOCAL_DOCKER_FAILED';this.action=action;this.diagnostic=detail;
 }
}
export function dockerRunner(run=exec,platform=process.platform){return async(args,options={})=>{
 const env={...process.env};for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[key];
 if(!['linux','win32'].includes(platform))throw Error('local_docker_platform_unsupported');
 const endpoint=platform==='win32'?'npipe:////./pipe/docker_engine':'unix:///var/run/docker.sock';const config={env,maxBuffer:64*1024*1024,timeout:30000,...options,windowsHide:true};
 try{return await run(platform==='win32'?'docker.exe':'docker',['--host='+endpoint,...args],config);}catch(error){throw new LocalDockerError(args[0],error,args,config.timeout);}
 };}
export const docker=dockerRunner();
export async function ensurePinnedImage(command=docker){
 await command(['pull',IMAGE],{timeout:IMAGE_PULL_TIMEOUT_MS});
 const {stdout}=await command(['image','inspect',IMAGE,'--format','{{json .RepoDigests}}']);const digests=JSON.parse(stdout);
 if(!Array.isArray(digests)||!digests.some(d=>typeof d==='string'&&d.replace(/^docker\.io\/library\//,'')===IMAGE))throw Error('local_pinned_image_digest_mismatch');
 return {image:IMAGE,verified:true};
}
const ACL_READ="$ErrorActionPreference='Stop'; $a=Get-Acl -LiteralPath $env:NUKMIRIS_ACL_TARGET; $r=@($a.Access | ForEach-Object { [pscustomobject]@{sid=$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value; rights=[int]$_.FileSystemRights; type=$_.AccessControlType.ToString(); inherited=[bool]$_.IsInherited; inheritance=[int]$_.InheritanceFlags; propagation=[int]$_.PropagationFlags} }); [pscustomobject]@{protected=[bool]$a.AreAccessRulesProtected; rules=$r} | ConvertTo-Json -Compress -Depth 4";
export function windowsPrivacy(run=exec){
 const hidden={windowsHide:true,timeout:10000};
 const currentSid=async()=>{const {stdout}=await run('whoami.exe',['/user','/fo','csv','/nh'],hidden);const sid=stdout.match(/S-\d+(?:-\d+)+/)?.[0];if(!sid)throw Error('windows_user_sid_missing');return sid;};
 const verify=async(target,{directory=false,sid}={})=>{
  sid??=await currentSid();await run('icacls.exe',[target],hidden); // Native read-back, never assume a successful grant established privacy.
  const {stdout}=await run('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',ACL_READ],{...hidden,env:{...process.env,NUKMIRIS_ACL_TARGET:target}});const acl=JSON.parse(stdout),rule=Array.isArray(acl.rules)&&acl.rules.length===1?acl.rules[0]:null;
  if(!rule||rule.sid!==sid||rule.type!=='Allow'||(rule.rights&2032127)!==2032127||(directory&&(!acl.protected||rule.inherited||rule.inheritance!==3||rule.propagation!==0)))throw Error('windows_private_acl_verification_failed');
  return {platform:'win32',principal:'CURRENT_USER',aceCount:1,fullControl:true,icaclsReadBack:true,protectedDirectory:directory?acl.protected:undefined};
 };
 return {verify,async protect(directory){const sid=await currentSid();await run('icacls.exe',[directory,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F'],hidden);return verify(directory,{directory:true,sid});}};
}
export async function protect(directory){if(process.platform==='win32')return windowsPrivacy().protect(directory);await fs.chmod(directory,0o700);return {platform:process.platform,mode:'0700'};}
export async function assertPrivate(target,options={}){if(process.platform==='win32')return windowsPrivacy().verify(target,options);const mode=(await fs.stat(target)).mode&0o777;if(mode!==(options.directory?0o700:0o600))throw Error('local_private_mode_denied');return {platform:process.platform,mode:mode.toString(8)};}
