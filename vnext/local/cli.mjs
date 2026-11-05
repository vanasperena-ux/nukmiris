import path from 'node:path';
import {ROOT} from './fixture.mjs';
import {provision,readState,start,stop,backup,reset,locked} from './runtime.mjs';
const args=process.argv.slice(2),command=args.shift(),options={};
try{
 while(args.length){const k=args.shift(),v=args.shift();if(!['--state-dir','--db-port','--port','--confirm'].includes(k)||v===undefined||options[k]!==undefined)throw Error('unsupported_local_option');options[k]=v;}
 const directory=path.resolve(options['--state-dir']??path.join(ROOT,'.local-demo'));let result;
 if(command==='prepare'){const s=await provision(directory,{port:Number(options['--db-port']??55432)});result={prepared:true,instance:s.id,database:s.database,host:s.host,port:s.port,mode:s.mode,timezone:'UTC'};}
 else{const s=await readState(directory);result=await locked(directory,async()=>{
  if(command==='start')return start(s,Number(options['--port']??3077));if(command==='stop')return stop(s);if(command==='backup')return backup(s);if(command==='reset')return reset(s,options['--confirm']);if(command==='smoke'){const {smoke}=await import('./smoke.mjs');return smoke(s);}throw Error('unsupported_local_command');
 });}
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error('Local synthetic runtime failed: '+e.message);process.exitCode=1;}
