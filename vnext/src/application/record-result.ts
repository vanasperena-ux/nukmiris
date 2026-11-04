import { digest } from '../domain/protocol.js';
import type { EvidenceStore,AppliedProof } from '../ports.js';
import type { UnitOfWork } from '../infrastructure/postgres/unit-of-work.js';

export async function recordResult(args:{proof:AppliedProof;result:UnitOfWork;sealer:UnitOfWork;archive:EvidenceStore;failAt?:string}):Promise<boolean> {
  const {proof,result,sealer,archive}=args,b=proof.businessId;
  const seal=await archive.ensure(`result/${b}/${proof.attemptId}/${digest(proof)}`,'RESULT',proof);
  await sealer.seal(b,archive,seal);
  return result.tx(b,async db=>(await db.query<{applied:boolean}>('SELECT core.apply_result($1,$2,$3,$4,$5,$6) AS applied',
    [b,proof.attemptId,proof,seal.key,seal.digest,args.failAt??''])).rows[0]!.applied);
}
