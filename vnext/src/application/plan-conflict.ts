import type { UnitOfWork } from '../infrastructure/postgres/unit-of-work.js';
import type { EvidenceStore,Seal } from '../ports.js';
import { reduceInput } from './reduce-input.js';
export class ConversationHeldError extends Error {readonly code='CONVERSATION_HELD';constructor(){super('conversation_head_held');}}
export class PlanConflictError extends Error {
  readonly code='PLAN_CONFLICT';
  constructor(readonly sqlState:string,readonly terminalRecorded:boolean,cause:unknown){super('terminal_plan_conflict:'+sqlState,{cause});}
}
export class PlanInvalidError extends Error {
  readonly code='PLAN_INVALID';
  constructor(readonly terminalRecorded:boolean,cause:unknown){super('terminal_plan_invalid',{cause});}
}
export async function rejectPlan(args:{businessId:string;inputId:string;plan:Seal;reason:string;reducer:UnitOfWork;sealer:UnitOfWork;archive:EvidenceStore}):Promise<boolean> {
  const {businessId:b,inputId,plan,reason,reducer}=args;
  const rejected=await reducer.tx(b,async db=>(await db.query<{rejected:boolean}>('SELECT core.reject_plan($1,$2,$3,$4,$5) AS rejected',[b,inputId,plan.digest,plan.key,reason])).rows[0]!.rejected);
  if(!rejected)return false;
  const reduced=await reduceInput({...args,planDigest:plan.digest});return reduced['state']==='TERMINAL';
}
