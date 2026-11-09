import path from 'node:path';
import {ROOT,startDatabase} from './fixture.mjs';
import {locked,stop} from './runtime.mjs';
import {prepareCapacity,readCapacity,startCapacity,resetCapacity,capacityReport} from './capacity-fixture.mjs';
const args=process.argv.slice(2),command=args.shift(),options={};
try{
 while(args.length){const key=args.shift(),value=args.shift();if(!['--state-dir','--db-port','--port','--confirm'].includes(key)||value===undefined||options[key]!==undefined)throw Error('capacity_option_denied');options[key]=value;}
 if(!['prepare','start','stop','status','reset'].includes(command))throw Error('capacity_command_denied');
 if(command!=='prepare'&&(options['--db-port']!==undefined||options['--port']!==undefined))throw Error('capacity_ports_are_fixed_at_prepare');
 const directory=path.resolve(options['--state-dir']??path.join(ROOT,'nukmiris-vnext-capacity-owner'));
 let result;
 if(command==='prepare'){const s=await prepareCapacity(directory,{dbPort:Number(options['--db-port']??15442),uiPort:Number(options['--port']??3087)});result={prepared:true,fixture:s.capacityFixture,instance:s.id,database:s.database,directory:s.directory,dbPort:s.port,commandPort:s.commandPort,stopped:true};}
 else{const s=await readCapacity(directory);result=await locked(s,async()=>{
  if(command==='start')return startCapacity(s);
  if(command==='stop')return stop(s);
  if(command==='reset')return resetCapacity(s,options['--confirm']);
  await startDatabase(s);return capacityReport(s,'synthetic-a');
 });}
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error('Isolated capacity fixture failed: '+e.message);process.exitCode=1;}
