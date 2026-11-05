import type { EvidenceStore,Envelope,SyntheticProvider,AppliedProof } from '../ports.js';
import type { UnitOfWork } from '../infrastructure/postgres/unit-of-work.js';
import { noFaults,object,text } from '../domain/protocol.js';
import type { Clock,Faults } from '../domain/protocol.js';
import { archiveTransient,boundedArchive } from './archive-policy.js';

export async function armAttempt(args:{businessId:string;attemptId:string;ownerId:string;dispatcher:UnitOfWork;sealer:UnitOfWork;archive:EvidenceStore}):Promise<boolean> {
  const {businessId:b,attemptId,ownerId,dispatcher,sealer}=args,archive=boundedArchive(args.archive);
  const a=await dispatcher.tx(b,async db=>(await db.query(`SELECT a.envelope,a.payload_digest FROM core.attempt a JOIN core.business bh USING(business_id)
    WHERE a.business_id=$1 AND a.id=$2 AND bh.dispatch_enabled AND bh.status='ACTIVE'
      AND bh.recovery_epoch=(a.envelope->>'recoveryEpoch')::bigint AND bh.revision=(a.envelope->>'businessRevision')::bigint`,[b,attemptId])).rows[0] as {envelope:Envelope;payload_digest:string}|undefined);
  if(!a)return false;
  const seal=await archive.ensure(`arm/${b}/${attemptId}`,'ARM',{businessId:b,attemptId,payloadDigest:a.payload_digest,envelope:a.envelope},()=>({ownerId}));
  if(seal.body['ownerId']!==ownerId)return false;
  await sealer.seal(b,archive,seal);
  return dispatcher.tx(b,async db=>(await db.query<{armed:boolean}>('SELECT core.arm($1,$2,$3,$4,$5) AS armed',[b,attemptId,ownerId,seal.key,seal.digest])).rows[0]!.armed);
}

export type DispatchOutcome={state:'HELD'}|{state:'APPLIED';proof:AppliedProof}|{state:'UNKNOWN'};
export async function dispatchOnce(args:{businessId:string;attemptId:string;ownerId:string;dispatcher:UnitOfWork;archive:EvidenceStore;provider:SyntheticProvider;clock:Clock;faults?:Faults}):Promise<DispatchOutcome> {
  const {businessId:b,attemptId,ownerId,dispatcher,provider,clock}=args,faults=args.faults??noFaults,archive=boundedArchive(args.archive);
  if(provider.mode!=='WP1_SYNTHETIC_ONLY')throw new Error('synthetic_provider_only');
  const a=await dispatcher.tx(b,async db=>(await db.query('SELECT envelope,arm_seal FROM core.attempt WHERE business_id=$1 AND id=$2',[b,attemptId])).rows[0] as {envelope:Envelope;arm_seal:string|null}|undefined);
  if(!a?.arm_seal)return {state:'HELD'};
  try {
    const originalArm=await archive.lookup(a.arm_seal);
    if(!originalArm||originalArm.body['ownerId']!==ownerId)return {state:'HELD'};
    await archive.verify(originalArm);
  }catch(e){if(archiveTransient(e))return {state:'HELD'};throw e;}
  await faults.hit('dispatch.beforeGate');
  const entered=await dispatcher.tx(b,async db=>(await db.query<{entered:boolean}>('SELECT core.enter_submission($1,$2,$3,$4) AS entered',
    [b,attemptId,ownerId,clock.now().toISOString()])).rows[0]!.entered,'entry',faults);
  if(!entered)return {state:'HELD'};
  // Permit exists only in this successful-COMMIT continuation. It cannot be
  // recreated by querying the durable state or by restarting another owner.
  let unused=true;
  await faults.hit('dispatch.afterGate');
  const invoke=()=>{
    if(!unused)throw new Error('permit_consumed');unused=false;
    return provider.submitOnce(a.envelope);
  };
  try {
    const proof=await invoke();
    if(text(proof['businessId'])!==b||text(proof['attemptId'])!==attemptId||text(proof['payloadDigest'])!==a.envelope.payloadDigest)throw new Error('foreign_proof');
    await faults.hit('dispatch.afterProvider');
    return {state:'APPLIED',proof};
  } catch {
    await dispatcher.tx(b,async db=>{await db.query('SELECT core.mark_unknown($1,$2)',[b,attemptId]);}).catch(()=>{});
    return {state:'UNKNOWN'};
  }
}

export async function reconcileReadOnly(args:{envelope:Envelope;provider:SyntheticProvider}):Promise<AppliedProof|null> {
  if(args.provider.mode!=='WP1_SYNTHETIC_ONLY')throw new Error('synthetic_provider_only');
  // Intentionally has no dispatcher, arm, permit, finalizer or submit path.
  return args.provider.readOnly(object(args.envelope) as Envelope);
}
