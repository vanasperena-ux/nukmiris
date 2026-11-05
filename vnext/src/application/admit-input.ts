import { createHash,randomUUID } from 'node:crypto';
import { verifyRaw } from '../infrastructure/meta-signature.js';
import { canonical,depth,digest,object,text,noFaults } from '../domain/protocol.js';
import type { Clock,Faults,Json,ObjectValue } from '../domain/protocol.js';
import { tenantId } from '../domain/tenant.js';
import { classificationSpec,classify,CLASS_RULE } from '../domain/classification.js';
import type { UnitOfWork } from '../infrastructure/postgres/unit-of-work.js';
import type { AdmissionCustody } from './admission-custody.js';
import { reduceInput,drainOrdinary } from './reduce-input.js';

export interface Route { businessId:string; channelId:string; waba:string; numberId:string; channelRevision:number }
export interface Admission { acknowledged:true; batchId:string; inputs:ObjectValue[]; reductions:ObjectValue[] }
export async function admitInput(args:{raw:Buffer;signature:string;secret:Buffer;routes:Route[];ingress:UnitOfWork;sealer:UnitOfWork;reducer:UnitOfWork;custody:AdmissionCustody;clock:Clock;faults?:Faults}):Promise<Admission> {
  const {raw,signature,secret,routes,ingress,sealer,reducer,custody,clock}=args,faults=args.faults??noFaults;
  verifyRaw(raw,signature,secret);const body=object(JSON.parse(raw.toString('utf8')));depth(body);
  if(!Array.isArray(body['entry'])||body['entry'].length<1||body['entry'].length>10)throw new Error('batch_shape');
  const configured=new Set<string>();
  for(const r of routes){tenantId(r.businessId);const k=r.waba+'\0'+r.numberId;if(configured.has(k))throw new Error('ambiguous_route');configured.add(k);}
  const parsed:{route:Route;event:ObjectValue;subject:string;providerId:string;spec:ObjectValue}[]=[];
  for(const entryValue of body['entry']) {
    const entry=object(entryValue);if(!Array.isArray(entry['changes']))throw new Error('batch_shape');
    for(const change of entry['changes']) {
      const val=object(object(change)['value']),numberId=text(object(val['metadata'])['phone_number_id']);
      const route=routes.find(r=>r.waba===entry['id']&&r.numberId===numberId);if(!route)throw new Error('route_rejected');
      if(!Array.isArray(val['messages']))throw new Error('message_shape');
      for(const message of val['messages']) {
        const event=object(message),type=text(event['type']);if(!['text','receipt'].includes(type))throw new Error('unsupported_message');
        const keys=type==='text'?['id','from','type','text']:['id','type','recipient','attemptId','messageId','status'];
        if(Object.keys(event).some(k=>!keys.includes(k)))throw new Error('message_schema');
        const providerId=text(event['id']),subject=type==='receipt'?text(event['recipient']):text(event['from']);
        if(type==='text'){const t=object(event['text']);if(Object.keys(t).some(k=>k!=='body'))throw new Error('message_schema');text(t['body']);}
        else{text(event['attemptId']);text(event['messageId']);if(!['sent','delivered','read','failed'].includes(text(event['status'])))throw new Error('receipt_shape');}
        parsed.push({route,event,subject,providerId,spec:classificationSpec(event)});
      }
    }
  }
  if(parsed.length<1||parsed.length>100)throw new Error('batch_size');
  const withdrawals:{businessId:string;e:string;subject:string;d:string;at:string;rev:number}[]=[],failures:unknown[]=[];
  // The same classification drives immediate revoke and the sealed SQL head.
  // Complete all authenticated withdrawals before resolving any custody binding.
  for(const v of parsed)if(v.spec['kind']==='WITHDRAWAL') {
    const b=v.route.businessId,d=digest(v.event),e='inbound:'+v.route.channelId+':'+v.providerId,at=clock.now().toISOString();
    try{const rev=await ingress.tx(b,async db=>(await db.query<{revision:string}>('SELECT core.suppress($1,$2,$3,$4,$5) AS revision',[b,v.subject,e,d,at])).rows[0]!.revision);withdrawals.push({businessId:b,e,subject:v.subject,d,at,rev:Number(rev)});}catch(error){failures.push(error);}
  }
  for(const w of withdrawals)try{await custody.tenant(w.businessId).ensure(`permission/${w.businessId}/${w.e}`,'SUPPRESSION',{businessId:w.businessId,subject:w.subject,evidenceId:w.e,digest:w.d},()=>({revision:w.rev,occurredAt:w.at}));}catch(error){failures.push(error);}
  const batchId=createHash('sha256').update(raw).digest('hex'),allItems:ObjectValue[]=[],reductions:ObjectValue[]=[];
  const rawSeal=await custody.retainRaw(batchId,raw,signature);
  for(const b of [...new Set(parsed.map(v=>v.route.businessId))].sort())try {
    const archive=custody.tenant(b),items:ObjectValue[]=[];
    const partition=parsed.filter(v=>v.route.businessId===b).sort((a,z)=>Buffer.compare(Buffer.from(a.route.channelId+'\0'+a.subject),Buffer.from(z.route.channelId+'\0'+z.subject)));
    for(const v of partition) {
      const conversation=await archive.ensure(`conversation/${b}/${v.route.channelId}/${digest(v.subject)}`,'CONVERSATION',{businessId:b,channelId:v.route.channelId,subject:v.subject},()=>({conversationId:randomUUID()}));
      const key=`input/${b}/${v.route.channelId}/${digest(v.providerId)}`,match={...v.route,event:v.event,digest:digest(v.event),subject:v.subject,providerId:v.providerId,conversationId:conversation.body['conversationId']!,inputSealKey:key};
      const input=await archive.ensure(key,'INPUT',match,()=>{const inputId=randomUUID();return {inputId,receivedAt:clock.now().toISOString(),classification:classify(v.event,{businessId:b,channelId:v.route.channelId,subject:v.subject,inputId},v.spec)};});
      // A retry retains the original frozen rule, class, IDs and admission time.
      const c=object(input.body['classification']);
      if(c['version']!==1||c['ruleVersion']!==CLASS_RULE||c['businessId']!==b||c['inputId']!==input.body['inputId']||c['eventDigest']!==match.digest||c['channelId']!==v.route.channelId||c['subject']!==v.subject)throw new Error('classification_incompatible');
      if(Object.entries(match).some(([k,x])=>canonical(input.body[k]!)!==canonical(x)))throw new Error('input_conflict');
      await sealer.seal(b,archive,input);items.push(input.body);
    }
    const batchDigest=digest(items as Json);
    await archive.ensure(`batch/${b}/${batchId}`,'BATCH_PREPARE',{businessId:b,batchId,batchDigest,items,rawBatchKey:rawSeal.key,rawBatchDigest:rawSeal.digest});
    await faults.hit('A1.afterPrepare');await ingress.tx(b,async db=>{await db.query('SELECT core.stage_batch($1,$2,$3,$4)',[b,batchId,batchDigest,JSON.stringify(items)]);},'A2',faults);
    const seal=await archive.ensure(`batch-commit/${b}/${batchId}`,'BATCH_COMMIT',{businessId:b,batchId,batchDigest,count:items.length,membershipDigest:digest(items),rawBatchKey:rawSeal.key,rawBatchDigest:rawSeal.digest});
    await faults.hit('A3.afterSeal');await sealer.seal(b,archive,seal);
    await ingress.tx(b,async db=>{await db.query('SELECT core.activate_batch($1,$2,$3,$4)',[b,batchId,seal.key,seal.digest]);},'A4',faults);
    for(const item of items)reductions.push(await reduceInput({businessId:b,inputId:text(item['inputId']),reducer,sealer,archive,faults}));
    for(const conversationId of [...new Set(items.map(i=>text(i['conversationId'])))])await drainOrdinary({businessId:b,conversationId,reducer,sealer,archive});
    await faults.hit('A5.beforeAck');allItems.push(...items);
  }catch(error){failures.push(error);}
  if(failures.length)throw new AggregateError(failures,'admission_incomplete: '+failures.map(String).join('; '));
  return {acknowledged:true,batchId,inputs:allItems,reductions};
}
