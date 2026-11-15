import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {LIVE_CLOUD_EXECUTION} from '../b1a2/runtime/transport.mjs';
const root=new URL('../../',import.meta.url),base='564be22d57ec895208002925c9ac1a2f7abd4a8e';
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
const hash=b=>createHash('sha256').update(b).digest('hex');
const permitted=new Set(['platform-proof/readiness/build-image.py','platform-proof/package.json']);
const files=git('ls-tree','-r','--name-only',base).toString().trim().split('\n');
let checked=0;
for(const file of files){
  if(permitted.has(file))continue;
  if(hash(git('show',base+':'+file))!==hash(await readFile(new URL(file,root))))throw Error('historical_or_application_bytes_changed '+file);
  checked++;
}
const changed=git('diff','--name-only',base).toString().trim().split('\n').filter(Boolean);
const allowed=p=>permitted.has(p)||p.startsWith('platform-proof/pc1/')||p==='platform-proof/test/pc1-hardening.test.mjs';
if(changed.some(p=>!allowed(p)))throw Error('PC1_scope_expansion');
const untracked=git('ls-files','--others','--exclude-standard').toString().trim().split('\n').filter(Boolean);
if(untracked.some(p=>!allowed(p)))throw Error('PC1_untracked_scope_expansion');
if(LIVE_CLOUD_EXECUTION!==false)throw Error('live_cloud_guard_changed');
console.log(JSON.stringify({scope:'PC1_LOCAL_SECURITY_ONLY',base,historicalAndApplicationFilesVerified:checked,
  liveCloudExecution:false,sourceOnlyApplyGuard:'UNCHANGED_BYTES',cloudOrProviders:'NOT_EXECUTED'}));
