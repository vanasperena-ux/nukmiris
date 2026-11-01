import { createHash,randomUUID } from 'node:crypto';
import { verifyRaw } from '../infrastructure/meta-signature.js';
import { depth,digest,isWithdrawal,object,text,noFaults } from '../domain/protocol.js';
import type { Clock,Faults,Json,ObjectValue } from '../domain/protocol.js';
import type { EvidenceStore } from '../ports.js';
import type { UnitOfWork } from '../infrastructure/postgres/unit-of-work.js';

export interface Route { businessId:string; channelId:string; waba:string; numberId:string; channelRevision:number }
export interface Admission { acknowledged:true; batchId:string; inputs:ObjectValue[] }
export async function admitInput(args:{raw:Buffer;signature:string;secret:Buffer;routes:Route[];ingress:UnitOfWork;sealer:UnitOfWork;archive:EvidenceStore;clock:Clock;faults?:Faults}):Promise<Admission> {
  const {raw,signature,secret,routes,ingress,sealer,archive,clock}=args,faults=args.faults??noFaults;
  verifyRaw(raw,signature,secret);const body=object(JSON.parse(raw.toString('utf8')));depth(body);
  if(!Array.isArray(body['entry'])||body['entry'].length<1||body['entry'].length>10)throw new Error('batch_shape');
  // WP1 deliberately admits a single-business batch. Mixed-tenant raw batches
  // are rejected before writes; later commercial normalization is not implemented.
  const parsed:{route:Route;event:ObjectValue;subject:string;providerId:string}[]=[];
  for(const entryValue of body['entry']) {
    const entry=object(entryValue);if(!Array.isArray(entry['changes']))throw new Error('batch_shape');
    for(const change of entry['changes']) {
      const val=object(object(change)['value']),numberId=text(object(val['metadata'])['phone_number_id']);
      const route=routes.find(r=>r.waba===entry['id']&&r.numberId===numberId);if(!route)throw new Error('route_rejected');
      if(!Array.isArray(val['messages']))throw new Error('message_shape');
      for(const message of val['messages']) {
        const event=object(message),type=text(event['type']);
        if(!['text','receipt'].includes(type))throw new Error('unsupported_message');
        const providerId=text(event['id']);
        const subject=type==='receipt'?text(event['recipient']):text(event['from']);
        if(type==='text')text(object(event['text'])['body']);
        else {text(event['attemptId']);text(event['messageId']);if(!['sent','delivered','read','failed'].includes(text(event['status'])))throw new Error('receipt_shape');}
        parsed.push({route,event,subject,providerId});
      }
    }
  }
  if(parsed.length<1||parsed.length>100||new Set(parsed.map(v=>v.route.businessId)).size!==1)throw new Error('single_business_batch_required');
  const b=parsed[0]!.route.businessId;
  // Suppression bypasses ordinary work ordering and precedes archive availability.
  // Invalid signature/routing/shape never reaches this branch.
  for(const v of parsed)if(v.event['type']==='text'&&isWithdrawal(object(v.event['text'])['body'])) {
    const d=digest(v.event),e='inbound:'+v.providerId,at=clock.now().toISOString();
    const rev=await ingress.tx(b,async db=>(await db.query<{revision:string}>('SELECT core.suppress($1,$2,$3,$4,$5) AS revision',[b,v.subject,e,d,at])).rows[0]!.revision);
    await archive.ensure(`permission/${b}/${e}`,'SUPPRESSION',{businessId:b,subject:v.subject,evidenceId:e,digest:d},()=>({revision:Number(rev),occurredAt:at}));
  }
  const items:ObjectValue[]=[];
  for(const v of parsed) {
    const conversation=await archive.ensure(`conversation/${b}/${v.route.channelId}/${digest(v.subject)}`,'CONVERSATION',{
      businessId:b,channelId:v.route.channelId,subject:v.subject
    },()=>({conversationId:randomUUID()}));
    const input=await archive.ensure(`input/${b}/${v.route.channelId}/${digest(v.providerId)}`,'INPUT',{
      ...v.route,event:v.event,digest:digest(v.event),subject:v.subject,providerId:v.providerId,conversationId:conversation.body['conversationId']!
    },()=>({inputId:randomUUID(),receivedAt:clock.now().toISOString()}));
    items.push(input.body);
  }
  const batchId=createHash('sha256').update(raw).digest('hex'),batchDigest=digest(items as Json);
  await archive.ensure(`batch/${b}/${batchId}`,'BATCH_PREPARE',{businessId:b,batchId,batchDigest,items});
  await faults.hit('A1.afterPrepare');
  await ingress.tx(b,async db=>{await db.query('SELECT core.stage_batch($1,$2,$3,$4)',[b,batchId,batchDigest,JSON.stringify(items)]);},'A2',faults);
  const seal=await archive.ensure(`batch-commit/${b}/${batchId}`,'BATCH_COMMIT',{businessId:b,batchId,batchDigest,count:items.length});
  await faults.hit('A3.afterSeal');await sealer.seal(b,archive,seal);
  await ingress.tx(b,async db=>{await db.query('SELECT core.activate_batch($1,$2,$3,$4)',[b,batchId,seal.key,seal.digest]);},'A4',faults);
  await faults.hit('A5.beforeAck');
  return {acknowledged:true,batchId,inputs:items};
}
