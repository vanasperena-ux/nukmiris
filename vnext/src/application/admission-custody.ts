import type { EvidenceStore,Seal } from '../ports.js';
import { tenantId } from '../domain/tenant.js';
import { boundedArchive } from './archive-policy.js';
export const RAW_CUSTODY='ingress-custody';
export interface AdmissionCustody { retainRaw(batchId:string,raw:Buffer,signature:string):Promise<Seal>; tenant(businessId:string):EvidenceStore }
/** Fixed server capabilities; neither routing nor raw custody has a default facade. */
export function admissionCustody(raw:EvidenceStore,bindings:ReadonlyMap<string,EvidenceStore>):AdmissionCustody {
  if(raw.businessId!==RAW_CUSTODY)throw new Error('raw_custody_binding_required');
  const map=new Map<string,EvidenceStore>();
  for(const [b,a] of bindings){tenantId(b);if(b===RAW_CUSTODY||a.businessId!==b)throw new Error('tenant_archive_binding_required');map.set(b,boundedArchive(a));}
  const custody=boundedArchive(raw);
  return Object.freeze({retainRaw:(batchId:string,bytes:Buffer,signature:string)=>custody.ensure('raw/'+batchId,'RAW_BATCH',{businessId:RAW_CUSTODY,batchId,rawBase64:bytes.toString('base64'),signature}),
    tenant:(b:string)=>{const a=map.get(tenantId(b));if(!a)throw new Error('tenant_archive_binding_missing');return a;}});
}
