import type { UnitOfWork } from '../infrastructure/postgres/unit-of-work.js';
import type { EvidenceStore } from '../ports.js';
import { object,text,noFaults,type ObjectValue,type Faults } from '../domain/protocol.js';
import { ordinaryDecision } from '../domain/classification.js';
import { boundedArchive } from './archive-policy.js';

export async function reduceInput(args:{businessId:string;inputId:string;reducer:UnitOfWork;sealer:UnitOfWork;archive:EvidenceStore;planDigest?:string;faults?:Faults}):Promise<ObjectValue> {
  const {businessId:b,inputId,reducer,sealer}=args,archive=boundedArchive(args.archive);
  return reducer.tx(b,async db=>{
    const input=(await db.query('SELECT i.*,c.value AS classification,c.digest AS classification_digest FROM core.input i JOIN core.input_classification c ON c.business_id=i.business_id AND c.input_id=i.id WHERE i.business_id=$1 AND i.id=$2',[b,inputId])).rows[0] as ObjectValue|undefined;
    if(!input||input['state']!=='ELIGIBLE')return {state:'HELD',inputId};
    const conversationId=text(input['conversation_id']);await db.query('SELECT core.lock_conversation($1,$2)',[b,conversationId]);
    const prior=(await db.query('SELECT outcome,decision FROM core.input_reduction WHERE business_id=$1 AND input_id=$2',[b,inputId])).rows[0] as ObjectValue|undefined;
    if(prior)return {state:'TERMINAL',inputId,outcome:prior['outcome']!,decision:prior['decision']!};
    const ctx=(await db.query('SELECT * FROM core.conversation_context WHERE business_id=$1 AND conversation_id=$2',[b,conversationId])).rows[0] as ObjectValue|undefined;
    const revision=Number(ctx?.['revision']??0),mode=text(ctx?.['mode']??'BOT'),phase=text(ctx?.['phase']??'NONE'),c=object(input['classification']);
    if(c['kind']!=='ORDINARY')throw new Error('control_reduction_missing');
    const rejection=(await db.query('SELECT plan_digest,reason FROM core.plan_rejection WHERE business_id=$1 AND input_id=$2',[b,inputId])).rows[0] as {plan_digest:string;reason:string}|undefined;
    const planDigest=args.planDigest??rejection?.plan_digest;
    const original=await archive.lookup(`reduction/${b}/${inputId}`);
    if(!original&&!planDigest&&c['operation']==='SYNTHETIC_OPERATION'&&mode==='BOT'&&phase==='NONE')return {state:'OPERATION_REQUIRED',inputId};
    const d=ordinaryDecision(object(input['event']),mode,phase);if(planDigest)d.outcome='PLAN_CONFLICT';
    if(original)d.outcome=text(original.body['outcome']);
    const head=(await db.query<{ready:boolean}>('SELECT core.head_ready($1,$2,$3) AS ready',[b,conversationId,input['sequence']])).rows[0]!.ready;
    if(!head&&!['NAVIGATION','HUMAN_HANDOFF'].includes(d.outcome))return {state:'HELD',inputId};
    const decision=original?.body??{businessId:b,inputId,eventDigest:input['digest']!,classificationDigest:input['classification_digest']!,contextRevision:revision,
      previousMode:mode,previousPhase:phase,...d,outputDisposition:'LOCAL_ONLY',...(planDigest?{planDigest,planReason:rejection?.reason??'PLAN_REJECTED'}:{})};
    // Bounded local custody while holding the conversation lock; no providers and
    // no callback into a facade from inside that archive's own mutex.
    const seal=await archive.ensure(`reduction/${b}/${inputId}`,'INPUT_REDUCTION',decision);await sealer.seal(b,archive,seal);
    // Machine evidence is bound to this exact priority decision. SQL requires it
    // before atomically changing context and abandoning any never-entered work.
    if(['NAVIGATION','HUMAN_HANDOFF'].includes(text(decision['outcome']))&&Number(decision['contextRevision'])===revision){
      const attempts=(await db.query<{id:string;payload_digest:string}>(`SELECT id,payload_digest FROM core.attempt
        WHERE business_id=$1 AND envelope->>'conversationId'=$2 AND state IN ('PREPARED','ARMED') ORDER BY id`,[b,conversationId])).rows;
      for(const a of attempts){const supersession=await archive.ensure(`supersession/${b}/${inputId}/${a.id}`,'ABANDON',
        {businessId:b,attemptId:a.id,payloadDigest:a.payload_digest,priorityInputId:inputId,decisionDigest:seal.digest,reason:'CONTEXT_SUPERSEDED'});await sealer.seal(b,archive,supersession);}
    }
    const outcome=(await db.query<{outcome:string}>('SELECT core.reduce_input($1,$2,$3,$4,$5) AS outcome',[b,inputId,seal.body,seal.key,seal.digest])).rows[0]!.outcome;
    return {state:'TERMINAL',inputId,outcome,decision:seal.body};
  },'reduce',args.faults??noFaults);
}
/** Normal worker progress after a predecessor resolves; no operator HOLD and no provider calls. */
export async function drainOrdinary(args:{businessId:string;conversationId:string;reducer:UnitOfWork;sealer:UnitOfWork;archive:EvidenceStore}):Promise<ObjectValue[]> {
  const inputs=await args.reducer.tx(args.businessId,async db=>(await db.query<{id:string}>(`SELECT i.id FROM core.input i
    WHERE i.business_id=$1 AND i.conversation_id=$2 AND i.state='ELIGIBLE'
    AND NOT EXISTS(SELECT 1 FROM core.input_reduction r WHERE r.business_id=i.business_id AND r.input_id=i.id)
    AND NOT EXISTS(SELECT 1 FROM core.operation o WHERE o.business_id=i.business_id AND o.input_id=i.id)
    ORDER BY i.sequence LIMIT 100`,[args.businessId,args.conversationId])).rows);
  const out:ObjectValue[]=[];
  for(const i of inputs){const r=await reduceInput({...args,inputId:i.id});out.push(r);if(r['state']!=='TERMINAL')break;}
  return out;
}
