import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {startCluster} from '../dist/test/support/postgres-fixture.js';

const mode=process.argv[2]??'full';
if(!['full','fault','conditions','l0b','concurrency'].includes(mode))throw new Error('unknown_test_mode');
const cluster=await startCluster();
let exitCode=1;
try {
const runId=new Date().toISOString().replaceAll(':','-')+'-'+mode;
const evidence=path.resolve('evidence/runs',runId);await fs.mkdir(evidence,{recursive:true});
console.log('WP1 evidence run: '+evidence);
await fs.writeFile(path.join(evidence,'environment.json'),JSON.stringify({mode,node:process.version,postgres:cluster.version,image:'postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5',network:'container --network none; Unix socket only',independentReview:'NOT RUN'},null,2));
 const files=(await fs.readdir('dist/test')).filter(f=>f.endsWith('.test.js')&&(!process.argv.includes('conditions')||f==='review-conditions.test.js')&&(!process.argv.includes('l0b')||f.startsWith('l0b-'))&&(!process.argv.includes('concurrency')||/concurrent|process|l0b-/.test(f))&&(!process.argv.includes('fault')||/l0b|archive|dispatch|permission|restore|process|ingress|remediation|concurrent|review-conditions/.test(f))).sort().map(f=>'dist/test/'+f);
 const child=spawn(process.execPath,['--test','--test-concurrency=1','--test-reporter=spec',...files],{
  stdio:'inherit',env:{...process.env,WP1_SOCKET_PATH:cluster.socket,WP1_EVIDENCE_DIRECTORY:evidence}
 });
 exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
} finally {await cluster.stop();}
process.exitCode=exitCode;
