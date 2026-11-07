import path from 'node:path';
import {moveGuardPort} from './command-lock.mjs';
import {enableInteractive} from './interactive-profile.mjs';
import {restoreInteractive} from './coherent-backup.mjs';
import {upgrade} from './upgrade.mjs';
import {ROOT} from './fixture.mjs';
import {provision,readState,start,stop,backup,reset,locked,recoverLegacyLock} from './runtime.mjs';
const args=process.argv.slice(2),command=args.shift(),options={};
try{
 while(args.length){const k=args.shift(),v=args.shift();if(!['--state-dir','--db-port','--port','--confirm','--command-port','--backup','--sha256'].includes(k)||v===undefined||options[k]!==undefined)throw Error('unsupported_local_option');options[k]=v;}
 const directory=path.resolve(options['--state-dir']??path.join(ROOT,'.local-demo'));let result;
 if(command==='restore'){result=await restoreInteractive(options['--backup'],options['--sha256'],directory,{port:Number(options['--db-port']??15432)});}
 else if(command==='book'){let s;try{s=await readState(directory);}catch(e){if(e.code!=='ENOENT')throw e;s=await provision(directory,{port:Number(options['--db-port']??15432)});}result=await locked(s,async()=>{if(!s.application)await enableInteractive(s);return start(s,Number(options['--port']??3077));});}
 else if(command==='prepare'){const s=await provision(directory,{port:Number(options['--db-port']??15432)});result={prepared:true,instance:s.id,database:s.database,host:s.host,port:s.port,mode:s.mode,timezone:s.observed.timeZone,postgres:s.observed.serverVersion};}
 else{const s=await readState(directory);if(command==='unlock')result=options['--command-port']?await moveGuardPort(s,options['--confirm'],Number(options['--command-port'])):await recoverLegacyLock(s,options['--confirm']);else result=await locked(s,async()=>{
  if(command==='upgrade')return upgrade(s,options['--confirm']);if(command==='start')return start(s,Number(options['--port']??3077));if(command==='stop')return stop(s);if(command==='backup')return backup(s);if(command==='reset')return reset(s,options['--confirm']);if(command==='smoke'){const {smoke}=await import('./smoke.mjs');return smoke(s);}throw Error('unsupported_local_command');
 });}
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error('Local synthetic runtime failed: '+e.message);process.exitCode=1;}
