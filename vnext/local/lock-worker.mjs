import {readState} from './fixture.mjs';
import {locked} from './command-lock.mjs';
process.once('message',config=>{void(async()=>{const s=await readState(config.directory);await locked(s,async()=>{process.send?.({type:'ready'});await new Promise(resolve=>process.once('message',resolve));});if(process.connected)process.disconnect();})().catch(e=>{process.send?.({type:'error',message:e.message});process.exitCode=1;if(process.connected)process.disconnect();});});
