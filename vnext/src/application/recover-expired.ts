import type {UnitOfWork} from '../infrastructure/postgres/unit-of-work.js';
import type {EvidenceStore} from '../ports.js';
import {boundedArchive} from './archive-policy.js';
import {noFaults,type Faults} from '../domain/protocol.js';
export interface RecoveryScope {businessId:string;archive:EvidenceStore;reducer:UnitOfWork;sealer:UnitOfWork}
/** No provider/clock/identity factory: DB time and original attempts alone authorize recovery. */
export async function recoverExpired(args:RecoveryScope&{conversationId:string;faults?:Faults}):Promise<{abandoned:string[];outputsExpired:number}>{
 const {businessId:b,conversationId,reducer,sealer}=args;if(args.archive.businessId!==b)throw Error('recovery_tenant_archive_binding_required');const archive=boundedArchive(args.archive);
 return reducer.tx(b,async db=>{
  const rows=(await db.query<{v:{attemptId:string;payloadDigest:string;deadlineAt:string}[]}>('SELECT core.expired_operations($1,$2) v',[b,conversationId])).rows[0]!.v,abandoned:string[]=[];
  for(const a of rows){const seal=await archive.ensure(`deadline-expiry/${b}/${a.attemptId}`,'ABANDON',{businessId:b,...a,reason:'DEADLINE_EXPIRED'});await sealer.seal(b,archive,seal);
   if((await db.query<{v:boolean}>('SELECT core.expire_operation($1,$2,$3,$4) v',[b,a.attemptId,seal.key,seal.digest])).rows[0]!.v)abandoned.push(a.attemptId);
  }
  const outputsExpired=(await db.query<{v:number}>('SELECT core.expire_conversation_outputs($1,$2) v',[b,conversationId])).rows[0]!.v;return {abandoned,outputsExpired};
 },'deadline-recovery',args.faults??noFaults);
}
export class RecoveryWorker {
 private readonly cursors=new Map<string,string>();private inFlight:Promise<void>|undefined;private timer:ReturnType<typeof setInterval>|undefined;
 constructor(private readonly scopes:readonly RecoveryScope[]){if(new Set(scopes.map(s=>s.businessId)).size!==scopes.length||scopes.some(s=>s.archive.businessId!==s.businessId))throw Error('recovery_tenant_archive_binding_required');}
 tick():Promise<void>{if(this.inFlight)return this.inFlight;const work=this.runPass();this.inFlight=work;void work.finally(()=>{if(this.inFlight===work)this.inFlight=undefined;}).catch(()=>{});return work;}
 private async runPass():Promise<void>{const failures:unknown[]=[];for(const s of this.scopes)try{
  const ids=await s.reducer.tx(s.businessId,async db=>(await db.query<{v:string[]}>('SELECT core.expired_conversations($1,$2,$3) v',[s.businessId,this.cursors.get(s.businessId)??'',100])).rows[0]!.v);
  this.cursors.set(s.businessId,ids.at(-1)??'');for(const conversationId of ids)try{await recoverExpired({...s,conversationId});}catch(e){failures.push(e);}
 }catch(e){failures.push(e);}if(failures.length)throw new AggregateError(failures,'deadline_recovery_held');}
 start(intervalMs:number,onError:(e:unknown)=>void):void{if(this.timer||!Number.isInteger(intervalMs)||intervalMs<25||intervalMs>60000)throw Error('recovery_worker_schedule_denied');this.timer=setInterval(()=>{void this.tick().catch(onError);},intervalMs);}
 async stop():Promise<void>{clearInterval(this.timer);this.timer=undefined;await this.inFlight;}
}
