import { digest, isWithdrawal, object, text, type ObjectValue } from './protocol.js';
import { tenantId } from './tenant.js';

export const CLASS_RULE='L0B-CLASS-1';
export const normalizedText=(s:string):string=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export function classificationSpec(event:ObjectValue):ObjectValue {
  const kind=event['type']==='receipt'?'RECEIPT':isWithdrawal(object(event['text'])['body'])?'WITHDRAWAL':'ORDINARY';
  return {version:1,ruleVersion:CLASS_RULE,kind,
    operation:kind==='ORDINARY'&&object(event['text'])['body']==='synthetic fixed command'?'SYNTHETIC_OPERATION':'NONE'};
}
export function classify(event:ObjectValue,binding:{businessId:string;channelId:string;subject:string;inputId:string},spec=classificationSpec(event)):ObjectValue {
  return {...spec,...binding,businessId:tenantId(binding.businessId),eventDigest:digest(event)};
}
export function ordinaryDecision(event:ObjectValue,mode:string,phase:string):{outcome:string;value:string;mode:string;phase:string} {
  const value=text(object(event['text'])['body']),n=normalizedText(value);
  if(n==='menu')return {outcome:'NAVIGATION',value,mode:'BOT',phase:'NONE'};
  if(mode==='HUMAN'||['humano','hablar con una persona','hablar con un humano','human'].includes(n))return {outcome:'HUMAN_HANDOFF',value,mode:'HUMAN',phase};
  if(phase==='NAME'||phase==='DATE')return {outcome:'CONTEXT_INPUT',value,mode,phase};
  return {outcome:'NO_EFFECT',value,mode,phase};
}
/** One application authority for the only human-mode escape. Kept in the sealed
 * admission so SQL never derives navigation from a second Unicode normalizer. */
export function localRoutingDecision(payload:{kind:'TEXT'|'ACTION';value:string}):{version:1;outcome:string}{
 return {version:1,outcome:payload.kind==='TEXT'?ordinaryDecision({type:'text',text:{body:payload.value}},'BOT','NONE').outcome:'NO_EFFECT'};
}
